import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format } from "date-fns";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Cron job: Sends email reminders to users who haven't filled today's entry.
 * Runs daily at 8 PM (configured in vercel.json).
 * Requires RESEND_API_KEY in environment variables.
 */
export async function GET(request: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    const today = format(new Date(), "yyyy-MM-dd");

    // Get all users with profiles
    const { data: profiles } = await adminClient
      .from("user_profiles")
      .select("user_id, name");

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "No users found" });
    }

    const reminders: Array<{ email: string; name: string }> = [];

    for (const profile of profiles) {
      // Check if user has entry for today
      const { data: entry } = await adminClient
        .from("work_entries")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("date", today)
        .maybeSingle();

      if (!entry) {
        // Get user email from auth
        const { data: userData } = await adminClient.auth.admin.getUserById(profile.user_id);
        if (userData?.user?.email) {
          reminders.push({
            email: userData.user.email,
            name: profile.name,
          });
        }
      }
    }

    // Send emails
    const emailPromises = reminders.map(({ email, name }) =>
      getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Trackify <noreply@yourdomain.com>",
        to: email,
        subject: "Reminder: Fill Today's Work Entry",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Hi ${name}!</h2>
            <p>This is a friendly reminder that you haven't filled today's work entry yet.</p>
            <p>Don't forget to log your work, learning, and plans for the day!</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://trackify.vercel.app"}/entries/new" 
               style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px;">
              Add Entry Now
            </a>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              You're receiving this because you haven't logged an entry for ${today}.
            </p>
          </div>
        `,
      })
    );

    await Promise.all(emailPromises);

    return NextResponse.json({
      message: `Reminders sent to ${reminders.length} users`,
      count: reminders.length,
    });
  } catch (error) {
    console.error("Daily reminder cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
