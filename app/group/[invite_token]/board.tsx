"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatWeekendDates, isHoliday } from "@/lib/weekends";
import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Weekend = Database["public"]["Tables"]["weekends"]["Row"];
type Member = Database["public"]["Tables"]["members"]["Row"];
type Availability = Database["public"]["Tables"]["availability"]["Row"];
type AvailabilityException = Database["public"]["Tables"]["availability_exceptions"]["Row"];
type Plan = Database["public"]["Tables"]["plans"]["Row"];
type PlanCommit = Database["public"]["Tables"]["plan_commits"]["Row"];
type PlanComment = Database["public"]["Tables"]["plan_comments"]["Row"];

type ExceptionDay = "fri" | "sat" | "sun" | "mon";

const MEMBER_TOKEN_KEY = (groupId: string) => `sw_member_token_${groupId}`;

function tileStyle(available: number, total: number) {
  if (total === 0) return { bg: "bg-white border border-gray-100", text: "text-gray-800", sub: "text-gray-400", count: "text-gray-400" };
  const pct = available / total;
  if (pct >= 0.7) return { bg: "bg-emerald-100", text: "text-emerald-950", sub: "text-emerald-600", count: "text-emerald-700" };
  if (pct >= 0.4) return { bg: "bg-amber-100", text: "text-amber-950", sub: "text-amber-600", count: "text-amber-700" };
  return { bg: "bg-rose-100", text: "text-rose-950", sub: "text-rose-500", count: "text-rose-600" };
}

