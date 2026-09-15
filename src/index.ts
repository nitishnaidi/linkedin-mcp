#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "linkedin-mcp",
  version: "0.1.0",
});

server.tool(
  "linkedin_connection_status",
  "Check whether LinkedIn credentials are configured. This tool never returns secrets.",
  {},
  async () => {
    const configured = Boolean(
      process.env.LINKEDIN_CLIENT_ID &&
        process.env.LINKEDIN_CLIENT_SECRET &&
        process.env.LINKEDIN_REDIRECT_URI,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ configured }),
        },
      ],
    };
  },
);

server.tool(
  "prepare_linkedin_post",
  "Prepare a LinkedIn post for human review. This does not publish anything.",
  {
    text: z.string().min(1).max(3000).describe("LinkedIn post text"),
  },
  async ({ text }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "awaiting_approval",
          text,
          published: false,
        }),
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
