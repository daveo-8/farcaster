"use client";
import { useEffect } from "react";
import { startWhiteBars } from "./whiteBars";

export function RacesTab() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      stop = await startWhiteBars();
    })();
    return () => {
      if (stop) stop();
    };
  }, []);

  return (
    <div className="p-4">
      <section>
        <h2 className="text-xl font-bold mt-4 mb-4">Upcoming Races</h2>
        <div id="white-bars-root" className="space-y-3" />
      </section>
    </div>
  );
}