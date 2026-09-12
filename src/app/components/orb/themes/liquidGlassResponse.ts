import { OrbAudioAnalysis, OrbState } from '../types';

type Color = readonly [number, number, number];

export interface LiquidGlassProfile {
  accent: Color;
  ribbon: Color;
  speed: number;
  breath: number;
  pulseRate: number;
  glow: number;
  warp: number;
  scale: number;
  fallbackHue: number;
}

// Keep the approved idle composition. Conversation cues change the light and
// flow within the glass, not its silhouette or material.
export const LIQUID_GLASS_PROFILES: Record<OrbState, LiquidGlassProfile> = {
  [OrbState.Idle]: {
    accent: [0.43, 0.055, 1], ribbon: [0, 0.69, 1], speed: 0.75,
    breath: 0.006, pulseRate: 1.15, glow: 0, warp: 0, scale: 0, fallbackHue: 0,
  },
  [OrbState.Ready]: {
    accent: [0.35, 0.15, 1], ribbon: [0.05, 0.8, 1], speed: 1,
    breath: 0.009, pulseRate: 1.4, glow: 0.10, warp: 0.015, scale: 0, fallbackHue: -8,
  },
  [OrbState.Listening]: {
    accent: [0.22, 0.40, 1], ribbon: [0.08, 0.95, 1], speed: 1.35,
    breath: 0.014, pulseRate: 2.1, glow: 0.20, warp: 0.04, scale: 0.01, fallbackHue: -22,
  },
  [OrbState.Thinking]: {
    accent: [0.70, 0.12, 1], ribbon: [0.33, 0.47, 1], speed: 1.75,
    breath: 0.013, pulseRate: 2.7, glow: 0.17, warp: 0.075, scale: 0, fallbackHue: 22,
  },
  [OrbState.Speaking]: {
    accent: [0.54, 0.18, 1], ribbon: [0.20, 0.86, 1], speed: 1.4,
    breath: 0.01, pulseRate: 1.8, glow: 0.18, warp: 0.035, scale: 0.005, fallbackHue: 5,
  },
  [OrbState.Interrupted]: {
    accent: [0.92, 0.25, 0.72], ribbon: [0.52, 0.53, 1], speed: 0.45,
    breath: 0.004, pulseRate: 1.3, glow: 0.12, warp: 0.015, scale: -0.018, fallbackHue: 40,
  },
  [OrbState.Working]: {
    accent: [0.32, 0.50, 0.96], ribbon: [0.08, 0.92, 0.86], speed: 2,
    breath: 0.018, pulseRate: 3.2, glow: 0.22, warp: 0.09, scale: 0.004, fallbackHue: -30,
  },
};

export function clampOrbSignal(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function getLiquidGlassAudio(analysis: OrbAudioAnalysis) {
  let squares = 0;
  for (const sample of analysis.waveform) {
    const finite = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    squares += finite * finite;
  }
  const rms = Math.sqrt(squares / Math.max(1, analysis.waveform.length));
  const amplitude = Math.max(clampOrbSignal(analysis.volume), clampOrbSignal(rms / 0.35));
  const peak = clampOrbSignal(analysis.peak);
  // The analyser normalises full-scale RMS to 0.35. Normal conversation often
  // occupies only a small fraction of that range. A soft gain curve preserves
  // syllable dynamics while making quiet speech visible; silence stays zero.
  const energy = clampOrbSignal(Math.pow(Math.max(0, amplitude - 0.003), 0.65) * 1.9 + peak * 0.16);
  return {
    energy,
    bass: clampOrbSignal(analysis.bass),
    mid: clampOrbSignal(analysis.mid),
    treble: clampOrbSignal(analysis.treble),
  };
}
