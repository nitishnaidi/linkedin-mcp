# Implementation Progress

Resumable development checkpoint.

## Current milestone
M2 - LinkedIn publishing MVP

## Completed
- M1 foundation reviewed and merged
- `feature/publishing-mvp` created
- LinkedIn REST Posts client added
- LinkedIn image initialization/upload flow added
- MCP preparation tool supports text and optional image
- Separate publishing tool requires explicit approval
- Runtime configuration is never returned by status tool

## Pending
1. Built-in OAuth onboarding
2. Secure token persistence/refresh strategy
3. Automated tests and CI
4. Full setup/security documentation
5. Live LinkedIn smoke test

## Decisions
- Node.js 20+ and TypeScript
- Official MCP SDK with stdio first
- Use current LinkedIn `/rest/posts` API rather than legacy UGC for publishing
- Human approval is a separate MCP tool call
- MVP accepts runtime LinkedIn publishing configuration; built-in OAuth follows after the publishing path is proven
- No unattended scheduler in the MCP
- Small feature branches and frequent checkpoints

## Current branch
`feature/publishing-mvp`

## Blockers
- This environment cannot install npm packages from GitHub/npm, so local build execution was unavailable here.
- Live publishing requires a LinkedIn Developer application and member authorization.

## Next exact step
Review PR for M2, validate build through GitHub/client environment, then perform a harmless live text-post smoke test.
