"use client";

import { useMemo } from 'react';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { TranscriptItem } from '@/app/types';
import { OrbState } from '../types';
import { SessionStatus } from '@/app/types';

interface UseOrbConversationStateOptions {
  sessionStatus: SessionStatus;
}

const MESSAGE_TYPE = 'MESSAGE';

function getLatestByRole(items: TranscriptItem[], role: 'user' | 'assistant'): TranscriptItem | undefined {
  const filtered = items.filter((item) => item.type === MESSAGE_TYPE && item.role === role);
  if (!filtered.length) return undefined;
  return filtered.reduce((latest, item) => {
    if (!latest) return item;
    const latestTime = latest.createdAtMs ?? 0;
    const itemTime = item.createdAtMs ?? 0;
    return itemTime >= latestTime ? item : latest;
  });
}

export function useOrbConversationState({ sessionStatus }: UseOrbConversationStateOptions): OrbState {
  const { transcriptItems, isToolExecuting, isUserSpeaking, isAssistantSpeaking } = useTranscript();

  return useMemo(() => {
    if (sessionStatus !== 'CONNECTED') return OrbState.Idle;

    // Check if tools are executing first - highest priority
    if (isToolExecuting) {
      return OrbState.Working;
    }

    // Live mic/speaker signals (input_audio_buffer.speech_started/stopped,
    // output_audio_buffer.started/stopped) fire immediately on VAD/playback
    // boundaries, unlike the transcript-status heuristic below which lags
    // behind by however long transcription or response-completion takes.
    // Both true at once means the user started talking over the assistant.
    if (isUserSpeaking && isAssistantSpeaking) {
      return OrbState.Interrupted;
    }
    if (isUserSpeaking) {
      return OrbState.Listening;
    }
    if (isAssistantSpeaking) {
      return OrbState.Speaking;
    }

    const messages = transcriptItems.filter((item) => item.type === MESSAGE_TYPE);
    if (messages.length === 0) return OrbState.Ready;

    const latestMessage = messages[messages.length - 1];
    const latestUser = getLatestByRole(messages, 'user');
    const latestAssistant = getLatestByRole(messages, 'assistant');

    // A user speaking over an unfinished assistant response is an interruption.
    // Check before the latest-user branch, which would otherwise mask it as listening.
    const userAfterAssistant = latestUser && latestAssistant
      && (latestUser.createdAtMs ?? 0) > (latestAssistant.createdAtMs ?? 0);
    if (userAfterAssistant && latestUser.status !== 'DONE' && latestAssistant.status !== 'DONE') {
      return OrbState.Interrupted;
    }

    if (latestMessage.role === 'user') {
      if (latestMessage.status !== 'DONE') {
        return OrbState.Listening;
      }

      const assistantAfterUser = latestAssistant && (latestAssistant.createdAtMs ?? 0) > (latestMessage.createdAtMs ?? 0);
      if (!assistantAfterUser) {
        return OrbState.Thinking;
      }
    }

    if (latestAssistant && latestAssistant.status !== 'DONE') {
      return OrbState.Speaking;
    }

    if (latestUser && latestUser.status !== 'DONE') {
      return OrbState.Listening;
    }

    if (latestUser && (!latestAssistant || (latestAssistant.createdAtMs ?? 0) < (latestUser.createdAtMs ?? 0))) {
      return OrbState.Thinking;
    }

    return OrbState.Ready;
  }, [sessionStatus, transcriptItems, isToolExecuting, isUserSpeaking, isAssistantSpeaking]);
}
