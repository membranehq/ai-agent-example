import { useIntegrationApp } from '@integration-app/react';
import { Button } from '../ui/button';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';

interface ConnectButtonProps {
  integrationKey: string;
  logoUri?: string;
  append?: UseChatHelpers['append'];
}

export const ConnectButton = ({
  integrationKey,
  logoUri,
  append,
}: ConnectButtonProps) => {
  const integrationApp = useIntegrationApp();
  const [state, setState] = useState<'idle' | 'connecting' | 'connected'>(
    'idle',
  );

  const handleConnect = async () => {
    try {
      setState('connecting');

      const connection = await integrationApp
        .integration(integrationKey)
        .openNewConnection();

      if (connection?.id) {
        setState('connected');
        // Send "done" message to chat after successful connection
        if (append) {
          append({
            role: 'user',
            content: 'done',
          });
        }
      } else {
        setState('idle');
      }
    } catch (error) {
      console.error('Failed to open connection:', error);
      setState('idle');
    }
  };

  return (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={handleConnect}
      disabled={state === 'connecting' || state === 'connected'}
    >
      {state === 'connecting' ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : state === 'connected' ? (
        'Connected'
      ) : (
        'Connect App'
      )}
      {logoUri && (
        <img
          src={logoUri}
          alt="App logo"
          className="ml-2 h-5 w-5 object-contain"
        />
      )}
    </Button>
  );
};
