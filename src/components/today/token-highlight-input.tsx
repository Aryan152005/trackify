"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Tokenize raw capture text into highlight-able spans. Kept deliberately
 * narrow — this does NOT replicate the server parser in src/lib/today/
 * parse.ts (that one is authoritative for what actually gets created).
 * This is UI-only: colour the obvious tokens so the user learns the
 * grammar by watching. Matches:
 *   - time     e.g. 6pm, 3:30pm, 09:00, 6am
 *   - datekey  today, tonight, tomorrow, yesterday, morning, afternoon, evening, night
 *   - weekday  mon..sun + full weekday names
 *   - tag      #word
 *   - priority p0 / p1 / p2 / p3 / p4
 *   - mention  @word
 */
export type TokenKind =
  | "time"
  | "datekey"
  | "weekday"
  | "tag"
  | "priority"
  | "mention"
  | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

const TOKEN_PATTERNS: Array<[TokenKind, RegExp]> = [
  // Order matters — longer/more-specific first.
  ["time", /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi],
  ["time", /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g],
  ["datekey", /\b(?:today|tonight|tomorrow|yesterday|morning|afternoon|evening|night|noon|midnight)\b/gi],
  [
    "weekday",
    /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi,
  ],
  ["tag", /(^|\s)(#[A-Za-z0-9_-]+)/g],
  ["priority", /(^|\s)(p[0-4])\b/gi],
  ["mention", /(^|\s)(@[A-Za-z0-9_-]+)/g],
];

interface Match {
  start: number;
  end: number;
  kind: TokenKind;
}

/** Tokenize into contiguous segments suitable for rendering. */
export function tokenize(raw: string): Token[] {
  if (!raw) return [];
  const matches: Match[] = [];
  for (const [kind, rx] of TOKEN_PATTERNS) {
    // Patterns starting with `(^|\s)` have the sigil token in capture
    // group 2 — use that as the match region.
    const hasPrefix = rx.source.startsWith("(^|\\s)");
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(raw)) !== null) {
      const start = hasPrefix ? m.index + m[1].length : m.index;
      const end = start + (hasPrefix ? m[2].length : m[0].length);
      // Skip if this range overlaps an earlier (higher-priority) match.
      const conflicts = matches.some(
        (x) => !(end <= x.start || start >= x.end),
      );
      if (!conflicts) matches.push({ start, end, kind });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      tokens.push({ text: raw.slice(cursor, m.start), kind: "text" });
    }
    tokens.push({ text: raw.slice(m.start, m.end), kind: m.kind });
    cursor = m.end;
  }
  if (cursor < raw.length) {
    tokens.push({ text: raw.slice(cursor), kind: "text" });
  }
  return tokens;
}

const KIND_CLASS: Record<TokenKind, string> = {
  time: "text-orange-600 dark:text-orange-400 font-semibold",
  datekey: "text-indigo-600 dark:text-indigo-400 font-semibold",
  weekday: "text-indigo-600 dark:text-indigo-400 font-semibold",
  tag: "text-purple-600 dark:text-purple-400 font-semibold",
  priority: "text-red-600 dark:text-red-400 font-semibold",
  mention: "text-sky-600 dark:text-sky-400 font-semibold",
  text: "",
};

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  autoFocus?: boolean;
  /** Outer wrapper (layout — flex-1, width, etc.). */
  className?: string;
  /**
   * Chrome classes applied to the visible shell (border, radius, padding,
   * background). The mirror + input both inherit the same padding so
   * text metrics line up; background + border sit on the shell so the
   * input + mirror can stay transparent without fighting each other.
   */
  inputClassName?: string;
}

/**
 * Input with a highlighted overlay behind the text. The underlying
 * <input> is transparent-text but keeps the caret + IME behaviour of a
 * real form input; a mirror <div> underneath renders the same string
 * but with coloured <span>s so the user sees tokens highlight as they
 * type. Scroll position is synced so long strings behave correctly.
 */
export const TokenHighlightInput = forwardRef<HTMLInputElement, Props>(
  function TokenHighlightInput(
    { value, onChange, placeholder, disabled, onEnter, autoFocus, className, inputClassName },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const mirrorRef = useRef<HTMLDivElement | null>(null);

    // Expose the underlying input to parent refs.
    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    // Sync the mirror's horizontal scroll with the input's. Keeps the
    // highlighted spans aligned with the caret even when text overflows.
    useLayoutEffect(() => {
      const input = inputRef.current;
      const mirror = mirrorRef.current;
      if (!input || !mirror) return;
      const sync = () => {
        mirror.scrollLeft = input.scrollLeft;
      };
      input.addEventListener("scroll", sync);
      sync();
      return () => input.removeEventListener("scroll", sync);
    }, [value]);

    const tokens = tokenize(value);

    return (
      <div
        className={cn(
          // Shell owns all chrome (border, bg, radius, padding) so the
          // mirror + input stay "naked" and perfectly aligned. Children
          // are `absolute inset-0` — their (0,0) is the inside of the
          // padding box, so their text origins match each other.
          "relative flex-1 text-sm",
          inputClassName,
          className,
        )}
      >
        <div
          ref={mirrorRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-zinc-900 dark:text-zinc-100"
        >
          {tokens.length === 0 ? (
            <span className="invisible">{placeholder ?? " "}</span>
          ) : (
            tokens.map((t, i) => (
              <span key={i} className={KIND_CLASS[t.kind]}>
                {t.text}
              </span>
            ))
          )}
        </div>
        <input
          ref={setRefs}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnter?.();
            }
          }}
          className={cn(
            // The <input> lives inside the shell's padding box via
            // absolute inset-0 + padding: 0. Text is transparent so the
            // mirror shows; caret-color gives a visible caret against
            // the transparent text.
            "absolute inset-0 m-0 block w-full border-0 bg-transparent p-0 text-transparent placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:placeholder:text-zinc-500",
            "caret-indigo-600 dark:caret-indigo-400",
          )}
        />
      </div>
    );
  },
);
