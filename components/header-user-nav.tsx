'use client';
import Image from 'next/image';
import type { User } from 'next-auth';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Moon, Sun, User as UserIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function HeaderUserNav({ user }: { user: User }) {
  const { status } = useSession();
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {status === 'loading' ? (
          <Button variant="ghost" className="size-12 p-0">
            <div className="size-8 bg-zinc-500/30 rounded-full animate-pulse" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            data-testid="user-nav-button"
            className="size-12 p-0"
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
        className="w-64 pt-4"
      >
        <div className="flex flex-col items-center text-center mb-4">
          <div className="relative mb-3">
            <Image
              src={`https://avatar.vercel.sh/${user.email}`}
              alt={user.email ?? 'User Avatar'}
              width={64}
              height={64}
              className="rounded-full ring-2 ring-primary/10"
            />
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
              <UserIcon className="size-3" />
            </div>
          </div>
          <div className="space-y-0.5 px-4">
            <h4 className="font-semibold text-base">Guest</h4>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'light' ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
          </Button>
        </div>

        <div className="px-3 py-2 mt-2 border-t">
          <p className="text-xs text-muted-foreground leading-relaxed">
            We use your id, name to generate an access token that allows
            integrations to run on your behalf. For more details, see the{' '}
            <a
              href="https://console.integration.app/docs/getting-started/authentication#authentication"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Membrane Authentication documentation
            </a>
            .
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
