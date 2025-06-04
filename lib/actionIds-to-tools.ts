import { IntegrationAppClient } from '@integration-app/sdk';
import { zodFromJsonSchema } from '@/lib/zod-helpers';
import type { ZodRawShape } from 'zod';
import type { Tool } from 'ai';

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

    const inputSchema = zodFromJsonSchema(
      action.inputSchema,
    ) as unknown as ZodRawShape;

    tools[action.key] = {
      description: action.name,
      parameters: inputSchema,
      execute: async (args) => {
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
      },
    };

    // If includeConfigureTools is true and the action is a create action, add a configuration tool
    if (includeConfigureTools && action.key.startsWith('create-')) {
      const configureToolKey = `configure__${action.key}`;
      tools[configureToolKey] = {
        description: `Configure ${action.name}`,
        parameters: inputSchema,
        execute: async () => {
          // Return the input schema for UI rendering
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  schema: action.inputSchema,
                  actionKey: action.key,
                  actionName: action.name,
                }),
              },
            ],
          };
        },
      };
    }
  }

  return tools;
}
