export type IrreversibleGmailAction = 'send' | 'delete';

// Exact-word confirmation per action type — deliberately never a shared
// generic "yes". Word-boundary matched so "yeah just send it" counts but
// "sending" (a different verb form, or the word appearing as a substring of
// something else) does not.
const CONFIRMATION_WORD: Record<IrreversibleGmailAction, RegExp> = {
  send: /\bsend\b/i,
  delete: /\bdelete\b/i,
};

// Classifies a Gmail tool name as one of the two irreversible actions this
// app requires spoken confirmation for, or null otherwise. Kept as its own
// small, independently-auditable module separate from the broader capability
// classifier in toolCompletionClassifier.ts, given the safety stakes here.
//
// Same caveat as that file: matches on plausible tool-name patterns, not a
// verified live tool list — re-check against a real connected account.
export function classifyIrreversibleGmailAction(toolName: string | undefined | null): IrreversibleGmailAction | null {
  if (!toolName) return null;
  const name = toolName.toLowerCase();
  if (!name.includes('gmail')) return null;
  if (name.includes('send')) return 'send';
  if (name.includes('delete') || name.includes('trash')) return 'delete';
  return null;
}

// Whether `utterance` contains the exact confirmation word required for
// `action`. Silence, an empty utterance, or a mismatched word (e.g. "delete"
// said in response to a pending "send") all correctly return false.
export function utteranceConfirms(action: IrreversibleGmailAction, utterance: string | undefined | null): boolean {
  if (!utterance) return false;
  return CONFIRMATION_WORD[action].test(utterance);
}
