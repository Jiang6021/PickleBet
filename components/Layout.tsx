import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  userBalance?: number;
  userName?: string;
  onLogout: () => void;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, userBalance, userName, onLogout, title }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-900 pb-20 md:pb-0">
      <header className="sticky top-0 z-50 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-lime-400 rounded-full flex items-center justify-center font-bold text-slate-900">
                P
             </div>
             <h1 className="text-xl font-bold bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
               PickleBet
             </h1>
             {title && <span className="text-slate-400 hidden sm:inline">| {title}</span>}
          </div>
          
          {userName && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400">{userName}</span>
                <span className="font-mono font-bold text-lime-400">
                  ${userBalance?.toLocaleString() ?? 0}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
};
