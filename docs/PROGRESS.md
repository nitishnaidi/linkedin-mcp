# Implementation Progress

Resumable development checkpoint.

## Current milestone
M5 - Hardened Docker/EC2 deployment - IN PROGRESS

## Completed
- M1 MCP foundation merged
- M2 LinkedIn text publishing merged and live validated
- M3 handwritten diagram preparation/rendering merged
- M4 approved-post scheduling merged in PR #4
- Created `feature/docker-ec2-deployment`
- Added multi-stage production Docker image
- Added non-root runtime user and persistent `/data` volume
- Added hardened EC2 Docker Compose deployment with no published ports
- Added host-side secret injection instructions
- Added EC2 deployment/security documentation

## M5 task breakdown
1. [DONE] Production multi-stage Dockerfile
2. [DONE] Non-root runtime and minimal writable filesystem
3. [DONE] Persistent Docker volume for scheduler data
4. [DONE] No-public-port EC2 Compose deployment
5. [DONE] Runtime-only secret injection
6. [CURRENT] Validate container build/runtime and CI
7. [PENDING] Independent security/reviewer pass
8. [PENDING] Resolve persistent OAuth lifecycle for restart-safe unattended scheduling
9. [PENDING] PR and merge after gates pass

## Decisions
- Reuse the existing EC2 host
- Do not add paid AWS infrastructure for the Docker deployment
- Do not expose the stdio MCP server publicly
- Do not bake LinkedIn credentials into the image
- Keep deployment portable so the same image can move to a separate host later
- Preserve explicit human approval before a post is scheduled or published

## Current branch
`feature/docker-ec2-deployment`

## Blockers
- Current OAuth token is process-local unless token/person URN are injected at startup.
- Remote MCP invocation from Claude Desktop requires a separately designed authenticated transport; an unauthenticated public endpoint is prohibited.

## Next exact step
Run CI/build validation, perform an independent Docker/security review, fix findings, then open the M5 pull request.
