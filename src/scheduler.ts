import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type ScheduledPost = {
  id: string;
  text: string;
  imagePath?: string;
  altText?: string;
  scheduledFor: string;
  status: "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  createdAt: string;
  claimedAt?: string;
  publishedAt?: string;
  postId?: string;
  error?: string;
};

const queuePath = () => resolve(process.env.LINKEDIN_MCP_QUEUE_PATH ?? ".linkedin-mcp/scheduled-posts.json");
let mutationChain: Promise<void> = Promise.resolve();

async function readQueue(): Promise<ScheduledPost[]> {
  try { return JSON.parse(await readFile(queuePath(), "utf8")) as ScheduledPost[]; }
  catch (error: any) { if (error?.code === "ENOENT") return []; throw error; }
}

async function writeQueue(posts: ScheduledPost[]): Promise<void> {
  const path = queuePath(); await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(posts, null, 2), "utf8"); await rename(temp, path);
}

function mutateQueue<T>(mutation: (posts: ScheduledPost[]) => Promise<T> | T): Promise<T> {
  const operation = mutationChain.then(async () => {
    const posts = await readQueue();
    const result = await mutation(posts);
    await writeQueue(posts);
    return result;
  });
  mutationChain = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function scheduleApprovedPost(input: { text: string; scheduledFor: string; imagePath?: string; altText?: string }): Promise<ScheduledPost> {
  const when = new Date(input.scheduledFor);
  if (Number.isNaN(when.getTime())) throw new Error("scheduledFor must be a valid ISO-8601 date/time");
  if (when.getTime() <= Date.now()) throw new Error("scheduledFor must be in the future");
  return mutateQueue((posts) => {
    const post: ScheduledPost = { id: randomUUID(), text: input.text, imagePath: input.imagePath, altText: input.altText, scheduledFor: when.toISOString(), status: "scheduled", createdAt: new Date().toISOString() };
    posts.push(post); return post;
  });
}

export async function listScheduledPosts(): Promise<ScheduledPost[]> {
  await mutationChain;
  return (await readQueue()).sort((a,b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export async function cancelScheduledPost(id: string): Promise<ScheduledPost> {
  return mutateQueue((posts) => {
    const post = posts.find((p) => p.id === id);
    if (!post) throw new Error("Scheduled post not found");
    if (post.status !== "scheduled") throw new Error(`Cannot cancel post with status ${post.status}`);
    post.status = "cancelled"; return post;
  });
}

export async function claimDuePosts(now = new Date(), staleClaimMs = 10 * 60 * 1000): Promise<ScheduledPost[]> {
  return mutateQueue((posts) => {
    const staleBefore = now.getTime() - staleClaimMs;
    for (const post of posts) {
      if (post.status === "publishing" && (!post.claimedAt || new Date(post.claimedAt).getTime() <= staleBefore)) {
        post.status = "scheduled"; post.claimedAt = undefined;
      }
    }
    const due = posts.filter((p) => p.status === "scheduled" && new Date(p.scheduledFor).getTime() <= now.getTime());
    for (const post of due) { post.status = "publishing"; post.claimedAt = now.toISOString(); }
    return due;
  });
}

export async function completeScheduledPost(id: string, result: { postId?: string; error?: string }): Promise<void> {
  await mutateQueue((posts) => {
    const post = posts.find((p) => p.id === id); if (!post) return;
    post.claimedAt = undefined;
    if (result.error) { post.status = "failed"; post.error = result.error; }
    else { post.status = "published"; post.postId = result.postId; post.publishedAt = new Date().toISOString(); post.error = undefined; }
  });
}
