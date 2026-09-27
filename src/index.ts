#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isConfigured, publishImage, publishText } from "./linkedin.js";
import { authorizationUrl, exchangeCode, fetchIdentity, runOAuthCallback } from "./oauth.js";
import { loadToken, saveToken, tokenExpiryIso } from "./tokenStore.js";
import { cancelQueued, dueEntries, enqueue, listQueue, markFailed, markPublished } from "./queue.js";

// Restore a previously-completed connection on startup. Without this, every
// restart of this process (app restart, sleep, the MCP host recycling local
// server connections) wiped process.env and forced a fresh OAuth run.
const restored = loadToken();
if (restored) {
  process.env.LINKEDIN_ACCESS_TOKEN = restored.accessToken;
  process.env.LINKEDIN_PERSON_URN = restored.personUrn;
}

const server = new McpServer({ name: "linkedin-mcp", version: "0.5.0" });
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

server.tool(
  "queue_linkedin_post",
  "Schedule an already human-approved LinkedIn post to publish automatically at a future time, no further confirmation asked. Stored on disk, so it survives this process restarting.",
  {
    text: z.string().min(1).max(3000),
    scheduledAt: z.string().describe("ISO 8601 timestamp for when to publish, e.g. 2026-09-18T18:00:00Z"),
    approved: z.literal(true),
    imagePath: z.string().optional(),
    altText: z.string().max(4086).optional(),
  },
  async ({ text, scheduledAt, imagePath, altText }) => {
    const when = Date.parse(scheduledAt);
    if (Number.isNaN(when)) throw new Error("scheduledAt must be a valid ISO 8601 timestamp");
    if (when <= Date.now()) throw new Error("scheduledAt must be in the future");
    const entry = enqueue({ text, imagePath, altText, scheduledAt: when });
    return { content: [{ type: "text", text: JSON.stringify({ queued: true, id: entry.id, scheduledAt: new Date(when).toISOString() }) }] };
  },
);

server.tool("list_queued_posts", "List every queued LinkedIn post and its status (pending, published, failed, canceled).", {}, async () => {
  const queue = listQueue();
  const summary = queue.map((p) => ({
    id: p.id,
    status: p.status,
    scheduledAt: new Date(p.scheduledAt).toISOString(),
    textPreview: p.text.length > 80 ? `${p.text.slice(0, 80)}…` : p.text,
    hasImage: Boolean(p.imagePath),
    postId: p.postId,
    error: p.error,
  }));
  return { content: [{ type: "text", text: JSON.stringify(summary) }] };
});

server.tool("cancel_queued_post", "Cancel a queued post before it publishes. Only works while it is still pending.", { id: z.string() }, async ({ id }) => {
  const entry = cancelQueued(id);
  return { content: [{ type: "text", text: JSON.stringify({ canceled: Boolean(entry), id }) }] };
});

server.tool(
  "process_due_posts",
  "Publish every queued post whose scheduled time has passed. Safe to call any time; also runs automatically once a minute while this server process is running. Posts skip (stay pending, retried next run) when LinkedIn is not connected, rather than failing outright.",
  {},
  async () => ({ content: [{ type: "text", text: JSON.stringify(await processDuePosts()) }] }),
);

async function processDuePosts(): Promise<Array<{ id: string; status: "published" | "failed" | "skipped"; postId?: string; error?: string }>> {
  const due = dueEntries();
  const results: Array<{ id: string; status: "published" | "failed" | "skipped"; postId?: string; error?: string }> = [];
  for (const entry of due) {
    if (!isConfigured()) {
      // Left pending on purpose: LinkedIn being disconnected is usually
      // temporary, and we don't want a queued post to be lost over it.
      results.push({ id: entry.id, status: "skipped", error: "LinkedIn not connected" });
      continue;
    }
    try {
      const postId = entry.imagePath ? await publishImage(entry.text, entry.imagePath, entry.altText) : await publishText(entry.text);
      markPublished(entry.id, postId);
      results.push({ id: entry.id, status: "published", postId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markFailed(entry.id, message);
      results.push({ id: entry.id, status: "failed", error: message });
    }
  }
  return results;
}

// Best-effort auto-publish for as long as this process happens to stay
// running. This is a convenience, not the reliability guarantee — the queue
// itself is durable (see queue.ts), but a timer inside this process is not:
// if the process isn't running when a post comes due, nothing fires until
// something calls process_due_posts again (manually, or the next time this
// server starts and a client happens to call a tool). For guaranteed timing
// with the process not reliably kept alive, drive process_due_posts from an
// external scheduler instead.
setInterval(() => {
  processDuePosts().catch(() => {});
}, 60_000);

const transport = new StdioServerTransport();
await server.connect(transport);
