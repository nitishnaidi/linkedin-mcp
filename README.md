# LinkedIn MCP

Open-source MCP server for user-approved LinkedIn publishing.

## MVP capabilities

- LinkedIn OAuth 2.0 connection
- Text post preparation and publishing
- Single-image upload and publishing
- Explicit human approval before publication
- MCP stdio transport

## Requirements

- Node.js 20+
- LinkedIn Developer App with **Share on LinkedIn** enabled
- OAuth scopes `openid`, `profile`, and `w_member_social`

## Setup

1. Clone the repository and run `npm install` then `npm run build`.
2. In your LinkedIn Developer App, add this exact Authorized redirect URL: `http://127.0.0.1:8787/callback`.
3. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI=http://127.0.0.1:8787/callback` in the environment used to launch the MCP server. Never commit the secret.
4. Configure your MCP client to run `node /absolute/path/to/linkedin-mcp/dist/index.js` with those environment variables.

## Test flow

1. Call `start_linkedin_connection` and open the returned authorization URL.
2. Approve LinkedIn access in your browser, then call `complete_linkedin_connection`.
3. Call `linkedin_connection_status`; it should report `configured: true`.
4. Call `prepare_linkedin_post` with harmless test text (and optionally a local image path). Review the exact content.
5. Only after explicit approval, call `publish_linkedin_post` with the same content and `approved: true`. Verify the post on LinkedIn and remove the test post if desired.

## Security model

Credentials and tokens are never returned by status tools. OAuth state is validated. Access tokens are kept only in the running process for this MVP; restarting requires reconnecting. Publishing is deliberately a separate approval-gated tool call. Do not expose this MCP server directly to the public internet.

## Development

Run `npm run typecheck` and `npm run build`. GitHub Actions performs both checks for pull requests.

See `docs/PROGRESS.md` for the resumable implementation checkpoint.

## License

MIT
