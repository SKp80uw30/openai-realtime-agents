import { NextResponse } from "next/server";

import type { McpServerRequestPayload } from "@/app/types/mcp";

interface SessionRequestBody {
  mcpServers?: McpServerRequestPayload[];
}

async function createRealtimeSession(body: SessionRequestBody = {}) {
  try {
    const { mcpServers = [] } = body;
    const tools = mcpServers.length
      ? mcpServers.map((server) => ({
          type: 'mcp',
          server_label: server.label,
          server_url: server.server_url,
          headers: server.headers,
          allowed_tools: server.allowed_tools,
        }))
      : undefined;

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
          ...(tools ? { tools } : {}),
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let payload: SessionRequestBody = {};
  try {
    payload = await request.json();
  } catch (error) {
    // Ignore JSON parse errors and fall back to defaults.
    console.warn('No JSON payload provided for /session request', error);
  }

  return createRealtimeSession(payload);
}

export async function GET() {
  return createRealtimeSession();
}
