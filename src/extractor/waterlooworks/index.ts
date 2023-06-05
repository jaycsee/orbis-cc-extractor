import puppeteer, { Browser, Page } from "puppeteer";

import Posting from "./posting";
import { parseInternalStatus, parseJobPostingStatus } from "./posting/status";
import { parseWorkTerm } from "./posting/workTerm";
import { parseJobDuration, parseJobLevels } from "./posting/job";
import { parseApplicationDocument } from "./posting/documents";
import moment from "moment-timezone";
import { RatingsQuestions } from "./posting/satisfactionRatings";
import {
  getInnerText,
  getInnerTextFallback,
  splitFirst,
  priorityMatch,
} from "../util";

type PostingCommon = Pick<Posting, "id" | "title" | "orgDiv" | "status">;
export { default as Posting } from "./posting";

export const POSTING_URL =
  "https://waterlooworks.uwaterloo.ca/myAccount/co-op/coop-postings.htm";
export const DASHBOARD_URL =
  "https://waterlooworks.uwaterloo.ca/myAccount/dashboard.htm";

export default class WWExtractor {
  public browser: Browser;

  public constructor(browser: Browser) {
    this.browser = browser;
  }

  public static async launch() {
    const browser = await puppeteer.launch({ headless: false });
    return new WWExtractor(browser);
  }

