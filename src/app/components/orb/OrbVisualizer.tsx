"use client";

import { memo } from 'react';
import { BubbleOrb } from './themes/BubbleOrb';
import { HolographicOrb } from './themes/HolographicOrb';
import { RainbowWaveformOrb } from './themes/RainbowWaveformOrb';
import { SoapBubbleOrb } from './themes/SoapBubbleOrb';
import { LiquidGlassOrb } from './themes/LiquidGlassOrb';
import { OrbVisualizerProps, OrbTheme } from './types';

function OrbVisualizerComponent({ theme, state, analysis, size }: OrbVisualizerProps) {
  switch (theme) {
    case OrbTheme.LiquidGlass:
      return <LiquidGlassOrb analysis={analysis} state={state} size={size} />;
    case OrbTheme.Bubble:
      return <BubbleOrb analysis={analysis} state={state} size={size} />;
    case OrbTheme.RainbowWaveform:
      return <RainbowWaveformOrb analysis={analysis} state={state} size={size} />;
    case OrbTheme.Soap:
      return <SoapBubbleOrb analysis={analysis} state={state} size={size} />;
    case OrbTheme.Holographic:
    default:
      return <HolographicOrb analysis={analysis} state={state} size={size} />;
  }
}

export const OrbVisualizer = memo(OrbVisualizerComponent);
