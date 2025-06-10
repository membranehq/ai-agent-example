import { searchIndex } from '@/lib/pinecone/search-index';
import { tool } from 'ai';
import { z } from 'zod';

export const getRelevantApps = tool({
  description: `See if you can find relevant apps for a user query if they are asking to perform an operation e.g:
    - What events do I have for today?
    - Can you create a page on notion?
    `,
  parameters: z.object({
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
  execute: async ({ query }) => {
    try {
      const appName = query.includes(':') ? query.split(':')[0]?.trim() : null;

      const searchActionResult = await searchIndex({
        query,
        topK: 10,
      });

      const appNameIsExactMatch = searchActionResult.some(
        (action) => action.integrationName === appName,
      );

      if (appName && appNameIsExactMatch) {
        return {
          apps: [appName],
          answer: `Proceeding with ${appName}`,
        };
      }

      const apps = Array.from(
        new Set(searchActionResult.map((action) => action.integrationName)),
      );

      if (appName && !appNameIsExactMatch) {
        return {
          apps,
          answer: `I couldn't find a match for ${appName}, Do you mean ${apps.join(', ')}?`,
        };
      }

      const answer = `Based on your prompt, "${query}", I found these relevant apps: ${apps.join(', ')}, Please select which ones you'd like to use.`;

      return {
        apps,
        answer,
      };
    } catch (error) {
      console.error('Error in getRelevantApps', error);
      return {
        apps: [],
        answer: 'And error occurred while trying to find relevant apps',
      };
    }
  },
});
