import { experimental_createMCPClient } from 'ai';

export async function getTools({
  token,
  app,
}: { token: string; app?: string }) {
  const INTEGRATION_APP_MCP_SERVER_HOST =
    process.env.INTEGRATION_APP_MCP_SERVER_HOST;

  if (!INTEGRATION_APP_MCP_SERVER_HOST) {
    throw new Error('INTEGRATION_APP_MCP_SERVER_HOST is not set');
  }

  let url = `${INTEGRATION_APP_MCP_SERVER_HOST}/sse?token=${token}`;
  console.log('url', url);

  if (app) {
    url = `${url}&integrationKey=${app}`;
  }

  const mcpClient = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url,
    },
  });

  // Will throw an error is there are no tools so we need to catch it
  try {
    const tools = await mcpClient.tools();
    return tools;
  } catch (error) {
    console.log(error);
    return {};
  }
}
