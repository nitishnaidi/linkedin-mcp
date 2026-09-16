# LinkedIn MCP

An open-source MCP server that lets an AI assistant help you prepare and publish LinkedIn posts while keeping **you in control of the final publish action**.

You do not need to understand MCP or the LinkedIn API to try this project. This guide walks through the setup from the beginning.

## What can it do?

Today the project can:

- Connect your LinkedIn account using OAuth 2.0
- Prepare a LinkedIn text post for review
- Publish a text post after you explicitly approve it
- Upload and publish a single image with a post
- Work with MCP-compatible AI clients such as Claude Desktop

Handwritten/whiteboard-style diagram generation and publishing is the next feature being developed.

## Before you start

You need:

1. A LinkedIn account
2. A LinkedIn Developer App
3. Node.js 20 or newer
4. Git
5. An MCP-compatible client such as Claude Desktop

You do **not** need to manually create LinkedIn access tokens.

## Step 1: Download the project

Open Terminal, PowerShell, or Command Prompt and run:

```bash
git clone https://github.com/nitishnaidi/linkedin-mcp.git
cd linkedin-mcp
npm install
npm run build
```

If the build completes without an error, the project is ready locally.

## Step 2: Create a LinkedIn Developer App

Go to the LinkedIn Developer portal and create an application.

Inside your application, enable these products:

- **Share on LinkedIn**
- **Sign In with LinkedIn using OpenID Connect**

These give the application the permissions needed to identify you and publish posts after your approval.

The OAuth scopes used by this project are:

```text
openid
profile
w_member_social
```

## Step 3: Configure the LinkedIn callback URL

In your LinkedIn Developer App, open the OAuth settings.

Add this exact Authorized Redirect URL:

```text
http://127.0.0.1:8787/callback
```

Do not replace `127.0.0.1` with `localhost` unless you also change the application configuration.

From the LinkedIn Developer App, copy your:

- Client ID
- Client Secret

Keep the Client Secret private. Never commit it to GitHub.

## Step 4: Configure your MCP client

Your MCP client needs to start the compiled server and provide the LinkedIn credentials as environment variables.

A typical configuration looks like this:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/FULL/PATH/TO/linkedin-mcp/dist/index.js"],
      "env": {
        "LINKEDIN_CLIENT_ID": "YOUR_CLIENT_ID",
        "LINKEDIN_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "LINKEDIN_REDIRECT_URI": "http://127.0.0.1:8787/callback"
      }
    }
  }
}
```

Replace `/FULL/PATH/TO/linkedin-mcp` with the folder where you cloned this repository.

Restart your MCP client after saving the configuration.

## Step 5: Connect LinkedIn

Ask your AI client to start the LinkedIn connection.

Behind the scenes it calls:

```text
start_linkedin_connection
```

The tool returns a LinkedIn authorization link. Open it in your browser and approve access.

Then ask the client to complete the connection. It calls:

```text
complete_linkedin_connection
```

To confirm everything worked, the client can call:

```text
linkedin_connection_status
```

You should see:

```json
{"configured":true}
```

## Your first LinkedIn post

Ask your AI assistant something like:

```text
Prepare a LinkedIn post saying: Testing my LinkedIn MCP integration.
```

The assistant uses `prepare_linkedin_post`. This step **does not publish anything**.

Review the text. When you are satisfied, explicitly tell the assistant to publish it.

Publishing uses `publish_linkedin_post` with approval set to `true`.

This separation is intentional: preparing content and publishing content are two different actions so an AI assistant cannot silently publish a draft.

## Posting an image

You can also prepare a post with a local image path.

Example request:

```text
Prepare a LinkedIn post with the image at /Users/me/Pictures/diagram.png and the text "A simple architecture diagram."
```

The MCP prepares the post first. After you review and approve it, the image is uploaded to LinkedIn and the post is published.

The single-image implementation exists, but the project still tracks a separate live image smoke test as a validation item.

## Handwritten diagrams

The next feature is designed for requests such as:

```text
Create a handwritten diagram explaining how an AI agent uses RAG and publish it to LinkedIn.
```

The intended workflow is:

```text
Idea
  ↓
Generate diagram specification
  ↓
Render handwritten-style image
  ↓
Preview image + post text
  ↓
Human approval
  ↓
Upload image
  ↓
Publish to LinkedIn
```

Diagram generation must remain separate from publication so the generated image can always be reviewed before it reaches LinkedIn.

## Security

The project follows a few important rules:

- Client secrets are never returned by MCP tools.
- Access tokens are never returned by the connection-status tool.
- OAuth state is validated.
- Preparing a post never publishes it.
- Publishing requires an explicit approval flag.
- Access tokens currently live only in the running process.
- Restarting the MCP server currently requires reconnecting LinkedIn.
- Do not expose this local MCP server directly to the public internet.

## Troubleshooting

### `linkedin_connection_status` says false

Make sure you completed both the browser authorization and `complete_linkedin_connection` steps.

### LinkedIn says the redirect URL is invalid

Verify the Developer App contains exactly:

```text
http://127.0.0.1:8787/callback
```

### The MCP client cannot start the server

First verify this succeeds inside the repository:

```bash
npm install
npm run build
```

Then verify the path to `dist/index.js` in your MCP configuration is absolute and correct.

### It worked before restarting but is disconnected now

That is expected in the current MVP. Tokens are process-local. Persistent encrypted token storage is planned for a later iteration.

## Development

Before submitting changes, run:

```bash
npm run typecheck
npm run build
```

GitHub Actions runs the same validation on pull requests.

Implementation checkpoints are maintained in `docs/PROGRESS.md` so development can resume safely after interruptions.

## Current validation status

OAuth and human-approved text publishing were successfully smoke-tested against a real LinkedIn member account on September 16, 2026.

Single-image publishing is implemented and awaiting its separate live smoke test.

## License

MIT
