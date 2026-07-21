"use client";

import * as React from "react";

type TableBlock = {
  type: "table";
  headers: [string, string] | string[];
  rows: string[][];
};

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "heading"; level: number; text: string }
  | TableBlock;

const KV_BULLET_RE = /^[-*]\s+(?:\*\*(.+?)\*\*|(.+?))\s*:\s*(.+)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const TABLE_SEP_RE = /^\|[\s\-:|]+\|$/;

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function inferKeyValueHeaders(items: { key: string; value: string }[]): [string, string] {
  if (items.every((item) => /\d+\s*employees?/i.test(item.value))) {
    return ["Department", "Employees"];
  }
  if (items.every((item) => /^\d[\d,.\s]*$/.test(item.value.trim()))) {
    return ["Category", "Count"];
  }
  if (items.every((item) => /\d+\s*days?/i.test(item.value))) {
    return ["Leave type", "Balance"];
  }
  return ["Item", "Details"];
}

export function parseAiMessageBlocks(text: string): ContentBlock[] {
  const lines = text.split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed.length === 0) {
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const headers = parseTableRow(tableLines[0]);
        const startRow = TABLE_SEP_RE.test(tableLines[1]) ? 2 : 1;
        const rows = tableLines.slice(startRow).map(parseTableRow).filter((row) => row.some(Boolean));
        if (headers.length > 0 && rows.length > 0) {
          blocks.push({ type: "table", headers, rows });
          continue;
        }
      }
      i -= tableLines.length;
    }

    const kvMatch = trimmed.match(KV_BULLET_RE);
    if (kvMatch) {
      const kvItems: { key: string; value: string }[] = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(KV_BULLET_RE);
        if (!match) break;
        kvItems.push({ key: match[1] ?? match[2] ?? "", value: match[3] ?? "" });
        i++;
      }
      if (kvItems.length >= 2) {
        const headers = inferKeyValueHeaders(kvItems);
        blocks.push({
          type: "table",
          headers,
          rows: kvItems.map((item) => [item.key, item.value]),
        });
      } else if (kvItems.length === 1) {
        blocks.push({
          type: "list",
          items: [`**${kvItems[0].key}**: ${kvItems[0].value}`],
          ordered: false,
        });
      }
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items, ordered: false });
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items, ordered: true });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.length === 0) break;
      if (
        line.startsWith("|") ||
        /^[-*]\s/.test(line) ||
        /^\d+\.\s/.test(line) ||
        HEADING_RE.test(line) ||
        KV_BULLET_RE.test(line)
      ) {
        break;
      }
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${index}`}>{part}</React.Fragment>;
  });
}

function AiMessageTable({ headers, rows }: TableBlock) {
  const headerCells = headers.length >= 2 ? headers : ["Item", "Details"];

  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[220px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/90">
            {headerCells.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="px-2.5 py-2 font-semibold uppercase tracking-wide text-slate-500"
              >
                {renderInline(header, `th-${index}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`row-${rowIndex}`}
              className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className={`px-2.5 py-2 text-slate-700 ${cellIndex === 0 ? "font-medium text-slate-800" : ""}`}
                >
                  {renderInline(cell, `td-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AiMessageContent({ content }: { content: string }) {
  const blocks = React.useMemo(() => parseAiMessageBlocks(content), [content]);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <p
                key={index}
                className={
                  block.level <= 2
                    ? "text-sm font-semibold text-slate-900"
                    : "text-xs font-semibold uppercase tracking-wide text-slate-500"
                }
              >
                {renderInline(block.text, `h-${index}`)}
              </p>
            );
          case "paragraph":
            return (
              <p key={index} className="text-sm leading-relaxed text-slate-700">
                {renderInline(block.text, `p-${index}`)}
              </p>
            );
          case "list":
            if (block.ordered) {
              return (
                <ol key={index} className="ml-4 list-decimal space-y-1 text-sm text-slate-700">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="leading-relaxed">
                      {renderInline(item, `ol-${index}-${itemIndex}`)}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={index} className="ml-4 list-disc space-y-1 text-sm text-slate-700">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="leading-relaxed">
                    {renderInline(item, `ul-${index}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return <AiMessageTable key={index} {...block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
