import React from 'react';
import { User } from '../types';

interface LeaderboardProps {
  users: User[];
  currentUser?: User;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ users, currentUser }) => {
  // Filter out admin, sort by balance desc
  const rankedUsers = users
    .filter(u => !u.isAdmin)
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
                <span className="text-yellow-400">🏆</span> 排行榜
            </h3>
            <span className="text-xs text-slate-400">Live Updates</span>
        </div>
        
        <div className="divide-y divide-slate-700/50">
            {rankedUsers.map((user, idx) => {
                const isMe = currentUser?.id === user.id;
                let rankDisplay = (idx + 1).toString();
                let icon = '';
                if (idx === 0) icon = '👑';
                else if (idx === 1) icon = '🥈';
                else if (idx === 2) icon = '🥉';

                return (
                    <div key={user.id} className={`flex items-center justify-between p-4 ${isMe ? 'bg-lime-500/10' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-8 text-center font-black text-slate-500 text-lg">
                                {icon || rankDisplay}
                            </div>
                            <div>
                                <div className={`font-bold ${isMe ? 'text-lime-400' : 'text-slate-200'}`}>
                                    {user.name} {isMe && '(Me)'}
                                </div>
                                {user.bankruptCount > 0 && (
                                    <div className="text-[10px] text-red-400">已破產 {user.bankruptCount} 次</div>
                                )}
                            </div>
                        </div>
                        <div className="font-mono text-lg font-bold text-slate-100">
                            ${user.balance.toLocaleString()}
                        </div>
                    </div>
                );
            })}
            
            {rankedUsers.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                    尚無玩家資料
                </div>
            )}
        </div>
    </div>
  );
};
