import fs from "fs/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "path";
import readline from "readline/promises";
import { delay } from "./src/extractor/util";
import Extractor, { toPostingData } from "./src/extractor/pdportal";

const rl = readline.createInterface({ input, output });

async function main() {
  const e = await Extractor.launch();
  const page = await e.login(true);
  page.setViewport({ width: 0, height: 0 });
  let errors = 0;
  let i = 0;
  while (true)
    try {
      i++;
      const filename = await rl.question(
        "Navigate to a posting or page of postings and enter a file name here to extract. Leave empty to use standard output: "
      );
      const result = (await page.$("div.pagination"))
        ? await e.extractPostingsData(page, {
            startOnCurrent: true,
            maxPages: 10,
            maxConcurrency: 25,
          })
        : [await e.extractPostingData(page)];
      if (filename)
        await fs.writeFile(
          path.join("output", filename),
          JSON.stringify(result.map(toPostingData))
        );
      else console.log(result);
    } catch (err) {
      if (errors > 3) break;
      errors++;
      console.error(err);
    }
}

async function starter() {
  await main();
  console.log("End of script");
  await delay(100000000);
}

starter();
