/**
 * GitHub Sync Service for Mellifluous
 * Provides 100% free, permanent data persistence directly to the GitHub repository.
 * Eliminates reliance on Firestore quota limits and guarantees data consistency across all devices.
 */

import { Story, Chapter, Announcement, ReaderLetter } from '../types';

export interface GithubConfig {
  repo: string; // e.g. "maianhpham927-glitch/mellifluous"
  branch: string; // e.g. "main"
  token: string; // Personal Access Token (classic or fine-grained with contents:write)
  autoSync: boolean; // Auto commit on author publish
  lastSyncTime?: string;
}

const STORAGE_CONFIG_KEY = 'mel_github_config_v1';
const DEFAULT_REPO = 'maianhpham927-glitch/mellifluous';
const DEFAULT_BRANCH = 'main';

export const getGithubConfig = (): GithubConfig => {
  if (typeof window === 'undefined') {
    return {
      repo: DEFAULT_REPO,
      branch: DEFAULT_BRANCH,
      token: '',
      autoSync: true,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        repo: parsed.repo || DEFAULT_REPO,
        branch: parsed.branch || DEFAULT_BRANCH,
        token: parsed.token || localStorage.getItem('mel_github_token') || '',
        autoSync: parsed.autoSync !== false,
        lastSyncTime: parsed.lastSyncTime,
      };
    }
  } catch {}

  const token = localStorage.getItem('mel_github_token') || '';
  return {
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    token,
    autoSync: true,
  };
};

export const saveGithubConfig = (config: Partial<GithubConfig>): GithubConfig => {
  const current = getGithubConfig();
  const updated: GithubConfig = {
    ...current,
    ...config,
    repo: (config.repo || current.repo || DEFAULT_REPO).trim(),
    branch: (config.branch || current.branch || DEFAULT_BRANCH).trim(),
    token: config.token !== undefined ? config.token.trim() : current.token,
  };

  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(updated));
    if (updated.token) {
      localStorage.setItem('mel_github_token', updated.token);
    } else {
      localStorage.removeItem('mel_github_token');
    }
  } catch {}

  return updated;
};

/**
 * UTF-8 safe base64 encoding for GitHub Contents API
 */
function utf8ToBase64(str: string): string {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch {
    return window.btoa(str);
  }
}

/**
 * UTF-8 safe base64 decoding
 */
function base64ToUtf8(b64: string): string {
  try {
    return decodeURIComponent(escape(window.atob(b64.replace(/\s/g, ''))));
  } catch {
    return window.atob(b64);
  }
}

/**
 * Fetch raw JSON file from GitHub.
 * Works publicly without any token or quota limits!
 */
export async function fetchRawGithubJson<T>(filename: string): Promise<T | null> {
  const config = getGithubConfig();
  const repo = config.repo || DEFAULT_REPO;
  const branch = config.branch || DEFAULT_BRANCH;

  // Add cache buster to guarantee freshest data on every fetch
  const cacheBuster = Date.now();
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/data/${filename}?_t=${cacheBuster}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data as T;
    }
  } catch (err) {
    console.warn(`[GitHubSync] Could not fetch raw ${filename} from GitHub:`, err);
  }

  // Fallback 1: Local /data/ in deployed build
  try {
    const isGhActions = typeof window !== 'undefined' && window.location.pathname.includes('/mellifluous/');
    const localBasePath = isGhActions ? '/mellifluous/data/' : '/data/';
    const localRes = await fetch(`${localBasePath}${filename}?_t=${cacheBuster}`);
    if (localRes.ok) {
      return await localRes.json();
    }
  } catch {}

  return null;
}

/**
 * Commit a data file directly to GitHub using GitHub REST API
 */
export async function commitGithubDataFile(
  filename: string,
  content: any,
  commitMessage?: string
): Promise<{ success: boolean; commitUrl?: string; error?: string }> {
  const config = getGithubConfig();
  if (!config.token) {
    return {
      success: false,
      error: 'Chưa cấu hình GitHub Token. Vui lòng nhập Personal Access Token trong tab "Lưu trữ & Đồng bộ".',
    };
  }

  const repo = config.repo || DEFAULT_REPO;
  const branch = config.branch || DEFAULT_BRANCH;
  const path = `data/${filename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  try {
    // 1. Get existing file SHA if it exists
    let existingSha: string | undefined = undefined;
    try {
      const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        existingSha = fileInfo.sha;
      }
    } catch {}

    // 2. Prepare payload
    const jsonString = JSON.stringify(content, null, 2);
    const base64Content = utf8ToBase64(jsonString);

    const payload: any = {
      message: commitMessage || `Cập nhật ${filename} từ Mellifluous Studio [skip ci]`,
      content: base64Content,
      branch: branch,
    };

    if (existingSha) {
      payload.sha = existingSha;
    }

    // 3. Send PUT request
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putRes.ok) {
      const errorJson = await putRes.json().catch(() => ({}));
      const errorMsg = errorJson.message || `Lỗi GitHub API: HTTP ${putRes.status}`;
      return {
        success: false,
        error: errorMsg,
      };
    }

    const result = await putRes.json();
    saveGithubConfig({ lastSyncTime: new Date().toISOString() });

    return {
      success: true,
      commitUrl: result.commit?.html_url,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Không thể kết nối tới GitHub API',
    };
  }
}

/**
 * Test GitHub connection and token permissions
 */
export async function testGithubConnection(): Promise<{
  success: boolean;
  username?: string;
  repoName?: string;
  canWrite?: boolean;
  message: string;
}> {
  const config = getGithubConfig();
  if (!config.token) {
    return {
      success: false,
      message: 'Chưa có GitHub Token',
    };
  }

  try {
    // 1. Check user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      if (userRes.status === 401) {
        return {
          success: false,
          message: 'GitHub Token không hợp lệ hoặc đã hết hạn (401 Unauthorized)',
        };
      }
      return {
        success: false,
        message: `Lỗi xác thực người dùng GitHub (${userRes.status})`,
      };
    }

    const userData = await userRes.json();
    const username = userData.login;

    // 2. Check repo access
    const repoRes = await fetch(`https://api.github.com/repos/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!repoRes.ok) {
      return {
        success: false,
        username,
        message: `Không tìm thấy hoặc không có quyền truy cập repository: ${config.repo}`,
      };
    }

    const repoData = await repoRes.json();
    const canWrite = repoData.permissions?.push !== false;

    return {
      success: true,
      username,
      repoName: repoData.full_name,
      canWrite,
      message: canWrite
        ? `Đã kết nối thành công với kho lưu trữ ${repoData.full_name} (@${username})`
        : `Đã kết nối nhưng tài khoản @${username} chỉ có quyền đọc (Read-only)`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kết nối mạng tới GitHub: ${err?.message || err}`,
    };
  }
}
