import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import OpenAI from "openai";

import type { McpServerRequestPayload } from "@/app/types/mcp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SessionRequestBody {
  model?: string;
  mcpServers?: McpServerRequestPayload[];
}

async function createRealtimeSession(body: SessionRequestBody = {}) {
  try {
    const { model = 'gpt-realtime-mini', mcpServers = [] } = body;
    const tools = mcpServers.length
      ? mcpServers.map((server) => ({
          type: 'mcp' as const,
          server_label: server.label,
          server_url: server.server_url,
          headers: server.headers,
          allowed_tools: server.allowed_tools,
          require_approval: 'never' as const,  // Auto-execute MCP calls without approval (we trust this server)
        }))
      : undefined;

    const sessionConfig = {
      type: 'realtime' as const,
      model,
      output_modalities: ['audio' as const],
      audio: {
        input: {
          format: { type: 'audio/pcm' as const, rate: 24000 },
          transcription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        output: {
          format: { type: 'audio/pcm' as const, rate: 24000 },
        },
      },
      ...(tools ? { tools } : {}),
    };

    // Log what we're sending to OpenAI (redact auth tokens for security)
    console.log('[Session Create] Sending to OpenAI:', JSON.stringify({
      ...sessionConfig,
      tools: sessionConfig.tools?.map((t: any) => ({
        ...t,
        headers: t.headers ? Object.keys(t.headers) : undefined, // Only show header keys, not values
      })),
    }, null, 2));

    const data = await openai.realtime.clientSecrets.create({
      session: sessionConfig as any,
    });

    return NextResponse.json({
      client_secret: {
        value: data.value,
        expires_at: data.expires_at,
      },
      session: data.session,
    });
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
