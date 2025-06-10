import { Pinecone } from '@pinecone-database/pinecone';
import type { ToolIndexItem } from '../types';

interface SearchActionsProps {
  /**
   * query to search for
   * e.g "get contacts"
   */
  query: string;

  /**
   * number of results to return
   */
  topK?: number;

  /**
   * namespace to search in
   */
  namespace?: string;

  /**
   * index name to search in
   */
  indexName?: string;

  /**
   * filter to apply to the search
   */
  filter?: Record<string, any>;
}

const DEFAULT_NAMESPACE = '__default__';

export async function searchIndex({
  query,
  topK = 10,
  namespace = DEFAULT_NAMESPACE,
  indexName = process.env.PINECONE_TOOLS_INDEX_NAME as string,
  filter,
}: SearchActionsProps) {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pc.index(indexName);

  const results = (await index.namespace(namespace).searchRecords({
    fields: ['*'],
    query: {
      topK,
      inputs: { text: query },
      ...(filter ? { filter } : {}),
    },
  })) as {
    result: {
      hits: {
        _id: string;
        _score: number;
        fields: Exclude<ToolIndexItem, 'id'>;
      }[];
    };
  };

  const relatedActions = results.result.hits.map((hit) => ({
    ...hit.fields,
    id: hit._id,
  }));

  return relatedActions;
}
