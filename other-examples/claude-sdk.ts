import type { StaticTools } from '@/lib/ai/constants';
import { getActions } from '@/lib/ai/tools/get-actions';
import { renderForm } from '@/lib/ai/tools/renderForm';
import { suggestApps } from '@/lib/ai/tools/suggest-apps';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Anthropic from '@anthropic-ai/sdk';
import { systemPrompt } from '@/lib/ai/prompts';

const messages: Anthropic.Messages.MessageParam[] = [
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

const MODEL = 'claude-3-5-sonnet-20241022';
const MCP_HOST = 'http://localhost:3000';
const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key';
const MCP_URL = new URL(`${MCP_HOST}/mcp?mode=dynamic`);

const maxSteps = 10;

// Initialize Anthropic client with API key from environment
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
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

    // Convert MCP tools to Anthropic's tool format
    const anthropicMcpTools: any[] = mcpTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    // Convert static tools to Anthropic's tool format
    const anthropicStaticTools: any[] = Object.keys(staticTools).map(
      (toolName) => {
        const tool = staticTools[toolName as keyof typeof staticTools];
        return {
          name: toolName,
          description: tool.description,
          input_schema: zodToJsonSchema(tool.parameters),
        };
      },
    );

    const allTools = [...anthropicMcpTools, ...anthropicStaticTools];

    console.log(
      '>> Using tools',
      allTools.map((tool) => tool.name),
    );

    const response = await anthropic.messages.create({
      model: MODEL,
      messages,
      system: systemPrompt,
      tools: allTools.length > 0 ? allTools : undefined,
      max_tokens: 4096,
    });

    const assistantMessage = response.content[0];
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // Handle different completion reasons - this determines conversation flow
    switch (response.stop_reason) {
      case 'end_turn':
        // Model completed its response naturally
        ended = true;
        break;

      case 'tool_use': {
        // Model wants to use tools - we need to manually execute them
        const toolResults: any[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            try {
              const toolName = block.name;
              const toolArgs = block.input;

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
                  arguments: toolArgs as Record<string, unknown>,
                });
              }

              // Format the result for Anthropic's expected tool message format
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              console.log(` Tool call error: ${block.name}:`);
              console.error(error);

              /**
               * Handle error and push it as a tool call result to maintain conversation flow
               */
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              });
            }
          }
        }

        // Add a single user message with all tool results
        messages.push({
          role: 'user',
          content: toolResults,
        });
        break;
      }

      case 'max_tokens':
        console.log('⚠️  Response truncated due to token limit');
        ended = true;
        break;

      default:
        console.log(`🤔 Unknown stop reason: ${response.stop_reason}`);
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
