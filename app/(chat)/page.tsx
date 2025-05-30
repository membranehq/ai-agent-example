import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getTools } from '@/lib/integration-app/getTools';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  const token = await generateIntegrationAppCustomerAccessToken({
    id: session.user.id,
    name: session.user.name ?? '',
  });

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={
          !modelIdFromCookie ? DEFAULT_CHAT_MODEL : modelIdFromCookie.value
        }
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
