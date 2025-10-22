export enum OrbState {
  Idle = 'idle',
  Ready = 'ready',
  Listening = 'listening',
  Thinking = 'thinking',
  Speaking = 'speaking',
  Interrupted = 'interrupted',
}

export enum OrbTheme {
  Holographic = 'holographic',
  Bubble = 'bubble',
  RainbowWaveform = 'rainbowWaveform',
  Soap = 'soap',
}

export interface OrbAudioAnalysis {
  volume: number;
  bass: number;
  mid: number;
  treble: number;
  waveform: Float32Array;
  peak: number;
  isActive: boolean;
}

export interface OrbVisualizerProps {
  theme: OrbTheme;
  state: OrbState;
  analysis: OrbAudioAnalysis;
}

export const ORB_THEME_ORDER: OrbTheme[] = [
  OrbTheme.Holographic,
  OrbTheme.Bubble,
  OrbTheme.RainbowWaveform,
  OrbTheme.Soap,
];

export const ORB_THEME_LABELS: Record<OrbTheme, string> = {
  [OrbTheme.Holographic]: 'Holographic',
  [OrbTheme.Bubble]: 'Bubble',
  [OrbTheme.RainbowWaveform]: 'Rainbow Waveform',
  [OrbTheme.Soap]: 'Soap Bubble',
};

export const ORB_STATE_LABELS: Record<OrbState, string> = {
  [OrbState.Idle]: 'Idle',
  [OrbState.Ready]: 'Ready',
  [OrbState.Listening]: 'Listening',
  [OrbState.Thinking]: 'Thinking',
  [OrbState.Speaking]: 'Speaking',
  [OrbState.Interrupted]: 'Interrupted',
};
