import { ElementHandle } from "puppeteer";

/**
 * Specify a fallback for getInnerText
 *
 * @param fallback - What to return in case the innerText retrieval fails
 * @returns A function which retrieves the innerText of an ElementHandle and falls back on the given argument
 * @example
 * const innerTextOf = getInnerTextFallback("FAILED");
 *
 * innerTextOf(await page.$("div.exists")); // Some innerText
 * innerTextOf(await page.$("div.not-exists")); // "FAILED"
 */
export const getInnerTextFallback =
  <T = undefined>(fallback?: T) =>
  async <U extends ElementHandle<HTMLElement> | null | undefined>(e: U) =>
    ((await e?.evaluate((x) => x.innerText).catch(() => undefined)) ??
      fallback) as U extends NonNullable<U> ? string : string | T;
/**
 * Gets the innerText of an ElementHandle, falling back to `undefined`
 *
 * @param e - The element to retrieve the innerText for
 * @returns The element's innerText or `undefined`
 * @example
 * getInnerText(await page.$("div.exists")); // Some innerText
 * getInnerText(await page.$("div.not-exists")); // undefined
 */
export const getInnerText = getInnerTextFallback();

/**
 * Preferentially match the keys of `map` to the provided options in the order they are provided
 *
 * If `map` takes `string` keys, keys are considered matching if the given option is a case-insensitive substring of the key
 *
 * @param map - The map to retrieve values from
 * @param options - The keys to try on `map`
 * @returns The value of the first match from `options` on the keys of `map`
 * @example
 * const map = new Map<string, string>();
 * map.set("key1", "value1");
 * map.set("key2", "value2");
 * console.log(priorityMatch(map, "key1", "something")); // "value1"
 * console.log(priorityMatch(map, "something", "key2")); // "value2"
 * console.log(priorityMatch(map, "KEY1", "KEY2")); // "value1"
 */
export const priorityMatch = <K, V>(
  map: Map<K, V>,
  ...options: K[]
): V | undefined => {
  const keys = [...map.keys()];
  const stringKeys = (keys as string[]).map(
    (s) => [s?.toLowerCase?.(), s] as const
  );
  for (const index of options) {
    if (typeof index === "string") {
      const i = index.toLowerCase().trim();
      for (const [stringKey, actualKey] of stringKeys)
        if (stringKey.includes(i)) return map.get(actualKey as K);
    } else if (keys.includes(index)) return map.get(index);
  }
  return undefined;
};

/**
 * Split the string `s` on the first occurrence of `separator`
 *
 * @param s - The string to split
 * @param separator - The substring of `s` to split on
 * @returns A 2-element array of the strings before and after `separator`, or undefined if the separator could not be found
 * @example
 * console.log(splitFirst("What a wonderful world!", " ")); // ["What", "a wonderful world!"]
 * console.log(splitFirst("What a wonderful world!", "-")); // undefined
 */
export const splitFirst = (s: string, separator: string) =>
  new RegExp(`^(.*?)\\s?${separator}\\s?(.*)$`).exec(s.trim())?.slice(1, 3) as
    | [string, string]
    | undefined;

/**
 * Delays for the given time in ms
 *
 * @param ms - The number of milliseconds
 * @returns A promise that resolves after the given milliseconds
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type MapEntries<K, V> = [K, V][];
export type ParsableMapEntries<K, V> = Map<K, V> | MapEntries<K, V>;

/**
 * Ensure that the given data is in the form of a `Map`.
 * The data can either be an instance of `Map`, or the result of `map.entries()`
 *
 * @param entries - The map data
 * @param fieldName - The name of the map being parsed. Only used when an error is thrown
 * @param skipKeyStringify - Whether to skip the key stringify. Defaults to `false`
 * @param skipValueStringify - Whether to skip the value stringify. Defaults to `false`
 * @returns The parsed map
 * @example
 * const data = [["key1", "value1"], ["key2", "value2"], [3, 4]];
 * console.log([...parseMap(data).entries()]); // [["key1", "value1"], ["key2", "value2"], ["3", "4"]];
 * console.log([...parseMap(data, "", true, false).entries()]); // [["key1", "value1"], ["key2", "value2"], [3, "4"]];
 * console.log([...parseMap(data, "", false, true).entries()]); // [["key1", "value1"], ["key2", "value2"], ["3", 4]];
 */
export function parseMap<
  K,
  V,
  const SK extends boolean = false,
  const SV extends boolean = false
>(
  entries: ParsableMapEntries<K, V>,
  fieldName?: string,
  skipKeyStringify?: SK,
  skipValueStringify?: SV
): Map<SK extends false ? string | K : K, SV extends false ? string | V : V> {
  type RK = SK extends false ? string | K : K;
  type RV = SV extends false ? string | V : V;
  if (entries instanceof Map) return entries;
  else if (
    Array.isArray(entries) &&
    entries.every((x) => Array.isArray(x) && x.length === 2)
  )
    return new Map<RK, RV>(
      entries.map((x) => [
        (skipKeyStringify ? x[0] : String(x[0])) as RK,
        (skipValueStringify ? x[1] : String(x[1])) as RV,
      ])
    );
  else throw new Error(`Got incorrect data type parsing ${fieldName}`);
}
