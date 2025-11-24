"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ChevronLeft, Circle, ChevronDown, ChevronUp } from "lucide-react";

// ---- Types ----
type Horse = {
  id: number;
  name: string;
  color: string;
  odds: number;
  totalBets: number;
};

type Race = {
  id: number;
  name: string;
  horses: Horse[];
};

type UserBet = {
  raceId: number;
  horseId: number;
  amount: number;
  potentialWin: number;
};

type ChatMessage = {
  id: number;
  text?: string;
  image?: string;
  timestamp: string;
};

export default function HorseRoomPage() {
  const router = useRouter();
  const { id: raceId } = useParams();

  const [race, setRace] = useState<Race | null>(null);
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [modalImage, setModalImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Load user bets from localStorage ----
  useEffect(() => {
    const stored = localStorage.getItem("userBets");
    if (stored) {
      try {
        setUserBets(JSON.parse(stored));
      } catch {
        console.error("Invalid stored bets");
      }
    }
  }, []);

  // ---- Scroll chat to bottom on new messages ----
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // ---- Load race info ----
  useEffect(() => {
    const loadRace = async () => {
      try {
        const res = await fetch("/info.txt", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch info.txt (${res.status})`);
  
        const data = await res.json();
        const found = data.find((r: any) => r.id === raceId);
        if (!found) throw new Error(`Race ${raceId} not found`);
  
        const raceIdNum = Number(raceId);
  
        // Convert odds to numbers (they're strings in your file)
        const horsesWithBets = found.horses.map((h: any) => {
          const total = userBets
            .filter((b) => b.horseId === Number(h.id) && b.raceId === raceIdNum)
            .reduce((sum, b) => sum + b.amount, 0);
          return {
            id: Number(h.id),
            name: h.name,
            color: h.color,
            odds: Number(h.odds),
            totalBets: total,
          };
        });
  
        setRace({
          id: Number(found.id),
          name: found.name,
          horses: horsesWithBets,
        });
      } catch (err) {
        console.error(err);
      }
    };
  
    loadRace();
  }, [raceId, userBets]);

  const sortedHorses = race ? [...race.horses].sort((a, b) => a.odds - b.odds) : [];

  // ---- Chat Handlers ----
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMessage: ChatMessage = {
      id: messages.length + 1,
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        image: reader.result as string,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMessage]);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    for (const item of e.clipboardData.items) {
      if (item.type.includes("image")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const newMessage: ChatMessage = {
            id: messages.length + 1,
            image: reader.result as string,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, newMessage]);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
      }
    }
  };

  // ---- CLO & Chat toggles ----
  const toggleCLO = () => {
    setExpanded(!expanded);
    if (!expanded) setChatOpen(false);
    else setChatOpen(true);
  };

  const openChat = () => {
    setChatOpen(true);
    setExpanded(false);
  };

  if (!race) return <div className="p-6 text-center">Loading race...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{race.name}</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col p-3 gap-2">
        {/* Animation Placeholder */}
        <div className="w-full bg-gradient-to-br from-primary/10 to-secondary/20 rounded-lg shadow-md aspect-video flex items-center justify-center">
          <h2 className="text-lg font-bold text-muted-foreground">Animation Placeholder</h2>
        </div>

        {/* Current Live Odds */}
        <Card className="w-full p-2 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-md font-bold flex-1">Current Live Odds</h2>
            <Button variant="ghost" size="sm" onClick={toggleCLO} className="flex items-center gap-1 text-sm">
              {expanded ? (
                <span className="flex items-center gap-1">Show Less <ChevronUp className="h-3 w-3" /></span>
              ) : (
                <span className="flex items-center gap-1">Show All <ChevronDown className="h-3 w-3" /></span>
              )}
            </Button>
          </div>

          {/* Collapsed */}
          {!expanded && (
            <div className="flex justify-evenly py-1">
              {sortedHorses.slice(0, 3).map((horse, index) => {
                const userBet = userBets.find((b) => b.horseId === horse.id && b.raceId === Number(race.id));
                return <HorseRowCollapsed key={horse.id} horse={horse} index={index} userBet={userBet} />;
              })}
            </div>
          )}

          {/* Expanded */}
          {expanded && (
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white scrollbar-track-gray-800">
              {sortedHorses.map((horse, index) => {
                const userBet = userBets.find((b) => b.horseId === horse.id && b.raceId === Number(race.id));
                return <HorseRowExpanded key={horse.id} horse={horse} index={index} userBet={userBet} />;
              })}
            </div>
          )}
        </Card>

        {/* Show Chat button when CLO expanded */}
        {expanded && !chatOpen && (
          <Button className="w-full py-2 rounded-lg shadow-md text-sm" onClick={openChat}>
            Open Chat
          </Button>
        )}

        {/* Chat Section */}
        {chatOpen && (
          <Card className="w-full h-64 p-2 flex flex-col bg-black text-white shadow-md">
            <div className="text-sm font-bold mb-1 border-b border-gray-700 pb-1">Chat</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white scrollbar-track-gray-800">
              {messages.map((msg) => (
                <div key={msg.id} className="border-b border-gray-700 pb-1 text-xs">
                  <span className="text-gray-400 mr-1">{msg.timestamp}</span>
                  {msg.text && <span>{msg.text}</span>}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="uploaded"
                      className="mt-1 max-h-24 rounded-md cursor-pointer"
                      onClick={() => setModalImage(msg.image)}
                    />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-1 mt-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="flex-1 p-1 rounded-md border border-gray-600 bg-gray-900 text-white text-sm"
              />
              <label className="cursor-pointer p-1 bg-gray-800 rounded-md text-sm">
                📎
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              <Button size="sm" onClick={handleSendMessage}>Send</Button>
            </div>
          </Card>
        )}

        {/* Image Modal */}
        {modalImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setModalImage(null)}
          >
            <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <button
                className="mb-2 text-white bg-gray-800 rounded-full px-2 py-1 text-lg font-bold"
                onClick={() => setModalImage(null)}
              >
                ✕
              </button>
              <img src={modalImage} alt="modal" className="max-h-[80vh] max-w-[90vw] rounded-md" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---- Collapsed Horse Row ----
function HorseRowCollapsed({ horse, index, userBet }: { horse: Horse; index: number; userBet?: UserBet }) {
  return (
    <div className="flex flex-col items-center text-center p-1 rounded-lg min-w-[80px]">
      <div className="flex items-center gap-1 mb-1">
        {userBet && <Circle className="h-3 w-3 text-green-500 fill-green-500" />}
        <div className={`w-6 h-6 rounded-md ${horse.color} flex items-center justify-center text-white text-sm font-bold`}>
          {index + 1}
        </div>
        <div className="flex flex-col text-left ml-1">
          <span className="text-xs font-semibold">{horse.name}</span>
          <span className="text-[10px] text-muted-foreground">Total: {(horse.totalBets ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Expanded Horse Row ----
function HorseRowExpanded({ horse, index, userBet }: { horse: Horse; index: number; userBet?: UserBet }) {
  return (
    <div className="p-1 rounded-lg flex flex-col transition-all">
      <div className="flex items-center gap-2 mb-1">
        {userBet && <Circle className="h-3 w-3 text-green-500 fill-green-500" />}
        <div className={`w-6 h-6 rounded-md ${horse.color} flex items-center justify-center text-white text-sm font-bold`}>
          {index + 1}
        </div>
        <div className="font-semibold text-sm">{horse.name}</div>
      </div>
      <div className="text-[10px] text-muted-foreground ml-6">
        <div>Total: {(horse.totalBets ?? 0).toLocaleString()} coins</div>
        {userBet && (
          <>
            <div>Your Bet: {userBet.amount} coins</div>
            <div className="text-green-500">Potential Win: {userBet.potentialWin} coins</div>
          </>
        )}
      </div>
    </div>
  );
}
