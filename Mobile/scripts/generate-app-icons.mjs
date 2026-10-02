import fs from "node:fs";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const sourceJpg = path.join(assetsDir, "opensky-hrm-waves-source.jpg");
const sourcePng = path.join(assetsDir, "opensky-hrm-waves-source.png");
const source = fs.existsSync(sourceJpg) ? sourceJpg : sourcePng;

const ICON_SIZE = 1024;
const SPLASH_LOGO = 512;
const FAVICON = 48;
const BG = { r: 255, g: 255, b: 255, alpha: 1 };
const BG_HEX = "#FFFFFF";

/** Turn logo black background / gaps into white; keep saturated wave colors. */
async function wavesOnWhite() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const isBlackOrGrayBg = max < 72 && chroma < 28;
    if (isBlackOrGrayBg) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      if (channels === 4) data[i + 3] = 255;
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function loadLogoRaster() {
  if (source.endsWith(".jpg") || source.endsWith(".jpeg")) {
    return sharp(source).flatten({ background: BG_HEX }).png().toBuffer();
  }
  return wavesOnWhite();
}

/** @param {number} size */
async function squareIcon(size, paddingRatio = 0.12) {
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;
  const onWhite = await loadLogoRaster();
  const logo = await sharp(onWhite)
    .trim({ threshold: 15 })
    .resize(inner, inner, { fit: "contain", background: BG })
    .flatten({ background: BG_HEX })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
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

// Android adaptive icon: full-bleed logo (APK / launcher uses adaptiveIcon in app.json)
await sharp(await loadLogoRaster())
  .resize(ICON_SIZE, ICON_SIZE, { fit: "contain", background: BG })
  .flatten({ background: BG_HEX })
  .toFile(path.join(assetsDir, "android-icon-foreground.png"));

await solidBackground(ICON_SIZE, BG_HEX).then((buf) =>
  sharp(buf).toFile(path.join(assetsDir, "android-icon-background.png")),
);

await sharp(icon1024).resize(FAVICON, FAVICON).toFile(path.join(assetsDir, "favicon.png"));

await sharp(icon1024)
  .grayscale()
  .resize(ICON_SIZE, ICON_SIZE)
  .toFile(path.join(assetsDir, "android-icon-monochrome.png"));

await sharp(icon1024)
  .resize(512, 512)
  .jpeg({ quality: 92 })
  .toFile(path.join(assetsDir, "opensky-hrm-app-icon-512.jpg"));

await sharp(icon1024).resize(512, 512).png().toFile(path.join(assetsDir, "opensky-hrm-play-icon-512.png"));

console.log("Generated icon.png, splash-icon.png, android icons, favicon.png");
