import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logs/logger";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with a return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `/api/workspace/invite/accept?token=${token}`);
    return NextResponse.redirect(loginUrl);
  }

  const admin = createAdminClient();

  // Find invitation
  const { data: invitation, error } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invitation) {
    await logEvent({
      service: "workspace",
      level: "warn",
      tag: "invite.accept.invalid",
      message: `Invite accept — invalid token`,
      metadata: { token: token.slice(0, 8) + "…" },
      userId: user.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?error=invalid_invitation", request.url)
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await logEvent({
      service: "workspace",
      level: "warn",
      tag: "invite.accept.expired",
      message: `Invite accept — expired`,
      metadata: { invitationId: invitation.id },
      userId: user.id,
      workspaceId: invitation.workspace_id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?error=expired_invitation", request.url)
    );
  }

  // Add user to workspace
  const { error: memberError } = await admin
    .from("workspace_members")
    .upsert(
      {
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
      },
      { onConflict: "workspace_id,user_id" }
    );

  if (memberError) {
    await logEvent({
      service: "workspace",
      level: "error",
      tag: "invite.accept.joinFailed",
      message: `Failed to add member: ${memberError.message}`,
      metadata: { invitationId: invitation.id, code: memberError.code },
      userId: user.id,
      workspaceId: invitation.workspace_id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?error=join_failed", request.url)
    );
  }

  // Mark invitation as accepted
  await admin
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await logEvent({
    service: "workspace",
    level: "info",
    tag: "invite.accept.success",
    message: `Accepted invite as ${invitation.role}`,
    metadata: { invitationId: invitation.id, role: invitation.role },
    userId: user.id,
    workspaceId: invitation.workspace_id,
  });

  return NextResponse.redirect(new URL("/dashboard?joined=true", request.url));
}
