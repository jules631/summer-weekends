"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function ClaimContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    // Collect all member tokens from localStorage (all groups this device has joined)
    const memberTokens: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sw_member_token_")) {
        const val = localStorage.getItem(key);
        if (val) memberTokens.push(val);
      }
    }

    fetch("/api/identity/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, member_tokens: memberTokens }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user_token) {
          localStorage.setItem("sw_user_token", data.user_token);
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Verifying…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <p className="text-gray-800 font-semibold text-lg">That link is invalid or expired.</p>
          <p className="text-gray-500 text-sm mt-2">Request a new verification link from inside the app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 px-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold text-lg">Email verified!</p>
        <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
          Your availability will now sync across all your Summer Weekends groups automatically.
        </p>
        <p className="text-gray-400 text-xs mt-4">You can close this tab.</p>
      </div>
    </div>
  );
}
