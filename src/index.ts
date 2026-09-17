#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isConfigured, publishImage, publishText } from "./linkedin.js";
import { authorizationUrl, exchangeCode, fetchIdentity, runOAuthCallback } from "./oauth.js";
import { loadToken, saveToken, tokenExpiryIso } from "./tokenStore.js";

// Restore a previously-completed connection on startup. Without this, every
// restart of this process (app restart, sleep, the MCP host recycling local
// server connections) wiped process.env and forced a fresh OAuth run.
const restored = loadToken();
if (restored) {
  process.env.LINKEDIN_ACCESS_TOKEN = restored.accessToken;
  process.env.LINKEDIN_PERSON_URN = restored.personUrn;
}

const server = new McpServer({ name: "linkedin-mcp", version: "0.4.0" });
let pendingConnection: Promise<string> | undefined;

server.tool("linkedin_connection_status", "Check LinkedIn publishing configuration without exposing credentials.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ configured: isConfigured(), tokenExpiresAt: tokenExpiryIso() }) }] }));

server.tool("start_linkedin_connection", "Start LinkedIn OAuth and return the authorization URL.", {}, async () => {
  const auth = authorizationUrl();
  pendingConnection = runOAuthCallback(auth.state);
  return { content: [{ type: "text", text: JSON.stringify({ authorizationUrl: auth.url, redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "http://127.0.0.1:8787/callback" }) }] };
});

server.tool("complete_linkedin_connection", "Complete LinkedIn OAuth after authorization in the browser.", {}, async () => {
  if (!pendingConnection) throw new Error("Run start_linkedin_connection first");
  const code = await pendingConnection;
  pendingConnection = undefined;
  const token = await exchangeCode(code);
  const identity = await fetchIdentity(token.accessToken);
  const personUrn = `urn:li:person:${identity.sub}`;
  process.env.LINKEDIN_ACCESS_TOKEN = token.accessToken;
  process.env.LINKEDIN_PERSON_URN = personUrn;
  // Persist to disk so this survives a restart of this process, not just this run.
  saveToken({ accessToken: token.accessToken, personUrn, expiresAt: Date.now() + token.expiresIn * 1000 });
  return { content: [{ type: "text", text: JSON.stringify({ connected: true, name: identity.name, expiresIn: token.expiresIn }) }] };
});

server.tool("prepare_linkedin_post", "Prepare a LinkedIn post for human review. This never publishes.", { text: z.string().min(1).max(3000), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => ({ content: [{ type: "text", text: JSON.stringify({ status: "awaiting_approval", text, imagePath, altText, published: false }) }] }));

server.tool("publish_linkedin_post", "Publish an already-reviewed LinkedIn post only after explicit human approval.", { text: z.string().min(1).max(3000), approved: z.literal(true), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => {
  const postId = imagePath ? await publishImage(text, imagePath, altText) : await publishText(text);
  return { content: [{ type: "text", text: JSON.stringify({ status: "published", postId }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
