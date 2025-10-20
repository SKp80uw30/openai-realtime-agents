import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { McpServerHeader } from "@/app/types/mcp";

interface StartAuthRequestBody {
  serverUrl: string;
  headers?: McpServerHeader[];
  serviceName?: string;
  userEmail?: string;
}

function serializeHeaders(headers: McpServerHeader[] | undefined) {
  if (!headers || headers.length === 0) return undefined;

  const clean: Record<string, string> = {};
  headers.forEach((header) => {
    if (header.key && header.value) {
      clean[header.key] = header.value;
    }
  });

  return Object.keys(clean).length ? clean : undefined;
}

function extractAuthUrl(message: string): string | undefined {
  const urlMatch = message.match(/https?:\/\/[\S]+/);
  if (!urlMatch) return undefined;

  // Trim trailing punctuation that may be included in markdown
  return urlMatch[0].replace(/[)\]\.,]+$/, "");
}

export async function POST(request: Request) {
  let payload: StartAuthRequestBody;
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
    name: "orby-realtime-mcp",
    version: "1.0.0",
  });

  try {
    await client.connect(transport, { timeout: 15_000 });

    const argumentsObject: Record<string, any> = {};
    if (payload.serviceName) {
      argumentsObject.service_name = payload.serviceName;
    }
    if (payload.userEmail) {
      argumentsObject.user_google_email = payload.userEmail;
    }

    const result = await client.callTool({
      name: "start_google_auth",
      arguments: argumentsObject,
    });

    const outputSegments = Array.isArray(result.content)
      ? result.content
          .filter((item: any) => typeof item?.text === "string")
          .map((item: any) => item.text as string)
      : [];

    const combinedMessage = outputSegments.join("\n");
    const authUrl = extractAuthUrl(combinedMessage);

    return NextResponse.json(
      {
        authUrl,
        message: combinedMessage,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Failed to start MCP auth flow", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to start auth flow";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    try {
      await transport.close();
    } catch (closeError) {
      console.warn("Failed to close MCP auth transport", closeError);
    }
  }
}

