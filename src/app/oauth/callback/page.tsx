import { Suspense } from "react";
import OAuthCallbackClient from "@/app/oauth/callback/client";

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center justify-center p-6">Processing authorization…</div>}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
