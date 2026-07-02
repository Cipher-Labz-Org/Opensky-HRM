"use client";

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "document";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function renderHtmlToPdfBlob(html: string, title: string): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;background:#fff;";
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    doc.setProperties({ title, subject: title, creator: "OpenSky HRM" });

    const blob = await new Promise<Blob>((resolve, reject) => {
      doc
        .html(wrap, {
          callback: (pdf) => {
            try {
              resolve(pdf.output("blob"));
            } catch (err) {
              reject(err);
            }
          },
          x: 24,
          y: 24,
          width: 547,
          windowWidth: 600,
          autoPaging: "text",
        })
        .catch(reject);
    });

    return blob;
  } finally {
    document.body.removeChild(wrap);
  }
}

export async function downloadHtmlAsPdf(html: string, filenameBase: string, title?: string) {
  const filename = `${sanitizeFilename(filenameBase)}.pdf`;
  const blob = await renderHtmlToPdfBlob(html, title ?? filenameBase);
  downloadBlob(blob, filename);
}

export async function shareHtmlAsPdf(html: string, filenameBase: string, title?: string): Promise<"shared" | "downloaded"> {
  const filename = `${sanitizeFilename(filenameBase)}.pdf`;
  const blob = await renderHtmlToPdfBlob(html, title ?? filenameBase);
  const file = new File([blob], filename, { type: "application/pdf" });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: title ?? filenameBase,
      text: title ?? filenameBase,
      files: [file],
    });
    return "shared";
  }

  downloadBlob(blob, filename);
  return "downloaded";
}
