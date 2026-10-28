"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSession, signIn, signOut } from 'next-auth/react';

import { OrbVisualizer } from '@/app/components/orb/OrbVisualizer';
import {
  ORB_THEME_LABELS,
  ORB_THEME_ORDER,
  ORB_STATE_LABELS,
  OrbState,
  OrbTheme,
} from '@/app/components/orb/types';
import { useOrbAudioAnalysis } from '@/app/components/orb/hooks/useOrbAudioAnalysis';
import { useOrbConversationState } from '@/app/components/orb/hooks/useOrbConversationState';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useEvent } from '@/app/contexts/EventContext';
import { createModerationGuardrail } from '@/app/agentConfigs/guardrails';
import {
  createPersonalAssistantScenario,
  personalAssistantCompanyName,
} from '@/app/agentConfigs/personalAssistant';
import type { McpRequireApproval, McpServerConfig, McpServerRequestPayload } from '@/app/types/mcp';
import { ONBOARDING_STAGE } from '@/app/types/onboarding';
import type { OnboardingStage } from '@/app/types/onboarding';
import { classifyGmailToolCompletion } from '@/app/agentConfigs/emailAgent/toolCompletionClassifier';
import { classifyIrreversibleGmailAction } from '@/app/agentConfigs/emailAgent/irreversibleActions';
import { STAGE_LABELS } from '@/app/agentConfigs/emailAgent';
import ToolsOverlay from './ToolsOverlay';
import MicButton from './MicButton';
import SettingsMenu from './SettingsMenu';
import { useOnboarding } from './onboarding/useOnboarding';
import CapabilityChecklist from './onboarding/CapabilityChecklist';

const STORAGE_KEY = 'mcpServers:personalAssistant';
const DEFAULT_THEME = OrbTheme.LiquidGlass;
// Liquid Glass is the only theme we want users to see for now — the other
// themes stay in the codebase, but the switcher that exposes them is hidden.
const SHOW_THEME_SWITCHER = false;

function aggregateTools(servers: McpServerConfig[]): number {
  return servers.reduce((sum, server) => sum + (server.tools?.length ?? 0), 0);
}

// Gates send/delete Gmail tool calls behind explicit approval (see
// useRealtimeSession.ts's mcp_approval_request handling), while everything
// else on the server keeps auto-executing as before. Returns undefined
// (server-side default 'never' — no gating) if this server's tool list isn't
// known yet or contains nothing irreversible to gate.
function computeRequireApproval(server: McpServerConfig): McpRequireApproval | undefined {
  const toolNames = (server.tools ?? []).map((tool) => tool.name);
  if (toolNames.length === 0) return undefined;

  const always: string[] = [];
  const never: string[] = [];
  for (const name of toolNames) {
    if (classifyIrreversibleGmailAction(name)) {
      always.push(name);
    } else {
      never.push(name);
    }
  }

  if (always.length === 0) return undefined;
  return { always: { tool_names: always }, never: { tool_names: never } };
}

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const LANDING_CAPABILITIES: { label: string; icon: React.ReactNode }[] = [
  {
    label: 'Gmail',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 6 10 7 10-7" />
      </svg>
    ),
  },
  {
    label: 'Calendar',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    label: 'Drive',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 2 2 12l4 8h12l4-8-6-10z" />
        <path d="M6 20 12 10l6 10" />
      </svg>
    ),
  },
];

