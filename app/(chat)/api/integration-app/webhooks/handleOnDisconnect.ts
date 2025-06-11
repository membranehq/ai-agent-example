import { searchIndex } from '@/lib/pinecone/search-index';
import { Pinecone } from '@pinecone-database/pinecone';

interface HandleOnDisconnectProps {
  user: {
    id: string;
    name: string;
  };
  app: string;
}

/**
 * On disconnect, we want to remove all tools for the disconnected app for the user.
 */

export async function handleOnDisconnect({
  user,
  app,
}: HandleOnDisconnectProps) {
  const INDEX_NAME = process.env.PINECONE_CLIENT_TOOLS_INDEX_NAME as string;

  /**
   * TODO: We need a way to be able to list of records that match a filter
   * Right now we don't get all the records so we still end up with some tools
   * in the index
   */
  const searchActionResult = await searchIndex({
    query: app,
    namespace: user.id,
    index: 'client-tools',
    filter: {
      integrationName: app,
      userId: user.id,
    },
  });

  console.log(
    `Found ${searchActionResult.length} tools for the disconnected app: ${app}`,
  );

  const recordIds = searchActionResult.map((record) => record.id);

  if (recordIds.length === 0) {
    return;
  }
  console.log(
    `Deleting ${recordIds.length} tools for the disconnected app: ${app}`,
  );

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pinecone.Index(INDEX_NAME);

  await index.namespace(user.id).deleteMany(recordIds);
}
