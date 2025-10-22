"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbAudioAnalysis } from '../types';

type UseOrbAudioAnalysisOptions = {
  audioElement?: HTMLAudioElement | null;
  enabled: boolean;
};

const DEFAULT_ANALYSIS: OrbAudioAnalysis = {
  volume: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  waveform: new Float32Array(1024),
  peak: 0,
  isActive: false,
};

function normalise(value: number, max = 1): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
}

export function useOrbAudioAnalysis({ audioElement, enabled }: UseOrbAudioAnalysisOptions): OrbAudioAnalysis {
  const [analysis, setAnalysis] = useState<OrbAudioAnalysis>(DEFAULT_ANALYSIS);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const previousPeakRef = useRef(0);

  const waveformBuffer = useMemo(() => new Float32Array(1024), []);
  const frequencyBuffer = useMemo(() => new Uint8Array(1024), []);

  useEffect(() => {
    if (!enabled || !audioElement) {
      setAnalysis(DEFAULT_ANALYSIS);
      return () => {};
    }

    const ensureAudioContext = () => {
      if (audioContextRef.current) return audioContextRef.current;
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctor({ latencyHint: 'interactive' });
      audioContextRef.current = ctx;
      return ctx;
    };

    const attachStream = () => {
      const mediaStream = audioElement.srcObject as MediaStream | null;
      if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
        return false;
      }

      const ctx = ensureAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const sourceNode = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      sourceNode.connect(analyser);

      sourceRef.current = sourceNode;
      analyserRef.current = analyser;

      const update = () => {
        const analyserNode = analyserRef.current;
        if (!analyserNode) return;

        analyserNode.getFloatTimeDomainData(waveformBuffer);
        analyserNode.getByteFrequencyData(frequencyBuffer);

        let sumSquares = 0;
        let peak = 0;
        for (let i = 0; i < waveformBuffer.length; i += 1) {
          const sample = waveformBuffer[i];
          sumSquares += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        const rms = Math.sqrt(sumSquares / waveformBuffer.length);
        const volume = normalise(rms, 0.35);

        const bandSize = frequencyBuffer.length;
        const bassEnd = Math.floor(bandSize * 0.08);
        const midEnd = Math.floor(bandSize * 0.35);
        const trebleEnd = Math.floor(bandSize * 0.7);

        const averageRange = (start: number, end: number) => {
          let total = 0;
          const count = Math.max(1, end - start);
          for (let i = start; i < end; i += 1) {
            total += frequencyBuffer[i];
          }
          return total / (count * 255);
        };

        const bass = normalise(averageRange(0, bassEnd) * 1.4);
        const mid = normalise(averageRange(bassEnd, midEnd) * 1.2);
        const treble = normalise(averageRange(midEnd, trebleEnd) * 1.1);

        const peakSmoothed = Math.max(peak, previousPeakRef.current * 0.85);
        previousPeakRef.current = peakSmoothed;

        setAnalysis({
          volume,
          bass,
          mid,
          treble,
          waveform: waveformBuffer.slice(),
          peak: peakSmoothed,
          isActive: volume > 0.02 || peakSmoothed > 0.04,
        });

        rafRef.current = requestAnimationFrame(update);
      };

      rafRef.current = requestAnimationFrame(update);
      return true;
    };

    const tryAttach = () => {
      if (attachStream()) return () => {};
      const listener = () => {
        attachStream();
      };
      audioElement.addEventListener('playing', listener, { once: true });
      audioElement.addEventListener('loadeddata', listener, { once: true });
      return () => {
        audioElement.removeEventListener('playing', listener);
        audioElement.removeEventListener('loadeddata', listener);
      };
    };

    const detach = tryAttach();

    return () => {
      if (detach) detach();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [audioElement, enabled, frequencyBuffer, waveformBuffer]);

  return analysis;
}
