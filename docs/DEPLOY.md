# Deploying linkedin-mcp remotely (Docker on EC2)

Runs this MCP server as its own container + its own Caddy reverse proxy, independent of
whatever else already runs on the box. TLS is automatic via Let's Encrypt using a free
`sslip.io` hostname, so no domain purchase or DNS setup is required.

## Prerequisites

- Docker + the Compose plugin on the EC2 instance (`docker compose version` should work).
- Ports **80** and **443** free on the host. Check first: `sudo ss -tlnp | grep -E ':80|:443'`.
  If your other app already binds those, see "Port conflict" below before proceeding.
- The EC2 instance's **security group** allows inbound TCP 80 and 443 from the internet
  (needed once for the Let's Encrypt HTTP challenge, and afterwards for HTTPS traffic).
- A LinkedIn Developer App with **Share on LinkedIn** and **Sign In with LinkedIn using
  OpenID Connect** enabled (same as local setup).

## Steps

1. Copy this repo to the EC2 instance (`git clone`, or `scp`/`rsync` the working tree).

2. Find the instance's public IP (`curl -s ifconfig.me` on the instance, or from the AWS console),
   e.g. `203.0.113.10`.

3. Create `.env` in the repo root on the instance (`docker compose` reads it automatically):

   ```
   LINKEDIN_CLIENT_ID=<from LinkedIn Developer App>
   LINKEDIN_CLIENT_SECRET=<from LinkedIn Developer App>
   MCP_DOMAIN=linkedin-mcp.203-0-113-10.sslip.io
   MCP_AUTH_TOKEN=<openssl rand -hex 32>
   ```

   `MCP_DOMAIN` uses the `sslip.io` wildcard DNS trick: `<anything>.<ip-with-dashes>.sslip.io`
   resolves to that IP automatically, with no DNS records to create. Substitute your actual
   public IP with dashes instead of dots. If you already own a domain, point an A record at
   the instance instead and use that hostname here.

4. In the LinkedIn Developer App, add this exact Authorized redirect URL:
   `https://<MCP_DOMAIN>/callback` (same value as above, with `https://` and `/callback`).

5. Build and start:

   ```
   docker compose up -d --build
   ```

   Caddy will request a Let's Encrypt certificate for `MCP_DOMAIN` on first start — this
   requires port 80 to be reachable from the internet at that moment. Watch `docker compose
   logs -f caddy` for confirmation.

6. Verify: `curl https://<MCP_DOMAIN>/healthz` should return `ok`.

7. Point your MCP client at the remote server instead of spawning it locally. For a client
   that supports remote (Streamable HTTP) MCP servers, configure:
   - URL: `https://<MCP_DOMAIN>/mcp`
   - Header: `Authorization: Bearer <MCP_AUTH_TOKEN>`

8. Run through the same connect flow as local setup: call `start_linkedin_connection`, open
   the returned URL in a browser, approve, then call `complete_linkedin_connection`. The
   token and queue now persist in the `linkedin_mcp_data` Docker volume, so they survive
   container restarts and redeploys.

## Port conflict (80/443 already used by another app)

If another container already binds 80/443, this Caddy can't also bind them. Either:
- Point this Caddy at different host ports (e.g. `8080:80`, `8443:443`) and rely on Caddy's
  on-demand TLS via DNS instead of the HTTP challenge (more setup), **or**
- Add a site block for `MCP_DOMAIN` to whatever reverse proxy already owns 80/443 on the
  box, forwarding to this container's exposed `3000` port on the shared Docker network,
  instead of running a second Caddy at all.

## Known caveat: image posts

`publish_linkedin_post`/`queue_linkedin_post`'s `imagePath` is read from disk by whichever
host runs the process (`src/linkedin.ts`). Once deployed, that means a path inside this
container, not your laptop — text posts are unaffected.
