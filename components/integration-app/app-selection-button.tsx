import { useIntegrationApp } from '@integration-app/react';
import { Button } from '../ui/button';
import { useEffect, useState } from 'react';

interface AppSelectionButtonProps {
  integrationKey: string;
  onClick: () => void;
  disabled?: boolean;
}

export const AppSelectionButton = ({
  integrationKey,
  onClick,
  disabled,
}: AppSelectionButtonProps) => {
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  const integrationApp = useIntegrationApp();

  useEffect(() => {
    const fetchAppLogo = async () => {
      try {
        const integration = await integrationApp
          .integration(integrationKey)
          .get();

        setLogoUri(integration.logoUri);
        setName(integration.name);
      } catch (error) {
        console.error('Error fetching app logo:', error);
      }
    };

    fetchAppLogo();
  }, [integrationKey]);

  return (
    <Button
      disabled={disabled}
      size="sm"
      variant="outline"
      className="text-sm flex items-center gap-2"
      onClick={onClick}
    >
      {logoUri && (
        <img
          src={logoUri}
          alt={`${integrationKey} logo`}
          className="w-4 h-4 object-contain"
        />
      )}
      {name || integrationKey}
    </Button>
  );
};
