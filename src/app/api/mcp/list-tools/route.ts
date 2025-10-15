import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { McpServerHeader, McpToolSummary } from "@/app/types/mcp";

interface ListToolsRequestBody {
  serverUrl: string;
  headers?: McpServerHeader[];
}

function serializeHeaders(headers: McpServerHeader[] | undefined): Record<string, string> | undefined {
  if (!headers || headers.length === 0) return undefined;
  const cleanHeaders: Record<string, string> = {};
  headers.forEach((header) => {
    if (header.key && header.value) {
      cleanHeaders[header.key] = header.value;
    }
  });
  return cleanHeaders;
}

export async function POST(request: Request) {
  let payload: ListToolsRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.serverUrl) {
    return NextResponse.json({ error: "serverUrl is required" }, { status: 400 });
  }

  let serverUrl: URL;
  try {
    serverUrl = new URL(payload.serverUrl);
  } catch {
    return NextResponse.json({ error: "serverUrl must be a valid URL" }, { status: 400 });
  }

  const transport = new StreamableHTTPClientTransport(serverUrl, {
    requestInit: {
      headers: serializeHeaders(payload.headers),
    },
  });

  const client = new Client({
    name: "orby-realtime-mcp-tester",
    version: "1.0.0",
  });

  try {
    await client.connect(transport, { timeout: 10_000 });
    const result = await client.listTools({});

    const tools: McpToolSummary[] = (result.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description ?? undefined,
    }));

    return NextResponse.json({ tools, server: result.server }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to list MCP tools", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof error === "string"
        ? error
        : "Unable to list tools for this MCP server";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    try {
      await transport.close();
    } catch (closeError) {
      console.warn("Failed to close MCP transport", closeError);
    }
  }
}
