export enum MatchStatus {
  OPEN = 'OPEN',     // Betting is open
  LOCKED = 'LOCKED', // Match is live, betting closed
  FINISHED = 'FINISHED' // Match ended, payouts distributed
}

export enum MarketType {
  WINNER = 'WINNER',
  SIDE_BET = 'SIDE_BET'
}

export enum Prediction {
  TEAM_A = 'TEAM_A',
  TEAM_B = 'TEAM_B',
  YES = 'YES',
  NO = 'NO'
}

export interface User {
  id: string;
  name: string;
  balance: number;
  isAdmin: boolean;
  bankruptCount: number; // How many times they went bust
}

export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  marketIndex: number; // 0 for main, 1+ for side bets
  selection: Prediction;
  amount: number;
  timestamp: number;
}

export interface Market {
  question: string;
  type: MarketType;
  options: [Prediction, Prediction]; // e.g. [TEAM_A, TEAM_B] or [YES, NO]
  result?: Prediction; // Set when match finishes
}

export interface Match {
  id: string;
  court: string; // "Court 1" or "Court 2"
  teamA: [string, string]; // Player names
  teamB: [string, string];
  status: MatchStatus;
  markets: Market[];
  winner?: Prediction; // Redundant convenience for main market, but strictly stored in markets[0]
  timestamp: number;
}

// For calculating odds display
export interface OddsDisplay {
  option1Ratio: number; // e.g., 2.5
  option2Ratio: number; // e.g., 1.5
  totalPool: number;
}
