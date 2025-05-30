import { experimental_createMCPClient } from 'ai';

export async function getTools({ token }: { token: string }) {
  const mcpClient = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url: `http://localhost:3000/sse?token=${token}`,
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
