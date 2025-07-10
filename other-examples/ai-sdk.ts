import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { experimental_createMCPClient, generateText } from 'ai';
import type { StaticTools } from '@/lib/ai/constants';
import { getActions } from '@/lib/ai/tools/get-actions';
import { renderForm } from '@/lib/ai/tools/renderForm';
import { suggestApps } from '@/lib/ai/tools/suggest-apps';
import { myProvider } from '@/lib/ai/providers';
import { systemPrompt } from '@/lib/ai/prompts';

const user = {
  id: '53d2894c-7938-4762-ac32-6bca7448db8a',
  name: 'John Doe',
};

const accessToken = await generateIntegrationAppCustomerAccessToken(user);

const MCP_HOST = 'http://localhost:3000';
const MCP_URL = new URL(`${MCP_HOST}/mcp?mode=dynamic`);

const maxSteps = 10;

// Initialize MCP client using AI SDK
let mcpClient:
  | Awaited<ReturnType<typeof experimental_createMCPClient>>
  | undefined;

try {
  const transport = new StreamableHTTPClientTransport(MCP_URL, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  // Initialize the MCP client using the AI SDK
  mcpClient = await experimental_createMCPClient({
    transport,
  });

  console.log('✅ MCP client initialized');

  const staticTools: Record<keyof typeof StaticTools, any> = {
    suggestApps: suggestApps({
      user,
    }),
    renderForm: renderForm(accessToken),
    getActions: getActions({
      integrationAppCustomerAccessToken: accessToken,
      user,
    }),
  };

  // Set up the conversation with initial system prompt and user instruction
  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt,
    },
    {
      role: 'user' as const,
      content: 'Find events in Google Calendar',
    },
  ];

  // Main conversation loop using AI SDK's generateText
  let ended = false;
  let steps = 0;

  while (!ended && steps < maxSteps) {
    // Get tools from MCP client
    const mcpTools = await mcpClient.tools();

    // Combine MCP tools with static tools
    const allTools = {
      ...mcpTools,
      ...staticTools,
    };

    console.log('>> Using tools', Object.keys(allTools));

    // Use AI SDK's generateText for the conversation
    const result = await generateText({
      model: myProvider.languageModel('chat-model'),
      messages,
      tools: allTools,
      maxSteps: 1, // Process one step at a time
    });

    console.log('>> Finish reason', result.finishReason);
    console.log('>> Assistant response:', result.text);

    // Add the assistant's response to messages
    messages.push({
      role: 'assistant',
      content: result.text,
    } as any);

    // Check if we should continue
    switch (result.finishReason) {
      case 'stop':
      case 'content-filter':
      case 'error':
        ended = true;
        break;
      case 'length':
        console.log('⚠️  Response truncated due to length limit');
        ended = true;
        break;
      case 'other':
      case 'unknown':
      default:
        // Continue to next step
        break;
    }

    steps++;
  }

  console.log('✅ Conversation completed');
} catch (error) {
  console.error('Error:', error);
}
