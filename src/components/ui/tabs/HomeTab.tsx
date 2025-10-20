"use client";
import { useEffect } from "react";

import {Clock, TrendingUp} from "lucide-react";
import Link from "next/link";
import {Button} from "~/components/ui/button";
import {useWallet} from "~/lib/wallet-context";
import {Card} from "~/components/ui/card";
import { startWhiteBars } from "./whiteBars";

/**
 * HomeTab component displays the main landing content for the mini app.
 *
 * This is the default tab that users see when they first open the mini app.
 * It provides a simple welcome message and placeholder content that can be
 * customized for specific use cases.
 *
 * @example
 * ```tsx
 * <HomeTab />
 * ```
 */
export function HomeTab() {
    const { stats } = useWallet();
  useEffect(() => { let stop: (() => void) | undefined;
  (async () => { stop = await startWhiteBars(); })();
    return () => { if (stop) stop();};}, []);





  return (
      <div className="">
      
              <section>
  <h2 className="text-xl font-bold mt-4 mb-4">Upcoming Races</h2>
  <div id="white-bars-root" className="space-y-3" />
</section>
      
      
                <section>
              <h2 className="text-xl font-bold mt-4 mb-4">Your Stats</h2>
              <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{stats.totalBets}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Bets</div>
                  </Card>
                  <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{stats.totalWins}</div>
                      <div className="text-xs text-muted-foreground mt-1">Wins</div>
                  </Card>
                  <Card className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-2xl font-bold text-primary">{stats.winRate.toFixed(0)}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
                  </Card>
              </div>
          </section>
      
      
          <section>
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Leaderboard</h2>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Starting in 15m
                </span>
              </div>
              <Card className="overflow-hidden">
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary">
                      <img
                          src="/horse-racing-track.webp"
                          alt="Featured race track"
                          className="w-full h-full object-cover opacity-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-lg font-bold mb-1">Biggest winners last 24hr:</h3>
                          <h3 className="text-lg font-bold mb-1">That One Guy</h3>
                          <h3 className="text-lg font-bold mb-1">The guy on first</h3>
                          <h3 className="text-lg font-bold mb-1">Biggest Loser:</h3>
                           <h3 className="text-lg font-bold mb-1">Saul</h3>
                      </div>
                  </div>
                  <div className="p-4">
                      <Link href="/races/1">

                      </Link>
                  </div>
              </Card>
          </section>

      </div>
  );
}
