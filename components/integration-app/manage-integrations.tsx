'use client';

import { Button } from '@/components/ui/button';
import { useIntegrations } from '@integration-app/react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Plug2,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { useIntegrationApp, type Integration } from '@integration-app/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export function IntegrationListItem({
  integration,
  onRefresh,
}: IntegrationListItemProps) {
  const integrationApp = useIntegrationApp();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
      <div className={cn('flex items-center justify-between p-4 pl-0 ')}>
        <div className="flex items-center gap-4">
          {integration.logoUri ? (
            <Image
              width={40}
              height={40}
              src={integration.logoUri}
              alt={`${integration.name} logo`}
              className="size-10 rounded-lg"
            />
          ) : (
            <div className="size-10 rounded-lg bg-gray-100 flex items-center justify-center">
              {integration.name[0]}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <h3 className="font-medium">{integration.name}</h3>
            {isDisconnected && (
              <p className="text-sm font-bold text-red-500 ">Disconnected</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {integration.connection ? (
            <>
              {isDisconnected ? (
                <Button
                  variant="ghost"
                  onClick={() => handleConnect()}
                  size="sm"
                  disabled={isConnecting}
                >
                  <span className="font-bold">Reconnect</span>
                  {isConnecting && <Loader2 />}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  size="sm"
                  disabled={isDisconnecting}
                >
                  <span className="text-red-500">Disconnect</span>
                  {isDisconnecting && <Loader2 />}
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={() => handleConnect()}
              variant="default"
              size="sm"
              disabled={isConnecting}
            >
              Connect {isConnecting && <Loader2 />}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function IntegrationList() {
  const {
    integrations,
    refresh,
    loading: integrationsIsLoading,
    error,
  } = useIntegrations();

  return (
    <div>
      {integrationsIsLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Loading integrations...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle />
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || 'Failed to load integrations'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="gap-2"
          >
            <RefreshCw />
            Try again
          </Button>
        </div>
      ) : (
        integrations.map((integration) => (
          <IntegrationListItem
            key={integration.key}
            integration={integration}
            onRefresh={refresh}
          />
        ))
      )}
    </div>
  );
}

export function ConnectionModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plug2 />
          Connect apps
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to apps</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto min-h-[200px] max-h-[70vh]">
          <IntegrationList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
