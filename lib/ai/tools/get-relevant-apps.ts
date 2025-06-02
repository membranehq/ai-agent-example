import { updateChatExposedToolsApp } from '@/lib/db/queries';
import { tool } from 'ai';
import { z } from 'zod';

export const getRelevantApps = tool({
  description: `Get relevant apps for a user query if they are asking to perform an operation e.g:
    - What events do I have for today?
    - Can you create a page on notion?
    `,
  parameters: z.object({
    apps: z
      .array(z.string())
      .describe(
        `The name of apps that the user may be referring to all in lower case`,
      ),
    query: z.string().describe(`Summary of action to be taken by the user`),
  }),
  execute: async ({ apps, query }) => {
    return {
      apps: apps,
      answer: `Based on your prompt, "${query}", I found these relevant apps: ${apps.join(', ')}, Please select which ones you'd like to use.`,
    };
  },
});
