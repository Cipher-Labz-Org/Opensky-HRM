"use client";

/**
 * Converts PDF logos to PNG so they render correctly in login circles / <img>.
 * Uses arrayBuffer input (no CORS/worker CDN issues).
 */

let workerConfigured = false;

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
    workerConfigured = true;
  }
  return pdfjs;
}

function isBlankPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 8) return true;
  if (r >= 248 && g >= 248 && b >= 248) return true;
  if (r <= 30 && g <= 30 && b <= 30) return true;
  return false;
}

function trimWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isBlankPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX >= maxX || minY >= maxY) return canvas;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const pad = Math.max(4, Math.round(Math.max(cropW, cropH) * 0.04));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width - x, cropW + pad * 2);
  const h = Math.min(height - y, cropH + pad * 2);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return out;
}

/** Places logo centered on a white square (correct for circular badges). */
function padToSquare(canvas: HTMLCanvasElement, marginRatio = 0.16): HTMLCanvasElement {
  const content = Math.max(canvas.width, canvas.height, 1);
  const side = Math.ceil(content * (1 + marginRatio * 2));
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, side, side);
  ctx.drawImage(
    canvas,
    Math.round((side - canvas.width) / 2),
    Math.round((side - canvas.height) / 2),
  );
  return out;
}

async function renderPdfDataToCanvas(data: ArrayBuffer, scale = 3): Promise<HTMLCanvasElement> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    );
  });
}

/** PDF File → trimmed square PNG File for upload. */
export async function convertPdfFileToPngFile(file: File): Promise<File> {
  const data = await file.arrayBuffer();
  const raw = await renderPdfDataToCanvas(data, 3);
  const trimmed = trimWhitespace(raw);
  const square = padToSquare(trimmed, 0.16);
  const blob = await canvasToPngBlob(square);
  const base = file.name.replace(/\.pdf$/i, "") || "company_logo";
  return new File([blob], `${base}.png`, { type: "image/png" });
}

/** Any uploadable logo file → image File (PDF converted; images unchanged). */
export async function normalizeCompanyLogoUpload(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  if (!isPdf) return file;
  return convertPdfFileToPngFile(file);
}

/** Existing stored PDF URL → circle-ready PNG data URL. */
export async function pdfUrlToCirclePngDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Could not load logo (${res.status})`);
  const data = await res.arrayBuffer();
  const raw = await renderPdfDataToCanvas(data, 2.5);
  const trimmed = trimWhitespace(raw);
  return padToSquare(trimmed, 0.16).toDataURL("image/png");
}

/** Existing stored PDF URL → PNG File for re-upload migration. */
export async function pdfUrlToPngFile(url: string, fileName = "company_logo.png"): Promise<File> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Could not load logo (${res.status})`);
  const data = await res.arrayBuffer();
  const raw = await renderPdfDataToCanvas(data, 3);
  const trimmed = trimWhitespace(raw);
  const square = padToSquare(trimmed, 0.16);
  const blob = await canvasToPngBlob(square);
  return new File([blob], fileName, { type: "image/png" });
}
