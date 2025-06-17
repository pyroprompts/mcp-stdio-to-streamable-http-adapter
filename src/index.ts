#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";

// Deps to run as a client
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


dotenv.config();

const URI = process.env.URI;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const NAME = process.env.MCP_NAME || 'mcp-stdio-to-streamable-http-adapter';

if (!URI) {
  throw new Error("URI is required")
}
// log("starting...")
//
let transportOptions = {};
if (BEARER_TOKEN !== undefined) {
  transportOptions = {
    requestInit: {
      headers: {
        "Authorization": `Bearer: ${BEARER_TOKEN}`
      }
    }
  }
}

const mcp_sever = new McpServer(
  {
    name: NAME,
    version: "0.1.0",
  },
  {
    // TODO - check capabilities
    capabilities: {
      resources: {},
      tools: {
        listChanged: true
      },
      prompts: {},
      logging: {},
    },
  }
);

const server: Server = mcp_sever.server

function log(message: string | object){
  server.sendLoggingMessage({ level: "info", content: JSON.stringify(message)});
}

class CustomClientStreamableHTTPClientTransport extends StreamableHTTPClientTransport {
  // @ts-ignore
  onmessage = (message: JSONRPCMessage, extra: RequestOptions) => {
    // log("[client] onmessage fires")
    // log(message)
    server.transport?.send(message, extra)
  }
  onerror = (error: Error) => {
    // log("[client] onerror fires")
    // log(error)
    const error_func = server.transport?.onerror
    if (error_func !== undefined){
      error_func(error)
    }
  }
  onclose = () => {
    // log("[client] close trigger fires")
    server.transport?.close()
  }
}

const client_transport = new CustomClientStreamableHTTPClientTransport(
  new URL(`${URI}`),
  transportOptions
);

class CustomServerStdioServerTransport extends StdioServerTransport {
  // @ts-ignore
  onmessage: ((message: JSONRPCMessage, extra: RequestOptions) => void) = (message: JSONRPCMessage, extra: RequestOptions) => {
    // log("[server] onmessage fires")
    // log(message)
    client_transport.send(message, extra)
  };
  // onerror: ((error: Error) => void) = (error: Error) => {
  //   // log("[server] onerror fires")
  //   // log(error)
  //   client_transport.onerror(error)
  // };
  // onclose: (() => void) = () => {
  //   // log("[server] close trigger fires")
  //   client_transport.onclose()
  // }
}

await client_transport.start()

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  // const server_transport = new StdioServerTransport()
  // await mcp_sever.connect(server_transport)
  const server_transport = new CustomServerStdioServerTransport()
  // @ts-ignore
  server._transport = server_transport
  await server_transport.start()
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});


