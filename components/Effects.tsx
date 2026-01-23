import React, { useEffect, useState } from 'react';

// --- Coin Rain Effect ---
export const CoinRain: React.FC = () => {
  const [coins, setCoins] = useState<number[]>([]);

  useEffect(() => {
    // Generate 30 coins with random properties
    const newCoins = Array.from({ length: 30 }, (_, i) => i);
    setCoins(newCoins);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {coins.map((i) => {
        const left = Math.random() * 100; // 0-100%
        const delay = Math.random() * 2; // 0-2s delay
        const duration = 2 + Math.random() * 2; // 2-4s duration
        const size = 20 + Math.random() * 20; // 20-40px

        return (
          <div
            key={i}
            className="absolute top-0 animate-fall flex items-center justify-center rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-lg text-yellow-800 font-bold"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              fontSize: `${size * 0.6}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          >
            $
          </div>
        );
      })}
    </div>
  );
};

// --- Match Start / Locked Alert ---
export const MatchStartAlert: React.FC = () => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300 rounded-xl">
            <div className="text-center transform animate-in zoom-in duration-300">
                <div className="text-6xl mb-2">🔒</div>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                    GAME ON!
                </h2>
                <p className="text-red-400 font-mono font-bold mt-2 text-lg">投注截止</p>
            </div>
        </div>
    );
};