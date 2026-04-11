"use client";

import { CustomDashboard } from "@/components/visualizations/custom-dashboard";

interface CustomDashboardWrapperProps {
  workspaceId: string;
  userId: string;
}

export function CustomDashboardWrapper({ workspaceId, userId }: CustomDashboardWrapperProps) {
  return <CustomDashboard workspaceId={workspaceId} userId={userId} />;
}
