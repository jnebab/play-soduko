/** Persistent anonymous identity for arena play (MVP auth). */
export interface Identity {
  id: string;
  handle: string;
}

const KEY = "sudoku.identity";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getIdentity(): Identity {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Identity;
  } catch {
    /* ignore storage errors */
  }
  const identity: Identity = {
    id: randomId(),
    handle: `Player-${Math.floor(1000 + Math.random() * 9000)}`,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* ignore storage errors */
  }
  return identity;
}
