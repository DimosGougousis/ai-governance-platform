import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/shared/Sidebar';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'AI Governance Platform',
  description: 'Enterprise AI Agent Governance Monitoring',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
