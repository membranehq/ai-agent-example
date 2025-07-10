import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  type Tool,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { myProvider } from '@/lib/ai/providers';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { suggestApps } from '@/lib/ai/tools/suggest-apps';
import { getActions } from '@/lib/ai/tools/get-actions';
import { renderForm } from '@/lib/ai/tools/renderForm';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { streamText } from './streamText';
import type { StaticTools } from '@/lib/ai/constants';
import { MCPSessionManager } from '@/lib/mcp/mcp-session';
import { getSessionIdForChat } from '@/lib/mcp/get-session-id-for-chat';

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedVisibilityType } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });
    let isNewChat = false;

    if (!chat) {
      isNewChat = true;
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    let previousMessages = [] as unknown;

    if (!isNewChat) {
      previousMessages = await getMessagesByChatId({ id });
    }

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const integrationAppCustomerAccessToken =
      await generateIntegrationAppCustomerAccessToken({
        id: session.user.id,
        name: session.user.name,
      });

    const user = {
      id: session.user.id,
      name: session.user.name ?? '',
    };

    const staticTools: Record<keyof typeof StaticTools, Tool> = {
      suggestApps: suggestApps({
        user,
      }),
      renderForm: renderForm(integrationAppCustomerAccessToken),
      getActions: getActions({
        integrationAppCustomerAccessToken,
        user,
      }),
    };

    const serverUrl =
      `${process.env.INTEGRATION_APP_MCP_SERVER_HOST}/mcp` as string;

    const existingSessionIdForChat = await getSessionIdForChat(
      id,
      integrationAppCustomerAccessToken,
    );

    /**
     * Reused existing MCP session or initialize a new one
     */
    const mcpSessionManager = new MCPSessionManager({
      mcpBaseUrl: serverUrl,
      userId: session.user.id,
      chatId: id,
      sessionId: existingSessionIdForChat,
      token: integrationAppCustomerAccessToken,
      mode: 'dynamic',
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        await streamText(
          {
            dataStream,
            userMessage: message,
          },
          {
            model: myProvider.languageModel('chat-model'),
            system: systemPrompt,
            messages,
            maxSteps: 20,
            experimental_generateMessageId: generateUUID,
            toolCallStreaming: true,
            getTools: async () => {
              const mcpTools = await mcpSessionManager.tools({
                useCache: false,
              });

              return {
                ...mcpTools,
                ...staticTools,
              };
            },
            onError: (error) => {
              console.error('onError: Error in chat route');
              console.log(error);

              dataStream.writeData({
                type: 'error',
                message: (error.error as Error).message,
              });
            },
            onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [message],
                    responseMessages: response.messages,
                  });

                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId: id,
                        role: assistantMessage.role,
                        parts: assistantMessage.parts,
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                      },
                    ],
                  });
                } catch (e) {
                  console.error('Error on finish', e);
                }
              }
            },
          },
        );
      },
      onError: (error) => {
        console.error('createDataStreamResponse:');
        console.log(error);

        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    console.error('Error in chat route', error);
    return new ChatSDKError('others').toResponse();
  }
}

export async function GET(request: Request) {
  const resumeRequestedAt = new Date();

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const messages = await getMessagesByChatId({ id: chatId });
  const mostRecentMessage = messages.at(-1);

  if (!mostRecentMessage) {
    return new Response(emptyDataStream, { status: 200 });
  }

  if (mostRecentMessage.role !== 'assistant') {
    return new Response(emptyDataStream, { status: 200 });
  }

  const messageCreatedAt = new Date(mostRecentMessage.createdAt);

  if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
    return new Response(emptyDataStream, { status: 200 });
  }

  const restoredStream = createDataStream({
    execute: (buffer) => {
      buffer.writeData({
        type: 'append-message',
        message: JSON.stringify(mostRecentMessage),
      });
    },
  });

  return new Response(restoredStream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
