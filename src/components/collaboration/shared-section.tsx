import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { Share2, Clock, Eye, MessageSquare, Pencil, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ENTITY_APP_URL: Record<string, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  entry: (id) => `/entries/${id}`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
  challenge: (id) => `/challenges/${id}`,
};

const ENTITY_TABLE: Record<string, { table: string; titleField: string }> = {
  page: { table: "pages", titleField: "title" },
  task: { table: "tasks", titleField: "title" },
  board: { table: "boards", titleField: "name" },
  entry: { table: "work_entries", titleField: "title" },
  drawing: { table: "drawings", titleField: "title" },
  mindmap: { table: "mindmaps", titleField: "title" },
  challenge: { table: "challenges", titleField: "title" },
};

const PERMISSION_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  view: {
    icon: <Eye className="h-3 w-3" />,
    label: "View",
    color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  comment: {
    icon: <MessageSquare className="h-3 w-3" />,
    label: "Comment",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  edit: {
    icon: <Pencil className="h-3 w-3" />,
    label: "Edit",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

interface SharedRow {
  id: string;
  token: string;
  entity_id: string;
  permission: "view" | "comment" | "edit";
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

export async function SharedSection({ entityType }: { entityType: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) return null;

  // Fetch active shared links for this workspace + entity type
  const { data: links } = await supabase
    .from("shared_links")
    .select("id, token, entity_id, permission, created_by, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!links || links.length === 0) return null;

  const meta = ENTITY_TABLE[entityType];
  if (!meta) return null;

  // Fetch entity titles
  const entityIds = [...new Set(links.map((l) => l.entity_id))];
  const { data: entities } = await supabase
    .from(meta.table)
    .select(`id, ${meta.titleField}`)
    .in("id", entityIds);

  const titleMap = new Map<string, string>();
  for (const e of (entities ?? []) as unknown as Record<string, unknown>[]) {
    titleMap.set(e.id as string, (e[meta.titleField] as string) || "Untitled");
  }

  // Fetch creator profiles
  const creatorIds = [...new Set(links.map((l) => l.created_by))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", creatorIds);
  const profileMap = new Map<string, { name: string; avatar?: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id as string, {
      name: (p.name as string) || "Someone",
      avatar: (p.avatar_url as string) || undefined,
    });
  }

  // Partition: by me vs by others
  const byMe = (links as SharedRow[]).filter((l) => l.created_by === user.id);
  const byOthers = (links as SharedRow[]).filter((l) => l.created_by !== user.id);

  if (byMe.length === 0 && byOthers.length === 0) return null;

  return (
    <div className="space-y-4">
      {byMe.length > 0 && (
        <SharedBlock
          title="Shared by you"
          icon={<Share2 className="h-4 w-4 text-indigo-500" />}
          rows={byMe}
          titleMap={titleMap}
          profileMap={profileMap}
          entityType={entityType}
          showCreator={false}
        />
      )}
      {byOthers.length > 0 && (
        <SharedBlock
          title="Shared with you"
          icon={<Share2 className="h-4 w-4 text-emerald-500" />}
          rows={byOthers}
          titleMap={titleMap}
          profileMap={profileMap}
          entityType={entityType}
          showCreator={true}
        />
      )}
    </div>
  );
}

function SharedBlock({
  title, icon, rows, titleMap, profileMap, entityType, showCreator,
}: {
  title: string;
  icon: React.ReactNode;
  rows: SharedRow[];
  titleMap: Map<string, string>;
  profileMap: Map<string, { name: string; avatar?: string }>;
  entityType: string;
  showCreator: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {rows.length}
        </span>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => {
          const entityTitle = titleMap.get(r.entity_id) || "Untitled";
          const creator = profileMap.get(r.created_by);
          const perm = PERMISSION_META[r.permission] ?? PERMISSION_META.view;
          const appUrl = ENTITY_APP_URL[entityType]?.(r.entity_id) ?? `/shared/${r.token}`;
          const expired = r.expires_at ? new Date(r.expires_at) < new Date() : false;
          return (
            <li key={r.id} className="group relative -mx-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
              <Link
                href={appUrl}
                className="flex items-center gap-3 px-2 py-2.5"
                aria-label={`Open ${entityTitle}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  {creator && creator.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.avatar} alt={creator.name} className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xs font-bold">{(creator?.name ?? entityTitle).charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                      {entityTitle}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${perm.color}`}>
                      {perm.icon}
                      {perm.label}
                    </span>
                    {expired && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <Clock className="h-3 w-3" /> Expired
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {showCreator && creator && <>by {creator.name} · </>}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    {r.expires_at && !expired && <> · expires {formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}</>}
                  </p>
                </div>
              </Link>
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <CopyLinkButton token={r.token} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Client button for copying the share URL
function CopyLinkButton({ token }: { token: string }) {
  return (
    <Link
      href={`/shared/${token}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      title="Open public share link"
    >
      <Copy className="h-3 w-3" />
      Link
    </Link>
  );
}
