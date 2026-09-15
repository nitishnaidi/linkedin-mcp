import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const redirectUri = () => process.env.LINKEDIN_REDIRECT_URI ?? "http://127.0.0.1:8787/callback";

export function authorizationUrl(): { url: string; state: string } {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) throw new Error("LINKEDIN_CLIENT_ID is required");
  const state = randomBytes(24).toString("hex");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri(), state, scope: "openid profile w_member_social" });
  return { url: `https://www.linkedin.com/oauth/v2/authorization?${params}`, state };
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("LinkedIn client credentials are required");
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri() }) });
  if (!response.ok) throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  const data = await response.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function fetchIdentity(accessToken: string): Promise<{ sub: string; name?: string }> {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Identity lookup failed (${response.status}): ${await response.text()}`);
  return await response.json() as { sub: string; name?: string };
}

export async function runOAuthCallback(expectedState: string): Promise<string> {
  const uri = new URL(redirectUri());
  return await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? "/", `${uri.protocol}//${uri.host}`);
      if (requestUrl.pathname !== uri.pathname) { res.writeHead(404).end(); return; }
      const error = requestUrl.searchParams.get("error");
      const state = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("code");
      if (error || state !== expectedState || !code) { res.writeHead(400, { "Content-Type": "text/plain" }).end("LinkedIn authorization failed. You may close this window."); server.close(); reject(new Error(error ?? "Invalid OAuth callback")); return; }
      res.writeHead(200, { "Content-Type": "text/plain" }).end("LinkedIn connected. You may close this window and return to your MCP client.");
      server.close(); resolve(code);
    });
    server.on("error", reject);
    server.listen(Number(uri.port || 80), uri.hostname);
  });
}
