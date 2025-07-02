import { experimental_createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function getToolsFromMCP({
  token,
  app,
  activeTools,
}: {
  token: string;
  app?: string;
  activeTools?: string[];
}) {
  console.log('[getToolsFromMCP] Starting...');
  const INTEGRATION_APP_MCP_SERVER_HOST =
    process.env.INTEGRATION_APP_MCP_SERVER_HOST;

  if (!INTEGRATION_APP_MCP_SERVER_HOST) {
    throw new Error('INTEGRATION_APP_MCP_SERVER_HOST is not set');
  }

  let url = `${INTEGRATION_APP_MCP_SERVER_HOST}/sse`;

  if (app) {
    url = `${url}&integrationKey=${app}`;
  }

  console.time('[getToolsFromMCP] Init 🔌');

  const transport = new StreamableHTTPClientTransport(
    new URL(`${INTEGRATION_APP_MCP_SERVER_HOST}/mcp`),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );

  const mcpClient = await experimental_createMCPClient({
    transport,
  });

  console.timeEnd('[getToolsFromMCP] Init 🔌');

  let tools = null;

  // Will throw an error is there are no tools so we need to catch it
  try {
    console.time('[getToolsFromMCP] Fetching tools 🔨');
    tools = await mcpClient.tools();
    console.timeEnd('[getToolsFromMCP] Fetching tools 🔨');
  } catch (error) {
    console.error('[getToolsFromMCP] Error fetching tools:', error);
    console.timeEnd('[getToolsFromMCP] Fetching tools 🔨');
  }

  // Filter tools if activeTools is provided
  if (activeTools && tools) {
    tools = Object.fromEntries(
      Object.entries(tools).filter(([key]) => activeTools.includes(key)),
    );
  }

  console.log('[getToolsFromMCP] Finished.');
  return { tools: tools || {}, mcpClient };
}
