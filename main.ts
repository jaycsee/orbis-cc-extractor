import { stdin as input, stdout as output } from "node:process";
import readline from "readline/promises";
import Extractor from "./src/extractor/waterlooworks";
import { delay } from "./src/extractor/util";
import fs from "fs/promises";
import path from "path";
import {
  serializablePosting,
  fromSerializablePosting,
} from "./src/extractor/waterlooworks";

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
        "Navigate to a page of postings and enter a file name here to extract. Leave empty to use standard output: "
      );
      await fs.writeFile(
        path.join("output", filename),
        JSON.stringify(
          (
            await e.extractPostingsData(page, {
              startOnCurrent: true,
              maxPages: 5,
              maxConcurrency: 20,
            })
          ).map(serializablePosting)
        )
      );
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
