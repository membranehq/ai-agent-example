'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import { ConnectButton } from './integration-app/connect-button';
import { AppSelectionButton } from './integration-app/app-selection-button';
import { JsonSchemaForm } from './json-schema-form';
import { Loader } from 'lucide-react';
import { ToolResultDisplay } from './tool-result-display';
import { StaticTools } from '@/lib/ai/constants';
import { Skeleton } from './ui/skeleton';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  reload,
  isReadonly,
  requiresScrollPadding,
  append,
  isLastMessage,
  messagesAfterCount,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  append: UseChatHelpers['append'];
  isLastMessage: boolean;
  messagesAfterCount: number;
}) => {
  const [mode, setMode] = useState<'view'>('view');

  const simplerName: Record<string, string> = {
    suggestApps: 'Suggest Apps',
    suggestMoreApps: 'Suggest More Apps',
    getActions: 'Find Actions',
  };

  const renderToolResult = ({
    toolName,
    result,
    args,
    isLastMessage,
    messagesAfterCount,
  }: {
    isLastMessage: boolean;
    toolName: string;
    result: any;
    args: any;
    messagesAfterCount: number;
  }) => {
    if (
      toolName === 'getActions' &&
      result.success === false &&
      ['needs_reconnect', 'not_connected'].includes(result.error?.type)
    ) {
      return (
        <ConnectButton
          disabled={messagesAfterCount > 2}
          integrationKey={result.error.app}
          append={append}
        />
      );
    }

    if (toolName === 'renderForm') {
      return (
        <div className="bg-muted p-4 rounded-lg text-black">
          <JsonSchemaForm
            isCollapsed={messagesAfterCount > 2}
            formTitle={result.formTitle}
            schema={result.toolInputSchema}
            defaultValues={result.inputsAlreadyProvided}
            onSubmit={(data) => {
              append({
                role: 'user',
                content: data,
              });
            }}
          />
        </div>
      );
    }

    const constructCleanMCPToolName = (toolName: string) => {
      const [firstPart = '', secondPart = ''] = toolName.split('_');
      const words = `${firstPart} ${secondPart.replace(/-/g, ' ')}`
        .trim()
        .split(' ');

      const titleCased = words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return titleCased;
    };

    const isStaticTool = Object.keys(StaticTools).includes(toolName);
    const toolNameToDisplay = isStaticTool
      ? (simplerName[toolName] ?? toolName)
      : constructCleanMCPToolName(toolName);

    return (
      <>
        <ToolResultDisplay
          toolName={toolNameToDisplay}
          result={result}
          input={args}
          isStaticTool={isStaticTool}
        />
        {['suggestApps', 'suggestMoreApps'].includes(toolName) &&
          result.apps?.length > 1 && (
            <div className="flex flex-row gap-2 mt-2">
              {result.apps?.map((app: any) => (
                <AppSelectionButton
                  disabled={messagesAfterCount > 2}
                  key={app}
                  integrationKey={app}
                  onClick={() => append({ role: 'user', content: app })}
                />
              ))}
            </div>
          )}
      </>
    );
  };

  const lastPartIsToolInvocation =
    message.parts[message.parts.length - 1].type === 'tool-invocation';

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl w-full group-data-[role=user]/message:w-fit',
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        <Markdown>{sanitizeText(part.text)}</Markdown>
                      </div>
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  return (
                    <div key={toolCallId} className="flex flex-row gap-2">
                      <Loader size={20} className="animate-spin" />
                      Thinking...
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result, args } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {renderToolResult({
                        toolName,
                        result,
                        args,
                        isLastMessage,
                        messagesAfterCount,
                      })}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && !lastPartIsToolInvocation && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}

            {isLoading && message.role === 'assistant' && (
              <div className="flex flex-col gap-2 mt-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (prevProps.messagesAfterCount !== nextProps.messagesAfterCount)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
