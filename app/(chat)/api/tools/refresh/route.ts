import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { indexMcpTools } from '@/lib/pinecone/index-user-mcp-tools';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = {
      id: session.user.id,
      name: session.user.name ?? '',
    };

    await indexMcpTools({
      user,
    });

    return NextResponse.json({
      status: 'success',
    });
  } catch (error) {
    console.error('Error refreshing MCP tools:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
