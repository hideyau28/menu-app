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
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e] border-t border-zinc-800">
      <div className="flex justify-around max-w-4xl mx-auto px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 text-center text-sm py-2 ${
                isActive ? "text-white font-semibold" : "text-zinc-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
