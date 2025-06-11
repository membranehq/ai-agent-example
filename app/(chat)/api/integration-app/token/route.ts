import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:api').toResponse();
    }

    const token = await generateIntegrationAppCustomerAccessToken({
      id: session?.user.id,
      name: session?.user.name,
    });

    return NextResponse.json({
      token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate integration token' },
      { status: 500 },
    );
  }
}
