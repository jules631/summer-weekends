import { Suspense } from "react";
import { ClaimContent } from "./ClaimContent";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-400 text-sm">Verifying…</p>
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
