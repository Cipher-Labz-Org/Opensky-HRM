"use client";

import { useEffect, useState } from "react";
import { clampLogoOffset, clampLogoScale, isPdfLogoUrl } from "@/lib/company-branding";
import { pdfUrlToCirclePngDataUrl } from "@/lib/render-pdf-logo";

type CompanyLogoDisplayProps = {
  src: string | null;
  alt: string;
  className?: string;
  pdfClassName?: string;
  fallbackSrc?: string | null;
  fit?: "default" | "circle";
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  fitMode?: "contain" | "cover";
};

function CircleLogoImage({
  src,
  alt,
  scale,
  offsetX,
  offsetY,
}: {
  src: string;
  alt: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const zoom = clampLogoScale(scale) / 100;
  const safeX = clampLogoOffset(offsetX);
  const safeY = clampLogoOffset(offsetY);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-full bg-white">
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[90%] w-[90%] select-none object-contain object-center"
        style={{
          transform: `translate(calc(-50% + ${safeX}px), calc(-50% + ${safeY}px)) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        decoding="async"
        loading="eager"
      />
    </div>
  );
}

/** Converts a stored PDF to PNG once, then renders like a normal image. */
function CirclePdfAsImage({
  src,
  alt,
  scale,
  offsetX,
  offsetY,
}: {
  src: string;
  alt: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPng(null);
    setError(false);
    pdfUrlToCirclePngDataUrl(src)
      .then((dataUrl) => {
        if (!cancelled) setPng(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (png) {
    return <CircleLogoImage src={png} alt={alt} scale={scale} offsetX={offsetX} offsetY={offsetY} />;
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white px-2 text-center text-[10px] leading-tight text-slate-500">
        Re-upload logo as PNG
      </div>
    );
  }

  return <div className="h-full w-full animate-pulse rounded-full bg-slate-100" aria-hidden />;
}

export function CompanyLogoDisplay({
  src,
  alt,
  className = "max-h-full max-w-full object-contain",
  pdfClassName = "h-full w-full border-0 bg-white",
  fallbackSrc = null,
  fit = "default",
  scale = 100,
  offsetX = 0,
  offsetY = 0,
}: CompanyLogoDisplayProps) {
  const effective = src || fallbackSrc;
  if (!effective) return null;

  if (fit === "circle") {
    if (isPdfLogoUrl(effective)) {
      return (
        <CirclePdfAsImage
          src={effective}
          alt={alt}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
        />
      );
    }
    return (
      <CircleLogoImage
        src={effective}
        alt={alt}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
      />
    );
  }

  if (isPdfLogoUrl(effective)) {
    const pdfSrc = effective.includes("#")
      ? effective
      : `${effective}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
    return <iframe src={pdfSrc} title={alt} className={pdfClassName} scrolling="no" />;
  }

  return <img src={effective} alt={alt} className={className} />;
}
