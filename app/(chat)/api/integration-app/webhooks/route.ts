import { verifyIntegrationAppToken } from '@/lib/integration-app/verifyIntegrationAppToken';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserById } from '@/lib/db/queries';
import { removeToolsForAppFromIndex } from '@/lib/pinecone/remove-tools-for-app-from-index';
import { indexMcpToolsForApp } from '@/lib/pinecone/index-user-mcp-tools-for-app';

const schema = z.object({
  eventType: z.string(),
  data: z.object({
    connection: z.object({
      user: z.object({
        internalId: z.string(),
      }),
      integration: z.object({
        key: z.string(),
      }),
    }),
  }),
});

export async function POST(request: NextRequest) {
  const payload = await verifyIntegrationAppToken(request);

  if (!payload) {
    return new Response('Unauthorized', { status: 401 });
  }

  const requestBody = await request.json();

  const { eventType, data } = requestBody as z.infer<typeof schema>;

  const {
    user: { internalId },
  } = data.connection;

  const user = await getUserById(internalId);

  if (!user) {
    return new Response('User not found', { status: 404 });
  }

  const _user = {
    id: user.id,
    name: user.name,
  };

  /**
   * Store and remove tools from index based on event type.
   */

  switch (eventType) {
    case 'connection.created':
      await indexMcpToolsForApp({
        user: _user,
        app: data.connection.integration.key,
      });
      break;
    case 'connection.deleted':
      await removeToolsForAppFromIndex({
        user: _user,
        app: data.connection.integration.key,
      });
      break;
    case 'connection.disconnected':
      await removeToolsForAppFromIndex({
        user: _user,
        app: data.connection.integration.key,
      });
      break;
  }

  return Response.json({ success: true }, { status: 200 });
}
