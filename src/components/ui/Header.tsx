"use client";

import { useState } from "react";
import { APP_NAME } from "~/lib/constants";
import sdk from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";
import {Trophy} from "lucide-react";
import {useWallet} from "~/lib/wallet-context";

type HeaderProps = {
  neynarUser?: {
    fid: number;
    score: number;
  } | null;
};

export function Header({ neynarUser }: HeaderProps) {
  const { context } = useMiniApp();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const { balance } = useWallet()

  return (
      <header className="border-b border-border bg-card">
          <div className="max-w-lg mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                  <div>
                      <h1 className="text-2xl font-bold text-balance">Farbets</h1>
                      <p className="text-sm text-muted-foreground">Place your bets, win big</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-bold">{balance.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">coins</span>
                  </div>
              </div>
          </div>
      </header>
  );
}
