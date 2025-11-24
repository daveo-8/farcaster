"use client";

import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Coins, Trophy, History, TrendingUp } from "lucide-react";
import { Button } from "~/components/ui/button";

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

  // Get specific connectors
  const metaMaskConnector = connectors.find((c) =>
    c.name.toLowerCase().includes("meta")
  );
  const rabbyConnector = connectors.find(
    (c) => c.name === "Rabby" || c.id === "rabby"
  );

  const handleLoginWithMetaMask = async () => {
    if (!metaMaskConnector) {
      toast("MetaMask not detected", {
        description: "Install MetaMask or enable it in this browser.",
      });
      return;
    }

    try {
      await connect({ connector: metaMaskConnector });
      toast("Connected with MetaMask");
    } catch (err: any) {
      console.error(err);
      toast("MetaMask connection failed", {
        description: err?.message ?? "Something went wrong.",
      });
    }
  };

  const handleLoginWithRabby = async () => {
    if (!rabbyConnector) {
      toast("Rabby not detected", {
        description: "Install the Rabby extension to use this option.",
      });
      return;
    }

    try {
      await connect({ connector: rabbyConnector });
      toast("Connected with Rabby");
    } catch (err: any) {
      console.error(err);
      toast("Rabby connection failed", {
        description: err?.message ?? "Something went wrong.",
      });
    }
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

    // No extra action needed here if you treat Farcaster context as "logged in"
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

          <div className="space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleLoginWithMetaMask}
              disabled={connectStatus === "pending"}
            >
              {connectStatus === "pending"
                ? "Connecting…"
                : "Log in with MetaMask"}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              onClick={handleLoginWithRabby}
              disabled={connectStatus === "pending"}
            >
              {connectStatus === "pending"
                ? "Connecting…"
                : "Log in with Rabby"}
            </Button>

            <Button
              className="w-full"
              onClick={handleLoginWithFarcaster}
            >
              Log in with Farcaster
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            You can connect with a browser wallet (MetaMask or Rabby) or use
            your Farcaster identity when opened as a mini app.
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

        <section>
          <h2 className="text-xl font-bold mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Total Wins
                </span>
              </div>
              <div className="text-3xl font-bold">{stats.totalWins}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Total Bets
                </span>
              </div>
              <div className="text-3xl font-bold">{stats.totalBets}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Win Rate
                </span>
              </div>
              <div className="text-3xl font-bold">
                {stats.winRate.toFixed(0)}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Total Won
                </span>
              </div>
              <div className="text-3xl font-bold">
                {stats.totalWon.toLocaleString()}
              </div>
            </Card>
          </div>
        </section>

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
