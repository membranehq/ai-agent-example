import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import {
  streamText as _streamText,
  appendResponseMessages,
  smoothStream,
} from 'ai';
import type { DataStreamWriter, ToolSet, UIMessage, Message } from 'ai';

/**
 * Wrapper around ai sdk's streamText function. It calls streamText in a loop
 * and pass tools on each iteration. This handles the case where tools may change
 * between steps.
 *
 * @param dataStream - The data stream to write to
 * @param args - The arguments to pass to the streamText function
 */
export const streamText = async (
  { dataStream }: { dataStream: DataStreamWriter; userMessage?: UIMessage },
  args: Omit<Parameters<typeof _streamText>[0], 'tools'> & {
    getTools: () => Promise<ToolSet>;
    cleanup?: () => Promise<void>;
  },
) => {
  const {
    maxSteps = 1,
    maxRetries,
    messages: _messages,
    getTools,
    cleanup,
    ...rest
  } = args;
  // Convert UI messages to proper Message objects with IDs if needed
  let messages = (_messages ?? []).map((msg) =>
    'id' in msg ? msg : { ...msg, id: generateUUID() },
  ) as Message[];

  for (let steps = 0; steps < maxSteps; steps++) {
    const cont = await new Promise<boolean>((resolve, reject) => {
      getTools()
        .then((tools) => {
          console.log('>> Using tools', Object.keys(tools).join(', '));
          const result = _streamText({
            ...rest,
            messages,
            tools,
            experimental_transform: [
              smoothStream({
                chunking: /\s*\S+\s*/m,
                delayInMs: 0,
              }),
            ],
            onFinish: async (event) => {
              console.log('>> Finish reason', event.finishReason);

              switch (event.finishReason) {
                case 'stop':
                case 'content-filter':
                case 'error':
                  resolve(false);
                  break;
                case 'length':
                case 'tool-calls':
                case 'other':
                case 'unknown':
                default:
                  break;
              }

              const assistantId = getTrailingMessageId({
                messages: event.response.messages.filter(
                  (message) => message.role === 'assistant',
                ),
              });

              if (!assistantId) {
                throw new Error('No assistant message found!');
              }

              messages = appendResponseMessages({
                messages,
                responseMessages: event.response.messages,
              });
              await rest.onFinish?.(event);
              resolve(true);
            },
          });

          result.consumeStream();

          result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        })
        .catch(reject);
    });

    if (!cont) {
      console.log(`Ending loop after ${steps} steps`);
      await cleanup?.();
      break;
    }
  }
};
