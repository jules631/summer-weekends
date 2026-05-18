"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatWeekendDates, isHoliday } from "@/lib/weekends";
import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Weekend = Database["public"]["Tables"]["weekends"]["Row"];
type Member = Database["public"]["Tables"]["members"]["Row"];
type Availability = Database["public"]["Tables"]["availability"]["Row"];

const MEMBER_TOKEN_KEY = (groupId: string) => `sw_member_token_${groupId}`;

function statusColor(available: number, total: number) {
  if (total === 0) return { bar: "bg-gray-200", text: "text-gray-400" };
  const pct = available / total;
  if (pct >= 0.7) return { bar: "bg-green-400", text: "text-green-700" };
  if (pct >= 0.4) return { bar: "bg-yellow-400", text: "text-yellow-700" };
  return { bar: "bg-red-300", text: "text-red-500" };
}

export function Board({ group, weekends }: { group: Group; weekends: Weekend[] }) {
  const supabase = createClient();

  const [memberName, setMemberName] = useState("");
  const [joining, setJoining] = useState(false);
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [expandedWeekend, setExpandedWeekend] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(MEMBER_TOKEN_KEY(group.id));
    if (!token) return;
    supabase
      .from("members")
      .select("*")
      .eq("member_token", token)
      .eq("group_id", group.id)
      .single()
      .then(({ data }) => { if (data) setMe(data); });
  }, [group.id, supabase]);

  const loadData = useCallback(async () => {
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("members").select("*").eq("group_id", group.id),
      supabase.from("availability").select("*").in("weekend_id", weekends.map((w) => w.id)),
    ]);
    if (m) setMembers(m);
    if (a) setAvailability(a);
  }, [group.id, supabase, weekends]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const memberSub = supabase
      .channel(`members:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `group_id=eq.${group.id}` }, () => loadData())
      .subscribe();
    const availSub = supabase
      .channel(`availability:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "availability" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(memberSub); supabase.removeChannel(availSub); };
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

  function signOut() {
    localStorage.removeItem(MEMBER_TOKEN_KEY(group.id));
    setMe(null);
    setMemberName("");
  }

  // Each button directly sets its own status — clicking the active one clears it
  async function setStatus(weekendId: string, newStatus: "available" | "busy") {
    if (!me) return;
    setToggling(weekendId);
    const existing = availability.find((a) => a.member_id === me.id && a.weekend_id === weekendId);
    if (!existing) {
      await supabase.from("availability").insert({ member_id: me.id, weekend_id: weekendId, status: newStatus });
    } else if (existing.status === newStatus) {
      await supabase.from("availability").delete().eq("id", existing.id);
    } else {
      await supabase.from("availability").update({ status: newStatus }).eq("id", existing.id);
    }
    await loadData();
    setToggling(null);
  }

  function myStatus(weekendId: string): "available" | "busy" | null {
    if (!me) return null;
    return availability.find((a) => a.member_id === me.id && a.weekend_id === weekendId)?.status ?? null;
  }

  function availableMembers(weekendId: string): Member[] {
    const ids = availability.filter((a) => a.weekend_id === weekendId && a.status === "available").map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  function busyMembers(weekendId: string): Member[] {
    const ids = availability.filter((a) => a.weekend_id === weekendId && a.status === "busy").map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/group/${group.invite_token}` : "";

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Join screen ──────────────────────────────────────────────────────────
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
            <button
              type="submit"
              disabled={joining}
              className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-base font-medium transition-colors disabled:opacity-50"
            >
              {joining ? "Joining…" : "Let's go →"}
            </button>
          </form>
          <p className="text-xs text-gray-400">No sign-up. No password.</p>
        </div>
      </main>
    );
  }

  // ── Board screen ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-amber-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-amber-50/95 backdrop-blur border-b border-amber-200 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">{group.name}</h1>
            <p className="text-xs text-gray-500">
              {me.name} ·{" "}
              <button onClick={signOut} className="underline underline-offset-2 hover:text-gray-700">
                not you?
              </button>
              {" "}· {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={copyInvite}
            className="text-xs text-green-700 font-medium bg-green-100 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors"
          >
            {copied ? "Copied!" : "Copy invite"}
          </button>
        </div>
      </div>

      {/* Weekend list */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-2">
        {weekends.map((weekend) => {
          const avail = availableMembers(weekend.id);
          const busy = busyMembers(weekend.id);
          const total = members.length;
          const status = myStatus(weekend.id);
          const isExpanded = expandedWeekend === weekend.id;
          const holiday = isHoliday(weekend.label);
          const colors = statusColor(avail.length, total);
          const pct = total > 0 ? Math.round((avail.length / total) * 100) : 0;

          return (
            <div key={weekend.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              {/* Row — always visible */}
              <button
                className="w-full text-left px-4 py-4 flex items-center gap-4"
                onClick={() => setExpandedWeekend(isExpanded ? null : weekend.id)}
              >
                {/* Color dot */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bar}`} />

                {/* Date + label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {holiday && <span className="text-sm">⭐</span>}
                    <span className="font-semibold text-gray-900 text-sm">
                      {formatWeekendDates(weekend.start_date, weekend.end_date)}
                    </span>
                  </div>
                  {weekend.label && (
                    <p className="text-xs text-gray-400 mt-0.5">{weekend.label}</p>
                  )}
                </div>

                {/* Free count + my status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {status && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      status === "available" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"
                    }`}>
                      {status === "available" ? "Free" : "Busy"}
                    </span>
                  )}
                  <span className={`text-sm font-bold ${colors.text}`}>
                    {avail.length}/{total}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Progress bar */}
              {total > 0 && (
                <div className="mx-4 mb-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
                </div>
              )}

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-3">
                  {/* Who's free / busy */}
                  <div className="space-y-2">
                    {avail.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1">Free</p>
                        <div className="flex flex-wrap gap-1">
                          {avail.map((m) => (
                            <span key={m.id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {busy.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-1">Busy</p>
                        <div className="flex flex-wrap gap-1">
                          {busy.map((m) => (
                            <span key={m.id} className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {avail.length === 0 && busy.length === 0 && (
                      <p className="text-xs text-gray-400">No one has marked this weekend yet.</p>
                    )}
                  </div>

                  {/* My availability buttons */}
                  <div className="flex gap-2">
                    <button
                      disabled={toggling === weekend.id}
                      onClick={() => setStatus(weekend.id, "available")}
                      className={`flex-1 h-11 rounded-xl text-sm font-medium transition-colors ${
                        status === "available"
                          ? "bg-green-600 text-white"
                          : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                      }`}
                    >
                      {status === "available" ? "✓ I'm free" : "I'm free"}
                    </button>
                    <button
                      disabled={toggling === weekend.id}
                      onClick={() => setStatus(weekend.id, "busy")}
                      className={`flex-1 h-11 rounded-xl text-sm font-medium transition-colors ${
                        status === "busy"
                          ? "bg-red-400 text-white"
                          : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {status === "busy" ? "✗ Busy" : "Busy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
