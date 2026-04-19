import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPreferences } from "@/lib/preferences/actions";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getUserPreferences();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Preferences"
        description="Make Trackify feel like yours. Changes save instantly."
        backHref="/settings"
        backLabel="Back to Settings"
      />
      <PreferencesForm initial={prefs} />
    </div>
  );
}
