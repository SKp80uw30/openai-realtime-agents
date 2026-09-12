export type EmailCapabilityKey =
  | 'email.summarize'
  | 'email.mark_read'
  | 'email.archive'
  | 'email.draft'
  | 'email.send'
  | 'email.delete';

// Best-effort classification of a completed MCP tool call into the hands-free
// email capability it represents, purely from the tool's name. There is no
// dedicated "summarize" tool — reading/searching/listing a message is what
// immediately precedes the model summarizing it aloud, so those map to
// email.summarize.
//
// NOTE: exact tool names from the live "GoogleWorkspace" MCP server
// (workspacemcp.com) have not been verified against a real connected
// account — this matches on plausible naming patterns and should be
// re-checked against the real tool list from `GET /api/mcp/list-tools`
// once a live OAuth connection is available (see todo-handsfree-email.md
// Phase 4 notes).
export function classifyGmailToolCompletion(toolName: string | undefined | null): EmailCapabilityKey | null {
  if (!toolName) return null;
  const name = toolName.toLowerCase();

  // Only classify Gmail-scoped tools — this MCP server also carries Calendar
  // and Slack tools, and words like "list" or "message" are ambiguous across
  // domains, so gate strictly on the literal "gmail" token first.
  if (!name.includes('gmail')) return null;

  if (name.includes('send')) return 'email.send';
  if (name.includes('delete') || name.includes('trash')) return 'email.delete';
  if (name.includes('draft')) return 'email.draft';
  if (name.includes('archive')) return 'email.archive';
  if (name.includes('mark') || (name.includes('label') && name.includes('read'))) return 'email.mark_read';

  // A write-ish verb we don't have a specific mapping for (e.g. a generic
  // "modify_gmail_message_labels" that isn't clearly mark-read) — safer to
  // leave unclassified than to guess and wrongly credit a capability.
  if (name.includes('modify') || name.includes('update')) return null;

  if (name.includes('search') || name.includes('list') || name.includes('get') || name.includes('thread') || name.includes('message')) {
    return 'email.summarize';
  }

  return null;
}
