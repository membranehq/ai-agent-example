import { tool } from 'ai';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { updateChatExposedTools } from '@/lib/db/queries';
import { searchIndex } from '@/lib/pinecone/search-index';
import { indexMcpTools } from '@/lib/pinecone/index-user-mcp-tools';
import pRetry from 'p-retry';

interface GetActionsProps {
  chatId: string;
  integrationAppCustomerAccessToken: string;
  user: {
    id: string;
    name: string;
  };
} /**
 * Ensures that user is connected to an app and exposes tools for the app
 *
 * Exposure process:
 * - Make sure user is connected to the app
 * - Get tools for the app from an MCP server and index them
 * - Find the most relevant tools for the user query, if no results are found,
 * retry a few times to give the index time to stabilize
 * - Store the tools in the chat context
 *
 * IF some tools were added to the chat context, we call the LLM again with the chat context tools
 */
export const getActions = ({
  chatId,
  integrationAppCustomerAccessToken,
  user,
}: GetActionsProps) =>
  tool({
    description:
      'Get related actions for the selected app. Run again if it returns exposedToolsCount as 0',
    parameters: z.object({
      app: z.string().describe(`The key of the app to get actions for`),
      query: z
        .string()
        .describe(`Summary of action to be taken by the user with app name included if user provided it, the details of the action should not be included in the query
        E.g for "Can you send an email" the query should be "send an email"
        E.g for create a page on notion the query should be "notion: create a page"
        E.g for "Can you send an email to jude@gmail" the query should be "send an email"
        E.g for "What events do I have on google calendar" the query should be "google-calendar: get events"
        E.g for "What events do I have on my calendar" the query should be "get calendar events" notice that and the app name is included in the query, if the user didn't provide the app name, you shouldn't include it in the query
        E.g for "Where are my contacts" the query should be "get contacts"
      `),
    }),
    execute: async ({ app, query }) => {
      try {
        const integrationAppClient = new IntegrationAppClient({
          token: integrationAppCustomerAccessToken,
        });

        const result = await integrationAppClient.connections.find({
          integrationKey: app,
        });

        if (result.items.length === 0) {
          return {
            success: false,
            data: {
              app,
              text: `You don't have a connection to ${app}, connect to ${app} to get actions`,
            },
          };
        }

        // Search for tools with retry logic
        const searchWithRetry = async () => {
          return await pRetry(
            async () => {
              const results = await searchIndex({
                query,
                topK: 5,
                index: 'client-tools',
                namespace: user.id,
                filter: { integrationKey: app },
              });

              if (results.length === 0) {
                throw new Error('No search results found, retrying...');
              }

              return results;
            },
            {
              retries: 3,
              minTimeout: 1000,
              maxTimeout: 3000,
              onFailedAttempt: (error) => {
                console.log(
                  `Search attempt failed: ${error.message}. Retrying...`,
                );
              },
            },
          );
        };

        // Try to search first, if no results after some retries, index tools and search again
        const searchResults = await searchWithRetry().catch(async () => {
          await indexMcpTools({ user, app });
          return await searchWithRetry();
        });

        // Update chat with found tools
        if (searchResults.length > 0) {
          await updateChatExposedTools({
            chatId,
            toolsList: searchResults.map((tool) => tool.toolKey),
          });
        }

        return {
          success: true,
          data: {
            exposedToolsCount: searchResults.length,
            tools: searchResults.map((tool) => tool.toolKey),
          },
        };
      } catch (error) {
        console.error('Failed to get actions', error);
        return {
          success: false,
          data: {
            error: 'Failed to get actions due to an internal error',
          },
        };
      }
    },
  });
