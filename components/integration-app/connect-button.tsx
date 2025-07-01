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
    setState('connecting');
    try {
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
      variant="outline"
      className="border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
      onClick={handleConnect}
      disabled={state === 'connecting' || state === 'connected'}
    >
      {state === 'connecting' ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
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
          className="ml-2 size-5 object-contain"
        />
      )}
    </Button>
  );
};
