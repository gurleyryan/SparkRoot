import React, { useState, useMemo } from 'react';
import { useToast } from './ToastProvider';
import BracketPicker from '@/components/BracketPicker';
import { ApiClient } from '@/lib/api';
import type { MTGCard } from '@/types/index';
import { useCollectionStore } from '@/store/collectionStore';
import ReactDOM from "react-dom";
import DeckGenerationProgress from "./DeckGenerationProgress";

export interface DeckBuilderProps {
  onDeckGenerated: (cards: MTGCard[]) => void;
  onShowGameChangers: () => void;
  onHideGameChangers?: () => void;
  loading?: boolean;
}

export default function DeckBuilder({ onDeckGenerated, onShowGameChangers, onHideGameChangers, loading: loadingProp }: DeckBuilderProps) {
  // Track if Game Changers is open (for toggle button label and behavior)
  const [gameChangersOpen, setGameChangersOpen] = useState(false);
  const showToast = useToast();
  const [bracket, setBracket] = useState(1); // Default to 1 for House Rules
  // State and setter for house rules tooltip visibility
  const [showHouseRulesTooltip, setShowHouseRulesTooltip] = useState(false);
  const [showSaltTooltip, setShowSaltTooltip] = useState(false);
  const houseRulesIconRef = React.useRef<HTMLSpanElement>(null);
  const saltIconRef = React.useRef<HTMLSpanElement>(null);
  const houseRulesTooltipRef = React.useRef<HTMLDivElement>(null);
  const saltTooltipRef = React.useRef<HTMLDivElement>(null);

  // Close tooltips on outside click/tap (for mobile)
  

  const [houseRulesTooltipPos, setHouseRulesTooltipPos] = useState<{left: number, top: number} | null>(null);
  const [saltTooltipPos, setSaltTooltipPos] = useState<{left: number, top: number} | null>(null);
  const [commanderId, setCommanderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [houseRules, setHouseRules] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [deckgenLoading, setDeckgenLoading] = useState(false);
  const [stepDetails, setStepDetails] = useState<Record<string, string>>({});
  // Salt threshold slider: 0 (no salty cards) to 15 (allow all salty cards)
  const [saltThreshold, setSaltThreshold] = useState(15);
  const [deck, setDeck] = useState<MTGCard[]>([]);
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
  function groupDeckCards(cards: MTGCard[]): Array<MTGCard & { quantity: number }> {
    const map = new Map<string, { card: MTGCard; quantity: number }>();
    for (const card of cards) {
      // Use id as key (unique printing/art)
      const key = card.id || card.name;
      if (map.has(key)) {
        map.get(key)!.quantity += 1;
      } else {
        map.set(key, { card, quantity: 1 });
      }
    }
    // For Commander, always show quantity 1 (even if duplicated)
    // For basics, show actual quantity per unique printing
    return Array.from(map.values()).map(({ card, quantity }) => {
      const isBasic = card.type_line && card.type_line.toLowerCase().includes('basic land');
      return { ...card, quantity: isBasic ? quantity : 1 };
    });
  }

  const handleGenerateDeck = async () => {
    setDeckgenLoading(true);
    setCurrentStep(0);
    setDebugMessages([]);
    setLoading(true);
    setError('');
    try {
      const apiClient = new ApiClient();
      const result: unknown = await apiClient.generateDeck(
        cardSource as unknown as Record<string, unknown>[],
        commanderId,
        bracket,
        houseRules,
        saltThreshold
      );
      // Animate deckgen_steps progress using mapStepLogs
      if (result && Array.isArray((result as any).deckgen_steps)) {
        const backendSteps = (result as any).deckgen_steps; // array of debug strings
        setDebugMessages(backendSteps); // Pass full array to DeckGenerationProgress
        setStepDetails({});
        // Animate currentStep through major steps
        const frontendSteps = [
          "filter", "theme", "categorize", "lands", "curve", "rocks", "categories", "final"
        ];
        let i = 0;
        function animateStep() {
          if (i < frontendSteps.length) {
            setCurrentStep(i);
            i++;
            setTimeout(animateStep, 700);
          }
        }
        animateStep();
      }
      if (
        result &&
        typeof result === 'object' &&
        ('success' in result || 'deck' in result)

      ) {
        // If the API returns a full deck object with analysis, pass it up
        if ((result as any).deck && (result as any).analysis) {
          const deckObj = (result as any).deck;
          const commander = (result as any).commander;
          let cards: MTGCard[] = [];
          if (deckObj && Array.isArray(deckObj.deck)) {
            cards = deckObj.deck as MTGCard[];
          }
          if (commander) {
            cards = [commander, ...cards];
          }
          // Group and count for deck display
          const grouped = groupDeckCards(cards);
          const fullDeck = {
            ...deckObj,
            commander,
            analysis: (result as any).analysis,
            cards: grouped,
          };
          setDeck(grouped);
          onDeckGenerated(fullDeck);
          showToast('Deck generated successfully!', 'success');
          return;
        }
        // Fallback: just pass the cards array
        const deckObj = (result as any).deck;
        let deckCards: MTGCard[] = [];
        if (deckObj && Array.isArray(deckObj.deck)) {
          deckCards = deckObj.deck as MTGCard[];
        }
        const commander = (result as any).commander;
        if (commander) {
          deckCards = [commander, ...deckCards];
        }
        const grouped = groupDeckCards(deckCards);
        setDeck(grouped);
        onDeckGenerated(grouped);
        showToast('Deck generated successfully!', 'success');
      } else if (
        result &&
        typeof result === 'object' &&
        ('error' in result || 'message' in result)
      ) {
        const msg = ((result as { error?: string; message?: string }).error ||
          (result as { error?: string; message?: string }).message) ||
          'Failed to generate deck';
        setError(msg);
        showToast(msg, 'error');
      } else {
        setError('Failed to generate deck');
        showToast('Failed to generate deck', 'error');
      }
    } catch (err: unknown) {
      let msg = 'Failed to generate deck';
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
        msg = (err as { message: string }).message || msg;
      }
      setError(msg);
      showToast(msg, 'error');
      // If deckgen_steps are present, animate progress
      // Move this logic inside the try block where 'result' is defined
    } finally {
      setDeckgenLoading(false);
      setLoading(false);
    }
  };

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
                <svg width="14" height="14" fill="currentColor" className="inline text-mtg-blue align-text-bottom"><circle cx="7" cy="7" r="7"/><text x="7" y="10" textAnchor="middle" fontSize="8" fill="white">?</text></svg>
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
                      <svg width="16" height="16" fill="currentColor" className="inline text-mtg-blue align-text-bottom"><circle cx="8" cy="8" r="8"/><text x="8" y="12" textAnchor="middle" fontSize="10" fill="white">?</text></svg>
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
                            Salt threshold: <b>{saltThreshold}</b> (0 = strictest, 15 = allow all salty cards)<br/>
                            The weighted salt score is calculated by multiplying a card's salt score by a sum of year-based weights, where each year included gets a weight of 1.0 minus 0.1 for each year older than the newest. This gives more weight to recent years and less to older ones. Higher values allow more salty cards.<br/>
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
