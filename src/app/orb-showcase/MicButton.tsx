"use client";

import React from 'react';
import type { SessionStatus } from '@/app/types';

interface Props {
  sessionStatus: SessionStatus;
  onToggle: () => void;
}

// Dotted arc flanking the pill — the scatter of light either side of the
// button in the design brief. Purely decorative. The curve's bulge is kept
// inside the viewBox on purpose: an arc that overshoots gets clipped and loses
// exactly the middle dots that make it read as a curve at all.
function DottedArc({ side }: { side: 'left' | 'right' }) {
  const isLeft = side === 'left';
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 80"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute top-1/2 h-[112%] w-[1.35rem] -translate-y-1/2 text-sky-400/70 ${
        isLeft ? 'right-full mr-1' : 'left-full ml-1'
      }`}
      fill="none"
    >
      <path
        d={isLeft ? 'M22 5 Q 2 40 22 75' : 'M2 5 Q 22 40 2 75'}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="0.1 6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The one control that has to be hittable without looking at the screen:
// a wide 76px pill in the bottom thumb zone, well past the 44pt minimum, and
// sized to the same 22rem measure as the skills rail beneath it.
// Glyph carries the state (mic = start, square = end) so it never depends on
// reading the caption, and the caption never depends on colour alone.
//
// The vibrant blue→purple rim is a gradient *border*: a gradient-filled outer
// shell with a near-opaque inner face inset by 2px, since CSS can't paint a
// gradient into `border-color` directly.
export function MicButton({ sessionStatus, onToggle }: Props) {
  const isLive = sessionStatus === 'CONNECTED';
  const isConnecting = sessionStatus === 'CONNECTING';

  const caption = isLive ? 'Tap to end' : isConnecting ? 'Connecting…' : 'Tap to start';
  const ariaLabel = isLive ? 'End conversation' : 'Start conversation';

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      {/* Measured against the orb's drawn diameter (set as --orb-diameter by the
          screen above) so the pill's ends sit under the sphere's edges. The
          fallback keeps the component usable on its own. */}
      <div className="relative w-full max-w-[var(--orb-diameter,17rem)]">
        <DottedArc side="left" />
        <DottedArc side="right" />

        <button
          type="button"
          onClick={onToggle}
          aria-label={ariaLabel}
          aria-busy={isConnecting}
          className={`group relative flex h-[4.75rem] w-full items-center justify-center rounded-full bg-gradient-to-r p-[2px] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 active:opacity-80 ${
            isLive
              ? 'from-cyan-300 via-sky-400 to-fuchsia-400 shadow-[0_0_28px_rgba(56,189,248,0.55),0_0_70px_rgba(168,85,247,0.4)]'
              : 'from-sky-400 via-blue-500 to-fuchsia-500 shadow-[0_0_22px_rgba(56,189,248,0.4),0_0_60px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6),0_0_80px_rgba(168,85,247,0.5)]'
          }`}
        >
          {/* Breathing halo while live — purely decorative, and motion-safe only.
              It pulses opacity rather than scale: `animate-ping` doubles the
              element's size, and at this pill's width that overflows the
              viewport as two full-bleed lines instead of reading as a halo. */}
          {isLive && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full border border-cyan-300/50 motion-safe:animate-pulse"
            />
          )}

          <span
            className={`relative flex h-full w-full items-center justify-center rounded-full ${
              isLive
                ? 'bg-slate-950/85 text-cyan-100'
                : 'bg-slate-950/90 text-slate-100 group-hover:bg-slate-900/85'
            }`}
          >
            {isLive ? (
              <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" rx="2.5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={`h-9 w-9 ${isConnecting ? 'motion-safe:animate-pulse' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
                <path d="M12 18v3.5" />
              </svg>
            )}
          </span>
        </button>
      </div>

      <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-slate-400">{caption}</p>
    </div>
  );
}

export default MicButton;
