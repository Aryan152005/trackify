import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/logs/logger";

/**
 * Email whitelist signup: verifies email is whitelisted and creates user with password.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
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
        tag: "signup.notWhitelisted",
        message: `Signup blocked — email not whitelisted`,
        metadata: { email: normalizedEmail },
      });
      return NextResponse.json(
        { error: "Email not whitelisted. Contact admin to add your email." },
        { status: 403 }
      );
    }

    // 2. Check if user already exists
    const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
    
    if (existing) {
      return NextResponse.json(
        { error: "Account already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    // 3. Create user with password
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {},
    });

    if (createError) {
      await logEvent({
        service: "auth",
        level: "error",
        tag: "signup.createFailed",
        message: `Account creation failed: ${createError.message}`,
        metadata: { email: normalizedEmail, error: createError.message },
      });
      return NextResponse.json(
        { error: createError.message || "Could not create account. Contact admin." },
        { status: 500 }
      );
    }

    await logEvent({
      service: "auth",
      level: "info",
      tag: "signup.success",
      message: `Account created for ${normalizedEmail}`,
      metadata: { email: normalizedEmail },
    });

    return NextResponse.json({ success: true, message: "Account created successfully" });
  } catch (error) {
    await logEvent({
      service: "auth",
      level: "error",
      tag: "signup.exception",
      message: `Unhandled signup exception`,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
