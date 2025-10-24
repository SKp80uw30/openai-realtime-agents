"use client";

import styles from '../orb.module.css';
import { OrbAudioAnalysis, OrbState } from '../types';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

const STATE_STYLE: Record<
  OrbState,
  {
    glow: string;
    core: string;
    caustic: string;
    rim: string;
    highlight: string;
  }
> = {
  [OrbState.Idle]: {
    glow: 'rgba(148, 163, 184, 0.4)',
    core: 'rgba(148, 163, 184, 0.55)',
    caustic: 'rgba(191, 219, 254, 0.45)',
    rim: 'rgba(226, 232, 240, 0.35)',
    highlight: 'rgba(255, 255, 255, 0.7)',
  },
  [OrbState.Ready]: {
    glow: 'rgba(34, 211, 238, 0.55)',
    core: 'rgba(56, 189, 248, 0.6)',
    caustic: 'rgba(165, 243, 252, 0.55)',
    rim: 'rgba(125, 211, 252, 0.42)',
    highlight: 'rgba(240, 249, 255, 0.8)',
  },
  [OrbState.Listening]: {
    glow: 'rgba(59, 130, 246, 0.55)',
    core: 'rgba(96, 165, 250, 0.6)',
    caustic: 'rgba(191, 219, 254, 0.6)',
    rim: 'rgba(147, 197, 253, 0.45)',
    highlight: 'rgba(244, 249, 255, 0.85)',
  },
  [OrbState.Thinking]: {
    glow: 'rgba(168, 85, 247, 0.55)',
    core: 'rgba(147, 51, 234, 0.58)',
    caustic: 'rgba(196, 181, 253, 0.6)',
    rim: 'rgba(216, 180, 254, 0.48)',
    highlight: 'rgba(243, 232, 255, 0.85)',
  },
  [OrbState.Speaking]: {
    glow: 'rgba(236, 72, 153, 0.6)',
    core: 'rgba(244, 114, 182, 0.6)',
    caustic: 'rgba(251, 207, 232, 0.55)',
    rim: 'rgba(251, 191, 217, 0.5)',
    highlight: 'rgba(255, 240, 248, 0.85)',
  },
  [OrbState.Interrupted]: {
    glow: 'rgba(249, 115, 22, 0.65)',
    core: 'rgba(251, 146, 60, 0.6)',
    caustic: 'rgba(254, 215, 170, 0.55)',
    rim: 'rgba(253, 186, 116, 0.52)',
    highlight: 'rgba(255, 247, 237, 0.85)',
  },
  [OrbState.Working]: {
    glow: 'rgba(34, 197, 94, 0.65)',
    core: 'rgba(74, 222, 128, 0.62)',
    caustic: 'rgba(187, 247, 208, 0.55)',
    rim: 'rgba(163, 230, 184, 0.5)',
    highlight: 'rgba(240, 253, 244, 0.85)',
  },
};

const BASE_SIZE = 240;

