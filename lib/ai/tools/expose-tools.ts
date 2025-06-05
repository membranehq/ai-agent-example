import { tool } from 'ai';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { updateChatExposedTools } from '@/lib/db/queries';

import { searchActions } from '@/lib/pinecone/search-actions';

export const exposeTools = (chatId: string, token: string) =>
  tool({
    description:
      'Expose tools for the selected app. This tool is called after we have found the relevant apps and the user has selected the app to use or we have found a single relevant app',
    parameters: z.object({
      app: z.string().describe(`The key of the app to expose tools for`),
      query: z
        .string()
        .describe(
          `Summary of action to be taken by the user with app name(s) included`,
        ),
    }),
    execute: async ({ app, query }) => {
      try {
        const integrationAppClient = new IntegrationAppClient({
          token,
        });

        const result = await integrationAppClient.connections.find({
          integrationKey: app,
        });

        const hasConnectionToApp = result.items.length > 0;

        const exposedTools = await searchActions(query, 1);

        if (hasConnectionToApp) {
          await updateChatExposedTools({
            chatId,
            actionIds: exposedTools.map((tool) => tool.id),
          });

          return {
            success: true,
            data: {
              text: `Thanks, I've exposed tools for ${app}`,
              toolIds: exposedTools.map((tool) => tool.id),
            },
          };
        }

        return {
          success: false,
          data: {
            app,
            text: `You don't have a connection to ${app}, connect to ${app} to expose tools`,
          },
        };
      } catch (error) {
        console.error('Failed to expose tools', error);
        return {
          success: false,
          data: {
            error: 'Failed to expose tools due to an internal error',
          },
        };
      }
    },
  });
