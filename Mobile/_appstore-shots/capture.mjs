import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = pathToFileURL(path.join(__dirname, "screens.html")).href;
const destRoot = "C:\\Users\\asus\\OneDrive\\Desktop\\mobile";

const screens = [
  ["01-login", "login"],
  ["02-home", "home"],
  ["03-leave", "leave"],
  ["04-attendance", "attendance"],
  ["05-alerts", "alerts"],
  ["06-payslips", "payslips"],
  ["07-profile", "profile"],
];

const jobs = [
  {
    folder: path.join(destRoot, "iphone-6.5"),
    suffix: "1284x2778",
    viewport: { width: 428, height: 926 },
    scale: 3,
    device: "iphone",
  },
  {
    folder: path.join(destRoot, "iphone-6.5-xsmax"),
    suffix: "1242x2688",
    viewport: { width: 414, height: 896 },
    scale: 3,
    device: "iphone",
  },
  {
    folder: path.join(destRoot, "ipad-13"),
    suffix: "2064x2752",
    viewport: { width: 1032, height: 1376 },
    scale: 2,
    device: "ipad",
  },
];

fs.mkdirSync(destRoot, { recursive: true });

const browser = await chromium.launch();

for (const job of jobs) {
  fs.mkdirSync(job.folder, { recursive: true });
  const page = await browser.newPage({
    viewport: job.viewport,
    deviceScaleFactor: job.scale,
  });
  for (const [name, screen] of screens) {
    const url = `${html}?screen=${screen}&device=${job.device}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const out = path.join(job.folder, `${name}-${job.suffix}.png`);
    await page.locator("#phone").screenshot({ path: out, type: "png" });
    console.log("wrote", out);
  }
  await page.close();
}

await browser.close();
console.log("done");
