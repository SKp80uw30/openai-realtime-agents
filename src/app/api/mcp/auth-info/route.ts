import { NextResponse } from "next/server";

import type { McpServerHeader } from "@/app/types/mcp";

interface AuthInfoRequestBody {
  serverUrl: string;
  headers?: McpServerHeader[];
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

export async function POST(request: Request) {
  let payload: AuthInfoRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.serverUrl) {
    return NextResponse.json({ error: "serverUrl is required" }, { status: 400 });
  }

  let baseUrl: URL;
  try {
    const parsed = new URL(payload.serverUrl);
    baseUrl = new URL(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return NextResponse.json({ error: "serverUrl must be a valid URL" }, { status: 400 });
  }

  const headers = {
    Accept: "application/json",
    ...(serializeHeaders(payload.headers) ?? {}),
  };

  try {
    const response = await fetch(new URL("/auth/info", baseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      let message = `Server returned ${response.status}`;
      try {
        const errorPayload = JSON.parse(text);
        if (typeof errorPayload?.error === "string") {
          message = errorPayload.error;
        }
      } catch {
        // ignore parse errors, fall back to default message
      }
      return NextResponse.json({ error: message }, { status: response.status });
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Auth info response was not valid JSON" },
        { status: 502 },
      );
    }
  } catch (error: any) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to fetch auth info from MCP server";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

