"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/weather", label: "天氣" },
  { href: "/currency", label: "匯率" },
  { href: "/expenses", label: "夾錢" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e] border-t border-gray-900 z-50 safe-area-inset-bottom backdrop-blur-xl bg-opacity-95">
      <div className="flex justify-around max-w-4xl mx-auto px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-2 text-center transition-colors relative`}
            >
              <div className={`text-xs font-medium ${
                isActive
                  ? "text-[#007AFF]"
                  : "text-gray-500"
              }`}>
                {item.label}
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#007AFF] rounded-full"></div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
