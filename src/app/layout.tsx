import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import AuthSessionProvider from "@/app/components/AuthSessionProvider";
import "./globals.css";
import "./lib/envSetup";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`antialiased`}>
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
