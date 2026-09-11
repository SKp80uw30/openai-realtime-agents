"use client";

import { useEffect, useRef, useState } from 'react';
import type { CapabilityGroupStatus } from '@/app/types/onboarding';

interface Props {
  data: CapabilityGroupStatus | null;
}

// Persistent, glanceable "Handsfree Email" skills checklist. Shows the full
// map of what hands-free email covers and what's already been proven
// hands-free — the visible counterpart to the invisible trust-ladder stage
// gate. Styled to match ToolsOverlay rather than a gamified badge wall.
export function CapabilityChecklist({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [openHintKey, setOpenHintKey] = useState<string | null>(null);
  const [justCompletedKey, setJustCompletedKey] = useState<string | null>(null);
  const previouslyCompleted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const completedNow = data.capabilities.filter((c) => c.completed).map((c) => c.key);
    const newlyCompleted = completedNow.find((key) => !previouslyCompleted.current.has(key));
    if (newlyCompleted && previouslyCompleted.current.size > 0) {
      setJustCompletedKey(newlyCompleted);
    }
    previouslyCompleted.current = new Set(completedNow);
  }, [data]);

  if (!data) return null;

  const completedCount = data.capabilities.filter((c) => c.completed).length;
  const total = data.capabilities.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200/15 bg-slate-900/60 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-cyan-300/40 hover:bg-slate-800/60 transition whitespace-nowrap"
      >
        <span aria-hidden className="text-cyan-300">✦</span>
        {data.group.label}
        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-cyan-200">
          {completedCount}/{total}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-4 shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{data.group.label}</p>
          <p className="mt-1 text-[0.7rem] text-slate-500">
            Everything hands-free email covers — checked off the first time you actually do it.
          </p>
          <ul className="mt-3 space-y-1.5">
            {data.capabilities.map((capability) => (
              <li key={capability.key}>
                <button
                  type="button"
                  onClick={() => setOpenHintKey((k) => (k === capability.key ? null : capability.key))}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    capability.completed
                      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-200/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70'
                  } ${justCompletedKey === capability.key ? 'animate-[capability-tick_0.6s_ease-out]' : ''}`}
                  onAnimationEnd={() => setJustCompletedKey((k) => (k === capability.key ? null : k))}
                >
                  <span>{capability.label}</span>
                  <span aria-hidden>{capability.completed ? '✓' : '○'}</span>
                </button>
                {openHintKey === capability.key && !capability.completed && (
                  <p className="mt-1 px-3 text-xs text-slate-400">{capability.hint}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        @keyframes capability-tick {
          0% { box-shadow: 0 0 0 rgba(52, 211, 153, 0); }
          40% { box-shadow: 0 0 24px rgba(52, 211, 153, 0.45); }
          100% { box-shadow: 0 0 0 rgba(52, 211, 153, 0); }
        }
      `}</style>
    </div>
  );
}

export default CapabilityChecklist;
