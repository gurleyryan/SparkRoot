
import React, { useEffect, useState, useMemo } from "react";
import { useCollectionStore } from "@/store/collectionStore";
import { ApiClient } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts';


interface TrendPoint {
  date: string;
  total_value: number;
}

type Breakdown = Record<string, number>;


export default function PricingDashboard() {
  const { activeCollection } = useCollectionStore();
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [breakdownByRarity, setBreakdownByRarity] = useState<Breakdown>({});
  const [breakdownBySet, setBreakdownBySet] = useState<Breakdown>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced analytics state
  const [activeTab, setActiveTab] = useState<'trends' | 'cei' | 'deck' | 'card' | 'collection'>('trends');
  const [cei, setCei] = useState<any[]>([]);
  const [deckCostToWin, setDeckCostToWin] = useState<any[]>([]);
  const [investmentWatch, setInvestmentWatch] = useState<any[]>([]);
  const [roi, setRoi] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    async function fetchTrends() {
      if (!activeCollection) return;
      setLoading(true);
      setError(null);
      try {
        const apiClient = new ApiClient();
        // Use the correct method name for collection trends
        const res: any = await apiClient.getCollectionValue(activeCollection.cards as unknown as Record<string, unknown>[]);
        if (!res.success) throw new Error(res.error || 'Failed to fetch trends');
        setTrend(res.trend || []);
        setBreakdownByRarity(res.breakdown_by_rarity || {});
        setBreakdownBySet(res.breakdown_by_set || {});
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch pricing trends');
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, [activeCollection]);

  // Fetch advanced analytics
  useEffect(() => {
    async function fetchAnalytics() {
      setAnalyticsLoading(true);
      try {
        const [ceiRes, deckRes, investRes] = await Promise.all([
          api.getCardEfficiencyIndex(),
          api.getDeckCostToWin(),
          api.getInvestmentWatch(),
        ]);
        setCei(ceiRes.data || []);
        setDeckCostToWin(deckRes.data || []);
        setInvestmentWatch(investRes.data || []);
        // ROI: only if collection loaded
        if (activeCollection) {
          const roiRes = await api.getCollectionROI(activeCollection);
          setRoi(roiRes.data || null);
        } else {
          setRoi(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    }
    fetchAnalytics();
  }, [activeCollection, api]);

  return (
    <div className="sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
      <div className="container mx-auto w-full shadow-md px-0 sm:px-0 py-0 flex flex-col">
        <div className="flex flex-row flex-wrap items-start justify-between mb-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-3xl font-mtg pt-4 pb-4 text-rarity-rare">Pricing Dashboard</h2>
            <div className="flex flex-col min-w-[180px] px-4">
              {!activeCollection && !error && (
                <div className="text-rarity-common">No collection selected.</div>
              )}
              <div className="h-6 flex items-center">
                {error
                  ? <div className="text-mtg-red">{error}</div>
                  : (loading || analyticsLoading) && (
                    <div className="text-mtg-blue">Loading pricing data...</div>
                  )
                }
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-4 items-center flex-wrap max-w-full">
            <button className={activeTab === 'trends' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('trends')}>Trends</button>
            <button className={activeTab === 'cei' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('cei')}>Card Efficiency Index</button>
            <button className={activeTab === 'deck' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('deck')}>Deck Price-performance</button>
            <button className={activeTab === 'card' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('card')}>Card Price</button>
            <button className={activeTab === 'collection' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('collection')}>Collection Price</button>
          </div>
        </div>

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <>
            {trend.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-mtg text-mtg-white mb-2">Collection Value Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="#a3e3fa" fontSize={12} />
                    <YAxis stroke="#a3e3fa" fontSize={12} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="total_value" stroke="#38bdf8" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {Object.keys(breakdownByRarity).length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-mtg text-mtg-white mb-2">Value Breakdown by Rarity</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Object.entries(breakdownByRarity).map(([rarity, value]) => ({ rarity, value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rarity" stroke="#a3e3fa" fontSize={12} />
                    <YAxis stroke="#a3e3fa" fontSize={12} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="value" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {Object.keys(breakdownBySet).length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-mtg text-mtg-white mb-2">Value Breakdown by Set</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Object.entries(breakdownBySet).map(([set, value]) => ({ set, value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="set" stroke="#a3e3fa" fontSize={12} />
                    <YAxis stroke="#a3e3fa" fontSize={12} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="value" fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Card Efficiency Index Tab */}
        {activeTab === 'cei' && (
          <div>
            <h3 className="text-xl font-bold mb-4 text-mtg-white">Card Efficiency Index (CEI)</h3>
            <table className="min-w-full bg-slate-900/80 rounded-xl">
              <thead>
                <tr className="text-mtg-blue">
                  <th className="px-4 py-2">Card</th>
                  <th className="px-4 py-2">Decks</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">CEI</th>
                </tr>
              </thead>
              <tbody>
                {cei.map((row, i) => (
                  <tr key={i} className="text-mtg-white hover:bg-mtg-blue/10">
                    <td className="px-4 py-2">{row.card_name}</td>
                    <td className="px-4 py-2">{row.decks}</td>
                    <td className="px-4 py-2">${row.price}</td>
                    <td className="px-4 py-2 font-bold">{row.cei}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Deck Price-performance Tab */}
        {activeTab === 'deck' && (
          <div>
            <h3 className="text-xl font-bold mb-4 text-mtg-white">Deck Price-performance</h3>
            <table className="min-w-full bg-slate-900/80 rounded-xl">
              <thead>
                <tr className="text-mtg-blue">
                  <th className="px-4 py-2">Deck</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Wins</th>
                  <th className="px-4 py-2">Cost-to-Win</th>
                </tr>
              </thead>
              <tbody>
                {deckCostToWin.map((row, i) => (
                  <tr key={i} className="text-mtg-white hover:bg-mtg-blue/10">
                    <td className="px-4 py-2">{row.deck_name}</td>
                    <td className="px-4 py-2">${row.price}</td>
                    <td className="px-4 py-2">{row.wins}</td>
                    <td className="px-4 py-2 font-bold">{row.cost_to_win}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Card Price Tab */}
        {activeTab === 'card' && (
          <div>
            <h3 className="text-xl font-bold mb-4 text-mtg-white">Card Price (Volatility/Spikes)</h3>
            <table className="min-w-full bg-slate-900/80 rounded-xl">
              <thead>
                <tr className="text-mtg-blue">
                  <th className="px-4 py-2">Card</th>
                  <th className="px-4 py-2">Volatility</th>
                  <th className="px-4 py-2">Recent Spike</th>
                  <th className="px-4 py-2">Price History</th>
                </tr>
              </thead>
              <tbody>
                {investmentWatch.map((row, i) => (
                  <tr key={i} className="text-mtg-white hover:bg-mtg-blue/10">
                    <td className="px-4 py-2">{row.card_name}</td>
                    <td className="px-4 py-2">{(row.volatility * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2">{row.recent_spike ? <span className="text-rarity-mythic font-bold">Yes</span> : 'No'}</td>
                    <td className="px-4 py-2">{row.price_history?.join(' → ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Collection Price Tab */}
        {activeTab === 'collection' && roi && (
          <div>
            <h3 className="text-xl font-bold mb-4 text-mtg-white">Collection Price</h3>
            <div className="mb-4 text-mtg-white">
              <div>Total Spent: <span className="font-bold text-rarity-uncommon">${roi.total_spent}</span></div>
              <div>Current Value: <span className="font-bold text-rarity-rare">${roi.current_value}</span></div>
              <div>ROI: <span className={`font-bold ${roi.roi_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>{roi.roi_percent}%</span></div>
            </div>
            <table className="min-w-full bg-slate-900/80 rounded-xl">
              <thead>
                <tr className="text-mtg-blue">
                  <th className="px-4 py-2">Card</th>
                  <th className="px-4 py-2">Purchase Price</th>
                  <th className="px-4 py-2">Current Price</th>
                  <th className="px-4 py-2">Gain</th>
                  <th className="px-4 py-2">ROI %</th>
                </tr>
              </thead>
              <tbody>
                {roi.cards.map((row: any, i: number) => (
                  <tr key={i} className="text-mtg-white hover:bg-mtg-blue/10">
                    <td className="px-4 py-2">{row.card_name}</td>
                    <td className="px-4 py-2">${row.purchase_price}</td>
                    <td className="px-4 py-2">${row.current_price}</td>
                    <td className={`px-4 py-2 ${row.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.gain}</td>
                    <td className={`px-4 py-2 ${row.roi_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.roi_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
