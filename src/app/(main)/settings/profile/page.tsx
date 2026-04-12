import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <ProfileForm
      initialName={profile?.name ?? ""}
      initialAvatarUrl={profile?.avatar_url ?? null}
      email={user.email ?? ""}
      userId={user.id}
    />
  );
}
