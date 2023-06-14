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

    const tableData = new Map(
      await tbody.$$eval("tr:has(td + td)", (trows) =>
        trows.flatMap((trow) => {
          const [left, right] = [...trow.querySelectorAll("td")].map(
            (x) => x.innerText
          );
          if (!left || !right) return [];
          return [[left.trim(), right.trim()] as const];
        })
      )
    );
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
  return await page.$$eval("div.panel", (panels) => {
    for (const panel of panels) {
      const heading = panel.querySelector("div.panel-heading");
      if (
        heading instanceof HTMLElement &&
        heading.innerText?.trim().toLowerCase().includes("tags")
      )
        return [...panel.querySelectorAll("span.label")].flatMap((x) =>
          x instanceof HTMLElement ? [x.innerText.trim()] : []
        );
    }
    return undefined;
  });
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
    page.evaluate((pillText) => {
      for (const x of document.querySelectorAll(
        "div.tab-content > ul.nav.nav-pills li a"
      ))
        if (
          x instanceof HTMLElement &&
          x.textContent?.toLowerCase().includes(pillText.toLowerCase())
        )
          return x.click();
      throw new Error(`Could not navigate to ${pillText}`);
    }, pillText),
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
      let openClick = await tds[0]?.$("a");

        const onClickEval = await openClick?.evaluate((el) => el.getAttribute('onclick'));

        if(!onClickEval)
          continue;
        
        const onClickEvalB = onClickEval?.replace(/\/myAccount\/co-op\/postings\.htm/, '/myAccount/co-op/postings.htm\',\'_blank'); 
        await openClick?.evaluate((el, onClickEvalB) => el.setAttribute('onclick', onClickEvalB), onClickEvalB);

        results.push({
            id: await getInnerText((await row.$$("td"))[postingIdIndex]),
            row,
            openClick: openClick!,
          });        
      
    }
    return { table, headerRow, results };
  }
}
