'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface UserProfile {
  email: string | null;
  isLoading: boolean;
  updateEmail: (email: string) => Promise<void>;
}

export function useUserProfile(): UserProfile {
  const { status } = useSession();
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') {
      setIsLoading(status === 'loading');
      return;
    }

    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setEmail(data.email || null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [status]);

  const updateEmail = useCallback(async (newEmail: string) => {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update email');
    }

    setEmail(newEmail);
  }, []);

  return { email, isLoading, updateEmail };
}
