"use client";

import {Card} from "~/components/ui/card";
import {Clock, MapPin} from "lucide-react";
import Link from "next/link";
import {Button} from "~/components/ui/button";
import {Badge} from "~/components/ui/badge";

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
export function RacesTab() {
    const races = [
        {
            id: 1,
            name: "Churchill Downs Classic",
            location: "Louisville, KY",
            time: "15m",
            status: "starting-soon",
            horses: 8,
            distance: "1.5 miles",
            track: "Dirt",
        },
        {
            id: 2,
            name: "Belmont Stakes",
            location: "Elmont, NY",
            time: "2h 30m",
            status: "upcoming",
            horses: 10,
            distance: "1.5 miles",
            track: "Dirt",
        },
        {
            id: 3,
            name: "Preakness Stakes",
            location: "Baltimore, MD",
            time: "4h 15m",
            status: "upcoming",
            horses: 9,
            distance: "1.2 miles",
            track: "Dirt",
        },
        {
            id: 4,
            name: "Kentucky Derby",
            location: "Louisville, KY",
            time: "6h 45m",
            status: "upcoming",
            horses: 12,
            distance: "1.25 miles",
            track: "Dirt",
        },
        {
            id: 5,
            name: "Santa Anita Derby",
            location: "Arcadia, CA",
            time: "8h 20m",
            status: "upcoming",
            horses: 11,
            distance: "1.1 miles",
            track: "Dirt",
        },
    ]

  return (
      <div className="min-h-screen pb-20">
        <div className="max-w-lg mx-auto">
            <div className="space-y-4">
                {races.map((race) => (
                    <Card key={race.id} className="overflow-hidden">
                        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-secondary">
                            <img
                                src={`/horse-racing-motion.webp?height=128&width=400&query=horse racing ${race.name}`}
                                alt={race.name}
                                className="w-full h-full object-cover opacity-50"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                            {race.status === "starting-soon" && (
                                <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">Starting Soon</Badge>
                            )}
                        </div>
                        <div className="p-4">
                            <h3 className="text-lg font-bold mb-2">{race.name}</h3>
                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{race.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>Starts in {race.time}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-muted-foreground">{race.horses} horses</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-muted-foreground">{race.distance}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-muted-foreground">{race.track}</span>
                                </div>
                            </div>
                            <Link href={`/races/${race.id}`}>
                                <Button className="w-full">View Race Details</Button>
                            </Link>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
      </div>
  );
} 
