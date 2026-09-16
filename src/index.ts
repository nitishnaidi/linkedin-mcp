#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isConfigured, publishImage, publishText } from "./linkedin.js";
import { authorizationUrl, exchangeCode, fetchIdentity, runOAuthCallback } from "./oauth.js";
import { normalizeDiagram } from "./diagram.js";
import { renderHandwrittenDiagram } from "./diagram-renderer.js";
import { cancelScheduledPost, claimDuePosts, completeScheduledPost, listScheduledPosts, scheduleApprovedPost } from "./scheduler.js";
const server = new McpServer({ name: "linkedin-mcp", version: "0.5.0" });
let pendingConnection: Promise<string> | undefined;
const diagramNode = z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(120) });
const diagramEdge = z.object({ from: z.string().min(1).max(40), to: z.string().min(1).max(40), label: z.string().max(80).optional() });
const diagramSchema = { title: z.string().min(1).max(120), nodes: z.array(diagramNode).min(2).max(12), edges: z.array(diagramEdge).max(20), footer: z.string().max(160).optional() };
server.tool("linkedin_connection_status", "Check LinkedIn publishing configuration without exposing credentials.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ configured: isConfigured() }) }] }));
server.tool("start_linkedin_connection", "Start LinkedIn OAuth and return the authorization URL.", {}, async () => { const auth = authorizationUrl(); pendingConnection = runOAuthCallback(auth.state); return { content: [{ type: "text", text: JSON.stringify({ authorizationUrl: auth.url, redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "http://127.0.0.1:8787/callback" }) }] }; });
server.tool("complete_linkedin_connection", "Complete LinkedIn OAuth after authorization in the browser.", {}, async () => { if (!pendingConnection) throw new Error("Run start_linkedin_connection first"); const code = await pendingConnection; pendingConnection = undefined; const token = await exchangeCode(code); const identity = await fetchIdentity(token.accessToken); process.env.LINKEDIN_ACCESS_TOKEN = token.accessToken; process.env.LINKEDIN_PERSON_URN = `urn:li:person:${identity.sub}`; return { content: [{ type: "text", text: JSON.stringify({ connected: true, name: identity.name, expiresIn: token.expiresIn }) }] }; });
server.tool("prepare_linkedin_post", "Prepare a LinkedIn post for human review. This never publishes.", { text: z.string().min(1).max(3000), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => ({ content: [{ type: "text", text: JSON.stringify({ status: "awaiting_approval", text, imagePath, altText, published: false }) }] }));
server.tool("prepare_handwritten_diagram", "Prepare and validate a handwritten-style diagram specification. This does not render or publish anything.", diagramSchema, async ({ title, nodes, edges, footer }) => { const diagram = normalizeDiagram({ title, nodes, edges, footer }); return { content: [{ type: "text", text: JSON.stringify({ status: "awaiting_render", style: "handwritten", diagram, rendered: false, published: false }) }] }; });
server.tool("render_handwritten_diagram", "Render a reviewed diagram specification to a LinkedIn-compatible local PNG for preview. This never publishes.", diagramSchema, async ({ title, nodes, edges, footer }) => { const diagram = normalizeDiagram({ title, nodes, edges, footer }); const imagePath = await renderHandwrittenDiagram(diagram); return { content: [{ type: "text", text: JSON.stringify({ status: "awaiting_approval", imagePath, mediaType: "image/png", diagram, published: false, next: "Preview this PNG. After approval, publish or schedule it." }) }] }; });
server.tool("publish_linkedin_post", "Publish an already-reviewed LinkedIn post only after explicit human approval.", { text: z.string().min(1).max(3000), approved: z.literal(true), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, imagePath, altText }) => { const postId = imagePath ? await publishImage(text, imagePath, altText) : await publishText(text); return { content: [{ type: "text", text: JSON.stringify({ status: "published", postId }) }] }; });
server.tool("schedule_linkedin_post", "Schedule an already-reviewed LinkedIn post. Explicit approval is required before it enters the persistent queue.", { text: z.string().min(1).max(3000), scheduledFor: z.string().min(1), approved: z.literal(true), imagePath: z.string().optional(), altText: z.string().max(4086).optional() }, async ({ text, scheduledFor, imagePath, altText }) => { const post = await scheduleApprovedPost({ text, scheduledFor, imagePath, altText }); return { content: [{ type: "text", text: JSON.stringify({ status: "scheduled", post }) }] }; });
server.tool("list_scheduled_linkedin_posts", "List persistent LinkedIn scheduled-post queue entries and their current states.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ posts: await listScheduledPosts() }) }] }));
server.tool("cancel_scheduled_linkedin_post", "Cancel a LinkedIn post that has not started publishing.", { id: z.string().uuid() }, async ({ id }) => ({ content: [{ type: "text", text: JSON.stringify({ status: "cancelled", post: await cancelScheduledPost(id) }) }] }));

async function publishDuePosts(): Promise<void> {
  if (!isConfigured()) return;
  for (const post of await claimDuePosts()) {
    try {
      const postId = post.imagePath ? await publishImage(post.text, post.imagePath, post.altText) : await publishText(post.text);
      await completeScheduledPost(post.id, { postId });
    } catch (error) {
      await completeScheduledPost(post.id, { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
const schedulerIntervalMs = Math.max(10_000, Number(process.env.LINKEDIN_MCP_SCHEDULER_INTERVAL_MS ?? 30_000));
const schedulerTimer = setInterval(() => { void publishDuePosts(); }, schedulerIntervalMs);
schedulerTimer.unref();
void publishDuePosts();
const transport = new StdioServerTransport();
await server.connect(transport);
