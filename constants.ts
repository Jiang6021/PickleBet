export const INITIAL_BALANCE = 1000;
export const ADMIN_USERNAME = 'admin';

export const COURTS = ['Court 1', 'Court 2'];

export interface SideBetTemplate {
  id: string;
  question: string;
}

export const SIDE_BET_QUESTIONS: SideBetTemplate[] = [
  { id: 'sb1', question: '這場總分會超過 15 分嗎？' },
  { id: 'sb2', question: '這場會出現 Deuce (平局決勝) 嗎？' },
  { id: 'sb3', question: '發球會掛網超過 2 次嗎？' },
  { id: 'sb4', question: '會出現 ATP (Around the Post) 嗎？' },
  { id: 'sb5', question: '會有球員摔拍子嗎？' },
  { id: 'sb6', question: '這場比賽會超過 20 分鐘嗎？' },
];

// Fallback user list for demo purposes if DB is empty
export const DEMO_PLAYERS = [
  'Alex', 'Ben', 'Charlie', 'David', 
  'Eve', 'Frank', 'Grace', 'Hank',
  'Ivy', 'Jack', 'Kevin', 'Lily'
];
