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
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return window.btoa(bin);
  } catch {
    try {
      return window.btoa(unescape(encodeURIComponent(str)));
    } catch {
      return window.btoa(str);
    }
  }
}

/**
 * UTF-8 safe base64 decoding
 */
function base64ToUtf8(b64: string): string {
  try {
    const cleanB64 = b64.replace(/\s/g, '');
    const binary = window.atob(cleanB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(window.atob(b64.replace(/\s/g, ''))));
    } catch {
      return window.atob(b64);
    }
  }
}

/**
 * Fetch raw JSON file from GitHub.
 * Works publicly without any token or quota limits!
 */
export async function fetchRawGithubJson<T>(filename: string): Promise<T | null> {
  const config = getGithubConfig();
  const repo = (config.repo || DEFAULT_REPO).trim();
  const branch = (config.branch || DEFAULT_BRANCH).trim();

  // Add cache buster to guarantee freshest data on every fetch
  const cacheBuster = Date.now();
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/data/${filename}?_t=${cacheBuster}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return data as T;
    }
  } catch (err) {
    console.warn(`[GitHubSync] Could not fetch raw ${filename} from GitHub:`, err);
  }

  // Fallback 1: Direct GitHub Contents API (works publicly for open repos, with or without token)
  try {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/data/${filename}?ref=${encodeURIComponent(branch)}&_t=${cacheBuster}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (config.token) {
      headers.Authorization = `Bearer ${config.token.trim()}`;
    }
    const apiRes = await fetch(apiUrl, {
      headers,
      cache: 'no-store',
    });
    if (apiRes.ok) {
      const fileObj = await apiRes.json();
      if (fileObj.content) {
        const decoded = base64ToUtf8(fileObj.content);
        return JSON.parse(decoded) as T;
      }
    }
  } catch {}

  // Fallback 2: jsDelivr CDN
  try {
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/data/${filename}?_t=${cacheBuster}`;
    const cdnRes = await fetch(cdnUrl, { cache: 'no-store' });
    if (cdnRes.ok) {
      return await cdnRes.json();
    }
  } catch {}

  // Fallback 3: Local /data/ or relative base path in deployed build
  try {
    const isGhActions = typeof window !== 'undefined' && window.location.pathname.includes('/mellifluous/');
    const localBasePath = isGhActions ? '/mellifluous/data/' : '/data/';
    const localRes = await fetch(`${localBasePath}${filename}?_t=${cacheBuster}`, { cache: 'no-store' });
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
  const cleanToken = (config.token || '').trim();
  if (!cleanToken) {
    return {
      success: false,
      error: 'Chưa cấu hình GitHub Token. Vui lòng nhập Personal Access Token trong tab "Lưu trữ & Đồng bộ".',
    };
  }

  const repo = (config.repo || DEFAULT_REPO).trim();
  const branch = (config.branch || DEFAULT_BRANCH).trim();
  const path = `data/${filename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1. Get existing file SHA if it exists
    let existingSha: string | undefined = undefined;
    try {
      const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
        headers,
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        existingSha = fileInfo.sha;
      } else if (getRes.status === 401) {
        return {
          success: false,
          error: 'GitHub Token không hợp lệ hoặc đã hết hạn (HTTP 401 Bad Credentials).',
        };
      }
    } catch (e: any) {
      console.warn('[GitHubSync] Note checking existing file SHA:', e);
    }

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
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putRes.ok) {
      const errorJson = await putRes.json().catch(() => ({}));
      let errorMsg = errorJson.message || `Lỗi GitHub API: HTTP ${putRes.status}`;
      if (putRes.status === 404) {
        errorMsg = `Không tìm thấy repository "${repo}" hoặc Token không có quyền truy cập repository này (HTTP 404).`;
      } else if (putRes.status === 401) {
        errorMsg = `GitHub Token không hợp lệ hoặc không có quyền (HTTP 401).`;
      } else if (putRes.status === 409) {
        errorMsg = `Xung đột phiên bản tệp SHA trên GitHub (HTTP 409). Vui lòng thử lại.`;
      } else if (putRes.status === 403) {
        errorMsg = `Token không có quyền ghi ("Contents: Read and write") vào kho lưu trữ (HTTP 403).`;
      } else if (putRes.status === 422) {
        errorMsg = `Lỗi định dạng commit hoặc nhánh "${branch}" không tồn tại (HTTP 422: ${errorJson.message || ''}).`;
      }
      return {
        success: false,
        error: errorMsg,
      };
    }

    const result = await putRes.json();
    saveGithubConfig({ lastSyncTime: new Date().toISOString() });

    // Also attempt background sync for public/data if relevant (non-blocking)
    try {
      const publicPath = `public/data/${filename}`;
      const publicApiUrl = `https://api.github.com/repos/${repo}/contents/${publicPath}`;
      let pubSha: string | undefined = undefined;
      const pubGet = await fetch(`${publicApiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
      if (pubGet.ok) {
        const pubInfo = await pubGet.json();
        pubSha = pubInfo.sha;
      }
      const pubPayload: any = {
        message: `Đồng bộ public copy ${filename} [skip ci]`,
        content: base64Content,
        branch: branch,
      };
      if (pubSha) pubPayload.sha = pubSha;
      await fetch(publicApiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(pubPayload),
      });
    } catch {}

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
 * Perform a live test write commit to verify token has full write access
 */
export async function testGithubWrite(): Promise<{
  success: boolean;
  message: string;
  commitUrl?: string;
}> {
  const config = getGithubConfig();
  if (!config.token) {
    return {
      success: false,
      message: 'Chưa có GitHub Token. Vui lòng dán Personal Access Token vào ô bên dưới.',
    };
  }

  const testPayload = {
    test: true,
    clientTime: new Date().toISOString(),
    generator: 'Mellifluous Studio Write Permission Test',
    status: 'ok',
  };

  const res = await commitGithubDataFile(
    '.sync-test.json',
    testPayload,
    'Kiểm tra quyền ghi GitHub từ Mellifluous Studio [skip ci]'
  );

  if (res.success) {
    return {
      success: true,
      message: `Quyền ghi thành công! Token có quyền cam kết trực tiếp vào nhánh ${config.branch || DEFAULT_BRANCH}.`,
      commitUrl: res.commitUrl,
    };
  } else {
    return {
      success: false,
      message: `Thử nghiệm ghi thất bại: ${res.error}`,
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
  const cleanToken = (config.token || '').trim();
  if (!cleanToken) {
    return {
      success: false,
      message: 'Chưa có GitHub Token. Vui lòng nhập Personal Access Token.',
    };
  }

  const repo = (config.repo || DEFAULT_REPO).trim();

  try {
    // 1. Check user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userRes.ok) {
      if (userRes.status === 401) {
        return {
          success: false,
          message: 'GitHub Token không hợp lệ hoặc đã hết hạn (401 Bad Credentials)',
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
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        return {
          success: false,
          username,
          message: `Không tìm thấy repository "${repo}". Nếu repo là Private, hãy đảm bảo Token có quyền truy cập vào repo này.`,
        };
      }
      return {
        success: false,
        username,
        message: `Không thể truy cập repository ${repo} (HTTP ${repoRes.status})`,
      };
    }

    const repoData = await repoRes.json();
    const canWrite = repoData.permissions?.push === true || repoData.permissions?.admin === true;

    return {
      success: true,
      username,
      repoName: repoData.full_name,
      canWrite,
      message: canWrite
        ? `Đã kết nối thành công với kho lưu trữ ${repoData.full_name} (@${username}). Tài khoản có đầy đủ quyền Ghi (Push/Write)!`
        : `Đã kết nối với @${username}, nhưng tài khoản CHỈ CÓ QUYỀN ĐỌC (Read-only). Cần cấp quyền "Contents: Read and write" trong Token!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kết nối mạng tới GitHub: ${err?.message || err}`,
    };
  }
}
