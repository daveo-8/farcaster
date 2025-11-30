// src/lib/badges.ts
export type Badge = {
    id: number;
    name: string;
    img: string;
    description: string;
    unlocked: boolean;
  };
  
  export function getBadges(bets: any[]): Badge[] {
    const wins = bets
      .filter(b => b.status === "won")
      .sort((a, b) => a.timestamp - b.timestamp);
  
    // compute lucky streak
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < wins.length; i++) {
      if (i === 0 || wins[i - 1].timestamp < wins[i].timestamp) {
        streak++;
      } else {
        streak = 1;
      }
      maxStreak = Math.max(maxStreak, streak);
    }
  
    return [
      {
        id: 1,
        name: "First Bet",
        img: "/AchievementsBadges/1.png",
        description: "Awarded for placing your first bet.",
        unlocked: bets.length >= 1,
      },
      {
        id: 2,
        name: "Winner",
        img: "/AchievementsBadges/2.png",
        description: "Earned by winning your first race.",
        unlocked: bets.some(b => b.status === "won"),
      },
      {
        id: 3,
        name: "Lucky Streak",
        img: "/AchievementsBadges/3.png",
        description: "Earned by winning three bets in a row.",
        unlocked: maxStreak >= 3,
      },
    ];
  }
  