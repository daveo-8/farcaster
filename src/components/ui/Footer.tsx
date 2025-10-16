import React from "react";
import { Tab } from "~/components/App";
import { Home, Trophy, User } from "lucide-react"
import {cn} from "~/lib/utils";
import {Button} from "~/components/ui/button";

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setActiveTab }) => (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
            <Button
                variant="outline"
                onClick={() => setActiveTab(Tab.Home)}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                    activeTab === Tab.Home ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <span className="h-5 w-5"><Home /></span>
                <span className="text-xs font-medium">Home</span>
            </Button>
            <Button
                variant="outline"
                onClick={() => setActiveTab(Tab.Races)}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                    activeTab === Tab.Races ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <span className="h-5 w-5"><Trophy /></span>
                <span className="text-xs font-medium">Races</span>
            </Button>

            <Button
                variant="outline"
                onClick={() => setActiveTab(Tab.Profile)}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                    activeTab === Tab.Profile ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <span className="h-5 w-5 mx-auto"><User /></span>
                <span className="text-xs font-medium mx-auto">Profile</span>
            </Button>
        </div>
    </nav>
);
