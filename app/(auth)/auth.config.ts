import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    newUser: '/',
  },
  providers: [
    // added later in auth.ts
  ],
  callbacks: {},
} satisfies NextAuthConfig;
