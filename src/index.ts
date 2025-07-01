#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Deps to run as a client
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


dotenv.config();

const URI = process.env.URI;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const NAME = process.env.MCP_NAME || 'mcp-stdio-to-streamable-http-adapter';

if (!URI) {
  throw new Error("URI is required")
}
// console.log("starting...")
//
let transportOptions = {};
if (BEARER_TOKEN !== undefined) {
  transportOptions = {
    requestInit: {
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`
      }
    }
  }
}

const transport = new StreamableHTTPClientTransport(
    new URL(`${URI}`),
    transportOptions
);
// console.log("making client...")

const client = new Client(
  {
    name: NAME,
    version: "0.1.0"
  }
);

// console.log("connecting to transport...")
await client.connect(transport);


const server = new Server(
  {
    name: NAME,
    version: "0.1.0",
  },
  {
    // TODO - check capabilities
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return await client.listResources();
});

/**
 * Handler for reading the contents of a specific resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return await client.readResource({
    uri: request.params.uri,
  })

});

/**
 * Handler that lists available tools.
 * Exposes a single "chat" tool that lets clients chat with another AI.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return await client.listTools();
});

/**
 * Handler for the chat tool.
 * Connects to an OpenAI SDK compatible AI Integration.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return await client.callTool({
    name: request.params.name,
    arguments: request.params.arguments || {},
  });
});

/**
 * Handler that lists available prompts.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return await client.listPrompts();
});

/**
 * Handler for the get prompt.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return await client.getPrompt({
    name: request.params.name,
  });
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});


