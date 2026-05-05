/**
 * Split stored template HTML so the visual editor only touches the inner `<body>`,
 * preserving `<!DOCTYPE>`, `<head>`, styles, and `</body></html>` when saving.
 */
export type ParsedTemplate =
  | { kind: "wrapped"; prefix: string; suffix: string; initialBody: string }
  | { kind: "bare"; initialBody: string };

export function parseTemplateHtml(html: string): ParsedTemplate {
  const trimmed = html.trim();
  const open = trimmed.match(/<body[^>]*>/i);
  const closeIdx = trimmed.search(/<\/body>/i);
  if (open && open.index !== undefined && closeIdx > open.index + open[0].length) {
    const start = open.index + open[0].length;
    return {
      kind: "wrapped",
      prefix: trimmed.slice(0, start),
      suffix: trimmed.slice(closeIdx),
      initialBody: trimmed.slice(start, closeIdx),
    };
  }
  return { kind: "bare", initialBody: html };
}

export function mergeTemplateHtml(parsed: ParsedTemplate, bodyHtml: string): string {
  if (parsed.kind === "wrapped") return parsed.prefix + bodyHtml + parsed.suffix;
  return bodyHtml;
}
