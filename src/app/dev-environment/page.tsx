import React, { Suspense } from 'react';
import { TranscriptProvider } from '@/app/contexts/TranscriptContext';
import { EventProvider } from '@/app/contexts/EventContext';
import App from '@/app/App';

export default function DevEnvironmentPage() {
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
