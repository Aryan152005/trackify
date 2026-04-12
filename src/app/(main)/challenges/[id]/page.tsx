import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChallenge } from "@/lib/challenges/actions";
import { ChallengeDetail } from "@/components/challenges/challenge-detail";

export default async function ChallengeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const challenge = await getChallenge(params.id);
  if (!challenge) redirect("/challenges");
  return <ChallengeDetail initialChallenge={challenge} />;
}
