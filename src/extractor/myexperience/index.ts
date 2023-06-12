import puppeteer, { Browser, ElementHandle, Page } from "puppeteer";

import {
  getPostingListData,
  getPostingTables,
  getPostingTags,
  navigateToPostingSubPage,
} from "../common";
import {
  delay,
  getInnerText,
  getInnerTextFallback,
  priorityMatch,
  splitFirst,
} from "../util";
import Posting, { PostingError, parsePostingData } from "./posting";
import { RatingsQuestions } from "./posting/satisfactionRatings";
import { parseWorkTerm } from "./posting/workTerm";

type PostingCommon = Pick<Posting, "id" | "title" | "subtitle"> & {
  statusData: Posting["status"]["data"];
};
type MultipleExtractOptions = {
  maxPages?: number;
  maxConcurrency?: number;
  delay?: number;
  startOnCurrent?: boolean;
};

export * from "./posting";
export const POSTING_URL =
  "https://myexperience.sfu.ca/myAccount/co-op/postings.htm";
export const DASHBOARD_URL =
  "https://myexperience.sfu.ca/myAccount/dashboard.htm";

const POSTING_VIEWPORT = { height: 960, width: 640 };

/**
 * An extractor for job postings on WaterlooWorks
 */
export default class Extractor {
  public browser: Browser;

  public constructor(browser: Browser) {
    this.browser = browser;
  }

  /**
   * Launches a new browser and extractor
   * @returns A new extractor attached to a new browser
   */
  public static async launch() {
    const browser = await puppeteer.launch({ headless: false });
    return new Extractor(browser);
  }

