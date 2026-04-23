/**
 * Parses plain-text job descriptions produced by {@link generateRequisitionDescription}
 * (section title + em-dash rule line + body) into structured sections for document-style UI.
 */

const SECTION_HEADERS = [
  "Overview",
  "Role details",
  "What you will do",
  "Skills and qualifications",
  "How to apply",
] as const;

export type ParsedRequisitionSection = { title: string; body: string };

export type ParsedRequisitionDescription = {
  preamble: string;
  sections: ParsedRequisitionSection[];
};

function isRuleLine(line: string): boolean {
  const t = line.trim();
  return t.length >= 3 && /^[—\-_=]+$/.test(t);
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  return (SECTION_HEADERS as readonly string[]).includes(t);
}

/**
 * Returns structured sections when the text follows the generator layout; otherwise null
 * (caller should render the raw string as a single block).
 */
export function parseRequisitionDescription(text: string): ParsedRequisitionDescription | null {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  if (!normalized) return null;

  const lines = normalized.split("\n");
  const preamble: string[] = [];
  const sections: ParsedRequisitionSection[] = [];
  let mode: "preamble" | "body" = "preamble";
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  function flushSection() {
    if (currentTitle === null) return;
    sections.push({
      title: currentTitle,
      body: currentBody.join("\n").replace(/^\n+/, "").trimEnd(),
    });
    currentTitle = null;
    currentBody = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (mode === "preamble" && isSectionHeader(trimmed)) {
      mode = "body";
      flushSection();
      currentTitle = trimmed;
      while (i + 1 < lines.length && isRuleLine(lines[i + 1])) i++;
      continue;
    }

    if (mode === "body" && isSectionHeader(trimmed)) {
      flushSection();
      currentTitle = trimmed;
      while (i + 1 < lines.length && isRuleLine(lines[i + 1])) i++;
      continue;
    }

    if (mode === "preamble") {
      preamble.push(line);
    } else if (currentTitle !== null) {
      currentBody.push(line);
    }
  }

  flushSection();

  if (sections.length === 0) return null;

  return {
    preamble: preamble.join("\n").trim(),
    sections,
  };
}
