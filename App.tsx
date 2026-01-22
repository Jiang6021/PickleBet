import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MatchCard } from './components/MatchCard';
import { AdminPanel } from './components/AdminPanel';
import { Leaderboard } from './components/Leaderboard';
import { db } from './services/database';
import { User, Match, MatchStatus } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<'lobby' | 'leaderboard'>('lobby');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load data periodically or on event
  const refreshData = () => {
    setMatches(db.getMatches());
    setUsers(db.getAllUsers());
    if (user) {
        const updatedUser = db.getUser(user.id);
        if (updatedUser) setUser(updatedUser);
    }
  };

  useEffect(() => {
    // Initialize subscription to Firebase
    db.connect(() => {
        refreshData();
    });

    return () => {
      db.disconnect();
    };
  }, [user?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      setIsLoggingIn(true);
      try {
        const u = await db.login(nickname.trim());
        setUser(u);
      } catch (err) {
        console.error("Login failed", err);
        alert("登入失敗，請稍後再試");
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setNickname('');
    setView('lobby');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-lime-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-black text-slate-900">P</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">PickleBet</h1>
            <p className="text-slate-400">雙打制匹克球場邊運彩系統</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-300 mb-1">
                輸入暱稱開始
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如: PickleKing"
                className="w-full bg-slate-950 border border-slate-600 rounded-lg py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
                autoFocus
                disabled={isLoggingIn}
              />
            </div>
            <button
              type="submit"
              disabled={!nickname.trim() || isLoggingIn}
              className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition-colors text-lg flex justify-center items-center"
            >
              {isLoggingIn ? (
                <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                '進入賽場'
              )}
            </button>
          </form>
          <p className="text-center text-xs text-slate-600 mt-6">
            Admin login: use "admin"
          </p>
        </div>
      </div>
    );
  }

  // Admin View
  if (user.isAdmin) {
    return (
      <Layout userBalance={user.balance} userName={user.name} onLogout={handleLogout} title="Admin">
        <AdminPanel user={user} />
      </Layout>
    );
  }

  // User View
  return (
    <Layout userBalance={user.balance} userName={user.name} onLogout={handleLogout}>
      
      {/* Mobile Bottom Nav Spacer is handled in Layout, here we assume tabs at top for web or content for mobile */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button 
            onClick={() => setView('lobby')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all whitespace-nowrap ${view === 'lobby' ? 'bg-lime-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
        >
            賽事大廳
        </button>
        <button 
            onClick={() => setView('leaderboard')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all whitespace-nowrap ${view === 'leaderboard' ? 'bg-lime-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
        >
            排行榜
        </button>
      </div>

      {view === 'lobby' && (
        <>
            {/* Live/Open Matches First */}
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 ml-1">進行中 / 開放投注</h2>
            {matches.filter(m => m.status !== MatchStatus.FINISHED).length === 0 ? (
                <div className="p-8 text-center text-slate-600 border border-dashed border-slate-700 rounded-xl mb-8">
                    暫無進行中的賽事
                </div>
            ) : (
                matches
                    .filter(m => m.status !== MatchStatus.FINISHED)
                    .map(match => (
                        <MatchCard 
                            key={match.id} 
                            match={match} 
                            currentUser={user} 
                        />
                    ))
            )}

            {/* Finished Matches */}
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 ml-1 mt-8">歷史賽果</h2>
             {matches
                    .filter(m => m.status === MatchStatus.FINISHED)
                    .map(match => (
                        <MatchCard 
                            key={match.id} 
                            match={match} 
                            currentUser={user}
                        />
                    ))
            }
        </>
      )}

      {view === 'leaderboard' && (
        <Leaderboard users={users} currentUser={user} />
      )}

      {/* Bankruptcy Warning */}
      {user.balance === 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-4 z-50 animate-bounce">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <span className="font-bold">😱 破產啦！請找管理員執行深蹲懲罰以重置籌碼。</span>
              </div>
          </div>
      )}
    </Layout>
  );
}

export default App;