"use client";

import { memo } from 'react';
import { BubbleOrb } from './themes/BubbleOrb';
import { HolographicOrb } from './themes/HolographicOrb';
import { RainbowWaveformOrb } from './themes/RainbowWaveformOrb';
import { SoapBubbleOrb } from './themes/SoapBubbleOrb';
import { OrbVisualizerProps, OrbTheme } from './types';

function OrbVisualizerComponent({ theme, state, analysis }: OrbVisualizerProps) {
  switch (theme) {
    case OrbTheme.Bubble:
      return <BubbleOrb analysis={analysis} state={state} />;
    case OrbTheme.RainbowWaveform:
      return <RainbowWaveformOrb analysis={analysis} state={state} />;
    case OrbTheme.Soap:
      return <SoapBubbleOrb analysis={analysis} state={state} />;
    case OrbTheme.Holographic:
    default:
      return <HolographicOrb analysis={analysis} state={state} />;
  }
}

export const OrbVisualizer = memo(OrbVisualizerComponent);
