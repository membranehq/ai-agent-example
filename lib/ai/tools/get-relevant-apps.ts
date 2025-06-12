import { tool } from 'ai';
import { z } from 'zod';
import { searchIndexAndSuggestApps } from './utils/search-Index-and-suggest-apps';

/**
 * Search client tools index for relevant apps related to the user query
 */
export const getRelevantApps = ({
  user,
}: { user: { id: string; name: string } }) =>
  tool({
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
      const result = await searchIndexAndSuggestApps({
        query,
        index: 'client-tools',
        namespace: user.id,
      });

      return result;
    },
  });
