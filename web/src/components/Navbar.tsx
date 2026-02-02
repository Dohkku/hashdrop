"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function Navbar() {
  const { isConnected } = useAccount();

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
              HashDrop
            </span>
          </Link>

          {/* Navigation Links */}
          {isConnected && (
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/orders"
                className="text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors"
              >
                Mis Ordenes
              </Link>
              <Link
                href="/send"
                className="text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors"
              >
                Enviar
              </Link>
              <Link
                href="/deliver"
                className="text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors"
              >
                Entregar
              </Link>
            </div>
          )}

          {/* Connect Button */}
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus={{
              smallScreen: "avatar",
              largeScreen: "full",
            }}
          />
        </div>
      </div>
    </nav>
  );
}
