"use client";

import styles from '../orb.module.css';
import { OrbAudioAnalysis, OrbState } from '../types';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

const STATE_GLOW: Record<OrbState, string> = {
  [OrbState.Idle]: 'rgba(148, 163, 184, 0.4)',
  [OrbState.Ready]: 'rgba(59, 130, 246, 0.55)',
  [OrbState.Listening]: 'rgba(37, 99, 235, 0.65)',
  [OrbState.Thinking]: 'rgba(168, 85, 247, 0.6)',
  [OrbState.Speaking]: 'rgba(236, 72, 153, 0.65)',
  [OrbState.Interrupted]: 'rgba(249, 115, 22, 0.7)',
  [OrbState.Working]: 'rgba(34, 197, 94, 0.65)', // Green for working/tool execution
};

const BASE_SIZE = 220;

export function HolographicOrb({ analysis, state, size = BASE_SIZE }: Props) {
  const reactiveSize = size + analysis.bass * 50;
  const rotationDuration = `${Math.max(6, 18 - analysis.volume * 12)}s`;
  const secondaryRotation = `${Math.max(8, 22 - analysis.mid * 14)}s`;
  const glowColor = STATE_GLOW[state];
  const blurScale = 1 + analysis.volume * 0.04;

  return (
    <div
      className={`${styles.orbContainer} ${styles.floating}`}
      style={{
        width: reactiveSize,
        height: reactiveSize,
        transform: `scale(${1 + analysis.volume * 0.04})`,
      }}
    >
      <div
        className={styles.orbGlow}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(15, 23, 42, 0) 70%)`,
          transform: `scale(${1.2 + analysis.volume * 0.6})`,
          opacity: 0.45 + analysis.volume * 0.3,
        }}
      />

      <div
        className="relative aspect-square w-full rounded-full overflow-hidden"
        style={{
          boxShadow: `0 0 ${30 + analysis.volume * 40}px rgba(255,255,255,0.12)`,
        }}
      >
        <div
          className={`absolute inset-0 rounded-full ${styles.spin}`}
          style={{
            background: 'conic-gradient(from 90deg, rgba(255,255,255,0.05), rgba(15, 23, 42, 0.1), rgba(255,255,255,0.1), rgba(15, 23, 42, 0.05))',
            animationDuration: rotationDuration,
          }}
        />

        <div
          className={`absolute inset-0 rounded-full mix-blend-screen ${styles.spin}`}
          style={{
            background: 'conic-gradient(from 180deg, rgba(244,114,182,0.25) 0deg, rgba(129,140,248,0.35) 120deg, rgba(34,211,238,0.3) 240deg, rgba(244,114,182,0.25) 360deg)',
            animationDuration: secondaryRotation,
          }}
        />

        <div
          className="absolute inset-[10%] rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.65), rgba(255,255,255,0.1) 45%, rgba(15, 23, 42, 0.85) 100%)',
            filter: `saturate(${1.5 + analysis.treble * 1.8}) blur(${3 + analysis.mid * 4}px)`,
          }}
        />

        <div
          className={`${styles.glassOverlay} ${styles.pulse}`}
          style={{
            background: 'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%)',
            animationDuration: `${Math.max(2.8, 5.5 - analysis.volume * 3)}s`,
            transform: `scale(${1 + analysis.volume * 0.03})`,
          }}
        />

        <div
          className="absolute bottom-[18%] right-[24%] w-[18%] h-[14%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.7), rgba(255,255,255,0))',
            filter: `blur(${8 * blurScale}px)`,
          }}
        />
      </div>
    </div>
  );
}
