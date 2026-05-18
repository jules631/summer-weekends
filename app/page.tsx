import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm w-full space-y-8">
        <div className="space-y-3">
          <div className="text-6xl">☀️</div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Summer Weekends
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            See when your crew is free this summer — at a glance.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/create" className="block">
            <Button
              size="lg"
              className="w-full text-base h-14 rounded-2xl bg-green-600 hover:bg-green-700"
            >
              Create my group
            </Button>
          </Link>
          <p className="text-xs text-gray-400">
            No sign-up needed for your friends — just share a link.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-amber-200">
          <div className="space-y-1">
            <div className="text-2xl">📆</div>
            <p className="text-xs text-gray-500">16 summer weekends</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl">👥</div>
            <p className="text-xs text-gray-500">Any size group</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl">⚡</div>
            <p className="text-xs text-gray-500">Updates live</p>
          </div>
        </div>
      </div>
    </main>
  );
}
