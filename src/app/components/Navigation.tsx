"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/weather", label: "天氣", icon: "🌤️" },
  { href: "/expenses", label: "記帳", icon: "💰" },
  { href: "/currency", label: "匯率", icon: "💱" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e] border-t border-zinc-800">
      <div className="flex justify-around max-w-4xl mx-auto px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
                isActive ? "text-white" : "text-zinc-400"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-xs ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
