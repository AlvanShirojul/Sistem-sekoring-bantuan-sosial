export const API_BASE = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  return fetch(url, options);
}

export default apiFetch;
