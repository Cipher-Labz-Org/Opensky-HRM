const DEFAULT_ICON_PATHS = [
  "M12 4.5v15m7.5-7.5h-15",
];

const REPORT_ICON_PATHS: Record<string, string[]> = {
  "headcount-summary": [
    "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493",
    "M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z",
  ],
  "absence-frequency": [
    "M6.75 3v2.25M17.25 3v2.25",
    "M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25",
  ],
  "leave-by-type": [
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75",
    "M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25",
  ],
};

export function getReportIconPaths(_categoryKey: string, reportKey: string): string[] {
  return REPORT_ICON_PATHS[reportKey] ?? DEFAULT_ICON_PATHS;
}
