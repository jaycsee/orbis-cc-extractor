import fs from "fs/promises";
import { existsSync as fileExists } from "fs";
import { stdin as input, stdout as output } from "node:process";
import path from "path";
import readline from "readline/promises";
import { delay } from "./src/extractor/util";

import * as WaterlooWorks from "./src/extractor/waterlooworks";
import * as SFUMyExperience from "./src/extractor/sfu-myexperience";
import * as PDPortal from "./src/extractor/pdportal";


const rl = readline.createInterface({ input, output });

async function main() {
  let e: WaterlooWorks.default | SFUMyExperience.default | undefined =
    undefined;
  let serializer:
    | typeof WaterlooWorks.toPostingData
    | typeof SFUMyExperience.toPostingData
    | typeof PDPortal.toPostingData
    | undefined = undefined;
  while (e === undefined || serializer === undefined) {
    const website = (
      await rl.question(
        "Which website you are using?\n\n    1) WaterlooWorks\n    2) SFU MyExperience\n    3) UBC PDPortal\n\nEnter a number press ENTER: "
      )
    ).trim();
    if (website === "1") {
      e = await WaterlooWorks.default.launch();
      serializer = WaterlooWorks.toPostingData;
    } else if (website === "2") {
      e = await SFUMyExperience.default.launch();
      serializer = SFUMyExperience.toPostingData;
    } else if (website === "3") { 
      e = await PDPortal.default.launch();
      serializer = PDPortal.toPostingData;
    } else console.log("Invalid response");
  }
  const page = await e.login(true);
  page.setViewport({ width: 0, height: 0 });
  let errors = 0;
  let i = 0;
  while (true)
    try {
      i++;
      const filename = (
        await rl.question(
          "Navigate to a posting or page of postings and enter a file name here to extract. Leave empty to use standard output: "
        )
      ).trim();
      const file = filename ? path.join("output", filename) : undefined;
      if (file && fileExists(file)) {
        const overwrite = await rl.question(
          `${filename} already exists. Overwrite? [Y/n] `
        );
        if (overwrite.toLowerCase().includes("n")) continue;
      }
      const result = (await page.$("div.pagination"))
        ? await e.extractPostingsData(page, {
            startOnCurrent: true,
            maxPages: 10,
            maxConcurrency: 25,
          })
        : [await e.extractPostingData(page)];
      if (file)
        await fs.writeFile(file, JSON.stringify(result.map(serializer as any)));
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
