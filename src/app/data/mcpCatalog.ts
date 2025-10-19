import type { McpConnectorDefinition } from '@/app/types/mcp';

export const MCP_CONNECTOR_CATALOG: McpConnectorDefinition[] = [
  {
    id: 'zapier-cloud',
    name: 'Zapier (Cloud)',
    description:
      'Access Zapier-driven automations through the official Zapier MCP deployment. Requires Zapier auth headers.',
    category: 'thirdParty',
    documentationUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/typescript/zapier',
    requiresAuthHeaders: true,
    defaultHeaders: {
      Authorization: 'Bearer ' ,
    },
  },
  {
    id: 'google-workspace-mcp',
    name: 'Google Workspace MCP',
    description:
      'Unified Google Workspace tools including Calendar, Gmail, and Slack integrations hosted by Workspace MCP.',
    category: 'thirdParty',
    documentationUrl: 'https://workspacemcp.com/',
    serverUrl: 'https://googleworkspacemcp-production.up.railway.app/mcp',
    authUrl: 'https://googleworkspacemcp-production.up.railway.app/auth/google',
    authButtonLabel: 'Authorize Google Workspace',
    authHelpText:
      'Launches the Workspace MCP OAuth consent flow in a new tab. Save the server first so the configuration persists.',
  },
  {
    id: 'google-drive-openai',
    name: 'Google Drive (OpenAI Connector)',
    description:
      'Browse and retrieve Google Drive documents via the OpenAI-maintained MCP server. Requires OAuth headers.',
    category: 'openai',
    documentationUrl: 'https://github.com/modelcontextprotocol/servers',
    requiresAuthHeaders: true,
  },
  {
    id: 'github-search',
    name: 'GitHub Search',
    description:
      'Search repositories and issues with GitHub MCP server. Provide a PAT header.',
    category: 'thirdParty',
    documentationUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/typescript/github',
    requiresAuthHeaders: true,
  },
  {
    id: 'http-custom',
    name: 'Custom HTTP Endpoint',
    description:
      'Use any remotely hosted MCP server by providing its URL and optional headers.',
    category: 'custom',
  },
];
