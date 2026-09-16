"use client";

import { useEffect, useRef, useState } from 'react';
import type { CapabilityGroupStatus } from '@/app/types/onboarding';
import { getCapabilityIcon } from './capabilityIcons';

interface Props {
  data: CapabilityGroupStatus | null;
}

// Persistent, glanceable "Handsfree Email" skills rail. Shows the full map of
// what hands-free email covers and what's already been proven hands-free — the
// visible counterpart to the invisible trust-ladder stage gate.
//
// Renders as a row of capability glyphs beneath the mic button rather than a
// header chip: at a glance the lit-vs-dim icons *are* the n/7 progress, so the
// education stays present on a voice-first screen without competing with the
// orb or crowding the top chrome. Tapping a glyph reveals the phrase that
// earns it; tapping the caption opens the full list.
// Closing line of the "why email first?" case. Rotates each time the panel is
// opened: the argument above it is fixed and factual, this is the part that has
// to land emotionally, and the same image stops landing the third time you see
// it. Each one cashes the 28% out as a specific thing you'd rather be doing.
const FREED_TIME_IMAGES = [
  'That’s the first two hours of every workday back. Paddleboarding, maybe.',
  'That’s the dog walked and the inbox cleared before you’d normally sit down.',
  'That’s a working week run from the trail, the kitchen, the school run.',
  'That’s the house finally painted, one triaged inbox at a time.',
  'That’s the climb you keep not making time for — done, mid-triage.',
];

// The level a skill is currently working toward, for "2 more to Fluent".
function nextFluencyLabel(capability: { fluency?: string }): string {
  const index = FLUENCY_ORDER.indexOf(capability.fluency ?? 'new');
  return FLUENCY_LABELS[FLUENCY_ORDER[index + 1]] ?? 'Fluent';
}

const FLUENCY_ORDER = ['new', 'tried', 'practised', 'fluent'];
const FLUENCY_LABELS: Record<string, string> = {
  new: 'Not yet',
  tried: 'Tried',
  practised: 'Practised',
  fluent: 'Fluent',
};

// How many of the three meter segments each fluency level fills.
const FLUENCY_SEGMENTS: Record<string, number> = {
  new: 0,
  tried: 1,
  practised: 2,
  fluent: 3,
};

