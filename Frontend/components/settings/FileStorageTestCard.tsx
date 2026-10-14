"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type ProbeStep = {
  step: string;
  ok: boolean;
  elapsedMs: number;
  errorCode?: string | null;
  error?: string | null;
};

type ProbeResponse = {
  ok: boolean;
  provider?: string;
  bucket?: string;
  region?: string;
  key?: string;
  steps?: ProbeStep[];
  message?: string;
};

export function FileStorageTestCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiFetch<ProbeResponse>("/api/system-settings/file-storage-test", { method: "POST" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Storage test failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">File storage (S3)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Writes, reads and deletes a small test file in the S3 bucket to confirm uploads really reach S3.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {running ? "Testing…" : "Test S3"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {result ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold">{result.message}</p>
          {result.bucket ? (
            <p className="mt-1 text-xs opacity-80">
              s3://{result.bucket}/{result.key} · region {result.region}
            </p>
          ) : null}
          {result.steps && result.steps.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {result.steps.map((s) => (
                <li key={s.step}>
                  <span className="font-semibold capitalize">{s.step}</span>: {s.ok ? "OK" : "Failed"} ({s.elapsedMs} ms)
                  {!s.ok && (s.errorCode || s.error) ? ` · ${[s.errorCode, s.error].filter(Boolean).join(" — ")}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
