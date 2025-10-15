export type McpConnectorCategory = 'openai' | 'thirdParty' | 'custom';

export interface McpConnectorDefinition {
  id: string;
  name: string;
  description?: string;
  category: McpConnectorCategory;
  serverUrl?: string;
  documentationUrl?: string;
  requiresAuthHeaders?: boolean;
  defaultHeaders?: Record<string, string>;
}

export interface McpServerHeader {
  id: string;
  key: string;
  value: string;
}

export interface McpToolSummary {
  name: string;
  description?: string;
}

export type McpConnectionStatus = 'unknown' | 'connected' | 'error';

export interface McpServerConfig {
  id: string;
  label: string;
  serverUrl: string;
  headers: McpServerHeader[];
  allowedTools?: string[];
  category: McpConnectorCategory;
  sourceId?: string;
  notes?: string;
  status: McpConnectionStatus;
  tools?: McpToolSummary[];
  lastCheckedAt?: string;
  errorMessage?: string;
}

export interface McpServerRequestPayload {
  label: string;
  server_url: string;
  headers?: Record<string, string>;
  allowed_tools?: { tool_names: string[] } | string[];
}
