import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getChatExposedTools,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getRelevantApps } from '@/lib/ai/tools/get-relevant-apps';
import { getActions } from '@/lib/ai/tools/get-actions';
import { connectApp } from '@/lib/ai/tools/connect-app';
import { toolsMetadataToTools } from '@/lib/tools-metadata-to-tools';
import type { ToolIndexItem } from '@/lib/types';
import { getMoreRelevantApp } from '@/lib/ai/tools/get-more-relevant-app';

export const maxDuration = 60;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType } =
      requestBody;

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

    if (!chat) {
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

    const previousMessages = await getMessagesByChatId({ id });

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

    const actionList =
      ((chat?.exposedTools as any)?.toolList as ToolIndexItem[]) ?? [];

    const exposedTools = await toolsMetadataToTools({
      toolsIndexItems: actionList,
      integrationAppCustomerAccessToken,
      includeConfigureTools: false,
    });

    const user = {
      id: session.user.id,
      name: session.user.name ?? '',
    };

    const stream = createDataStream({
      execute: async (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt(),
          messages,
          maxSteps: 10,
          experimental_generateMessageId: generateUUID,
          toolCallStreaming: true,
          experimental_transform: smoothStream({
            delayInMs: 20, // optional: defaults to 10ms
            chunking: 'line', // optional: defaults to 'word'
          }),
          onError: (error) => {
            console.error('RESULT1: Error in chat route');
            console.log(error);
          },
          tools: {
            ...exposedTools,
            getRelevantApps: getRelevantApps({
              user,
            }),
            getMoreRelevantApp: getMoreRelevantApp,
            getActions: getActions({
              chatId: id,
              integrationAppCustomerAccessToken,
              user,
            }),
            connectApp: connectApp(integrationAppCustomerAccessToken),
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
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
          experimental_sendFinish: false,
        });

        const steps = await result.steps;

        let shouldPopulateTools = false;

        for (const step of steps) {
          const exposeToolResult = step.toolResults.find(
            (toolResult) => toolResult.toolName === 'getActions',
          )?.result;

          if (exposeToolResult) {
            if (
              exposeToolResult.success &&
              exposeToolResult.data?.exposedToolsCount &&
              exposeToolResult.data.exposedToolsCount > 0
            ) {
              shouldPopulateTools = true;
            }

            break;
          }
        }

        if (shouldPopulateTools) {
          const exposedToolsMeta = await getChatExposedTools({
            chatId: id,
          });

          const derivedTools = await toolsMetadataToTools({
            toolsIndexItems: exposedToolsMeta.toolsList,
            integrationAppCustomerAccessToken,
            includeConfigureTools: false,
          });

          console.log(
            `The following tools were exposed: ${Object.keys(derivedTools).join(`, `)} 
            Now one of the tools will be called
            `,
          );

          const systemPrompt = `
            You're a friendly task assistant, based on task user is trying to perform specified in the messages, call the appropriate tool from this list: 
            ${Object.keys(derivedTools).join(', ')} to perform the task specified by the user
          `;

          const result1 = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: systemPrompt,
            messages,
            maxSteps: 5,
            experimental_generateMessageId: generateUUID,
            toolCallStreaming: true,
            tools: {
              ...derivedTools,
            },
            onError: (error) => {
              console.error('RESULT2: Error in chat route');
              console.error(error);
            },
            onFinish: async ({ response }) => {
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
              } catch (_) {
                console.error('Failed to save chat');
              }
            },
          });

          result1.mergeIntoDataStream(dataStream, {
            experimental_sendStart: false,
            experimental_sendFinish: true,
          });
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    return new Response(stream);
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
