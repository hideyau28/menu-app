"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const navItems = [{ href: "/expenses", label: "記帳", icon: "💰" }];

function BottomNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tripCode, setTripCode] = useState<string | null>(null);

  // Load trip code from cookie on initial mount
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const tripCookie = cookies.find((c) => c.startsWith("last_trip_code="));
    if (tripCookie) {
      const savedCode = tripCookie.split("=")[1];
      setTripCode(savedCode);
    }
  }, []); // Run once on mount

  // Monitor URL and save trip code to cookie when on expenses page
  useEffect(() => {
    const code = searchParams.get("code");

    if (pathname === "/expenses" && code) {
      // Save trip code to cookie
      document.cookie = `last_trip_code=${code}; path=/; max-age=2592000`; // 30 days
      setTripCode(code);
    }
  }, [pathname, searchParams]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e]/95 backdrop-blur-md border-t border-zinc-800 z-50">
      <div className="flex justify-around max-w-4xl mx-auto px-4 py-1 pb-safe">
        {navItems.map((item) => {
          // Smart href: if it's expenses and we have a saved code, append it
          const href =
            item.href === "/expenses" && tripCode
              ? `/expenses?code=${tripCode}`
              : item.href;

          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all"
            >
              <div
                className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                  isActive ? "bg-white/15" : ""
                }`}
              >
                <span
                  className={`text-xl transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
                >
                  {item.icon}
                </span>
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-white" : "text-zinc-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BottomNavFallback() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e] border-t border-zinc-800 z-50">
      <div className="flex justify-around max-w-4xl mx-auto px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-zinc-400"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function BottomNav() {
  return (
    <Suspense fallback={<BottomNavFallback />}>
      <BottomNavContent />
    </Suspense>
  );
}
