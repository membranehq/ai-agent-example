import { experimental_createMCPClient, type Tool, type ToolSet } from 'ai';
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
  console.log('>>> [getToolsFromMCP] Fetching tools 🔨');

  console.time('>>> [getToolsFromMCP] Init 🔌');
  const mcpClient = _mcpClient ?? (await createMCPClient(token, app)).mcpClient;
  console.timeEnd('>>> [getToolsFromMCP] Init 🔌');

  try {
    console.time('>>> [getToolsFromMCP] tools/list 🔨');
    const allTools = await mcpClient.tools();
    console.log(`>> ${Object.keys(allTools).length} Tools received`);
    console.timeEnd('>>> [getToolsFromMCP] tools/list 🔨');

    let filteredTools: ToolSet = {};

    // If list of tools needed is passed, we'll filter MCP tools
    if (keys && keys.length > 0 && allTools) {
      filteredTools = Object.fromEntries(
        Object.entries(allTools).filter(([key]) => keys.includes(key)),
      );

      console.log(`>> Tools after filtering`, Object.keys(filteredTools));
    }

    // if keys was passed, we'll return the filtered tools, otherwise we'll return all tools
    return { tools: keys ? filteredTools : allTools, mcpClient };
  } catch (error) {
    console.error('>>> [getToolsFromMCP] Error fetching tools:', error);
    console.timeEnd('>>> [getToolsFromMCP] Fetching tools 🔨');

    return { tools: {} as ToolSet, mcpClient };
  }
}