  /**
   * Navigate to the login page for the job board.
   * This function will wait indefinitely until the user has logged in.
   *
   * @param keepPage - Whether to keep the login page open
   * @returns The login page if `keepPage` is set, otherwise `undefined`
   */
  public async login<R extends boolean = false>(
    keepPage?: R
  ): Promise<R extends true ? Page : undefined> {
    const page = await this.browser.newPage();
    await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      'a.button[href*="/home.htm"], a[href="/logout.htm"]',
      {timeout: 30000} // longer await timeout becuase of MFA
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

  /**
   * Extract a posting by its id in a new page. Shorthand for `open` followed by `extractPostingData`
   *
   * @param id - The posting id to extract
   * @returns The posting data
   */
  public async extractPosting(id: string | number) {
    let page = await this.open(id);
    const result = await this.extractPostingData(page);
    await page.close();
    return result;
  }

  /**
   * Interactively extract postings from a table of postings
   *
   * @param options - The extraction options
   * @yields The page that will be used. Yields only once
   * @returns An array of postings
   */
  public async *extractPostings(options?: MultipleExtractOptions) {
    const page = await this.browser.newPage();
    await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded" });
    yield page;
    return await this.extractPostingsData(page, options);
  }

  /**
   * Opens a posting by its id in a new page
   *
   * @param id - The posting id to extract
   * @returns The page that was opened
   */
  public async open(id: string | number): Promise<Page> {
    if (typeof id === "string") id = parseInt(id);
    if (isNaN(id) || !isFinite(id)) throw new Error(`Invalid posting id ${id}`);
    const posting = id.toFixed(0);
    const page = await this.browser.newPage();
    await page.setViewport(POSTING_VIEWPORT);
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

  /**
   * Extract posting data from a page
   *
   * @param page - The page to extract from. The page must already be on the page containing the data
   * @returns The posting data
   */
  public async extractPostingData(page: Page): Promise<Posting | PostingError> {
    const onStatsRatings = "div.highcharts-container, div.alert";

    const prevViewport = page.viewport();
    await page.setViewport(POSTING_VIEWPORT);

    if (!(await page.waitForSelector("#postingDiv", { visible: true })))
      throw new Error("Tried to extract data from a non-posting page");

    if (await page.$(onStatsRatings))
      await navigateToPostingSubPage(page, "overview");

    const details = await this.extractPostingDetails(page);
    if (typeof details.error === "string") return details;

    await navigateToPostingSubPage(page, "ratings");
    await page.waitForSelector(onStatsRatings, {
      visible: true,
      timeout: 10000,
    });
    const statsRatings = (await page.$("div.highcharts-container"))
      ? await this.extractPostingStatsRatings(page)
      : undefined;
    if (typeof statsRatings?.error === "string") return statsRatings;

    if (prevViewport) page.setViewport(prevViewport);
    return { ...details, statsRatings: statsRatings?.statsRatings };
  }

  /**
   * Extract data common to the "Overview" page and the "Work Term Ratings" page
   *
   * @param page - The page to extract from
   * @returns The extracted data
   */
  private async extractPostingCommon(page: Page): Promise<PostingCommon> {
    // Basic Information
    const header = await page
      .waitForSelector('[class*="dashboard-header"] h1', { visible: true })
      .then(getInnerTextFallback("UNKNOWN - UNKNOWN"));
    const subtitle = await page
      .waitForSelector('[class*="dashboard-header"] h2', { visible: true })
      .then(getInnerTextFallback("UNKNOWN - UNKNOWN"));
    const [id, title] = splitFirst(header.trim(), "-") ?? ["NaN", "UNKNOWN"];

    // Status Extraction
    const statusTable = await page.waitForSelector('[class*="Header"] table');
    if (!statusTable) throw new Error("Could not extract status data");

    return {
      id: parseInt(id),
      title,
      subtitle,

      statusData: new Map(
        await statusTable.$$eval("tr:has(td + td)", (trows) =>
          trows.flatMap((trow) => {
            const [left, right] = [...trow.querySelectorAll("td")].map(
              (x) => x.innerText
            );
            if (!left || !right) return [];
            return [[left.trim(), right.trim()] as const];
          })
        )
      ),
    };
  }

  /**
   * Extract data on the "Overview" page
   *
   * @param page - The page to extract from
   * @returns The extracted data
   */
  private async extractPostingDetails(
    page: Page
  ): Promise<Omit<Posting, "statsRatings"> | PostingError> {
    const commonData = await this.extractPostingCommon(page);
    const { id } = commonData;
    const { data: tableData } = await getPostingTables(page);

    const jobData = priorityMatch(tableData, "job posting", "job", "posting");
    const appData = priorityMatch(tableData, "application");
    const companyData = priorityMatch(tableData, "company");
    const serviceTeamData = priorityMatch(tableData, "service team", "service");
    const tags = await getPostingTags(page);

    if (!jobData || !appData || !companyData || !tags || !serviceTeamData)
      return { id, error: "Extracted incomplete data from posting page" };

    // Interactions
    const availableInteractions: string[] = [];
    for (const s of await page.$$("#np_interactions_nav button"))
      availableInteractions.push(await getInnerText(s));

    return parsePostingData({
      ...commonData,
      error: null,
      preScreening: await page.$eval(
        "div.tab-content > ul.nav.nav-pills",
        (e) => e.innerText?.toLowerCase().includes("pre-screening")
      ),
      availableInteractions,
      tags,
      jobData,
      applicationData: appData,
      companyData,
      serviceTeamData,
      statsRatings: null,
    });
  }

  /**
   * Extract data on the "Work Term Ratings" page
   *
   * @param page - The page to extract from
   * @returns The extracted data
   */
  private async extractPostingStatsRatings(
    page: Page
  ): Promise<
    (PostingCommon & Pick<Posting, "error" | "statsRatings">) | PostingError
  > {
    const commonData = await this.extractPostingCommon(page);
    const { id } = commonData;

    const overallRating = await page.$$eval(
      "div.tab-content > ul.nav.nav-pills li",
      (e) => {
        for (const x of e)
          if (x.innerText.toLowerCase().includes("ratings")) {
            const rating = x.querySelector("span.badge")?.textContent;
            return rating ? (eval(rating) as number) : undefined;
          }
        throw new Error("Could not extract work term ratings");
      }
    );

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
      const sectionHeading = await section.$eval("h2:first-child", (e) =>
        e.innerText.toLowerCase()
      );

      const table = await section.$("table");
      if (!sectionHeading || !table) continue;

      const headers = await Promise.all(
        await table.$$eval("thead th", (e) =>
          e.map((x) => x.innerText.toLowerCase())
        )
      );
      const rows = await table.$$eval("tbody tr", (e) =>
        e.map((r) =>
          [...r.querySelectorAll("td")].map((s) => s.innerText.toLowerCase())
        )
      );

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
          return {
            id,
            error: "Could not extract all co-op ratings by question",
          };

        questionRating = {
          questions: RatingsQuestions,
          allCoop,
          division,
          organization,
        };
      }
    }

    if (!hiredDiv || !hiredOrg)
      return { id, error: "Could not extract hiring history" };
    if (!percentByFaculty)
      return { id, error: "Could not extract hires by faculty" };
    if (!percentByTermNumber)
      return { id, error: "Could not extract hires by term number" };
    if (!amountByProgram) return { id, error: "Could not hires by program" };

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

  /**
   * Extract data for all postings on a page with a table of postings
   *
   * @param page - The page to extract from
   * @returns The extracted data
   */
  public async extractPostingsData(
    page: Page,
    options?: MultipleExtractOptions
  ): Promise<(Posting | PostingError)[]> {
    const paginationSelector = "div:has(span) > div.pagination";

    if (!(await page.$(paginationSelector)))
      throw new Error(
        "Tried to extract data from a page without a posting table"
      );

    if (!options?.startOnCurrent) {
      const startingPage = await page.$(
        `${paginationSelector} ul > li:not(.disabled) > a`
      );
      if (startingPage) {
        startingPage.evaluate((x) => x.click());
        await delay(3000);
      }
    }
    let openedPage: Page | null = null;
    const popupHandler = async (popup: Page) => {
      while (openedPage !== null) await delay(100);
      openedPage = popup;
    };
    page.on("popup", popupHandler);

    const done = new Set<string | undefined>();
    const results: (Posting | PostingError)[] = [];

    try {
      for (let i = 0; !options?.maxPages || i < options.maxPages; i++) {
        let plist;
        for (const table of await page.$$("table")) {
          const headerRow = await page.$("thead tr");
          if (!headerRow) continue;
            const headerTexts = new Map(
              [
                ...(
                  await headerRow.$$eval("td, th", (e) => e.map((x) => x.innerText))
                ).entries(),
              ].map(([x, y]) => [y, x] as const)
            );
            const postingIdIndex = priorityMatch(
              headerTexts,
              "job id",
              "posting id",
              "jobid",
              "postingid",
              "id"
            );
            if (postingIdIndex === undefined) continue;

            const results: {
              id: string | undefined;
              row: ElementHandle<HTMLTableRowElement>;
              openClick: ElementHandle<HTMLElement>;
            }[] = [];

            for (const row of await table.$$("tbody tr")) {
              const tds = await row.$$("td");
              const openClick = await tds[0]?.$("a:nth-of-type(2)");
            
              if (openClick) {
                results.push({
                  id: await getInnerText(tds[postingIdIndex]),
                  row,
                  openClick: openClick as ElementHandle<HTMLElement>,
                });
              }
            }
            plist = {table, headerRow, results };
        }

        if (!plist)
          throw new Error(
            "Got a page that did not contain a table of postings"
          );
        if (plist.results.filter((r) => !r.id || done.has(r.id)).length > 5)
          throw new Error(
            "Got a page containing too many entries that have already been extracted"
          );

        const jobs: Promise<(typeof results)[number]>[] = [];
        let nPages = 0;

        for (const { id, openClick } of plist.results) {
          if (id && done.has(id)) continue;
          done.add(id);
          openClick.evaluate((x) => x.click());
          while (options?.maxConcurrency && nPages > options.maxConcurrency)
            await delay(250);

          let exit = false;
          for (let i = 0; i <= 100; i++) {
            if (openedPage === null) await delay(100);
            else break;

            if (i === 100) {
              exit = true;
              results.push({ id, error: "Never got the expected popup" });
            }
          }
          if (exit) continue;

          const savedPage = openedPage!;
          nPages++;
          openedPage = null;
          jobs.push(
            this.extractPostingData(savedPage)
              .catch((e) => ({
                id,
                error: `Error extracting posting data - ${e.toString()}`,
              }))
              .finally(() => {
                savedPage.close();
                nPages--;
              })
          );
          if (options?.delay) await delay(options.delay);
        }
        for (const j of await Promise.all(jobs)) results.push(j);

        const lastText = await page.$eval(paginationSelector, (x) =>
          x?.parentNode?.textContent?.replaceAll(/[\s]/g, "")
        );

        const nextPage = await page
          .$(`${paginationSelector} li.active + li:not(.disabled)`)
          ?.then((e) => e?.$("a"));
        if (!nextPage) break;
        nextPage.evaluate((e) => e.click());

        await page.waitForFunction(
          (paginationSelector, lastText) => {
            const currentText = document
              .querySelector(paginationSelector)
              ?.parentNode?.textContent?.replaceAll(/[\s]/g, "");
            return (
              currentText?.toLowerCase()?.includes("displaying") &&
              currentText !== lastText
            );
          },
          { polling: "mutation", timeout: 10000 },
          paginationSelector,
          lastText
        );
      }
    } finally {
      page.off("popup", popupHandler);
    }
    return results;
  }
}
