/**
 * Cookie-based Session ViewState Utility
 * Provides helpers to read and write session cookies (no Max-Age/Expires)
 */

export interface SessionViewState {
  activeTab?: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users';
  projectsSearch?: string;
  projectsStatusFilter?: string;
  selectedHealthProject?: string;
  healthSimStatus?: string;
  healthSimUptime?: number;
}

const COOKIE_NAME = 'gs_orch_viewstate';

export function getSessionViewState(): SessionViewState {
  if (typeof document === 'undefined') {
    return {};
  }

  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split('=');
      if (name === COOKIE_NAME) {
        const value = rest.join('=');
        if (value) {
          return JSON.parse(decodeURIComponent(value)) as SessionViewState;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse session viewstate cookie:', err);
  }

  return {};
}

export function saveSessionViewState(state: Partial<SessionViewState>): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    const current = getSessionViewState();
    const updated = { ...current, ...state };
    const serialized = encodeURIComponent(JSON.stringify(updated));
    // Set as session cookie (no Expires or Max-Age attribute) with Path=/ and SameSite=Lax
    document.cookie = `${COOKIE_NAME}=${serialized}; Path=/; SameSite=Lax`;
  } catch (err) {
    console.warn('Failed to save session viewstate cookie:', err);
  }
}
