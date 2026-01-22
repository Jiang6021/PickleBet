import { User, Match, Bet, MatchStatus, Prediction, MarketType, Market } from '../types';
import { INITIAL_BALANCE, ADMIN_USERNAME } from '../constants';
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  runTransaction, 
  get, 
  child,
  Database
} from 'firebase/database';

// --- Firebase Configuration ---
// TODO: Replace with your actual Firebase Project Config
const firebaseConfig = {
  apiKey: "AIzaSyBPXQ0T2696ATTnxiJ1Ol0mBQ-d56xSVBg",
  authDomain: "picklebet-ec307.firebaseapp.com",
  databaseURL: "https://picklebet-ec307-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "picklebet-ec307",
  storageBucket: "picklebet-ec307.firebasestorage.app",
  messagingSenderId: "739745045296",
  appId: "1:739745045296:web:f709f28469ed45a89f06f5"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

class FirebaseDatabaseService {
  private db: Database;
  // Local cache for synchronous read access (needed for odds calc loops)
  private localUsers: User[] = [];
  private localMatches: Match[] = [];
  private localBets: Bet[] = [];
  
  private onDataUpdate: (() => void) | null = null;
  private unsubscribeFunctions: (() => void)[] = [];

  constructor() {
    this.db = rtdb;
  }

  // --- Connection & Listeners ---

  /**
   * Subscribes to Firebase nodes and updates local cache.
   * Calls the callback whenever data changes.
   */
  connect(callback: () => void) {
    this.onDataUpdate = callback;

    // Listen for Users
    const usersRef = ref(this.db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      this.localUsers = data ? Object.values(data) : [];
      this.notifyUpdate();
    });

    // Listen for Matches
    const matchesRef = ref(this.db, 'matches');
    const unsubMatches = onValue(matchesRef, (snapshot) => {
      const data = snapshot.val();
      this.localMatches = data ? Object.values(data) : [];
      this.notifyUpdate();
    });

    // Listen for Bets
    const betsRef = ref(this.db, 'bets');
    const unsubBets = onValue(betsRef, (snapshot) => {
      const data = snapshot.val();
      this.localBets = data ? Object.values(data) : [];
      this.notifyUpdate();
    });

    this.unsubscribeFunctions = [unsubUsers, unsubMatches, unsubBets];
  }

  disconnect() {
    this.unsubscribeFunctions.forEach(fn => fn());
    this.unsubscribeFunctions = [];
  }

  private notifyUpdate() {
    if (this.onDataUpdate) {
      this.onDataUpdate();
    }
  }

  // --- User Logic ---

  async login(name: string): Promise<User> {
    // Check local cache first (optimistic), but verify with DB
    // Since users are keyed by ID usually, but here we only have Name input.
    // We need to find if name exists.
    
    // We'll trust local cache for the find to be fast, 
    // but in a real app you'd query the DB.
    const existing = this.localUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
    
    if (existing) {
      return existing;
    }

    // Create new user
    const newId = crypto.randomUUID();
    const newUser: User = {
      id: newId,
      name: name,
      balance: INITIAL_BALANCE,
      isAdmin: name === ADMIN_USERNAME,
      bankruptCount: 0,
    };

    // Save to Firebase
    await set(ref(this.db, `users/${newId}`), newUser);
    return newUser;
  }

  getUser(id: string): User | undefined {
    return this.localUsers.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return [...this.localUsers].sort((a, b) => b.balance - a.balance);
  }

  async resetUserBalance(userId: string) {
    const userRef = ref(this.db, `users/${userId}`);
    await runTransaction(userRef, (currentUser) => {
      if (currentUser) {
        currentUser.balance = INITIAL_BALANCE;
        currentUser.bankruptCount = (currentUser.bankruptCount || 0) + 1;
      }
      return currentUser;
    });
  }

  // --- Match Logic ---

  async createMatch(court: string, teamA: [string, string], teamB: [string, string], sideBets: string[]) {
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

    const matchId = crypto.randomUUID();
    const newMatch: Match = {
      id: matchId,
      court,
      teamA,
      teamB,
      status: MatchStatus.OPEN,
      markets,
      timestamp: Date.now()
    };

    await set(ref(this.db, `matches/${matchId}`), newMatch);
  }

  async updateMatchStatus(matchId: string, status: MatchStatus) {
    await update(ref(this.db, `matches/${matchId}`), { status });
  }

  getMatches(): Match[] {
    return [...this.localMatches].sort((a, b) => b.timestamp - a.timestamp);
  }

  // --- Betting Logic ---

  async placeBet(userId: string, matchId: string, marketIndex: number, selection: Prediction, amount: number) {
    const match = this.localMatches.find(m => m.id === matchId);
    
    if (!match) throw new Error("Match not found");
    if (match.status !== MatchStatus.OPEN) throw new Error("Betting is closed");
    
    // Prevent players from betting on their own match
    const allPlayers = [...match.teamA, ...match.teamB];
    // Find user name from local cache
    const user = this.localUsers.find(u => u.id === userId);
    if (user && allPlayers.includes(user.name)) {
        throw new Error("Players cannot bet on their own match!");
    }

    const userRef = ref(this.db, `users/${userId}`);

    // 1. Transaction to deduct balance (Atomic)
    await runTransaction(userRef, (currentUser) => {
      if (!currentUser) return; // Should not happen
      if (currentUser.balance < amount) {
        throw new Error("Insufficient funds"); // This aborts the transaction
      }
      currentUser.balance -= amount;
      return currentUser;
    });

    // 2. If successful, push the bet
    const betId = crypto.randomUUID();
    const newBet: Bet = {
      id: betId,
      userId,
      matchId,
      marketIndex,
      selection,
      amount,
      timestamp: Date.now()
    };

    await set(ref(this.db, `bets/${betId}`), newBet);
  }

  getBetsForMatch(matchId: string): Bet[] {
    return this.localBets.filter(b => b.matchId === matchId);
  }

  // --- Settlement Logic (Parimutuel) ---

  async resolveMatch(matchId: string, marketResults: { [index: number]: Prediction }) {
    const match = this.localMatches.find(m => m.id === matchId);
    if (!match || match.status === MatchStatus.FINISHED) return;

    const updates: any = {};
    
    // 1. Update Match Status and Results
    updates[`matches/${matchId}/status`] = MatchStatus.FINISHED;
    Object.entries(marketResults).forEach(([idxStr, result]) => {
        updates[`matches/${matchId}/markets/${idxStr}/result`] = result;
    });

    // 2. Calculate Payouts locally, then prepare updates for users
    // Note: In a production app with thousands of users, this should be a Cloud Function.
    // For this app, client-side calculation is acceptable but risky if the client disconnects mid-update.
    // We will build one giant update object to try and be atomic.

    // Snapshot of current bets
    const allBetsForMatch = this.localBets.filter(b => b.matchId === matchId);
    
    // Map to track user balance changes
    const userPayouts: Record<string, number> = {};

    match.markets.forEach((market, index) => {
      const winner = marketResults[index];
      if (!winner) return;

      const marketBets = allBetsForMatch.filter(b => b.marketIndex === index);
      const totalPool = marketBets.reduce((sum, b) => sum + b.amount, 0);
      const winningBets = marketBets.filter(b => b.selection === winner);
      const winningPool = winningBets.reduce((sum, b) => sum + b.amount, 0);

      let finalOdds = 1.0;
      if (winningPool > 0) {
        finalOdds = totalPool / winningPool;
      }

      // Distribute winnings or Refund
      if (winningPool === 0 && totalPool > 0) {
          // Refund
          marketBets.forEach(bet => {
            userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + bet.amount;
          });
      } else {
          // Payout
          winningBets.forEach(bet => {
            const payout = Math.floor(bet.amount * finalOdds);
            userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
          });
      }
    });

    // We can't use atomic `update` easily for user balances because `balance` changes rapidly.
    // However, to be safe, we should read the *latest* balances or use transaction for each user.
    // Given the constraints, we will perform individual transactions for each winning user.
    // This is slower but safer than `update` which might overwrite a bet that happened 1ms ago.
    
    // Execute Match Update first
    await update(ref(this.db), updates);

    // Execute User Payouts (Async parallel)
    const payoutPromises = Object.entries(userPayouts).map(([userId, amount]) => {
        const userRef = ref(this.db, `users/${userId}`);
        return runTransaction(userRef, (user) => {
            if (user) {
                user.balance += amount;
            }
            return user;
        });
    });

    await Promise.all(payoutPromises);
  }
  
  // Helper to calculate current odds for display (Synchronous using cache)
  calculateProjectedOdds(matchId: string, marketIndex: number): { [key: string]: number } {
     const bets = this.localBets.filter(b => b.matchId === matchId && b.marketIndex === marketIndex);
     const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
     
     if (totalPool === 0) return { }; 

     const selectionPools: Record<string, number> = {};
     bets.forEach(b => {
         selectionPools[b.selection] = (selectionPools[b.selection] || 0) + b.amount;
     });

     const odds: Record<string, number> = {};
     Object.keys(selectionPools).forEach(key => {
         const pool = selectionPools[key];
         odds[key] = pool > 0 ? (totalPool / pool) : 1;
     });
     
     return odds;
  }
  
  getPoolStats(matchId: string, marketIndex: number) {
      const bets = this.localBets.filter(b => b.matchId === matchId && b.marketIndex === marketIndex);
      const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
      const counts: Record<string, number> = {};
      bets.forEach(b => {
          counts[b.selection] = (counts[b.selection] || 0) + 1;
      });
      return { totalPool, counts };
  }
}

export const db = new FirebaseDatabaseService();
