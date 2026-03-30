import fs from "fs";
const p = new URL("../app/app/people/[id]/page.tsx", import.meta.url);
const s = fs.readFileSync(p, "utf8");

function extractAfter(needleBefore, mapVar) {
  const start = s.indexOf(needleBefore);
  if (start < 0) throw new Error(`not found ${needleBefore.slice(0, 40)}`);
  const sub = s.slice(start);
  const i1 = sub.indexOf("[");
  const needle = `].map((${mapVar})`;
  const i2 = sub.indexOf(needle);
  if (i2 < 0) throw new Error(`end not found for ${needleBefore.slice(0, 40)}`);
  return sub.slice(i1, i2 + 1);
}

const nat = extractAfter('name="nationality"', "n");
const cou = extractAfter('<div><label className={labelClass}>Country</label><select name="country"', "c");
const out =
  "/** Auto-extracted from people page for FormSelect options */\n" +
  `export const NATIONALITY_NAMES = ${nat} as const;\n` +
  `export const COUNTRY_NAMES = ${cou} as const;\n`;
fs.writeFileSync(new URL("../lib/people-form-lists.ts", import.meta.url), out);
console.log("ok", nat.length, cou.length);
