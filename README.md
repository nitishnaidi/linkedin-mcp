# LinkedIn MCP

Open-source MCP server for user-approved LinkedIn publishing.

## MVP capabilities

- LinkedIn OAuth 2.0 connection, with the token persisted to disk so it survives this process restarting
- Text post preparation and publishing
- Single-image upload and publishing
- A durable, disk-backed queue for scheduling posts to publish automatically at a future time
- Explicit human approval before publication (immediate or queued)
- MCP stdio transport

## Requirements

- Node.js 20+
- LinkedIn Developer App with **Share on LinkedIn** enabled
- LinkedIn Developer App with **Sign In with LinkedIn using OpenID Connect** enabled
- OAuth scopes `openid`, `profile`, and `w_member_social`

## Setup

1. Clone the repository and run `npm install` then `npm run build`.
2. In your LinkedIn Developer App, enable **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
3. Add this exact Authorized redirect URL: `http://127.0.0.1:8787/callback`.
4. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI=http://127.0.0.1:8787/callback` in the environment used to launch the MCP server. Never commit the secret.
5. Configure your MCP client to run `node /absolute/path/to/linkedin-mcp/dist/index.js` with those environment variables.

## Test flow

1. Call `start_linkedin_connection` and open the returned authorization URL.
2. Approve LinkedIn access in your browser, then call `complete_linkedin_connection`.
3. Call `linkedin_connection_status`; it should report `configured: true`.
4. Call `prepare_linkedin_post` with harmless test text (and optionally a local image path). Review the exact content.
5. Only after explicit approval, call `publish_linkedin_post` with the same content and `approved: true` to publish immediately, or `queue_linkedin_post` with the same content, `approved: true`, and a future `scheduledAt` to publish it later automatically. Verify the post on LinkedIn and remove the test post if desired.

## Scheduling posts

- `queue_linkedin_post` adds a post to a queue stored at `~/.linkedin-mcp/queue.json`, with an ISO 8601 `scheduledAt`. Like `publish_linkedin_post`, it requires `approved: true`, since a queued post is published later with no further confirmation.
- `list_queued_posts` shows every queued post and its status: `pending`, `published`, `failed`, or `canceled`.
- `cancel_queued_post` cancels a post while it is still `pending`.
- `process_due_posts` publishes everything whose `scheduledAt` has passed. It also runs automatically once a minute while this server process is alive.

The queue itself is durable (a JSON file, not memory), but the once-a-minute auto-publish timer only runs while this process is alive. This server is normally started and stopped by your MCP client, so if it isn't running when a post comes due, that post stays `pending` until something calls `process_due_posts` again — the next tool call from your MCP client, or an external scheduler you point at this server. For guaranteed timing, drive `process_due_posts` from something outside this process (cron, a task scheduler, or your AI client's own scheduled tasks) rather than relying only on the in-process timer.

## Security model

Credentials are never returned by status tools. OAuth state is validated. The access token is persisted to `~/.linkedin-mcp/token.json` (not committed, not returned by any tool) so reconnecting isn't required on every restart; it's still a plaintext file on disk, so treat that directory like any other local secret. Publishing (immediate or queued) is deliberately gated behind an explicit `approved: true`. Do not expose this MCP server directly to the public internet.

## Development

Run `npm run typecheck`, `npm test`, and `npm run build`. GitHub Actions performs these checks for pull requests.

See `docs/PROGRESS.md` for the resumable implementation checkpoint.

## MVP validation

OAuth and human-approved text publishing were successfully smoke-tested against a real LinkedIn member account on September 16, 2026. The image path remains implemented but awaits its separate live smoke test.

## License

MIT
