import { Pinecone } from '@pinecone-database/pinecone';
import type { PineActionActionItem } from '../types';

export async function searchActions(query: string, topK = 10, appName?: string) {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pc.index(process.env.PINECONE_TOOLS_INDEX_NAME as string);

  const results = (await index.searchRecords({
    fields: ['*'],
    query: {
      topK,
      inputs: { text: query },
      ...(appName ? {
        filter: {
          integrationName: {
            $eq: appName
          },
        },
      } : {}),
    },
  })) as {
    result: {
      hits: {
        _id: string;
        _score: number;
        fields: Exclude<PineActionActionItem, 'id'>;
      }[];
    };
  };

  const relatedActions = results.result.hits.map((hit) => ({
    ...hit.fields,
    id: hit._id,
  }));

  return relatedActions;
}
