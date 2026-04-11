"use client";

import { useContext } from "react";
import { WorkspaceContext } from "./context";
import type { WorkspaceRole } from "@/lib/types/workspace";

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export function useWorkspaceId(): string | null {
  const { workspace } = useWorkspace();
  return workspace?.id ?? null;
}

export function useWorkspaceRole(): WorkspaceRole | null {
  const { role } = useWorkspace();
  return role;
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function useRequireRole(minRole: WorkspaceRole): boolean {
  const role = useWorkspaceRole();
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}
