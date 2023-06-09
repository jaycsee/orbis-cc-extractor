import { ElementHandle, Page } from "puppeteer";
import { getInnerText, priorityMatch } from "./util";

/**
 * Gets all labeled tables of a posting page
 *
 * @param page - The page to extract the tables from
 * @returns An object containing the table data and Puppeteer handles to the table bodies
 */
export async function getPostingTables(page: Page) {
  const data = new Map<string, Map<string, string>>();
  const tables = new Map<string, ElementHandle<HTMLTableSectionElement>>();

  for (const panel of await page.$$("div.panel")) {
    const heading = await panel
      .waitForSelector("div.panel-heading")
      .then((e) => getInnerText(e))
      .then((s) => s?.trim());

    const tbody = await panel.$("tbody").catch(() => undefined);
    if (!heading || !tbody) continue;

    const tableData = new Map<string, string>();
    for (const trow of (await tbody.$$("tr:has(td + td)")) ?? []) {
      const [left, right] = await trow.$$("td");
      if (!left || !right) continue;
      tableData.set(
        (await getInnerText(left)).trim(),
        (await getInnerText(right)).trim()
      );
    }
    data.set(heading, tableData);
    tables.set(heading, tbody);
  }

  return { data, tables };
}

/**
 * Gets the tags of a posting page
 *
 * @param page - The page to extract the tags from
 * @returns A string array of the tags found on that page, or `undefined` if no tags panel could be found
 */
export async function getPostingTags(
  page: Page
): Promise<string[] | undefined> {
  let found = false;
  const tags: string[] = [];
  for (const panel of await page.$$("div.panel")) {
    const isTags = await panel
      .waitForSelector("div.panel-heading")
      .then((e) => getInnerText(e))
      .then((s) => s?.trim().toLowerCase().includes("tags"));
    if (isTags) {
      found = true;
      for (const s of (await panel.$$("span.label")).map((e) =>
        getInnerText(e).then((s) => s.trim())
      ))
        tags.push(await s);
    }
  }
  if (found) return tags;
  return undefined;
}

/**
 * Navigate to the given sub-page within a posting, most of the time including "Overview" or "Map"
 *
 * @param page - The page to navigate in. Should already be on a posting page
 * @param pillText - The sub-page to navigate to
 * @returns A promise that resolves when the navigation completes
 */
export async function navigateToPostingSubPage(page: Page, pillText: string) {
  return Promise.all([
    page.$$("div.tab-content > ul.nav.nav-pills li a").then(async (e) => {
      for (const x of e)
        if (
          (await getInnerText(x)).toLowerCase().includes(pillText.toLowerCase())
        )
          return await x.evaluate((y) => y.click());
      throw new Error(`Could not navigate to ${pillText}`);
    }),
    page.waitForNavigation(),
  ]);
}

/**
 * Gets the job ID and its associated elements from a table of postings
 *
 * @param page - The page to navigate in. Should already be on a posting page
 * @returns A data object holding references to the data table and an array of results containing the ID, the row, and a clickable element to open the posting in a new page. Returns undefined if a table could not be found
 */
export async function getPostingListData(page: Page) {
  for (const table of await page.$$("table")) {
    const headerRow = await page.$("thead tr");
    if (!headerRow) continue;

    const headerTexts = new Map<string, number>();
    for (const [index, row] of (await headerRow.$$("td, th")).entries())
      headerTexts.set(await getInnerText(row), index);
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
      for (const openClick of await row.$$("ul li a")) {
        if ((await getInnerText(openClick)).toLowerCase().includes("new tab")) {
          results.push({
            id: await getInnerText((await row.$$("td"))[postingIdIndex]),
            row,
            openClick,
          });
          break;
        }
      }
    }

    return { table, headerRow, results };
  }
}
