"use client";

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { OrbVisualizer } from '@/app/components/orb/OrbVisualizer';
import {
  ORB_THEME_LABELS,
  ORB_THEME_ORDER,
  ORB_STATE_LABELS,
  OrbTheme,
} from '@/app/components/orb/types';
import { useOrbAudioAnalysis } from '@/app/components/orb/hooks/useOrbAudioAnalysis';
import { useOrbConversationState } from '@/app/components/orb/hooks/useOrbConversationState';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useEvent } from '@/app/contexts/EventContext';
import { createModerationGuardrail } from '@/app/agentConfigs/guardrails';
import {
  personalAssistantScenario,
  personalAssistantCompanyName,
} from '@/app/agentConfigs/personalAssistant';
import type { McpServerConfig, McpServerRequestPayload } from '@/app/types/mcp';
import GoogleWorkspaceConnector from './GoogleWorkspaceConnector';

const STORAGE_KEY = 'mcpServers:personalAssistant';
const DEFAULT_THEME = OrbTheme.Holographic;

function aggregateTools(servers: McpServerConfig[]): number {
  return servers.reduce((sum, server) => sum + (server.tools?.length ?? 0), 0);
}

export default function OrbShowcase() {
  const { addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [theme, setTheme] = useState<OrbTheme>(DEFAULT_THEME);
  const [showToolOverlay, setShowToolOverlay] = useState(false);
  const [activeMcpServers, setActiveMcpServers] = useState<McpServerConfig[]>([]);
  const [areMcpServersReady, setAreMcpServersReady] = useState(false);

  const [sdkAudioElement, setSdkAudioElement] = useState<HTMLAudioElement | undefined>(undefined);

  const {
    status: sessionStatus,
    connect,
    disconnect,
    sendEvent,
    mute,
  } = useRealtimeSession();

  const conversationState = useOrbConversationState({ sessionStatus });
  const analysis = useOrbAudioAnalysis({ audioElement: sdkAudioElement, enabled: sessionStatus === 'CONNECTED' });

  const totalTools = aggregateTools(activeMcpServers);

  const toolLabel = !areMcpServersReady
    ? 'Loading tools…'
    : totalTools > 0
      ? `${totalTools} tool${totalTools === 1 ? '' : 's'}`
      : 'No tools connected';

  const sessionIndicator = useMemo(() => {
    const base: { label: string; color: string } = {
      label: 'Standby',
      color: 'bg-slate-700/80 text-slate-100 border-slate-500/60',
    };

    if (sessionStatus === 'CONNECTING') {
      return {
        label: 'Connecting…',
        color: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
      };
    }
    if (sessionStatus === 'CONNECTED') {
      return {
        label: 'Live',
        color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
      };
    }
    return base;
  }, [sessionStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    setSdkAudioElement(el);

    return () => {
      el.pause();
      el.srcObject = null;
      document.body.removeChild(el);
      setSdkAudioElement(undefined);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: McpServerConfig[] = JSON.parse(stored);
        const normalised = parsed.map((server) => ({
          ...server,
          headers: (server.headers || []).map((header) => ({
            ...header,
            id: header.id ?? uuidv4(),
          })),
          status: server.status ?? 'connected',
          tools: server.tools ?? [],
        }));
        setActiveMcpServers(normalised);
      } catch (error) {
        console.warn('Failed to parse stored MCP servers', error);
        setActiveMcpServers([]);
      }
    }
    setAreMcpServersReady(true);
  }, []);

  useEffect(() => {
    if (!areMcpServersReady || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeMcpServers));
  }, [activeMcpServers, areMcpServersReady]);

  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(false);
        sendEvent({
          type: 'session.update',
          session: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.9,
              prefix_padding_ms: 250,
              silence_duration_ms: 450,
              create_response: true,
            },
          },
        });
      } catch (error) {
        console.warn('Failed to push orb session update', error);
      }
    }
  }, [sessionStatus, mute, sendEvent]);

  const fetchEphemeralKey = useCallback(async (servers: McpServerConfig[]) => {
    const eligibleServers = servers.filter((server) => server.status !== 'error');

    const payload = {
      mcpServers: eligibleServers.map<McpServerRequestPayload>((server) => ({
        label: server.label,
        server_url: server.serverUrl,
        headers: server.headers?.reduce<Record<string, string>>((acc, header) => {
          if (header.key) acc[header.key] = header.value;
          return acc;
        }, {}),
        allowed_tools: server.allowedTools && server.allowedTools.length
          ? { tool_names: server.allowedTools }
          : undefined,
      })),
    };

    logClientEvent(payload, 'fetch_session_token_request');

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      logServerEvent(data, 'fetch_session_token_response');

      if (!response.ok) {
        console.error('Failed to create realtime session', data);
        return null;
      }

      if (!data.client_secret?.value) {
        console.error('No ephemeral key provided by the server');
        return null;
      }

      return data.client_secret.value as string;
    } catch (error) {
      console.error('Error fetching ephemeral key', error);
      return null;
    }
  }, [logClientEvent, logServerEvent]);

  const connectToRealtime = useCallback(async () => {
    if (sessionStatus !== 'DISCONNECTED') {
      return;
    }

    if (!sdkAudioElement) {
      console.warn('Audio element not ready yet');
      return;
    }

    const key = await fetchEphemeralKey(activeMcpServers);
    if (!key) {
      return;
    }

    const guardrail = createModerationGuardrail(personalAssistantCompanyName);

    try {
      await connect({
        getEphemeralKey: async () => key,
        initialAgents: personalAssistantScenario,
        audioElement: sdkAudioElement,
        extraContext: {
          addTranscriptBreadcrumb,
        },
        outputGuardrails: [guardrail],
      });
    } catch (error) {
      console.error('Unable to start realtime session', error);
    }
  }, [sessionStatus, fetchEphemeralKey, activeMcpServers, connect, sdkAudioElement, addTranscriptBreadcrumb]);

  const handleToggleConnection = async () => {
    if (sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING') {
      disconnect();
      return;
    }
    await connectToRealtime();
  };

  const currentThemeIndex = ORB_THEME_ORDER.indexOf(theme);
  const themeLabel = ORB_THEME_LABELS[theme];

  const goToNextTheme = () => {
    const nextIndex = (currentThemeIndex + 1) % ORB_THEME_ORDER.length;
    setTheme(ORB_THEME_ORDER[nextIndex]);
  };

  const goToPreviousTheme = () => {
    const prevIndex = (currentThemeIndex - 1 + ORB_THEME_ORDER.length) % ORB_THEME_ORDER.length;
    setTheme(ORB_THEME_ORDER[prevIndex]);
  };

  const stateLabel = ORB_STATE_LABELS[conversationState];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(168,85,247,0.08),transparent_55%)]" />

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-start justify-between px-6 pt-8">
          <button
            type="button"
            onClick={() => setShowToolOverlay(true)}
            className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:border-cyan-300/60 hover:bg-cyan-500/15 transition"
          >
            {toolLabel}
          </button>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200/15 bg-slate-800/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200/90">
              {stateLabel}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${sessionIndicator.color}`}
            >
              {sessionIndicator.label}
            </span>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-16">
          <div className="relative">
            <OrbVisualizer theme={theme} state={conversationState} analysis={analysis} />

            <div className="absolute inset-x-0 -bottom-16 flex justify-center">
              <button
                type="button"
                onClick={handleToggleConnection}
                className="rounded-full border border-slate-200/20 bg-slate-900/70 px-6 py-2 text-sm font-semibold text-slate-100 shadow-[0_12px_24px_rgba(15,23,42,0.45)] hover:bg-slate-800/70 transition backdrop-blur"
              >
                {sessionStatus === 'CONNECTED' ? 'Disconnect' : sessionStatus === 'CONNECTING' ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>

        </main>

        <footer className="pointer-events-none absolute bottom-10 left-0 right-0 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-6 rounded-full border border-slate-200/20 bg-slate-900/70 px-6 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.45)] backdrop-blur">
            <button
              type="button"
              onClick={goToPreviousTheme}
              className="rounded-full border border-slate-200/20 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/70 transition"
            >
              ←
            </button>
            <div className="text-center">
              <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">Theme</p>
              <p className="text-base font-semibold text-slate-100">{themeLabel}</p>
            </div>
            <button
              type="button"
              onClick={goToNextTheme}
              className="rounded-full border border-slate-200/20 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/70 transition"
            >
              →
            </button>
          </div>
        </footer>
      </div>

      {showToolOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
          <GoogleWorkspaceConnector
            servers={activeMcpServers}
            onClose={() => setShowToolOverlay(false)}
            onConnected={(serversWithWorkspace) => setActiveMcpServers(serversWithWorkspace)}
          />
        </div>
      )}
    </div>
  );
}
