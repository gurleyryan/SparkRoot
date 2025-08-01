import React, { useState, useMemo } from 'react';
import BracketPicker from '@/components/BracketPicker';
import type { MTGCard, Deck } from '@/types/index';
import { useCollectionStore } from '@/store/collectionStore';
import ReactDOM from "react-dom";
import DeckGenerationProgress from "./DeckGenerationProgress";

export interface DeckBuilderProps {
  onDeckGenerated: (deck: Deck) => void;
  onShowGameChangers: () => void;
  onHideGameChangers?: () => void;
  loading?: boolean;
}

export default function DeckBuilder({ onDeckGenerated, onShowGameChangers, onHideGameChangers, loading: loadingProp }: DeckBuilderProps) {
  // --- Robust SSE connection state ---
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const closedCleanlyRef = React.useRef(false);
  // --- End SSE connection state ---
  // Track if Game Changers is open (for toggle button label and behavior)
  const [gameChangersOpen, setGameChangersOpen] = useState(false);
  const [bracket, setBracket] = useState(1); // Default to 1 for House Rules
  // State and setter for house rules tooltip visibility
  const [showHouseRulesTooltip, setShowHouseRulesTooltip] = useState(false);
  const [showSaltTooltip, setShowSaltTooltip] = useState(false);
  const houseRulesIconRef = React.useRef<HTMLSpanElement>(null);
  const saltIconRef = React.useRef<HTMLSpanElement>(null);
  const houseRulesTooltipRef = React.useRef<HTMLDivElement>(null);
  const saltTooltipRef = React.useRef<HTMLDivElement>(null);
  // Close tooltips on outside click/tap (for mobile)
  const [houseRulesTooltipPos, setHouseRulesTooltipPos] = useState<{ left: number, top: number } | null>(null);
  const [saltTooltipPos, setSaltTooltipPos] = useState<{ left: number, top: number } | null>(null);
  const [commanderId, setCommanderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setError] = useState('');
  const [houseRules, setHouseRules] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const debugMsgsRef = React.useRef<string[]>([]);
  const [deckgenLoading, setDeckgenLoading] = useState(false);
  const [stepDetails] = useState<Record<string, string>>({});
  // Salt threshold slider: 0 (no salty cards) to 15 (allow all salty cards)
  const [saltThreshold, setSaltThreshold] = useState(15);
  const { collections, userInventory } = useCollectionStore();

  React.useEffect(() => {
    function handleClick(e: MouseEvent | TouchEvent) {
      if (showHouseRulesTooltip) {
        const icon = houseRulesIconRef.current;
        const tip = houseRulesTooltipRef.current;
        if (icon && tip && !icon.contains(e.target as Node) && !tip.contains(e.target as Node)) {
          setShowHouseRulesTooltip(false);
        }
      }
      if (showSaltTooltip) {
        const icon = saltIconRef.current;
        const tip = saltTooltipRef.current;
        if (icon && tip && !icon.contains(e.target as Node) && !tip.contains(e.target as Node)) {
          setShowSaltTooltip(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [showHouseRulesTooltip, showSaltTooltip]);

  // Local state for card source selection: 'inventory' or collection id
  const [cardSourceType, setCardSourceType] = useState<string>(() => 'inventory');

  // Find the selected collection (if any)
  const selectedCollection = useMemo(() => {
    if (cardSourceType === 'inventory') return null;
    return collections.find(col => col.id === cardSourceType) || null;
  }, [cardSourceType, collections]);

  // Use selected collection or full inventory as card source
  const cardSource = useMemo(() => {
    if (selectedCollection && Array.isArray(selectedCollection.cards) && selectedCollection.cards.length > 0) {
      return selectedCollection.cards;
    }
    if (userInventory && Array.isArray(userInventory)) {
      return userInventory;
    }
    return [];
  }, [selectedCollection, userInventory]);

  // Memoized list of possible commanders (from cardSource)
  const commanderOptions = useMemo(() => {
    return cardSource.filter(
      (card: MTGCard) =>
        typeof card.type_line === 'string' &&
        card.type_line.toLowerCase().includes('legendary creature')
    );
  }, [cardSource]);


  // Utility: group and count cards by id (for deck display)
  function groupDeckCardsById(cards: MTGCard[], commanderId: string) {
    if (!Array.isArray(cards) || cards.length === 0) return [];
    // Group by id
    const map = new Map<string, MTGCard & { quantity: number }>();
    for (const card of cards) {
      if (!card.id) continue;
      if (map.has(card.id)) {
        map.get(card.id)!.quantity += 1;
      } else {
        map.set(card.id, { ...card, quantity: 1 });
      }
    }
    // Always put the commander first if present
    let commander: MTGCard | undefined = undefined;
    if (commanderId && map.has(commanderId)) {
      commander = map.get(commanderId);
      map.delete(commanderId);
    }
    // Return commander (if any) first, then all other unique cards
    return commander ? [commander, ...Array.from(map.values())] : Array.from(map.values());
  }

  // Robust SSE deck generation handler
  const handleGenerateDeck = async () => {
    setDeckgenLoading(true);
    setCurrentStep(0);
    setDebugMessages([]);
    setLoading(true);
    setError("");

    closedCleanlyRef.current = false;
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    if (!Array.isArray(cardSource) || cardSource.length === 0) {
      setError("No cards found in your selected collection or inventory. Please add cards before generating a deck.");
      setDeckgenLoading(false);
      setLoading(false);
      return;
    }
    const payload = {
      collection: cardSource,
      commander_id: commanderId,
      bracket,
      house_rules: houseRules,
      salt_threshold: saltThreshold,
    };
    let jobId: string | null = null;
    debugMsgsRef.current = [];
    try {
      // 1. POST to job-based endpoint
      const res = await fetch("/api/proxy/generate-deck-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const errText = await res.text();
        setError(`Failed to start deck generation: ${res.status} ${errText}`);
        setDeckgenLoading(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      jobId = data.job_id || data.id || null;
      if (!jobId) {
        setError("No job_id returned from backend.");
        setDeckgenLoading(false);
        setLoading(false);
        return;
      }
      // 2. Open SSE connection to GET endpoint with job_id
      const sseUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/generate-deck?job_id=${encodeURIComponent(jobId)}`;
      connectSSE(sseUrl);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("Failed to start deck generation: " + err.message);
      } else {
        setError("Failed to start deck generation: " + String(err));
      }
      setDeckgenLoading(false);
      setLoading(false);
    }
  };

  // Cleanup SSE and timeouts on component unmount
  React.useEffect(() => {
    return () => {
      closedCleanlyRef.current = true;
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  function connectSSE(sseUrl: string) {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const eventSource = new window.EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = eventSource;

    // Accumulate all debug/step messages
    let allDebugMessages: string[] = [];
    // Step order for mapping
    const stepOrder = ["filter", "theme", "categorize", "lands", "curve", "rocks", "categories", "final"];
    // Import mapStepLogs dynamically to avoid circular import
    // @ts-ignore
    import("@/lib/mapStepLogs").then(({ mapStepLogs }) => {
      eventSource.addEventListener("step", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const msg = data.message || JSON.stringify(data);
          allDebugMessages = [...allDebugMessages, msg];
          setDebugMessages(allDebugMessages);
          // Try to update currentStep by mapping message to step
          const stepLogMap = mapStepLogs(allDebugMessages);
          // Find the latest step with a message
          let latestStepIdx = 0;
          for (let i = stepOrder.length - 1; i >= 0; i--) {
            if (stepLogMap[stepOrder[i]] && stepLogMap[stepOrder[i]].length > 0) {
              latestStepIdx = i;
              break;
            }
          }
          setCurrentStep(latestStepIdx);
        } catch (err) {
          allDebugMessages = [...allDebugMessages, `[Parse Error] ${event.data}`];
          setDebugMessages(allDebugMessages);
          console.warn("[SSE] step event parse error", event.data, err);
        }
      });

      eventSource.addEventListener("deck", (event: MessageEvent) => {
        try {
          const deck = JSON.parse(event.data);
          // Optionally add a final message
          allDebugMessages = [...allDebugMessages, "Deck generation complete."];
          setDebugMessages(allDebugMessages);
          // Group all cards by id, set quantity, and preserve commander at index 0
          const groupedDeck = {
            ...deck,
            cards: groupDeckCardsById(deck.cards || [], deck.commander?.id || "")
          };
          onDeckGenerated(groupedDeck);
          closedCleanlyRef.current = true;
          eventSource.close();
          setDeckgenLoading(false);
          setLoading(false);
        } catch (err) {
          allDebugMessages = [...allDebugMessages, `[Parse Error] ${event.data}`];
          setDebugMessages(allDebugMessages);
          console.warn("[SSE] deck event parse error", event.data, err);
        }
      });
    });

    // Generic message handler: parse event type and data
    eventSource.onmessage = (event) => {
      // Try to parse event type and data from raw event text
      // Some browsers deliver custom events as generic messages
      // event.data may contain multiple lines: event: <type>\ndata: <json>
      if (typeof event.data === "string" && event.data.includes("event:")) {
        // Multi-line event: parse manually
        const lines = event.data.split(/\r?\n/);
        let eventType = "message";
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.replace("event:", "").trim();
          if (line.startsWith("data:")) dataLine += line.replace("data:", "").trim();
        }
        if (eventType === "step") {
          try {
            const data = JSON.parse(dataLine);
            const msg = data.message || JSON.stringify(data);
            allDebugMessages = [...allDebugMessages, msg];
            setDebugMessages(allDebugMessages);
            import("@/lib/mapStepLogs").then(({ mapStepLogs }) => {
              const stepLogMap = mapStepLogs(allDebugMessages);
              let latestStepIdx = 0;
              for (let i = stepOrder.length - 1; i >= 0; i--) {
                if (stepLogMap[stepOrder[i]] && stepLogMap[stepOrder[i]].length > 0) {
                  latestStepIdx = i;
                  break;
                }
              }
              setCurrentStep(latestStepIdx);
            });
          } catch (err) {
            allDebugMessages = [...allDebugMessages, `[Parse Error] ${dataLine}`];
            setDebugMessages(allDebugMessages);
            console.warn("[SSE] step event parse error (onmessage)", dataLine, err);
          }
        } else if (eventType === "deck") {
          try {
            const deck = JSON.parse(dataLine);
            allDebugMessages = [...allDebugMessages, "Deck generation complete."];
            setDebugMessages(allDebugMessages);
            // Group all cards by id, set quantity, and preserve commander at index 0
            const groupedDeck = {
              ...deck,
              cards: groupDeckCardsById(deck.cards || [], deck.commander?.id || "")
            };
            onDeckGenerated(groupedDeck);
            closedCleanlyRef.current = true;
            eventSource.close();
            setDeckgenLoading(false);
            setLoading(false);
          } catch (err) {
            allDebugMessages = [...allDebugMessages, `[Parse Error] ${dataLine}`];
            setDebugMessages(allDebugMessages);
            console.warn("[SSE] deck event parse error (onmessage)", dataLine, err);
          }
        } else {
          console.log("[SSE] generic message event:", event.data);
        }
      } else {
        // Fallback: just log
        console.log("[SSE] generic message event:", event.data);
      }
    };
    eventSource.onopen = () => {
      console.log("[SSE] connection opened");
    };
    eventSource.onerror = (e) => {
      console.log("[SSE] connection error", e);
      setError("SSE connection error. Retrying in 2s...");
      setDeckgenLoading(false);
      setLoading(false);
      setDebugMessages((prev) => [...prev, `[SSE Error] Connection lost`]);
      if (!closedCleanlyRef.current) {
        if (eventSourceRef.current) eventSourceRef.current.close();
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE(sseUrl);
        }, 2000);
      }
    };
  }

  // Move deckgen_steps animation logic here, inside handleGenerateDeck's try block
  // (see above for placement)

  // Handler for Game Changer button toggle
  const handleGameChangersToggle = () => {
    setGameChangersOpen(open => !open);
  };

  React.useEffect(() => {
    if (gameChangersOpen) {
      onShowGameChangers();
    } else if (typeof onHideGameChangers === 'function') {
      onHideGameChangers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameChangersOpen]);


  return (
    <div className="container mx-auto sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
      <div className="container mx-auto w-full shadow-md px-4 py-0 flex flex-col">
        <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare"><i className="ms ms-commander ms-2x text-mtg-blue group-hover:text-rarity-uncommon"></i> Deck Builder</h2>
        {/* Card source, commander, and house rules toggle in one row */}
        <div className="flex flex-row items-end gap-4 mb-4 w-full">
          <div className="flex-1 flex flex-col">
            <label htmlFor="card-source-select" className="block text-slate-200 font-semibold mb-1">Choose Card Source</label>
            <select
              id="card-source-select"
              className="w-full rounded-md border border-slate-600 bg-mtg-black text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mtg-blue"
              value={cardSourceType}
              onChange={e => setCardSourceType(e.target.value)}
            >
              <option value="inventory">Inventory</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 flex flex-col">
            <label htmlFor="commander-select" className="block text-slate-200 font-semibold mb-1">Choose Commander</label>
            <select
              id="commander-select"
              className="w-full rounded-md border border-slate-600 bg-mtg-black text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mtg-blue"
              value={commanderId}
              onChange={e => setCommanderId(e.target.value)}
              disabled={commanderOptions.length === 0}
            >
              <option value="">-- Select a Commander --</option>
              {commanderOptions.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {commanderOptions.length === 0 && (
              <div className="text-red-400 mt-2">No eligible commanders found in this source.</div>
            )}
          </div>
          {/* House Rules toggle, compact, with tooltip */}
          <div className="flex flex-col items-center justify-end min-w-[80px] pb-1">
            <div className="flex flex-row items-center">
              <label htmlFor="house-rules-toggle" className="text-slate-200 text-xs font-semibold mb-1">House Rules</label>
              <span
                ref={houseRulesIconRef}
                className="ml-1 cursor-pointer relative"
                tabIndex={0}
                aria-label="House Rules Info"
                onClick={e => {
                  e.stopPropagation();
                  setShowHouseRulesTooltip(v => {
                    if (!v && houseRulesIconRef.current) {
                      const rect = houseRulesIconRef.current.getBoundingClientRect();
                      setHouseRulesTooltipPos({ left: rect.right + 8, top: rect.top });
                    }
                    return !v;
                  });
                }}
              >
                <svg width="14" height="14" fill="currentColor" className="inline text-mtg-blue align-text-bottom"><circle cx="7" cy="7" r="7" /><text x="7" y="10" textAnchor="middle" fontSize="8" fill="white">?</text></svg>
              </span>
            </div>
            <input
              id="house-rules-toggle"
              type="checkbox"
              checked={houseRules}
              onChange={e => setHouseRules(e.target.checked)}
              className="form-checkbox h-5 w-5 text-mtg-blue border-slate-600 focus:ring-mtg-blue"
              style={{ marginTop: 0 }}
            />
            {showHouseRulesTooltip && houseRulesTooltipPos && typeof window !== 'undefined' && (
              ReactDOM.createPortal(
                (() => {
                  // Responsive tooltip positioning
                  const vw = window.innerWidth;
                  const maxWidth = Math.min(320, vw - 32); // 320px or 32px margin
                  let left = houseRulesTooltipPos.left;
                  if (left + maxWidth > vw) {
                    left = vw - maxWidth - 16; // 16px margin from right
                  }
                  return (
                    <div
                      ref={houseRulesTooltipRef}
                      className="fixed bg-mtg-black text-rarity-rare text-xs rounded shadow-lg p-2 z-50"
                      style={{ left, top: houseRulesTooltipPos.top, maxWidth: maxWidth, width: '90vw', pointerEvents: 'auto', backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.92)" }}
                      onClick={e => { e.stopPropagation(); setShowHouseRulesTooltip(false); }}
                      onMouseDown={e => e.stopPropagation()}
                      onTouchStart={e => { e.stopPropagation(); setShowHouseRulesTooltip(false); }}
                    >
                      When enabled, House Rules will restrict bracket selection and ban Sol Ring, nonland tutors, and some 'unfun' cards like Armageddon, Winter Orb, and Stasis.
                    </div>
                  );
                })(),
                document.body
              )
            )}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 pb-4 items-start">
          <div className="flex-1 min-w-[260px] flex flex-col gap-4">
            <div className="flex flex-row items-center gap-4 mb-2">
              <BracketPicker
                value={bracket}
                onChange={setBracket}
                className="mb-0"
                onlyButtons
                disabledBrackets={houseRules ? [2, 3, 4, 5] : []}
              />
              <div className="flex flex-col items-center min-w-[140px] relative group" style={{ flex: 1 }}>
                <label htmlFor="salt-slider" className="block text-mtg-white font-semibold mb-1 text-center">Salt
                  <span
                    ref={saltIconRef}
                    className="ml-1 cursor-pointer relative"
                    onClick={e => {
                      e.stopPropagation();
                      setShowSaltTooltip(v => {
                        if (!v && saltIconRef.current) {
                          const rect = saltIconRef.current.getBoundingClientRect();
                          setSaltTooltipPos({ left: rect.right + 8, top: rect.top });
                        }
                        return !v;
                      });
                    }}
                  >
                    <svg width="16" height="16" fill="currentColor" className="inline text-mtg-blue align-text-bottom"><circle cx="8" cy="8" r="8" /><text x="8" y="12" textAnchor="middle" fontSize="10" fill="white">?</text></svg>
                  </span>
                </label>
                {showSaltTooltip && saltTooltipPos && typeof window !== 'undefined' && (
                  ReactDOM.createPortal(
                    (() => {
                      // Responsive tooltip positioning
                      const vw = window.innerWidth;
                      const maxWidth = Math.min(360, vw - 32); // 360px or 32px margin
                      let left = saltTooltipPos.left;
                      if (left + maxWidth > vw) {
                        left = vw - maxWidth - 16; // 16px margin from right
                      }
                      return (
                        <div
                          ref={saltTooltipRef}
                          className="fixed bg-mtg-black text-rarity-rare text-xs rounded shadow-lg p-2 z-50"
                          style={{ left, top: saltTooltipPos.top, maxWidth: maxWidth, width: '95vw', pointerEvents: 'auto', backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.92)" }}
                          onClick={e => { e.stopPropagation(); setShowSaltTooltip(false); }}
                          onTouchStart={e => { e.stopPropagation(); setShowSaltTooltip(false); }}
                        >
                          Salt threshold: <b>{saltThreshold}</b> (0 = strictest, 15 = allow all salty cards)<br />
                          The weighted salt score is calculated by multiplying a card's salt score by a sum of year-based weights, where each year included gets a weight of 1.0 minus 0.1 for each year older than the newest. This gives more weight to recent years and less to older ones. Higher values allow more salty cards.<br />
                          <a href="https://edhrec.com/top/salt" target="_blank" rel="noopener noreferrer" className="text-mtg-blue underline">See saltiest cards on EDHREC</a>
                        </div>
                      );
                    })(),
                    document.body
                  )
                )}
                <input
                  id="salt-slider"
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={saltThreshold}
                  onChange={e => setSaltThreshold(Number(e.target.value))}
                  disabled={loadingProp || loading}
                  className="w-full accent-mtg-blue"
                  style={{ width: '100%' }}
                />
                <div className="flex justify-between w-full text-xs text-slate-400 mb-1">
                  <span>0</span>
                  <span>15</span>
                </div>
                <div className="text-xs text-slate-400 text-center">{saltThreshold}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-4">
                <button
                  type="button"
                  className="btn-primary grow rounded-md px-4 py-2 font-semibold transition-all flex items-center justify-center"
                  onClick={handleGenerateDeck}
                  disabled={loadingProp || loading || !commanderId}
                >
                  {loadingProp || loading ? 'Generating...' : 'Generate Deck'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm px-2 py-1 rounded-md border transition-all grow basis-1/4 w-full font-semibold"
                  style={{ minWidth: 0, fontWeight: 500 }}
                  onClick={handleGameChangersToggle}
                  disabled={loadingProp || loading}
                >
                  {gameChangersOpen ? 'Exile Game Changers' : 'Summon Game Changers'}
                </button>
              </div>
            </div>
          </div>
        </div>
        {deckgenLoading && (
          <DeckGenerationProgress
            currentStep={currentStep}
            debugMessages={debugMessages}
            stepDetails={stepDetails}
            manaTheme={undefined}
          />
        )}
      </div>
    </div>
  );
}