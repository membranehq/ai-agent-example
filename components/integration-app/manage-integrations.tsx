'use client';

import { Button } from '@/components/ui/button';
import { useIntegrations, useConnections } from '@integration-app/react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Plug2,
  Search,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { useIntegrationApp, type Integration } from '@integration-app/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface IntegrationListItemProps {
  integration: Integration;
  onRefresh: () => Promise<void>;
}

function ConnectedIntegrationItem({
  integration,
  onRefresh,
}: IntegrationListItemProps) {
  const integrationApp = useIntegrationApp();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  console.log(integration);

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
    <div className="flex flex-col p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 pb-3">
        {integration.logoUri ? (
          <Image
            width={32}
            height={32}
            src={integration.logoUri}
            alt={`${integration.name} logo`}
            className="size-8 rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="size-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-medium flex-shrink-0">
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
              <Wrench className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">5 tools</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex justify-end">
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
  );
}

function UnconnectedIntegrationItem({
  integration,
  onRefresh,
}: IntegrationListItemProps) {
  const integrationApp = useIntegrationApp();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const connection = await integrationApp
        .integration(integration.key)
        .openNewConnection();

      if (!connection?.id) {
        throw new Error('Connection was not successful');
      }

      setIsConnecting(false);
    } catch (error) {
      setIsConnecting(false);

      toast.error('Failed to connect', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div
      className="flex flex-col p-3 border rounded-lg transition-colors hover:bg-muted/50 cursor-pointer hover:border-primary/50"
      onClick={handleConnect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{integration.name}</h3>
          <div className="h-4 mt-1">
            {isHovered ? (
              <div className="flex items-center gap-1">
                <Plug2 className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Click to connect
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60 font-mono truncate block">
                {integration.key}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full flex justify-end">
        {isConnecting && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationListItem({
  integration,
  onRefresh,
}: IntegrationListItemProps) {
  const isConnected =
    integration.connection && !integration.connection.disconnected;

  if (isConnected) {
    return (
      <ConnectedIntegrationItem
        integration={integration}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <UnconnectedIntegrationItem
      integration={integration}
      onRefresh={onRefresh}
    />
  );
}

function IntegrationList() {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    connections,
    refresh: refreshConnections,
    loading: connectionsIsLoading,
    error: connectionsError,
  } = useConnections();

  const {
    integrations: searchResults,
    loading: searchIsLoading,
    error: searchError,
  } = useIntegrations({ search: searchQuery });

  // Get connected integrations from connections
  const connectedIntegrations = connections
    .map((connection) => {
      const integration = connection.integration;
      if (integration) {
        // Ensure the integration has the connection property set
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

  // Filter out already connected integrations from search results
  const connectedKeys = new Set(
    connectedIntegrations.map((integration) => integration.key),
  );
  const unconnectedIntegrations = searchResults.filter(
    (integration) => !connectedKeys.has(integration.key),
  );

  const refresh = async () => {
    await refreshConnections();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-2 space-y-6">
        {connectionsIsLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Loading connections...
            </p>
          </div>
        ) : connectionsError ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle />
            <p className="text-sm text-muted-foreground mb-4">
              {connectionsError.message || 'Failed to load connections'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="gap-2"
            >
              <RefreshCw /> Try again
            </Button>
          </div>
        ) : (
          <>
            {/* Connected Apps */}
            {connectedIntegrations.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                  Connected Apps ({connectedIntegrations.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
                  {connectedIntegrations.map((integration) => (
                    <IntegrationListItem
                      key={integration.key}
                      integration={integration}
                      onRefresh={refresh}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                <Plug2 className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  No connected apps yet
                </p>
                <p className="text-xs text-muted-foreground/70 text-center mt-1">
                  Connect apps below to get started
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Connect Apps
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search apps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              {searchIsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">
                    Searching integrations...
                  </p>
                </div>
              ) : searchError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle />
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchError.message || 'Failed to search integrations'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    className="gap-2"
                  >
                    <RefreshCw /> Try again
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
                  {unconnectedIntegrations.map((integration) => (
                    <IntegrationListItem
                      key={integration.key}
                      integration={integration}
                      onRefresh={refresh}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ConnectionModal() {
  const [open, setOpen] = useState(false);
  const { integrations } = useIntegrations();

  const hasConnectedIntegration = integrations?.some(
    (integration) =>
      integration.connection && !integration.connection.disconnected,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 hover:bg-black hover:text-white rounded-full cursor-pointer"
        >
          <div className="relative">
            <Plug2 />
            <div
              className={cn(
                'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                hasConnectedIntegration ? 'bg-green-500' : 'bg-red-500',
              )}
            />
          </div>
          Manage apps
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="pl-2">
          <DialogTitle>Manage Apps</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Connect to third-party apps and access their tools
          </p>
        </DialogHeader>
        <div className="overflow-y-auto h-[70vh]">
          <IntegrationList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
