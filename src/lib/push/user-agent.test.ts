import { describe, it, expect } from "vitest";
import { summarizeUserAgent } from "./user-agent";

describe("summarizeUserAgent", () => {
  it("returns Unknown device when ua is null/empty", () => {
    expect(summarizeUserAgent(null)).toBe("Unknown device");
    expect(summarizeUserAgent("")).toBe("Unknown device");
  });

  it("detects Chrome on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(summarizeUserAgent(ua)).toBe("Chrome · Windows");
  });

  it("detects Chrome on Android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(summarizeUserAgent(ua)).toBe("Chrome · Android");
  });

  it("detects Safari on iOS", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    // UA contains both "iPhone" and "Mac OS" — iOS check comes first
    expect(summarizeUserAgent(ua)).toBe("Safari · iOS");
  });

  it("detects Edge on Windows (Edg/ comes before Chrome/)", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(summarizeUserAgent(ua)).toBe("Edge · Windows");
  });

  it("detects Firefox on Linux", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(summarizeUserAgent(ua)).toBe("Firefox · Linux");
  });

  it("returns browser only when OS unknown", () => {
    const ua = "Chrome/120";
    expect(summarizeUserAgent(ua)).toBe("Chrome");
  });
});
