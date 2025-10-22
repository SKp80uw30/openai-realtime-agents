"use client";

import { useEffect, useRef } from 'react';
import styles from '../orb.module.css';
import { OrbAudioAnalysis, OrbState } from '../types';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

const STATE_GLOW: Record<OrbState, string> = {
  [OrbState.Idle]: 'rgba(148, 163, 184, 0.35)',
  [OrbState.Ready]: 'rgba(34, 197, 94, 0.45)',
  [OrbState.Listening]: 'rgba(94, 234, 212, 0.55)',
  [OrbState.Thinking]: 'rgba(129, 140, 248, 0.55)',
  [OrbState.Speaking]: 'rgba(249, 115, 22, 0.6)',
  [OrbState.Interrupted]: 'rgba(248, 113, 113, 0.65)',
};

const BASE_SIZE = 260;

function renderWaveform(canvas: HTMLCanvasElement, analysis: OrbAudioAnalysis) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2;

  ctx.clearRect(0, 0, width, height);

  const waveform = analysis.waveform;
  const total = waveform.length;
  const bars = 120;
  const step = Math.floor(total / bars);

  for (let i = 0; i < bars; i += 1) {
    const idx = i * step;
    const sample = waveform[idx] ?? 0;
    const amplitude = Math.min(1, Math.abs(sample) * 3.2);
    const radius = maxRadius * (0.52 + amplitude * 0.35);

    const angle = (i / bars) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const startRadius = maxRadius * (0.32 + amplitude * 0.1);
    const startX = centerX + Math.cos(angle) * startRadius;
    const startY = centerY + Math.sin(angle) * startRadius;

    const hue = (i / bars) * 360;
    const alpha = 0.35 + analysis.volume * 0.45;

    ctx.strokeStyle = `hsla(${hue}, 85%, ${60 + analysis.treble * 20}%, ${alpha})`;
    ctx.lineWidth = 2 + amplitude * 3.2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

export function RainbowWaveformOrb({ analysis, state, size = BASE_SIZE }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderWaveform(canvas, analysis);
  }, [analysis]);

  const glowColor = STATE_GLOW[state];

  return (
    <div
      className={styles.orbContainer}
      style={{
        width: size,
        height: size,
        transform: `scale(${1 + analysis.volume * 0.06})`,
      }}
    >
      <div
        className={styles.orbGlow}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(15, 23, 42, 0) 65%)`,
          transform: `scale(${1.6 + analysis.volume * 0.9})`,
          opacity: 0.3 + analysis.volume * 0.45,
        }}
      />

      <div className="relative w-full h-full rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(30,64,175,0.35), rgba(15,23,42,0.9))',
          }}
        />
        <div
          className="absolute inset-[12%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.95))',
            boxShadow: 'inset 0 0 35px rgba(0,0,0,0.35)',
          }}
        />

        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className="absolute inset-[8%]"
          style={{ filter: `blur(${1.5 + analysis.mid * 3}px)` }}
        />

        <div
          className={`${styles.glassOverlay} ${styles.pulse}`}
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%)',
            animationDuration: `${Math.max(2.2, 5 - analysis.volume * 3.4)}s`,
          }}
        />
      </div>
    </div>
  );
}
