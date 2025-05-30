import { auth } from '@/app/(auth)/auth';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { IntegrationAppProvider } from '@integration-app/react';

export async function IntegrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const token = await generateIntegrationAppCustomerAccessToken({
    id: session?.user.id,
    name: session?.user.name ?? '',
  });

  return (
    <IntegrationAppProvider token={token}>{children}</IntegrationAppProvider>
  );
}
