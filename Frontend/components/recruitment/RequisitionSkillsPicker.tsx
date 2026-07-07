"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

type SkillSuggestionsResponse = {
  suggested: string[];
  source: string;
  catalog: string[];
};

type AiStatusResponse = {
  enabled: boolean;
  configured: boolean;
};

type AiSkillResponse = {
  skills: string[];
  fromCache: boolean;
  source: string;
};

type Props = {
  title: string;
  jobTitleId?: string;
  departmentId?: string;
  value: string[];
  onChange: (skills: string[]) => void;
  inputClass?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  template: "role template",
  history: "past requisitions",
  default: "general defaults",
  mixed: "templates & history",
  ai: "AI suggestion",
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function AiSparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.455 2.456Z"
      />
    </svg>
  );
}

function SkillChip({
  skill,
  selected,
  onToggle,
}: {
  skill: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
      }`}
    >
      {selected ? "✓ " : "+ "}
      {skill}
    </button>
  );
}

export function RequisitionSkillsPicker({
  title,
  jobTitleId,
  departmentId,
  value,
  onChange,
  inputClass,
}: Props) {
  const [suggestions, setSuggestions] = useState<SkillSuggestionsResponse>({
    suggested: [],
    source: "default",
    catalog: [],
  });
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse>({ enabled: false, configured: false });
  const [aiSkills, setAiSkills] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiFromCache, setAiFromCache] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState("");

  const debouncedTitle = useDebouncedValue(title.trim(), 350);
  const debouncedJobTitleId = useDebouncedValue(jobTitleId ?? "", 350);

  const fieldClass =
    inputClass ??
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

  useEffect(() => {
    apiFetch<AiStatusResponse>("/api/recruitment/skill-suggestions/ai/status")
      .then(setAiStatus)
      .catch(() => setAiStatus({ enabled: false, configured: false }));
  }, []);

  useEffect(() => {
    setAiSkills([]);
    setAiError("");
    setAiFromCache(false);
  }, [debouncedTitle, debouncedJobTitleId, departmentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedTitle) params.set("title", debouncedTitle);
    if (debouncedJobTitleId) params.set("jobTitleId", debouncedJobTitleId);
    const qs = params.toString();

    apiFetch<SkillSuggestionsResponse>(`/api/recruitment/skill-suggestions${qs ? `?${qs}` : ""}`)
      .then((data) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestions({ suggested: [], source: "default", catalog: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTitle, debouncedJobTitleId]);

  const toggleSkill = useCallback(
    (skill: string) => {
      const exists = value.some((s) => s.toLowerCase() === skill.toLowerCase());
      if (exists) {
        onChange(value.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
      } else {
        onChange([...value, skill]);
      }
    },
    [onChange, value]
  );

  const catalogOptions = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    const merged = new Set<string>([...suggestions.catalog, ...value, ...aiSkills]);
    suggestions.suggested.forEach((s) => merged.add(s));
    return [...merged]
      .filter((s) => !q || s.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b));
  }, [catalogFilter, suggestions.catalog, suggestions.suggested, value, aiSkills]);

  async function suggestWithAi() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setAiError("Enter a requisition title first.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const result = await apiFetch<AiSkillResponse>("/api/recruitment/skill-suggestions/ai", {
        method: "POST",
        body: JSON.stringify({
          title: trimmedTitle,
          jobTitleId: jobTitleId || null,
          departmentId: departmentId || null,
        }),
      });
      setAiSkills(result.skills ?? []);
      setAiFromCache(result.fromCache);
    } catch (err) {
      setAiSkills([]);
      setAiError(err instanceof Error ? err.message : "AI suggestion failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function addManualSkill() {
    const skill = manualInput.trim().replace(/\s+/g, " ");
    setManualError("");
    if (!skill) {
      setManualError("Enter a skill name.");
      return;
    }
    if (value.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setManualInput("");
      return;
    }
    onChange([...value, skill]);
    setManualInput("");
  }

  const sourceLabel = SOURCE_LABELS[suggestions.source] ?? suggestions.source;
  const showAiButton = aiStatus.enabled;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-xl text-[11px] leading-relaxed text-[var(--text-muted)]">
          Suggestions use <strong>role templates</strong>, <strong>past requisitions</strong>, and your{" "}
          <strong>skills catalog</strong>. For new or niche roles, use <strong>Suggest with AI</strong>.
        </p>
        {showAiButton ? (
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-1.5 px-3 py-2 text-xs min-h-0"
            disabled={aiLoading || !title.trim()}
            onClick={suggestWithAi}
          >
            <AiSparklesIcon className={aiLoading ? "animate-pulse text-violet-600" : "text-violet-600"} />
            {aiLoading ? "Suggesting…" : "Suggest with AI"}
          </Button>
        ) : null}
      </div>

      {!showAiButton && !aiStatus.configured ? (
        <p className="text-[10px] text-[var(--text-muted)]">
          AI suggestions: add your OpenAI API key under <strong>Policy &amp; Settings → Recruitment — OpenAI</strong>.
        </p>
      ) : null}

      {aiError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{aiError}</p>
      ) : null}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/15"
              title="Remove"
            >
              {skill}
              <span aria-hidden className="text-[var(--primary)]/70">×</span>
            </button>
          ))}
        </div>
      )}

      {aiSkills.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-violet-800">AI suggested skills</span>
            <span className="text-[10px] text-violet-600">{aiFromCache ? "cached" : "OpenAI"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiSkills.map((skill) => (
              <SkillChip
                key={skill}
                skill={skill}
                selected={value.some((v) => v.toLowerCase() === skill.toLowerCase())}
                onToggle={() => toggleSkill(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {(loading || debouncedTitle) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--soft)]/40 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Suggested for this role
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{loading ? "Loading…" : sourceLabel}</span>
          </div>
          {loading ? (
            <p className="text-xs text-[var(--text-muted)]">Finding skills…</p>
          ) : suggestions.suggested.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No template match — try <strong>Suggest with AI</strong> or pick from the catalog below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.suggested.map((skill) => (
                <SkillChip
                  key={skill}
                  skill={skill}
                  selected={value.some((v) => v.toLowerCase() === skill.toLowerCase())}
                  onToggle={() => toggleSkill(skill)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Browse skills catalog</label>
        <input
          type="search"
          value={catalogFilter}
          onChange={(e) => setCatalogFilter(e.target.value)}
          className={fieldClass}
          placeholder="Filter catalog…"
        />
        <div className="mt-2 max-h-[160px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--soft)]/20 p-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-1">
          {catalogOptions.length === 0 ? (
            <p className="col-span-2 px-1 py-2 text-xs text-[var(--text-muted)]">No catalog skills match.</p>
          ) : (
            catalogOptions.slice(0, 40).map((skill) => {
              const checked = value.some((v) => v.toLowerCase() === skill.toLowerCase());
              return (
                <label
                  key={skill}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-white/60"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-[var(--border)] text-[var(--primary)]"
                    checked={checked}
                    onChange={() => toggleSkill(skill)}
                  />
                  <span className="min-w-0 truncate leading-snug">{skill}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              if (manualError) setManualError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManualSkill();
              }
            }}
            className={`${fieldClass} ${manualError ? "border-red-300" : ""}`}
            placeholder="Add a skill not in the catalog…"
          />
          {manualError ? <p className="mt-1 text-xs font-medium text-red-600">{manualError}</p> : null}
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={addManualSkill}>
          Add skill
        </Button>
      </div>
    </div>
  );
}
