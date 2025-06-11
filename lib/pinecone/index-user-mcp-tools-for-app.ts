import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getToolsFromMCP } from '@/lib/integration-app/getToolsFromMCP';
import type { ToolIndexItem } from '@/lib/types';
import { Pinecone } from '@pinecone-database/pinecone';

interface HandleConnectProps {
  user: {
    id: string;
    name: string;
  };
  app: string;
}

/**
 * On connect, we want to index all tools the app the user has connected.
 */
export async function indexMcpToolsForApp({ user, app }: HandleConnectProps) {
  const INDEX_NAME = process.env.PINECONE_CLIENT_TOOLS as string;

  const token = await generateIntegrationAppCustomerAccessToken({
    id: user.id,
    name: user.name,
  });

  console.log('Getting tools for connected app', {
    app,
  });

  // get tools for the app that was connected from MCP
  const toolsForConnectedApp = await getToolsFromMCP({
    token,
    app,
  });

  console.log(
    `We got ${Object.keys(toolsForConnectedApp).length} tools for the connected app: ${app}`,
  );

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pinecone.Index(INDEX_NAME);

  const records: (ToolIndexItem & { userId: string })[] = [];

  /////////////////
  // INDEX TOOLS //
  //////////////////
  for (const toolKey in toolsForConnectedApp) {
    const tool = toolsForConnectedApp[toolKey];

    /**
     * The MCP server puts the app name in the tool description
     * e.g "FindById: Databases (Notion)"
     * We want to extract the app name from the description.
     */
    const match = tool?.description?.match(/\(([^)]+)\)/);
    const integrationName = match ? match[1] : null;

    const integrationSlug = integrationName
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const record = {
      id: `${integrationSlug}_${toolKey}`, // TODO: add a unique id for the tool
      toolKey: toolKey,
      text: tool.description as string,
      integrationName: integrationSlug as string,
      // inputSchema: JSON.stringify(z.toJSONSchema(tool.parameters as any)),
      userId: user.id,
    };

    records.push(record);
  }

  // Upsert in batches to avoid rate limiting errors
  const BATCH_SIZE = 90;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
        records.length / BATCH_SIZE,
      )}`,
    );

    console.log('Storing tools in Pinecone', {
      index: INDEX_NAME,
      namespace: user.id,
    });

    // use a namespace per user
    await index.namespace(user.id).upsertRecords(batch);
  }
}
