'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from './ErrorBoundary';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
}

const navItems = [
  { href: '/pr', label: 'Pull Request' },
  { href: '/directory', label: 'Directory' },
];

export default function DashboardLayout({ children }: Props) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-5 min-w-0">
            <Link
              href="/pr"
              className="flex items-center gap-2 shrink-0 font-semibold tracking-tight"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                <GitPullRequest className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline text-[15px]">Review Agent</span>
            </Link>

            <nav className="flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-1 rounded-[5px] text-xs font-medium transition-colors',
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
