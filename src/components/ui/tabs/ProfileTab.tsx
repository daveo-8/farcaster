"use client";

import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Coins } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getBadges } from "~/lib/badges";
import { useState, useMemo, useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";

import type { Abi } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
// enviremoent can be changed using .env file, if nothing found it will default to local host
const ANVIL_RPC_URL =
  process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
  
const WALLET_STORAGE_KEY = "profileTab.connectedWalletAddress";

// bypass for broken claims, as of right now claims are store locally
const CLAIMED_STORAGE_KEY = "profileTab.claimedShareIdsByWallet";

const PONDER_API_URL =
  process.env.NEXT_PUBLIC_PONDER_API_URL ?? "http://127.0.0.1:42069";

const HORSEY_ADDRESS =
  "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" as const;

const HORSEY_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "_shareIds", type: "uint256[]" }],
    outputs: [],
  },
] as const satisfies Abi;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function getAnvilBalance(address: string): Promise<number> { //gets balance :D
  const response = await fetch(ANVIL_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message ?? "RPC returned an error");
  }

  const hex: string = json.result;
  if (!hex) return 0;

  const wei = BigInt(hex);
  const ether = Number(wei) / 1e18;
  return ether;
}

type PonderBetStatus = "pending" | "lost" | "won" | "claimed" | string;

type PonderShare = {
  id: string;
  bettor?: string;
  share_id?: number | string | bigint;
  shareId?: number | string | bigint;
  race_index?: number | string | bigint;
  raceIndex?: number | string | bigint;
  raceId?: number | string | bigint;
  horse?: number | string | bigint;
  amount: string | number | bigint;
  timestamp: string | number | bigint | null;
  block_number?: string | number | bigint;
  transaction_hash?: string;

  claimed?: boolean; // from Ponder, broken and not working
  winner?: number | string | bigint;
  resolved_timestamp?: string | number | bigint | null;

  status: PonderBetStatus;

  race_name?: string | null;
  horse_name?: string | null;
  odds?: number | null;
  potential_win?: string | number | bigint | null;
  payout?: string | number | bigint | null;
};

type PonderRace = {
  id?: string | number | bigint;
  race_index?: number | string | bigint;
  raceIndex?: number | string | bigint;
  name?: string | null;
  winner?: number | string | bigint | null;
};

function normalizeAmountFromWeiLike(x: PonderShare["amount"]): number {
  let n: number;

  if (typeof x === "number") {
    n = x;
  } else if (typeof x === "bigint") {
    n = Number(x);
  } else if (typeof x === "string") {
    const parsed = Number(x);
    n = Number.isFinite(parsed) ? parsed : 0;
  } else {
    return 0;
  }

  if (!Number.isFinite(n)) return 0;

  // number has 18 zeros........ yeah no, get rid of them
  if (Math.abs(n) > 1e9) {
    return n / 1e18;
  }

  return n;
}

function normalizeTimestampMs(x: PonderShare["timestamp"]): number {
  if (x == null) return Date.now();
  if (typeof x === "number") {
    return x < 10_000_000_000 ? x * 1000 : x;
  }
  if (typeof x === "bigint") {
    const n = Number(x);
    return n < 10_000_000_000 ? n * 1000 : n;
  }
  const n = Number(x);
  if (Number.isFinite(n)) {
    return n < 10_000_000_000 ? n * 1000 : n;
  }
  const d = Date.parse(x as string);
  return Number.isFinite(d) ? d : Date.now();
}