  public async login<R extends boolean = false>(
    keepPage?: R
  ): Promise<R extends true ? Page : undefined> {
    const page = await this.browser.newPage();
    await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      'a.button[href*="/home.htm"], a[href="/logout.htm"]'
    );
    if (!(await page.$('a[href="/logout.htm"]'))) {
      await page.click('a.button[href*="/home.htm"]');
      await page.waitForSelector(
        'a[href*="waterloo.htm"][href*="action=login"]',
        {
          visible: true,
        }
      );
      await page.click('a[href*="waterloo.htm"][href*="action=login"]');
      if (
        await page
          .waitForSelector('a["href="/logout.htm"]', { timeout: 5 })
          .then(() => false)
          .catch(() => true)
      )
        await page.waitForSelector('a[href="/logout.htm"]', { timeout: 0 });
    }
    if (keepPage) return page as any;
    await page.close();
    return undefined as any;
  }

  public async extractPosting(id: string | number) {
    let page = await this.open(id);
    const result = await this.extractPostingData(page);
    await page.close();
    return result;
  }

  public async open(id: string | number) {
    if (typeof id === "string") id = parseInt(id);
    if (isNaN(id) || !isFinite(id)) throw new Error(`Invalid posting id ${id}`);
    const posting = id.toFixed(0);
    const page = await this.browser.newPage();
    await page.setViewport({ height: 960, width: 640 });
    await page.goto(POSTING_URL);
    await page.waitForSelector(
      '#searchByPostingNumberForm input[name="action"]'
    );
    await page.$eval(
      "input#postingId",
      (e, p) => {
        e.value = p;
      },
      posting
    );
    await page.$eval("form#searchByPostingNumberForm", (e) => e.submit());
    await page.waitForSelector("#postingDiv");
    return page;
  }

  public async extractPostingData(page: Page): Promise<Posting> {
    const details = await this.extractPostingDetails(page);
    await Promise.all([
      page.$$("div.tab-content > ul.nav.nav-pills li").then(async (e) => {
        for (const x of e) {
          if ((await getInnerText(x)).toLowerCase().includes("ratings"))
            return await x.click();
        }
        throw new Error("Could not navigate to work term ratings");
      }),
      page.waitForNavigation(),
    ]);
    await page.waitForSelector("div.highcharts-container, div.alert", {
      visible: true,
      timeout: 10000,
    });
    if (await page.$("div.highcharts-container"))
      return { ...(await this.extractPostingStatsRatings(page)), ...details };
    return details;
  }

  private async extractPostingCommon(page: Page): Promise<PostingCommon> {
    // Basic Information
    const header = await page
      .waitForSelector('[class*="dashboard-header"] h1', { visible: true })
      .then(getInnerTextFallback("UNKNOWN - UNKNOWN"));
    const orgDiv = await page
      .waitForSelector('[class*="dashboard-header"] h2', { visible: true })
      .then(getInnerTextFallback("UNKNOWN - UNKNOWN"));
    const [id, title] = splitFirst(header.trim(), "-") ?? ["NaN", "UNKNOWN"];

    // Status Extraction
    const statusData = new Map<string, string>();
    const statusTable = await page.waitForSelector('[class*="Header"] table');
    if (!statusTable) throw new Error("Could not extract status data");
    for (const trow of await statusTable.$$("tr:has(td + td)")) {
      const [left, right] = await trow.$$("td");
      if (!left || !right) continue;
      statusData.set(
        (await getInnerText(left)).trim(),
        (await getInnerText(right)).trim()
      );
    }

    const statusString = (...k: string[]) =>
      priorityMatch(statusData, ...k)?.trim() ?? "UNKNOWN";

    return {
      id: parseInt(id),
      title,
      orgDiv,

      status: {
        data: statusData,
        parsed: {
          posting: parseJobPostingStatus(
            statusString("job posting status", "posting")
          ),
          internal: parseInternalStatus(
            statusString("internal status", "internal")
          ),
        },
      },
    };
  }

  private async extractPostingDetails(
    page: Page
  ): Promise<Omit<Posting, "statsRatings">> {
    if (!(await page.waitForSelector("#postingDiv", { visible: true })))
      throw new Error("Tried to extract data from a non-posting page");

    const commonData = await this.extractPostingCommon(page);

    let jobData: Posting["job"]["data"] | undefined = undefined;
    let applicationData: Posting["application"]["data"] | undefined = undefined;
    let companyData: Posting["company"]["data"] | undefined = undefined;
    let tags: Posting["application"]["tags"] | undefined = undefined;
    let serviceTeamData: Posting["serviceTeam"]["data"] | undefined = undefined;

    // Posting Detail Extraction
    for (const panel of await page.$$("div.panel")) {
      const heading = await panel
        .waitForSelector("div.panel-heading")
        .then((e) => e!.evaluate((x) => x.innerText))
        .then((s) => s.trim().toLowerCase())
        .catch(() => undefined);
      if (heading?.includes("tags")) {
        tags = [];
        for (const s of (await panel.$$("span.label")).map((e) =>
          e.evaluate((x) => x.innerText.trim())
        ))
          tags.push(await s);
        continue;
      }

      const tbody = await panel.$("tbody").catch(() => undefined);
      if (!heading || !tbody) continue;

      const data = new Map<string, string>();
      for (const trow of (await tbody.$$("tr:has(td + td)")) ?? []) {
        const [left, right] = await trow.$$("td");
        if (!left || !right) continue;
        data.set(
          (await getInnerText(left)).trim(),
          (await getInnerText(right)).trim()
        );
      }

      if (heading.includes("job posting")) jobData = data;
      else if (heading.includes("application")) applicationData = data;
      else if (heading.includes("company")) companyData = data;
      else if (heading.includes("service team")) serviceTeamData = data;
    }

    if (
      !jobData ||
      !applicationData ||
      !companyData ||
      !tags ||
      !serviceTeamData
    )
      throw new Error("Extracted incomplete data from posting page");

    // Interactions
    const availableInteractions: string[] = [];
    for (const s of await page.$$("#np_interactions_nav button"))
      availableInteractions.push(await getInnerText(s));

    // Parsing

    const lowerTags = tags.map((s) => s.toLowerCase());
    const lowerInteractions = availableInteractions.map((s) => s.toLowerCase());

    const jobStringU = (...k: string[]) =>
      priorityMatch(jobData!, ...k)?.trim();
    const jobString = (...k: string[]) => jobStringU(...k) ?? "UNKNOWN";
    const appStringU = (...k: string[]) =>
      priorityMatch(applicationData!, ...k)?.trim();
    const appString = (...k: string[]) => appStringU(...k) ?? "UNKNOWN";
    const companyStringU = (...k: string[]) =>
      priorityMatch(companyData!, ...k)?.trim();
    const companyString = (...k: string[]) => companyStringU(...k) ?? "UNKNOWN";
    const serviceTeamStringU = (...k: string[]) =>
      priorityMatch(serviceTeamData!, ...k)?.trim();
    const serviceTeamString = (...k: string[]) =>
      serviceTeamStringU(...k) ?? "UNKNOWN";

    const [categoryNumber, categoryTitle] = splitFirst(
      jobString("job category (noc)", "job category", "category"),
      " "
    ) ?? ["NaN", "UNKNOWN"];

    return {
      ...commonData,
      job: {
        data: jobData,
        parsed: {
          workTerm: parseWorkTerm(jobString("work term", "term")),
          type: jobString("job type", "type"),
          title: jobString("job title", "title"),
          openings: parseInt(
            jobString("number of job openings", "job openings", "opening")
          ),
          category: {
            number: parseInt(categoryNumber),
            title: categoryTitle,
          },
          level: parseJobLevels(jobString("level")),
          region: jobString("region"),
          address: [
            ...[
              "address line one",
              "address line two",
              "address line three",
            ].flatMap((s) => {
              let x = jobStringU(s);
              return x ? [x] : [];
            }),
            `${jobString("city")}, ${jobString(
              "province / state",
              "province"
            )}, ${jobString(
              "postal code / zip code",
              "postal code",
              "postal"
            )}`,
            jobString("country / region", "country"),
          ],
          location: jobStringU("job location", "location"),
          duration: parseJobDuration(
            jobString("work term duration", "duration")
          ),
          specialRequirements: jobStringU(
            "special job requirements",
            "special job",
            "special"
          ),
          summary: jobString("job summary", "summary"),
          responsibilities: jobString(
            "job responsibilities",
            "responsibilities"
          ),
          skills: jobString("required skills", "skills"),
          transportationHousing: jobStringU(
            "transportation and housing",
            "transportation",
            "housing"
          ),
          compensation: jobStringU(
            "compensation and benefits information",
            "compensation and benefits",
            "compensation",
            "benefits"
          ),
          targets:
            jobStringU(
              "targeted degrees and disciplines",
              "targeted degrees",
              "targeted"
            )
              ?.split("\n")
              .filter((s) => !s.toLowerCase().includes("targeted clusters"))
              .map((s) => (s.startsWith("- ") ? s.slice(2).trim() : s)) ?? [],
        },
      },
      application: {
        data: applicationData,
        availableInteractions,
        tags,
        parsed: {
          deadline: moment
            .tz(
              appString("application deadline", "deadline"),
              "MMMM DD, YYYY HH:mm a",
              "America/Toronto"
            )
            .toDate(),
          method: appString("application method", "method"),
          preScreening: !!(await getInnerText(
            await page.$("div.tab-content > div:first-child")
          ).then((s) => s?.toLowerCase().includes("pre-screening"))),
          requiredDocuments:
            appStringU(
              "application documents required",
              "documents required",
              "documents"
            )
              ?.split(",")
              .map(parseApplicationDocument) ?? [],
          status: lowerTags.some((s) => s.includes("application submitted"))
            ? "APPLIED"
            : commonData.status.parsed.posting === "EXPIRED"
            ? "EXPIRED"
            : lowerTags.some((s) => s.includes("shortlisted"))
            ? "SHORTLISTED"
            : lowerInteractions.some((s) => s.includes("include"))
            ? "NOT-INTERESTED"
            : lowerInteractions.some((s) => s.includes("apply"))
            ? "AVAILABLE"
            : "UNKNOWN",
          additionalInformation: appStringU(
            "additional application information",
            "additional"
          ),
        },
      },
      company: {
        data: companyData,
        parsed: {
          division: companyString("division", "div"),
          organization: companyString("organization", "org"),
        },
      },
      serviceTeam: {
        data: serviceTeamData,
        parsed: {
          accountManager: serviceTeamString("am"),
          hiringProcessSupport: serviceTeamString("hps"),
          workTermSupport: serviceTeamString("wts"),
          processAdministrator: serviceTeamString("pa"),
        },
      },
    };
  }

  private async extractPostingStatsRatings(
    page: Page
  ): Promise<PostingCommon & Pick<Posting, "statsRatings">> {
    const commonData = await this.extractPostingCommon(page);

    const overallRating = await page
      .$$("div.tab-content > ul.nav.nav-pills li")
      .then(async (e) => {
        for (const x of e)
          if ((await getInnerText(x)).toLowerCase().includes("ratings")) {
            const rating = await getInnerText(await x.$("span.badge"));
            return rating ? (eval(rating) as number) : undefined;
          }
        throw new Error("Could not extract work term ratings");
      });

    let hiredOrg:
      | NonNullable<Posting["statsRatings"]>["parsed"]["hired"]["organization"]
      | undefined = undefined;
    let hiredDiv:
      | NonNullable<Posting["statsRatings"]>["parsed"]["hired"]["division"]
      | undefined = undefined;
    let satisfaction: NonNullable<
      Posting["statsRatings"]
    >["parsed"]["satisfaction"] = undefined;

    // Extract table data
    for (const section of await page.$$(
      "div.tab-content div.span12:has(h2:first-child)"
    )) {
      const sectionHeading = (
        await getInnerText(await section.$("h2:first-child"))
      )?.toLowerCase();

      const table = await section.$("table");
      if (!sectionHeading || !table) continue;

      const headers = (
        await Promise.all((await table.$$("thead th")).map(getInnerText))
      ).map((s) => s.toLowerCase());
      const rows = (
        await Promise.all(
          (
            await table.$$("tbody tr")
          ).map((r) => r.$$("td").then((d) => Promise.all(d.map(getInnerText))))
        )
      ).map((s) => s.map((t) => t.toLowerCase()));

      if (sectionHeading.includes("hiring history")) {
        for (const row of rows) {
          let [category, , ...rest] = row;
          if (!category) continue;
          category = category.toLowerCase();
          const pairs = rest.map(
            (e, i) =>
              [
                parseWorkTerm(headers[i + 2] ?? "NaN - UNKNOWN"),
                parseInt(e),
              ] satisfies NonNullable<typeof hiredOrg>[number]
          );
          if (category.includes("organization")) hiredOrg = pairs;
          else if (category.includes("division")) hiredDiv = pairs;
        }
      } else if (sectionHeading.includes("ratings summary")) {
        const ratingIndex = headers.findIndex((h) =>
          h.includes("satisfaction rating")
        );
        const nIndex = headers.findIndex((h) => h.includes("number of"));
        if (ratingIndex === -1 || nIndex === -1) continue;

        const allCoop = rows.find((r) => r[0]?.includes("all co-op"))!;
        const organization = rows.find((r) => r[0]?.includes("organization"))!;
        const division = rows.find((r) => r[0]?.includes("division"))!;
        satisfaction = {
          allCoop: {
            rating: parseFloat(allCoop[ratingIndex]!) / 10,
            n: parseInt(allCoop[nIndex]!),
          },
          organization: {
            rating: parseFloat(organization[ratingIndex]!) / 10,
            n: parseInt(organization[nIndex]!),
          },
          division: {
            rating: parseFloat(division[ratingIndex]!) / 10,
            n: parseInt(division[nIndex]!),
          },
        };
      }
    }

    type ParsedStatsRatings = NonNullable<Posting["statsRatings"]>["parsed"];
    let percentByFaculty:
      | ParsedStatsRatings["percentByFaculty"]["division"]
      | undefined = undefined;
    let percentByTermNumber:
      | ParsedStatsRatings["percentByTermNumber"]["division"]
      | undefined = undefined;
    let amountByProgram:
      | ParsedStatsRatings["amountByProgram"]["division"]
      | undefined = undefined;
    let questionRating: ParsedStatsRatings["questionRating"] | undefined =
      undefined;

    // Extract chart data
    for (const chart of await page.$$("div.highcharts-container svg")) {
      const title = await chart.$eval('text[class*="title"]', (e) =>
        e.textContent?.toLowerCase()
      );
      const dataLabels = await chart.$$eval(
        '[class*="data-labels"] text',
        (e) => e.map((x) => x.textContent)
      );
      if (!title) continue;

      if (title.includes("hires by faculty")) {
        percentByFaculty = new Map();
        for (const label of dataLabels) {
          if (!label) continue;
          const [faculty, percentage] = label.split(": ");
          if (!faculty || !percentage) continue;
          percentByFaculty.set(faculty, parseFloat(percentage) / 100);
        }
      } else if (title.includes("hires by student work term")) {
        percentByTermNumber = new Map();
        for (const label of dataLabels) {
          if (!label) continue;
          const [term, percentage] = label.split(": ");
          if (!term || !percentage) continue;
          percentByTermNumber.set(term, parseFloat(percentage) / 100);
        }
      } else if (title.includes("hired programs")) {
        amountByProgram = new Map();
        const xLabels = await chart.$$eval(
          '[class*="xaxis-labels"] text',
          (e) => e.map((x) => x.textContent)
        );
        for (const [data, x] of dataLabels.map((e, i) => [e, xLabels[i]])) {
          if (!data || !x) continue;
          amountByProgram.set(x, parseInt(data));
        }
      } else if (title.includes("work term satisfaction")) {
        if (!satisfaction) continue;
        if (dataLabels.length === 20) {
          satisfaction.division.distribution = [
            undefined,
            ...dataLabels.slice(0, 10).map((s) => parseFloat(s!) / 100),
          ] as unknown as NonNullable<
            typeof satisfaction.division.distribution
          >;
          satisfaction.organization.distribution = [
            undefined,
            ...dataLabels.slice(10).map((s) => parseFloat(s!) / 100),
          ] as unknown as NonNullable<
            typeof satisfaction.organization.distribution
          >;
        } else {
          satisfaction.organization.distribution = [
            undefined,
            ...dataLabels.map((s) => parseFloat(s!) / 100),
          ] as unknown as NonNullable<
            typeof satisfaction.organization.distribution
          >;
        }
      } else if (title.includes("rating by question")) {
        const scriptTag = await chart.evaluate(
          (x) =>
            x.parentNode?.parentNode?.parentNode?.querySelector("script")
              ?.innerHTML
        );
        if (!scriptTag) continue;
        const answerData = [
          ...scriptTag
            .replaceAll(/[\n\t]/g, "")
            .matchAll(/name\s*:\s*"[^"]+"\s*,\s*data\s*:\s*\[[^\]]+\]/gi),
        ];

        let allCoop:
          | NonNullable<ParsedStatsRatings["questionRating"]>["allCoop"]
          | undefined = undefined;
        let organization:
          | NonNullable<ParsedStatsRatings["questionRating"]>["allCoop"]
          | undefined = undefined;
        let division:
          | NonNullable<ParsedStatsRatings["questionRating"]>["allCoop"]
          | undefined = undefined;

        for (const [answer] of answerData) {
          let [name, data] = answer.split("data:");
          if (!name || !data) continue;
          name = name.toLowerCase();
          const parsedData = (eval(data) as number[]).map((x) => x / 5);
          if (name.includes("average of all"))
            allCoop = [undefined, ...parsedData] as NonNullable<typeof allCoop>;
          else if (answerData.length === 2)
            organization = [undefined, ...parsedData] as NonNullable<
              typeof organization
            >;
          else
            division = [undefined, ...parsedData] as NonNullable<
              typeof division
            >;
        }

        if (!allCoop)
          throw new Error("Could not extract all co-op ratings by question");

        questionRating = {
          questions: RatingsQuestions,
          allCoop,
          division,
          organization,
        };
      }
    }

    if (!hiredDiv || !hiredOrg)
      throw new Error("Could not extract hiring history");
    if (!percentByFaculty)
      throw new Error("Could not extract hires by faculty");
    if (!percentByTermNumber)
      throw new Error("Could not extract hires by term number");
    if (!amountByProgram) throw new Error("Could not hires by program");

    return {
      ...commonData,
      statsRatings: {
        parsed: {
          overallRating,
          hired: { organization: hiredOrg, division: hiredDiv },
          satisfaction,
          percentByFaculty: { division: percentByFaculty },
          percentByTermNumber: { division: percentByTermNumber },
          amountByProgram: { division: amountByProgram },
          questionRating,
        },
      },
    };
  }
}
