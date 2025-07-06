import { experimental_createMCPClient, type Tool } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface GetToolsFromMCPArgs {
  token: string;
  app?: string;
  keys?: string[];
}

/**
 * Get tools from MCP server
 *
 * @param token - The token to use to authenticate with the MCP server
 * @param app - The app to get tools for
 * @param keys - The keys to filter the tools by
 * @returns The tools from the MCP server
 */
export async function getToolsFromMCP({
  token,
  app,
  keys,
}: GetToolsFromMCPArgs) {
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

  let tools: Record<string, Tool> | null = null;

  try {
    console.time('[getToolsFromMCP] Fetching tools 🔨');
    tools = await mcpClient.tools();
    console.log(`>> ${Object.keys(tools).length} Tools received`);
    console.timeEnd('[getToolsFromMCP] Fetching tools 🔨');
  } catch (error) {
    console.error('[getToolsFromMCP] Error fetching tools:', error);
    console.timeEnd('[getToolsFromMCP] Fetching tools 🔨');
  }

  // If activeTools is provided, only return tools that are in the activeTools array
  if (keys && tools) {
    tools = Object.fromEntries(
      Object.entries(tools).filter(([key]) => keys.includes(key)),
    );
  }

  if (tools) {
    console.log(`>> Tools after filtering`, Object.keys(tools));
  }
  console.log('[getToolsFromMCP] Finished.');
  return { tools: tools || {}, mcpClient };
}
