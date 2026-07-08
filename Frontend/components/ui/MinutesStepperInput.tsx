"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

export type MinutesStepperInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function MinutesStepperInput({
  value,
  onChange,
  min = 5,
  max = 480,
  step = 5,
  className = "",
  ...props
}: MinutesStepperInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      onChange(clamp(value + (e.deltaY < 0 ? step : -step), min, max));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [value, onChange, step, min, max]);

  const bump = (delta: number) => onChange(clamp(value + delta, min, max));

  const btnClass =
    "grid h-4 w-6 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n, min, max));
        }}
        className={`${className} pr-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`.trim()}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 right-1 flex flex-col justify-center gap-0.5">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase duration"
          disabled={value >= max}
          onClick={() => bump(step)}
          className={`${btnClass} pointer-events-auto`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease duration"
          disabled={value <= min}
          onClick={() => bump(-step)}
          className={`${btnClass} pointer-events-auto`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