export default function OrbShowcase() {
  const { data: session, status: authStatus } = useSession();
  const { addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [theme, setTheme] = useState<OrbTheme>(DEFAULT_THEME);
  const [showToolOverlay, setShowToolOverlay] = useState(false);
  const [activeMcpServers, setActiveMcpServers] = useState<McpServerConfig[]>([]);
  const [areMcpServersReady, setAreMcpServersReady] = useState(false);

  const [sdkAudioElement, setSdkAudioElement] = useState<HTMLAudioElement | undefined>(undefined);

  const isAuthenticated = authStatus === 'authenticated' && Boolean(session?.user);
  const onboarding = useOnboarding(isAuthenticated);
  const { completeCapability } = onboarding;

  // sendEvent doesn't exist until useRealtimeSession() below returns, but the
  // completion callback we pass INTO that same hook call needs to send a
  // follow-up event once it resolves an async capability check. A ref sidesteps
  // the circular dependency without making the callback identity unstable.
  const sendEventRef = useRef<((ev: any) => void) | null>(null);

  // Matches the established sendSimulatedUserMessage pattern (see App.tsx)
  // for injecting a hidden directive: conversation.item.create only supports
  // user/assistant roles here, so a bracketed note on a 'user' item is how
  // this codebase already nudges the model out-of-band without it being
  // mistaken for something the user said.
  const sendHiddenNudge = useCallback((text: string) => {
    sendEventRef.current?.({
      type: 'conversation.item.create',
      item: {
        id: uuidv4().slice(0, 32),
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: `[SYSTEM NOTE — not spoken by the user: ${text}]` }],
      },
    } as any);
    sendEventRef.current?.({ type: 'response.create' } as any);
  }, []);

  // Optional screen-side echo of a graduation moment — only shown if the
  // user happens to be looking (e.g. post-drive); the spoken nudge above is
  // the version that matters mid-drive. Self-clears after a few seconds.
  const [graduationBannerStage, setGraduationBannerStage] = useState<number | null>(null);
  useEffect(() => {
    if (graduationBannerStage === null) return;
    const timeout = setTimeout(() => setGraduationBannerStage(null), 8000);
    return () => clearTimeout(timeout);
  }, [graduationBannerStage]);

  const handleMcpToolCompleted = useCallback(
    ({ toolName }: { toolName: string; serverLabel?: string }) => {
      const capabilityKey = classifyGmailToolCompletion(toolName);
      if (!capabilityKey) return;

      void completeCapability(capabilityKey).then((result) => {
        if (!result) return;

        if (result.stageAdvanced) {
          // The bigger moment — a graduation to a new trust-ladder stage —
          // takes precedence over the routine first-use acknowledgment below.
          setGraduationBannerStage(result.stage);
          sendHiddenNudge(
            `the user just unlocked a new hands-free email stage (now stage ${result.stage}) by building up real usage. This is a bigger deal than a routine first-use — acknowledge it warmly as a milestone in your own words, mention that new things are now possible, then continue naturally. Never repeat this for the same stage transition again.`,
          );
          return;
        }

        if (!result.alreadyCompleted) {
          sendHiddenNudge(
            `they just used a hands-free email capability for the first time (${capabilityKey}). Briefly and warmly acknowledge this as a small milestone in one short sentence, then continue naturally. Never repeat this acknowledgment again for the same capability.`,
          );
        }
      });
    },
    [completeCapability, sendHiddenNudge],
  );

  const realtimeCallbacks = useMemo(
    () => ({ onMcpToolCompleted: handleMcpToolCompleted }),
    [handleMcpToolCompleted],
  );

  const {
    status: sessionStatus,
    connect,
    disconnect,
    sendEvent,
    mute,
    getLocalMediaStream,
  } = useRealtimeSession(realtimeCallbacks);

  useEffect(() => {
    sendEventRef.current = sendEvent;
  }, [sendEvent]);

  const conversationState = useOrbConversationState({ sessionStatus });

  // The mic track only exists once the WebRTC connection finishes negotiating,
  // so it's picked up right as the session goes CONNECTED rather than at mount.
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      setMicStream(getLocalMediaStream());
    } else {
      setMicStream(null);
    }
  }, [sessionStatus, getLocalMediaStream]);

  // Two independent analysers: the assistant's playback element, and the
  // user's own mic track. Which one drives the orb's audio-reactive motion
  // switches with who is actually talking, so the orb stays visually alive
  // during the user's turn instead of only reacting to the assistant.
  const remoteAnalysis = useOrbAudioAnalysis({ audioElement: sdkAudioElement, enabled: sessionStatus === 'CONNECTED' });
  const localAnalysis = useOrbAudioAnalysis({ stream: micStream, enabled: sessionStatus === 'CONNECTED' && Boolean(micStream) });
  const isUserTurn = conversationState === OrbState.Listening || conversationState === OrbState.Interrupted;
  const analysis = isUserTurn ? localAnalysis : remoteAnalysis;

  const totalTools = aggregateTools(activeMcpServers);

  const toolLabel = !areMcpServersReady
    ? 'Loading tools…'
    : totalTools > 0
      ? `${totalTools} tool${totalTools === 1 ? '' : 's'}`
      : 'No tools connected';

  // One caption under the orb replaces the old Standby/Live + conversation-state
  // pair of header chips. It reads as the orb's own label rather than a corner
  // readout, which is the point — the orb is meant to be the state, and this
  // caption is the training wheel until its motion alone carries it.
  const orbCaption = useMemo(() => {
    if (sessionStatus === 'CONNECTING') return 'Connecting…';
    if (sessionStatus === 'CONNECTED') return ORB_STATE_LABELS[conversationState];
    return 'Standby';
  }, [sessionStatus, conversationState]);

  const handleSignIn = () => {
    void signIn('google');
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/', redirect: true });
  };

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

  // Infrequent, session-start-only streak callout — never mid-triage. Fires
  // at most once per connection (guarded by the ref, reset on disconnect),
  // and only when there's an actual multi-day streak worth mentioning.
  const streakAnnouncedRef = useRef(false);
  useEffect(() => {
    if (sessionStatus === 'CONNECTED' && !streakAnnouncedRef.current) {
      streakAnnouncedRef.current = true;
      if (onboarding.streakDays >= 2) {
        sendHiddenNudge(
          `the user has now used hands-free email ${onboarding.streakDays} days in a row. Mention this briefly and warmly once, right at the start of this conversation, then move on to helping them — never mention it again later in this same conversation.`,
        );
      }
    }
    if (sessionStatus === 'DISCONNECTED') {
      streakAnnouncedRef.current = false;
    }
  }, [sessionStatus, onboarding.streakDays, sendHiddenNudge]);

  const fetchEphemeralKey = useCallback(async (servers: McpServerConfig[], model: string = 'gpt-realtime-mini') => {
    const eligibleServers = servers.filter((server) => server.status !== 'error');

    const payload = {
      model,
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
        require_approval: computeRequireApproval(server),
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

    const model = 'gpt-realtime-mini'; // Default model for Orb showcase
    const key = await fetchEphemeralKey(activeMcpServers, model);
    if (!key) {
      return;
    }

    const guardrail = createModerationGuardrail(personalAssistantCompanyName);
    const agentScenario = createPersonalAssistantScenario({
      stage: onboarding.stage ?? ONBOARDING_STAGE.Listening,
      contacts: onboarding.contacts,
      categories: onboarding.categories,
    });

    try {
      await connect({
        getEphemeralKey: async () => key,
        initialAgents: agentScenario,
        audioElement: sdkAudioElement,
        extraContext: {
          addTranscriptBreadcrumb,
        },
        outputGuardrails: [guardrail],
        model,
      });
    } catch (error) {
      console.error('Unable to start realtime session', error);
    }
  }, [
    sessionStatus,
    fetchEphemeralKey,
    activeMcpServers,
    connect,
    sdkAudioElement,
    addTranscriptBreadcrumb,
    onboarding.stage,
    onboarding.contacts,
    onboarding.categories,
  ]);

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

  if (authStatus !== 'authenticated' || !session?.user) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(168,85,247,0.12),transparent_55%)]" />

        <div className="relative flex h-screen flex-col items-center overflow-hidden px-6 py-6 sm:py-8">
          <div className="flex w-full items-center justify-between">
            <p className="font-orby text-[0.9rem] uppercase leading-none tracking-[0.5em] text-slate-200/90 [text-shadow:0_0_18px_rgba(129,140,248,0.45)]">
              Orby
            </p>
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">
              Research Preview
            </span>
          </div>

          <div className="flex w-full flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="w-[min(46vw,220px)] sm:w-[min(38vw,280px)]">
              <OrbVisualizer theme={theme} state={OrbState.Idle} analysis={analysis} />
            </div>

            <div className="max-w-xl space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Hands-Free Email
              </h1>
              <p className="text-lg font-medium tracking-tight text-slate-400 sm:text-xl">
                AI Voice Agent
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              className="group relative overflow-hidden rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-purple-500/20 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(56,189,248,0.3)] transition hover:border-cyan-200/60 hover:shadow-[0_0_50px_rgba(168,85,247,0.45)]"
            >
              <span className="relative">Login with Google</span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {LANDING_CAPABILITIES.map(({ label, icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-slate-200/15 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur"
                >
                  <span className="text-cyan-300">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(168,85,247,0.08),transparent_55%)]" />

      {/*
        Three fixed bands — chrome / orb / action — as an explicit grid rather
        than a flex column with ad-hoc padding. The middle 1fr row is what
        actually centres the orb: it gets exactly the space the header and the
        action dock don't claim, so the orb sits at the optical centre of the
        remaining viewport at every height instead of drifting.

        dvh (not vh) so mobile browser chrome collapsing doesn't push the dock
        under the fold, and safe-area insets on both ends.

        --orb-size is the visualiser's *box*; --orb-diameter is the sphere drawn
        inside it, which the Liquid Glass scene insets to 71.5% of that box. The
        mic and the skills grid both measure themselves against the diameter, so
        the whole dock lines up with the orb's silhouette rather than with the
        invisible box around it.
      */}
      <div
        className="relative grid h-[100dvh] min-h-[100dvh] grid-rows-[auto_1fr_auto]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          '--orb-size': 'min(62vw, 320px)',
          '--orb-diameter': 'calc(var(--orb-size) * 0.715)',
        } as React.CSSProperties}
      >
        {/* Wordmark is optically centred on the screen axis (the orb's axis), so
            it sits in the flow centre with the settings control floated out of
            it — a justify-between row would push it off-centre by the gear. */}
        <header className="relative flex items-center justify-center px-5 pt-4 sm:px-8 sm:pt-6">
          <p className="font-orby text-[0.9rem] uppercase leading-none tracking-[0.5em] text-slate-200/90 [text-shadow:0_0_18px_rgba(129,140,248,0.45)] sm:text-base">
            <span className="pl-[0.5em]">Orby</span>
          </p>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 sm:right-8">
            <SettingsMenu
              toolLabel={toolLabel}
              toolsConnected={isWorkspaceConnected}
              onOpenTools={() => setShowToolOverlay(true)}
              onSignOut={() => void handleSignOut()}
            />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-col items-center justify-center gap-4 px-5 sm:px-8">
          {graduationBannerStage !== null && (
            <div className="absolute inset-x-5 top-0 flex items-center justify-between gap-3 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-purple-500/10 px-4 py-3 text-sm text-cyan-100 sm:inset-x-8">
              <span>
                You&apos;ve unlocked <strong>{STAGE_LABELS[graduationBannerStage as OnboardingStage]}</strong> — new
                things are possible now hands-free.
              </span>
              <button
                type="button"
                onClick={() => setGraduationBannerStage(null)}
                className="shrink-0 text-xs text-cyan-200/70 hover:text-cyan-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* The orb is capped by width (--orb-size) but sized by the height it
              actually has: `h-full` + `aspect-[1/1.12]` derive the width from
              this row, and max-width clamps it on tall screens, so whichever
              axis is scarcer wins. `min-w-0 w-auto` is load-bearing — without
              it CSS's automatic minimum size lets the scene's own min-content
              width override the aspect ratio, and the orb overflows the row
              instead of shrinking (see docs/orb-layout.md).

              This deliberately replaces an earlier `46dvh` term. A fraction of
              the *viewport* is not the orb's budget; the viewport minus the
              header and the dock is. Those drift apart every time the dock
              changes, and the orb silently overflows out of view when they do. */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div className="aspect-[1/1.12] h-full w-auto min-w-0 max-w-[var(--orb-size)]">
              <OrbVisualizer theme={theme} state={conversationState} analysis={analysis} />
            </div>
          </div>

          <p
            aria-live="polite"
            className="text-[0.7rem] font-medium uppercase tracking-[0.35em] text-slate-400"
          >
            {orbCaption}
          </p>
        </main>

        {/* Action dock: the mic is the only thing in the thumb zone, with the
            skills rail directly beneath it — close enough to read as "what you
            can say into this", far enough not to be mistaken for a control. */}
        <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-2 sm:px-8 sm:pb-8">
          <MicButton sessionStatus={sessionStatus} onToggle={() => void handleToggleConnection()} />
          <CapabilityChecklist data={onboarding.capabilities} />
        </div>

        {SHOW_THEME_SWITCHER && (
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
        )}
      </div>

      {showToolOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
          <ToolsOverlay
            servers={activeMcpServers}
            onClose={() => setShowToolOverlay(false)}
            onConnected={(serversWithWorkspace) => setActiveMcpServers(serversWithWorkspace)}
          />
        </div>
      )}

    </div>
  );
}
