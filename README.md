# LinkedIn MCP

Open-source MCP server for creating and publishing LinkedIn content with an explicit human approval step.

> Early development. The project is intentionally designed around user-controlled publishing rather than unattended posting.

## Goal

Connect MCP-compatible AI clients to LinkedIn so a user can prepare a post, review it, and explicitly approve publication.

## MVP roadmap

1. MCP server foundation
2. LinkedIn OAuth 2.0
3. Text post preparation and approval
4. Image upload + image post publishing
5. Tests, security hardening, and setup documentation

## Principles

- Human approval before publishing
- Least-privilege LinkedIn permissions
- No credentials committed to source control
- Provider-neutral MCP interface
- Small, reviewable implementation increments

## Status

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for resumable implementation checkpoints.

## License

MIT
