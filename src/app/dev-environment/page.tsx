'use client';

import React, { Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { TranscriptProvider } from '@/app/contexts/TranscriptContext';
import { EventProvider } from '@/app/contexts/EventContext';
import App from '@/app/App';

export default function DevEnvironmentPage() {
  const { data: session, status: authStatus } = useSession();

  if (authStatus === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (authStatus !== 'authenticated' || !session?.user) {
    return (
      <div className="min-h-screen w-full bg-gray-100 flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-semibold text-gray-800">Sign in to continue</h1>
          <p className="text-sm text-gray-600 max-w-md">
            Use your Google account to access the developer environment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => signIn('google')}
          className="rounded-lg border border-blue-400 bg-blue-500 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-600 transition"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div>Loading developer environment…</div>}>
      <TranscriptProvider>
        <EventProvider>
          <App />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}
