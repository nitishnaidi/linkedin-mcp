#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isConfigured, publishImage, publishText } from "./linkedin.js";

const server = new McpServer({ name: "linkedin-mcp", version: "0.2.0" });

server.tool(
  "linkedin_connection_status",
  "Check whether LinkedIn publishing is configured. Never returns credentials.",
  {},
  async () => ({ content: [{ type: "text", text: JSON.stringify({ configured: isConfigured() }) }] }),
);

server.tool(
  "prepare_linkedin_post",
  "Prepare a LinkedIn post for human review. This never publishes.",
  {
    text: z.string().min(1).max(3000).describe("Exact LinkedIn post text"),
    imagePath: z.string().optional().describe("Optional local JPG, PNG, or GIF path"),
    altText: z.string().max(4086).optional().describe("Optional image accessibility text"),
  },
  async ({ text, imagePath, altText }) => ({
    content: [{ type: "text", text: JSON.stringify({ status: "awaiting_approval", text, imagePath, altText, published: false }) }],
  }),
);

server.tool(
  "publish_linkedin_post",
  "Publish an already-reviewed LinkedIn post. Call only after the user explicitly approves the exact content.",
  {
    text: z.string().min(1).max(3000).describe("Exact approved LinkedIn post text"),
    approved: z.literal(true).describe("Must be true only after explicit human approval"),
    imagePath: z.string().optional().describe("Optional local image path approved by the user"),
    altText: z.string().max(4086).optional(),
  },
  async ({ text, imagePath, altText }) => {
    const postId = imagePath ? await publishImage(text, imagePath, altText) : await publishText(text);
    return { content: [{ type: "text", text: JSON.stringify({ status: "published", postId }) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
