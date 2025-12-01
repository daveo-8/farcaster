// whiteBars.ts
type TimerItem = {
  id: string;         // raceId as a string (falls back to index if API is basic)
  name: string;
  time: string;       // ISO string of lockTime
  stats?: Record<string, any>;
  placeholder?: boolean;

  // Block helpers
  endBlock?: number;
};

// Mount inside the "Upcoming Races" section
const CONTAINER_ID = "white-bars-root";

// max number on screen
const MAX_ON_SCREEN = 2;

// minimum card height
const MIN_CARD_HEIGHT_PX = 220;

// container handles vertical spacing; keep 0 here
const BAR_GAP_PX = 0;

function ensureContainer(): HTMLDivElement {
  const container = document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
  if (!container) {
    const fallback = document.createElement("div");
    fallback.id = CONTAINER_ID;
    fallback.className = "space-y-3";
    document.body.appendChild(fallback);
    return fallback;
  }
  return container;
}

function createWhiteBar(item: TimerItem): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.position = "relative";
  bar.style.borderRadius = "12px";
  bar.style.overflow = "hidden";
  bar.style.cursor = item.placeholder ? "default" : "pointer";
  bar.style.minHeight = `${MIN_CARD_HEIGHT_PX}px`;
  bar.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  bar.style.display = "flex";
  bar.style.flexDirection = "column";
  bar.style.border = "1px solid rgba(255,255,255,0.9)";
  bar.style.backgroundColor = "#000"; // fallback
  bar.style.marginBottom = `${BAR_GAP_PX}px`;

  // --- IMAGE ---
  const img = document.createElement("img");
  img.src = "/horse-racing-motion.webp";
  img.alt = item.name;
  img.style.width = "100%";
  img.style.height = "128px";
  img.style.objectFit = "cover";
  img.style.opacity = "0.5";
  bar.appendChild(img);

  // --- "Starting Soon" badge ---
if (!item.placeholder) {
  const badge = document.createElement("div");
  badge.textContent = "Starting Soon";
  badge.style.position = "absolute";
  badge.style.top = "8px";            // distance from top of the image
  badge.style.right = "8px";          // distance from right edge
  badge.style.backgroundColor = "#ff3b30"; // bright red
  badge.style.color = "#fff";
  badge.style.fontSize = "10px";
  badge.style.fontWeight = "600";
  badge.style.padding = "2px 6px";
  badge.style.borderRadius = "6px";
  badge.style.zIndex = "3";           // above overlay
  badge.style.pointerEvents = "none"; // let clicks pass through
  bar.appendChild(badge);
}

  // --- BLACK OVERLAY (instant, no gradient) ---
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.top = "90%"; //
  overlay.style.backgroundColor = "rgba(0,0,0,0.85)";
  overlay.style.zIndex = "1";        // make sure it sits above the image
  overlay.style.pointerEvents = "none"; // allow clicks to pass through

  // append overlay before content so content renders on top
  bar.appendChild(overlay);

  // --- CONTENT ---
  const content = document.createElement("div");
  content.style.position = "absolute";
  content.style.bottom = "0";
  content.style.left = "0";
  content.style.right = "0";
  content.style.padding = "16px";
  content.style.display = "flex";
  content.style.justifyContent = "space-between";
  content.style.alignItems = "center";
  content.style.color = "#fff";
  content.style.zIndex = "2"; 
  
  bar.appendChild(content);
  // LEFT: title + horses
  const left = document.createElement("div");
  left.style.flex = "1 1 auto";

  const title = document.createElement("h3");
  title.textContent = item.name;
  title.style.margin = "0 0 4px 0";
  title.style.fontWeight = "600";
  title.style.fontSize = "16px";
  title.setAttribute("data-role", "title");

  const sub = document.createElement("p");
  sub.style.margin = "0";
  sub.style.fontSize = "12px";
  sub.style.opacity = "0.7";
  const horses = item.stats?.horses;
  sub.textContent = item.placeholder
    ? "Awaiting schedule"
    : horses != null
      ? `${horses} racers`
      : "";
  sub.setAttribute("data-role", "subline");

  left.appendChild(title);
  if (sub.textContent) left.appendChild(sub);

  // RIGHT: blocks remaining + view
  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.alignItems = "flex-end";

  const blockEl = document.createElement("div");
  blockEl.textContent = item.placeholder ? "TBD" : "-- blocks";
  blockEl.style.fontSize = "12px";
  blockEl.style.fontWeight = "600";
  blockEl.style.marginBottom = "6px";
  blockEl.setAttribute("data-role", "blockdown");
  right.appendChild(blockEl);

  if (!item.placeholder) {
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.style.background = "transparent";
    viewBtn.style.border = "1px solid rgba(255,255,255,0.25)";
    viewBtn.style.color = "#fff";
    viewBtn.style.padding = "4px 10px";
    viewBtn.style.borderRadius = "8px";
    viewBtn.style.fontSize = "12px";
    viewBtn.style.cursor = "pointer";
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `/races2/${encodeURIComponent(item.id)}`;
    });
    right.appendChild(viewBtn);
  }

  content.appendChild(left);
  content.appendChild(right);
  bar.appendChild(content);

  // --- hover effect ---
  if (!item.placeholder) {
    bar.addEventListener("mouseleave", () => {
      img.style.transform = "scale(1)";
    });

    bar.addEventListener("click", () => {
      window.location.href = `/races2/${encodeURIComponent(item.id)}`;
    });
  }

  bar.setAttribute("data-id", item.id);
  bar.setAttribute("data-name", item.name);
  bar.setAttribute("data-time", item.time);
  bar.setAttribute("data-key", item.id);
  if (item.placeholder) bar.setAttribute("data-placeholder", "1");
  if (item.endBlock !== undefined) bar.setAttribute("data-end-block", String(item.endBlock));

  return bar;
}

