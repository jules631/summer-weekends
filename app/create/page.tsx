"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    // Redirect to the group board right away (creator joins too)
    router.push(`/group/${data.group.invite_token}`);
  }

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="space-y-2 text-center">
          <div className="text-4xl">🌞</div>
          <h1 className="text-2xl font-bold text-gray-900">Name your group</h1>
          <p className="text-sm text-gray-500">
            You&apos;ll get a link to share with your crew.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-700">
              Group name
            </Label>
            <Input
              id="name"
              placeholder="e.g. JJ's Summer Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 rounded-xl text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Your email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl text-base"
            />
            <p className="text-xs text-gray-400">
              We&apos;ll send you a link to manage your group.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-base"
          >
            {loading ? "Creating…" : "Create group →"}
          </Button>
        </form>
      </div>
    </main>
  );
}
