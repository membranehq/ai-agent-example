import { Pinecone } from '@pinecone-database/pinecone';

interface HandleOnDisconnectProps {
  user: {
    id: string;
    name: string;
  };
  app: string;
}

/**
 * On disconnect, we want to remove all tools for the disconnected app for the user from the index.
 */

export async function removeToolsForAppFromIndex({
  user,
  app,
}: HandleOnDisconnectProps) {
  const INDEX_NAME = process.env.PINECONE_CLIENT_TOOLS as string;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pinecone.Index(INDEX_NAME);

  console.log(`Deleting tools for the disconnected app: ${app}`);

  await index.namespace(user.id).deleteMany({
    integrationKey: {
      $eq: app,
    },
  });
}
