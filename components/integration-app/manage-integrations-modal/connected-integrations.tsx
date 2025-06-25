'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConnections } from '@integration-app/react';
import { AlertCircle, Loader2, RefreshCw, Plug2, Hammer } from 'lucide-react';
import Image from 'next/image';
import { useIntegrationApp, type Integration } from '@integration-app/react';
import { toast } from 'sonner';
import { getAllTools, type Tool } from './get-tools';
import { ToolsOverlay } from './tools-overlay';

interface IntegrationListItemProps {
  integration: Integration;
  onRefresh: () => Promise<void>;
  tools: Record<string, Tool>;
  isToolsLoading: boolean;
}

function ConnectedIntegrationItem({
  integration,
  onRefresh,
  tools,
  isToolsLoading,
}: IntegrationListItemProps) {
  const integrationApp = useIntegrationApp();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const hammerButtonRef = useRef<HTMLButtonElement>(null);

  // Calculate tools count for this integration
  const toolsCount = Object.keys(tools).length;

  const handleDisconnect = async () => {
    if (!integration.connection?.id) {
      return;
    }

    try {
      setIsDisconnecting(true);

      await integrationApp.connection(integration.connection.id).archive();

      await onRefresh();
    } catch (error) {
      toast.error('Failed to disconnect', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isDisconnected = integration.connection?.disconnected;

  return (
    <>
      <div className="flex flex-col p-3 border rounded-lg hover:bg-muted/50 transition-colors relative">
        <div className="flex items-center gap-3 pb-3">
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

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{integration.name}</h3>
            {isDisconnected && (
              <p className="text-xs font-bold text-red-500">Disconnected</p>
            )}
            {integration.connection && !isDisconnected && (
              <div className="flex items-center gap-1 mt-1">
                <Hammer className="size-3 text-muted-foreground" />
                {isToolsLoading ? (
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-3 bg-muted-foreground/20 rounded animate-pulse" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {toolsCount} {toolsCount === 1 ? 'tool' : 'tools'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex justify-between items-end">
          <Button
            ref={hammerButtonRef}
            variant="ghost"
            size="sm"
            className="text-xs h-7 py-1 px-2 hover:bg-muted"
            onClick={() => setIsToolsOpen(true)}
          >
            <Hammer className="size-3" />
          </Button>

          <Button
            variant="outline"
            onClick={handleDisconnect}
            size="sm"
            disabled={isDisconnecting}
            className="text-xs h-7 py-1 text-red-500 hover:text-red-600"
          >
            {isDisconnecting ? <Loader2 className="size-3" /> : 'Disconnect'}
          </Button>
        </div>
      </div>

      <ToolsOverlay
        integration={integration}
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        triggerRef={hammerButtonRef}
        tools={tools}
      />
    </>
  );
}

export function ConnectedIntegrations() {
  const [toolsData, setToolsData] = useState<Record<string, Tool> | null>(null);
  const [isToolsLoading, setIsToolsLoading] = useState(false);

  const {
    connections,
    refresh: refreshConnections,
    loading: connectionsIsLoading,
    error: connectionsError,
  } = useConnections();

  // Get connected integrations from connections
  const connectedIntegrations = connections
    .map((connection) => {
      const integration = connection.integration;
      if (integration) {
        return {
          ...integration,
          connection: connection,
        } as Integration;
      }
      return undefined;
    })
    .filter(
      (integration): integration is Integration => integration !== undefined,
    );

  const getToolsForIntegration = (
    integrationKey: string,
  ): Record<string, Tool> => {
    if (!toolsData) return {};

    const filteredTools: Record<string, Tool> = {};
    Object.entries(toolsData).forEach(([toolName, tool]) => {
      if (toolName.startsWith(`${integrationKey}_`)) {
        filteredTools[toolName] = tool;
      }
    });
    return filteredTools;
  };

  // Fetch tools when there are connected integrations
  useEffect(() => {
    if (connectedIntegrations.length > 0) {
      setIsToolsLoading(true);
      getAllTools()
        .then((tools) => {
          setToolsData(tools);
        })
        .catch((error) => {
          console.error('Error fetching tools:', error);
          toast.error('Failed to load tools', {
            description: error.message || 'Unknown error',
          });
        })
        .finally(() => {
          setIsToolsLoading(false);
        });
    }
  }, [connectedIntegrations.length]);

  const refresh = async () => {
    await refreshConnections();
  };

  if (connectionsIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading connections...</p>
      </div>
    );
  }

  if (connectionsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle />
        <p className="text-sm text-muted-foreground mb-4">
          {connectionsError.message || 'Failed to load connections'}
        </p>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw /> Try again
        </Button>
      </div>
    );
  }

  if (connectedIntegrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
        <Plug2 className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          No connected apps yet
        </p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          Connect apps below to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Connected Apps ({connectedIntegrations.length})
        </h3>
        {isToolsLoading && <LoadingToolsIndicator />}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
        {connectedIntegrations.map((integration) => (
          <ConnectedIntegrationItem
            key={integration.key}
            integration={integration}
            onRefresh={refresh}
            tools={getToolsForIntegration(integration.key)}
            isToolsLoading={isToolsLoading}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingToolsIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="relative size-4">
        {/* Spinner ring */}
        <div className="absolute inset-0 border-2 border-muted-foreground/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-muted-foreground rounded-full animate-spin" />
        {/* Stationary hammer in the center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Hammer className="size-2" />
        </div>
      </div>
      <span>Loading MCP tools...</span>
    </div>
  );
}
