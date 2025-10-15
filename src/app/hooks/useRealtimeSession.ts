import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const { logServerEvent } = useEvent();

  const historyHandlersRef = useHandleSessionHistory();

  const handleTransportEvent = useCallback((event: any) => {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlersRef.current.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlersRef.current.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlersRef.current.handleTranscriptionDelta(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      } 
    }
  }, [historyHandlersRef, logServerEvent]);

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = useCallback((item: any) => {
    const history = Array.isArray(item?.context?.history)
      ? item.context.history
      : [];

    for (let i = history.length - 1; i >= 0; i -= 1) {
      const name = history[i]?.name;
      if (typeof name === 'string' && name.startsWith('transfer_to_')) {
        const agentName = name.slice('transfer_to_'.length);
        if (agentName) {
          callbacks.onAgentHandoff?.(agentName);
        }
        return;
      }
    }

    logServerEvent({
      type: 'agent_handoff_unparsed',
      payload: item,
    });
  }, [callbacks, logServerEvent]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const errorListener = (...args: any[]) => {
      logServerEvent({
        type: 'error',
        message: args[0],
      });
    };

    const agentToolStartListener = (details: any, agent: any, functionCall: any) => {
      historyHandlersRef.current.handleAgentToolStart(details, agent, functionCall);
    };
    const agentToolEndListener = (
      details: any,
      agent: any,
      functionCall: any,
      result: any,
    ) => {
      historyHandlersRef.current.handleAgentToolEnd(details, agent, functionCall, result);
    };
    const historyUpdatedListener = (items: any[]) => {
      historyHandlersRef.current.handleHistoryUpdated(items);
    };
    const historyAddedListener = (item: any) => {
      historyHandlersRef.current.handleHistoryAdded(item);
    };
    const guardrailListener = (details: any, agent: any, guardrail: any) => {
      historyHandlersRef.current.handleGuardrailTripped(details, agent, guardrail);
    };

    session.on('error', errorListener);
    session.on('agent_handoff', handleAgentHandoff);
    session.on('agent_tool_start', agentToolStartListener);
    session.on('agent_tool_end', agentToolEndListener);
    session.on('history_updated', historyUpdatedListener);
    session.on('history_added', historyAddedListener);
    session.on('guardrail_tripped', guardrailListener);
    session.on('transport_event', handleTransportEvent);

    return () => {
      session.off('error', errorListener);
      session.off('agent_handoff', handleAgentHandoff);
      session.off('agent_tool_start', agentToolStartListener);
      session.off('agent_tool_end', agentToolEndListener);
      session.off('history_updated', historyUpdatedListener);
      session.off('history_added', historyAddedListener);
      session.off('guardrail_tripped', guardrailListener);
      session.off('transport_event', handleTransportEvent);
    };
  }, [handleAgentHandoff, handleTransportEvent, historyHandlersRef, logServerEvent]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];

      // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
      //  simulate how the voice agent sounds over a PSTN/SIP phone call.
      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);

      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          // Set preferred codec before offer creation
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc);
            return pc;
          },
        }),
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });

      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
