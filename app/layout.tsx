import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs"; // 1. Added Clerk import
import "./globals.css";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Updated the title for your hackathon!
export const metadata: Metadata = {
  title: "HackathonAI | Smart Builder", 
  description: "AI-powered building tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        {/* Combine all fonts into one body tag and remove the duplicate body */}
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}