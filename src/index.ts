#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isConfigured, publishImage, publishText } from "./linkedin.js";
import { authorizationUrl, exchangeCode, fetchIdentity, runOAuthCallback } from "./oauth.js";
import { normalizeDiagram } from "./diagram.js";

const server = new McpServer({ name: "linkedin-mcp", version: "0.3.0" });
let pendingConnection: Promise<string> | undefined;

server.tool("linkedin_connection_status", "Check LinkedIn publishing configuration without exposing credentials.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ configured: isConfigured() }) }] }));

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
  process.env.LINKEDIN_ACCESS_TOKEN = token.accessToken;
  process.env.LINKEDIN_PERSON_URN = `urn:li:person:${identity.sub}`;
  return { content: [{ type: "text", text: JSON.stringify({ connected: true, name: identity.name, expiresIn: token.expiresIn }) }] };
});

server.tool("prepare_linkedin_post", "Prepare a LinkedIn post for human review. This never publishes.", { text: z.string().min(1).max(3000), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => ({ content: [{ type: "text", text: JSON.stringify({ status: "awaiting_approval", text, imagePath, altText, published: false }) }] }));

const diagramNode = z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(120) });
const diagramEdge = z.object({ from: z.string().min(1).max(40), to: z.string().min(1).max(40), label: z.string().max(80).optional() });

server.tool(
  "prepare_handwritten_diagram",
  "Prepare and validate a handwritten-style diagram specification for human review. This does not render or publish anything.",
  {
    title: z.string().min(1).max(120),
    nodes: z.array(diagramNode).min(2).max(12),
    edges: z.array(diagramEdge).max(20),
    footer: z.string().max(160).optional(),
  },
  async ({ title, nodes, edges, footer }) => {
    const diagram = normalizeDiagram({ title, nodes, edges, footer });
    return { content: [{ type: "text", text: JSON.stringify({ status: "awaiting_render", style: "handwritten", diagram, rendered: false, published: false }) }] };
  },
);

server.tool("publish_linkedin_post", "Publish an already-reviewed LinkedIn post only after explicit human approval.", { text: z.string().min(1).max(3000), approved: z.literal(true), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => {
  const postId = imagePath ? await publishImage(text, imagePath, altText) : await publishText(text);
  return { content: [{ type: "text", text: JSON.stringify({ status: "published", postId }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
