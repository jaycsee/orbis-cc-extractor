import WWExtractor from "./src/extractor/waterlooworks";

async function main() {
  const e = await WWExtractor.launch();
  await e.login(true);
}

async function starter() {
  try {
    await main();
  } catch (err) {
    console.log(err);
  }
  console.log("End of script");
  await new Promise((resolve) => setTimeout(resolve, 100000000));
}

starter();
