"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DOMPurify from "dompurify";
import { Globe, Lock, FileText, ClipboardList, Columns, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SharedData {
  entity: Record<string, unknown>;
  entityType: string;
  permission: "view" | "comment" | "edit";
  workspaceName?: string;
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  page: <FileText className="h-5 w-5" />,
  task: <ClipboardList className="h-5 w-5" />,
  board: <Columns className="h-5 w-5" />,
  entry: <BookOpen className="h-5 w-5" />,
};

const ENTITY_LABELS: Record<string, string> = {
  page: "Note",
  task: "Task",
  board: "Board",
  entry: "Entry",
};

function SharedPageContent({ entity, entityType }: { entity: Record<string, unknown>; entityType: string }) {
  switch (entityType) {
    case "page":
      return (
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled"}
          </h1>
          {!!entity.content && (
            <div
              className="mt-4"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(entity.content as string, {
                  ALLOWED_TAGS: [
                    "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
                    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code",
                    "pre", "img", "table", "thead", "tbody", "tr", "th", "td",
                    "div", "span", "hr",
                  ],
                  ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "target", "rel"],
                  ALLOW_DATA_ATTR: false,
                }),
              }}
            />
          )}
          {!!entity.plain_text && !entity.content && (
            <p className="mt-4 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {entity.plain_text as string}
            </p>
          )}
        </div>
      );

    case "task":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Task"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {!!entity.status && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {entity.status as string}
              </span>
            )}
            {!!entity.priority && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Priority: {entity.priority as string}
              </span>
            )}
          </div>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {entity.description as string}
            </p>
          )}
          {!!entity.due_date && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Due: {new Date(entity.due_date as string).toLocaleDateString()}
            </p>
          )}
        </div>
      );

    case "board":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.name as string) || "Untitled Board"}
          </h1>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {entity.description as string}
            </p>
          )}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Board view is available when you open this in the full app.
          </div>
        </div>
      );

    case "entry":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Entry"}
          </h1>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {entity.description as string}
            </p>
          )}
          {!!entity.hours && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Hours logged: {entity.hours as number}
            </p>
          )}
          {!!entity.date && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Date: {new Date(entity.date as string).toLocaleDateString()}
            </p>
          )}
        </div>
      );

    default:
      return (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Unable to display this content type.
        </div>
      );
  }
}

export default function SharedTokenPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSharedContent() {
      try {
        const res = await fetch(`/api/collaboration/share/${params.token}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (res.status === 404) {
            setError("This shared link was not found or has been revoked.");
          } else if (res.status === 410) {
            setError("This shared link has expired.");
          } else {
            setError(json.error ?? "Something went wrong.");
          }
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load shared content.");
      } finally {
        setLoading(false);
      }
    }

    if (params.token) {
      fetchSharedContent();
    }
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Lock className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Cannot access
        </h2>
        <p className="max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Shared banner */}
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <Globe className="h-4 w-4 text-indigo-500" />
        <span className="text-sm text-indigo-700 dark:text-indigo-300">
          Shared{data.workspaceName ? ` by ${data.workspaceName}` : ""}
        </span>
        <span className="ml-auto rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
          {data.permission === "view"
            ? "Read only"
            : data.permission === "comment"
            ? "Can comment"
            : "Can edit"}
        </span>
      </div>

      {/* Entity type indicator */}
      <div className="mb-4 flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
        {ENTITY_ICONS[data.entityType] ?? <FileText className="h-5 w-5" />}
        <span className="text-sm font-medium">
          {ENTITY_LABELS[data.entityType] ?? "Content"}
        </span>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SharedPageContent entity={data.entity} entityType={data.entityType} />
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <a
          href="/login"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Sign in to Trackify for full access
        </a>
      </div>
    </div>
  );
}