// inplace update to stop flickering
function updateBarFromItem(bar: HTMLDivElement, item: TimerItem) {
  bar.setAttribute("data-id", item.id);
  bar.setAttribute("data-name", item.name);
  bar.setAttribute("data-time", item.time);
  bar.setAttribute("data-key", `${item.id}`);

  if (item.placeholder) {
    bar.setAttribute("data-placeholder", "1");
    bar.style.cursor = "default";
    bar.style.opacity = "0.7";
  } else {
    bar.removeAttribute("data-placeholder");
    bar.style.cursor = "pointer";
    bar.style.opacity = "1";
  }

  if (item.endBlock !== undefined) {
    bar.setAttribute("data-end-block", String(item.endBlock));
  } else {
    bar.removeAttribute("data-end-block");
  }

  const title = bar.querySelector<HTMLElement>('[data-role="title"]');
  if (title) title.textContent = item.name;

  const sub = bar.querySelector<HTMLElement>('[data-role="subline"]');
  const horses = item.stats?.horses;
  const track = item.stats?.track as string | undefined;
  const subText = item.placeholder
    ? "Awaiting schedule"
    : horses != null
      ? `${horses} racers${track ? ` • ${track}` : ""}`
      : "";
  if (sub) {
    sub.textContent = subText;
    if (!subText && sub.parentElement) sub.parentElement.removeChild(sub);
  } else if (subText) {
    const left = bar.firstElementChild as HTMLElement | null;
    if (left) {
      const newSub = document.createElement("p");
      newSub.style.margin = "0";
      newSub.style.opacity = "0.7";
      newSub.style.fontSize = "12px";
      newSub.setAttribute("data-role", "subline");
      newSub.textContent = subText;
      left.appendChild(newSub);
    }
  }

}


async function loadFromServer(): Promise<TimerItem[]> {
  let res = await fetch("/api/info?full=1", { cache: "no-store" });
  if (!res.ok) {
    res = await fetch("/api/info", { cache: "no-store" });
  }
  if (!res.ok) throw new Error("Failed to load info");
  const raw = await res.json();

  return (raw as any[]).map((r, idx) => {
    const raceId =
      r.raceId !== undefined && r.raceId !== null
        ? String(r.raceId)
        : r.id !== undefined && r.id !== null
        ? String(r.id)
        : String(idx);

    const timeIso =
      typeof r.lockTime !== "undefined"
        ? new Date(Number(r.lockTime) * 1000).toISOString()
        : r.time
        ? String(r.time)
        : new Date().toISOString();

    const racers = Array.isArray(r.racers) ? r.racers : undefined;

    const endBlock =
      typeof r.endBlock === "number"
        ? r.endBlock
        : typeof r.end_block === "number"
        ? r.end_block
        : r.endBlock != null
        ? Number(r.endBlock)
        : undefined;

    const item: TimerItem = {
      id: raceId,
      name: r.name ?? `Race ${raceId}`,
      time: timeIso,
      stats: racers ? { horses: racers.length } : undefined,
      endBlock: Number.isFinite(endBlock) ? endBlock : undefined,
    };

    return item;
  });
}

