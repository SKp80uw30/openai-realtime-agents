"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MCP_CONNECTOR_CATALOG } from '@/app/data/mcpCatalog';
import type { McpAuthInfo, McpServerConfig, McpServerHeader, McpToolSummary } from '@/app/types/mcp';

const CONNECTOR = MCP_CONNECTOR_CATALOG.find((item) => item.id === 'google-workspace-mcp');
const SERVER_URL = CONNECTOR?.serverUrl ?? 'https://googleworkspacemcp-production.up.railway.app/mcp';
const DISPLAY_LABEL = 'GoogleWorkspace';

interface Props {
  servers: McpServerConfig[];
  onClose: () => void;
  onConnected: (servers: McpServerConfig[]) => void;
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

function generateRandomString(length = 64): string {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    return Array(length).fill('x').join('');
  }
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const result: string[] = [];
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

const DEFAULT_HEADERS: McpServerHeader[] = [];

export function GoogleWorkspaceConnector({ servers, onClose, onConnected }: Props) {
  const [authInfo, setAuthInfo] = useState<McpAuthInfo | null>(null);
  const [authInfoError, setAuthInfoError] = useState('');
  const [isAuthInfoLoading, setIsAuthInfoLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [headers, setHeaders] = useState<McpServerHeader[]>(DEFAULT_HEADERS);
  const [tokenReceived, setTokenReceived] = useState(false);

  const hasExistingServer = useMemo(
    () => servers.some((server) => server.serverUrl === SERVER_URL || server.label === DISPLAY_LABEL),
    [servers],
  );

  const fetchAuthInfo = useCallback(async (overrideHeaders?: McpServerHeader[]) => {
    const trimmed = SERVER_URL.trim();
    if (!trimmed) return null;

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
          headers: overrideHeaders ?? headers,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Server returned ${response.status}`);
      }
      const typed = data as McpAuthInfo;
      setAuthInfo(typed);
      return typed;
    } catch (error: any) {
      const message = error?.message || 'Unable to fetch authorization metadata.';
      setAuthInfo(null);
      setAuthInfoError(message);
      return null;
    } finally {
      setIsAuthInfoLoading(false);
    }
  }, [headers]);

  const normalizeHeaders = (list: McpServerHeader[]) =>
    list
      .filter((header) => header.key && header.value)
      .map((header) => ({
        ...header,
        key: header.key.trim(),
        value: header.value.trim(),
      }));

  const handleAuthorize = useCallback(async () => {
    if (!SERVER_URL) {
      setAuthInfoError('Server URL is not configured.');
      return;
    }
    if (typeof window === 'undefined') {
      setAuthInfoError('OAuth flow is only available in the browser.');
      return;
    }
    setGeneralError('');
    setAuthInfoError('');
    setIsAuthorizing(true);

    try {
      const existingInfo = authInfo;
      const metadata = existingInfo?.authorize_url ? existingInfo : await fetchAuthInfo();
      if (!metadata?.authorize_url || !metadata?.token_url) {
        throw new Error('Missing authorization endpoints for the Google Workspace MCP server.');
      }

      const redirectUri = `${window.location.origin}/oauth/callback`;

      const registerResponse = await fetch('/api/mcp/oauth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl: SERVER_URL,
          headers: normalizeHeaders(headers),
          clientName: DISPLAY_LABEL,
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
      const metadataScopes =
        Array.isArray(rawMetadata?.scopes_supported) && rawMetadata.scopes_supported.length
          ? (rawMetadata.scopes_supported as string[])
          : null;

      const defaultScopes = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
      const workspaceExtras = ['https://www.googleapis.com/auth/calendar.events'];
      const scopes = Array.from(new Set([...defaultScopes, ...workspaceExtras, ...(metadataScopes ?? [])]));

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
        serverUrl: SERVER_URL,
        serverLabel: DISPLAY_LABEL,
        serviceName: CONNECTOR?.name,
        createdAt: Date.now(),
      };

      try {
        const storage = window.localStorage;
        storage.setItem(`mcp_oauth_state_${state}`, JSON.stringify(sessionPayload));
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
        // ignore storage errors
      }

      const authorizeUrl = `${metadata.authorize_url}?${authorizeParams.toString()}`;
      const popup = window.open(
        authorizeUrl,
        'workspace-mcp-oauth',
        'width=600,height=750,resizable=yes,scrollbars=yes',
      );
      if (!popup) {
        throw new Error('Popup blocked. Allow popups and try again.');
      }
      popup.focus();
    } catch (error: any) {
      setAuthInfoError(error?.message || 'Failed to launch authorization.');
      setIsAuthorizing(false);
    }
  }, [authInfo, fetchAuthInfo, headers]);

  const handleSave = useCallback(async () => {
    if (!tokenReceived) {
      setGeneralError('Authorize Google Workspace first.');
      return;
    }
    setGeneralError('');
    setIsSaving(true);

    const normalisedHeaders = normalizeHeaders(headers);

    try {
      const response = await fetch('/api/mcp/list-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl: SERVER_URL,
          headers: normalisedHeaders,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to connect to Google Workspace MCP server.');
      }

      const tools: McpToolSummary[] = Array.isArray(data.tools) ? data.tools : [];

      const newServer: McpServerConfig = {
        id: uuidv4(),
        label: DISPLAY_LABEL,
        serverUrl: SERVER_URL,
        headers: normalisedHeaders,
        allowedTools: undefined,
        category: CONNECTOR?.category ?? 'thirdParty',
        sourceId: CONNECTOR?.id,
        notes: undefined,
        status: 'connected',
        tools,
        lastCheckedAt: new Date().toISOString(),
      };

      const updatedServers = hasExistingServer
        ? servers.map((existing) =>
            existing.serverUrl === SERVER_URL || existing.label === DISPLAY_LABEL
              ? newServer
              : existing,
          )
        : [...servers, newServer];

      onConnected(updatedServers);
      onClose();
    } catch (error: any) {
      setGeneralError(error?.message || 'Failed to save Google Workspace connector.');
    } finally {
      setIsSaving(false);
    }
  }, [headers, hasExistingServer, onClose, onConnected, servers, tokenReceived]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'mcp-oauth-complete') {
        const token = typeof event.data.token === 'string' ? event.data.token : undefined;
        if (token) {
          setHeaders([
            {
              id: uuidv4(),
              key: 'Authorization',
              value: `Bearer ${token}`,
            },
          ]);
          setTokenReceived(true);
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

  useEffect(() => {
    // Preload auth metadata on mount to reduce latency when user clicks authorize
    void fetchAuthInfo();
  }, [fetchAuthInfo]);

  return (
    <div className="w-full max-w-lg rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cyan-100">Connect Tools</h2>
          <p className="text-sm text-slate-300/80">
            Enable Google Workspace tools for your orb. This wizard handles the entire authorization flow for you.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200/20 bg-slate-800/60 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
        >
          Close
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-cyan-400/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">Google Workspace MCP</p>
              <p className="text-xs text-slate-400/80">Calendar, Gmail, Slack tools</p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-emerald-200">
              Selected
            </span>
          </div>
          {CONNECTOR?.documentationUrl && (
            <a
              href={CONNECTOR.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-cyan-200 underline decoration-dotted decoration-cyan-400/60"
            >
              View connector docs
            </a>
          )}
        </div>

        {authInfoError && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {authInfoError}
          </div>
        )}

        {generalError && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {generalError}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Step 1</p>
          <button
            type="button"
            onClick={handleAuthorize}
            disabled={isAuthorizing || isAuthInfoLoading}
            className="w-full rounded-full border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-400/20 disabled:bg-slate-700/40 disabled:text-slate-300"
          >
            {isAuthorizing ? 'Waiting for authorization…' : 'Authorize Google Workspace'}
          </button>
          <p className="text-xs text-slate-400/70">
            Launches the Google Workspace OAuth flow in a new window. Approve access and return here to finish.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Step 2</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-full border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-400/20 disabled:bg-slate-700/40 disabled:text-slate-300"
          >
            {isSaving ? 'Connecting…' : 'Save Server'}
          </button>
          <p className="text-xs text-slate-400/70">
            We’ll label it automatically as <span className="font-semibold">{DISPLAY_LABEL}</span> and test the connection before enabling tools.
          </p>
        </div>
      </div>

      {servers.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Existing connectors</p>
          <ul className="space-y-2 text-xs text-slate-300/80">
            {servers.map((server) => (
              <li key={server.id} className="rounded-lg border border-slate-200/10 bg-slate-900/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{server.label}</span>
                  <span className="uppercase tracking-[0.3em] text-[0.6rem] text-slate-400">{server.status}</span>
                </div>
                <p className="mt-1 break-words text-[0.65rem] text-slate-400/70">{server.serverUrl}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default GoogleWorkspaceConnector;
