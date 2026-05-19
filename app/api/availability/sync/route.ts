import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { user_token, weekend_start, weekend_end, status } = body ?? {};

  if (!user_token || !weekend_start || !weekend_end || !status) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  const { data: identity } = await supabase
    .from("user_identities")
    .select("id")
    .eq("user_token", user_token)
    .single();

  if (!identity) {
    return NextResponse.json({ error: "identity not found" }, { status: 404 });
  }

  const { data: linkedMembers } = await supabase
    .from("members")
    .select("id, group_id")
    .eq("user_identity_id", identity.id);

  if (!linkedMembers || linkedMembers.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  // For each linked member, find the matching weekend by date and upsert availability
  let synced = 0;
  await Promise.all(
    linkedMembers.map(async (member) => {
      const { data: weekend } = await supabase
        .from("weekends")
        .select("id")
        .eq("group_id", member.group_id)
        .eq("start_date", weekend_start)
        .eq("end_date", weekend_end)
        .single();

      if (!weekend) return;

      const { error } = await supabase
        .from("availability")
        .upsert(
          { member_id: member.id, weekend_id: weekend.id, status },
          { onConflict: "member_id,weekend_id" }
        );

      if (!error) synced++;
    })
  );

  return NextResponse.json({ synced });
}
