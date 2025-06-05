import { searchActions } from '@/lib/pinecone/search-actions';
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
        E.g for "Can you send an email to jude@gmail" the query should be "gmail: send an email"
        E.g for "What events do I have on google calendar" the query should be "google-calendar: get events"
      `),
  }),
  execute: async ({ query }) => {
    /**
     * Check to if the app is supported
     */
    const appName = query.split(':')[0]?.trim();
    
    if(appName) {
      const searchActionResult = await searchActions(query, 1);
      const hasExactAppMatch = searchActionResult.some(action => action.integrationName === appName);

      if(hasExactAppMatch) {
        return `Yes, we support ${appName}`
      }
      
      return `No, we don't support ${appName}`
    }

    const searchActionResult = await searchActions(query, 5);
   

    return `Based on your prompt, "${query}", I found these relevant apps: ${searchActionResult.map(action => action.integrationName).join(', ')}, Please select which ones you'd like to use.`
  },
});
