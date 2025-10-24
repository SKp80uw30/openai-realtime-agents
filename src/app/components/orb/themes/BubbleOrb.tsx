"use client";

import styles from '../orb.module.css';
import { OrbAudioAnalysis, OrbState } from '../types';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

const STATE_GLOW: Record<OrbState, string> = {
  [OrbState.Idle]: 'rgba(148, 163, 184, 0.35)',
  [OrbState.Ready]: 'rgba(34, 211, 238, 0.5)',
  [OrbState.Listening]: 'rgba(59, 130, 246, 0.55)',
  [OrbState.Thinking]: 'rgba(168, 85, 247, 0.55)',
  [OrbState.Speaking]: 'rgba(236, 72, 153, 0.6)',
  [OrbState.Interrupted]: 'rgba(249, 115, 22, 0.65)',
  [OrbState.Working]: 'rgba(34, 197, 94, 0.65)', // Green for working/tool execution
};

const BASE_SIZE = 240;

export function BubbleOrb({ analysis, state, size = BASE_SIZE }: Props) {
  const reactiveSize = size + analysis.volume * 60;
  const causticSpeed = `${Math.max(6, 14 - analysis.mid * 10)}s`;
  const glowColor = STATE_GLOW[state];

  return (
    <div
      className={styles.orbContainer}
      style={{
        width: reactiveSize,
        height: reactiveSize,
        transform: `scale(${1 + analysis.volume * 0.05})`,
      }}
    >
      <div
        className={styles.orbGlow}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(15, 23, 42, 0) 70%)`,
          transform: `scale(${1.4 + analysis.volume * 0.8})`,
          opacity: 0.35 + analysis.volume * 0.35,
        }}
      />

      <div className="relative w-full h-full rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.12), rgba(148,163,184,0.15) 35%, rgba(15,23,42,0.85) 100%)',
            filter: 'blur(0.5px)',
          }}
        />

        <div
          className={`absolute inset-0 rounded-full mix-blend-screen ${styles.spin}`}
          style={{
            background: 'conic-gradient(from 180deg, rgba(56,189,248,0.18), rgba(192,132,252,0.2), rgba(244,114,182,0.22), rgba(34,211,238,0.18))',
            animationDuration: causticSpeed,
          }}
        />

        <div
          className={`absolute inset-[8%] rounded-full mix-blend-screen ${styles.wave}`}
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), rgba(255,255,255,0.05) 45%, rgba(14,116,144,0.55) 100%)',
            animationDuration: `${Math.max(4.2, 9 - analysis.volume * 4)}s`,
          }}
        />

        <div
          className="absolute inset-[5%] rounded-full"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: `inset 0 0 25px rgba(255,255,255,0.25), inset 0 0 ${35 + analysis.treble * 60}px rgba(255,255,255,0.15)`,
            opacity: 0.8,
          }}
        />

        <div
          className="absolute left-[26%] top-[18%] w-[18%] h-[13%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.8), rgba(255,255,255,0))',
            transform: `scale(${1 + analysis.volume * 0.1})`,
            filter: `blur(${5 + analysis.volume * 6}px)`,
          }}
        />
        <div
          className="absolute left-[45%] bottom-[20%] w-[12%] h-[9%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0))',
            filter: `blur(${4 + analysis.treble * 10}px)`,
          }}
        />
      </div>
    </div>
  );
}
