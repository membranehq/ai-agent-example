import { IntegrationAppClient } from '@integration-app/sdk';
import { zodFromJsonSchema } from '@/lib/zod-helpers';
import type { ZodRawShape } from 'zod';
import type { Tool } from 'ai';

/**
 * TODO: MOVE to MCP SERVER
 *
 * Given a list of actionIds, fetch the actions and return a list of tools to be used in an llm
 */
export async function actionIdsToTools({
  actionIds,
  token,
}: {
  actionIds: string[];
  token: string;
}) {
  const tools = {} as Record<string, Tool>;

  if (!actionIds) {
    return {};
  }

  const integrationAppClient = new IntegrationAppClient({
    token,
  });

  for (const actionId of actionIds) {
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
  }

  return tools;
}
