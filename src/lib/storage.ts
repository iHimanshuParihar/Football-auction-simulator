import { CareerTrophyRecord, ClubPreset } from '@/types/game';

const TROPHY_KEY = 'ucl_mega_auction_trophies_v2';
const CUSTOM_CLUBS_KEY = 'ucl_mega_auction_custom_clubs_v2';
const MANAGER_PREF_KEY = 'ucl_mega_auction_manager_prefs_v2';

export function loadTrophyCabinet(): CareerTrophyRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TROPHY_KEY);
    return raw ? (JSON.parse(raw) as CareerTrophyRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveTrophyRecord(record: CareerTrophyRecord): CareerTrophyRecord[] {
  const existing = loadTrophyCabinet();
  const next = [record, ...existing].slice(0, 25);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TROPHY_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

export function loadCustomClubs(): ClubPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CLUBS_KEY);
    return raw ? (JSON.parse(raw) as ClubPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomClub(club: ClubPreset): ClubPreset[] {
  const existing = loadCustomClubs().filter((c) => c.id !== club.id);
  const next = [club, ...existing].slice(0, 12);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_CLUBS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export interface ManagerPrefs {
  m1Name: string;
  m2Name: string;
}

export function loadManagerPrefs(): ManagerPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MANAGER_PREF_KEY);
    return raw ? (JSON.parse(raw) as ManagerPrefs) : null;
  } catch {
    return null;
  }
}

export function saveManagerPrefs(prefs: ManagerPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MANAGER_PREF_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
