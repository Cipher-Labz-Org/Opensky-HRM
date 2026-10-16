"use client";

import { useEffect, useRef } from "react";

type DayPoint = { label: string; count: number; isToday?: boolean };

const CIRC = 2 * Math.PI * 50;

export function CommandCenterPlot({ days }: { days: DayPoint[] }) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const plotEl = plotRef.current;
    if (!plotEl || days.length !== 7) return;

    function draw() {
      const w = plotEl!.clientWidth;
      const h = plotEl!.clientHeight;
      if (!w || !h) return;

      const padL = 26;
      const padR = 14;
      const padT = 26;
      const padB = 16;
      const yMax = Math.max(4, ...days.map((d) => d.count));

      const X = (i: number) => padL + (i * (w - padL - padR)) / 6;
      const Y = (v: number) => h - padB - (v / yMax) * (h - padT - padB);

      const pts = days.map((d, i) => [X(i), Y(d.count)] as const);
      const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
      const area =
        line +
        ` L${X(6).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`;

      let grid = "";
      for (const v of [0, Math.ceil(yMax / 2), yMax]) {
        grid += `<line x1="${padL}" y1="${Y(v)}" x2="${w - padR}" y2="${Y(v)}" stroke="var(--rule)" stroke-width="1" stroke-dasharray="${v ? "4 5" : "0"}"/>`;
        grid += `<text x="${padL - 9}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" font-weight="600" fill="var(--ink-3)">${v}</text>`;
      }

      let marks = "";
      days.forEach((d, i) => {
        if (d.count <= 0) return;
        marks += `<circle cx="${X(i)}" cy="${Y(d.count)}" r="5.5" fill="var(--glass)" stroke="var(--sky)" stroke-width="3"/>`;
        marks += `<text x="${X(i)}" y="${Y(d.count) - 14}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${d.count}</text>`;
      });

      plotEl!.innerHTML =
        `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Activity volume over the last seven days">` +
        `<defs><linearGradient id="ccGArea" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="var(--sky)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--sky)" stop-opacity="0"/></linearGradient>` +
        `<linearGradient id="ccGLine" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="var(--ramp-3)"/><stop offset="100%" stop-color="var(--sky)"/></linearGradient></defs>` +
        grid +
        `<path d="${area}" fill="url(#ccGArea)"/>` +
        `<path d="${line}" fill="none" stroke="url(#ccGLine)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        marks +
        `</svg>`;
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(plotEl);
    return () => ro.disconnect();
  }, [days]);

  return (
    <>
      <div className="plot" ref={plotRef} />
      <div className="xaxis">
        {days.map((d) => (
          <span key={d.label} className={d.isToday ? "now" : undefined}>
            {d.label}
          </span>
        ))}
      </div>
    </>
  );
}

export function ringOffset(pct: number): number {
  return CIRC * (1 - Math.min(100, Math.max(0, pct)) / 100);
}

export const RING_CIRC = CIRC;
