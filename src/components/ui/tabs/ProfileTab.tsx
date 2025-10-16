"use client";

import {useWallet} from "~/lib/wallet-context";
import {toast} from "sonner";
import {Avatar, AvatarFallback, AvatarImage} from "~/components/ui/avatar";
import {Badge} from "~/components/ui/badge";
import {Card} from "~/components/ui/card";
import {Coins, Trophy, History, TrendingUp} from "lucide-react";
import {Button} from "~/components/ui/button";

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
export function ProfileTab() {
    const { balance, bets, stats, addCoins, updateBetStatus } = useWallet()

    const handleAddCoins = () => {
        addCoins(500)
        toast("Coins Added!", {
            description: "500 test coins have been added to your wallet.",
        })
    }

    const handleSimulateWin = (betId: string) => {
        updateBetStatus(betId, "won")
        toast("Congratulations!", {
            description: "Your bet won!",
        })
    }

    const handleSimulateLoss = (betId: string) => {
        updateBetStatus(betId, "lost")
        toast("Better luck next time", {
            description: "Your bet lost.",
        })
    }

    return (
        <div className="min-h-screen pb-20">
            <header className="border-b border-border bg-card">
                <div className="max-w-lg mx-auto px-4 py-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 border-2 border-primary">
                            <AvatarImage src="/placeholder.svg?height=80&width=80" />
                            <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold">John Doe</h1>
                            <p className="text-sm text-muted-foreground">@johndoe</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-primary/20 text-primary border-primary/30">Level 1</Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
                <section>
                    <h2 className="text-xl font-bold mb-4">Wallet</h2>
                    <Card className="p-6 bg-gradient-to-br from-primary/20 to-secondary">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Coins className="h-5 w-5 text-primary" />
                                <span className="text-sm text-muted-foreground">Test Coins</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAddCoins}>
                                Add Coins
                            </Button>
                        </div>
                        <div className="text-4xl font-bold">{balance.toLocaleString()}</div>
                        <p className="text-sm text-muted-foreground mt-1">Available balance</p>
                    </Card>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4">Statistics</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Total Wins</span>
                            </div>
                            <div className="text-3xl font-bold">{stats.totalWins}</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <History className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Total Bets</span>
                            </div>
                            <div className="text-3xl font-bold">{stats.totalBets}</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Win Rate</span>
                            </div>
                            <div className="text-3xl font-bold">{stats.winRate.toFixed(0)}%</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Coins className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Total Won</span>
                            </div>
                            <div className="text-3xl font-bold">{stats.totalWon.toLocaleString()}</div>
                        </Card>
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Recent Activity</h2>
                        {bets.length === 0 && <span className="text-sm text-muted-foreground">No bets yet</span>}
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
                                            <p className="text-xs text-muted-foreground mt-1">{new Date(bet.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">{bet.amount} coins</div>
                                            <div className="text-sm text-muted-foreground">Bet amount</div>
                                            {bet.status === "pending" && (
                                                <Badge className="mt-2 bg-secondary text-secondary-foreground">Pending</Badge>
                                            )}
                                            {bet.status === "won" && (
                                                <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">Won</Badge>
                                            )}
                                            {bet.status === "lost" && (
                                                <Badge className="mt-2 bg-destructive/20 text-destructive border-destructive/30">Lost</Badge>
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
                                        <div className="text-sm text-primary font-semibold">Won: +{bet.potentialWin} coins</div>
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
