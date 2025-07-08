/**
 * Check MCP server to see if this chat has an ongoing session
 */
export const getSessionIdForChat = async (
  chatId: string,
  integrationAppCustomerAccessToken: string,
) => {
  try {
    const serverUrl =
      `${process.env.INTEGRATION_APP_MCP_SERVER_HOST}/mcp` as string;

    const getSessionResponse = await fetch(`${serverUrl}/sessions`, {
      headers: {
        'x-chat-id': chatId,
        Authorization: `Bearer ${integrationAppCustomerAccessToken}`,
      },
    });

    if (!getSessionResponse.ok) {
      return undefined;
    }

    const getSessionResponseJson = await getSessionResponse.json();

    const sessionId = getSessionResponseJson[chatId];

    return sessionId;
  } catch (error) {
    return undefined;
  }
};
