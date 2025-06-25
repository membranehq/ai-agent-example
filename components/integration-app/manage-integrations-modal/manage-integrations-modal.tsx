'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConnections } from '@integration-app/react';
import { Plug2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UnconnectedIntegrations } from './unconnected-integrations';
import { ConnectedIntegrations } from './connected-integrations';

export function ManageIntegrationsModal() {
  const [open, setOpen] = useState(false);
  const { connections, loading: connectionsIsLoading } = useConnections();

  const hasConnectedIntegration = connections.some(
    (connection) => !connection.disconnected,
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
            {!connectionsIsLoading && (
              <div
                className={cn(
                  'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                  hasConnectedIntegration ? 'bg-green-500' : 'bg-red-500',
                )}
              />
            )}
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
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-2 space-y-6">
              <ConnectedIntegrations />
              <UnconnectedIntegrations />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
