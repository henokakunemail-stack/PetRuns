export interface AdminSession {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
  };
}

const STORAGE_KEY = 'petwalk_admin_session';

/** localStorage saja cukup untuk MVP internal tool — lihat catatan di README admin-dashboard. */
export function saveSession(session: AdminSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAdmin(session: AdminSession | null): boolean {
  return !!session?.user.roles.includes('ADMIN');
}
