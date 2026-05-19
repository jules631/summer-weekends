import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const user_token = req.nextUrl.searchParams.get("user_token");
  if (!user_token) return NextResponse.json({ error: "user_token required" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  const { data: identity } = await supabase
    .from("user_identities")
    .select("id, email")
    .eq("user_token", user_token)
    .single();

  if (!identity) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("members")
    .select("id, name, group_id")
    .eq("user_identity_id", identity.id);

  if (!members || members.length === 0) {
    return NextResponse.json({ groups: [], email: identity.email });
  }

  const groupIds = members.map((m) => m.group_id);
  const memberIds = members.map((m) => m.id);

  const [{ data: groups }, { data: weekends }, { data: avail }] = await Promise.all([
    supabase.from("groups").select("id, name, invite_token").in("id", groupIds),
    supabase.from("weekends").select("id, group_id").in("group_id", groupIds),
    supabase.from("availability").select("member_id, weekend_id, status").in("member_id", memberIds),
  ]);

  const result = members
    .map((member) => {
      const group = groups?.find((g) => g.id === member.group_id);
      if (!group) return null;
      const totalWeekends = weekends?.filter((w) => w.group_id === member.group_id).length ?? 0;
      const memberAvail = avail?.filter((a) => a.member_id === member.id) ?? [];
      return {
        group: { id: group.id, name: group.name, invite_token: group.invite_token },
        member: { id: member.id, name: member.name },
        totalWeekends,
        markedCount: memberAvail.length,
        availableCount: memberAvail.filter((a) => a.status === "available").length,
        busyCount: memberAvail.filter((a) => a.status === "busy").length,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ groups: result, email: identity.email });
}
