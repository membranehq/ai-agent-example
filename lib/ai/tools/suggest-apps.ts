import { z } from 'zod';
import { searchIndex } from '@/lib/pinecone/search-index';
import { refineAppsResultWithAI } from './utils/refine-apps-result-with-ai';

const formatAnswer = (query: string, apps: string[]): string => {
  if (apps.length === 0) {
    return "I couldn't find any relevant apps for your query.";
  }

  if (apps.length === 1) {
    return `Based on your prompt, I found that ${apps[0]} is the most relevant app for your needs.`;
  }

  return `Based on your prompt, "${query}", I found these relevant apps: ${apps.join(', ')}. Please select which one you'd like to use.`;
};

const extractUniqueIntegrationKeys = (searchResults: any[]): string[] => {
  return Array.from(
    new Set(
      searchResults.map((result) => result.integrationKey).filter(Boolean),
    ),
  );
};

const searchClientToolsIndex = async (
  query: string,
  userId: string,
): Promise<string[]> => {
  const searchResults = await searchIndex({
    query,
    topK: 10,
    index: 'client-tools',
    namespace: userId,
  });

  return extractUniqueIntegrationKeys(searchResults);
};

const searchMembraneIndex = async (query: string): Promise<string[]> => {
  const searchResults = await searchIndex({
    query,
    index: 'membrane',
    topK: 10,
  });

  return extractUniqueIntegrationKeys(searchResults);
};

const findRelevantApps = async (query: string, userId: string) => {
  // Search both indexes concurrently
  const [clientToolsApps, membraneApps] = await Promise.all([
    searchClientToolsIndex(query, userId),
    searchMembraneIndex(query),
  ]);

  // Try client-tools index first
  const refinedClientToolsApps = await refineAppsResultWithAI(
    query,
    clientToolsApps,
  );

  console.log({
    query,
    clientToolsApps,
    refinedClientToolsApps,
  });

  if (refinedClientToolsApps.length >= 1) {
    return refinedClientToolsApps;
  }

  // Fallback to membrane apps if no client-tools results
  const refinedMembraneApps = await refineAppsResultWithAI(query, membraneApps);
  console.log({
    query,
    membraneApps,
    refinedMembraneApps,
  });
  return refinedMembraneApps;
};

const parameters = z.object({
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

export const suggestApps = ({
  user,
}: { user: { id: string; name: string } }) => {
  return {
    description: `See if you can find relevant apps for a user query if they are asking to perform an operation e.g:  What events do I have for today? or Can you create a page on notion?`,
    parameters,
    execute: async ({ query }: z.infer<typeof parameters>) => {
      const apps = await findRelevantApps(query, user.id);

      return {
        query,
        apps,
        answer: formatAnswer(query, apps),
      };
    },
  };
};
