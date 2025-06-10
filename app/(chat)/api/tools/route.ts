import { NextResponse } from 'next/server';
import { getTools } from '@/lib/integration-app/getToolsFromMCP';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { auth } from '@/app/(auth)/auth';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const token = await generateIntegrationAppCustomerAccessToken({
      id: session.user.id,
      name: session.user.name ?? '',
    });

    const tools = await getTools({ token });

    return NextResponse.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
