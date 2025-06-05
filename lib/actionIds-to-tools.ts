import { IntegrationAppClient } from '@integration-app/sdk';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { z, type ZodRawShape } from 'zod';
import { type Tool, tool } from 'ai';

/**
 * TODO: MOVE to MCP SERVER
 *
 * Given a list of actionIds, fetch the actions and return a list of tools to be used in an llm
 */

interface ActionIdsToToolsProps {
  actionIds: string[];
  integrationAppCustomerAccessToken: string;
  includeConfigureTools?: boolean;
}


export async function actionIdsToTools({
  actionIds,
  integrationAppCustomerAccessToken,
  includeConfigureTools,
}: ActionIdsToToolsProps) {
  const tools = {} as Record<string, Tool>;

  if (!actionIds) {
    return {};
  }

  const integrationAppClient = new IntegrationAppClient({
    token: integrationAppCustomerAccessToken,
  });

  for (const actionId of actionIds.slice(0, 1)) {
    const action = await integrationAppClient
      .action({
        id: actionId,
      })
      .get();

    if (!action) continue;

    const inputSchema = JSONSchemaToZod.convert(action.inputSchema ?? {});

    tools[action.key] = tool({
      description: action.name,
      parameters: inputSchema,
      execute: async (args) => {
        try {
          const result = await integrationAppClient
          .actionInstance({
            autoCreate: true,
            integrationKey: action.integration?.key,
            parentKey: action.key,
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
    if (includeConfigureTools && action.key.startsWith('create-')) {
      const configureToolKey = `configure__${action.key}`;
      tools[configureToolKey] = tool({
        description: `Configure ${action.name}`,
        parameters: z.object({}),
        execute: async () => {
          return {
            schema: action.inputSchema,
          };
        },
      });
    }
  }

  return tools;
}
