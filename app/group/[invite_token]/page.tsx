import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Board } from "./board";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ invite_token: string }>;
}) {
  const { invite_token } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("invite_token", invite_token)
    .single();

  if (!group) notFound();

  const { data: weekends } = await supabase
    .from("weekends")
    .select("*")
    .eq("group_id", group.id)
    .order("sort_order");

  return (
    <Board
      group={group}
      weekends={weekends ?? []}
    />
  );
}
