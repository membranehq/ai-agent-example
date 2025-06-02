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
import { isProductionEnvironment } from '@/lib/constants';
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
// import { getTools } from '@/lib/integration-app/getTools';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getRelevantApps } from '@/lib/ai/tools/get-relevant-apps';
import { cookies } from 'next/headers';

import { ToolInvocation } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

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

const getTools = async (app: string) => {
  console.log('exposing tools for app', app);
  const tools = {
    hubspot: {
      createHubspotContact: tool({
        description: 'Create a new Hubspot contact',
        parameters: z.object({
          firstName: z.string().describe('The first name of the contact'),
          lastName: z.string().describe('The last name of the contact'),
          email: z.string().describe('The email of the contact'),
        }),
        execute: async ({ firstName, lastName, email }) => {
          return {
            success: true,
            contact: {
              id: '123',
              name: 'John Doe',
              email: 'john.doe@example.com',
            },
          };
        },
      }),
    },
    notion: {
      getAllPagesOnNotion: tool({
        description: 'Get all pages on Notion',
        parameters: z.object({}),
        execute: async () => {
          return {
            pages: [
              {
                id: '123',
                title: 'Page Solar',
                url: 'https://www.notion.so/page1',
              },
              {
                id: '456',
                title: 'Page Yowa',
                url: 'https://www.notion.so/page2',
              },
            ],
          };
        },
      }),
      createANotionPage: tool({
        description: 'Create a new Notion page',
        parameters: z.object({
          title: z.string().describe('The title of the page'),
        }),
        execute: async ({ title }) => {
          return {
            success: true,
            page: {
              id: title,
            },
          };
        },
      }),
    },
    'google-calendar': {
      createGoogleCalendarEvent: tool({
        description: 'Create a new event in Google Calendar',
        parameters: z.object({
          title: z.string().describe('The title of the event'),
        }),
        execute: async ({ title }) => {
          return {
            success: true,
            event: {
              id: title,
            },
          };
        },
      }),
      getGoogleCalendarEvents: tool({
        description: 'Get events from Google Calendar',
        parameters: z.object({}),
        execute: async () => {
          return {
            events: [
              {
                id: '123',
                title: 'Event 1',
                description: 'Description 1',
                start: '2025-01-01',
                end: '2025-01-02',
              },
            ],
          };
        },
      }),
    },
  };

  return tools[app as keyof typeof tools];
};

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

    // const token = await generateIntegrationAppCustomerAccessToken({
    //   id: session.user.id,
    //   name: session.user.name ?? '',
    // });

    console.log('chat.exposedToolsApp', chat);

    const exposedTools = chat?.exposedToolsApp
      ? await getTools(chat.exposedToolsApp)
      : {};

    console.log('exposedTools-entry', exposedTools);

    console.log('stream-entry');

    const stream = createDataStream({
      execute: async (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt(),
          messages,
          maxSteps: 10,
          experimental_generateMessageId: generateUUID,
          toolCallStreaming: true,
          tools: {
            ...exposedTools,
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
                // Save the app key we are exposing tools for:
                updateChatExposedToolsApp({
                  chatId: id,
                  app,
                });

                return {
                  app,
                  text: `Thanks, I've exposed tools for ${app}`,
                };
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
          appWeExposeToolsFor = step.toolResults.find(
            (toolResult) => toolResult.toolName === 'internal_exposeTools',
          )?.result.app;

          if (appWeExposeToolsFor) {
            break;
          }
        }

        if (
          appWeExposeToolsFor &&
          appWeExposeToolsFor !== chat?.exposedToolsApp
        ) {
          console.log('getAppsResult', appWeExposeToolsFor);

          const derievedTools = await getTools(appWeExposeToolsFor);

          console.log({ derievedTools });

          //  set tools
          const result1 = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: `You're a friendly task assistant, based on these messages, call the appropriate tool to perform the task specified by the user`,
            messages,
            maxSteps: 5,
            experimental_generateMessageId: generateUUID,
            toolCallStreaming: true,
            tools: {
              ...derievedTools,
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

    const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () => stream),
    //   );
    // } else {
    return new Response(stream);
    // }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

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

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
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

  return new Response(stream, { status: 200 });
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
