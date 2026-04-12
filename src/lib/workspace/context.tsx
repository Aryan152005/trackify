"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Workspace, WorkspaceRole } from "@/lib/types/workspace";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Workspace[];
  role: WorkspaceRole | null;
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  workspaces: [],
  role: null,
  isLoading: true,
  switchWorkspace: () => {},
});

const STORAGE_KEY = "wis-active-workspace";
const COOKIE_KEY = "wis_active_workspace";

function writeWorkspaceCookie(id: string) {
  if (typeof document === "undefined") return;
  // 1-year cookie, Lax so it travels with the next reload.
  document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Get all workspaces where user is a member
    const { data: memberships } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(*)")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setIsLoading(false);
      return;
    }

    const ws = memberships.map((m) => ({
      ...(m.workspaces as unknown as Workspace),
      _role: m.role as WorkspaceRole,
    }));

    setWorkspaces(ws);

    // Restore last active workspace from localStorage
    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    const active = ws.find((w) => w.id === savedId) || ws[0];

    // Keep the cookie in sync so server components honor the same selection.
    writeWorkspaceCookie(active.id);

    setWorkspace(active);
    setRole(
      memberships.find(
        (m) => (m.workspaces as unknown as Workspace).id === active.id
      )?.role as WorkspaceRole
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (ws) {
        setWorkspace(ws);
        localStorage.setItem(STORAGE_KEY, workspaceId);
        writeWorkspaceCookie(workspaceId);
        // Reload to refresh server-rendered data
        window.location.reload();
      }
    },
    [workspaces]
  );

  return (
    <WorkspaceContext.Provider
      value={{ workspace, workspaces, role, isLoading, switchWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
