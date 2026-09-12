"use client";

import { useEffect, useRef } from 'react';
import { OrbAudioAnalysis, OrbState, ORB_STATE_LABELS } from '../types';
import { LIQUID_GLASS_FRAGMENT, LIQUID_GLASS_VERTEX } from './liquidGlassShader';
import { getLiquidGlassAudio, LIQUID_GLASS_PROFILES } from './liquidGlassResponse';
import styles from './liquidGlass.module.css';

interface Props {
  analysis: OrbAudioAnalysis;
  state: OrbState;
  size?: number;
}

export function LiquidGlassOrb({ analysis, state, size = 420 }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ analysis, state });

  useEffect(() => {
    live.current = { analysis, state };
  }, [analysis, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    let frame = 0;
    let draw: ((values: Record<string, number>, accent: number[], ribbon: number[]) => void) | undefined;
    let disposeRenderer: (() => void) | undefined;

    const startRenderer = () => {
      if (!gl) return;
      const shaders: WebGLShader[] = [];
      const program = gl.createProgram();
      const buffer = gl.createBuffer();
      const release = () => {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        shaders.forEach((shader) => gl.deleteShader(shader));
      };
      if (!program || !buffer) { release(); return; }
      for (const [type, source] of [[gl.VERTEX_SHADER, LIQUID_GLASS_VERTEX], [gl.FRAGMENT_SHADER, LIQUID_GLASS_FRAGMENT]] as const) {
        const shader = gl.createShader(type);
        if (!shader) { release(); return; }
        shaders.push(shader);
        // Some WebGL 1 mobile GPUs do not support highp in fragment shaders.
        const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision;
        gl.shaderSource(shader, highp ? source : source.replace('precision highp float;', 'precision mediump float;'));
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('Liquid Glass uses its CSS renderer:', gl.getShaderInfoLog(shader));
          release();
          return;
        }
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Liquid Glass uses its CSS renderer:', gl.getProgramInfoLog(program));
        release();
        return;
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const names = ['resolution', 'time', 'energy', 'bass', 'mid', 'treble', 'accent', 'ribbon', 'pulse', 'stateGlow', 'warp', 'stateScale', 'motion'];
      const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
      draw = (values, accent, ribbon) => {
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
        for (const [name, value] of Object.entries(values)) gl.uniform1f(uniforms[name], value);
        gl.uniform3fv(uniforms.accent, accent);
        gl.uniform3fv(uniforms.ribbon, ribbon);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      scene.dataset.renderer = 'webgl';
      disposeRenderer = release;
    };

    // One driver for both renderers. Losing WebGL must not disconnect the orb
    // from the conversation, and changing state must not restart its animation.
    let previous = 0;
    let elapsed = 0;
    let pulsePhase = 0;
    const audio = { energy: 0, bass: 0, mid: 0, treble: 0 };
    const initial = LIQUID_GLASS_PROFILES[live.current.state];
    const profile = { ...initial, accent: [...initial.accent], ribbon: [...initial.ribbon] };
    const render = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      const targetAudio = getLiquidGlassAudio(live.current.analysis);
      for (const key of ['energy', 'bass', 'mid', 'treble'] as const) {
        // Fast attack follows syllables; a softer release prevents jitter.
        const rate = targetAudio[key] > audio[key] ? 32 : 7;
        audio[key] += (targetAudio[key] - audio[key]) * (1 - Math.exp(-dt * rate));
      }
      const target = LIQUID_GLASS_PROFILES[live.current.state];
      const blend = 1 - Math.exp(-dt * 4);
      for (const key of ['speed', 'breath', 'pulseRate', 'glow', 'warp', 'scale', 'fallbackHue'] as const) {
        profile[key] += (target[key] - profile[key]) * blend;
      }
      for (let i = 0; i < 3; i += 1) {
        profile.accent[i] += (target.accent[i] - profile.accent[i]) * blend;
        profile.ribbon[i] += (target.ribbon[i] - profile.ribbon[i]) * blend;
      }
      const moving = !motion.matches;
      if (moving) {
        elapsed += dt * (profile.speed + audio.energy * 1.8 + audio.mid * 0.45);
        pulsePhase += dt * profile.pulseRate;
      }
      const pulse = moving ? Math.sin(pulsePhase) * profile.breath : 0;
      // Reduced motion stops displacement, but retains a restrained change of
      // light with speech and state. It must not look disconnected.
      const energy = audio.energy * (moving ? 1 : 0.35);
      const values = {
        time: moving ? elapsed : 0, energy, bass: audio.bass, mid: audio.mid,
        treble: audio.treble, pulse, stateGlow: profile.glow,
        warp: profile.warp, stateScale: profile.scale, motion: moving ? 1 : 0,
      };
      if (draw) {
        draw(values, profile.accent, profile.ribbon);
      } else {
        scene.style.setProperty('--orb-scale', String(moving ? 1 + profile.scale + pulse + energy * 0.085 : 1));
        scene.style.setProperty('--orb-light', String(1 + profile.glow + energy * 0.6));
        scene.style.setProperty('--orb-hue', `${profile.fallbackHue}deg`);
        scene.style.setProperty('--orb-flow', `${moving ? Math.sin(elapsed * 0.45) * 12 : 0}%`);
        scene.style.setProperty('--orb-lift', `${moving ? Math.sin(elapsed * 0.85) * 2 : 0}px`);
      }
      frame = requestAnimationFrame(render);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(render);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      draw = undefined;
      disposeRenderer?.();
      disposeRenderer = undefined;
      scene.dataset.renderer = 'css';
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', startRenderer);
    document.addEventListener('visibilitychange', visibility);
    startRenderer();
    visibility();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', startRenderer);
      disposeRenderer?.();
    };
  }, []);

  return (
    <div ref={sceneRef} className={styles.scene} style={{ width: size }} role="img" aria-label={`Liquid glass orb — ${ORB_STATE_LABELS[state]}`} data-state={state}>
      <div className={styles.fallback} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