export function BubbleOrb({ analysis, state, size = BASE_SIZE }: Props) {
  const reactiveSize = size + analysis.volume * 60;
  const causticSpeed = `${Math.max(6, 14 - analysis.mid * 10)}s`;
  const swirlSpeed = `${Math.max(8, 18 - analysis.volume * 7)}s`;
  const { glow, core, caustic, rim, highlight } = STATE_STYLE[state];
  const swirlBlur = Math.max(4.5, 9 - analysis.volume * 3.2);
  const waveBlur = Math.max(5.5, 12 - analysis.mid * 4.5);
  const baseHighlight = 0.2 + analysis.treble * 0.25;
  const bassGlow = 0.55 + analysis.bass * 0.35;

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
          background: `radial-gradient(circle, ${glow} 0%, rgba(15, 23, 42, 0) 72%)`,
          transform: `scale(${1.45 + analysis.volume * 0.85})`,
          opacity: 0.4 + analysis.volume * 0.4,
        }}
      />

      <div className="relative w-full h-full rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `
              radial-gradient(circle at 50% 18%, rgba(255, 255, 255, ${0.18 + baseHighlight}), rgba(255, 255, 255, 0) 42%),
              radial-gradient(circle at 52% 82%, ${core}, rgba(15, 23, 42, 0.96) 70%),
              radial-gradient(circle, rgba(10, 17, 38, 0.95), rgba(8, 11, 24, 1))
            `,
            backgroundBlendMode: 'screen, screen, normal',
            filter: `blur(${1 + analysis.volume * 0.6}px)`,
          }}
        />

        <div
          className={`absolute inset-0 rounded-full mix-blend-screen ${styles.spin}`}
          style={{
            background: `
              radial-gradient(circle at ${32 + analysis.mid * 12}% ${30 - analysis.treble * 10}%, ${highlight}, rgba(255, 255, 255, 0) 48%),
              radial-gradient(circle at ${66 - analysis.mid * 8}% ${72 + analysis.bass * 10}%, ${caustic}, rgba(255, 255, 255, 0) 55%),
              radial-gradient(circle at ${48 + analysis.volume * 6}% ${90 - analysis.bass * 18}%, rgba(129, 140, 248, 0.35), rgba(15, 23, 42, 0) 68%)
            `,
            backgroundBlendMode: 'screen',
            animationDuration: causticSpeed,
            filter: `blur(${swirlBlur}px)`,
            transform: `scale(${1.04 + analysis.volume * 0.04})`,
            opacity: 0.85,
          }}
        />

        <div
          className={`absolute inset-[-4%] rounded-full mix-blend-screen ${styles.wave}`}
          style={{
            background: `
              conic-gradient(from ${75 + analysis.mid * 50}deg at 50% 50%, rgba(15, 23, 42, 0) 0deg, ${caustic} 120deg, rgba(15, 23, 42, 0) 260deg),
              radial-gradient(circle at 50% 84%, ${core}, rgba(15, 23, 42, 0) 60%)
            `,
            backgroundBlendMode: 'screen',
            animationDuration: swirlSpeed,
            filter: `blur(${waveBlur}px)`,
            opacity: 0.65 + analysis.volume * 0.2,
          }}
        />

        <div
          className="absolute inset-[5%] rounded-full"
          style={{
            border: `1.5px solid ${rim}`,
            boxShadow: `inset 0 0 ${18 + analysis.volume * 26}px ${rim}, inset 0 0 ${58 + analysis.treble * 70}px rgba(255, 255, 255, 0.18)` ,
            opacity: 0.82,
          }}
        />

        <div
          className={`absolute inset-0 rounded-full ${styles.glassOverlay}`}
          style={{
            background: `
              radial-gradient(circle at 28% 24%, ${highlight}, rgba(255, 255, 255, 0) 58%),
              radial-gradient(circle at 72% 68%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 62%)
            `,
            opacity: 0.82,
          }}
        />

        <div
          className="absolute left-[18%] top-[18%] w-[30%] h-[18%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0))',
            filter: `blur(${5 + analysis.treble * 4}px)`,
            transform: `rotate(${(-6 + analysis.mid * 12)}deg) scale(${1 + analysis.volume * 0.05})`,
            opacity: 0.88,
          }}
        />

        <div
          className="absolute left-[54%] top-[34%] w-[20%] h-[12%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0))',
            filter: 'blur(4px)',
            opacity: 0.65,
          }}
        />

        <div
          className="absolute left-1/2 bottom-[14%] w-[46%] h-[32%] rounded-[50%] -translate-x-1/2"
          style={{
            background: `radial-gradient(circle at 50% 68%, ${caustic}, rgba(15, 23, 42, 0) 72%)`,
            filter: `blur(${8 + analysis.bass * 9}px)`,
            opacity: bassGlow,
          }}
        />

        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `inset 0 0 ${22 + analysis.volume * 20}px rgba(255, 255, 255, 0.07)` ,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />
      </div>
    </div>
  );
}
