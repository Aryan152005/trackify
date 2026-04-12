"use client";

const KEY = "trackify-active-timer";
const EVENT = "trackify:timer-change";

export interface ActiveTimer {
  sessionId: string;
  startedAt: number; // epoch ms
}

export function getActiveTimer(): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTimer;
  } catch {
    return null;
  }
}

export function setActiveTimer(t: ActiveTimer | null) {
  if (typeof window === "undefined") return;
  if (t) {
    localStorage.setItem(KEY, JSON.stringify(t));
  } else {
    localStorage.removeItem(KEY);
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Subscribe to timer state changes. Returns cleanup fn. */
export function subscribeTimer(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler); // cross-tab sync
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
