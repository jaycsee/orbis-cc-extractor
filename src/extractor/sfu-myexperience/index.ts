import puppeteer, { Browser, ElementHandle, Page } from "puppeteer";

import { getPostingTables, getPostingTags } from "../common";
import {
  delay,
  getInnerText,
  getInnerTextFallback,
  priorityMatch,
  splitFirst,
} from "../util";
import Posting, { PostingError, parsePostingData } from "./posting";

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
 * An extractor for job postings on SFU's MyExperience
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
      'a[href*="action%3Dlogin"], a[href="/logout.htm"]'
    );
    if (!(await page.$('a[href="/logout.htm"]'))) {
      await page.waitForSelector('a[href*="action%3Dlogin"]', {
        visible: true,
      });
      await page.click('a[href*="action%3Dlogin"]');
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
    const prevViewport = page.viewport();
    await page.setViewport(POSTING_VIEWPORT);

    if (!(await page.waitForSelector("#postingDiv", { visible: true })))
      throw new Error("Tried to extract data from a non-posting page");

    const details = await this.extractPostingDetails(page);
    if (typeof details.error === "string") return details;

    if (prevViewport) page.setViewport(prevViewport);
    return details;
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
  ): Promise<Posting | PostingError> {
    const commonData = await this.extractPostingCommon(page);
    const { id } = commonData;
    const { data: tableData } = await getPostingTables(page);

    const jobData = priorityMatch(tableData, "job posting", "job", "posting");
    const appData = priorityMatch(tableData, "application");
    const companyData = priorityMatch(tableData, "company");
    const tags = await getPostingTags(page);

    if (!jobData || !appData || !companyData || !tags)
      return { id, error: "Extracted incomplete data from posting page" };

    // Interactions
    const availableInteractions: string[] = [];
    for (const s of await page.$$("#np_interactions_nav button"))
      availableInteractions.push(await getInnerText(s));

    return parsePostingData({
      ...commonData,
      error: null,
      availableInteractions,
      tags,
      jobData,
      applicationData: appData,
      companyData,
    });
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
        let plist: {
          table: ElementHandle<HTMLTableElement>;
          headerRow: ElementHandle<HTMLTableRowElement>;
          results: {
            id: string | undefined;
            row: ElementHandle<HTMLTableRowElement>;
            openClick: ElementHandle<HTMLElement>;
          }[];
        } | null = null;
        for (const table of await page.$$("table")) {
          const headerRow = await page.$("thead tr");
          if (!headerRow) continue;
          const headerTexts = new Map(
            [
              ...(
                await headerRow.$$eval("td, th", (e) =>
                  e.map((x) => x.innerText)
                )
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
            let openClick = await tds[0]?.$("a:nth-of-type(2)");

            // "Apply" as second button for postings not applied to
            // "Applied" as first (only) button for postings applied to
            // "view" as first button on the "Applied To" and similar pages
            if ((await getInnerText(openClick)) !== "Apply") {
              openClick = await tds[0]?.$("a");
              const innerText = await getInnerText(openClick);
              if (innerText === "view") {
                // make onclick open in a new tab
                const onClickValue = await openClick?.evaluate((el) =>
                  el.getAttribute("onclick")
                );
                if (!onClickValue) continue;
                const newOnClickValue = onClickValue?.replace(
                  "htm').submit()",
                  "htm', '_blank').submit()"
                );
                await openClick?.evaluate(
                  (el, newOnClickValue) =>
                    el.setAttribute("onclick", newOnClickValue),
                  newOnClickValue
                );
              } else if (innerText !== "Applied") {
                continue;
              }
            }
            results.push({
              id: await getInnerText(tds[postingIdIndex]),
              row,
              openClick: openClick!,
            });
          }
          if (results.length > 0) {
            plist = { table, headerRow, results };
            break; // prevent overwriting with incorrect table later (only one correct table per page)
          }
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
