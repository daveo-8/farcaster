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
const MAX_ON_SCREEN = 5;

// minimum card height
const MIN_CARD_HEIGHT_PX = 64;

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

  // card container
  bar.style.minHeight = `${MIN_CARD_HEIGHT_PX}px`;
  bar.style.background = "#000";
  bar.style.color = "#fff";
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.justifyContent = "space-between";
  bar.style.border = "1px solid rgba(255,255,255,0.9)";
  bar.style.borderRadius = "12px";
  bar.style.padding = "16px";
  bar.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  bar.style.fontSize = "14px";
  bar.style.cursor = item.placeholder ? "default" : "pointer";
  bar.style.gap = `${BAR_GAP_PX}px`;
  if (item.placeholder) bar.style.opacity = "0.7";

  bar.setAttribute("data-id", item.id);
  bar.setAttribute("data-name", item.name);
  bar.setAttribute("data-time", item.time);
  bar.setAttribute("data-key", `${item.id}`);
  if (item.placeholder) bar.setAttribute("data-placeholder", "1");
  if (item.endBlock !== undefined) {
    bar.setAttribute("data-end-block", String(item.endBlock));
  }

  if (!item.placeholder) {
    bar.addEventListener("mouseenter", () => (bar.style.background = "#0a0a0a"));
    bar.addEventListener("mouseleave", () => (bar.style.background = "#000"));
  }

  // LEFT: title + optional subline
  const left = document.createElement("div");
  left.style.flex = "1 1 auto";

  const title = document.createElement("h3");
  title.textContent = item.name;
  title.style.fontWeight = "600";
  title.style.margin = "0 0 4px 0";
  title.setAttribute("data-role", "title");

  const sub = document.createElement("p");
  sub.style.margin = "0";
  sub.style.opacity = "0.7";
  sub.style.fontSize = "12px";
  sub.setAttribute("data-role", "subline");
  const horses = item.stats?.horses;
  const track = item.stats?.track as string | undefined;
  sub.textContent = item.placeholder
    ? "Awaiting schedule"
    : horses != null
      ? `${horses} racers${track ? ` • ${track}` : ""}`
      : "";

  left.appendChild(title);
  if (sub.textContent) left.appendChild(sub);

  // RIGHT: blocks remaining + view
  const right = document.createElement("div");
  right.style.textAlign = "right";
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.alignItems = "flex-end";

  const blockEl = document.createElement("div");
  blockEl.style.fontSize = "12px";
  blockEl.style.fontWeight = "600";
  blockEl.style.marginBottom = "6px";
  blockEl.setAttribute("data-role", "blockdown");
  blockEl.textContent = item.placeholder ? "TBD" : "-- blocks";

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

  bar.appendChild(left);
  bar.appendChild(right);

  if (!item.placeholder) {
    bar.addEventListener("click", () => {
      window.location.href = `/races2/${encodeURIComponent(item.id)}`;
    });
  }

  return bar;
}

// Update an existing bar IN PLACE (no re-create = no flicker)
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

  // Don't set blocks text here; that's driven by live head updates
}

/**
 * Normalize API output to TimerItem[].
 */
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

// Keep only upcoming-ish entries; server already filters but we sort here
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

// Keyed, in-place patch (flicker-free)
function patchBars(container: HTMLElement, items: TimerItem[], limit = MAX_ON_SCREEN) {
  const desired = items.slice(0, limit);
  const existing = Array.from(container.querySelectorAll<HTMLDivElement>('div[data-key]'));
  const byKey = new Map(existing.map((el) => [el.getAttribute('data-key')!, el]));
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

  async function refreshAll() {
    const data = await loadFromServer();
    const fresh = sortAndFilter(data);
    const padded = padWithPlaceholders(fresh, MAX_ON_SCREEN);
    patchBars(container, padded);
  }

  try {
    await refreshAll(); // initial render
  } catch (e) {
    console.error(e);
  }

  // Periodic refresh to pick up new races / resolved winners
  const refreshInterval = setInterval(() => {
    refreshAll().catch(console.error);
  }, 10000);

  // Live head → live "N blocks" updates
  const stopHead = startHeadListener(refreshAll);

  return () => {
    clearInterval(refreshInterval);
    stopHead();
    const bars = Array.from(container.querySelectorAll("div[data-key]"));
    bars.forEach((b) => b.remove());
  };
}
