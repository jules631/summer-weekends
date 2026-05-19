"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type GroupEntry = {
  group: { id: string; name: string; invite_token: string };
  member: { id: string; name: string };
  totalWeekends: number;
  markedCount: number;
  availableCount: number;
  busyCount: number;
};

type MeData = {
  groups: GroupEntry[];
  email: string;
};

export function MeClient() {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [data, setData] = useState<MeData | null>(null);
  const [status, setStatus] = useState<"loading" | "no-identity" | "ready">("loading");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sw_user_token");
    if (!token) {
      setStatus("no-identity");
      return;
    }
    setUserToken(token);
    fetch(`/api/me?user_token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch(() => setStatus("no-identity"));
  }, []);

  async function sendClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    await fetch("/api/identity/send-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setSending(false);
    setSent(true);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (status === "no-identity") {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
            <p className="text-gray-500 text-sm mt-2">
              Verify your email to see all your groups in one place and keep availability in sync.
            </p>
          </div>
          {sent ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <p className="text-emerald-800 font-semibold">Check your email</p>
              <p className="text-emerald-600 text-sm mt-1">We sent a verification link to {email}.</p>
            </div>
          ) : (
            <form onSubmit={sendClaim} className="space-y-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                required
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-2xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send verification link →"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          {data?.email && (
            <p className="text-gray-400 text-sm mt-1">{data.email}</p>
          )}
        </div>

        {data?.groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No groups linked yet.</p>
            <p className="text-gray-400 text-sm mt-1">Join a group and your availability will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.groups.map((entry) => {
              const pct = entry.totalWeekends > 0 ? entry.markedCount / entry.totalWeekends : 0;
              const allDone = entry.markedCount === entry.totalWeekends;

              return (
                <Link
                  key={entry.group.id}
                  href={`/group/${entry.group.invite_token}`}
                  className="block bg-white rounded-2xl p-5 border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{entry.group.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{entry.member.name}</p>
                    </div>
                    <span className="text-gray-300 text-lg ml-3">→</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-400">
                        {entry.markedCount}/{entry.totalWeekends} weekends marked
                      </span>
                      {allDone && (
                        <span className="text-xs font-medium text-emerald-600">✓ Done</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Availability summary */}
                  {entry.markedCount > 0 && (
                    <div className="flex gap-3 mt-3">
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        {entry.availableCount} free
                      </span>
                      {entry.busyCount > 0 && (
                        <span className="text-xs text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                          {entry.busyCount} busy
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
