import { searchIndex } from '@/lib/pinecone/search-index';
import { refineAppsResultWithAI } from '../refine-apps-result-with-ai';

export interface SearchIndexAndSuggestAppsProps {
  query: string;
  index: 'membrane' | 'client-tools';
  namespace?: string;
}

export async function searchIndexAndSuggestApps({
  query,
  index,
  namespace,
}: SearchIndexAndSuggestAppsProps): Promise<{
  apps: string[];
  query: string;
  answer: string;
}> {
  try {
    const searchActionResult = await searchIndex({
      query,
      topK: 6,
      index,
      namespace,
    });

    const allApps = Array.from(
      new Set(
        searchActionResult
          .map((result) => result.integrationKey)
          .filter(Boolean),
      ),
    );

    const relevantApps = await refineAppsResultWithAI(query, allApps);

    const answer =
      relevantApps.length === 0
        ? `I couldn't find any relevant apps for your query.`
        : relevantApps.length === 1
          ? `Based on your prompt, I found that ${relevantApps[0]} is the most relevant app for your needs.`
          : `Based on your prompt, "${query}", I found these relevant apps: ${relevantApps.join(', ')}. Please select which one you'd like to use.`;

    return {
      apps: relevantApps,
      query,
      answer,
    };
  } catch (error) {
    console.error('Error in suggestApps', error);
    return {
      apps: [],
      query,
      answer: 'An error occurred while trying to find relevant apps',
    };
  }
}
