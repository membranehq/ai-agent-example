import { searchIndex } from '@/lib/pinecone/search-index';

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
    // If query contains an app name it should be in this format:
    // app-name: action
    // E.g: google-calendar: get events
    // E.g: notion: create a page
    const appName = query.includes(':') ? query.split(':')[0]?.trim() : null;

    const searchActionResult = await searchIndex({
      query,
      topK: 10,
      index,
      namespace,
    });

    const appNameIsExactMatch = searchActionResult.some(
      (action) => action.integrationKey === appName,
    );

    if (appName && appNameIsExactMatch) {
      return {
        apps: [appName],
        query,
        answer: `Proceeding with ${appName}`,
      };
    }

    const apps = Array.from(
      new Set(searchActionResult.map((action) => action.integrationKey)),
    );

    if (appName && !appNameIsExactMatch) {
      return {
        apps,
        query,
        answer: `I couldn't find a match for ${appName}, Do you mean ${apps.join(', ')}?`,
      };
    }

    const answer = `Based on your prompt, "${query}", I found these relevant apps: ${apps.join(', ')}, Please select which ones you'd like to use.`;

    return {
      apps,
      query,
      answer,
    };
  } catch (error) {
    console.error('Error in getRelevantApps', error);
    return {
      apps: [],
      query,
      answer: 'And error occurred while trying to find relevant apps',
    };
  }
}
