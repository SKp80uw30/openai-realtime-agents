import React, { Suspense } from 'react';
import { TranscriptProvider } from '@/app/contexts/TranscriptContext';
import { EventProvider } from '@/app/contexts/EventContext';
import OrbShowcase from './OrbShowcase';

export default function OrbShowcasePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading orb experience…</div>}>
      <TranscriptProvider>
        <EventProvider>
          <OrbShowcase />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}
