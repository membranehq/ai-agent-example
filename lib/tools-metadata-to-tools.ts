import { IntegrationAppClient } from '@integration-app/sdk';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { z } from 'zod';
import { type Tool, tool } from 'ai';
import type { ToolIndexItem } from './types';

interface ToolsMetadataToToolsProps {
  toolsIndexItems: ToolIndexItem[];
  integrationAppCustomerAccessToken: string;
  includeConfigureTools?: boolean;
}

export async function toolsMetadataToTools({
  toolsIndexItems,
  integrationAppCustomerAccessToken,
  includeConfigureTools,
}: ToolsMetadataToToolsProps) {
  const tools = {} as Record<string, Tool>;

  if (!toolsIndexItems) {
    return {};
  }

  const integrationAppClient = new IntegrationAppClient({
    token: integrationAppCustomerAccessToken,
  });

  for (const toolIndexItem of toolsIndexItems) {
    /**
     * TODO: stop sourcing inputSchema from membrane
     * We hit a limit when storing inputSchema in Pinecone so for now we are fetching it from membrane
     *
     * We've move away from Pinecone to Postgres with PgVector so we can store the inputSchema in the database
     * along with vector embeddings and tool metadata to avoid the limit.
     */
    const { inputSchema } = await integrationAppClient
      .action({
        key: toolIndexItem.toolKey,
        integrationKey: toolIndexItem.integrationName,
      })
      .get();

    const parametersSchema = JSONSchemaToZod.convert(inputSchema ?? {});

    tools[toolIndexItem.toolKey] = tool({
      description: toolIndexItem.text,
      parameters: parametersSchema,
      execute: async (args) => {
        try {
          const result = await integrationAppClient
            .actionInstance({
              autoCreate: true,
              integrationKey: toolIndexItem.integrationName,
              parentKey: toolIndexItem.toolKey,
            })
            .run(args);

          return {
            content: [
              {
                type: 'text',
                text: result.output,
              },
            ],
          };
        } catch (error) {
          console.error('Error calling action', error);
          return {
            content: [
              {
                type: 'text',
                text: 'Error calling action',
              },
            ],
          };
        }
      },
    });

    // If includeConfigureTools is true and the action is a create action, add a configuration tool
    if (includeConfigureTools && toolIndexItem.toolKey.startsWith('create-')) {
      const configureToolKey = `configure__${toolIndexItem.toolKey}`;
      tools[configureToolKey] = tool({
        description: `Configure ${toolIndexItem.text}`,
        parameters: z.object({}),
        execute: async () => {
          return {
            schema: parametersSchema,
          };
        },
      });
    }
  }

  return tools;
}
