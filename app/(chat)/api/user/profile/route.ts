import { auth } from '@/app/(auth)/auth';
import { getUserById, updateUserProfile } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const updatedUser = await updateUserProfile({
      userId: session.user.id,
      email,
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 },
    );
  }
}
