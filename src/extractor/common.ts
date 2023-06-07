import { ElementHandle, Page } from "puppeteer";
import { getInnerText } from "./util";

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
