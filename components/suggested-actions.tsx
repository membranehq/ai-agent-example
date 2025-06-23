'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import Image from 'next/image';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'Send an',
      label: 'email',
      action: 'Send an email',
      icon: 'https://static.integration.app/connectors/gmail/logo.png',
    },
    {
      title: 'Check my',
      label: 'Gmail inbox',
      action: 'Show me my recent Gmail messages',
      icon: 'https://static.integration.app/connectors/gmail/logo.png',
    },
    {
      title: 'Show my',
      label: 'upcoming calendar events',
      action: 'What are my upcoming calendar events for this week?',
      icon: 'https://static.integration.app/connectors/google-calendar/logo.png',
    },
    {
      title: 'Find contacts',
      label: 'in HubSpot',
      action: 'Search for contacts in HubSpot',
      icon: 'https://static.integration.app/connectors/hubspot/logo.png',
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="flex gap-2 w-full overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className="shrink-0"
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-2xl px-4 py-2 text-sm whitespace-nowrap bg-muted/50 hover:bg-muted/70 transition-colors shadow-sm flex items-center gap-2"
          >
            {suggestedAction.icon && (
              <Image
                src={suggestedAction.icon}
                alt={`${suggestedAction.title} icon`}
                width={20}
                height={20}
                className="rounded-sm"
              />
            )}
            <div>
              <span className="font-medium">{suggestedAction.title} </span>
              <span className="text-muted-foreground">
                {suggestedAction.label}
              </span>
            </div>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
