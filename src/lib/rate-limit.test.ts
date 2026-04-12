import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, getClientIp, rateLimitResponse } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Unique keys per test avoid cross-pollution from the shared Map
  });

  it("allows the first request", () => {
    const res = rateLimit("test:allow-1", 3, 60_000);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
  });

  it("decrements remaining on each call within window", () => {
    rateLimit("test:decrement", 3, 60_000);
    rateLimit("test:decrement", 3, 60_000);
    const third = rateLimit("test:decrement", 3, 60_000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks after limit reached", () => {
    rateLimit("test:block", 2, 60_000);
    rateLimit("test:block", 2, 60_000);
    const blocked = rateLimit("test:block", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const now = Date.now();
    vi.useFakeTimers().setSystemTime(now);
    rateLimit("test:reset", 1, 1000);
    const blocked = rateLimit("test:reset", 1, 1000);
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(now + 1500);
    const after = rateLimit("test:reset", 1, 1000);
    expect(after.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("treats different keys independently", () => {
    rateLimit("test:a", 1, 60_000);
    const b = rateLimit("test:b", 1, 60_000);
    expect(b.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("reads from x-forwarded-for (first value)", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://x", { headers: { "x-real-ip": "1.2.3.4" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no IP header present", () => {
    const req = new Request("http://x");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After header", async () => {
    const future = Date.now() + 5000;
    const res = rateLimitResponse({ allowed: false, remaining: 0, resetAt: future });
    expect(res.status).toBe(429);
    const retry = Number(res.headers.get("Retry-After"));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(6);
    const body = await res.json();
    expect(body.error).toMatch(/Too many requests/);
  });
});
