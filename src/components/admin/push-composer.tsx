"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Send,
  Search,
  Users,
  User as UserIcon,
  CheckCircle2,
  BellOff,
  Megaphone,
  Clock,
  AlertTriangle,
  Heart,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { broadcastPush, type PushRecipient } from "@/lib/admin/push-actions";

type Target = "all" | "selected";

interface TonePreset {
  id: "announcement" | "reminder" | "urgent" | "friendly" | "praise";
  label: string;
  icon: React.ReactNode;
  tint: string;
  /** Suggested starter copy — admin edits before send. */
  title: string;
  body: string;
}

/**
 * Curated tone presets. The copy here is a _starting point_ — the
 * composer remains free-form text input. Tone gives the admin a
 * phrasing nudge so broadcasts land consistent in voice rather than
 * veering between "URGENT!!!" and "fyi maybe" depending on mood.
 */
const TONE_PRESETS: TonePreset[] = [
  {
    id: "announcement",
    label: "Announcement",
    icon: <Megaphone className="h-3.5 w-3.5" />,
    tint: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    title: "Something new in Trackify",
    body: "We've shipped an update that should make your day a little smoother. Open the app to see what changed.",
  },
  {
    id: "reminder",
    label: "Gentle reminder",
    icon: <Clock className="h-3.5 w-3.5" />,
    tint: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    title: "Quick nudge",
    body: "A friendly reminder to log today's work while it's fresh. Takes two minutes.",
  },
  {
    id: "urgent",
    label: "Urgent",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    tint: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
    title: "Please read — action needed",
    body: "There's something time-sensitive that needs your attention. Tap to open the app.",
  },
  {
    id: "friendly",
    label: "Friendly",
    icon: <Heart className="h-3.5 w-3.5" />,
    tint: "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
    title: "Hey — checking in",
    body: "Just popping in to see how things are going. No action needed, we're just glad you're here.",
  },
  {
    id: "praise",
    label: "Celebrate",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    tint: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    title: "Nice work 🎉",
    body: "Wanted to say thanks for showing up consistently — it's the small daily habit that makes the difference.",
  },
];

const TITLE_LIMIT = 100;
const BODY_LIMIT = 300;

interface PushComposerProps {
  recipients: PushRecipient[];
}

