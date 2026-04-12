"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageItem {
  id: string;
  title: string;
  icon: string | null;
  parent_page_id: string | null;
}

interface TreeNode extends PageItem {
  children: TreeNode[];
}

interface PageSidebarProps {
  pages: PageItem[];
  templates?: PageItem[];
  currentPageId?: string;
  onCreatePage: (parentId?: string) => void;
  onCreateFromTemplate?: (templateId: string) => void | Promise<void>;
}

function buildTree(pages: PageItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  // Link parents
  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parent_page_id && map.has(page.parent_page_id)) {
      map.get(page.parent_page_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeItem({
  node,
  depth,
  currentPageId,
  onCreatePage,
}: {
  node: TreeNode;
  depth: number;
  currentPageId?: string;
  onCreatePage: (parentId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === currentPageId;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700",
            !hasChildren && "invisible"
          )}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Page link */}
        <Link
          href={`/notes/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 truncate"
        >
          <span className="shrink-0 text-base">
            {node.icon || <FileText className="h-4 w-4 text-zinc-400" />}
          </span>
          <span className="truncate">{node.title || "Untitled"}</span>
        </Link>

        {/* Add child page */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onCreatePage(node.id);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-all hover:bg-zinc-200 group-hover:opacity-100 dark:hover:bg-zinc-700"
          title="Add sub-page"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentPageId={currentPageId}
              onCreatePage={onCreatePage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageSidebar({
  pages,
  templates = [],
  currentPageId,
  onCreatePage,
  onCreateFromTemplate,
}: PageSidebarProps) {
  const tree = useMemo(() => buildTree(pages), [pages]);
  const [templateBusy, setTemplateBusy] = useState<string | null>(null);

  const handleCreateRoot = useCallback(() => {
    onCreatePage();
  }, [onCreatePage]);

  const handlePickTemplate = useCallback(
    async (templateId: string) => {
      if (!onCreateFromTemplate || templateBusy) return;
      setTemplateBusy(templateId);
      try {
        await onCreateFromTemplate(templateId);
      } finally {
        setTemplateBusy(null);
      }
    },
    [onCreateFromTemplate, templateBusy]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pages
        </h2>
      </div>

      {/* Tree */}
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {tree.length > 0 ? (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              currentPageId={currentPageId}
              onCreatePage={onCreatePage}
            />
          ))
        ) : (
          <p className="px-2 py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No pages yet
          </p>
        )}
      </div>

      {/* Templates — click creates a new page copying the template's content */}
      {templates.length > 0 && (
        <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
          <h2 className="mb-1 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            <Sparkles className="h-3 w-3" />
            Templates
          </h2>
          <p className="mb-1.5 px-2 text-[10px] text-zinc-500 dark:text-zinc-400">
            Click to create a new page from a template.
          </p>
          <div className="space-y-0.5">
            {templates.map((tpl) => {
              const busy = templateBusy === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePickTemplate(tpl.id)}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : tpl.icon ? (
                    <span className="text-sm">{tpl.icon}</span>
                  ) : (
                    <FileText className="h-3.5 w-3.5 opacity-60" />
                  )}
                  <span className="flex-1 truncate text-left">{tpl.title || "Untitled template"}</span>
                  <Plus className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* New page button */}
      <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleCreateRoot}
        >
          <Plus className="h-4 w-4" />
          New blank page
        </Button>
      </div>
    </div>
  );
}
