import React, { useState, useEffect } from 'react';
import { User, Match, MatchStatus, Prediction, MarketType } from '../types';
import { db } from '../services/database';
import { COURTS, DEMO_PLAYERS, SIDE_BET_QUESTIONS } from '../constants';

interface AdminPanelProps {
  user: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'users'>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Create Match State
  const [court, setCourt] = useState(COURTS[0]);
  const [p1, setP1] = useState(DEMO_PLAYERS[0]);
  const [p2, setP2] = useState(DEMO_PLAYERS[1]);
  const [p3, setP3] = useState(DEMO_PLAYERS[2]);
  const [p4, setP4] = useState(DEMO_PLAYERS[3]);
  const [selectedSideBets, setSelectedSideBets] = useState<string[]>([]);

  // Resolution State
  const [resolvingMatch, setResolvingMatch] = useState<Match | null>(null);
  const [resolutionValues, setResolutionValues] = useState<{[key: number]: Prediction}>({});
  const [isConfirming, setIsConfirming] = useState(false); // New state for 2-step confirmation

  // Force Update Logic
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    const loadData = () => {
      setMatches(db.getMatches());
      setUsers(db.getAllUsers());
    };
    
    loadData();
    db.addEventListener('update', loadData);
    return () => db.removeEventListener('update', loadData);
  }, []);

  const handleCreateMatch = () => {
    const teamA: [string, string] = [p1, p2];
    const teamB: [string, string] = [p3, p4];
    
    // Validate unique players
    const all = new Set([p1, p2, p3, p4]);
    if (all.size !== 4) {
      alert("請選擇 4 位不同的玩家");
      return;
    }

    db.createMatch(court, teamA, teamB, selectedSideBets);
    // Reset selection slightly for convenience
    setSelectedSideBets([]);
    refresh();
  };

  const handleStatusChange = (id: string, status: MatchStatus) => {
    db.updateMatchStatus(id, status);
  };

  const startResolve = (match: Match) => {
      setResolvingMatch(match);
      setResolutionValues({});
      setIsConfirming(false);
  };

  const cancelResolve = () => {
      setResolvingMatch(null);
      setResolutionValues({});
      setIsConfirming(false);
  };

  const handlePredictionSelect = (marketIdx: number, value: Prediction) => {
      setResolutionValues(prev => ({ ...prev, [marketIdx]: value }));
      setIsConfirming(false); // Reset confirmation if user changes a value
  };

  const submitResolution = () => {
      if (!resolvingMatch) return;
      
      const totalMarkets = resolvingMatch.markets.length;
      const selectedCount = Object.keys(resolutionValues).length;

      // Validation
      if (selectedCount !== totalMarkets) {
          alert(`您還有選項未完成！(${selectedCount}/${totalMarkets})\n請為每一個盤口選擇獲勝結果。`);
          return;
      }

      // Step 1: Request Confirmation
      if (!isConfirming) {
          setIsConfirming(true);
          return;
      }

      // Step 2: Execute
      try {
        db.resolveMatch(resolvingMatch.id, resolutionValues);
        setResolvingMatch(null);
        setResolutionValues({});
        setIsConfirming(false);
      } catch (e) {
        alert("結算失敗: " + e);
        setIsConfirming(false);
      }
  };

  const handleResetUser = (userId: string) => {
      if (window.confirm("確定執行破產重置？這會將其餘額設為 1000。")) {
          db.resetUserBalance(userId);
      }
  };

  const toggleSideBet = (q: string) => {
      if (selectedSideBets.includes(q)) {
          setSelectedSideBets(selectedSideBets.filter(s => s !== q));
      } else {
          setSelectedSideBets([...selectedSideBets, q]);
      }
  };

  const getOptionLabel = (opt: Prediction) => {
      if (opt === Prediction.TEAM_A) return 'Team A';
      if (opt === Prediction.TEAM_B) return 'Team B';
      if (opt === Prediction.YES) return 'Yes';
      if (opt === Prediction.NO) return 'No';
      return opt;
  };

  const selectedCount = resolvingMatch ? Object.keys(resolutionValues).length : 0;
  const totalMarkets = resolvingMatch ? resolvingMatch.markets.length : 0;
  const isComplete = selectedCount === totalMarkets && totalMarkets > 0;

  return (
    <div className="space-y-8 relative">
      {/* Resolution Modal */}
      {resolvingMatch && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-700 bg-slate-900 shrink-0 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-white">輸入賽果</h3>
                        <p className="text-xs text-slate-400">{resolvingMatch.court}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-mono font-bold ${isComplete ? 'text-lime-400' : 'text-amber-400'}`}>
                            {selectedCount} / {totalMarkets}
                        </span>
                      </div>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto">
                      {resolvingMatch.markets.map((market, idx) => (
                          <div key={idx} className="space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                              <p className="text-sm font-medium text-slate-300 mb-2">
                                <span className="text-lime-500/50 mr-2">Q{idx+1}.</span>
                                {market.question}
                              </p>
                              <div className="flex gap-2">
                                  {market.options.map(opt => (
                                      <button
                                          key={opt}
                                          type="button"
                                          onClick={() => handlePredictionSelect(idx, opt)}
                                          className={`flex-1 py-3 rounded border font-bold transition-all ${
                                              resolutionValues[idx] === opt
                                                  ? 'bg-lime-500 border-lime-500 text-slate-900 shadow-[0_0_15px_rgba(132,204,22,0.3)]'
                                                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                                          }`}
                                      >
                                          {getOptionLabel(opt)}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-4 bg-slate-900 border-t border-slate-700 flex gap-4 shrink-0">
                      <button type="button" onClick={cancelResolve} className="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">
                        取消
                      </button>
                      
                      <button 
                        type="button"
                        onClick={submitResolution} 
                        className={`flex-1 py-3 rounded-lg font-bold transition-all shadow-lg ${
                            !isComplete
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : isConfirming
                                    ? 'bg-red-500 text-white hover:bg-red-600 hover:scale-[1.02] animate-pulse'
                                    : 'bg-lime-500 text-slate-900 hover:bg-lime-400 hover:scale-[1.02]'
                        }`}
                      >
                          {!isComplete ? '尚未完成' : isConfirming ? '確定要結算嗎？(點擊執行)' : '確認並結算'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex gap-4 border-b border-slate-700">
        <button 
            type="button"
            onClick={() => setActiveTab('matches')} 
            className={`pb-2 px-4 ${activeTab === 'matches' ? 'text-lime-400 border-b-2 border-lime-400' : 'text-slate-400'}`}
        >
            比賽管理
        </button>
        <button 
            type="button"
            onClick={() => setActiveTab('users')} 
            className={`pb-2 px-4 ${activeTab === 'users' ? 'text-lime-400 border-b-2 border-lime-400' : 'text-slate-400'}`}
        >
            玩家監控
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-8">
            {/* Create Match */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">建立新比賽</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">場地</label>
                        <select value={court} onChange={e => setCourt(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                            {COURTS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Team A - P1</label>
                            <select value={p1} onChange={e => setP1(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                                {DEMO_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Team A - P2</label>
                            <select value={p2} onChange={e => setP2(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                                {DEMO_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="block text-xs text-slate-400 mb-1">Team B - P3</label>
                            <select value={p3} onChange={e => setP3(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                                {DEMO_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Team B - P4</label>
                            <select value={p4} onChange={e => setP4(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                                {DEMO_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="mb-4">
                     <label className="block text-xs text-slate-400 mb-2">事件盤 (Side Bets)</label>
                     <div className="flex flex-wrap gap-2">
                        {SIDE_BET_QUESTIONS.map(template => (
                            <button 
                                key={template.id}
                                type="button"
                                onClick={() => toggleSideBet(template.question)}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedSideBets.includes(template.question) ? 'bg-lime-500/20 border-lime-500 text-lime-400' : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                            >
                                {template.question}
                            </button>
                        ))}
                     </div>
                </div>

                <button type="button" onClick={handleCreateMatch} className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 rounded-lg transition-colors">
                    發布比賽
                </button>
            </div>

            {/* Match List */}
            <div className="space-y-4">
                {matches.map(m => (
                    <div key={m.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="text-xs text-slate-400 mb-1">{m.court} • {new Date(m.timestamp).toLocaleTimeString()}</div>
                            <div className="font-bold text-white">{m.teamA.join('/')} vs {m.teamB.join('/')}</div>
                            <div className="text-xs text-slate-500 mt-1">Markets: {m.markets.length}</div>
                        </div>
                        <div className="flex gap-2">
                             {m.status === MatchStatus.OPEN && (
                                 <button type="button" onClick={() => handleStatusChange(m.id, MatchStatus.LOCKED)} className="px-3 py-1 bg-amber-500 text-slate-900 rounded text-sm font-bold hover:bg-amber-400 transition-colors">鎖盤 (開賽)</button>
                             )}
                             {m.status === MatchStatus.LOCKED && (
                                 <button type="button" onClick={() => startResolve(m)} className="px-3 py-1 bg-red-500 text-white rounded text-sm font-bold hover:bg-red-400 transition-colors">輸入賽果</button>
                             )}
                             {m.status === MatchStatus.FINISHED && (
                                 <span className="text-slate-500 text-sm font-mono px-3">已結算</span>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'users' && (
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-800 text-slate-200 uppercase font-mono">
                      <tr>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Balance</th>
                          <th className="px-4 py-3">Busts</th>
                          <th className="px-4 py-3">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                      {users.filter(u => !u.isAdmin).map(u => (
                          <tr key={u.id} className={u.balance === 0 ? 'bg-red-900/10' : ''}>
                              <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                              <td className="px-4 py-3 font-mono">${u.balance}</td>
                              <td className="px-4 py-3">{u.bankruptCount}</td>
                              <td className="px-4 py-3">
                                  {u.balance === 0 && (
                                      <button 
                                        type="button"
                                        onClick={() => handleResetUser(u.id)}
                                        className="text-xs bg-lime-500/10 text-lime-400 border border-lime-500/50 px-2 py-1 rounded hover:bg-lime-500/20 transition-colors"
                                      >
                                          懲罰並重置
                                      </button>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};