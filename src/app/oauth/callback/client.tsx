"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

interface StoredAuthSession {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
  redirectUri: string;
  serverUrl: string;
  serverLabel?: string;
  serviceName?: string;
  createdAt: number;
}

type StatusState =
  | { type: "idle" }
  | { type: "exchanging" }
  | { type: "success"; message?: string }
  | { type: "error"; message: string };

function getSessionData(state: string): StoredAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`mcp_oauth_state_${state}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
}

function clearSessionData(state: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`mcp_oauth_state_${state}`);
}

export default function OAuthCallbackClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const query = useMemo(() => {
    if (!searchParams) return null;
    const code = searchParams.get("code") || undefined;
    const state = searchParams.get("state") || undefined;
    const error = searchParams.get("error") || undefined;
    const errorDescription = searchParams.get("error_description") || undefined;
    return { code, state, error, errorDescription };
  }, [searchParams]);

  useEffect(() => {
    if (!query) return;

    const notifyError = (message: string) => {
      setStatus({ type: "error", message });
      if (query.state) {
        clearSessionData(query.state);
      }
      if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "mcp-oauth-error",
            state: query.state,
            error: message,
          },
          window.location.origin,
        );
      }
    };

    if (query.error) {
      const message = query.errorDescription
        ? `${query.error}: ${query.errorDescription}`
        : query.error;
      notifyError(message);
      return;
    }

    if (!query.code || !query.state) {
      notifyError("Missing authorization response parameters.");
      return;
    }

    const sessionData = getSessionData(query.state);
    if (!sessionData) {
      notifyError("Authorization session has expired or is invalid.");
      return;
    }

    const exchange = async () => {
      setStatus({ type: "exchanging" });
      try {
        const response = await fetch("/api/mcp/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tokenUrl: sessionData.tokenUrl,
            code: query.code,
            codeVerifier: sessionData.codeVerifier,
            clientId: sessionData.clientId,
            clientSecret: sessionData.clientSecret,
            redirectUri: sessionData.redirectUri,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to exchange authorization code.");
        }

        clearSessionData(query.state!);

        if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "mcp-oauth-complete",
              state: query.state,
              token: data.access_token,
              refreshToken: data.refresh_token,
              expiresIn: data.expires_in,
              tokenType: data.token_type,
              serverUrl: sessionData.serverUrl,
              serverLabel: sessionData.serverLabel,
              serviceName: sessionData.serviceName,
              issuedAt: Date.now(),
            },
            window.location.origin,
          );
        }

        setStatus({ type: "success", message: "Authorization successful. You may close this window." });
      } catch (error: any) {
        const message =
          error?.message || "An unexpected error occurred while completing authorization.";
        notifyError(message);
      }
    };

    void exchange();
  }, [query]);

  const title = useMemo(() => {
    switch (status.type) {
      case "exchanging":
        return "Finalizing authorization";
      case "success":
        return "Authorization complete";
      case "error":
        return "Authorization error";
      default:
        return "Processing";
    }
  }, [status.type]);

  const message = useMemo(() => {
    switch (status.type) {
      case "exchanging":
        return "Exchanging authorization code for access token…";
      case "success":
        return status.message || "Success";
      case "error":
        return status.message;
      default:
        return "Preparing to complete authorization…";
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center justify-center p-6">
      <div className="bg-white shadow-md rounded-lg max-w-lg w-full p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
        {(status.type === "success" || status.type === "error") && (
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close window
          </button>
        )}
      </div>
    </div>
  );
}