export function Board({ group, weekends }: { group: Group; weekends: Weekend[] }) {
  const supabase = createClient();

  const [memberName, setMemberName] = useState("");
  const [joining, setJoining] = useState(false);
  const [me, setMe] = useState<Member | null>(null);
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planCommits, setPlanCommits] = useState<PlanCommit[]>([]);
  const [planComments, setPlanComments] = useState<PlanComment[]>([]);
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<string | null>(null);
  const [copiedPlan, setCopiedPlan] = useState<string | null>(null);
  const [selectedWeekend, setSelectedWeekend] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [committingPlan, setCommittingPlan] = useState<string | null>(null);
  const [newPlanText, setNewPlanText] = useState<Record<string, string>>({});
  const [newPlanDay, setNewPlanDay] = useState<Record<string, "fri" | "sat" | "sun" | null>>({});
  const [addingPlan, setAddingPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Identity + sync state
  const [userToken, setUserToken] = useState<string | null>(null);
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  const [syncedToast, setSyncedToast] = useState<number | null>(null);

  // Quick-fill flow state
  const [introMode, setIntroMode] = useState(false);
  const [quickFillMode, setQuickFillMode] = useState(false);
  const [quickFillIndex, setQuickFillIndex] = useState(0);
  const [quickFillWeekendIds, setQuickFillWeekendIds] = useState<string[]>([]);
  const [quickFillDone, setQuickFillDone] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(MEMBER_TOKEN_KEY(group.id));
    if (!token) return;
    supabase
      .from("members")
      .select("*")
      .eq("member_token", token)
      .eq("group_id", group.id)
      .single()
      .then(({ data }) => { if (data) setPendingMember(data); });

    const swUserToken = localStorage.getItem("sw_user_token");
    if (swUserToken) setUserToken(swUserToken);
    if (localStorage.getItem("sw_sync_banner_dismissed")) setSyncBannerDismissed(true);
  }, [group.id, supabase]);

  const loadData = useCallback(async () => {
    const weekendIds = weekends.map((w) => w.id);

    const [{ data: m }, { data: a }, { data: ex }, { data: p }] = await Promise.all([
      supabase.from("members").select("*").eq("group_id", group.id),
      supabase.from("availability").select("*").in("weekend_id", weekendIds),
      supabase.from("availability_exceptions").select("*").in("weekend_id", weekendIds),
      supabase.from("plans").select("*").eq("group_id", group.id),
    ]);

    if (m) setMembers(m);
    if (a) setAvailability(a);
    if (ex) setExceptions(ex);

    const loadedPlans = p ?? [];
    setPlans(loadedPlans);

    if (loadedPlans.length > 0) {
      const planIds = loadedPlans.map((pl) => pl.id);
      const [{ data: pc }, { data: co }] = await Promise.all([
        supabase.from("plan_commits").select("*").in("plan_id", planIds),
        supabase.from("plan_comments").select("*").in("plan_id", planIds),
      ]);
      if (pc) setPlanCommits(pc);
      if (co) setPlanComments(co.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } else {
      setPlanCommits([]);
      setPlanComments([]);
    }
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
    const exSub = supabase
      .channel(`avail_exceptions:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "availability_exceptions" }, () => loadData())
      .subscribe();
    const plansSub = supabase
      .channel(`plans:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plans", filter: `group_id=eq.${group.id}` }, () => loadData())
      .subscribe();
    const commitsSub = supabase
      .channel(`plan_commits:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_commits" }, () => loadData())
      .subscribe();
    const commentsSub = supabase
      .channel(`plan_comments:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_comments" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(memberSub);
      supabase.removeChannel(availSub);
      supabase.removeChannel(exSub);
      supabase.removeChannel(plansSub);
      supabase.removeChannel(commitsSub);
      supabase.removeChannel(commentsSub);
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
      setPendingMember(null);
      setIntroMode(true);
    }
    setJoining(false);
  }

  function confirmIdentity() {
    if (!pendingMember) return;
    setMe(pendingMember);
    setPendingMember(null);
  }

  function switchUser() {
    localStorage.removeItem(MEMBER_TOKEN_KEY(group.id));
    setPendingMember(null);
    setMemberName("");
  }

  function signOut() {
    localStorage.removeItem(MEMBER_TOKEN_KEY(group.id));
    setMe(null);
    setPendingMember(null);
    setMemberName("");
  }

  function openSheet(weekendId: string) {
    setSelectedWeekend(weekendId);
    setTimeout(() => setSheetOpen(true), 10);
  }

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => setSelectedWeekend(null), 300);
  }

  function startQuickFillResume() {
    if (!me) return;
    const unmarked = weekends
      .filter((w) => !availability.some((a) => a.member_id === me.id && a.weekend_id === w.id))
      .map((w) => w.id);
    if (unmarked.length === 0) return;
    setQuickFillWeekendIds(unmarked);
    setQuickFillIndex(0);
    setQuickFillMode(true);
  }

  function advanceQuickFill() {
    const next = quickFillIndex + 1;
    if (next >= quickFillWeekendIds.length) {
      setQuickFillDone(true);
      setTimeout(() => {
        setQuickFillMode(false);
        setQuickFillDone(false);
        loadData();
      }, 1600);
    } else {
      setQuickFillIndex(next);
    }
  }

  async function quickFillMark(weekendId: string, status: "available" | "busy") {
    if (!me) return;
    supabase
      .from("availability")
      .upsert(
        { member_id: me.id, weekend_id: weekendId, status },
        { onConflict: "member_id,weekend_id" }
      )
      .then(() => loadData());
    syncAvailability(weekendId, status);
    advanceQuickFill();
  }

  function syncAvailability(weekendId: string, status: "available" | "busy") {
    if (!userToken) return;
    const weekend = weekends.find((w) => w.id === weekendId);
    if (!weekend) return;
    fetch("/api/availability/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_token: userToken,
        weekend_start: weekend.start_date,
        weekend_end: weekend.end_date,
        status,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        // synced includes current group — only toast if other groups were updated
        const otherGroups = (data.synced ?? 0) - 1;
        if (otherGroups > 0) {
          setSyncedToast(otherGroups);
          setTimeout(() => setSyncedToast(null), 3000);
        }
      })
      .catch(() => {});
  }

  async function setStatus(weekendId: string, newStatus: "available" | "busy") {
    if (!me) return;
    setToggling(weekendId);
    const existing = availability.find((a) => a.member_id === me.id && a.weekend_id === weekendId);
    if (!existing) {
      await supabase.from("availability").insert({ member_id: me.id, weekend_id: weekendId, status: newStatus });
      syncAvailability(weekendId, newStatus);
    } else if (existing.status === newStatus) {
      await supabase.from("availability").delete().eq("id", existing.id);
    } else {
      await supabase.from("availability").update({ status: newStatus }).eq("id", existing.id);
      syncAvailability(weekendId, newStatus);
    }
    await loadData();
    setToggling(null);
  }

  async function toggleException(weekendId: string, day: ExceptionDay) {
    if (!me) return;
    const existing = exceptions.find(
      (e) => e.member_id === me.id && e.weekend_id === weekendId && e.day === day
    );
    if (existing) {
      await supabase.from("availability_exceptions").delete().eq("id", existing.id);
    } else {
      await supabase.from("availability_exceptions").insert({ member_id: me.id, weekend_id: weekendId, day });
    }
    await loadData();
  }

  async function setPlanStatus(planId: string, newStatus: "in" | "pass") {
    if (!me) return;
    setCommittingPlan(planId);
    const existing = planCommits.find((c) => c.plan_id === planId && c.member_id === me.id);
    if (!existing) {
      await supabase.from("plan_commits").insert({ plan_id: planId, member_id: me.id, status: newStatus });
    } else if (existing.status === newStatus) {
      await supabase.from("plan_commits").delete().eq("id", existing.id);
    } else {
      await supabase.from("plan_commits").update({ status: newStatus }).eq("id", existing.id);
    }
    await loadData();
    setCommittingPlan(null);
  }

  async function dropPlan(weekendId: string) {
    if (!me) return;
    const text = newPlanText[weekendId]?.trim();
    if (!text) return;
    setAddingPlan(weekendId);
    await supabase.from("plans").insert({
      group_id: group.id,
      weekend_id: weekendId,
      member_id: me.id,
      title: text,
      day: newPlanDay[weekendId] ?? null,
    });
    setNewPlanText((prev) => ({ ...prev, [weekendId]: "" }));
    setNewPlanDay((prev) => ({ ...prev, [weekendId]: null }));
    await loadData();
    setAddingPlan(null);
  }

  function myExceptions(weekendId: string): ExceptionDay[] {
    if (!me) return [];
    return exceptions.filter((e) => e.member_id === me.id && e.weekend_id === weekendId).map((e) => e.day);
  }

  function memberExceptions(memberId: string, weekendId: string): ExceptionDay[] {
    return exceptions.filter((e) => e.member_id === memberId && e.weekend_id === weekendId).map((e) => e.day);
  }

  function dayLabel(day: ExceptionDay): string {
    return { fri: "Fri", sat: "Sat", sun: "Sun", mon: "Mon" }[day];
  }

  function myStatus(weekendId: string): "available" | "busy" | null {
    if (!me) return null;
    return availability.find((a) => a.member_id === me.id && a.weekend_id === weekendId)?.status ?? null;
  }

  function myPlanStatus(planId: string): "in" | "pass" | null {
    if (!me) return null;
    return planCommits.find((c) => c.plan_id === planId && c.member_id === me.id)?.status ?? null;
  }

  function memberDotColor(memberId: string, weekendId: string): string {
    const a = availability.find((av) => av.member_id === memberId && av.weekend_id === weekendId);
    if (!a) return "bg-gray-200";
    return a.status === "available" ? "bg-emerald-500" : "bg-rose-300";
  }

  function availableMembers(weekendId: string): Member[] {
    const ids = availability.filter((a) => a.weekend_id === weekendId && a.status === "available").map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  function busyMembers(weekendId: string): Member[] {
    const ids = availability.filter((a) => a.weekend_id === weekendId && a.status === "busy").map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }

  function weekendPlans(weekendId: string): Plan[] {
    const wp = plans.filter((p) => p.weekend_id === weekendId);
    return wp.sort((a, b) => {
      const aIns = planCommits.filter((c) => c.plan_id === a.id && c.status === "in").length;
      const bIns = planCommits.filter((c) => c.plan_id === b.id && c.status === "in").length;
      return bIns - aIns;
    });
  }

  function planInCount(planId: string): number {
    return planCommits.filter((c) => c.plan_id === planId && c.status === "in").length;
  }

  function planInNames(planId: string): string[] {
    const ids = planCommits.filter((c) => c.plan_id === planId && c.status === "in").map((c) => c.member_id);
    return members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  }

  function planPassNames(planId: string): string[] {
    const ids = planCommits.filter((c) => c.plan_id === planId && c.status === "pass").map((c) => c.member_id);
    return members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  }

  function authorName(memberId: string): string {
    return members.find((m) => m.id === memberId)?.name ?? "Someone";
  }

  function planCommentList(planId: string): PlanComment[] {
    return planComments.filter((c) => c.plan_id === planId);
  }

  function timeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  async function postComment(planId: string) {
    if (!me) return;
    const body = newCommentText[planId]?.trim();
    if (!body) return;
    setPostingComment(planId);
    await supabase.from("plan_comments").insert({ plan_id: planId, member_id: me.id, body });
    setNewCommentText((prev) => ({ ...prev, [planId]: "" }));
    await loadData();
    setPostingComment(null);
  }

  async function copyPlanToChat(planId: string, weekendId: string) {
    const plan = plans.find((p) => p.id === planId);
    const weekend = weekends.find((w) => w.id === weekendId);
    if (!plan || !weekend) return;
    const names = planInNames(planId);
    const text = [
      `📅 ${formatWeekendDates(weekend.start_date, weekend.end_date)} — ${plan.title}`,
      `Who's in: ${names.join(", ")} (${names.length} ${names.length === 1 ? "person" : "people"})`,
      ``,
      `Join us: ${inviteUrl}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedPlan(planId);
    setTimeout(() => setCopiedPlan(null), 2000);
  }

  function dayBreakdown(weekendId: string, isHolidayWeekend: boolean): { day: ExceptionDay; count: number; total: number }[] {
    const allDays: ExceptionDay[] = isHolidayWeekend ? ["fri", "sat", "sun", "mon"] : ["fri", "sat", "sun"];
    const availMemberIds = availability
      .filter((a) => a.weekend_id === weekendId && a.status === "available")
      .map((a) => a.member_id);

    if (availMemberIds.length === 0) return [];

    const anyExceptions = availMemberIds.some((memberId) =>
      exceptions.some((e) => e.member_id === memberId && e.weekend_id === weekendId)
    );
    if (!anyExceptions) return [];

    return allDays.map((day) => ({
      day,
      count: availMemberIds.filter((memberId) => {
        const memberEx = exceptions
          .filter((e) => e.member_id === memberId && e.weekend_id === weekendId)
          .map((e) => e.day);
        return !memberEx.includes(day);
      }).length,
      total: availMemberIds.length,
    }));
  }

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/group/${group.invite_token}` : "";

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Welcome back screen ──────────────────────────────────────────────────
  if (!me && pendingMember) {
    return (
      <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl">👋</div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <p className="text-gray-500 text-sm">Welcome back — is this you?</p>
            <p className="text-xl font-semibold text-gray-900">{pendingMember.name}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={confirmIdentity}
              className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-base font-medium transition-colors"
            >
              That&apos;s me →
            </button>
            <button
              onClick={switchUser}
              className="w-full h-12 rounded-2xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              I&apos;m someone else
            </button>
          </div>
        </div>
      </main>
    );
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

  // ── Intro screen ────────────────────────────────────────────────────────
  if (introMode && me) {
    return (
      <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="text-5xl">☀️</div>
            <h1 className="text-3xl font-black text-gray-900 leading-tight">
              Summer only happens<br />if you plan it.
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              We&apos;ll walk you through all 16 summer weekends. Mark yourself free or busy — takes about a minute. Then everyone can instantly see the best weekends to get together.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                setIntroMode(false);
                setQuickFillWeekendIds(weekends.map((w) => w.id));
                setQuickFillIndex(0);
                setQuickFillMode(true);
              }}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-base font-bold transition-all"
            >
              Let&apos;s do it →
            </button>
            <button
              onClick={() => setIntroMode(false)}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip — take me to the board
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Quick-fill done celebration ──────────────────────────────────────────
  if (quickFillDone) {
    return (
      <main className="min-h-screen bg-emerald-500 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-7xl animate-bounce">🎉</div>
          <h2 className="text-3xl font-black text-white">You&apos;re all set!</h2>
          <p className="text-emerald-100">Let&apos;s see who&apos;s around this summer…</p>
        </div>
      </main>
    );
  }

  // ── Quick-fill flow ──────────────────────────────────────────────────────
  if (quickFillMode && me) {
    const currentWeekendId = quickFillWeekendIds[quickFillIndex];
    const currentWeekend = weekends.find((w) => w.id === currentWeekendId);

    if (!currentWeekend) {
      setQuickFillMode(false);
      return null;
    }

    const qHoliday = isHoliday(currentWeekend.label);
    const qAvail = availableMembers(currentWeekendId);
    const progressPct = ((quickFillIndex + 1) / quickFillWeekendIds.length) * 100;
    const qCurrentStatus = availability.find(
      (a) => a.member_id === me.id && a.weekend_id === currentWeekendId
    )?.status ?? null;

    return (
      <main className="min-h-screen bg-amber-50 flex flex-col">
        {/* Progress */}
        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {quickFillIndex > 0 && (
                <button
                  onClick={() => setQuickFillIndex((i) => i - 1)}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  ← Back
                </button>
              )}
              <span className="text-sm font-semibold text-gray-600">
                {quickFillIndex + 1} of {quickFillWeekendIds.length}
              </span>
            </div>
            <button
              onClick={() => setQuickFillMode(false)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip to board →
            </button>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
          <div className="w-full max-w-sm space-y-6">
            <p className="text-center text-gray-500 text-sm tracking-wide uppercase font-medium">
              Are you free this weekend?
            </p>

            <div className={`rounded-3xl p-8 text-center ${
              qHoliday ? "bg-amber-200" : "bg-white border border-gray-100 shadow-sm"
            }`}>
              {qHoliday && (
                <p className="text-sm font-bold text-amber-700 mb-3">⭐ {currentWeekend.label}</p>
              )}
              <p className="text-4xl font-black text-gray-900 leading-tight">
                {formatWeekendDates(currentWeekend.start_date, currentWeekend.end_date)}
              </p>
              {!qHoliday && currentWeekend.label && (
                <p className="text-sm text-gray-400 mt-2">{currentWeekend.label}</p>
              )}
              {/* Social proof — show who's already marked free */}
              {qAvail.length > 0 && (
                <p className="text-xs text-gray-400 mt-4">
                  {qAvail.slice(0, 2).map((m) => m.name).join(", ")}
                  {qAvail.length > 2 ? ` + ${qAvail.length - 2} more` : ""}{" "}
                  {qAvail.length === 1 ? "is" : "are"} free
                </p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => quickFillMark(currentWeekendId, "available")}
                className={`w-full h-16 rounded-2xl active:scale-95 text-lg font-bold transition-all shadow-sm ${
                  qCurrentStatus === "available"
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-200"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {qCurrentStatus === "available" ? "✓ I'm free" : "I'm free 🙌"}
              </button>
              <button
                onClick={() => quickFillMark(currentWeekendId, "busy")}
                className={`w-full h-14 rounded-2xl active:scale-95 text-base font-medium transition-all ${
                  qCurrentStatus === "busy"
                    ? "bg-rose-500 text-white ring-4 ring-rose-200"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {qCurrentStatus === "busy" ? "✗ Can't make it" : "Can't make it"}
              </button>
              <button
                onClick={advanceQuickFill}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-500 transition-colors"
              >
                Not sure yet →
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Board screen ─────────────────────────────────────────────────────────
  const markedCount = me
    ? weekends.filter((w) => availability.some((a) => a.member_id === me.id && a.weekend_id === w.id)).length
    : 0;
  const allMarked = markedCount === weekends.length;
  const sheetWeekend = selectedWeekend ? weekends.find((w) => w.id === selectedWeekend) ?? null : null;

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
              {userToken && (
                <>{" "}· <Link href="/me" className="underline underline-offset-2 hover:text-gray-700">my groups</Link></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Completion pill — tappable if not fully marked */}
            {!allMarked ? (
              <button
                onClick={startQuickFillResume}
                className="text-xs font-semibold bg-amber-200 text-amber-800 px-2.5 py-1.5 rounded-full hover:bg-amber-300 transition-colors"
              >
                {markedCount}/{weekends.length} marked
              </button>
            ) : (
              <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-full">
                ✓ All marked
              </span>
            )}
            <button
              onClick={copyInvite}
              className="text-xs text-green-700 font-medium bg-green-100 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors"
            >
              {copied ? "Copied!" : "Invite"}
            </button>
          </div>
        </div>
      </div>

      {/* Sync banner */}
      {userToken && !syncBannerDismissed && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">Syncing across groups</span> — availability updates everywhere
            </p>
            <button
              onClick={() => {
                localStorage.setItem("sw_sync_banner_dismissed", "1");
                setSyncBannerDismissed(true);
              }}
              className="text-emerald-400 hover:text-emerald-600 ml-3 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Weekend grid */}
      <div className="max-w-lg mx-auto px-4 pt-4 grid grid-cols-2 gap-3">
        {weekends.map((weekend) => {
          const avail = availableMembers(weekend.id);
          const total = members.length;
          const status = myStatus(weekend.id);
          const holiday = isHoliday(weekend.label);
          const tc = tileStyle(avail.length, total);
          const wPlans = weekendPlans(weekend.id);
          const iAmUnmarked = status === null;

          return (
            <button
              key={weekend.id}
              onClick={() => openSheet(weekend.id)}
              className={`${tc.bg} rounded-2xl p-4 text-left flex flex-col gap-3 active:scale-95 transition-transform ${
                holiday ? "min-h-44" : "min-h-36"
              }`}
            >
              {/* Date */}
              <div className="flex-1">
                {holiday ? (
                  <>
                    <p className="text-xs font-bold text-amber-600 mb-1">⭐ {weekend.label}</p>
                    <p className={`text-lg font-black leading-snug ${tc.text}`}>
                      {formatWeekendDates(weekend.start_date, weekend.end_date)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-base font-bold leading-snug ${tc.text}`}>
                      {formatWeekendDates(weekend.start_date, weekend.end_date)}
                    </p>
                    {weekend.label && (
                      <p className={`text-xs mt-0.5 ${tc.sub}`}>{weekend.label}</p>
                    )}
                  </>
                )}
              </div>

              {/* Member dots */}
              {members.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className={`w-2.5 h-2.5 rounded-full ${memberDotColor(m.id, weekend.id)} ${
                        me && m.id === me.id ? "ring-2 ring-white" : ""
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${tc.count}`}>
                  {total === 0
                    ? "Be first →"
                    : iAmUnmarked && total > 0
                    ? `${avail.length}/${total} · mark yours`
                    : `${avail.length}/${total} free`}
                </span>
                <div className="flex items-center gap-1.5">
                  {status === "available" && <span className="text-xs font-bold text-emerald-600">✓</span>}
                  {status === "busy" && <span className="text-xs font-bold text-rose-400">✗</span>}
                  {wPlans.length > 0 && (
                    <span className="text-xs text-indigo-400">
                      📌{wPlans.length > 1 ? ` ${wPlans.length}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Backdrop */}
      {selectedWeekend && (
        <div
          className={`fixed inset-0 bg-black/40 z-20 transition-opacity duration-300 ${sheetOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeSheet}
        />
      )}

      {/* Bottom sheet */}
      {sheetWeekend && (() => {
        const weekend = sheetWeekend;
        const weekendId = weekend.id;
        const avail = availableMembers(weekendId);
        const busy = busyMembers(weekendId);
        const total = members.length;
        const status = myStatus(weekendId);
        const holiday = isHoliday(weekend.label);
        const myEx = myExceptions(weekendId);
        const exDays: ExceptionDay[] = holiday ? ["fri", "sat", "sun", "mon"] : ["fri", "sat", "sun"];
        const wPlans = weekendPlans(weekendId);
        const dayBreak = dayBreakdown(weekendId, holiday);

        return (
          <div
            className={`fixed bottom-0 inset-x-0 z-30 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto ${
              sheetOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Sheet header */}
            <div className="px-5 pt-1 pb-4 flex items-start justify-between">
              <div>
                {holiday && <p className="text-xs font-bold text-amber-600 mb-0.5">⭐ {weekend.label}</p>}
                <h2 className="text-2xl font-bold text-gray-900">
                  {formatWeekendDates(weekend.start_date, weekend.end_date)}
                </h2>
                {!holiday && weekend.label && (
                  <p className="text-sm text-gray-500 mt-0.5">{weekend.label}</p>
                )}
              </div>
              <button
                onClick={closeSheet}
                className="mt-1 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Day breakdown */}
            {dayBreak.length > 0 && (
              <div className="px-5 pb-4 flex gap-4">
                {dayBreak.map(({ day, count, total: t }) => (
                  <div key={day} className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{dayLabel(day)}</p>
                    <p className={`text-sm font-bold ${
                      count === t ? "text-emerald-600" :
                      count > 0 ? "text-amber-500" :
                      "text-gray-300"
                    }`}>{count}/{t}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 space-y-4 pb-8">
              {/* Who's free / busy */}
              <div className="space-y-2">
                {avail.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 mb-1.5">Free</p>
                    <div className="flex flex-wrap gap-1.5">
                      {avail.map((m) => {
                        const ex = memberExceptions(m.id, weekendId);
                        return (
                          <span key={m.id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                            {m.name}
                            {ex.length > 0 && (
                              <span className="text-emerald-400 ml-1">(not {ex.map(dayLabel).join(", ")})</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {busy.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-400 mb-1.5">Busy</p>
                    <div className="flex flex-wrap gap-1.5">
                      {busy.map((m) => (
                        <span key={m.id} className="text-xs bg-rose-50 text-rose-500 border border-rose-100 px-2.5 py-1 rounded-full">
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

              {/* Availability buttons */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Are you free this weekend?</p>
                <div className="flex gap-2">
                  <button
                    disabled={toggling === weekendId}
                    onClick={() => setStatus(weekendId, "available")}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                      status === "available"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {status === "available" ? "✓ I'm free" : "I'm free"}
                  </button>
                  <button
                    disabled={toggling === weekendId}
                    onClick={() => setStatus(weekendId, "busy")}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                      status === "busy"
                        ? "bg-rose-500 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {status === "busy" ? "✗ Busy" : "Busy"}
                  </button>
                </div>
              </div>

              {/* Day exceptions */}
              {status === "available" && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400">Any days you can&apos;t make it?</p>
                  <div className="flex gap-2">
                    {exDays.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleException(weekendId, d)}
                        className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors ${
                          myEx.includes(d)
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {dayLabel(d)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100" />

              {/* Plans */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plans</p>

                {wPlans.length === 0 && (
                  <p className="text-xs text-gray-400">No plans yet — drop one below.</p>
                )}

                {wPlans.map((plan) => {
                  const myCommit = myPlanStatus(plan.id);
                  const inCount = planInCount(plan.id);
                  const inNames = planInNames(plan.id);
                  const passNames = planPassNames(plan.id);
                  const comments = planCommentList(plan.id);
                  const showThread = inCount >= 2 || comments.length > 0;

                  return (
                    <div key={plan.id} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      {/* Plan header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{plan.title}</p>
                            {plan.day && (
                              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md capitalize">
                                {plan.day === "fri" ? "Fri" : plan.day === "sat" ? "Sat" : "Sun"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">by {authorName(plan.member_id)}</p>
                        </div>
                        {inCount > 0 && (
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                            {inCount} in
                          </span>
                        )}
                      </div>

                      {/* Who's in / passing */}
                      {(inNames.length > 0 || passNames.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {inNames.map((name) => (
                            <span key={name} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                              ✓ {name}
                            </span>
                          ))}
                          {passNames.map((name) => (
                            <span key={name} className="text-xs bg-rose-50 text-rose-400 border border-rose-100 px-2 py-0.5 rounded-full line-through">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Commit buttons */}
                      <div className="flex gap-2">
                        <button
                          disabled={committingPlan === plan.id}
                          onClick={() => setPlanStatus(plan.id, "in")}
                          className={`flex-1 h-10 rounded-xl text-xs font-medium transition-colors ${
                            myCommit === "in"
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          {myCommit === "in" ? "✓ I'm in" : "I'm in"}
                        </button>
                        <button
                          disabled={committingPlan === plan.id}
                          onClick={() => setPlanStatus(plan.id, "pass")}
                          className={`flex-1 h-10 rounded-xl text-xs font-medium transition-colors ${
                            myCommit === "pass"
                              ? "bg-rose-500 text-white"
                              : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {myCommit === "pass" ? "✗ Passing" : "I'll pass"}
                        </button>
                      </div>

                      {/* Copy to chat — appears once 2+ people are in */}
                      {inCount >= 2 && (
                        <button
                          onClick={() => copyPlanToChat(plan.id, weekendId)}
                          className="w-full h-9 rounded-xl bg-white border border-indigo-100 text-indigo-500 text-xs font-medium hover:bg-indigo-50 transition-colors"
                        >
                          {copiedPlan === plan.id ? "✓ Copied to clipboard!" : "📋 Copy to group chat →"}
                        </button>
                      )}

                      {/* Comment thread */}
                      {showThread && (
                        <div className="border-t border-gray-200 pt-3 space-y-3">
                          {comments.length === 0 && (
                            <p className="text-xs text-gray-400">No notes yet — use this to coordinate details.</p>
                          )}
                          {comments.length > 0 && (
                            <div className="space-y-2.5">
                              {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-2.5">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-gray-500">
                                      {authorName(comment.member_id).charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-xs font-semibold text-gray-700">{authorName(comment.member_id)}</span>
                                      <span className="text-xs text-gray-300">{timeAgo(comment.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-snug break-words">{comment.body}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <form
                            onSubmit={(e) => { e.preventDefault(); postComment(plan.id); }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              placeholder="Add a note…"
                              value={newCommentText[plan.id] ?? ""}
                              onChange={(e) => setNewCommentText((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              className="flex-1 h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <button
                              type="submit"
                              disabled={!newCommentText[plan.id]?.trim() || postingComment === plan.id}
                              className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold hover:bg-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center"
                            >
                              →
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add plan */}
                <form
                  onSubmit={(e) => { e.preventDefault(); dropPlan(weekendId); }}
                  className="space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Drop a plan… (e.g. Camping trip)"
                      value={newPlanText[weekendId] ?? ""}
                      onChange={(e) => setNewPlanText((prev) => ({ ...prev, [weekendId]: e.target.value }))}
                      className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      type="submit"
                      disabled={!newPlanText[weekendId]?.trim() || addingPlan === weekendId}
                      className="h-11 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {addingPlan === weekendId ? "…" : "Add"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Day:</span>
                    {(["fri", "sat", "sun"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewPlanDay((prev) => ({ ...prev, [weekendId]: prev[weekendId] === d ? null : d }))}
                        className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                          newPlanDay[weekendId] === d
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                    <span className="text-xs text-gray-300 ml-1">optional</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sync toast */}
      {syncedToast !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
          Updated in {syncedToast} other {syncedToast === 1 ? "group" : "groups"}
        </div>
      )}
    </main>
  );
}
