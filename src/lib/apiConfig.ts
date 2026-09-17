/**
 * Centralized API URL resolver for seamless operation in:
 * 1. AI Studio dev / Cloud Run container (relative /api)
 * 2. GitHub Pages / static hosting with custom backend (VITE_BACKEND_URL or localStorage override)
 */

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';

  // 1. Environment variable if provided
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) || '';
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Custom backend override stored in localStorage if user set it
  try {
    const saved = localStorage.getItem('mel_backend_api_url');
    if (saved && typeof saved === 'string' && saved.startsWith('http')) {
      return saved.replace(/\/+$/, '');
    }
  } catch {}

  // 3. Default: relative path for same-origin proxy (Cloud Run, local dev, custom domain)
  return '';
};

export const buildApiUrl = (path: string): string => {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
