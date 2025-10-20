'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { MCP_CONNECTOR_CATALOG } from '@/app/data/mcpCatalog';
import type {
  McpAuthInfo,
  McpConnectorCategory,
  McpConnectorDefinition,
  McpServerConfig,
  McpServerHeader,
  McpToolSummary,
} from '@/app/types/mcp';

interface McpManagerProps {
  servers: McpServerConfig[];
  onServersChange: (servers: McpServerConfig[]) => void;
}

interface DraftServerState {
  label: string;
  serverUrl: string;
  connectorId: string;
  headers: McpServerHeader[];
  allowedToolsRaw: string;
  category: McpConnectorCategory;
  notes: string;
}

const DEFAULT_STATE: DraftServerState = {
  label: '',
  serverUrl: '',
  connectorId: MCP_CONNECTOR_CATALOG[0]?.id ?? 'http-custom',
  headers: [],
  allowedToolsRaw: '',
  category: MCP_CONNECTOR_CATALOG[0]?.category ?? 'custom',
  notes: '',
};

function buildAllowedToolsList(raw: string): string[] | undefined {
  const items = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function generateRandomString(length = 64): string {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    return Array(length).fill('x').join('');
  }
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const result = [] as string[];
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i += 1) {
    result.push(charset[randomValues[i] % charset.length]);
  }
  return result.join('');
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return verifier;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function generateState() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return generateRandomString(32);
}

interface PendingOAuthSession {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
  redirectUri: string;
  serverUrl: string;
  serverLabel?: string;
  serviceName?: string;
  createdAt: number;
}