export function CapabilityChecklist({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [openHintKey, setOpenHintKey] = useState<string | null>(null);
  const [justCompletedKey, setJustCompletedKey] = useState<string | null>(null);
  // Fluency level per key, not just "was it completed" — the pulse has to fire
  // again at Practised and Fluent. Celebrating only the very first use is the
  // habit-killing pattern this whole ladder exists to avoid.
  const previousFluency = useRef<Map<string, string>>(new Map());

  // Collapse the "why" with the sheet, so reopening offers a fresh image
  // rather than the one already read.
  const closeSheet = () => {
    setExpanded(false);
    setWhyOpen(false);
  };

  const openWhy = () => {
    setWhyOpen((open) => {
      if (!open) setImageIndex((i) => (i + 1) % FREED_TIME_IMAGES.length);
      return !open;
    });
  };

  useEffect(() => {
    if (!data) return;
    const seeded = previousFluency.current.size > 0;
    const levelledUp = data.capabilities.find((capability) => {
      const before = previousFluency.current.get(capability.key) ?? 'new';
      const now = capability.fluency ?? 'new';
      return FLUENCY_ORDER.indexOf(now) > FLUENCY_ORDER.indexOf(before);
    });
    if (levelledUp && seeded) {
      setJustCompletedKey(levelledUp.key);
    }
    previousFluency.current = new Map(
      data.capabilities.map((capability) => [capability.key, capability.fluency ?? 'new']),
    );
  }, [data]);

  if (!data) return null;

  const completedCount = data.capabilities.filter((c) => c.completed).length;
  const total = data.capabilities.length;
  const openHint = data.capabilities.find((c) => c.key === openHintKey) ?? null;
  // Guarded: a stale service-worker cache can serve a response predating the
  // practice fields, and the rail must still render without them.
  const practice = data.practice ?? null;
  const allStepsDone = total > 0 && completedCount === total;

  // Progress toward the next rung. Whichever requirement is still outstanding
  // drives the bar — showing days filling up while the real blocker is an
  // untried skill would misreport how close the user actually is.
  const stepsBlocking = practice?.toNextTier ? practice.toNextTier.steps > 0 : false;
  let tierProgressFraction = 0;
  if (practice?.nextTier && practice.toNextTier) {
    if (stepsBlocking) {
      tierProgressFraction = total > 0 ? completedCount / total : 0;
    } else {
      const span = Math.max(1, practice.nextTier.minDays - practice.tier.minDays);
      tierProgressFraction = (practice.activeDays - practice.tier.minDays) / span;
    }
  }
  tierProgressFraction = Math.min(1, Math.max(0, tierProgressFraction));

  let nextTierRequirement = '';
  if (practice?.nextTier && practice.toNextTier) {
    const { days, steps } = practice.toNextTier;
    const dayWord = days === 1 ? 'day' : 'days';
    const stepWord = steps === 1 ? 'skill' : 'skills';
    if (steps > 0 && days > 0) {
      nextTierRequirement = `${steps} more ${stepWord}, then ${days} more hands-free ${dayWord} → ${practice.nextTier.label}`;
    } else if (steps > 0) {
      nextTierRequirement = `${steps} more ${stepWord} → ${practice.nextTier.label}`;
    } else {
      nextTierRequirement = `${days} more hands-free ${dayWord} → ${practice.nextTier.label}`;
    }
  }

  return (
    <div className="relative w-full">
      {/* Hint for a single glyph. The band is permanently reserved (not just
          claimed when a hint opens) for two reasons: opening a hint never
          reflows the rail, and — because the dock is the grid's bottom auto
          row — the mic button above is lifted clear of where the hint lands,
          so a popped hint can never cover the one control that has to stay
          hittable. */}
      <div className="pointer-events-none relative mb-1 flex h-[3.75rem] items-end justify-center px-4">
        {openHint && (
          <div className="max-w-xs rounded-xl border border-cyan-400/25 bg-slate-950/95 px-3.5 py-2 text-center shadow-[0_16px_40px_rgba(8,47,73,0.55)] backdrop-blur">
            <p className="text-xs font-medium text-slate-100">{openHint.label}</p>
            {/* Never a dead end. Before the first use this is the phrase that
                earns it; after, it's the phrase *plus* how far off routine the
                skill still is — because "you've used this hands-free" told the
                user they were finished after a single sentence. */}
            <p className="mt-0.5 text-[0.7rem] leading-snug text-slate-400">{openHint.hint}</p>
            {openHint.completed && (
              <p className="mt-1 text-[0.7rem] leading-snug text-cyan-200/80">
                {openHint.fluencyLabel} · used {openHint.useCount}×
                {openHint.usesToNextFluency !== null && openHint.usesToNextFluency !== undefined
                  ? ` — ${openHint.usesToNextFluency} more to go`
                  : ''}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => (expanded ? closeSheet() : setExpanded(true))}
        aria-expanded={expanded}
        className="mx-auto flex w-full max-w-[var(--orb-diameter,22rem)] items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-slate-400">
          {data.group.label}
          {/* Signals that the caption hides more than a longer list — the case
              for why any of this is worth learning now lives behind it. */}
          <span
            aria-hidden
            className="flex h-3 w-3 items-center justify-center rounded-full border border-slate-500/60 text-[0.5rem] font-semibold normal-case tracking-normal text-slate-500"
          >
            i
          </span>
        </span>
        {/* Once every step has been met once, the rail stops reporting n/7 and
            starts reporting depth. A permanent "7/7" is precisely the signal
            we don't want — it says the thing is finished when the habit hasn't
            started. Days practised can always go up; the repertoire can't. */}
        {allStepsDone && practice ? (
          <span className="flex items-baseline gap-1.5 text-[0.7rem] font-semibold text-cyan-300/90">
            <span className="uppercase tracking-[0.12em]">{practice.tier.label}</span>
            <span className="tabular-nums text-slate-500">
              {practice.activeDays}d
            </span>
          </span>
        ) : (
          <span className="text-[0.7rem] font-semibold tabular-nums text-cyan-300/90">
            {completedCount}
            <span className="text-slate-500">/{total}</span>
          </span>
        )}
      </button>

      {/* Four to a row, wrapping — a flex-wrap rather than a 4-col grid so the
          trailing short row centres itself under the full one instead of
          hanging off to the left. Width is the orb's diameter, so the grid, the
          mic and the sphere all share one vertical axis and one measure. */}
      <ul className="mx-auto flex w-full max-w-[var(--orb-diameter,22rem)] flex-wrap justify-center gap-1">
        {data.capabilities.map((capability) => {
          const isOpen = openHintKey === capability.key;
          const filledSegments = FLUENCY_SEGMENTS[capability.fluency ?? 'new'];
          return (
            <li key={capability.key} className="basis-[calc(25%_-_0.19rem)]">
              <button
                type="button"
                onClick={() => setOpenHintKey((k) => (k === capability.key ? null : capability.key))}
                aria-expanded={isOpen}
                aria-label={`${capability.label} — ${
                  capability.completed
                    ? `${capability.fluencyLabel ?? 'tried'}, used ${capability.useCount ?? 1} times`
                    : 'not done yet'
                }`}
                className={`relative flex h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border transition ${
                  capability.completed
                    ? 'border-cyan-300/50 bg-cyan-400/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                    : 'border-slate-200/10 bg-slate-900/50 text-slate-500'
                } ${isOpen ? 'ring-2 ring-cyan-300/60' : ''} ${
                  justCompletedKey === capability.key ? 'animate-[capability-tick_0.6s_ease-out]' : ''
                } active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300`}
                onAnimationEnd={() => setJustCompletedKey((k) => (k === capability.key ? null : k))}
              >
                <span className="[&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]">
                  {getCapabilityIcon(capability.key)}
                </span>
                {/* Three-segment fluency meter: tried / practised / fluent. The
                    glyph lighting up still marks "you've done this once", but
                    the meter keeps visibly unfinished until the skill is
                    genuinely routine — so the rail can't be read as solved at
                    one use each. */}
                <span aria-hidden className="flex gap-[3px]">
                  {[0, 1, 2].map((segment) => (
                    <span
                      key={segment}
                      className={`h-[2px] w-[7px] rounded-full transition ${
                        segment < filledSegments ? 'bg-cyan-300/90' : 'bg-slate-200/15'
                      }`}
                    />
                  ))}
                </span>
                {/* Shape as well as colour, and only at full fluency — the tick
                    is the one unambiguous "this is done" mark, so it's reserved
                    for the level that actually is. */}
                {capability.fluency === 'fluent' && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-cyan-300 text-[0.5rem] font-bold leading-none text-slate-950"
                  >
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Full list — a bottom sheet, since the rail now lives at the bottom edge. */}
      {expanded && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={closeSheet}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-t-3xl border-t border-cyan-400/20 bg-slate-950/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-30px_60px_rgba(8,47,73,0.45)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700" aria-hidden />
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{data.group.label}</p>

            {/* The header leads with the payoff, not the mechanic. Seven skills
                reads as homework until you know what it buys; the stat is the
                only thing that reframes it, so it gets the headline line and the
                mechanic drops to a caption on the list below. */}
            <p className="mt-2 text-sm leading-snug text-slate-200">
              Email is <span className="font-semibold text-cyan-200">28% of the average workweek</span>. These
              seven skills hand that back — no screen, no keyboard, no desk.
            </p>

            <button
              type="button"
              onClick={openWhy}
              aria-expanded={whyOpen}
              className="mt-2 flex items-center gap-1.5 rounded-lg py-1 text-[0.75rem] font-medium text-cyan-300/90 transition hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Why email first?
              <span aria-hidden className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`}>
                ⌄
              </span>
            </button>

            {whyOpen && (
              <div className="mt-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-3">
                <ul className="space-y-2 text-[0.78rem] leading-snug text-slate-300">
                  <li>
                    It’s the biggest single block of a knowledge worker’s week — bigger than meetings, bigger
                    than the actual work.
                  </li>
                  <li>
                    And it’s the block best suited to voice. Speaking is 3–4× faster than typing, and it works
                    anywhere: the car, the trail, the kitchen, the queue.
                  </li>
                  <li>
                    Seven skills is an afternoon. What it buys is a quarter of every week, for the rest of your
                    working life.
                  </li>
                </ul>
                <p className="mt-3 border-t border-cyan-400/15 pt-2.5 text-[0.78rem] italic leading-snug text-cyan-200/90">
                  {FREED_TIME_IMAGES[imageIndex]}
                </p>
              </div>
            )}

            {/* The ladder that outlives the checklist. Seven ticks is the
                repertoire; this is the part that takes months, and it's shown
                right above the list so finishing the list reads as reaching a
                rung rather than reaching the end. */}
            {practice && (
              <div className="mt-4 rounded-xl border border-slate-200/10 bg-slate-900/60 px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    {practice.tier.label}
                  </span>
                  <span className="text-[0.7rem] tabular-nums text-slate-500">
                    {practice.activeDays} hands-free {practice.activeDays === 1 ? 'day' : 'days'}
                    {practice.currentStreak > 1 ? ` · ${practice.currentStreak} in a row` : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.78rem] leading-snug text-slate-300">{practice.tier.blurb}</p>

                {practice.nextTier && practice.toNextTier && (
                  <div className="mt-3 border-t border-slate-200/10 pt-2.5">
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-slate-200/10"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(tierProgressFraction * 100)}
                      aria-label={`Progress to ${practice.nextTier.label}`}
                    >
                      <div
                        className="h-full rounded-full bg-cyan-400/80 transition-[width]"
                        style={{ width: `${Math.round(tierProgressFraction * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[0.72rem] leading-snug text-slate-500">
                      {nextTierRequirement}
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-[0.75rem] text-slate-500">
              Each one ticks the first time you do it — then keeps filling as it becomes routine.
            </p>
            <ul className="mt-2 max-h-[45vh] space-y-1.5 overflow-y-auto">
              {data.capabilities.map((capability) => (
                <li
                  key={capability.key}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                    capability.completed
                      ? 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
                      : 'border-slate-200/10 bg-slate-900/50 text-slate-300'
                  }`}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${capability.completed ? 'text-cyan-200' : 'text-slate-500'} [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]`}
                  >
                    {getCapabilityIcon(capability.key)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{capability.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {capability.completed
                        ? `Used ${capability.useCount}×${
                            capability.usesToNextFluency
                              ? ` · ${capability.usesToNextFluency} more to ${nextFluencyLabel(capability)}`
                              : ''
                          }`
                        : capability.hint}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] ${
                      capability.fluency === 'fluent' ? 'text-cyan-200' : 'text-slate-500'
                    }`}
                  >
                    {capability.completed ? capability.fluencyLabel : '○'}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={closeSheet}
              className="mt-4 w-full rounded-full border border-slate-200/15 bg-slate-900/70 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/70"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes capability-tick {
          0% { box-shadow: 0 0 0 rgba(34, 211, 238, 0); }
          40% { box-shadow: 0 0 24px rgba(34, 211, 238, 0.55); }
          100% { box-shadow: 0 0 0 rgba(34, 211, 238, 0); }
        }
      `}</style>
    </div>
  );
}

export default CapabilityChecklist;
