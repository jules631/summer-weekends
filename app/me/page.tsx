import { Suspense } from "react";
import { MeClient } from "./MeClient";

export default function MePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      }
    >
      <MeClient />
    </Suspense>
  );
}
