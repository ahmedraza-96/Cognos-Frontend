"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function onLogout() {
    logout();
    router.replace("/login");
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "text-sm transition-colors",
        pathname === href
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">🤖 Agent Platform</span>
          {navLink("/chat", "Chat")}
          {navLink("/documents", "Documents")}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
