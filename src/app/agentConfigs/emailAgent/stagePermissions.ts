import { ONBOARDING_STAGE, OnboardingStage } from '@/app/types/onboarding';

export interface EmailStagePermissions {
  read: boolean;
  markRead: boolean;
  archive: boolean;
  draftReply: boolean; // drafts and reads back; never sends
  send: boolean;
  delete: boolean;
}

// Single source of truth for what hands-free email can do at each trust-ladder
// stage. Drives both emailAgent's instructions (below) and, in a later phase,
// the runtime confirmation gate for send/delete — so the two never drift.
export function getEmailStagePermissions(stage: OnboardingStage): EmailStagePermissions {
  const canListen = stage >= ONBOARDING_STAGE.Listening;
  const canRespond = stage >= ONBOARDING_STAGE.Responding;
  const canAct = stage >= ONBOARDING_STAGE.Acting;

  return {
    read: canListen,
    markRead: canListen,
    archive: canListen,
    draftReply: canRespond,
    send: canAct,
    delete: canAct,
  };
}
