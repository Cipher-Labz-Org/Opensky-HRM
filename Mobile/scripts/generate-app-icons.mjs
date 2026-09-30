import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const source = path.join(assetsDir, "opensky-hrm-waves-source.png");

const ICON_SIZE = 1024;
const SPLASH_LOGO = 512;
const FAVICON = 48;

/** @param {number} size */
async function squareIcon(size, paddingRatio = 0.12) {
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;
  const logo = await sharp(source)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function solidBackground(size, hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

const icon1024 = await squareIcon(ICON_SIZE);
await sharp(icon1024).toFile(path.join(assetsDir, "icon.png"));

await sharp(icon1024)
  .resize(SPLASH_LOGO, SPLASH_LOGO)
  .toFile(path.join(assetsDir, "splash-icon.png"));

await sharp(icon1024)
  .resize(ICON_SIZE, ICON_SIZE)
  .toFile(path.join(assetsDir, "android-icon-foreground.png"));

await solidBackground(ICON_SIZE, "#000000").then((buf) =>
  sharp(buf).toFile(path.join(assetsDir, "android-icon-background.png")),
);

await sharp(icon1024).resize(FAVICON, FAVICON).toFile(path.join(assetsDir, "favicon.png"));

await sharp(icon1024)
  .grayscale()
  .resize(ICON_SIZE, ICON_SIZE)
  .toFile(path.join(assetsDir, "android-icon-monochrome.png"));

console.log("Generated icon.png, splash-icon.png, android icons, favicon.png");
