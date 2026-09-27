// A durable, disk-backed queue for scheduling LinkedIn posts to publish at a
// future time. Everything here is a plain JSON file rather than in-memory
// state, for the same reason tokenStore.ts persists the OAuth token to disk:
// this MCP server's process can restart at any time (app restart, sleep, the
// MCP host recycling local server connections), and anything held only in
// memory disappears when that happens.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type QueuedPostStatus = "pending" | "published" | "failed" | "canceled";

export interface QueuedPost {
  id: string;
  text: string;
  imagePath?: string;
  altText?: string;
  scheduledAt: number; // epoch ms
  status: QueuedPostStatus;
  createdAt: number;
  publishedAt?: number;
  postId?: string;
  error?: string;
}

const STORE_DIR = join(homedir(), ".linkedin-mcp");
const STORE_PATH = join(STORE_DIR, "queue.json");

function readQueue(): QueuedPost[] {
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as QueuedPost[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedPost[]): void {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(queue, null, 2), { mode: 0o600 });
}

export function enqueue(entry: { text: string; scheduledAt: number; imagePath?: string; altText?: string }): QueuedPost {
  const queue = readQueue();
  const post: QueuedPost = { id: randomUUID(), status: "pending", createdAt: Date.now(), ...entry };
  queue.push(post);
  writeQueue(queue);
  return post;
}

export function listQueue(): QueuedPost[] {
  return readQueue().sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export function cancelQueued(id: string): QueuedPost | undefined {
  const queue = readQueue();
  const entry = queue.find((p) => p.id === id);
  if (!entry || entry.status !== "pending") return undefined;
  entry.status = "canceled";
  writeQueue(queue);
  return entry;
}

export function dueEntries(now = Date.now()): QueuedPost[] {
  return readQueue()
    .filter((p) => p.status === "pending" && p.scheduledAt <= now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export function markPublished(id: string, postId: string): void {
  const queue = readQueue();
  const entry = queue.find((p) => p.id === id);
  if (!entry) return;
  entry.status = "published";
  entry.publishedAt = Date.now();
  entry.postId = postId;
  writeQueue(queue);
}

export function markFailed(id: string, error: string): void {
  const queue = readQueue();
  const entry = queue.find((p) => p.id === id);
  if (!entry) return;
  entry.status = "failed";
  entry.error = error;
  writeQueue(queue);
}
