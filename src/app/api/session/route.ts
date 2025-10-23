import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

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
          require_approval: 'never',  // Auto-execute MCP calls without approval (we trust this server)
        }))
      : undefined;

    const sessionPayload = {
      model: "gpt-4o-realtime-preview-2025-06-03",
      ...(tools ? { tools } : {}),
    };

    // Log what we're sending to OpenAI (redact auth tokens for security)
    console.log('[Session Create] Sending to OpenAI:', JSON.stringify({
      ...sessionPayload,
      tools: sessionPayload.tools?.map((t: any) => ({
        ...t,
        headers: t.headers ? Object.keys(t.headers) : undefined, // Only show header keys, not values
      })),
    }, null, 2));

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionPayload),
      }
    );
    const data = await response.json();

    console.log('[Session Create] OpenAI response status:', response.status);
    if (!response.ok) {
      console.error('[Session Create] OpenAI error:', JSON.stringify(data, null, 2));
    }

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return createRealtimeSession();
}
