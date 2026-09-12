"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LiquidGlassOrb } from '@/app/components/orb/themes/LiquidGlassOrb';
import { OrbState, ORB_STATE_LABELS } from '@/app/components/orb/types';

export default function OrbLabPage() {
  const [state, setState] = useState(OrbState.Idle);
  const [level, setLevel] = useState(0);
  const analysis = useMemo(() => ({
    volume: level,
    bass: level * 0.8,
    mid: level * 0.6,
    treble: level * 0.45,
    peak: level,
    waveform: new Float32Array(1024),
    isActive: level > 0,
  }), [level]);

  return (
    <main className="flex min-h-svh flex-col items-center overflow-hidden bg-[#02030b] px-5 py-10 text-slate-200">
      <Link href="/orb-showcase" className="text-sm font-light tracking-[0.65em] text-white/80" aria-label="Orby — open live showcase">ORBY</Link>
      <div className="flex w-full max-w-2xl flex-1 items-center justify-center py-6">
        <LiquidGlassOrb state={state} analysis={analysis} size={600} />
      </div>
      <section className="w-full max-w-lg pb-6 text-center" aria-label="Orb preview controls">
        <h1 className="text-lg font-light tracking-wide">Liquid Glass</h1>
        <p className="mt-2 text-xs text-slate-500">Design preview</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {Object.values(OrbState).map((value) => (
            <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}
              className={`rounded-full border px-3 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${state === value ? 'border-blue-400/60 bg-blue-500/15 text-blue-100' : 'border-white/10 text-slate-400 hover:border-white/30'}`}>
              {ORB_STATE_LABELS[value]}
            </button>
          ))}
        </div>
        <label className="mx-auto mt-6 flex max-w-xs items-center gap-3 text-xs text-slate-400">
          <span className="whitespace-nowrap">Audio level</span>
          <input aria-label="Preview audio level" type="range" min="0" max="1" step="0.01" value={level} onChange={(event) => setLevel(Number(event.target.value))} className="w-full accent-blue-400" />
          <output className="w-9 tabular-nums">{Math.round(level * 100)}%</output>
        </label>
        <p className="mt-3 text-xs leading-5 text-slate-500">Simulated level here. In the live showcase, select Liquid Glass<br className="hidden sm:block" /> to use the existing voice audio and conversation states.</p>
        <Link href="/orb-showcase" className="mt-5 inline-block text-xs text-blue-300 hover:text-blue-100">Open live showcase →</Link>
      </section>
    </main>
  );
}
