import { NextResponse } from "next/server";

interface TokenRequestBody {
  tokenUrl: string;
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function POST(request: Request) {
  let payload: TokenRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tokenUrl, code, codeVerifier, clientId, clientSecret, redirectUri } =
    payload ?? {};

  if (!tokenUrl || !code || !codeVerifier || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "tokenUrl, code, codeVerifier, clientId, clientSecret, and redirectUri are required" },
      { status: 400 },
    );
  }

  let formattedTokenUrl: URL;
  try {
    formattedTokenUrl = new URL(tokenUrl);
  } catch {
    return NextResponse.json({ error: "tokenUrl must be a valid URL" }, { status: 400 });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await fetch(formattedTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      let message = `Token request failed with status ${response.status}`;
      try {
        const errorPayload = JSON.parse(text);
        if (typeof errorPayload?.error_description === "string") {
          message = `${message}: ${errorPayload.error_description}`;
        } else if (typeof errorPayload?.error === "string") {
          message = `${message}: ${errorPayload.error}`;
        }
      } catch {
        // ignore parse errors
      }
      return NextResponse.json({ error: message }, { status: response.status });
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Token response was not valid JSON" },
        { status: 502 },
      );
    }
  } catch (error: any) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to exchange authorization code";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

