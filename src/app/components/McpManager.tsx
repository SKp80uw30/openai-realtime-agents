'use client';

import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { MCP_CONNECTOR_CATALOG } from '@/app/data/mcpCatalog';
import type {
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

export default function McpManager({ servers, onServersChange }: McpManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DraftServerState>(() => ({ ...DEFAULT_STATE }));
  const [error, setError] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

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
  };

  const handleOpen = () => {
    resetDraft();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConnectorSelect = (id: string) => {
    const definition = MCP_CONNECTOR_CATALOG.find((item) => item.id === id);
    setDraft((prev) => ({
      ...prev,
      connectorId: id,
      category: definition?.category ?? prev.category,
      serverUrl: definition?.serverUrl ?? prev.serverUrl,
      headers: definition?.defaultHeaders
        ? Object.entries(definition.defaultHeaders).map(([key, value]) => ({
            id: uuidv4(),
            key,
            value,
          }))
        : prev.headers,
    }));
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

              <div className="flex justify-end gap-3 pt-2">
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
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
