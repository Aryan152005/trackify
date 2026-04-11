import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.redirect(
      new URL("/dashboard?error=invalid_invitation", request.url)
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
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
    return NextResponse.redirect(
      new URL("/dashboard?error=join_failed", request.url)
    );
  }

  // Mark invitation as accepted
  await admin
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.redirect(new URL("/dashboard?joined=true", request.url));
}
