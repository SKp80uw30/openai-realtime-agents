import React, { Suspense } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import OrbShowcase from "./orb-showcase/OrbShowcase";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TranscriptProvider>
        <EventProvider>
          <OrbShowcase />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}
