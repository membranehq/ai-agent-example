import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { searchIndex } from '@/lib/pinecone/search-index';
import { indexMcpTools } from '@/lib/pinecone/index-user-mcp-tools';
import pRetry from 'p-retry';

interface GetActionsProps {
  integrationAppCustomerAccessToken: string;
  user: {
    id: string;
    name: string;
  };
}

const parameters = z.object({
  app: z.string().describe(`The key of the app to get actions for`),
  query: z
    .string()
    .describe(`Summary of action to be taken by the user with app name included if user provided it, the details of the action should not be included in the query.

    <examples>
      "Can you send an email" = "send email"
      "create a page on notion" = "notion: create page"
      "Can you send an email to jude@gmail" = "send email"
      "What events do I have on google calendar" = "google-calendar: get events"
      "Where are my contacts" = "get contacts"
    </examples>
  `),
});

export const getActions = ({
  integrationAppCustomerAccessToken,
  user,
}: GetActionsProps) => {
  return {
    description: 'Get related actions for the selected app.',
    parameters,
    execute: async ({
      app,
      query,
    }: z.infer<typeof parameters>) => {
      try {
        const integrationAppClient = new IntegrationAppClient({
          token: integrationAppCustomerAccessToken,
        });

        const result = await integrationAppClient.connections.find({
          integrationKey: app,
        });

        const isDisconnected = result.items?.[0]?.disconnected === true;

        if (result.items.length === 0 || isDisconnected) {
          return {
            success: false,
            error: {
              app,
              type: isDisconnected ? 'needs_reconnect' : 'not_connected',
              message: isDisconnected
                ? `You need to reconnect to ${app} to use it, click the button above to reconnect`
                : `You don't have a connection to ${app}, Click the button above to connect to ${app}`,
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

        /**
         * After a connection is made, we refresh the tools index, see /webhooks/
         *
         * So we expect the index to be updated and tools to be available for search
         * After a few retries, if no tools are found, we index the tools and search again
         */
        const searchResults = await searchWithRetry().catch(async () => {
          await indexMcpTools({ user, app });
          return await searchWithRetry();
        });

        return {
          success: true,
          data: {
            tools: searchResults.map((tool) => tool.toolKey),
          },
        };
      } catch (error) {
        console.error('Failed to get actions', error);
        return {
          success: false,
          error: {
            type: 'internal_error',
            message:
              'Failed to get actions, please run getActions again',
          },
        };
      }
    },
  };
};
