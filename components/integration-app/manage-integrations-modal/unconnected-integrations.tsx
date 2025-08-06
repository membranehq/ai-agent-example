'use client';

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useIntegrations, useConnections } from '@integration-app/react';
import { AlertCircle, Loader2, RefreshCw, Plug2, Search } from 'lucide-react';
import Image from 'next/image';
import { useIntegrationApp, type Integration } from '@integration-app/react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

function UnconnectedIntegrationItem({
  integration,
}: { integration: Integration }) {
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

export function UnconnectedIntegrations() {
  const [searchQuery, setSearchQuery] = useState('');
  const { connections, refresh: refreshConnections } = useConnections();

  const {
    integrations: searchResults,
    loading: searchIsLoading,
    error: searchError,
  } = useIntegrations({ search: searchQuery, limit: 200 });

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
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">
            Connect Apps
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {unconnectedIntegrations.length} apps supported
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
            <UnconnectedIntegrationItem
              key={integration.key}
              integration={integration}
            />
          ))}
        </div>
      )}
    </div>
  );
}
