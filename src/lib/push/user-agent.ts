/**
 * Derive a short human-friendly device label from a User-Agent string.
 * Extracted from devices-actions.ts so it's testable without server-only deps.
 */
export function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}
