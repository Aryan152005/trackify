import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/logs/logger";
import { handleNotWhitelistedAttempt } from "@/lib/auth/access-request";

/**
 * Email whitelist check: verifies email is whitelisted and ensures user exists in Auth with password.
 * If user doesn't exist, creates them with a default password (user must change on first login).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Check whitelist
    const { data: whitelistEntry, error: whitelistError } = await adminClient
      .from("email_whitelist")
      .select("email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (whitelistError) {
      return NextResponse.json(
        { error: "Could not verify whitelist. Try again." },
        { status: 500 }
      );
    }
    if (!whitelistEntry) {
      await logEvent({
        service: "auth",
        level: "warn",
        tag: "login.notWhitelisted",
        message: `Login blocked — email not whitelisted`,
        metadata: { email: normalizedEmail },
      });
      await handleNotWhitelistedAttempt({
        email: normalizedEmail,
        name: null,
        source: "login",
      });
      return NextResponse.json(
        {
          error: "Email not whitelisted. Your request has been sent to the admin — you'll be notified when approved.",
        },
        { status: 403 }
      );
    }

    // 2. Check if user exists, create with password if not
    const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
    
    if (!existing) {
      // Create user with password (if provided, otherwise generate temporary)
      const tempPassword = password || `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {},
      });

      if (createError) {
        await logEvent({
          service: "auth",
          level: "error",
          tag: "login.createFailed",
          message: `Account auto-create failed: ${createError.message}`,
          metadata: { email: normalizedEmail },
        });
        return NextResponse.json(
          { error: "Could not create account. Contact admin." },
          { status: 500 }
        );
      }

      await logEvent({
        service: "auth",
        level: "info",
        tag: "login.autoCreated",
        message: `Auto-created account for whitelisted email ${normalizedEmail}`,
        metadata: { email: normalizedEmail, hadPassword: !!password },
      });

      // If no password provided, user needs to set one
      if (!password) {
        return NextResponse.json(
          { error: "Account created. Please set your password on first login.", requiresPasswordSetup: true },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    await logEvent({
      service: "auth",
      level: "error",
      tag: "login.exception",
      message: `Unhandled login exception`,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
