"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatWeekendDates,
  heatmapColor,
  heatmapTextColor,
  isHoliday,
} from "@/lib/weekends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Weekend = Database["public"]["Tables"]["weekends"]["Row"];
type Member = Database["public"]["Tables"]["members"]["Row"];
type Availability = Database["public"]["Tables"]["availability"]["Row"];

const MEMBER_TOKEN_KEY = (groupId: string) => `sw_member_token_${groupId}`;

export function Board({
  group,
  weekends,
}: {
  group: Group;
  weekends: Weekend[];
}) {
  const supabase = createClient();

  const [memberName, setMemberName] = useState("");
  const [joining, setJoining] = useState(false);
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [expandedWeekend, setExpandedWeekend] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Restore member from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(MEMBER_TOKEN_KEY(group.id));
    if (!token) return;

    supabase
      .from("members")
      .select("*")
      .eq("member_token", token)
      .eq("group_id", group.id)
      .single()
      .then(({ data }) => {
        if (data) setMe(data);
      });
  }, [group.id, supabase]);

  // Load all members and availability once we know the group
  const loadData = useCallback(async () => {
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("members").select("*").eq("group_id", group.id),
      supabase
        .from("availability")
        .select("*")
        .in(
          "weekend_id",
          weekends.map((w) => w.id)
        ),
    ]);
    if (m) setMembers(m);
    if (a) setAvailability(a);
  }, [group.id, supabase, weekends]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    const memberSub = supabase
      .channel(`members:${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `group_id=eq.${group.id}` },
        () => loadData()
      )
      .subscribe();

    const availSub = supabase
      .channel(`availability:${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memberSub);
      supabase.removeChannel(availSub);
    };
  }, [group.id, supabase, loadData]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim()) return;
    setJoining(true);

    const { data, error } = await supabase
      .from("members")
      .insert({ group_id: group.id, name: memberName.trim() })
      .select()
      .single();

    if (data && !error) {
      localStorage.setItem(MEMBER_TOKEN_KEY(group.id), data.member_token);
      setMe(data);
    }
    setJoining(false);
  }

  async function toggleAvailability(weekendId: string) {
    if (!me) return;
    setToggling(weekendId);

    const existing = availability.find(
      (a) => a.member_id === me.id && a.weekend_id === weekendId
    );

    if (!existing) {
      await supabase.from("availability").insert({
        member_id: me.id,
        weekend_id: weekendId,
        status: "available",
      });
    } else if (existing.status === "available") {
      await supabase
        .from("availability")
        .update({ status: "busy" })
        .eq("id", existing.id);
    } else {
      await supabase.from("availability").delete().eq("id", existing.id);
    }

    await loadData();
    setToggling(null);
  }

  function myStatus(weekendId: string): "available" | "busy" | null {
    if (!me) return null;
    return (
      availability.find((a) => a.member_id === me.id && a.weekend_id === weekendId)
        ?.status ?? null
    );
  }

  function availableMembers(weekendId: string): Member[] {
    const ids = availability
      .filter((a) => a.weekend_id === weekendId && a.status === "available")
      .map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  function busyMembers(weekendId: string): Member[] {
    const ids = availability
      .filter((a) => a.weekend_id === weekendId && a.status === "busy")
      .map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/group/${group.invite_token}`
      : "";

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
  }

  // Join screen
  if (!me) {
    return (
      <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl">🌞</div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <p className="text-gray-500 text-sm">
              Mark your summer availability so everyone can find the best weekends.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <Input
              placeholder="Your first name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              required
              className="h-14 rounded-2xl text-center text-lg"
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              disabled={joining}
              className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-base"
            >
              {joining ? "Joining…" : "Let's go →"}
            </Button>
          </form>

          <p className="text-xs text-gray-400">No sign-up. No password.</p>
        </div>
      </main>
    );
  }

  // Board screen
  return (
    <main className="min-h-screen bg-amber-50 pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-amber-50/90 backdrop-blur border-b border-amber-200 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">{group.name}</h1>
            <p className="text-xs text-gray-500">
              Hi, {me.name} · {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={copyInvite}
            className="text-xs text-green-700 font-medium bg-green-100 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors"
          >
            Copy invite link
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-lg mx-auto px-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {weekends.map((weekend) => {
            const avail = availableMembers(weekend.id);
            const busy = busyMembers(weekend.id);
            const total = members.length;
            const status = myStatus(weekend.id);
            const isExpanded = expandedWeekend === weekend.id;
            const holiday = isHoliday(weekend.label);

            return (
              <div
                key={weekend.id}
                className={`
                  relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-150 select-none
                  ${heatmapColor(avail.length, total)}
                  ${holiday ? "ring-2 ring-amber-400 ring-offset-1" : ""}
                  ${isExpanded ? "col-span-2" : ""}
                `}
                onClick={() =>
                  setExpandedWeekend(isExpanded ? null : weekend.id)
                }
              >
                {holiday && (
                  <span className="absolute top-2 right-2 text-base">⭐</span>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {formatWeekendDates(weekend.start_date, weekend.end_date)}
                  </p>
                  {weekend.label && (
                    <p className="text-xs text-gray-600 font-medium leading-tight">
                      {weekend.label}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <p
                    className={`text-2xl font-bold ${heatmapTextColor(avail.length, total)}`}
                  >
                    {avail.length}
                    <span className="text-sm font-normal text-gray-400">
                      /{total} free
                    </span>
                  </p>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    className="mt-4 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {avail.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1">
                          Free
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {avail.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {busy.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-500 mb-1">
                          Busy
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {busy.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={toggling === weekend.id}
                        onClick={() => toggleAvailability(weekend.id)}
                        className={`flex-1 rounded-xl h-10 text-sm font-medium transition-colors ${
                          status === "available"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-white border border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                        variant="outline"
                      >
                        {status === "available" ? "✓ I'm free" : "I'm free"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={toggling === weekend.id}
                        onClick={() => toggleAvailability(weekend.id)}
                        className={`flex-1 rounded-xl h-10 text-sm font-medium transition-colors ${
                          status === "busy"
                            ? "bg-red-400 hover:bg-red-500 text-white"
                            : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                        variant="outline"
                      >
                        {status === "busy" ? "✗ Busy" : "Busy"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Collapsed: show my status indicator */}
                {!isExpanded && status && (
                  <div className="mt-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        status === "available"
                          ? "bg-green-600 text-white"
                          : "bg-red-400 text-white"
                      }`}
                    >
                      {status === "available" ? "You're free" : "You're busy"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
