"use client";

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  toolLabel: string;
  toolsConnected: boolean;
  onOpenTools: () => void;
  onSignOut: () => void;
}

// Everything that used to sit as its own chip in the top-left — tool
// connection, the research-preview disclaimer, sign out — collapsed behind a
// single 44pt icon. None of it is needed mid-conversation, and on a voice-first
// screen persistent chrome is what makes the orb feel like one widget among
// many rather than the interface itself.
export function SettingsMenu({ toolLabel, toolsConnected, onOpenTools, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Settings"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/15 bg-slate-900/50 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100 active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3.25" />
          <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.12a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.12a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.88.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.12a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.12a1.7 1.7 0 0 0-1.48 1.03z" />
        </svg>
        {/* Unconnected tools are the one thing worth surfacing while collapsed. */}
        {!toolsConnected && (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/15 bg-slate-950/95 shadow-[0_30px_60px_rgba(2,6,23,0.65)] backdrop-blur-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenTools();
            }}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900"
          >
            <span>Connected tools</span>
            <span className={`text-xs ${toolsConnected ? 'text-cyan-300' : 'text-amber-300'}`}>{toolLabel}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900"
          >
            Sign out
          </button>

          <p className="border-t border-slate-200/10 px-4 py-2.5 text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
            Research preview
          </p>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
