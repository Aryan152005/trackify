import { describe, it, expect } from "vitest";
import { tokenize, jaccard, sameDay } from "./text-utils";

describe("tokenize", () => {
  it("returns empty set for null/empty input", () => {
    expect(tokenize(null).size).toBe(0);
    expect(tokenize("").size).toBe(0);
  });

  it("lowercases + splits on whitespace + strips punctuation", () => {
    const t = tokenize("Backend API work, refactor!");
    expect(Array.from(t).sort()).toEqual(["api", "backend", "refactor", "work"]);
  });

  it("drops stopwords", () => {
    const t = tokenize("the quick brown fox is on the log");
    expect(t.has("the")).toBe(false);
    expect(t.has("quick")).toBe(true);
    expect(t.has("brown")).toBe(true);
  });

  it("drops short (<=2 char) tokens", () => {
    const t = tokenize("a b cd efg");
    expect(t.has("a")).toBe(false);
    expect(t.has("b")).toBe(false);
    expect(t.has("cd")).toBe(false);
    expect(t.has("efg")).toBe(true);
  });

  it("dedupes", () => {
    const t = tokenize("dog dog dog");
    expect(t.size).toBe(1);
  });
});

describe("jaccard", () => {
  it("returns 0 score when either set is empty", () => {
    expect(jaccard(new Set(), new Set(["a"])).score).toBe(0);
    expect(jaccard(new Set(["a"]), new Set()).score).toBe(0);
  });

  it("computes perfect overlap", () => {
    const res = jaccard(new Set(["a", "b"]), new Set(["a", "b"]));
    expect(res.score).toBe(1);
    expect(res.shared.sort()).toEqual(["a", "b"]);
  });

  it("computes partial overlap", () => {
    // 2 shared / 3 union = 0.666…
    const res = jaccard(new Set(["a", "b"]), new Set(["b", "c"]));
    expect(res.score).toBeCloseTo(1 / 3, 3);
    expect(res.shared).toEqual(["b"]);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccard(new Set(["x"]), new Set(["y"])).score).toBe(0);
  });
});

describe("sameDay", () => {
  it("returns true for same date-only strings", () => {
    expect(sameDay("2026-04-12", "2026-04-12")).toBe(true);
  });

  it("returns true when both are ISO timestamps on same day", () => {
    expect(sameDay("2026-04-12T08:00:00Z", "2026-04-12T23:59:00Z")).toBe(true);
  });

  it("returns false across days", () => {
    expect(sameDay("2026-04-12", "2026-04-13")).toBe(false);
  });

  it("returns false for null/missing", () => {
    expect(sameDay(null, "2026-04-12")).toBe(false);
    expect(sameDay("2026-04-12", null)).toBe(false);
    expect(sameDay(null, null)).toBe(false);
  });
});
