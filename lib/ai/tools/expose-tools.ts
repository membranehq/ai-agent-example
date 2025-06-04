import { Pinecone } from '@pinecone-database/pinecone';

import { tool } from 'ai';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { updateChatExposedTools } from '@/lib/db/queries';
import type { ExposedTool } from '@/lib/types';

export const exposeTools = (chatId: string, token: string) =>
  tool({
    description:
      'Expose tools for the selected app. This tool is called after we have found the relevant apps and the user has selected the app to use or we have found a single relevant app',
    parameters: z.object({
      app: z.string().describe(`The key of the app to expose tools for`),
      query: z
        .string()
        .describe(
          `Summary of action to be taken by the user with app name included`,
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

        const pc = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY as string,
        });

        const index = pc.index(process.env.PINECONE_TOOLS_INDEX_NAME as string);

        const results = (await index.searchRecords({
          fields: ['*'],
          query: {
            topK: 10,
            inputs: { text: query },
          },
        })) as {
          result: {
            hits: {
              _id: string;
              _score: number;
              fields: Exclude<ExposedTool, 'id'>;
            }[];
          };
        };

        const exposedTools = results.result.hits.map((hit) => ({
          ...hit.fields,
          id: hit._id,
        }));

        if (hasConnectionToApp) {
          await updateChatExposedTools({
            chatId,
            exposedTools,
          });

          return {
            success: true,
            data: {
              text: `Thanks, I've exposed tools for ${app}`,
              exposedTools,
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
