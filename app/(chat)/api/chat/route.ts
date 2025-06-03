import {
  appendClientMessage,
  appendResponseMessages,
  convertToCoreMessages,
  createDataStream,
  smoothStream,
  streamText,
  tool,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
  updateChatExposedToolsApp,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getRelevantApps } from '@/lib/ai/tools/get-relevant-apps';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
import { getTools } from '@/lib/integration-app/getTools';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

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

    console.log('messageCount', messageCount);

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    console.log('chat-2', chat);

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      console.log('title', title);

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });

      console.log('saveChat');
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    console.log('previousMessages', previousMessages);

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    console.log('messages', messages);

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

    console.log('saveMessages');

    // const streamId = generateUUID();

    // await createStreamId({ streamId, chatId: id });

    const token = await generateIntegrationAppCustomerAccessToken({
      id: session.user.id,
      name: session.user.name ?? '',
    });

    console.log('chat.exposedToolsApp', chat);

    const tools = chat?.exposedToolsApp
      ? await getTools({
          token,
          app: chat.exposedToolsApp,
        })
      : {};

    console.log('stream-entry-----001');

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
          tools: {
            ...tools,
            internal_getRelevantApps: getRelevantApps,
            internal_exposeTools: tool({
              description:
                'Expose tools for the selected app. This tool is called after we have found the relevant apps and the user has selected the app to use or we have found a single relevant app',
              parameters: z.object({
                app: z
                  .string()
                  .describe(`The key of the app to expose tools for`),
              }),
              execute: async ({ app }) => {
                const token = await generateIntegrationAppCustomerAccessToken({
                  id: session.user.id,
                  name: session.user.name ?? '',
                });

                const integrationAppClient = new IntegrationAppClient({
                  token,
                });

                const result = await integrationAppClient.connections.find({
                  integrationKey: app,
                });

                const hasConnectionToApp = result.items.length > 0;

                if (hasConnectionToApp) {
                  await updateChatExposedToolsApp({
                    chatId: id,
                    app,
                  });

                  return {
                    success: true,
                    data: {
                      app,
                      text: `Thanks, I've exposed tools for ${app}`,
                    },
                  };
                }

                return {
                  success: false,
                  data: {
                    app,
                    text: `You don't have a connection to ${app}, connect to ${app} to expose tools`,
                  },
                };
              },
            }),
            connectApp: tool({
              description:
                "Helps user to connect to an app when they don't have a connection to it, it renders a button to connect to the app, and sends a message called `done` when the user has connected to the app",
              parameters: z.object({
                app: z.string().describe('The key of the app to connect to'),
              }),
              execute: async ({ app }) => {
                try {
                  const token = await generateIntegrationAppCustomerAccessToken(
                    {
                      id: session.user.id,
                      name: session.user.name ?? '',
                    },
                  );

                  console.log('token', token);

                  const integrationAppClient = new IntegrationAppClient({
                    token,
                  });

                  const result = await integrationAppClient.integrations.find({
                    search: app,
                  });

                  console.log('result', result);

                  return {
                    message: 'Waiting for user to connect to app',
                    logoUri: result.items[0].logoUri ?? '',
                    integrationKey: result.items[0].key,
                  };
                } catch (error) {
                  console.error('Failed to prepare app for connection', error);
                  return {
                    message: 'Failed prepare app for connection',
                  };
                }
              },
            }),
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

        let appWeExposeToolsFor = null;

        for (const step of steps) {
          const exposeToolResult = step.toolResults.find(
            (toolResult) => toolResult.toolName === 'internal_exposeTools',
          )?.result;

          if (exposeToolResult) {
            if (exposeToolResult.success) {
              appWeExposeToolsFor = exposeToolResult.data.app;
            }

            break;
          }
        }

        if (
          appWeExposeToolsFor &&
          appWeExposeToolsFor !== chat?.exposedToolsApp
        ) {
          const derivedTools = await getTools({
            token,
            app: appWeExposeToolsFor,
          });

          //  set tools
          const result1 = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: `You're a friendly task assistant, based on these messages, call the appropriate tool to perform the task specified by the user`,
            messages,
            maxSteps: 5,
            experimental_generateMessageId: generateUUID,
            toolCallStreaming: true,
            tools: {
              ...derivedTools,
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

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () => stream),
    //   );
    // } else {
    return new Response(stream);
    // }
  } catch (error) {
    console.error('Error in chat route', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

export async function GET(request: Request) {
  // const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  // if (!streamContext) {
  //   return new Response(null, { status: 204 });
  // }

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

  // const stream = await streamContext.resumableStream(
  //   recentStreamId,
  //   () => emptyDataStream,
  // );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  // if (!stream) {
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

// return new Response(stream, { status: 200 });
// }

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
