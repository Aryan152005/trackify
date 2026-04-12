import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChallenge } from "@/lib/challenges/actions";
import { ChallengeDetail } from "@/components/challenges/challenge-detail";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";

export default async function ChallengeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const challenge = await getChallenge(params.id);
  if (!challenge) redirect("/challenges");
  return (
    <div className="space-y-4">
      <CollaborationToolbar
        entityType="challenge"
        entityId={challenge.id}
        entityTitle={challenge.title}
      />
      <ChallengeDetail initialChallenge={challenge} />
    </div>
  );
}
