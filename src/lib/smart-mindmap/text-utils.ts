/**
 * Pure text utilities used by the smart-mindmap graph builder.
 * No external deps — safe to import + test from any context.
 */

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "for", "in", "on", "at",
  "by", "with", "from", "is", "it", "this", "that", "my", "your", "i", "we",
  "be", "are", "was", "were", "will", "new", "do", "does", "did", "done",
  "up", "down", "out", "all", "any", "some",
]);

export function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

export function jaccard(a: Set<string>, b: Set<string>): { score: number; shared: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };
  const shared: string[] = [];
  a.forEach((w) => {
    if (b.has(w)) shared.push(w);
  });
  const unionSize = new Set([...a, ...b]).size;
  return { score: shared.length / unionSize, shared };
}

export function sameDay(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.slice(0, 10) === b.slice(0, 10);
}
