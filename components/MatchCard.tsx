import React, { useState, useEffect } from 'react';
import { Match, MatchStatus, Prediction, User, MarketType } from '../types';
import { db } from '../services/database';

interface MatchCardProps {
  match: Match;
  currentUser: User;
  onBetClick?: () => void; // Trigger refresh
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, currentUser, onBetClick }) => {
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
  const [betAmount, setBetAmount] = useState<string>('');
  const [betError, setBetError] = useState<string | null>(null);
  const [odds, setOdds] = useState<{[key: string]: number}>({});
  const [stats, setStats] = useState<{totalPool: number, counts: any}>({ totalPool: 0, counts: {} });

  // Safety: Check if user is a player
  const allPlayers = [...match.teamA, ...match.teamB];
  const isPlayer = allPlayers.includes(currentUser.name);

  // Update odds/stats periodically or on prop change
  useEffect(() => {
    const updateInfo = () => {
      setOdds(db.calculateProjectedOdds(match.id, selectedMarketIndex));
      setStats(db.getPoolStats(match.id, selectedMarketIndex));
    };
    updateInfo();
    // In a real app, this would be a subscription. 
    // For this mock, we rely on parent re-renders or we could set an interval.
    const interval = setInterval(updateInfo, 2000);
    return () => clearInterval(interval);
  }, [match.id, selectedMarketIndex, match.status]);

  const handlePlaceBet = (selection: Prediction) => {
    setBetError(null);
    const amount = parseInt(betAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setBetError("請輸入有效的金額");
      return;
    }
    
    try {
      db.placeBet(currentUser.id, match.id, selectedMarketIndex, selection, amount);
      setBetAmount('');
      if (onBetClick) onBetClick();
    } catch (e: any) {
      setBetError(e.message);
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
                        <span>Total Pool: ${stats.totalPool}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {currentMarket.options.map((opt) => {
                        const optOdds = odds[opt];
                        const displayOdds = optOdds ? optOdds.toFixed(2) : '-';
                        return (
                            <button
                                key={opt}
                                onClick={() => handlePlaceBet(opt)}
                                disabled={!betAmount}
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

                  <div className="mt-4">
                      <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                          <input
                              type="number"
                              value={betAmount}
                              onChange={(e) => setBetAmount(e.target.value)}
                              placeholder="下注金額 (100, 500...)"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-8 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-lime-500 transition-colors"
                          />
                      </div>
                      {betError && <p className="text-red-400 text-xs mt-2 text-center">{betError}</p>}
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
