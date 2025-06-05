import { tool } from 'ai';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { updateChatExposedTools } from '@/lib/db/queries';

import { searchActions } from '@/lib/pinecone/search-actions';

export const exposeTools = (chatId: string, token: string) =>
  tool({
    description:
      'Expose tools for the selected app.',
    parameters: z.object({
      app: z.string().describe(`The key of the app to expose tools for`),
      query: z
      .string()
      .describe(`Summary of action to be taken by the user with app name included if user provided it, the details of the action should not be included in the query
        E.g for "Can you send an email" the query should be "send an email"
        E.g for create a page on notion the query should be "notion: create a page"
        E.g for "Can you send an email to jude@gmail" the query should be "send an email"
        E.g for "What events do I have on google calendar" the query should be "google-calendar: get events"
        E.g for "Where are my contacts" the query should be "get contacts"
      `),
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

        const searchActionResult = await searchActions(query, 1);

        console.log('searchActionResult', searchActionResult);

        if (hasConnectionToApp) {
          await updateChatExposedTools({
            chatId,
            actionIds: searchActionResult.map((tool) => tool.id),
          });

          return {
            success: true,
            data: {
              text: `Thanks, I've exposed tools for ${app}, don't say anything else`,
              /*
                List of related actions to the user's query
                naming it internal_hash here to prevent llm from trying to use it.
               */
              internal_hash: searchActionResult.map((action) => action.id),
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
