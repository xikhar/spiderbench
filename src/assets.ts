// Resolve public assets against Vite's configured base so the app works both
// at the domain root and when hosted from a subpath such as /spiderbench/.
const BASE_URL = import.meta.env?.BASE_URL || "/";

export function assetUrl(path: unknown): string {
  const value = String(path ?? "");
  if (
    /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(value) ||
    /^(?:data|blob):/i.test(value)
  ) {
    return value;
  }

  const normalizedPath = value.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${BASE_URL}${normalizedPath}`;
}
