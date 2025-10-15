# Deployment Guide (Railway)

This project is a Next.js 15 app that exposes both the UI and a few API routes (for session key generation, MCP tests, etc.). Railway can build and serve it with the standard Node buildpack (Nixpacks). Follow these steps when you are ready to deploy:

## 1. Prerequisites

- Push the latest code to GitHub (or a repo Railway can reach).
- Ensure `npm run build` succeeds locally (done via CLI).
- Copy `.env.production.example` to `.env.production` if you want to test locally with production values.

## 2. Create a new Railway project

1. In the Railway dashboard choose **New Project → Deploy from GitHub repo**.
2. Select this repository.
3. Railway will detect Next.js automatically: build command `npm install && npm run build`, start command `npm run start`.

## 3. Configure environment variables

Add the following vars in the Railway project settings (Values tab):

| Variable          | Value (example)                           |
|-------------------|-------------------------------------------|
| `OPENAI_API_KEY`  | `sk-...`                                   |
| `NODE_ENV`        | `production`                               |
| (Optional) `MCP_ZAPIER_BEARER` | `Bearer ...` (if you want to pre-seed secrets server-side later) |

> The MCP modal still lets you paste headers manually; storing them in Railway is optional for now but useful if you later fetch them via an API route.

## 4. Deploy

Trigger a deploy from the Railway dashboard. The workflow is:

1. `npm install`
2. `npm run build`
3. `npm run start`

Railway will expose the app on an HTTPS domain (required for WebRTC). Once the deployment finishes you can open the URL and verify:

- The Personal Assistant scenario connects to the OpenAI Realtime API.
- The MCP modal works and can reach remote servers (network access is available in production).

## 5. Optional tweaks

- **Custom domain**: add a domain in Railway settings if you want your own hostname.
- **Logs**: use the Logs tab to monitor session or MCP errors while testing.
- **Secrets mgmt**: if you later move MCP tokens to server-side storage, add them as Railway variables and adjust the API routes accordingly.

That’s it—once the initial deploy is green you have a network-enabled runtime for realtime + MCP testing.
