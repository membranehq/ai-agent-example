'use client';

import { PostHogProvider, usePostHog } from 'posthog-js/react';
import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useUserProfile } from '@/hooks/use-user-profile';

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // We'll handle this manually
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: false,
    enable_recording_console_log: false,
  });
}

export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogUserIdentifier() {
  const posthog = usePostHog();
  const { data: session } = useSession();
  const { email: userEmail } = useUserProfile();
  const email = userEmail || session?.user?.email || null;

  useEffect(() => {
    if (posthog && session?.user?.id && email) {
      posthog.identify(session.user.id, {
        email: email,
        $email: email, // PostHog specific email property
      });
    }
  }, [posthog, session?.user?.id, email]);

  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <Suspense>
        <PostHogPageview />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}








