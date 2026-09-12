"use client";

import { useEffect, useRef, useState } from 'react';
import { OrbAudioAnalysis, OrbState, ORB_STATE_LABELS } from '../types';
import { LIQUID_GLASS_FRAGMENT, LIQUID_GLASS_VERTEX } from './liquidGlassShader';
import styles from './liquidGlass.module.css';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

// Small shifts within the reference's blue/violet family, rather than replacing
// the entire orb with traffic-light colours when conversation state changes.
const ACCENTS: Record<OrbState, readonly [number, number, number]> = {
  [OrbState.Idle]: [0.43, 0.055, 1.0],
  [OrbState.Ready]: [0.40, 0.10, 1.0],
  [OrbState.Listening]: [0.24, 0.30, 1.0],
  [OrbState.Thinking]: [0.57, 0.07, 1.0],
  [OrbState.Speaking]: [0.40, 0.16, 1.0],
  [OrbState.Interrupted]: [0.66, 0.13, 0.88],
  [OrbState.Working]: [0.34, 0.25, 0.94],
};

export function LiquidGlassOrb({ analysis, state, size = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ analysis, state });
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    live.current = { analysis, state };
  }, [analysis, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    let frame = 0;
    let disposeRenderer: (() => void) | undefined;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const startRenderer = () => {
      const shaders: WebGLShader[] = [];
      const program = gl.createProgram();
      const buffer = gl.createBuffer();
      const release = () => {
        cancelAnimationFrame(frame);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        shaders.forEach((shader) => gl.deleteShader(shader));
      };
      if (!program || !buffer) { release(); return; }
      for (const [type, source] of [[gl.VERTEX_SHADER, LIQUID_GLASS_VERTEX], [gl.FRAGMENT_SHADER, LIQUID_GLASS_FRAGMENT]] as const) {
        const shader = gl.createShader(type);
        if (!shader) { release(); return; }
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('Liquid Glass shader could not compile:', gl.getShaderInfoLog(shader));
          release();
          return;
        }
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { release(); return; }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const uniforms = Object.fromEntries(['resolution', 'time', 'energy', 'bass', 'treble', 'accent'].map((name) => [name, gl.getUniformLocation(program, name)]));
      let previous = 0;
      let elapsed = 0;
      let volume = 0;
      let low = 0;
      let high = 0;
      const color: number[] = [...ACCENTS[live.current.state]];
      const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      const render = (now: number) => {
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
        previous = now;
        const blend = 1 - Math.exp(-dt * 12);
        const input = live.current.analysis;
        volume += (clamp(input.volume) - volume) * blend;
        low += (clamp(input.bass) - low) * blend;
        high += (clamp(input.treble) - high) * blend;
        const target = ACCENTS[live.current.state];
        color.forEach((value, i) => { color[i] = motion.matches ? target[i] : value + (target[i] - value) * (1 - Math.exp(-dt * 2)); });
        if (!motion.matches) elapsed += dt * (1 + volume * 0.8);
        const bounds = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(bounds.width * dpr));
        const height = Math.max(1, Math.round(bounds.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform1f(uniforms.time, motion.matches ? 0 : elapsed);
        gl.uniform1f(uniforms.energy, motion.matches ? 0 : volume);
        gl.uniform1f(uniforms.bass, motion.matches ? 0 : low);
        gl.uniform1f(uniforms.treble, motion.matches ? 0 : high);
        gl.uniform3f(uniforms.accent, color[0], color[1], color[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(render);
      };
      const visibility = () => {
        cancelAnimationFrame(frame);
        previous = 0;
        if (!document.hidden) frame = requestAnimationFrame(render);
      };
      document.addEventListener('visibilitychange', visibility);
      visibility();
      setAvailable(true);
      disposeRenderer = () => {
        document.removeEventListener('visibilitychange', visibility);
        release();
      };
    };
    const lost = (event: Event) => {
      event.preventDefault();
      disposeRenderer?.();
      disposeRenderer = undefined;
      setAvailable(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', startRenderer);
    startRenderer();
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', startRenderer);
      disposeRenderer?.();
    };
  }, []);

  return (
    <div className={styles.scene} style={{ width: size }} role="img" aria-label={`Liquid glass orb — ${ORB_STATE_LABELS[state]}`} data-state={state}>
      {!available && <div className={styles.fallback} aria-hidden="true" />}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
