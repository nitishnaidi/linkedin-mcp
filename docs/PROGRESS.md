# Implementation Progress

Resumable development checkpoint.

## Current milestone
M4 - Approved post scheduling - IN PROGRESS

## Completed
- M1 MCP foundation merged
- M2 LinkedIn text publishing merged and live validated
- M3 handwritten diagram preparation/rendering merged in PR #3
- Reviewer caught SVG incompatibility; diagrams now render to LinkedIn-supported PNG
- PR #3 final CI passed before merge
- Created `feature/post-scheduling`
- Added persistent JSON queue with atomic writes
- Added schedule/list/cancel/claim/complete queue primitives

## M4 task breakdown
1. [DONE] Persistent scheduled-post data model and storage
2. [CURRENT] Expose schedule/list/cancel MCP tools with explicit approval requirement
3. [PENDING] Add scheduler worker that publishes due posts while MCP process is running
4. [PENDING] Recovery behavior for interrupted `publishing` items
5. [PENDING] Tests for scheduling, cancellation, due claiming, and failure state
6. [PENDING] README beginner scheduling instructions
7. [PENDING] CI + reviewer pass
8. [PENDING] Open PR for M4

## Decisions
- Only already-approved content may enter the schedule queue
- Scheduling does not generate or modify post content
- Queue persists locally under `.linkedin-mcp/scheduled-posts.json` by default
- ISO-8601 timestamps are stored in UTC
- Atomic temp-file rename is used for queue writes
- Scheduler will initially run only while the MCP server process is running
- Failed publishes are retained for inspection rather than silently retried forever

## Current branch
`feature/post-scheduling`

## Next exact step
Wire the queue into MCP tools and add the due-post worker using the existing LinkedIn text/image publishers.
