import { ElementHandle, Page } from "puppeteer";
import { getInnerText } from "./util";

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
