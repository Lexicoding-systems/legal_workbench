import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Workbench",
  description: "Local MVP legal workbench — matter management, document parsing, AI-assisted drafting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <a href="/" className="text-lg font-semibold text-gray-800 hover:text-gray-600">
            Legal Workbench
          </a>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