function getNumericRaceIndex(bet: PonderShare): number | null {
  const v = bet.race_index ?? bet.raceIndex ?? bet.raceId;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getNumericWinner(race: PonderRace): number | null {
  const raw =
    race.winner ??
    (race as any).winner_horse ??
    (race as any).winnerHorse;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getShareId(bet: PonderShare): bigint | null {
  const raw = bet.share_id ?? bet.shareId;
  if (raw == null) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export default function ProfilePicture() {
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const { context } = useMiniApp() as any;
  const farcasterUser = context?.user;
  const [walletAddress] = useState<string | null>(null);

  const initials =
    farcasterUser?.display_name?.[0]?.toUpperCase() ||
    (walletAddress && walletAddress.slice(2, 4).toUpperCase()) ||
    "U";

  useEffect(() => {
    async function loadContext() {
      const inMini = await sdk.isInMiniApp();
      if (!inMini) {
        return;
      }
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    }

    loadContext();
  }, []);

  if (!pfpUrl) {
    return <AvatarFallback className="test-2xl font-bold">{initials}</AvatarFallback>;
  }

  return <img src={pfpUrl} alt="User avatar" width={64} height={64} />;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ProfileTab() {
  const { balance, bets, addCoins } = useWallet();

  // simple wallet state aka no chain
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // on chain money
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // bets & races loaded from ponder
  const [ponderBets, setPonderBets] = useState<PonderShare[]>([]);
  const [isLoadingPonderBets, setIsLoadingPonderBets] = useState(false);
  const [ponderError, setPonderError] = useState<string | null>(null);

  const [ponderRaces, setPonderRaces] = useState<PonderRace[]>([]);
  const [isLoadingRaces, setIsLoadingRaces] = useState(false);

  // holder for local claims
  const [claimedLocalShareIds, setClaimedLocalShareIds] = useState<string[]>([]);

  // claim helpers
  const { address: wagmiAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Farcaster mini app context
  const { isSDKLoaded, context } = useMiniApp() as any;
  const farcasterUser = context?.user;

  const hasFarcaster = !!farcasterUser;
  const hasWallet = !!walletAddress;
  const isLoggedIn = hasWallet || hasFarcaster;

  // Achievement badges
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const badges = useMemo(() => getBadges(bets), [bets]);

  // restore wallet from localStorage, this works cuz when making a bet it will goes through the wallet and that will stop insufficent funds
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WALLET_STORAGE_KEY);
      if (stored) {
        setWalletAddress(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // restore claimed bets from localStorage, needed or the buttons reappear
  useEffect(() => {
    if (typeof window === "undefined") return;

    // when wallet changes, load its claimed shareIds
    if (!walletAddress) {
      setClaimedLocalShareIds([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(CLAIMED_STORAGE_KEY);
      if (!raw) {
        setClaimedLocalShareIds([]);
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, string[]>;
      if (!parsed || typeof parsed !== "object") {
        setClaimedLocalShareIds([]);
        return;
      }

      const walletLower = walletAddress.toLowerCase();
      const list = parsed[walletLower];
      if (!Array.isArray(list)) {
        setClaimedLocalShareIds([]);
        return;
      }

      setClaimedLocalShareIds(
        list.filter((x) => typeof x === "string" && x.length > 0),
      );
    } catch {
      setClaimedLocalShareIds([]);
    }
  }, [walletAddress]);

  const markLocalClaimed = (shareIdStr: string) => {
    if (!walletAddress) return;

    const walletLower = walletAddress.toLowerCase();

    setClaimedLocalShareIds((prev) => {
      if (prev.includes(shareIdStr)) return prev;
      const nextForWallet = [...prev, shareIdStr];

      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(CLAIMED_STORAGE_KEY);
          const parsed: Record<string, string[]> =
            raw && typeof raw === "string" ? JSON.parse(raw) : {};
          parsed[walletLower] = nextForWallet;
          window.localStorage.setItem(
            CLAIMED_STORAGE_KEY,
            JSON.stringify(parsed),
          );
        } catch {
          // ignore storage errors
        }
      }

      return nextForWallet;
    });
  };

  // ---- listen for MetaMask/Rabby account changes ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth || !eth.on) return;

    const handler = (accounts: string[]) => {
      try {
        if (!accounts || accounts.length === 0) {
          setWalletAddress(null);
          window.localStorage.removeItem(WALLET_STORAGE_KEY);
        } else {
          const addr = accounts[0];
          setWalletAddress(addr);
          window.localStorage.setItem(WALLET_STORAGE_KEY, addr);
        }
      } catch {
        // ignore storage errors
      }
    };

    eth.on("accountsChanged", handler);
    return () => {
      if (eth.removeListener) {
        eth.removeListener("accountsChanged", handler);
      }
    };
  }, []);

  // ---- connect with MetaMask / Rabby via window.ethereum ----
  const connectInjectedWallet = async () => {
    const eth = typeof window !== "undefined" ? (window as any).ethereum : null;

    if (!eth) {
      toast("No injected wallet found", {
        description: "Install MetaMask or Rabby in this browser.",
      });
      return;
    }

    try {
      setIsConnecting(true);
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        toast("No accounts returned by wallet", {
          description: "Unlock your wallet and try again.",
        });
        return;
      }

      const addr = accounts[0];
      setWalletAddress(addr);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(WALLET_STORAGE_KEY, addr);
        } catch {
          // ignore
        }
      }

      toast("Connected with wallet");
    } catch (err: any) {
      console.error(err);
      toast("Wallet connection failed", {
        description: err?.message ?? "Something went wrong.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLoginWithMetaMask = () => connectInjectedWallet();
  const handleLoginWithRabby = () => connectInjectedWallet();

  const handleDisconnect = () => {
    setWalletAddress(null);
    setOnChainBalance(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    toast("Disconnected", {
      description: "Wallet has been disconnected.",
    });
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
      description: "500 test coins have been added to your wallet (local only).",
    });
  };

  //Fetch balance from anvil when changes happen
  useEffect(() => {
    if (!walletAddress) {
      setOnChainBalance(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoadingBalance(true);
        const value = await getAnvilBalance(walletAddress);
        if (!cancelled) {
          setOnChainBalance(value);

          const diff = value - balance;
          if (Math.abs(diff) > 1e-9) {
            addCoins(diff);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          toast("Failed to load balance from anvil", {
            description: err?.message ?? "Check that anvil is running.",
          });
          setOnChainBalance(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBalance(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setPonderBets([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoadingPonderBets(true);
        setPonderError(null);

        const addr = walletAddress.toLowerCase();
        const res = await fetch(`${PONDER_API_URL}/shares/${addr}`);
        if (!res.ok) {
          throw new Error(`Ponder API error: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const shares: PonderShare[] = json.shares ?? json.data ?? [];

        if (!cancelled) {
          const sorted = [...shares].sort((a, b) => {
            const ta = normalizeTimestampMs(a.timestamp);
            const tb = normalizeTimestampMs(b.timestamp);
            return tb - ta;
          });
          setPonderBets(sorted);
        }
      } catch (err: any) {
        console.error("Failed to load Ponder betting history", err);
        if (!cancelled) {
          setPonderError(err?.message ?? "Failed to load betting history.");
          setPonderBets([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPonderBets(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoadingRaces(true);
        const res = await fetch(`${PONDER_API_URL}/races`);
        if (!res.ok) {
          throw new Error(`Ponder races error: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const races: PonderRace[] = json.races ?? json.data ?? [];
        if (!cancelled) {
          setPonderRaces(races);
        }
      } catch (err) {
        console.error("Failed to load Ponder races", err);
      } finally {
        if (!cancelled) {
          setIsLoadingRaces(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  //claim handler
  const handleClaim = async (bet: PonderShare) => {
    if (!walletAddress) {
      toast("Connect your wallet first");
      return;
    }
    if (
      !wagmiAddress ||
      walletAddress.toLowerCase() !== wagmiAddress.toLowerCase()
    ) {
      toast("Wrong wallet connected", {
        description: "Please connect the wallet that placed this bet.",
      });
      return;
    }
    if (!publicClient || !writeContractAsync) {
      toast("Wallet not ready", {
        description: "Wagmi client is not ready yet.",
      });
      return;
    }

    const shareId = getShareId(bet);
    if (shareId === null) {
      toast("Cannot claim this bet", {
        description: "Missing share ID for this bet.",
      });
      return;
    }

    const shareIdStr = shareId.toString();

//mark as claimed even if user hits cancel, this is a bypass, please fix
    markLocalClaimed(shareIdStr);
    setPonderBets((prev) =>
      prev.map((b) => {
        const sid = getShareId(b)?.toString();
        if (sid === shareIdStr) {
          return {
            ...b,
            claimed: true,
            status: "claimed",
          };
        }
        return b;
      }),
    );

    try {
      // Fire the on-chain claim in the background
      const txHash = await writeContractAsync({
        address: HORSEY_ADDRESS,
        abi: HORSEY_ABI,
        functionName: "claim",
        args: [[shareId]],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      toast("Winnings claimed 🎉", {
        description: "Your payout has been claimed from the contract.",
      });

      // Refresh on-chain balance + local coins
      try {
        const newBalance = await getAnvilBalance(walletAddress);
        setOnChainBalance(newBalance);
        const diff = newBalance - balance;
        if (Math.abs(diff) > 1e-9) {
          addCoins(diff);
        }
      } catch {
        // ignore balance refresh errors
      }
    } catch (err: any) {
      console.error("Claim failed", err);
      toast("Claim transaction may have failed", {
        description: err?.message ?? "Check the transaction in your wallet.",
      });
    }
  };

  // ---- DISPLAY HELPERS ----
  const shortAddress =
    walletAddress && `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  const displayName =
    farcasterUser?.display_name ||
    farcasterUser?.username ||
    shortAddress ||
    "User";

  const handleLabel = farcasterUser?.username
    ? `@${farcasterUser.username}`
    : shortAddress
    ? `@${shortAddress.toLowerCase()}`
    : "@user";

  const initials =
    farcasterUser?.display_name?.[0]?.toUpperCase() ||
    (walletAddress && walletAddress.slice(2, 4).toUpperCase()) ||
    "U";

  const effectiveBalance =
    onChainBalance !== null && !Number.isNaN(onChainBalance)
      ? onChainBalance
      : balance;

  const raceByIndex = useMemo(() => {
    const map = new Map<number, PonderRace>();
    for (const r of ponderRaces) {
      const idxRaw = r.race_index ?? r.raceIndex ?? r.id;
      if (idxRaw == null) continue;
      const n = Number(idxRaw);
      if (!Number.isFinite(n)) continue;
      map.set(n, r);
    }
    return map;
  }, [ponderRaces]);

  // login window
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
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting…" : "Log in with MetaMask"}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              onClick={handleLoginWithRabby}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting…" : "Log in with Rabby"}
            </Button>

            <Button className="w-full" onClick={handleLoginWithFarcaster}>
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

  //real profile tab
  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-card rounded-lg">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary flex items-center justify-center">
              <ProfilePicture />
              {/* <AvatarFallback className="text-2xl font-bold">
                {initials}
              </AvatarFallback> */}
            </Avatar>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <p className="text-sm text-muted-foreground">{handleLabel}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Level 1
                    </Badge>
                  </div>
                </div>

                {hasWallet && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
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
        {/* Wallet */}
        <section>
          <h2 className="text-xl font-bold mb-4">Wallet</h2>
          <Card className="p-6 bg-gradient-to-br from-primary/20 to-secondary">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {onChainBalance !== null
                    ? "Anvil Coins (on-chain)"
                    : "Test Coins (local)"}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCoins}>
                Add Coins
              </Button>
            </div>

            <div className="text-4xl font-bold">
              {isLoadingBalance
                ? "Loading…"
                : effectiveBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {onChainBalance !== null
                ? "Balance fetched directly from anvil and synced to the app"
                : "Local wallet balance (fallback)"}
            </p>
          </Card>
        </section>

        {/* Achievements */}
        <section>
          <h2 className="text-xl font-bold mb-4">Achievements</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {badges.map((badge: any) => (
              <div key={badge.id}>
                <button
                  onClick={() =>
                    badge.unlocked && setSelectedBadge(badge)
                  }
                  disabled={!badge.unlocked}
                  className="flex flex-col items-center hover:scale-105 transition-transform disabled:cursor-not-allowed"
                >
                  <img
                    src={badge.img}
                    alt={badge.name}
                    className={`w-20 h-20 rounded-full object-cover transition-all ${
                      badge.unlocked ? "" : "opacity-30 grayscale"
                    }`}
                  />
                  <span
                    className={`mt-2 text-sm font-medium ${
                      badge.unlocked ? "" : "text-muted-foreground"
                    }`}
                  >
                    {badge.name}
                  </span>
                </button>
              </div>
            ))}
          </div>

          {selectedBadge && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setSelectedBadge(null)}
            >
              <div
                className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-sm text-center border border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedBadge.img}
                  alt={selectedBadge.name}
                  className="w-24 h-24 mx-auto rounded-full"
                />
                <h3 className="text-lg font-bold mt-4">
                  {selectedBadge.name}
                </h3>

                <p className="text-sm text-muted-foreground mt-2">
                  {selectedBadge.description}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setSelectedBadge(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Activity</h2>
            {isLoadingPonderBets && (
              <span className="text-sm text-muted-foreground">
                Loading betting history…
              </span>
            )}
            {!isLoadingPonderBets && ponderBets.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No bets found
              </span>
            )}
          </div>

          {ponderError && (
            <p className="text-xs text-destructive mb-2">{ponderError}</p>
          )}

          <div className="space-y-3">
            {ponderBets.slice(0, 10).map((bet) => {
              const amount = normalizeAmountFromWeiLike(bet.amount);
              const ts = normalizeTimestampMs(bet.timestamp);
              const dateStr = new Date(ts).toLocaleString();

              const raceIndex = getNumericRaceIndex(bet);
              const raceInfo =
                raceIndex != null ? raceByIndex.get(raceIndex) : undefined;
              const winnerHorseNumber =
                raceInfo != null ? getNumericWinner(raceInfo) : null;

              const raceName =
                bet.race_name ??
                raceInfo?.name ??
                (raceIndex != null ? `Race #${raceIndex}` : "Race");
              const yourHorseNumber =
                bet.horse != null ? Number(bet.horse) : null;

              const yourHorseLabel =
                yourHorseNumber != null && Number.isFinite(yourHorseNumber)
                  ? `Horse ${yourHorseNumber}`
                  : "Horse ?";

              const winnerHorseLabel =
                winnerHorseNumber != null && Number.isFinite(winnerHorseNumber)
                  ? `Horse ${winnerHorseNumber}`
                  : null;

              const oddsStr =
                bet.odds && Number.isFinite(bet.odds)
                  ? `${bet.odds.toFixed(2)}x odds`
                  : "Odds N/A";

              const rawPotential =
                bet.potential_win != null ? bet.potential_win : bet.payout;
              const potentialWin =
                rawPotential != null
                  ? normalizeAmountFromWeiLike(rawPotential)
                  : null;

              const shareId = getShareId(bet);
              const shareIdStr = shareId?.toString() ?? "";

              const isWinner =
                bet.winner != null &&
                yourHorseNumber != null &&
                Number(bet.winner) === yourHorseNumber;

              const isLocallyClaimed =
                shareIdStr.length > 0 &&
                claimedLocalShareIds.includes(shareIdStr);

              const isAlreadyClaimed = bet.claimed === true || isLocallyClaimed;

              const canClaim = isWinner && !isAlreadyClaimed;

              // Decide badge label
              let statusBadge: JSX.Element | null = null;
              if (isAlreadyClaimed || bet.status === "claimed") {
                statusBadge = (
                  <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">
                    Claimed
                  </Badge>
                );
              } else if (canClaim) {
                statusBadge = (
                  <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">
                    Win
                  </Badge>
                );
              } else if (bet.status === "lost") {
                statusBadge = (
                  <Badge className="mt-2 bg-destructive/20 text-destructive border-destructive/30">
                    Lost
                  </Badge>
                );
              } else if (bet.status === "pending") {
                statusBadge = (
                  <Badge className="mt-2 bg-secondary text-secondary-foreground">
                    Pending
                  </Badge>
                );
              } else if (typeof bet.status === "string" && bet.status.length) {
                statusBadge = (
                  <Badge className="mt-2 bg-secondary text-secondary-foreground">
                    {bet.status}
                  </Badge>
                );
              }

              return (
                <Card key={bet.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold">{raceName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Your horse: {yourHorseLabel} • {oddsStr}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dateStr}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {winnerHorseLabel
                            ? `Winner: ${winnerHorseLabel}`
                            : "Winner: pending"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {amount.toLocaleString()} coins
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Bet amount
                        </div>
                        {statusBadge}
                      </div>
                    </div>

                    {/* Claim button row */}
                    {canClaim && (
                      <div className="pt-2 border-t border-border flex justify-end">
                        <Button size="sm" onClick={() => handleClaim(bet)}>
                          Claim Winnings
                        </Button>
                      </div>
                    )}

                    {(isAlreadyClaimed || bet.status === "claimed") &&
                      potentialWin !== null && (
                        <div className="text-sm text-primary font-semibold">
                          Won: +{potentialWin.toLocaleString()} coins
                        </div>
                      )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
