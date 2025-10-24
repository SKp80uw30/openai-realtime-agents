import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { useTranscript } from '../contexts/TranscriptContext';
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
  model?: string;
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();
  const { setIsToolExecuting } = useTranscript();

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

  const latestResponseIdRef = useRef<string | null>(null);
  const pendingMcpApprovalRef = useRef<Map<string, { responseId: string; outputIndex?: number }>>(new Map());
  const pendingMcpCallsRef = useRef<Map<string, { callId: string; responseId?: string; toolName: string; serverLabel: string; outputIndex?: number; logged: boolean }>>(new Map());
  const mcpCallFollowupTriggeredRef = useRef<Set<string>>(new Set());
  const activeToolCallsRef = useRef<Set<string>>(new Set());

  const handleTransportEvent = useCallback((event: any) => {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case 'response.created': {
        if (typeof event.response?.id === 'string') {
          latestResponseIdRef.current = event.response.id;
        }
        logServerEvent(event);
        break;
      }
      case 'response.output_item.added': {
        const responseId: string | undefined = event.response_id ?? latestResponseIdRef.current ?? undefined;
        const itemType = event.item?.type;
        if (itemType === 'mcp_approval_request' && typeof event.item?.id === 'string' && responseId) {
          pendingMcpApprovalRef.current.set(event.item.id, {
            responseId,
            outputIndex: typeof event.output_index === 'number' ? event.output_index : undefined,
          });
          logServerEvent({
            type: 'agent.mcp_approval.pending',
            approval_id: event.item.id,
            response_id: responseId,
            output_index: event.output_index,
            name: event.item?.name,
            server_label: event.item?.server_label,
          });
        } else if (itemType === 'mcp_call' && typeof event.item?.id === 'string' && responseId) {
          latestResponseIdRef.current = responseId;
          // Store pending MCP call - arguments will arrive in response.mcp_call_arguments.done
          pendingMcpCallsRef.current.set(event.item.id, {
            callId: event.item.id,
            responseId,
            toolName: event.item?.name,
            serverLabel: event.item?.server_label,
            outputIndex: typeof event.output_index === 'number' ? event.output_index : undefined,
            logged: false,
          });

          logServerEvent({
            type: 'agent.mcp_response.tracked',
            response_id: responseId,
            mcp_call_id: event.item.id,
            tool_name: event.item?.name,
            note: 'Response marked as containing MCP calls',
          });
        }
        logServerEvent(event);
        break;
      }
      case 'response.mcp_call_arguments.done': {
        // Arguments are now available for the MCP call
        const callId = event.item_id;
        const pendingCall = pendingMcpCallsRef.current.get(callId);

        if (pendingCall && !pendingCall.logged) {
          const mcpCallDetails = {
            type: 'agent.mcp_call.initiated',
            mcp_call_id: callId,
            response_id: event.response_id ?? latestResponseIdRef.current,
            output_index: pendingCall.outputIndex,
            tool_name: pendingCall.toolName,
            server_label: pendingCall.serverLabel,
            arguments: event.arguments,
          };
          logServerEvent(mcpCallDetails);
          historyHandlersRef.current.handleMcpCallInitiated(mcpCallDetails);

          // Mark as logged to prevent duplicates
          pendingCall.logged = true;
        }
        logServerEvent(event);
        break;
      }
      case 'response.done': {
        const responseId = event.response?.id;
        if (responseId) {
          const pendingCalls = Array.from(pendingMcpCallsRef.current.values()).filter(
            (call) => call.responseId === responseId,
          );

          if (pendingCalls.length > 0) {
            logServerEvent({
              type: 'agent.mcp_call.waiting_for_completion',
              response_id: responseId,
              pending_call_ids: pendingCalls.map((call) => call.callId),
              note: 'response.done received while MCP calls still pending; waiting for response.output_item.done events',
            });
          }
        }
        logServerEvent(event);
        break;
      }
      case 'response.output_item.done': {
        const itemType = event.item?.type;
        if (itemType === 'mcp_call') {
          // Log MCP call result to catch null responses
          const mcpResultDetails = {
            type: 'agent.mcp_call.completed',
            mcp_call_id: event.item?.id,
            response_id: event.response_id,
            output_index: event.output_index,
            tool_name: event.item?.name,
            server_label: event.item?.server_label,
            output: event.item?.output,
            error: event.item?.error,
            status: event.item?.status,
          };
          logServerEvent(mcpResultDetails);
          historyHandlersRef.current.handleMcpCallCompleted(mcpResultDetails);

          const callId = event.item?.id;
          const pendingCall = callId ? pendingMcpCallsRef.current.get(callId) : undefined;
          const responseId = pendingCall?.responseId ?? event.response_id;
          const alreadyTriggered = callId ? mcpCallFollowupTriggeredRef.current.has(callId) : false;

          logServerEvent({
            type: 'agent.mcp_response.trigger_check',
            response_id: responseId,
            mcp_call_id: callId,
            tool_name: event.item?.name,
            has_response_id: !!responseId,
            has_session: !!sessionRef.current,
            pending_call_known: !!pendingCall,
            already_triggered: alreadyTriggered,
          });

          if (callId && !alreadyTriggered && sessionRef.current) {
            try {
              sessionRef.current.transport.sendEvent({
                type: 'response.create',
              } as any);

              mcpCallFollowupTriggeredRef.current.add(callId);

              logServerEvent({
                type: 'agent.mcp_response.followup_triggered',
                response_id: responseId,
                mcp_call_id: callId,
                tool_name: event.item?.name,
                note: 'Triggering new response after MCP call completed',
              });
            } catch (error: any) {
              logServerEvent({
                type: 'agent.mcp_response.followup_error',
                response_id: responseId,
                mcp_call_id: callId,
                tool_name: event.item?.name,
                error: error?.message ?? error,
              });
            }
          }

          if (callId) {
            pendingMcpCallsRef.current.delete(callId);
            // Allow reuse after a short delay to avoid leaks while guarding against duplicate events
            setTimeout(() => {
              mcpCallFollowupTriggeredRef.current.delete(callId);
            }, 60_000);
          }
        }
        logServerEvent(event);
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        historyHandlersRef.current.handleTranscriptionCompleted(event);
        break;
      }
      case 'response.audio_transcript.done': {
        historyHandlersRef.current.handleTranscriptionCompleted(event);
        break;
      }
      case 'response.audio_transcript.delta': {
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
    if (!session || status !== 'CONNECTED') return;

    const errorListener = (...args: any[]) => {
      logServerEvent({
        type: 'error',
        message: args[0],
      });
    };

    const agentToolStartListener = (details: any, agent: any, functionCall: any) => {
      logServerEvent({
        type: 'agent.tool_start',
        event_id: functionCall?.call_id,
        agent: agent?.name ?? agent?.id ?? 'unknown-agent',
        tool_name: functionCall?.name,
        arguments: functionCall?.arguments,
        call_id: functionCall?.call_id,
      }, '(start)');
      historyHandlersRef.current.handleAgentToolStart(details, agent, functionCall);

      // Track tool execution state
      if (functionCall?.call_id) {
        activeToolCallsRef.current.add(functionCall.call_id);
        setIsToolExecuting(true);
      }
    };
    const agentToolEndListener = (
      details: any,
      agent: any,
      functionCall: any,
      result: any,
    ) => {
      logServerEvent({
        type: 'agent.tool_end',
        event_id: functionCall?.call_id,
        agent: agent?.name ?? agent?.id ?? 'unknown-agent',
        tool_name: functionCall?.name,
        call_id: functionCall?.call_id,
        result,
      }, '(end)');
      historyHandlersRef.current.handleAgentToolEnd(details, agent, functionCall, result);

      // Update tool execution state
      if (functionCall?.call_id) {
        activeToolCallsRef.current.delete(functionCall.call_id);
        // Only set to false if no more active tool calls
        if (activeToolCallsRef.current.size === 0) {
          setIsToolExecuting(false);
        }
      }
    };
    const historyUpdatedListener = (items: any[]) => {
      historyHandlersRef.current.handleHistoryUpdated(items);
    };
    const historyAddedListener = (item: any) => {
      historyHandlersRef.current.handleHistoryAdded(item);

      if (item?.type === 'mcp_approval_request' && typeof item.id === 'string') {
        const approvalId = item.id;

        logServerEvent({
          type: 'agent.mcp_approval.request_received',
          approval_id: approvalId,
          tool_name: item.name,
          server_label: item.server_label,
        });

        if (session) {
          try {
            // Send approval response as a conversation item
            session.transport.sendEvent({
              type: 'conversation.item.create',
              item: {
                type: 'mcp_approval_response',
                approval_request_id: approvalId,
                approve: true,
              },
            } as any);

            logServerEvent({
              type: 'agent.mcp_approval.auto_approved',
              approval_id: approvalId,
            });

            // Trigger a new response to execute the approved call
            session.transport.sendEvent({
              type: 'response.create',
            } as any);

            logServerEvent({
              type: 'agent.mcp_approval.response_triggered',
              approval_id: approvalId,
            });
          } catch (error: any) {
            logServerEvent({
              type: 'agent.mcp_approval.error',
              approval_id: approvalId,
              error: error?.message ?? error,
            });
          }
        } else {
          logServerEvent({
            type: 'agent.mcp_approval.no_session',
            approval_id: approvalId,
          });
        }
      }
    };
    const guardrailListener = (details: any, agent: any, guardrail: any) => {
      historyHandlersRef.current.handleGuardrailTripped(details, agent, guardrail);
    };
    const toolApprovalListener = async (
      _context: any,
      _agent: any,
      approval: any,
    ) => {
      try {
        await session.approve(approval.approvalItem, { alwaysApprove: true });
        logServerEvent({
          type: 'agent.tool_approval.auto_approved',
          tool_name: approval?.tool?.name,
        });
      } catch (error: any) {
        logServerEvent({
          type: 'agent.tool_approval.error',
          tool_name: approval?.tool?.name,
          error: error?.message ?? error,
        });
      }
    };

    session.on('error', errorListener);
    session.on('agent_handoff', handleAgentHandoff);
    session.on('agent_tool_start', agentToolStartListener);
    session.on('agent_tool_end', agentToolEndListener);
    session.on('history_updated', historyUpdatedListener);
    session.on('history_added', historyAddedListener);
    session.on('guardrail_tripped', guardrailListener);
    session.on('transport_event', handleTransportEvent);
    session.on('tool_approval_requested', toolApprovalListener);

    return () => {
      session.off('error', errorListener);
      session.off('agent_handoff', handleAgentHandoff);
      session.off('agent_tool_start', agentToolStartListener);
      session.off('agent_tool_end', agentToolEndListener);
      session.off('history_updated', historyUpdatedListener);
      session.off('history_added', historyAddedListener);
      session.off('guardrail_tripped', guardrailListener);
      session.off('transport_event', handleTransportEvent);
      session.off('tool_approval_requested', toolApprovalListener);
    };
  }, [handleAgentHandoff, handleTransportEvent, historyHandlersRef, logServerEvent, status]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
      model = 'gpt-realtime-mini',
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
        model,
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
