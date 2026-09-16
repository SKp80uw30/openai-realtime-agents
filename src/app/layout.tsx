import type { Metadata } from "next";
import { Michroma } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import AuthSessionProvider from "@/app/components/AuthSessionProvider";
import "./globals.css";
import "./lib/envSetup";

// Wordmark face only — squarish, monoline geometric caps, matching the ORBY
// mark in the design brief. Scoped to a CSS variable so it never becomes the
// app's body font.
const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-orby",
});

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
    <html lang="en" className={michroma.variable}>
      <body className={`antialiased`}>
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
