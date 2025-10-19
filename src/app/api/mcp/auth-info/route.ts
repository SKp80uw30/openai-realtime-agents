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

  const candidates = [
    "/.well-known/oauth-authorization-server",
    "/auth/info",
  ];

  try {
    let lastError: { message: string; status: number } | null = null;

    for (const path of candidates) {
      const response = await fetch(new URL(path, baseUrl), {
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
          // ignore parse errors
        }
        lastError = { message, status: response.status };
        continue;
      }

      try {
        const data = JSON.parse(text);

        const authorizationEndpoint: string | undefined =
          data.authorization_endpoint ?? data.authorize_url;
        const tokenEndpoint: string | undefined =
          data.token_endpoint ?? data.token_url;

        const normalizedAuthEndpoint = normalizeEndpoint(
          authorizationEndpoint,
          baseUrl,
        );
        const normalizedTokenEndpoint = normalizeEndpoint(
          tokenEndpoint,
          baseUrl,
        );

        return NextResponse.json(
          {
            raw: data,
            authorize_url: normalizedAuthEndpoint,
            token_url: normalizedTokenEndpoint,
            source: path,
          },
          { status: 200 },
        );
      } catch {
        lastError = {
          message: "Auth info response was not valid JSON",
          status: 502,
        };
        continue;
      }
    }

    if (lastError) {
      return NextResponse.json(
        { error: lastError.message },
        { status: lastError.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to fetch auth metadata from MCP server" },
      { status: 502 },
    );
  } catch (error: any) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to fetch auth info from MCP server";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function normalizeEndpoint(endpoint: string | undefined, baseUrl: URL) {
  if (!endpoint) return undefined;

  try {
    const parsed = new URL(endpoint);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return new URL(parsed.pathname + parsed.search + parsed.hash, baseUrl).toString();
    }
    return parsed.toString();
  } catch {
    try {
      return new URL(endpoint, baseUrl).toString();
    } catch {
      return endpoint;
    }
  }
}