export function PushComposer({ recipients }: PushComposerProps) {
  const [target, setTarget] = useState<Target>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/notifications");
  const [tonePicked, setTonePicked] = useState<TonePreset["id"] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Stats the admin sees before committing.
  const withPush = recipients.filter((r) => r.has_push).length;
  const selectedCount = selected.size;
  const selectedWithPush = recipients.filter((r) => selected.has(r.user_id) && r.has_push).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [recipients, search]);

  // How many pushes this send will actually attempt. Zero disables the
  // Send button so an admin can't fire a broadcast that reaches nobody.
  const willAttempt = target === "all" ? withPush : selectedWithPush;

  function applyTone(preset: TonePreset) {
    setTonePicked(preset.id);
    // Only overwrite empty / prior-preset fields so the admin doesn't lose
    // in-progress text by tapping a preset to audition it.
    if (!title.trim() || isPresetTitle(title)) setTitle(preset.title);
    if (!body.trim() || isPresetBody(body)) setBody(preset.body);
  }

  function toggleSelected(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.user_id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleSendClick() {
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    if (willAttempt === 0) {
      toast.error(
        target === "all"
          ? "No users have push enabled yet."
          : "None of the selected users have push enabled.",
      );
      return;
    }
    setConfirmOpen(true);
  }

  function performSend() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        const result = await broadcastPush({
          target,
          userIds: target === "selected" ? Array.from(selected) : undefined,
          title,
          body: body.trim() || undefined,
          url: url.trim() || undefined,
        });
        if (result.targeted === 0) {
          toast.warning("No recipients with push enabled — nothing sent.");
          return;
        }
        const extras: string[] = [];
        if (result.failed > 0) extras.push(`${result.failed} failed`);
        if (result.removed > 0) extras.push(`${result.removed} dead devices cleaned`);
        const suffix = extras.length ? ` (${extras.join(", ")})` : "";
        toast.success(
          `Delivered ${result.sent} push${result.sent === 1 ? "" : "es"} to ${result.targeted} user${result.targeted === 1 ? "" : "s"}${suffix}`,
        );
        // Clear the composer so the admin doesn't accidentally re-send.
        setTitle("");
        setBody("");
        setTonePicked(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Broadcast failed");
      }
    });
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* ── LEFT: recipient picker + message form ─────────────── */}
        <div className="space-y-5">
          {/* Target */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-indigo-500" />
                Who gets this?
              </CardTitle>
              <CardDescription className="text-xs">
                Users without push enabled are skipped automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <TargetButton
                  active={target === "all"}
                  onClick={() => setTarget("all")}
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Everyone"
                  sub={`${withPush} with push`}
                />
                <TargetButton
                  active={target === "selected"}
                  onClick={() => setTarget("selected")}
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Pick users"
                  sub={
                    selectedCount === 0
                      ? "none"
                      : `${selectedWithPush}/${selectedCount} deliverable`
                  }
                />
              </div>

              {target === "selected" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="search"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllVisible}>
                      +{filtered.length}
                    </Button>
                    {selectedCount > 0 && (
                      <Button variant="outline" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                    )}
                  </div>
                  <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {filtered.length === 0 ? (
                      <li className="px-3 py-6 text-center text-xs text-zinc-400">
                        No users match that search.
                      </li>
                    ) : (
                      filtered.map((r) => {
                        const checked = selected.has(r.user_id);
                        return (
                          <li key={r.user_id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                                checked && "bg-indigo-50/40 dark:bg-indigo-950/20",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelected(r.user_id)}
                                className="h-4 w-4 accent-indigo-600"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-zinc-800 dark:text-zinc-200">{r.name}</p>
                                {r.email && (
                                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {r.email}
                                  </p>
                                )}
                              </div>
                              {r.has_push ? (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                                  aria-label="Push enabled"
                                />
                              ) : (
                                <BellOff
                                  className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600"
                                  aria-label="No push subscription"
                                />
                              )}
                            </label>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Message</CardTitle>
              <CardDescription className="text-xs">
                Pick a tone to pre-fill, then edit freely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {TONE_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTone(t)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      tonePicked === t.id
                        ? t.tint
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <span>Title</span>
                  <span className={cn("tabular-nums", title.length > TITLE_LIMIT && "text-red-500")}>
                    {title.length}/{TITLE_LIMIT}
                  </span>
                </label>
                <input
                  type="text"
                  value={title}
                  maxLength={TITLE_LIMIT + 20}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Something new in Trackify"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <span>Body (optional)</span>
                  <span className={cn("tabular-nums", body.length > BODY_LIMIT && "text-red-500")}>
                    {body.length}/{BODY_LIMIT}
                  </span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Short detail that fits on one notification row. Don't write a newsletter — the OS will truncate anything past ~200 chars."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Open URL on tap
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/notifications"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Relative path inside the app — e.g. <code>/tasks</code>, <code>/notifications</code>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: live preview + send ─────────────────────────── */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription className="text-xs">
                Approximately how the push renders on a device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PushPreview title={title} body={body} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Will attempt to deliver</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {willAttempt} push{willAttempt === 1 ? "" : "es"}
                </span>
              </div>
              {target === "selected" && selectedCount > selectedWithPush && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {selectedCount - selectedWithPush} picked user{selectedCount - selectedWithPush === 1 ? "" : "s"} will be skipped — no push enabled.
                </p>
              )}
              <Button
                onClick={handleSendClick}
                disabled={!title.trim() || willAttempt === 0 || pending}
                className="w-full gap-2"
                size="lg"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {pending ? "Sending…" : `Send to ${willAttempt} user${willAttempt === 1 ? "" : "s"}`}
              </Button>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                A system log is written for every broadcast. Dead subscriptions (uninstalled apps / revoked permissions) are cleaned automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send push to ${willAttempt} user${willAttempt === 1 ? "" : "s"}?`}
        description={
          target === "all"
            ? `Every user with push enabled (${withPush}) will receive this notification on all their subscribed devices.`
            : `${selectedWithPush} of the ${selectedCount} picked users will receive this. This cannot be unsent.`
        }
        confirmLabel="Send"
        cancelLabel="Keep editing"
        onConfirm={performSend}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────

function TargetButton({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition",
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      <span className={cn(active ? "text-indigo-500" : "text-zinc-400")}>{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{sub}</span>
      </span>
    </button>
  );
}

function PushPreview({ title, body }: { title: string; body: string }) {
  const placeholder = !title && !body;
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-3 shadow-sm dark:bg-zinc-950">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Send className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Trackify
              </span>
              <span className="text-[10px] text-zinc-400">now</span>
            </div>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 text-sm font-semibold",
                placeholder
                  ? "italic text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-50",
              )}
            >
              {title || "Title appears here"}
            </p>
            <p
              className={cn(
                "mt-0.5 line-clamp-3 text-xs",
                placeholder || !body
                  ? "italic text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-600 dark:text-zinc-300",
              )}
            >
              {body || "Body (optional) — this is where the detail goes."}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-zinc-400">
        Device rendering varies — iOS truncates bodies at ~100 chars, Chrome shows the full body on expand.
      </p>
    </div>
  );
}

// ── helpers to keep preset overwrites from nuking user text ──
function isPresetTitle(s: string) {
  return TONE_PRESETS.some((p) => p.title === s);
}
function isPresetBody(s: string) {
  return TONE_PRESETS.some((p) => p.body === s);
}
