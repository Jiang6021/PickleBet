import React, { useState, useEffect, useCallback } from 'react';
import { Match, MatchStatus, Prediction, User, MarketType } from '../types';
import { db } from '../services/database';

interface MatchCardProps {
  match: Match;
  currentUser: User;
  onBetClick?: () => void; 
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, currentUser }) => {
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
  const [betAmount, setBetAmount] = useState<number>(100); // Default to 1 unit (100)
  const [betError, setBetError] = useState<string | null>(null);
  const [isBetting, setIsBetting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [odds, setOdds] = useState<{[key: string]: number}>({});
  const [stats, setStats] = useState<{totalPool: number, counts: any}>({ totalPool: 0, counts: {} });

  // Safety: Check if user is a player
  const allPlayers = [...match.teamA, ...match.teamB];
  const isPlayer = allPlayers.includes(currentUser.name);

  // Core logic to fetch latest stats from DB cache
  const updateCalculations = useCallback(() => {
    setOdds(db.calculateProjectedOdds(match.id, selectedMarketIndex));
    setStats(db.getPoolStats(match.id, selectedMarketIndex));
  }, [match.id, selectedMarketIndex]);

  // 1. Update when props change
  useEffect(() => {
    updateCalculations();
  }, [updateCalculations, match.status]); 

  // 2. Live Polling: Ensure odds update even if Match object ref doesn't change
  useEffect(() => {
    if (match.status === MatchStatus.OPEN) {
        const interval = setInterval(updateCalculations, 1000);
        return () => clearInterval(interval);
    }
  }, [updateCalculations, match.status]);

  const handleAdjustBet = (delta: number) => {
      const newAmount = betAmount + delta;
      if (newAmount < 100) return;
      if (newAmount > currentUser.balance) return;
      setBetAmount(newAmount);
      setBetError(null);
  };

  const handlePlaceBet = async (selection: Prediction) => {
    setBetError(null);
    const amount = betAmount;
    
    if (amount <= 0 || amount > currentUser.balance) {
      setBetError("餘額不足或金額無效");
      return;
    }

    setIsBetting(true);
    
    try {
      await db.placeBet(currentUser.id, match.id, selectedMarketIndex, selection, amount);
      
      // Success feedback
      const label = selection === Prediction.TEAM_A ? 'Team A' : 
                    selection === Prediction.TEAM_B ? 'Team B' : 
                    selection === Prediction.YES ? 'Yes' : 'No';
      
      setBetAmount(100); // Reset to default unit
      setSuccessMessage(`下注成功！ $${amount} on ${label}`);
      
      // Force immediate update
      setTimeout(updateCalculations, 100);

      // Reset success message
      setTimeout(() => {
          setSuccessMessage(null);
      }, 2000);

    } catch (e: any) {
      setBetError(e.message || "下注失敗，請檢查餘額或連線");
    } finally {
      setIsBetting(false);
    }
  };

  const currentMarket = match.markets[selectedMarketIndex];
  
  // Visual helpers
  const getStatusColor = (s: MatchStatus) => {
    switch (s) {
      case MatchStatus.OPEN: return 'bg-lime-500 text-slate-900 animate-pulse';
      case MatchStatus.LOCKED: return 'bg-amber-500 text-slate-900';
      case MatchStatus.FINISHED: return 'bg-slate-600 text-slate-300';
    }
  };

  const getStatusText = (s: MatchStatus) => {
    switch (s) {
      case MatchStatus.OPEN: return '投注中';
      case MatchStatus.LOCKED: return '比賽中';
      case MatchStatus.FINISHED: return '已結束';
    }
  };

  return (
    <div className={`rounded-xl overflow-hidden border ${match.status === MatchStatus.FINISHED ? 'border-slate-700 bg-slate-800/50 opacity-80' : 'border-slate-600 bg-slate-800'} shadow-xl mb-6 transition-all`}>
      {/* Header */}
      <div className="flex justify-between items-center p-3 bg-slate-700/50 border-b border-slate-700">
        <span className="font-mono text-sm text-slate-400">{match.court}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getStatusColor(match.status)}`}>
          {getStatusText(match.status)}
        </span>
      </div>

      {/* Teams (Main Display) */}
      <div className="p-4 flex justify-between items-center relative">
        <div className="flex-1 text-center">
          <div className="text-2xl font-black text-slate-100">{match.teamA.join(' & ')}</div>
          <div className="text-xs text-lime-400 font-mono mt-1">Team A</div>
          {match.status === MatchStatus.FINISHED && match.markets[0].result === Prediction.TEAM_A && (
            <span className="text-lime-400 font-bold">WINNER</span>
          )}
        </div>
        
        <div className="mx-4 text-slate-500 font-thin text-2xl">VS</div>
        
        <div className="flex-1 text-center">
          <div className="text-2xl font-black text-slate-100">{match.teamB.join(' & ')}</div>
          <div className="text-xs text-indigo-400 font-mono mt-1">Team B</div>
          {match.status === MatchStatus.FINISHED && match.markets[0].result === Prediction.TEAM_B && (
            <span className="text-lime-400 font-bold">WINNER</span>
          )}
        </div>
      </div>

      {/* Betting Section */}
      {match.status === MatchStatus.OPEN && (
        <div className="p-4 bg-slate-900/50 border-t border-slate-700">
            {isPlayer ? (
                <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-center text-red-200">
                    ⚠️ 你是本場比賽的球員，禁止下注。
                </div>
            ) : (
                <>
                  {/* Market Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                    {match.markets.map((m, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedMarketIndex(idx)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          selectedMarketIndex === idx 
                            ? 'bg-slate-200 text-slate-900' 
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {m.type === MarketType.WINNER ? '輸贏盤' : '特別盤'} {m.type === MarketType.SIDE_BET && `#${idx}`}
                      </button>
                    ))}
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-slate-300 mb-2 text-center">{currentMarket.question}</p>
                    <div className="flex justify-center gap-6 text-xs text-slate-400 font-mono mb-2">
                        <span className="transition-all duration-300">Total Pool: <span className="text-white font-bold">${stats.totalPool}</span></span>
                    </div>
                  </div>

                  {/* Odds / Selection Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    {currentMarket.options.map((opt) => {
                        const optOdds = odds[opt];
                        const displayOdds = optOdds ? optOdds.toFixed(2) : '-';
                        return (
                            <button
                                key={opt}
                                onClick={() => handlePlaceBet(opt)}
                                disabled={isBetting || successMessage !== null || betAmount > currentUser.balance}
                                className="group relative flex flex-col items-center p-3 rounded-lg bg-slate-800 border border-slate-600 hover:border-lime-400 hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="font-bold text-lg text-white mb-1">
                                    {opt === Prediction.TEAM_A ? 'Team A' : opt === Prediction.TEAM_B ? 'Team B' : opt === Prediction.YES ? 'Yes' : 'No'}
                                </span>
                                <span className="text-xs text-lime-400 font-mono">
                                    x{displayOdds}
                                </span>
                            </button>
                        )
                    })}
                  </div>

                  {/* Amount Stepper Control */}
                  <div className="mt-4 h-16 relative">
                      {successMessage ? (
                          <div className="absolute inset-0 bg-lime-500 rounded-lg flex items-center justify-center animate-in fade-in zoom-in duration-200">
                              <div className="text-slate-900 font-bold flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                  </svg>
                                  {successMessage}
                              </div>
                          </div>
                      ) : (
                          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-700 h-full">
                              <button
                                  onClick={() => handleAdjustBet(-100)}
                                  disabled={betAmount <= 100 || isBetting}
                                  className="w-12 h-full rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xl transition-colors border border-slate-600 flex items-center justify-center"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                      <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                                  </svg>
                              </button>
                              
                              <div className="flex flex-col items-center flex-1">
                                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Bet Amount</span>
                                  <span className={`text-2xl font-black font-mono tracking-widest ${betAmount > currentUser.balance ? 'text-red-500' : 'text-lime-400'}`}>
                                      ${betAmount}
                                  </span>
                              </div>

                              <button
                                  onClick={() => handleAdjustBet(100)}
                                  disabled={betAmount + 100 > currentUser.balance || isBetting}
                                  className="w-12 h-full rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xl transition-colors border border-slate-600 flex items-center justify-center"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                  </svg>
                              </button>
                          </div>
                      )}
                      {betError && <p className="text-red-400 text-xs mt-1 text-center absolute w-full -bottom-5">{betError}</p>}
                  </div>
                </>
            )}
        </div>
      )}
      
      {/* Result Display for Finished Match */}
      {match.status === MatchStatus.FINISHED && (
          <div className="p-4 bg-slate-900/80 border-t border-slate-700 text-center">
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Results</h4>
              {match.markets.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-slate-800 last:border-0">
                      <span className="text-slate-300 truncate max-w-[70%]">{m.question}</span>
                      <span className="font-bold text-lime-400">
                          {m.result === Prediction.TEAM_A ? 'Team A' : 
                           m.result === Prediction.TEAM_B ? 'Team B' : m.result}
                      </span>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};