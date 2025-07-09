import { verifyIntegrationAppToken } from '@/lib/integration-app/verifyIntegrationAppToken';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserById } from '@/lib/db/queries';
import { indexMcpTools } from '@/lib/pinecone/index-user-mcp-tools';
import { removeToolsForAppFromIndex } from '@/lib/pinecone/remove-tools-for-app-from-index';

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

  const dbUser = await getUserById(data.connection.user.internalId);

  if (!dbUser) {
    return new Response('User not found', { status: 404 });
  }

  /**
   * Re-index tools from MCP server when connection is created, deleted or disconnected
   * This is to make sure that we always have the latest tools in the index
   */
  const shouldRefreshUserToolsIndex =
    eventType === 'connection.created' ||
    eventType === 'connection.deleted' ||
    eventType === 'connection.disconnected';

  if (shouldRefreshUserToolsIndex) {
    await indexMcpTools({
      user: {
        id: dbUser.id,
        name: dbUser.name,
      },
    });
  }

  if (
    eventType === 'connection.disconnected' ||
    eventType === 'connection.deleted'
  ) {
    await removeToolsForAppFromIndex({
      app: data.connection.integration.key,
      user: {
        id: dbUser.id,
        name: dbUser.name,
      },
    });
  }

  return Response.json({ success: true }, { status: 200 });
}