export default function McpManager({ servers, onServersChange }: McpManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DraftServerState>(() => ({ ...DEFAULT_STATE }));
  const [error, setError] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [authInfo, setAuthInfo] = useState<McpAuthInfo | null>(null);
  const [authInfoError, setAuthInfoError] = useState('');
  const [isAuthInfoLoading, setIsAuthInfoLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const groupedCatalog = useMemo(() => {
    return MCP_CONNECTOR_CATALOG.reduce<Record<McpConnectorCategory, McpConnectorDefinition[]>>(
      (acc, connector) => {
        acc[connector.category] = acc[connector.category] ?? [];
        acc[connector.category].push(connector);
        return acc;
      },
      { openai: [], thirdParty: [], custom: [] },
    );
  }, []);

  const currentDefinition = useMemo(() => {
    return MCP_CONNECTOR_CATALOG.find((item) => item.id === draft.connectorId);
  }, [draft.connectorId]);

  const resetDraft = () => {
    const fallbackConnector = MCP_CONNECTOR_CATALOG[0] ?? {
      id: 'http-custom',
      category: 'custom' as McpConnectorCategory,
    };
    setDraft({
      label: '',
      serverUrl: fallbackConnector.serverUrl ?? '',
      connectorId: fallbackConnector.id,
      headers: [],
      allowedToolsRaw: '',
      category: fallbackConnector.category,
      notes: '',
    });
    setError('');
    setIsTesting(false);
    setAuthInfo(null);
    setAuthInfoError('');
    setIsAuthInfoLoading(false);
  };

  const handleOpen = () => {
    resetDraft();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const fetchAuthInfo = async (
    rawServerUrl: string,
    overrideHeaders?: McpServerHeader[],
  ) => {
    const trimmed = rawServerUrl.trim();
    if (!trimmed) {
      setAuthInfo(null);
      setAuthInfoError('');
      return null;
    }

    try {
      // Validate URL format early so we can surface a friendly message.
      new URL(trimmed);
    } catch {
      setAuthInfo(null);
      setAuthInfoError('Server URL is not a valid absolute URL.');
      return null;
    }

    setIsAuthInfoLoading(true);
    setAuthInfoError('');

    try {
      const response = await fetch('/api/mcp/auth-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl: trimmed,
          headers: overrideHeaders ?? draft.headers,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof data?.error === 'string'
            ? data.error
            : `Server returned ${response.status}`;
        throw new Error(message);
      }

      const typed = data as McpAuthInfo;
      setAuthInfo(typed);
      return typed;
    } catch (err: any) {
      const message = err?.message || 'Unable to fetch auth info from server.';
      setAuthInfo(null);
      setAuthInfoError(message);
      return null;
    } finally {
      setIsAuthInfoLoading(false);
    }
  };

  const handleConnectorSelect = (id: string) => {
    const definition = MCP_CONNECTOR_CATALOG.find((item) => item.id === id);
    setAuthInfo(null);
    setAuthInfoError('');

    const defaultHeaders = definition?.defaultHeaders
      ? Object.entries(definition.defaultHeaders).map(([key, value]) => ({
          id: uuidv4(),
          key,
          value,
        }))
      : [];

    setDraft((prev) => ({
      ...prev,
      connectorId: id,
      category: definition?.category ?? prev.category,
      serverUrl: definition?.serverUrl ?? '',
      headers: defaultHeaders,
    }));

    if (definition?.serverUrl) {
      void fetchAuthInfo(definition.serverUrl, defaultHeaders);
    }
  };

  const handleHeaderChange = (headerId: string, field: 'key' | 'value', value: string) => {
    setDraft((prev) => ({
      ...prev,
      headers: prev.headers.map((header) =>
        header.id === headerId ? { ...header, [field]: value } : header,
      ),
    }));
  };

  const handleAddHeader = () => {
    setDraft((prev) => ({
      ...prev,
      headers: [...prev.headers, { id: uuidv4(), key: '', value: '' }],
    }));
  };

  const handleRemoveHeader = (headerId: string) => {
    setDraft((prev) => ({
      ...prev,
      headers: prev.headers.filter((header) => header.id !== headerId),
    }));
  };

  const renderConnectorOptionGroup = (
    label: string,
    connectors: McpConnectorDefinition[],
  ) => (
    <optgroup key={label} label={label}>
      {connectors.map((connector) => (
        <option key={connector.id} value={connector.id}>
          {connector.name}
        </option>
      ))}
    </optgroup>
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const label = draft.label.trim();
    const serverUrl = draft.serverUrl.trim();
    if (!label) {
      setError('Please provide a label for this MCP server.');
      return;
    }
    if (!serverUrl) {
      setError('Please provide the MCP server URL.');
      return;
    }

    const duplicate = servers.some(
      (existing) =>
        existing.serverUrl === serverUrl ||
        existing.label.toLowerCase() === label.toLowerCase(),
    );
    if (duplicate) {
      setError('A server with this label or URL already exists.');
      return;
    }

    const allowedTools = buildAllowedToolsList(draft.allowedToolsRaw);

    setIsTesting(true);
    let tools: McpToolSummary[] = [];
    try {
      const response = await fetch('/api/mcp/list-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl,
          headers: draft.headers,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect to the MCP server.');
      }
      tools = Array.isArray(data.tools) ? data.tools : [];
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to this MCP server.');
      setIsTesting(false);
      return;
    }

    const newServer: McpServerConfig = {
      id: uuidv4(),
      label,
      serverUrl,
      headers: draft.headers.filter((header) => header.key && header.value),
      allowedTools,
      category: draft.category,
      sourceId: draft.connectorId,
      notes: draft.notes.trim() || undefined,
      status: 'connected',
      tools,
      lastCheckedAt: new Date().toISOString(),
    };

    onServersChange([...servers, newServer]);
    setIsTesting(false);
    setIsOpen(false);
    resetDraft();
  };

  const handleDelete = (id: string) => {
    onServersChange(servers.filter((server) => server.id !== id));
  };

  const normalizeHeadersForRequest = () =>
    draft.headers
      .filter((header) => header.key && header.value)
      .map((header) => ({ id: header.id, key: header.key.trim(), value: header.value.trim() }));

  const handleAuthorize = async () => {
    if (!draft.serverUrl.trim()) {
      setAuthInfoError('Enter the server URL first.');
      return;
    }
    if (typeof window === 'undefined') {
      setAuthInfoError('OAuth flow is only available in the browser.');
      return;
    }

    setAuthInfoError('');
    setIsAuthorizing(true);

    try {
      const existingInfo = authInfo;
      let metadata = existingInfo;
      if (!metadata?.authorize_url || !metadata?.token_url) {
        const fetched = await fetchAuthInfo(draft.serverUrl, normalizeHeadersForRequest());
        metadata = fetched || null;
      }

      if (!metadata?.authorize_url || !metadata?.token_url) {
        throw new Error('Unable to determine authorization and token endpoints.');
      }

      const redirectUri = `${window.location.origin}/oauth/callback`;

      const registerResponse = await fetch('/api/mcp/oauth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl: draft.serverUrl,
          headers: normalizeHeadersForRequest(),
          clientName: draft.label || currentDefinition?.name || 'Workspace MCP Client',
          redirectUri,
        }),
      });

      const registerData = await registerResponse.json();
      if (!registerResponse.ok) {
        throw new Error(registerData?.error || 'Failed to register OAuth client.');
      }

      const codeVerifier = generateRandomString(96);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      const rawMetadata = (metadata.raw ?? {}) as any;
      const scopes = Array.isArray(rawMetadata?.scopes_supported) && rawMetadata.scopes_supported.length
        ? (rawMetadata.scopes_supported as string[])
        : ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];

      const authorizeParams = new URLSearchParams({
        response_type: 'code',
        client_id: registerData.client_id,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      });

      const sessionPayload: PendingOAuthSession = {
        tokenUrl: metadata.token_url,
        clientId: registerData.client_id,
        clientSecret: registerData.client_secret,
        codeVerifier,
        redirectUri,
        serverUrl: draft.serverUrl,
        serverLabel: draft.label,
        serviceName: currentDefinition?.name,
        createdAt: Date.now(),
      };

      try {
        const storage = window.localStorage;
        storage.setItem(`mcp_oauth_state_${state}`, JSON.stringify(sessionPayload));

        // Clean up any stale sessions (older than 15 minutes)
        const now = Date.now();
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (!key || !key.startsWith('mcp_oauth_state_')) continue;
          try {
            const stored = JSON.parse(storage.getItem(key) || '{}') as { createdAt?: number };
            if (typeof stored.createdAt === 'number' && now - stored.createdAt > 15 * 60 * 1000) {
              storage.removeItem(key);
            }
          } catch {
            storage.removeItem(key);
          }
        }
      } catch {
        // Ignore storage failures; callback will fail gracefully if data missing
      }

      setAuthInfo((prev) => ({
        ...(prev || {}),
        authorize_url: metadata?.authorize_url,
        token_url: metadata?.token_url,
        raw: metadata?.raw,
        source: metadata?.source,
      }));

      const authorizeUrl = `${metadata.authorize_url}?${authorizeParams.toString()}`;
      window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setAuthInfoError(err?.message || 'Failed to launch authorization.');
      setIsAuthorizing(false);
    }
  };

  const handleCheckAuth = () => {
    if (!draft.serverUrl) {
      setAuthInfoError('Enter the server URL first.');
      return;
    }
    void fetchAuthInfo(draft.serverUrl);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'mcp-oauth-complete') {
        const token = typeof event.data.token === 'string' ? event.data.token : undefined;
        if (token) {
          setDraft((prev) => {
            const filtered = prev.headers.filter(
              (header) => header.key.toLowerCase() !== 'authorization',
            );
            return {
              ...prev,
              headers: [
                ...filtered,
                {
                  id: uuidv4(),
                  key: 'Authorization',
                  value: `Bearer ${token}`,
                },
              ],
            };
          });
          setAuthInfo((prev) => ({
            ...(prev || {}),
            authorize_url: prev?.authorize_url,
            token_url: prev?.token_url,
            mode: prev?.mode ?? 'oauth2.1',
          }));
          setAuthInfoError('');
        }
        setIsAuthorizing(false);
      }

      if (event.data.type === 'mcp-oauth-error') {
        const message =
          typeof event.data.error === 'string'
            ? event.data.error
            : 'Authorization flow was cancelled or failed.';
        setAuthInfoError(message);
        setIsAuthorizing(false);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleOpen}
        className="border border-gray-300 rounded-lg px-3 py-1 text-base font-normal hover:bg-gray-100"
      >
        MCP Servers
      </button>

      {servers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {servers.map((server) => (
            <div
              key={server.id}
              className="border border-gray-200 rounded-full px-3 py-1 text-sm flex items-center gap-2 bg-white"
            >
              <span className="font-medium text-gray-700">{server.label}</span>
              {server.status === 'connected' && (
                <span className="text-xs text-green-700">
                  {server.tools?.length
                    ? `${server.tools.length} tool${server.tools.length === 1 ? '' : 's'}`
                    : 'connected'}
                </span>
              )}
              {server.status === 'error' && (
                <span className="text-xs text-red-600">connection failed</span>
              )}
              <button
                type="button"
                className="text-gray-500 hover:text-red-600"
                onClick={() => handleDelete(server.id)}
                aria-label={`Remove ${server.label}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">Add MCP Server</h2>
                <p className="text-sm text-gray-600">
                  Configure remote Model Context Protocol connectors. Provide the server URL and any required headers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {servers.length > 0 && (
                <div className="border border-gray-200 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <p className="font-medium text-gray-800">Existing connectors</p>
                  <ul className="mt-2 space-y-2">
                    {servers.map((server) => (
                      <li key={`${server.id}-summary`} className="border border-gray-200 rounded-md bg-white px-3 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-800">{server.label}</div>
                            <div className="text-xs text-gray-500 break-all">{server.serverUrl}</div>
                          </div>
                          <span
                            className={
                              server.status === 'connected'
                                ? 'text-xs text-green-700'
                                : 'text-xs text-red-600'
                            }
                          >
                            {server.status === 'connected' ? 'Connected' : 'Error'}
                          </span>
                        </div>
                        {server.tools?.length ? (
                          <ul className="mt-1 text-xs text-gray-600 space-y-1 list-disc list-inside">
                            {server.tools.map((tool) => (
                              <li key={`${server.id}-${tool.name}`}>
                                <span className="font-medium text-gray-700">{tool.name}</span>
                                {tool.description ? ` – ${tool.description}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            No tools were returned during the last check.
                          </p>
                        )}
                        {server.lastCheckedAt && (
                          <p className="mt-1 text-[11px] text-gray-400">
                            Last checked {new Date(server.lastCheckedAt).toLocaleString()}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connector template
                  </label>
                  <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={draft.connectorId}
                  onChange={(event) => handleConnectorSelect(event.target.value)}
                >
                  {renderConnectorOptionGroup('OpenAI connectors', groupedCatalog.openai)}
                  {renderConnectorOptionGroup('Other developers', groupedCatalog.thirdParty)}
                  {renderConnectorOptionGroup('Custom', groupedCatalog.custom)}
                </select>
                {currentDefinition?.description && (
                  <p className="mt-1 text-sm text-gray-600">{currentDefinition.description}</p>
                )}
                {currentDefinition?.documentationUrl && (
                  <a
                    href={currentDefinition.documentationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                  >
                    View setup instructions
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <input
                    type="text"
                    value={draft.label}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, label: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Zapier workspace"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Server URL</label>
                  <input
                    type="url"
                    value={draft.serverUrl}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, serverUrl: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Headers
                  </label>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Add header
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.headers.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No headers configured. Add an Authorization header if the server requires credentials.
                    </p>
                  )}
                  {draft.headers.map((header) => (
                    <div key={header.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(event) =>
                          handleHeaderChange(header.id, 'key', event.target.value)
                        }
                        placeholder="Header name"
                        className="border border-gray-300 rounded-md px-3 py-2"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(event) =>
                          handleHeaderChange(header.id, 'value', event.target.value)
                        }
                        placeholder="Header value"
                        className="border border-gray-300 rounded-md px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(header.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allowed tools (optional)
                  </label>
                  <input
                    type="text"
                    value={draft.allowedToolsRaw}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, allowedToolsRaw: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="tool_one, tool_two"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Provide a comma-separated list to restrict which tools are exposed to the model.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Where credentials are stored"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {(authInfo || authInfoError) && (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {authInfo && (
                    <div className="space-y-1">
                      {authInfo.source && (
                        <p className="text-gray-500">Metadata source: {authInfo.source}</p>
                      )}
                      {authInfo.mode && (
                        <p className="text-gray-700">
                          Detected auth mode: <span className="font-medium">{authInfo.mode}</span>
                        </p>
                      )}
                      {authInfo.authorize_url && (
                        <p className="break-all">
                          authorize_url: <span className="font-mono text-[11px]">{authInfo.authorize_url}</span>
                        </p>
                      )}
                      {authInfo.token_url && (
                        <p className="break-all">
                          token_url: <span className="font-mono text-[11px]">{authInfo.token_url}</span>
                        </p>
                      )}
                      {authInfo.token_url && (
                        <p className="break-all">
                          token_url: <span className="font-mono text-[11px]">{authInfo.token_url}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {authInfoError && (
                    <p className="text-red-600">{authInfoError}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col items-end gap-2 pt-2">
                <div className="flex justify-end gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={handleCheckAuth}
                    className="px-4 py-2 text-sm text-gray-700 underline-offset-2 hover:underline disabled:text-gray-400"
                    disabled={isAuthInfoLoading}
                  >
                    {isAuthInfoLoading ? 'Checking auth…' : 'Check auth configuration'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    disabled={isTesting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-70"
                    disabled={isTesting}
                  >
                    {isTesting ? 'Testing…' : 'Save server'}
                  </button>
                </div>
                {(currentDefinition?.authUrl || authInfo?.authorize_url) && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={handleAuthorize}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isAuthorizing}
                    >
                      {isAuthorizing
                        ? 'Waiting for authorization…'
                        : currentDefinition?.authButtonLabel ?? 'Authorize connector'}
                    </button>
                    {(currentDefinition?.authHelpText || authInfo?.mode) && (
                      <p className="text-xs text-gray-500 text-right max-w-sm">
                        {currentDefinition?.authHelpText ?? `Detected ${authInfo?.mode ?? 'authentication'} flow from /auth/info. Complete the browser flow and copy any tokens the server returns.`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
