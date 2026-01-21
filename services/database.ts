import { User, Match, Bet, MatchStatus, Prediction, MarketType, Market } from '../types';
import { INITIAL_BALANCE, ADMIN_USERNAME } from '../constants';

// --- Simulation of Firebase Realtime Database using LocalStorage ---

const STORAGE_KEYS = {
  USERS: 'picklebet_users',
  MATCHES: 'picklebet_matches',
  BETS: 'picklebet_bets',
};

class MockDatabase extends EventTarget {
  private users: User[] = [];
  private matches: Match[] = [];
  private bets: Bet[] = [];

  constructor() {
    super();
    this.load();
  }

  private load() {
    const u = localStorage.getItem(STORAGE_KEYS.USERS);
    const m = localStorage.getItem(STORAGE_KEYS.MATCHES);
    const b = localStorage.getItem(STORAGE_KEYS.BETS);

    this.users = u ? JSON.parse(u) : [];
    this.matches = m ? JSON.parse(m) : [];
    this.bets = b ? JSON.parse(b) : [];
  }

  private save() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(this.matches));
    localStorage.setItem(STORAGE_KEYS.BETS, JSON.stringify(this.bets));
    this.dispatchEvent(new CustomEvent('update'));
  }

  // --- User Logic ---

  login(name: string): User {
    const existing = this.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const newUser: User = {
      id: crypto.randomUUID(),
      name: name,
      balance: INITIAL_BALANCE,
      isAdmin: name === ADMIN_USERNAME,
      bankruptCount: 0,
    };
    this.users.push(newUser);
    this.save();
    return newUser;
  }

  getUser(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users].sort((a, b) => b.balance - a.balance);
  }

  resetUserBalance(userId: string) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.balance = INITIAL_BALANCE;
      user.bankruptCount += 1;
      this.save();
    }
  }

  // --- Match Logic ---

  createMatch(court: string, teamA: [string, string], teamB: [string, string], sideBets: string[]) {
    const markets: Market[] = [
      {
        question: '獲勝隊伍 (Winner)',
        type: MarketType.WINNER,
        options: [Prediction.TEAM_A, Prediction.TEAM_B]
      }
    ];

    sideBets.forEach(q => {
      markets.push({
        question: q,
        type: MarketType.SIDE_BET,
        options: [Prediction.YES, Prediction.NO]
      });
    });

    const newMatch: Match = {
      id: crypto.randomUUID(),
      court,
      teamA,
      teamB,
      status: MatchStatus.OPEN,
      markets,
      timestamp: Date.now()
    };

    this.matches.push(newMatch);
    this.save();
  }

  updateMatchStatus(matchId: string, status: MatchStatus) {
    const match = this.matches.find(m => m.id === matchId);
    if (match) {
      match.status = status;
      this.save();
    }
  }

  getMatches(): Match[] {
    return [...this.matches].sort((a, b) => b.timestamp - a.timestamp);
  }

  // --- Betting Logic ---

  placeBet(userId: string, matchId: string, marketIndex: number, selection: Prediction, amount: number) {
    const user = this.users.find(u => u.id === userId);
    const match = this.matches.find(m => m.id === matchId);

    if (!user || !match) throw new Error("Invalid user or match");
    if (user.balance < amount) throw new Error("Insufficient funds");
    if (match.status !== MatchStatus.OPEN) throw new Error("Betting is closed");

    // Prevent players from betting on their own match
    const allPlayers = [...match.teamA, ...match.teamB];
    if (allPlayers.includes(user.name)) {
        throw new Error("Players cannot bet on their own match!");
    }

    user.balance -= amount;

    const newBet: Bet = {
      id: crypto.randomUUID(),
      userId,
      matchId,
      marketIndex,
      selection,
      amount,
      timestamp: Date.now()
    };

    this.bets.push(newBet);
    this.save();
  }

  getBetsForMatch(matchId: string): Bet[] {
    return this.bets.filter(b => b.matchId === matchId);
  }

  // --- Settlement Logic (Parimutuel) ---

  resolveMatch(matchId: string, marketResults: { [index: number]: Prediction }) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match || match.status === MatchStatus.FINISHED) return;

    // Apply results to markets
    Object.entries(marketResults).forEach(([idxStr, result]) => {
      const idx = parseInt(idxStr);
      if (match.markets[idx]) {
        match.markets[idx].result = result;
      }
    });

    match.status = MatchStatus.FINISHED;

    // Calculate Payouts for each market independently
    match.markets.forEach((market, index) => {
      const marketBets = this.bets.filter(b => b.matchId === matchId && b.marketIndex === index);
      const winner = market.result;
      
      if (!winner) return; // Should not happen if admin inputs correctly

      const totalPool = marketBets.reduce((sum, b) => sum + b.amount, 0);
      const winningBets = marketBets.filter(b => b.selection === winner);
      const winningPool = winningBets.reduce((sum, b) => sum + b.amount, 0);

      // Edge Case 1: No Winners -> Refund all (Odds = 1.0)
      // Edge Case 2: One-Sided (Total == Winning) -> No profit (Odds = 1.0)
      let finalOdds = 1.0;
      if (winningPool > 0) {
        // Floor to prevent floating point weirdness and ensure house doesn't lose
        // But here we want standard parimutuel. 
        // Logic: Payout = Bet * (Total / Winning)
        finalOdds = totalPool / winningPool;
      }

      // Distribute winnings
      winningBets.forEach(bet => {
        const payout = Math.floor(bet.amount * finalOdds);
        const user = this.users.find(u => u.id === bet.userId);
        if (user) {
          user.balance += payout;
        }
      });
      
      // If no winners, refund everyone in this market
      if (winningPool === 0 && totalPool > 0) {
          marketBets.forEach(bet => {
            const user = this.users.find(u => u.id === bet.userId);
            if (user) {
                user.balance += bet.amount;
            }
          });
      }
    });

    this.save();
  }
  
  // Helper to calculate current odds for display
  calculateProjectedOdds(matchId: string, marketIndex: number): { [key: string]: number } {
     const bets = this.bets.filter(b => b.matchId === matchId && b.marketIndex === marketIndex);
     const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
     
     if (totalPool === 0) return { }; // No data

     // Group by selection
     const selectionPools: Record<string, number> = {};
     bets.forEach(b => {
         selectionPools[b.selection] = (selectionPools[b.selection] || 0) + b.amount;
     });

     const odds: Record<string, number> = {};
     // Calculate theoretical odds for each potential outcome
     // If I bet on X now, what is the return?
     // Current Return = Total / Pool_of_X
     
     // Note: This is "current" odds. It changes as more people bet.
     Object.keys(selectionPools).forEach(key => {
         const pool = selectionPools[key];
         odds[key] = pool > 0 ? (totalPool / pool) : 1;
     });
     
     return odds;
  }
  
  getPoolStats(matchId: string, marketIndex: number) {
      const bets = this.bets.filter(b => b.matchId === matchId && b.marketIndex === marketIndex);
      const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
      const counts: Record<string, number> = {};
      bets.forEach(b => {
          counts[b.selection] = (counts[b.selection] || 0) + 1;
      });
      return { totalPool, counts };
  }
}

export const db = new MockDatabase();
