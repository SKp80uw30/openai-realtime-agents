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
  const { transcriptItems, isToolExecuting } = useTranscript();

  return useMemo(() => {
    if (sessionStatus !== 'CONNECTED') return OrbState.Idle;

    // Check if tools are executing first - highest priority
    if (isToolExecuting) {
      return OrbState.Working;
    }

    const messages = transcriptItems.filter((item) => item.type === MESSAGE_TYPE);
    if (messages.length === 0) return OrbState.Ready;

    const latestMessage = messages[messages.length - 1];
    const latestUser = getLatestByRole(messages, 'user');
    const latestAssistant = getLatestByRole(messages, 'assistant');

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
      const userAfterAssistant = latestUser && (latestUser.createdAtMs ?? 0) > (latestAssistant.createdAtMs ?? 0);
      if (userAfterAssistant && latestUser.status !== 'DONE') {
        return OrbState.Interrupted;
      }
      return OrbState.Speaking;
    }

    if (latestUser && latestUser.status !== 'DONE') {
      return OrbState.Listening;
    }

    if (latestUser && (!latestAssistant || (latestAssistant.createdAtMs ?? 0) < (latestUser.createdAtMs ?? 0))) {
      return OrbState.Thinking;
    }

    return OrbState.Ready;
  }, [sessionStatus, transcriptItems, isToolExecuting]);
}
