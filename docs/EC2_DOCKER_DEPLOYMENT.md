# EC2 Docker deployment

This deployment is designed to share an existing EC2 host without exposing a new public port.

## Security model

- The container runs as UID/GID 10001, not root.
- No application port is published.
- All Linux capabilities are dropped and privilege escalation is disabled.
- The root filesystem is read-only. Only the Docker data volume and a small tmpfs are writable.
- LinkedIn credentials are supplied at runtime from a host file and are never baked into the image.
- The scheduling queue lives in a Docker volume so image/container replacement does not delete it.
- The service needs outbound HTTPS to LinkedIn.

## Host setup

Create a root-owned secrets directory:

```bash
sudo install -d -m 700 -o root -g root /etc/linkedin-mcp
sudo install -m 600 -o root -g root /dev/null /etc/linkedin-mcp/linkedin.env
sudoedit /etc/linkedin-mcp/linkedin.env
```

Add only runtime values:

```text
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://127.0.0.1:8787/callback
# LINKEDIN_ACCESS_TOKEN=...
# LINKEDIN_PERSON_URN=urn:li:person:...
```

Never commit this file or copy secrets into the Dockerfile/image.

## Build and start

```bash
git pull
docker compose -f docker-compose.ec2.yml build --pull
docker compose -f docker-compose.ec2.yml up -d
docker compose -f docker-compose.ec2.yml ps
```

No `ports:` mapping is configured, so this deployment does not add a public listener.

## Upgrade

```bash
git pull
docker compose -f docker-compose.ec2.yml build --pull
docker compose -f docker-compose.ec2.yml up -d
```

The named `linkedin-mcp-data` volume remains in place.

## Important OAuth limitation

The current LinkedIn OAuth completion stores the access token in process memory. A container restart therefore still requires reconnecting LinkedIn unless `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_PERSON_URN` are securely injected at startup.

Do not expose the OAuth callback or stdio MCP process directly to the Internet to work around this. Persistent OAuth/token lifecycle is a separate security-sensitive milestone.

## Scheduling limitation

The current MCP uses stdio. Docker makes the application portable and allows its scheduler process to stay alive, but a remote Claude Desktop cannot securely invoke a stdio MCP inside EC2 without an additional transport or controlled tunnel. Do not publish an unauthenticated MCP HTTP endpoint.

## Backup

The queue is in the Docker volume `linkedin-mcp-data`. Back it up before destructive Docker volume maintenance. Normal image/container upgrades do not remove named volumes.
