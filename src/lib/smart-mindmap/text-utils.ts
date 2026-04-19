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

// ─────────────────────────────────────────────────────────────
// TF-IDF scoring
//
// Raw Jaccard treats "kubernetes" (appearing in 2 items) the same as
// "meeting" (appearing in 15). That's why the current mindmap creates
// a lot of spurious edges around common words. TF-IDF weights each
// shared token by its inverse document frequency — a word that appears
// in almost every item carries almost zero signal; a rare word carries
// a lot. The similarity between two items becomes the sum of
// weights on the tokens they share, normalised by the total weight
// available between them.
// ─────────────────────────────────────────────────────────────

/**
 * Compute per-token IDF weights over the full corpus of tokenised items.
 * IDF = log(1 + N / (1 + df)) where df is the number of items the token
 * appears in. The `+1`s keep weights bounded and non-negative.
 */
export function computeIdf(
  tokensByItem: Map<string, Set<string>>,
): Map<string, number> {
  const df = new Map<string, number>();
  const N = tokensByItem.size;
  for (const tokens of tokensByItem.values()) {
    for (const t of tokens) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, count] of df) {
    idf.set(t, Math.log(1 + N / (1 + count)));
  }
  return idf;
}

/**
 * Weighted similarity between two token sets using pre-computed IDF.
 * Returns a score in roughly [0, 1] and the top shared tokens (sorted
 * by weight descending) so callers can label the edge legibly.
 */
export function weightedSimilarity(
  a: Set<string>,
  b: Set<string>,
  idf: Map<string, number>,
): { score: number; shared: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };

  // Total available weight — sum of IDFs of every token across both sets
  // (de-duplicated). Dividing by this normalises the score.
  const union = new Set<string>([...a, ...b]);
  let total = 0;
  for (const t of union) total += idf.get(t) ?? 0;
  if (total === 0) return { score: 0, shared: [] };

  let shared = 0;
  const sharedRanked: Array<{ token: string; weight: number }> = [];
  a.forEach((t) => {
    if (b.has(t)) {
      const w = idf.get(t) ?? 0;
      shared += w;
      sharedRanked.push({ token: t, weight: w });
    }
  });
  sharedRanked.sort((x, y) => y.weight - x.weight);
  return {
    score: shared / total,
    shared: sharedRanked.map((r) => r.token),
  };
}
