export enum OrbState {
  Idle = 'idle',
  Ready = 'ready',
  Listening = 'listening',
  Thinking = 'thinking',
  Speaking = 'speaking',
  Interrupted = 'interrupted',
  Working = 'working',
}

export enum OrbTheme {
  Holographic = 'holographic',
  Bubble = 'bubble',
  RainbowWaveform = 'rainbowWaveform',
  Soap = 'soap',
  LiquidGlass = 'liquidGlass',
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
  size?: number;
}

export const ORB_THEME_ORDER: OrbTheme[] = [
  OrbTheme.LiquidGlass,
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
  [OrbTheme.LiquidGlass]: 'Liquid Glass',
};

export const ORB_STATE_LABELS: Record<OrbState, string> = {
  [OrbState.Idle]: 'Idle',
  [OrbState.Ready]: 'Ready',
  [OrbState.Listening]: 'Listening',
  [OrbState.Thinking]: 'Thinking',
  [OrbState.Speaking]: 'Speaking',
  [OrbState.Interrupted]: 'Interrupted',
  [OrbState.Working]: 'Working',
};
