import type { StaticTools } from '@/lib/ai/constants';
import { getActions } from '@/lib/ai/tools/get-actions';
import { renderForm } from '@/lib/ai/tools/renderForm';
import { suggestApps } from '@/lib/ai/tools/suggest-apps';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import OpenAI from 'openai';
import { systemPrompt } from '@/lib/ai/prompts';

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: 'system',
    content: systemPrompt,
  },
  {
    role: 'user',
    content: 'Find events in Google Calendar',
  },
];

const user = {
  id: '53d2894c-7938-4762-ac32-6bca7448db8a',
  name: 'John Doe',
};

const accessToken = await generateIntegrationAppCustomerAccessToken(user);

const MODEL = 'gpt-4o';
const MCP_HOST = 'http://localhost:3000';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key';

const MCP_URL = new URL(`${MCP_HOST}/mcp?mode=dynamic`);

const maxSteps = 10;

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

let mcpClient: Client | undefined;

try {
  const transport = new StreamableHTTPClientTransport(MCP_URL, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  // Initialize the MCP client using the official MCP SDK
  mcpClient = new Client({
    name: 'integration-app-example-client',
    version: '1.0.0',
  });

  await mcpClient.connect(transport);

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
  let ended = false;
  let steps = 0;

  // Main conversation loop - continues until AI decides to stop or max steps reached
  while (!ended && steps < maxSteps) {
    // Reload tools from MCP client before each generation step
    // This ensures we have the latest available tools
    const toolsResponse = await mcpClient.listTools();
    const mcpTools = toolsResponse.tools || [];

    // Convert MCP tools to OpenAI's function calling format
    const openaiMcpTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      mcpTools.map((tool: any) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));

    // Convert static tools to OpenAI's function calling format
    const openaiStaticTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      Object.keys(staticTools).map((toolName) => {
        const tool = staticTools[toolName as keyof typeof staticTools];
        return {
          type: 'function' as const,
          function: {
            name: toolName,
            description: tool.description,
            parameters: zodToJsonSchema(tool.parameters),
          },
        };
      });

    const allTools = [...openaiMcpTools, ...openaiStaticTools];

    console.log(
      '>> Using tools',
      allTools.map((tool) => tool.function?.name),
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: allTools.length > 0 ? allTools : undefined,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    messages.push(assistantMessage);

    // Handle different completion reasons - this determines conversation flow
    switch (choice.finish_reason) {
      case 'stop':
      case 'content_filter':
        // Model completed its response naturally or was filtered
        ended = true;
        break;

      case 'tool_calls':
        // Model wants to use tools - we need to manually execute them
        if (assistantMessage.tool_calls) {
          const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [];

          for (const toolCall of assistantMessage.tool_calls) {
            try {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);

              const isStaticTool = Object.keys(staticTools).includes(toolName);

              let result: any;

              if (isStaticTool) {
                const staticTool =
                  staticTools[toolName as keyof typeof staticTools];

                if (staticTool?.execute) {
                  console.log('>> Executing static tool', toolName);
                  console.log('>> Tool args', toolArgs);
                  result = await staticTool?.execute?.(toolArgs);
                }
              } else {
                console.log('>> Executing MCP tool', toolName);
                console.log('>> Tool args', toolArgs);
                result = await mcpClient.callTool({
                  name: toolName,
                  arguments: toolArgs,
                });
              }

              // Format the result for OpenAI's expected tool message format
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              console.log(` Tool call error: ${toolCall.function.name}:`);
              console.error(error);

              /**
               * Handle error and push it as a tool call result to maintain conversation flow
               */
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              });
            }
          }

          messages.push(...toolResults);
        }
        break;

      case 'length':
        console.log('⚠️  Response truncated due to length limit');
        ended = true;
        break;

      default:
        console.log(`🤔 Unknown finish reason: ${choice.finish_reason}`);
        ended = true;
    }

    console.log(
      '>> Assistant message',
      JSON.stringify(assistantMessage, null, 2),
    );

    steps++;
  }
} catch (error) {
  console.error('Error:', error);
}
