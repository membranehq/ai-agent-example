import { experimental_createMCPClient } from 'ai';

export async function getTools({
  token,
  app,
}: { token: string; app?: string }) {
  let url = `http://localhost:3000/sse?token=${token}`;

  if (app) {
    url = `${url}&integrationKey=${app}`;
  }

  const mcpClient = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url,
    },
  });

  try {
    const tools = await mcpClient.tools();
    return tools;
  } catch (error) {
    console.log(error);
    return {};
  }
}
