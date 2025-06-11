import { tool } from 'ai';
import { z } from 'zod';
import { searchIndexAndSuggestApps } from './utils/search-Index-and-suggest-apps';

export const getMoreRelevantApp = tool({
  description: `When you already tried to get list of relevant apps for a user query but we didn't find any or they seem irrelevant, we should use this tool to get more relevant apps.
  `,
  parameters: z.object({
    query: z
      .string()
      .describe(
        `The query that was used to get the list of relevant apps, we should use this query to get more relevant apps`,
      ),
  }),
  execute: async ({ query }) => {
    const result = await searchIndexAndSuggestApps({
      query,
      index: 'membrane',
    });

    return result;
  },
});
