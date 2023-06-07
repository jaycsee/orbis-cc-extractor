import { stdin as input, stdout as output } from "node:process";
import readline from "readline/promises";
import Extractor from "./src/extractor/waterlooworks";

const rl = readline.createInterface({ input, output });

async function main() {
  const e = await Extractor.launch();
  const page = await e.login(true);
  page.setViewport({ width: 0, height: 0 });
  let errors = 0;
  while (true)
    try {
      await rl.question(
        "Navigate to a page and press ENTER to extract the data"
      );
      console.log(await e.extractPostingData(page));
    } catch (err) {
      if (errors > 3) break;
      errors++;
      console.error(err);
    }
}

async function starter() {
  await main();
  console.log("End of script");
  await new Promise((resolve) => setTimeout(resolve, 100000000));
}

starter();
