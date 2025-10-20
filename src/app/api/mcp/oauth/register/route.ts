import { NextResponse } from "next/server";

import type { McpServerHeader } from "@/app/types/mcp";

interface RegisterRequestBody {
  serverUrl: string;
  headers?: McpServerHeader[];
  clientName?: string;
  redirectUri: string;
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
  let payload: RegisterRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.serverUrl) {
    return NextResponse.json({ error: "serverUrl is required" }, { status: 400 });
  }

  if (!payload?.redirectUri) {
    return NextResponse.json({ error: "redirectUri is required" }, { status: 400 });
  }

  let baseUrl: URL;
  try {
    const parsed = new URL(payload.serverUrl);
    baseUrl = new URL(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return NextResponse.json({ error: "serverUrl must be a valid URL" }, { status: 400 });
  }

  const body = {
    redirect_uris: [payload.redirectUri],
    client_name: payload.clientName ?? "Orby Realtime",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  };

  try {
    const response = await fetch(new URL("/register", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serializeHeaders(payload.headers) ?? {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      let message = `Registration failed with status ${response.status}`;
      try {
        const errorPayload = JSON.parse(text);
        if (typeof errorPayload?.error === "string") {
          message = `${message}: ${errorPayload.error}`;
        }
      } catch {
        // ignore parse errors
      }
      return NextResponse.json({ error: message }, { status: response.status });
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Registration response was not valid JSON" },
        { status: 502 },
      );
    }
  } catch (error: any) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to register OAuth client";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

