"use client";

import styles from '../orb.module.css';
import { OrbAudioAnalysis, OrbState } from '../types';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

const STATE_GLOW: Record<OrbState, string> = {
  [OrbState.Idle]: 'rgba(148, 163, 184, 0.3)',
  [OrbState.Ready]: 'rgba(59, 130, 246, 0.45)',
  [OrbState.Listening]: 'rgba(34, 197, 94, 0.55)',
  [OrbState.Thinking]: 'rgba(168, 85, 247, 0.55)',
  [OrbState.Speaking]: 'rgba(244, 114, 182, 0.6)',
  [OrbState.Interrupted]: 'rgba(249, 115, 22, 0.65)',
  [OrbState.Working]: 'rgba(34, 197, 94, 0.65)', // Green for working/tool execution
};

const BASE_SIZE = 260;

export function SoapBubbleOrb({ analysis, state, size = BASE_SIZE }: Props) {
  const reactiveSize = size + analysis.volume * 50;
  const swirlDuration = `${Math.max(7, 18 - analysis.volume * 10)}s`;
  const secondarySwirl = `${Math.max(10, 24 - analysis.mid * 12)}s`;
  const glowColor = STATE_GLOW[state];

  return (
    <div
      className={styles.orbContainer}
      style={{
        width: reactiveSize,
        height: reactiveSize,
        transform: `scale(${1 + analysis.volume * 0.04})`,
      }}
    >
      <div
        className={styles.orbGlow}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(15, 23, 42, 0) 65%)`,
          transform: `scale(${1.5 + analysis.volume * 1.1})`,
          opacity: 0.32 + analysis.volume * 0.4,
        }}
      />

      <div className="relative w-full h-full rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.15), rgba(148,163,184,0.1), rgba(15,23,42,0.85))',
          }}
        />
        <div
          className={`absolute inset-0 rounded-full mix-blend-screen ${styles.spin}`}
          style={{
            background: 'conic-gradient(from 120deg, rgba(186,230,253,0.35), rgba(255,228,230,0.4), rgba(221,214,254,0.35), rgba(186,230,253,0.35))',
            animationDuration: swirlDuration,
          }}
        />
        <div
          className={`absolute inset-[6%] rounded-full mix-blend-screen ${styles.spin}`}
          style={{
            background: 'conic-gradient(from 0deg, rgba(125,211,252,0.3) 0deg, rgba(248,196,113,0.35) 110deg, rgba(110,231,183,0.3) 220deg, rgba(125,211,252,0.3) 360deg)',
            animationDuration: secondarySwirl,
            animationDirection: 'reverse',
          }}
        />

        <div
          className="absolute inset-[10%] rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.6), rgba(255,255,255,0.05) 45%, rgba(12,74,110,0.65) 100%)',
            filter: `blur(${3 + analysis.mid * 3}px)`,
          }}
        />

        <div
          className="absolute inset-[5%] rounded-full border border-white/30"
          style={{
            boxShadow: `inset 0 0 ${25 + analysis.treble * 60}px rgba(255,255,255,0.25)`
          }}
        />

        <div
          className="absolute left-[28%] top-[18%] w-[20%] h-[15%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.85), rgba(255,255,255,0))',
            filter: `blur(${6 + analysis.volume * 5}px)`,
          }}
        />
        <div
          className="absolute right-[26%] bottom-[24%] w-[14%] h-[10%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.6), rgba(255,255,255,0))',
            filter: `blur(${4 + analysis.treble * 6}px)`,
          }}
        />
      </div>
    </div>
  );
}
