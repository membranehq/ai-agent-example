'use client';

import { ChevronUp } from 'lucide-react';
import Image from 'next/image';
import type { User } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from './toast';
import { LoaderIcon } from './icons';
import { guestRegex } from '@/lib/constants';

export function HeaderUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, theme } = useTheme();

  const isGuest = guestRegex.test(data?.user?.email ?? '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {status === 'loading' ? (
          <Button
            variant="ghost"
            className="h-12 w-12 p-0"
          >
            <div className="size-8 bg-zinc-500/30 rounded-full animate-pulse" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            data-testid="user-nav-button"
            className="h-12 w-12 p-0"
          >
            <Image
              src={`https://avatar.vercel.sh/${user.email}`}
              alt={user.email ?? 'User Avatar'}
              width={32}
              height={32}
              className="rounded-full"
            />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-testid="user-nav-menu"
        side="bottom"
        align="end"
      >
        <DropdownMenuItem
          data-testid="user-nav-item-theme"
          className="cursor-pointer"
          onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="user-nav-item-auth">
          <button
            type="button"
            className="w-full cursor-pointer"
            onClick={() => {
              if (status === 'loading') {
                toast({
                  type: 'error',
                  description:
                    'Checking authentication status, please try again!',
                });

                return;
              }

              if (isGuest) {
                router.push('/login');
              } else {
                signOut({
                  redirectTo: '/',
                });
              }
            }}
          >
            {isGuest ? 'Login to your account' : 'Sign out'}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 