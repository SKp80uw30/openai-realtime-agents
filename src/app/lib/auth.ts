import { PrismaAdapter } from '@auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/app/lib/prisma';

// Debug: Log environment variables (remove after debugging)
console.log('[AUTH] GOOGLE_CLIENT_ID_LOGIN:', process.env.GOOGLE_CLIENT_ID_LOGIN?.substring(0, 20) + '...');
console.log('[AUTH] GOOGLE_CLIENT_SECRET_LOGIN:', process.env.GOOGLE_CLIENT_SECRET_LOGIN ? 'Set' : 'MISSING');
console.log('[AUTH] NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('[AUTH] NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'Set' : 'MISSING');

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID_LOGIN ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET_LOGIN ?? '',
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and user id to the token right after signin
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a provider.
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Enable debug mode to see more logs
};
