"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface Bet {
    id: string
    raceId: number
    raceName: string
    horseId: number
    horseName: string
    amount: number
    odds: number
    potentialWin: number
    timestamp: number
    status: "pending" | "won" | "lost"
}

interface WalletContextType {
    balance: number
    bets: Bet[]
    addBet: (bet: Omit<Bet, "id" | "timestamp" | "status">) => void
    updateBetStatus: (betId: string, status: "won" | "lost") => void
    addCoins: (amount: number) => void
    stats: {
        totalBets: number
        totalWins: number
        totalLosses: number
        winRate: number
        totalWon: number
        totalLost: number
    }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [balance, setBalance] = useState(1000)
    const [bets, setBets] = useState<Bet[]>([])

    // Load from localStorage on mount
    useEffect(() => {
        const savedBalance = localStorage.getItem("wallet-balance")
        const savedBets = localStorage.getItem("wallet-bets")

        if (savedBalance) setBalance(Number.parseFloat(savedBalance))
        if (savedBets) setBets(JSON.parse(savedBets))
    }, [])

    // Save to localStorage whenever balance or bets change
    useEffect(() => {
        localStorage.setItem("wallet-balance", balance.toString())
    }, [balance])

    useEffect(() => {
        localStorage.setItem("wallet-bets", JSON.stringify(bets))
    }, [bets])

    const addBet = (bet: Omit<Bet, "id" | "timestamp" | "status">) => {
        const newBet: Bet = {
            ...bet,
            id: `bet-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            status: "pending",
        }

        setBets((prev) => [newBet, ...prev])
        setBalance((prev) => prev - bet.amount)
    }

    const updateBetStatus = (betId: string, status: "won" | "lost") => {
        setBets((prev) =>
            prev.map((bet) => {
                if (bet.id === betId && bet.status === "pending") {
                    if (status === "won") {
                        setBalance((b) => b + bet.potentialWin)
                    }
                    return { ...bet, status }
                }
                return bet
            }),
        )
    }

    const addCoins = (amount: number) => {
        setBalance((prev) => prev + amount)
    }

    const stats = {
        totalBets: bets.length,
        totalWins: bets.filter((b) => b.status === "won").length,
        totalLosses: bets.filter((b) => b.status === "lost").length,
        winRate: bets.length > 0 ? (bets.filter((b) => b.status === "won").length / bets.length) * 100 : 0,
        totalWon: bets.filter((b) => b.status === "won").reduce((sum, b) => sum + b.potentialWin, 0),
        totalLost: bets.filter((b) => b.status === "lost").reduce((sum, b) => sum + b.amount, 0),
    }

    return (
        <WalletContext.Provider value={{ balance, bets, addBet, updateBetStatus, addCoins, stats }}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider")
    }
    return context
}
