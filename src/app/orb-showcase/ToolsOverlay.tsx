"use client";

import { useState } from 'react';
import type { McpServerConfig } from '@/app/types/mcp';
import GoogleWorkspaceConnector from './GoogleWorkspaceConnector';

interface Props {
  servers: McpServerConfig[];
  onClose: () => void;
  onConnected: (servers: McpServerConfig[]) => void;
}

function summarizeToolDescription(description?: string): string {
  if (!description) return '';
  return description.split(/\n\s*Args\s*:/i)[0].trim();
}

export function ToolsOverlay({ servers, onClose, onConnected }: Props) {
  const [showConnect, setShowConnect] = useState(false);

  const totalTools = servers.reduce((sum, server) => sum + (server.tools?.length ?? 0), 0);

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cyan-100">Tools</h2>
          <p className="text-sm text-slate-300/80">
            Connect new tools or review what&apos;s currently available to your orb.
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-cyan-400/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Connect Tools</p>
          </div>
          <p className="mt-2 text-sm text-slate-300/80">
            Authorize a new connector to give your orb more tools.
          </p>
          <button
            type="button"
            onClick={() => setShowConnect(true)}
            className="mt-4 w-full rounded-full border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Connect a tool
          </button>
        </div>

        <div className="rounded-xl border border-slate-200/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Connected Tools</p>
            <span className="rounded-full border border-slate-200/20 bg-slate-800/60 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-200">
              {totalTools}
            </span>
          </div>

          {servers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400/80">0 tools connected yet.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
              {servers.map((server) => (
                <li key={server.id} className="rounded-lg border border-slate-200/10 bg-slate-800/40 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-100">{server.label}</span>
                    <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
                      {server.tools?.length ?? 0} tool{(server.tools?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                  {server.tools && server.tools.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-300/80">
                      {server.tools.map((tool) => (
                        <li key={`${server.id}-${tool.name}`}>
                          <span className="font-medium text-slate-200">{tool.name}</span>
                          {tool.description ? ` — ${summarizeToolDescription(tool.description)}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400/70">No tools reported for this connector.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <GoogleWorkspaceConnector
            servers={servers}
            onClose={() => setShowConnect(false)}
            onConnected={(updatedServers) => {
              onConnected(updatedServers);
              setShowConnect(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ToolsOverlay;
