import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// queue.js resolves its storage path from the *current* homedir() at import
// time, so point HOME somewhere throwaway before importing it. This keeps
// the test isolated from a real ~/.linkedin-mcp/queue.json on the machine
// running it.
process.env.HOME = mkdtempSync(join(tmpdir(), "linkedin-mcp-test-"));
process.env.USERPROFILE = process.env.HOME; // os.homedir() on Windows

const { enqueue, listQueue, dueEntries, cancelQueued, markPublished, markFailed } = await import("../dist/queue.js");

test("dueEntries only returns pending posts scheduled at or before now", () => {
  const past = enqueue({ text: "past", scheduledAt: Date.now() - 1000 });
  const future = enqueue({ text: "future", scheduledAt: Date.now() + 60_000 });
  const due = dueEntries();
  assert.equal(due.length, 1);
  assert.equal(due[0].id, past.id);
  assert.equal(listQueue().find((p) => p.id === future.id).status, "pending");
});

test("markPublished and markFailed update status without touching other entries", () => {
  const a = enqueue({ text: "a", scheduledAt: Date.now() - 1 });
  const b = enqueue({ text: "b", scheduledAt: Date.now() - 1 });
  markPublished(a.id, "urn:li:share:123");
  markFailed(b.id, "boom");
  const list = listQueue();
  assert.equal(list.find((p) => p.id === a.id).status, "published");
  assert.equal(list.find((p) => p.id === a.id).postId, "urn:li:share:123");
  assert.equal(list.find((p) => p.id === b.id).status, "failed");
  assert.equal(list.find((p) => p.id === b.id).error, "boom");
});

test("cancelQueued only cancels pending entries, and is a no-op afterward", () => {
  const entry = enqueue({ text: "cancel me", scheduledAt: Date.now() + 60_000 });
  const canceled = cancelQueued(entry.id);
  assert.equal(canceled?.status, "canceled");
  assert.equal(cancelQueued(entry.id), undefined, "canceling twice should no-op");
  assert.equal(cancelQueued("nonexistent-id"), undefined);
});

test("dueEntries never returns canceled or already-published entries", () => {
  const entry = enqueue({ text: "will cancel", scheduledAt: Date.now() - 1 });
  cancelQueued(entry.id);
  assert.equal(dueEntries().some((p) => p.id === entry.id), false);
});
