"use client";

import { useEffect, type RefObject } from "react";

/** Animate [data-w] width bars and cell spotlight hover (matches HTML concept). */
export function useCommandCenterEffects(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const raf = requestAnimationFrame(() => {
      root.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
        const w = el.getAttribute("data-w");
        if (w) el.style.width = `${w}%`;
      });
      root.querySelectorAll<HTMLElement>("[data-ring]").forEach((el) => {
        const pct = parseFloat(el.getAttribute("data-ring") || "0");
        const c = 2 * Math.PI * 50;
        el.style.strokeDashoffset = String(c * (1 - pct / 100));
      });
    });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    const cells = root.querySelectorAll<HTMLElement>(".cell");
    const onMove = (e: MouseEvent, c: HTMLElement) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const handlers: Array<{ c: HTMLElement; fn: (e: MouseEvent) => void }> = [];
    if (!reduced && canHover) {
      cells.forEach((c) => {
        const fn = (e: MouseEvent) => onMove(e, c);
        c.addEventListener("mousemove", fn);
        handlers.push({ c, fn });
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      handlers.forEach(({ c, fn }) => c.removeEventListener("mousemove", fn));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when dashboard data paints
  }, deps);
}
