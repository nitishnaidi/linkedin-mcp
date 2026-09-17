// Persists the LinkedIn OAuth access token to disk so the connection survives
// restarts of this MCP server process. Before this, the token only lived in
// process.env, which is wiped every time the process restarts (app restart,
// computer sleep, the MCP host recycling local server connections, etc.) —
// that's why the connection kept silently dropping between sessions.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredToken {
  accessToken: string;
  personUrn: string;
  expiresAt: number; // epoch ms
}

const STORE_DIR = join(homedir(), ".linkedin-mcp");
const STORE_PATH = join(STORE_DIR, "token.json");

export function loadToken(): StoredToken | undefined {
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const token = JSON.parse(raw) as Partial<StoredToken>;
    if (!token.accessToken || !token.personUrn || !token.expiresAt) return undefined;
    if (Date.now() >= token.expiresAt) return undefined; // expired — needs a fresh OAuth run
    return token as StoredToken;
  } catch {
    return undefined; // no token file yet, or unreadable — needs a fresh OAuth run
  }
}

export function saveToken(token: StoredToken): void {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

export function tokenExpiryIso(): string | undefined {
  const token = loadToken();
  return token ? new Date(token.expiresAt).toISOString() : undefined;
}
