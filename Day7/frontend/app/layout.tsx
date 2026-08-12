import { Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ThemeProvider } from '@/components/app/theme-provider';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        'dark scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="overflow-x-hidden bg-[#0a0e1a]">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Day 7: Navigation Bar */}
          <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0e1a]/80 px-6 py-3 backdrop-blur-md">
            <Link href="/" className="bg-gradient-to-r from-[#f5a623] to-[#ffd700] bg-clip-text text-sm font-semibold text-transparent">
              VoicePay
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xs text-white/50 transition hover:text-white/80">
                Voice Agent
              </Link>
              <Link href="/dashboard" className="text-xs text-white/50 transition hover:text-white/80">
                Dashboard
              </Link>
            </div>
          </nav>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
