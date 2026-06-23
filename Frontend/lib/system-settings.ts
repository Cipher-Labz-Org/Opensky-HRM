/** Read a system setting from GET /api/system-settings (keys may be PascalCase or camelCase). */
export function getSystemSetting(
  settings: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const direct = settings[key];
  if (direct !== undefined) return direct;
  const camel = key.charAt(0).toLowerCase() + key.slice(1);
  return settings[camel];
}
