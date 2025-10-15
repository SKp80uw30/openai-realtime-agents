import { simpleHandoffScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';
import { personalAssistantScenario } from './personalAssistant';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
  personalAssistant: personalAssistantScenario,
};

export const agentSetLabels: Record<string, string> = {
  simpleHandoff: 'Simple Handoff',
  customerServiceRetail: 'Customer Service Retail',
  chatSupervisor: 'Chat Supervisor',
  personalAssistant: 'Personal Assistant',
};

export const defaultAgentSetKey = 'chatSupervisor';
