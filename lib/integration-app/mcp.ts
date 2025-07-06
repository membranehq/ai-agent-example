import { experimental_createMCPClient, type Tool } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const createMCPClient = async (token: string, app?: string) => {
  const INTEGRATION_APP_MCP_SERVER_HOST =
    process.env.INTEGRATION_APP_MCP_SERVER_HOST;

  if (!INTEGRATION_APP_MCP_SERVER_HOST) {
    throw new Error('INTEGRATION_APP_MCP_SERVER_HOST is not set');
  }

  let url = `${INTEGRATION_APP_MCP_SERVER_HOST}/mcp`;

  if (app) {
    url = `${url}&integrationKey=${app}`;
  }

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const mcpClient = await experimental_createMCPClient({
    transport,
  });

  return { mcpClient, transport };
};

interface GetToolsFromMCPArgs {
  token: string;
  app?: string;
  keys?: string[];
  mcpClient?: Awaited<ReturnType<typeof experimental_createMCPClient>>;
}

/**
 * Get tools from MCP server
 *
 * @param token - The token to use to authenticate with the MCP server
 * @param app - The app to get tools for
 * @param keys - The keys to filter the tools by
 * @param mcpClient - The MCP client to use to get the tools (optional, will be created if not provided)
 * @returns The tools from the MCP server
 */
export async function getToolsFromMCP({
  token,
  app,
  keys,
  mcpClient: _mcpClient,
}: GetToolsFromMCPArgs) {
  console.log('>>> [getToolsFromMCP] Starting...');

  console.time('>>> [getToolsFromMCP] Init 🔌');
  const mcpClient = _mcpClient ?? (await createMCPClient(token, app)).mcpClient;
  console.timeEnd('>>> [getToolsFromMCP] Init 🔌');

  let tools: Record<string, Tool> | null = null;

  try {
    console.time('>>> [getToolsFromMCP] tools/list 🔨');
    tools = await mcpClient.tools();
    console.timeEnd('>>> [getToolsFromMCP] tools/list 🔨');

    console.log(`>> ${Object.keys(tools).length} Tools received`);
  } catch (error) {
    console.error('>>> [getToolsFromMCP] Error fetching tools:', error);
    console.timeEnd('>>> [getToolsFromMCP] Fetching tools 🔨');
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
  console.log('>>> [getToolsFromMCP] Finished.');
  return { tools: tools || {}, mcpClient };
}