// upcoming entries
function sortAndFilter(items: TimerItem[], nowMs = Date.now()) {
  return items
    .filter((i) => Date.parse(i.time) > nowMs || i.placeholder === true)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

// Placeholders
function makePlaceholder(index: number): TimerItem {
  const farFuture = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  return { id: `tbd-${index}`, name: "To be determined", time: farFuture, placeholder: true };
}
function padWithPlaceholders(items: TimerItem[], needed: number): TimerItem[] {
  const out = [...items];
  for (let i = 1; out.length < needed; i++) out.push(makePlaceholder(i));
  return out;
}

function patchBars(container: HTMLElement, items: TimerItem[], limit = MAX_ON_SCREEN) {
  const desired = items.slice(0, limit);
  const existing = Array.from(container.querySelectorAll<HTMLDivElement>('div[data-key]'));
  const byKey = new Map(existing.map((el) => [el.getAttribute("data-key")!, el]));
  const used = new Set<string>();

  desired.forEach((item, idx) => {
    const key = String(item.id);
    let bar = byKey.get(key);
    if (!bar) {
      bar = createWhiteBar(item);
    } else {
      updateBarFromItem(bar, item);
    }
    used.add(key);
    const refNode = container.children[idx] || null;
    if (bar !== refNode) container.insertBefore(bar, refNode);
  });

  for (const [key, el] of byKey) {
    if (!used.has(key)) el.remove();
  }
}

// Update "N blocks" on all bars using the latest head block
async function updateBlocksLeftForAllBars(currentBlock: number, refreshAll: () => Promise<void>) {
  const container = ensureContainer();
  const bars = Array.from(container.querySelectorAll<HTMLDivElement>("div[data-key]"));
  let removedSomething = false;

  for (const bar of bars) {
    if (bar.hasAttribute("data-placeholder")) continue;

    const endBlockStr = bar.getAttribute("data-end-block");
    if (!endBlockStr) continue;

    const endBlock = Number(endBlockStr);
    if (!Number.isFinite(endBlock)) continue;

    const remaining = Math.max(0, endBlock - currentBlock);

    const el = bar.querySelector<HTMLElement>('[data-role="blockdown"]');
    if (el) el.textContent = `${remaining} blocks`;

    if (remaining <= 0) {
      removedSomething = true;
      bar.remove();
    }
  }

  // If a race hit 0 and we removed it, re-pull from /api/info to refill slots
  if (removedSomething) {
    await refreshAll();
  }
}

// Listen to live head updates via SSE, with fallback to polling
function startHeadListener(refreshAll: () => Promise<void>) {
  let es: EventSource | null = null;
  let pollTimer: number | null = null;

  const startPolling = () => {
    if (pollTimer != null) return;
    pollTimer = window.setInterval(async () => {
      try {
        const r = await fetch("/api/head", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (typeof j.currentBlock === "number") {
          await updateBlocksLeftForAllBars(j.currentBlock, refreshAll);
        }
      } catch (e) {
        console.error("head poll error", e);
      }
    }, 2000) as unknown as number;
  };

  try {
    es = new EventSource("/api/head/live");
    es.onmessage = async (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (typeof data.currentBlock === "number") {
          await updateBlocksLeftForAllBars(data.currentBlock, refreshAll);
        }
      } catch {
        // ignore bad event
      }
    };
    es.onerror = () => {
      if (es) es.close();
      startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    if (es) es.close();
    if (pollTimer != null) clearInterval(pollTimer);
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function startWhiteBars() {
  const container = ensureContainer();

  // dynamic refresh interval state
  let refreshInterval: number | null = null;
  let isFastPolling = false; // true => 500ms, false => 10s

  const setRefreshInterval = (fast: boolean) => {
    if (fast === isFastPolling && refreshInterval !== null) {
      return; // no change
    }
    if (refreshInterval !== null) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    isFastPolling = fast;
    const delay = fast ? 500 : 10000;
    refreshInterval = window.setInterval(() => {
      refreshAll().catch(console.error);
    }, delay) as unknown as number;
  };

  async function refreshAll() {
    const data = await loadFromServer();
    const fresh = sortAndFilter(data);
    const padded = padWithPlaceholders(fresh, MAX_ON_SCREEN);
    patchBars(container, padded);

	// If everything on screen is TBD refresh rate is maxed out.
    // Otherwise refresh is 10 seconds
    const allTbd = fresh.length === 0;
    setRefreshInterval(allTbd);
  }

  try {
    await refreshAll(); 
  } catch (e) {
    console.error(e);
  }

  // Live head → live "N blocks" updates
  const stopHead = startHeadListener(refreshAll);

  return () => {
    if (refreshInterval !== null) clearInterval(refreshInterval);
    stopHead();
    const bars = Array.from(container.querySelectorAll("div[data-key]"));
    bars.forEach((b) => b.remove());
  };
}
