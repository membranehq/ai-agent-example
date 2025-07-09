import { generateObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '../providers';

export async function refineAppsResultWithAI(
  query: string,
  apps: string[],
): Promise<string[]> {
  const prompt = `
  <goal>
    - Based on the user's query, identify ONLY the most highly relevant apps that directly address the user's needs.
    - If there are multiple apps that are relevant, return them in order of relevance (most-relevant first).
    - Sometimes you'll receive an abstract query that doesn't specifically
      identify apps or services. In these cases, you should identify relevant apps
      or services from the the list of apps provided.
    - ALWAYS prefer popular consumer services, unless the user identifies a
      specific app. For example:

      - Prefer Gmail over AWS SES or Sendgrid.
      - Prefer Notion or Google Drive to Box or OneDrive.
      - Prefer Slack over Microsoft Teams.
    
    - IMPORTANT: Only return apps that are HIGHLY relevant to the query. If an app
      is only tangentially related or has low relevance, DO NOT include it.
    - Be conservative in your selection - it's better to return fewer, highly relevant
      apps than many apps with varying degrees of relevance.
    - Return only the app slugs that are most relevant to the query.
  <goal>
  <apps>
    - ${apps.join('\n    - ')}
  </apps>
  <user_query>
    ${query}
  </user_query>
`;

  const { object } = await generateObject({
    model: myProvider.languageModel('refine-apps-model'),
    temperature: 0,
    system: prompt,
    prompt: `Identify ONLY the most highly relevant apps for this query and return them as an array of app slugs. Be conservative and only include apps that are directly relevant to the user's needs.`,
    output: 'array',
    schema: z.string().describe('App slug identifier'),
  });

  return object;
}
