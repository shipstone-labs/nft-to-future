"use client";

import {
  ConnectButton,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import type { PropsWithChildren } from "react";

const config = getDefaultConfig({
  appName: "LIT example",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT ?? "",
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: true, // If your dApp uses server side rendering (SSR)
});
const queryClient = new QueryClient();

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export default function Wallet({ children }: PropsWithChildren<{}>) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={base} modalSize="compact">
          <header className="fixed top-0 left-0 w-full bg-gray-900 shadow-md z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                {/* Brand Logo */}
                <div className="flex-shrink-0">
                  <img
                    src="/rendered.svg"
                    alt="Shipstone Labs"
                    className="h-8 md:h-10 w-auto"
                  />
                </div>
                {/* Wallet Connect Button */}
                <div>
                  <ConnectButton />
                </div>
              </div>
            </div>
          </header>
          <div className="h-16" />
          <div className="flex-grow flex flex-row w-100 min-h-screen">
            <div className="flex-grow flex flex-col w-full">{children}</div>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
