"use client";

import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Coins, Trophy, History, TrendingUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import {getBadges } from "~/lib/badges";
import { useState, useMemo } from "react";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMiniApp } from "@neynar/react";

export function ProfileTab() {
  const { balance, bets, stats, addCoins, updateBetStatus } = useWallet();

  // wagmi wallet state
  const { address, isConnected } = useAccount();
  const { connectors, connect, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  // Farcaster mini app context (already wrapped by MiniAppProvider)
  const { isSDKLoaded, context } = useMiniApp() as any;

  // Derived auth flags
  const farcasterUser = context?.user; // shape depends on Neynar; usually has username, display_name, fid, etc.
  const hasFarcaster = !!farcasterUser;
  const hasWallet = isConnected;
  const isLoggedIn = hasWallet || hasFarcaster;

  const [showWalletOptions, setShowWalletOptions] = useState(false);

  const handleLoginBrowserWallet = () => {
    setShowWalletOptions(true);
  };

  const handleLoginWithFarcaster = () => {
    if (!isSDKLoaded) {
      toast("Farcaster not ready yet", {
        description: "The mini app SDK is still loading, try again in a moment.",
      });
      return;
    }
    if (!farcasterUser) {
      toast("Not running inside Farcaster", {
        description:
          "Open this mini app from a Farcaster client to log in with Farcaster.",
      });
      return;
    }
    toast("Logged in with Farcaster", {
      description: `Welcome, ${farcasterUser?.username ?? "Farcaster user"}!`,
    });
  };

  const handleAddCoins = () => {
    addCoins(500);
    toast("Coins Added!", {
      description: "500 test coins have been added to your wallet.",
    });
  };

  const handleSimulateWin = (betId: string) => {
    updateBetStatus(betId, "won");
    toast("Congratulations!", {
      description: "Your bet won!",
    });
  };

  const handleSimulateLoss = (betId: string) => {
    updateBetStatus(betId, "lost");
    toast("Better luck next time", {
      description: "Your bet lost.",
    });
  };

    //Achievement badges helper function
      const [selectedBadge, setSelectedBadge] = useState(null);
    const badges = useMemo(() => getBadges(bets), [bets]);

  // --- DISPLAY HELPERS ---

  const shortAddress =
    address && `${address.slice(0, 6)}…${address.slice(-4)}`;

  const displayName =
    farcasterUser?.display_name ||
    farcasterUser?.username ||
    shortAddress ||
    "User";

  const handleLabel =
    farcasterUser?.username
      ? `@${farcasterUser.username}`
      : shortAddress
      ? `@${shortAddress.toLowerCase()}`
      : "@user";

  const initials =
    farcasterUser?.display_name?.[0]?.toUpperCase() ||
    (address && address.slice(2, 4).toUpperCase()) ||
    "U";

  // 1) NOT LOGGED IN → show login options
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Log in to view your profile, wallet balance, and betting history.
          </p>

          <div className="mt-6 space-y-2">
            <h2 className="text-lg font-bold mb-2">Choose Wallet</h2>
            {connectors.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No wallet connectors found. Please install a browser wallet like MetaMask.
              </div>
            )}
            {connectors.map((connector) => (
              <Button
                key={connector.uid}
                className="w-full"
                variant="secondary"
                disabled={connectStatus === "pending"}
                onClick={async () => {
                  try {
                    await connect({ connector });
                    toast("Wallet connected!", {
                      description: `Connected to ${connector.name}`,
                    });
                  } catch (err) {
                    toast("Wallet connection failed", {
                      description: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
              >
                {connector.name}
                {connector.ready === false ? " (not installed)" : ""}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            You can connect with a browser wallet (MetaMask, Rabby, etc).
          </p>
        </div>
      </div>
    );
  }

  // 2) LOGGED IN → full profile UI
  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-card rounded-lg">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={farcasterUser?.pfp_url ?? "/placeholder.svg?height=80&width=80"} />
              <AvatarFallback className="text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <p className="text-sm text-muted-foreground">
                    {handleLabel}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Level 1
                    </Badge>
                  </div>
                </div>

                {/* Disconnect wallet if one is connected */}
                {hasWallet && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect()}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto py-6 space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-4">Wallet</h2>
          <Card className="p-6 bg-gradient-to-br from-primary/20 to-secondary">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Test Coins
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCoins}>
                Add Coins
              </Button>
            </div>
            <div className="text-4xl font-bold">
              {balance.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Available balance
            </p>
          </Card>
        </section>

   {/*Achievement sections*/}
   <section>
        <h2 className="text-xl font-bold mb-4">Achievements</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
            {badges.map((badge) => (
                <div key={badge.id}>
                    <button
                        onClick={() => badge.unlocked && setSelectedBadge(badge)}
                        disabled={!badge.unlocked}
                        className="flex flex-col items-center hover:scale-105 transition-transform disabled:cursor-not-allowed"
                    >
                        <img
                            src={badge.img}
                            alt={badge.name}
                            className={`w-20 h-20 rounded-full object-cover transition-all
                            ${badge.unlocked ? "" : "opacity-30 grayscale"}`}
                        />
                        <span className={`mt-2 text-sm font-medium ${badge.unlocked ? "" : "text-muted-foreground"}`} >{badge.name}</span>
                    </button>
                </div>
            ))}
        </div>

    {/* Simple Popup Modal */}
        {selectedBadge && (
            <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setSelectedBadge(null)}
            >
                <div
                    className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-sm text-center border border-border"
                    style={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <img
                        src={selectedBadge.img}
                        alt={selectedBadge.name}
                        className="w-24 h-24 mx-auto rounded-full"
                    />
                    <h3 className="text-lg font-bold mt-4">{selectedBadge.name}</h3>

                    <p className="text-sm text-muted-foreground mt-2">
                        {selectedBadge.description}
                    </p>
                    <Button className="mt-4" onClick={() => setSelectedBadge(null)}>
                        Close
                    </Button>
                </div>
            </div>
        )}
    </section>

    {/*Recent Activity Sections*/}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Activity</h2>
            {bets.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No bets yet
              </span>
            )}
          </div>
          <div className="space-y-3">
            {bets.slice(0, 10).map((bet) => (
              <Card key={bet.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{bet.raceName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bet.horseName} • {bet.odds}x odds
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(bet.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{bet.amount} coins</div>
                      <div className="text-sm text-muted-foreground">
                        Bet amount
                      </div>
                      {bet.status === "pending" && (
                        <Badge className="mt-2 bg-secondary text-secondary-foreground">
                          Pending
                        </Badge>
                      )}
                      {bet.status === "won" && (
                        <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">
                          Won
                        </Badge>
                      )}
                      {bet.status === "lost" && (
                        <Badge className="mt-2 bg-destructive/20 text-destructive border-destructive/30">
                          Lost
                        </Badge>
                      )}
                    </div>
                  </div>
                  {bet.status === "pending" && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => handleSimulateWin(bet.id)}
                      >
                        Simulate Win
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => handleSimulateLoss(bet.id)}
                      >
                        Simulate Loss
                      </Button>
                    </div>
                  )}
                  {bet.status === "won" && (
                    <div className="text-sm text-primary font-semibold">
                      Won: +{bet.potentialWin} coins
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}