'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Hammer, X } from 'lucide-react';
import Image from 'next/image';
import type { Integration } from '@integration-app/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tool } from './get-tools';

export function ToolsOverlay({
  integration,
  isOpen,
  onClose,
  triggerRef,
  tools,
}: {
  integration: Integration;
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  tools: Record<string, Tool> | null;
}) {
  // Filter tools for this specific integration
  const integrationTools = tools
    ? Object.entries(tools)
        .filter(([toolName]) => toolName.startsWith(`${integration.key}_`))
        .reduce(
          (acc, [toolName, tool]) => {
            acc[toolName] = tool;
            return acc;
          },
          {} as Record<string, Tool>,
        )
    : {};

  const toolsList = Object.entries(integrationTools).map(
    ([toolName, tool]) => ({
      id: toolName,
      name: toolName
        .replace(`${integration.key}_`, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      description: tool.description || 'No description available',
    }),
  );

  // Handle escape key to close overlay
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when overlay is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm rounded-lg flex flex-col max-h-screen"
          initial={{
            opacity: 0,
            scale: 0.1,
            borderRadius: '50%',
            x: triggerRef.current
              ? triggerRef.current.getBoundingClientRect().left +
                triggerRef.current.offsetWidth / 2 -
                window.innerWidth / 2
              : 0,
            y: triggerRef.current
              ? triggerRef.current.getBoundingClientRect().top +
                triggerRef.current.offsetHeight / 2 -
                window.innerHeight / 2
              : 0,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            borderRadius: '0.5rem',
            x: 0,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.1,
            borderRadius: '50%',
            x: triggerRef.current
              ? triggerRef.current.getBoundingClientRect().left +
                triggerRef.current.offsetWidth / 2 -
                window.innerWidth / 2
              : 0,
            y: triggerRef.current
              ? triggerRef.current.getBoundingClientRect().top +
                triggerRef.current.offsetHeight / 2 -
                window.innerHeight / 2
              : 0,
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tools-title"
          aria-describedby="tools-description"
          onClick={(e) => {
            // Close when clicking on the backdrop
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          {/* Header */}
          <motion.div
            className="flex items-center justify-between p-6 border-b shrink-0"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              {integration.logoUri ? (
                <Image
                  width={32}
                  height={32}
                  src={integration.logoUri}
                  alt={`${integration.name} logo`}
                  className="size-8 rounded-lg shrink-0"
                />
              ) : (
                <div className="size-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-medium shrink-0">
                  {integration.name[0]}
                </div>
              )}
              <div>
                <h2 id="tools-title" className="text-xl font-semibold">
                  {integration.name}
                </h2>
                <p
                  id="tools-description"
                  className="text-sm text-muted-foreground"
                >
                  {toolsList.length} {toolsList.length === 1 ? 'tool' : 'tools'}{' '}
                  available
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="size-10 p-0 hover:bg-muted"
              aria-label="Close tools overlay"
            >
              <X className="size-5" />
            </Button>
          </motion.div>

          {/* Tools List */}
          <motion.div
            className="flex-1 overflow-y-auto p-6 min-h-0"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.2 }}
          >
            {toolsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Hammer className="size-8 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  No tools available for this integration
                </p>
                <p className="text-xs text-muted-foreground/70 text-center mt-1">
                  Tools will appear here once they&apos;re available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {toolsList.map((tool, index) => (
                  <motion.div
                    key={tool.id}
                    className="p-4 border rounded-lg transition-colors text-left w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.2 + index * 0.05,
                      duration: 0.2,
                      ease: 'easeOut',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Hammer className="size-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
