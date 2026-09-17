import {
  db,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  increment,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  arrayUnion,
  arrayRemove,
  isFirestoreQuotaExhausted,
} from './firebase';
import { GlobalRealtimeStats, StoryRealtimeStats, RealtimeComment, Story, Chapter, Announcement, ReaderLetter, CommentReply, CollaboratorItem, UserProfile } from '../types';
export type { ReaderLetter, RealtimeComment, CommentReply, GlobalRealtimeStats, StoryRealtimeStats, CollaboratorItem, UserProfile };
import {
  STORIES,
  SAMPLE_CHAPTERS,
  ANNOUNCEMENTS,
  saveCustomChapterToStorage,
  deleteCustomChapterFromStorage,
  getStoredCustomChapters,
  getStoryChapters,
  setLiveChaptersRuntimeCache,
  setLiveStoryChapters,
  getLiveChaptersRuntimeCache,
  isStoryDeleted,
  recordStoryDeleted,
} from '../data/mockData';
import { buildApiUrl, hasBackendServer, safeApiFetch } from './apiConfig';
import { bgmEngine } from '../utils/audioPlayer';
import { updateGenresFromRemote } from '../utils/genreManager';
import { getGithubConfig, commitGithubDataFile, fetchRawGithubJson } from './githubSyncService';

/**
 * Recursively removes all keys with `undefined` value from objects/arrays,
 * as Firestore strictly disallows `undefined` in documents and array elements.
 */
export const sanitizeForFirestore = <T>(data: T): T => {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    if (data instanceof Date) return data;
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
};

/**
 * Safe fetch with guaranteed AbortController timeout to prevent hanging UI requests
 */
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window undefined'));
  }
  // Guard against 404s when running on static hosts (e.g. GitHub Pages) without a backend server
  if (url.startsWith('/api') || url.includes('/api/')) {
    if (!hasBackendServer()) {
      return Promise.reject(new Error('No backend server configured for static hosting'));
    }
    url = buildApiUrl(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Executes a Promise with a strict timeout fallback to avoid indefinite hangs
 */
export const withTimeout = <T>(promise: Promise<T>, timeoutMs = 3500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)),
  ]);
};

// --- Firestore Quota Breaker ---
// If Firestore hits daily quota (RESOURCE_EXHAUSTED), prevent hanging and fall back instantly to Server REST + SSE
let isFirestoreQuotaBlocked = false;
let quotaBlockedUntil = 0;

export const checkIsFirestoreBlocked = (): boolean => {
  if (isFirestoreQuotaExhausted()) {
    return true;
  }
  if (isFirestoreQuotaBlocked && Date.now() < quotaBlockedUntil) {
    return true;
  }
  isFirestoreQuotaBlocked = false;
  return false;
};

export const flagFirestoreQuotaExceeded = (err?: any) => {
  const msg = err?.message || String(err || '');
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('Quota') ||
    msg.includes('resource-exhausted')
  ) {
    isFirestoreQuotaBlocked = true;
    quotaBlockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes backoff
    console.warn('[Firestore] Quota limit active. Operating seamlessly in Server REST + SSE mode.');
  }
};

/**
 * Parses timestamps safely, properly handling Vietnamese friendly strings like "Vừa đăng" / "Vừa cập nhật"
 */
export const parseSafeTimestamp = (dateStr?: string): number => {
  if (!dateStr) return 0;
  if (dateStr === 'Vừa đăng' || dateStr === 'Vừa cập nhật' || dateStr.includes('Vừa')) {
    return Date.now();
  }
  const parsed = new Date(dateStr).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    const dTime = new Date(`${y}-${m}-${d}`).getTime();
    if (!isNaN(dTime)) return dTime;
  }
  return 0;
};

/**
 * Safely merges two lists of chapters, deduplicating by ID or chapterNumber + partType,
 * ensuring author edits and newly published chapters are preserved.
 */
export const mergeChapters = (base: Chapter[], incoming: Chapter[]): Chapter[] => {
  const map = new Map<string, Chapter>();
  base.forEach((ch) => {
    const key = ch.id || `${ch.storyId}-${ch.partType || (ch.isExtra ? 'extra' : 'main')}-${ch.chapterNumber}`;
    map.set(key, ch);
  });
  incoming.forEach((ch) => {
    const key = ch.id || `${ch.storyId}-${ch.partType || (ch.isExtra ? 'extra' : 'main')}-${ch.chapterNumber}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, ch);
    } else {
      const existingTime = parseSafeTimestamp(existing.updatedAt || existing.publishedAt);
      const incomingTime = parseSafeTimestamp(ch.updatedAt || ch.publishedAt);
      // Incoming takes precedence unless existing is strictly newer and verified
      if (existingTime > incomingTime && incomingTime > 0) {
        map.set(key, { ...ch, ...existing });
      } else {
        map.set(key, { ...existing, ...ch });
      }
    }
  });
  const result = Array.from(map.values());
  result.sort((a, b) => {
    const numA = Number(a.chapterNumber) || 0;
    const numB = Number(b.chapterNumber) || 0;
    if (numA !== numB) return numA - numB;
    const isExtraA = a.isExtra || a.partType === 'extra' ? 1 : 0;
    const isExtraB = b.isExtra || b.partType === 'extra' ? 1 : 0;
    return isExtraA - isExtraB;
  });
  return result;
};

// Active memory listeners for instant UI synchronization
const activeStorySubscribers = new Set<(stories: Story[]) => void>();
const activeAnnouncementSubscribers = new Set<(announcements: Announcement[]) => void>();
const activeChapterSubscribers = new Map<string, Set<(chapters: Chapter[]) => void>>();
const activeAllChaptersSubscribers = new Set<(chaptersMap: Record<string, Chapter[]>) => void>();
const globalStatsListeners = new Set<(stats: GlobalRealtimeStats) => void>();

let cachedGlobalStats: GlobalRealtimeStats = {
  totalVisits: typeof window !== 'undefined' ? Math.max(1, Number(localStorage.getItem('mel_site_visits') || '1')) : 1,
  activeReaders: 1,
  totalFollowers: 0,
  totalComments: 0,
  totalLikes: 0,
};

export const notifyGlobalStatsSubscribers = (partial: Partial<GlobalRealtimeStats>) => {
  cachedGlobalStats = { ...cachedGlobalStats, ...partial };
  globalStatsListeners.forEach((cb) => {
    try {
      cb({ ...cachedGlobalStats });
    } catch (e) {
      console.warn('Global stats subscriber error:', e);
    }
  });
};

const notifyStorySubscribers = (stories: Story[]) => {
  const clean = stories.filter((s) => !isStoryDeleted(s.id));
  activeStorySubscribers.forEach((cb) => {
    try {
      cb(clean);
    } catch (e) {
      console.warn('Story subscriber callback error:', e);
    }
  });
};

const notifyAnnouncementSubscribers = (announcements: Announcement[]) => {
  activeAnnouncementSubscribers.forEach((cb) => {
    try {
      cb(announcements);
    } catch (e) {
      console.warn('Announcement subscriber callback error:', e);
    }
  });
};

const notifyChapterSubscribers = (storyId: string, chapters: Chapter[]) => {
  const cleanChapters = isStoryDeleted(storyId) ? [] : chapters;
  const set = activeChapterSubscribers.get(storyId);
  if (set) {
    set.forEach((cb) => {
      try {
        cb(cleanChapters);
      } catch (e) {
        console.warn('Chapter subscriber callback error:', e);
      }
    });
  }
};

const notifyAllChaptersSubscribers = (chaptersMap: Record<string, Chapter[]>) => {
  const cleanMap: Record<string, Chapter[]> = {};
  for (const [sId, chs] of Object.entries(chaptersMap)) {
    if (!isStoryDeleted(sId)) {
      cleanMap[sId] = chs;
    }
  }
  activeAllChaptersSubscribers.forEach((cb) => {
    try {
      cb(cleanMap);
    } catch (e) {
      console.warn('All chapters subscriber callback error:', e);
    }
  });
};

export const LEGACY_MOCK_STORY_IDS = new Set([
  'anh-dao-5cm',
  'anh-dao-nam-centimet',
  'mua-he-nam-ay',
  'buc-thu-tinh-gui-may-troi',
  'chiec-o-thang-bay',
  'duoi-tan-cay-mua-ha',
]);

// In-memory & local-storage state helpers hoisted for immediate accessibility
export const getStoredStories = (): Story[] => {
  try {
    const raw = localStorage.getItem('mel_published_stories');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((s) => !isStoryDeleted(s.id));
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }
  } catch {}
  return STORIES.filter((s) => !isStoryDeleted(s.id));
};

export const getStoredAnnouncements = (): Announcement[] => {
  try {
    const raw = localStorage.getItem('mel_announcements');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return ANNOUNCEMENTS;
};

export const INITIAL_SAMPLE_LETTERS: ReaderLetter[] = [
  {
    id: 'sample-letter-1',
    sender: 'Hạ Mộc',
    avatar: '🌸',
    content: 'Đọc truyện của Mel từ những ngày đầu bên nhà cũ. Mỗi câu chữ đều dịu dàng như một tách trà mật ong ngày mưa. Chúc Mel luôn an yên và giữ được ngọn lửa đam mê nhé!',
    type: 'public',
    tag: '🌸 Lời chúc & Cảm ơn',
    time: '2 ngày trước',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    likes: 18,
    replyFromMel: 'Cảm ơn Hạ Mộc thật nhiều nha! Những lời động viên của bạn là động lực lớn nhất để Mel tiếp tục dịch thêm nhiều bộ truyện ấm áp.',
    repliedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    repliedBy: 'Mellifluous (Tác giả)',
  },
  {
    id: 'sample-letter-2',
    sender: 'Gió Tháng Bảy',
    avatar: '🍃',
    content: 'Mình cực kỳ thích cách Mel dịch đoạn đối thoại của Thẩm Hoài An và Nhĩ Nguyệt trong bức thư gửi mây trời. Rất mượt mà và xúc động!',
    type: 'public',
    tag: '📖 Đề xuất truyện mới',
    time: '4 ngày trước',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    likes: 12,
    replyFromMel: 'Mel cũng rất thích đoạn ấy, lúc dịch mà cay cay sống mũi luôn á 🌸',
    repliedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    repliedBy: 'Mellifluous (Tác giả)',
  },
  {
    id: 'sample-letter-3',
    sender: 'Trần Thảo Ly',
    avatar: '☕',
    content: 'Thuyền nhỏ ơi, sau những giờ làm căng thẳng được ngả lưng nghe playlist mùa hạ và đọc truyện ở đây thật sự là một niềm hạnh phúc dịu êm.',
    type: 'public',
    tag: '☕ Tâm sự mùa hè',
    time: '5 ngày trước',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    likes: 24,
  },
];

export const activeReaderLetterSubscribers = new Set<(letters: ReaderLetter[]) => void>();

export function getStoredReaderLetters(): ReaderLetter[] {
  try {
    const raw = localStorage.getItem('mel_reader_letters_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_SAMPLE_LETTERS;
}

export function saveStoredReaderLetters(letters: ReaderLetter[]) {
  try {
    localStorage.setItem('mel_reader_letters_cache', JSON.stringify(letters));
  } catch {}
}

export function notifyReaderLetterSubscribers(letters?: ReaderLetter[]) {
  const list = letters || getStoredReaderLetters();
  activeReaderLetterSubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.error(e);
    }
  });
}

// In-memory & local comments manager for 100% resilient cross-device sync
export const activeCommentSubscribers = new Map<string, Set<{
  chapterNumber: number | null;
  callback: (comments: RealtimeComment[]) => void;
}>>();

export function getStoredComments(storyId: string): RealtimeComment[] {
  try {
    const raw = localStorage.getItem(`mel_comments_${storyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredComments(storyId: string, comments: RealtimeComment[]) {
  try {
    localStorage.setItem(`mel_comments_${storyId}`, JSON.stringify(comments));
  } catch {}
}

export function notifyCommentSubscribers(storyId: string, comments?: RealtimeComment[]) {
  const allComments = comments || getStoredComments(storyId);
  const subs = activeCommentSubscribers.get(storyId);
  if (!subs) return;
  subs.forEach(({ chapterNumber, callback }) => {
    try {
      if (chapterNumber !== null && chapterNumber !== undefined) {
        callback(allComments.filter((c) => c.chapterNumber === chapterNumber || !c.chapterNumber));
      } else {
        callback(allComments);
      }
    } catch (e) {
      console.error(e);
    }
  });
}

// Background Server Sync & SSE Listener for 100% Cross-Device Realtime Consistency
let sseInitialized = false;

export const initServerRealtimeSync = () => {
  if (typeof window === 'undefined' || sseInitialized || !hasBackendServer()) return;
  sseInitialized = true;

  // 1. Snapshot fetch from server API with smart merge
  const pullServerSync = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/sync'));
      if (!res.ok) return;
      const data = await res.json();

      // A. Stories
      if (data.stories && Array.isArray(data.stories) && data.stories.length > 0) {
        const current = getStoredStories();
        const currentMap = new Map(current.map((s) => [s.id, s]));
        let updated = false;

        let localDeletedIds = new Set<string>();
        try {
          const rawDel = localStorage.getItem('mel_deleted_story_ids');
          if (rawDel) localDeletedIds = new Set(JSON.parse(rawDel));
        } catch {}

        for (const s of data.stories) {
          if (localDeletedIds.has(s.id)) continue;
          const existing = currentMap.get(s.id);
          if (!existing) {
            currentMap.set(s.id, s);
            updated = true;
          } else {
            const existingTime = parseSafeTimestamp(existing.updatedAt);
            const incomingTime = parseSafeTimestamp(s.updatedAt);
            const isDifferent =
              s.title !== existing.title ||
              s.completedChapters !== existing.completedChapters ||
              s.totalChapters !== existing.totalChapters ||
              s.status !== existing.status ||
              s.coverImage !== existing.coverImage ||
              s.hasPassword !== existing.hasPassword ||
              s.passwordKey !== existing.passwordKey ||
              s.summary !== existing.summary;

            if (incomingTime >= existingTime || isDifferent) {
              currentMap.set(s.id, {
                ...existing,
                ...s,
                views: Math.max(Number(existing.views) || 0, Number(s.views) || 0),
                likes: Math.max(Number(existing.likes) || 0, Number(s.likes) || 0),
                completedChapters: Math.max(Number(existing.completedChapters) || 0, Number(s.completedChapters) || 0),
              });
              updated = true;
            }
          }
        }

        if (updated || current.length === 0) {
          const merged = Array.from(currentMap.values());
          try {
            localStorage.setItem('mel_published_stories', JSON.stringify(merged));
          } catch {}
          notifyStorySubscribers(merged);
        }
      }

      // B. Chapters
      if (data.chapters && typeof data.chapters === 'object') {
        for (const [sId, list] of Object.entries(data.chapters as Record<string, Chapter[]>)) {
          if (Array.isArray(list) && list.length > 0) {
            const currentList = getStoryChapters(sId);
            const merged = mergeChapters(currentList, list);
            try {
              localStorage.setItem(`mel_chapters_${sId}`, JSON.stringify(merged));
            } catch {}
            setLiveStoryChapters(sId, merged);
            notifyChapterSubscribers(sId, merged);
          }
        }
        activeAllChaptersSubscribers.forEach((cb) => {
          try { cb(getLiveChaptersRuntimeCache()); } catch {}
        });
      }

      // C. Announcements
      if (data.announcements && Array.isArray(data.announcements) && data.announcements.length > 0) {
        const currentAnn = getStoredAnnouncements();
        const annMap = new Map(currentAnn.map((a) => [a.id, a]));
        let annChanged = false;
        for (const a of data.announcements) {
          if (!annMap.has(a.id)) {
            annMap.set(a.id, a);
            annChanged = true;
          } else {
            const existing = annMap.get(a.id)!;
            if (
              existing.title !== a.title ||
              existing.content !== a.content ||
              existing.tag !== a.tag ||
              existing.isPinned !== a.isPinned
            ) {
              annMap.set(a.id, a);
              annChanged = true;
            }
          }
        }
        if (annChanged || currentAnn.length === 0) {
          const nextAnn = Array.from(annMap.values());
          try {
            localStorage.setItem('mel_announcements', JSON.stringify(nextAnn));
          } catch {}
          notifyAnnouncementSubscribers(nextAnn);
        }
      }

      // D. Playlist
      if (data.playlist && Array.isArray(data.playlist) && data.playlist.length > 0) {
        bgmEngine.mergeTracks(data.playlist);
      }

      // E. Reader Letters
      if (data.letters && Array.isArray(data.letters) && data.letters.length > 0) {
        const currentLetters = getStoredReaderLetters();
        const letterMap = new Map<string, ReaderLetter>();
        data.letters.forEach((l: ReaderLetter) => letterMap.set(l.id, l));
        currentLetters.forEach((l) => {
          if (!letterMap.has(l.id)) letterMap.set(l.id, l);
        });
        const merged = Array.from(letterMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveStoredReaderLetters(merged);
        notifyReaderLetterSubscribers(merged);
      }

      // F. Comments
      if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
        const byStory = new Map<string, RealtimeComment[]>();
        for (const c of data.comments as RealtimeComment[]) {
          if (!c.storyId) continue;
          if (!byStory.has(c.storyId)) byStory.set(c.storyId, []);
          byStory.get(c.storyId)!.push(c);
        }
        for (const [sId, sComments] of byStory.entries()) {
          const cur = getStoredComments(sId);
          const map = new Map<string, RealtimeComment>();
          sComments.forEach((c) => map.set(c.id, c));
          cur.forEach((c) => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredComments(sId, merged);
          notifyCommentSubscribers(sId, merged);
        }
      }

      // G. Genres
      if (data.genres && Array.isArray(data.genres) && data.genres.length > 0) {
        updateGenresFromRemote(data.genres);
      }
    } catch {
      // Server might be starting or unavailable in pure preview
    }
  };

  pullServerSync();

  // 2. Real-time Server-Sent Events (SSE)
  try {
    const eventSource = new EventSource(buildApiUrl('/api/events'));
    eventSource.onmessage = (e) => {
      try {
        if (!e.data || e.data.startsWith(':')) return;
        const msg = JSON.parse(e.data);
        if (msg.type === 'story_saved') {
          const current = getStoredStories();
          const idx = current.findIndex((s) => s.id === msg.payload.id);
          let nextStories: Story[];
          if (idx >= 0) {
            nextStories = [...current];
            nextStories[idx] = msg.payload;
          } else {
            nextStories = [msg.payload, ...current];
          }
          try {
            localStorage.setItem('mel_published_stories', JSON.stringify(nextStories));
          } catch {}
          notifyStorySubscribers(nextStories);
        } else if (msg.type === 'story_deleted') {
          const current = getStoredStories();
          const nextStories = current.filter((s) => s.id !== msg.payload.id);
          try {
            localStorage.setItem('mel_published_stories', JSON.stringify(nextStories));
            localStorage.removeItem(`mel_chapters_${msg.payload.id}`);
          } catch {}
          setLiveStoryChapters(msg.payload.id, []);
          notifyStorySubscribers(nextStories);
          notifyChapterSubscribers(msg.payload.id, []);
        } else if (msg.type === 'chapter_saved') {
          const ch: Chapter = msg.payload;
          const sId = ch.storyId;
          const currentList = getStoryChapters(sId);
          const cIdx = currentList.findIndex(
            (c) => c.id === ch.id || (c.chapterNumber === ch.chapterNumber && c.partType === ch.partType)
          );
          let nextList: Chapter[];
          if (cIdx >= 0) {
            nextList = [...currentList];
            nextList[cIdx] = ch;
          } else {
            nextList = [...currentList, ch];
          }
          nextList.sort((a, b) => a.chapterNumber - b.chapterNumber);
          try {
            localStorage.setItem(`mel_chapters_${sId}`, JSON.stringify(nextList));
          } catch {}
          setLiveStoryChapters(sId, nextList);
          notifyChapterSubscribers(sId, nextList);
          activeAllChaptersSubscribers.forEach((cb) => {
            try { cb(getLiveChaptersRuntimeCache()); } catch {}
          });
        } else if (msg.type === 'chapter_deleted') {
          const { id, storyId } = msg.payload;
          const currentList = getStoryChapters(storyId);
          const nextList = currentList.filter((c) => c.id !== id);
          try {
            localStorage.setItem(`mel_chapters_${storyId}`, JSON.stringify(nextList));
          } catch {}
          setLiveStoryChapters(storyId, nextList);
          notifyChapterSubscribers(storyId, nextList);
          activeAllChaptersSubscribers.forEach((cb) => {
            try { cb(getLiveChaptersRuntimeCache()); } catch {}
          });
        } else if (msg.type === 'announcement_saved') {
          const ann: Announcement = msg.payload;
          const current = getStoredAnnouncements();
          const idx = current.findIndex((a) => a.id === ann.id);
          const next = idx >= 0 ? current.map((a) => (a.id === ann.id ? ann : a)) : [ann, ...current];
          try {
            localStorage.setItem('mel_announcements', JSON.stringify(next));
          } catch {}
          notifyAnnouncementSubscribers(next);
        } else if (msg.type === 'announcement_deleted') {
          const { id } = msg.payload;
          const current = getStoredAnnouncements();
          const next = current.filter((a) => a.id !== id);
          try {
            localStorage.setItem('mel_announcements', JSON.stringify(next));
          } catch {}
          notifyAnnouncementSubscribers(next);
        } else if (
          msg.type === 'playlist_saved' ||
          msg.type === 'playlist_updated' ||
          msg.type === 'playlist_deleted'
        ) {
          bgmEngine.handleServerTrackEvent(msg.type, msg.payload);
        } else if (msg.type === 'letter_saved') {
          const current = getStoredReaderLetters();
          const idx = current.findIndex((l) => l.id === msg.payload.id);
          const next =
            idx >= 0
              ? current.map((l) => (l.id === msg.payload.id ? msg.payload : l))
              : [msg.payload, ...current];
          saveStoredReaderLetters(next);
          notifyReaderLetterSubscribers(next);
        } else if (msg.type === 'letter_replied') {
          const { id } = msg.payload || {};
          const current = getStoredReaderLetters();
          const next = current.map((l) =>
            l.id === id ? { ...l, ...msg.payload } : l
          );
          saveStoredReaderLetters(next);
          notifyReaderLetterSubscribers(next);
        } else if (msg.type === 'letter_deleted') {
          const { id } = msg.payload;
          const current = getStoredReaderLetters();
          const next = current.filter((l) => l.id !== id);
          saveStoredReaderLetters(next);
          notifyReaderLetterSubscribers(next);
        } else if (msg.type === 'letter_liked') {
          const { id, likes } = msg.payload;
          const current = getStoredReaderLetters();
          const next = current.map((l) =>
            l.id === id ? { ...l, likes: typeof likes === 'number' ? likes : (l.likes || 0) + 1 } : l
          );
          saveStoredReaderLetters(next);
          notifyReaderLetterSubscribers(next);
        } else if (msg.type === 'comment_saved') {
          const c: RealtimeComment = msg.payload;
          if (c && c.storyId) {
            const current = getStoredComments(c.storyId);
            const idx = current.findIndex((x) => x.id === c.id);
            const next = idx >= 0 ? current.map((x) => (x.id === c.id ? c : x)) : [c, ...current];
            saveStoredComments(c.storyId, next);
            notifyCommentSubscribers(c.storyId, next);
          }
        } else if (msg.type === 'comment_replied') {
          const { commentId, reply } = msg.payload;
          if (commentId && reply && typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('mel_comments_')) {
                const sId = key.replace('mel_comments_', '');
                const current = getStoredComments(sId);
                let found = false;
                const next = current.map((c) => {
                  if (c.id === commentId) {
                    found = true;
                    const rawReplies = c.replies || [];
                    const rIdx = rawReplies.findIndex((r) => r.id === reply.id);
                    const nextReplies =
                      rIdx >= 0
                        ? rawReplies.map((r) => (r.id === reply.id ? reply : r))
                        : [...rawReplies, reply];
                    return { ...c, replies: nextReplies, lastRepliedAt: new Date().toISOString() };
                  }
                  return c;
                });
                if (found) {
                  saveStoredComments(sId, next);
                  notifyCommentSubscribers(sId, next);
                  break;
                }
              }
            }
          }
        } else if (msg.type === 'comment_deleted') {
          const { id } = msg.payload;
          if (id && typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('mel_comments_')) {
                const sId = key.replace('mel_comments_', '');
                const current = getStoredComments(sId);
                if (current.some((c) => c.id === id)) {
                  const next = current.filter((c) => c.id !== id);
                  saveStoredComments(sId, next);
                  notifyCommentSubscribers(sId, next);
                  break;
                }
              }
            }
          }
        } else if (msg.type === 'comment_liked') {
          const { commentId, likes, likedBy } = msg.payload;
          if (commentId && typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('mel_comments_')) {
                const sId = key.replace('mel_comments_', '');
                const current = getStoredComments(sId);
                if (current.some((c) => c.id === commentId)) {
                  const next = current.map((c) =>
                    c.id === commentId ? { ...c, likes, likedBy: likedBy || c.likedBy } : c
                  );
                  saveStoredComments(sId, next);
                  notifyCommentSubscribers(sId, next);
                  break;
                }
              }
            }
          }
        } else if (msg.type === 'genres_updated') {
          if (Array.isArray(msg.payload)) {
            updateGenresFromRemote(msg.payload);
          }
        } else if (msg.type === 'active_readers' && typeof msg.payload?.count === 'number') {
          currentLiveActiveReaders = Math.max(1, msg.payload.count);
          activeReaderSubscribers.forEach((cb) => {
            try { cb(currentLiveActiveReaders); } catch {}
          });
        }
      } catch {}
    };

    eventSource.onerror = () => {
      // Reconnect is automatic in EventSource
    };
  } catch {}

  // 3. Periodic fallback polling every 8 seconds
  setInterval(pullServerSync, 8000);
};

// Active readers subscribers
const activeReaderSubscribers = new Set<(count: number) => void>();
let currentLiveActiveReaders = 1;

// Start sync immediately on client
if (typeof window !== 'undefined') {
  initServerRealtimeSync();
}

// Constants
const STATS_DOC_ID = 'aggregate_stats';
const ACTIVE_PRESENCE_COLLECTION = 'reader_presences';
const CONFIG_DOC_ID = 'main_config';
const COLLABORATORS_COLLECTION = 'collaborators';
const USERS_COLLECTION = 'users';

// Client session unique ID to avoid counting duplicate visits in the same session
const getSessionVisitorId = (): string => {
  try {
    let vid = sessionStorage.getItem('mel_visitor_id');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
      sessionStorage.setItem('mel_visitor_id', vid);
    }
    return vid;
  } catch {
    return 'v_' + Math.random().toString(36).substring(2, 12);
  }
};

/**
 * Kiểm tra xem người dùng có đang truy cập qua đường liên kết chính thức (public URL / shared link / custom domain)
 * hay trong môi trường sandbox nội bộ (localhost / ais-dev-).
 * Đảm bảo các con số, số liệu thống kê chỉ được bắt đầu tính kể từ khi trang web chính thức được ra mắt, public và được tạo đường liên kết.
 */
export const isPublicOfficialSite = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isDevHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('ais-dev-') ||
    host.includes('.internal');
  return !isDevHost;
};

/**
 * Record a real visit across any device and browser.
 * Only begins counting visits when accessed via the official public link / domain.
 * Starts from 1 (the first real public visitor) instead of arbitrary numbers.
 * Only increments totalVisits once per browser session.
 */
export const recordSiteVisit = async (): Promise<void> => {
  try {
    // Chỉ ghi nhận lượt truy cập khi website đã chính thức ra mắt / public
    if (!isPublicOfficialSite()) {
      return;
    }

    const sessionKey = 'mel_visited_recorded';
    const alreadyRecorded = sessionStorage.getItem(sessionKey);
    const statsDocRef = doc(db, 'site_stats', STATS_DOC_ID);

    if (!alreadyRecorded) {
      sessionStorage.setItem(sessionKey, 'true');

      const docSnap = await getDoc(statsDocRef);
      if (!docSnap.exists()) {
        await setDoc(statsDocRef, {
          totalVisits: 1, // First real visitor on public launch
          totalFollowers: 0,
          totalComments: 0,
          totalLikes: 0,
          lastVisitAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(statsDocRef, {
          totalVisits: increment(1),
          lastVisitAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('Realtime visit tracking error:', err);
  }
};

/**
 * Realtime Presence Heartbeat: Keeps track of actual active readers online right now.
 * Zero Firestore writes: backed 100% by Server Events, active connections, and memory.
 */
export const startActiveReaderHeartbeat = (onCountChange: (count: number) => void): (() => void) => {
  activeReaderSubscribers.add(onCountChange);
  // Send current cached active count immediately
  onCountChange(Math.max(1, currentLiveActiveReaders));

  // Query server for latest active readers count without writing to Firestore
  fetchWithTimeout('/api/active-readers', {}, 2500)
    .then((r) => r.json())
    .then((data) => {
      if (typeof data?.count === 'number') {
        currentLiveActiveReaders = Math.max(1, data.count);
        onCountChange(currentLiveActiveReaders);
      }
    })
    .catch(() => {
      onCountChange(Math.max(1, currentLiveActiveReaders));
    });

  return () => {
    activeReaderSubscribers.delete(onCountChange);
  };
};

/**
 * Subscribe to global site statistics in real time.
 * Defaults strictly to 0 if database is fresh.
 */
export const subscribeToGlobalStats = (
  callback: (stats: GlobalRealtimeStats) => void
): (() => void) => {
  if (checkIsFirestoreBlocked()) {
    callback({
      totalVisits: 0,
      activeReaders: Math.max(1, currentLiveActiveReaders),
      totalFollowers: 0,
      totalComments: 0,
      totalLikes: 0,
    });
    return () => {};
  }

  const statsDocRef = doc(db, 'site_stats', STATS_DOC_ID);
  return onSnapshot(
    statsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Tự động làm sạch và khởi tạo lại nếu còn vướng số liệu ảo/thử nghiệm cũ (> 500 khi web chưa public)
        const isLegacySimulated = (!data.isRealData && ((data.totalVisits ?? 0) > 500 || (data.totalLikes ?? 0) > 500));
        if (isLegacySimulated) {
          const hasAttempted = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mel_stats_sanitized');
          if (!hasAttempted && !isFirestoreQuotaExhausted()) {
            try {
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('mel_stats_sanitized', 'true');
              setDoc(
                statsDocRef,
                {
                  totalVisits: 0,
                  activeReaders: 1,
                  totalFollowers: 0,
                  totalComments: 0,
                  totalLikes: 0,
                  isRealData: true,
                  sanitizedAt: new Date().toISOString(),
                },
                { merge: true }
              ).catch(() => {});
            } catch {}
          }

          callback({
            totalVisits: 0,
            activeReaders: 1,
            totalFollowers: 0,
            totalComments: 0,
            totalLikes: 0,
          });
          return;
        }

        callback({
          totalVisits: data.totalVisits ?? 0,
          activeReaders: Math.max(1, currentLiveActiveReaders, data.activeReaders ?? 1),
          totalFollowers: data.totalFollowers ?? 0,
          totalComments: data.totalComments ?? 0,
          totalLikes: data.totalLikes ?? 0,
        });
      } else {
        callback({
          totalVisits: 0,
          activeReaders: Math.max(1, currentLiveActiveReaders),
          totalFollowers: 0,
          totalComments: 0,
          totalLikes: 0,
        });
      }
    },
    (error) => {
      console.warn('Global stats snapshot warning:', error);
      callback({
        totalVisits: 0,
        activeReaders: Math.max(1, currentLiveActiveReaders),
        totalFollowers: 0,
        totalComments: 0,
        totalLikes: 0,
      });
    }
  );
};

/**
 * Subscribe to realtime stats for a specific story (views, likes, followers, ratings).
 * Baseline is strictly 0.
 */
export const subscribeToStoryStats = (
  storyId: string,
  initialViews: number = 0,
  initialLikes: number = 0,
  callback: (stats: StoryRealtimeStats) => void
): (() => void) => {
  if (checkIsFirestoreBlocked()) {
    callback({
      views: initialViews || 0,
      likes: initialLikes || 0,
      followers: 0,
      ratingSum: 0,
      ratingCount: 0,
      commentCount: 0,
    });
    return () => {};
  }

  const storyDocRef = doc(db, 'story_stats', storyId);

  return onSnapshot(
    storyDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          views: data.views !== undefined ? Number(data.views) : (initialViews || 0),
          likes: data.likes !== undefined ? Number(data.likes) : (initialLikes || 0),
          followers: data.followers ?? 0,
          ratingSum: data.ratingSum ?? 0,
          ratingCount: data.ratingCount ?? 0,
          commentCount: data.commentCount ?? 0,
        });
      } else {
        callback({
          views: initialViews || 0,
          likes: initialLikes || 0,
          followers: 0,
          ratingSum: 0,
          ratingCount: 0,
          commentCount: 0,
        });
      }
    },
    (err) => {
      console.warn(`Story stats snapshot warning for ${storyId}:`, err);
      callback({
        views: initialViews || 0,
        likes: initialLikes || 0,
        followers: 0,
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
      });
    }
  );
};

/**
 * Increment story views when a reader views the story details or chapters.
 * Only records views on the official public link / domain.
 */
export const recordStoryView = async (storyId: string): Promise<void> => {
  try {
    // Chỉ tăng lượt xem khi độc giả đọc truyện trên trang web chính thức / public link
    if (!isPublicOfficialSite()) {
      return;
    }

    const sessionKey = `mel_viewed_story_${storyId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    const storyDocRef = doc(db, 'story_stats', storyId);
    const snap = await getDoc(storyDocRef);

    if (!snap.exists()) {
      await setDoc(storyDocRef, {
        storyId,
        views: 1,
        likes: 0,
        followers: 0,
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(storyDocRef, {
        views: increment(1),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Record story view error:', err);
  }
};

/**
 * Like or unlike a story in real time.
 */
export const toggleStoryLike = async (storyId: string, isLiking: boolean): Promise<void> => {
  try {
    const storyDocRef = doc(db, 'story_stats', storyId);
    const snap = await getDoc(storyDocRef);
    const delta = isLiking ? 1 : -1;

    if (!snap.exists()) {
      await setDoc(storyDocRef, {
        storyId,
        views: 1,
        likes: Math.max(0, delta),
        followers: 0,
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(storyDocRef, {
        likes: increment(delta),
        updatedAt: new Date().toISOString(),
      });
    }

    // Update global likes
    const globalDocRef = doc(db, 'site_stats', STATS_DOC_ID);
    await updateDoc(globalDocRef, {
      totalLikes: increment(delta),
    }).catch(() => {});
  } catch (err) {
    console.warn('Toggle story like error:', err);
  }
};

/**
 * Follow or unfollow a story in real time.
 */
export const toggleStoryFollow = async (storyId: string, isFollowing: boolean): Promise<void> => {
  try {
    const storyDocRef = doc(db, 'story_stats', storyId);
    const snap = await getDoc(storyDocRef);
    const delta = isFollowing ? 1 : -1;

    if (!snap.exists()) {
      await setDoc(storyDocRef, {
        storyId,
        views: 1,
        likes: 0,
        followers: Math.max(0, delta),
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(storyDocRef, {
        followers: increment(delta),
        updatedAt: new Date().toISOString(),
      });
    }

    // Update global followers count
    const globalDocRef = doc(db, 'site_stats', STATS_DOC_ID);
    await updateDoc(globalDocRef, {
      totalFollowers: increment(delta),
    }).catch(() => {});
  } catch (err) {
    console.warn('Toggle story follow error:', err);
  }
};

/**
 * Submit a real reader rating (1-5 stars) for a story.
 */
export const submitStoryRating = async (storyId: string, stars: number): Promise<void> => {
  try {
    const storyDocRef = doc(db, 'story_stats', storyId);
    const snap = await getDoc(storyDocRef);

    if (!snap.exists()) {
      await setDoc(storyDocRef, {
        storyId,
        views: 1,
        likes: 0,
        followers: 0,
        ratingSum: stars,
        ratingCount: 1,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(storyDocRef, {
        ratingSum: increment(stars),
        ratingCount: increment(1),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Submit story rating error:', err);
  }
};

/**
 * Subscribe to realtime comments for a story or specific chapter.
 */
export const subscribeToComments = (
  storyId: string,
  chapterNumber: number | null,
  callback: (comments: RealtimeComment[]) => void
): (() => void) => {
  // 1. Immediately emit local cached comments (0ms latency)
  const cached = getStoredComments(storyId);
  if (chapterNumber !== null && chapterNumber !== undefined) {
    callback(cached.filter((c) => c.chapterNumber === chapterNumber || !c.chapterNumber));
  } else {
    callback(cached);
  }

  // 2. Register subscriber
  if (!activeCommentSubscribers.has(storyId)) {
    activeCommentSubscribers.set(storyId, new Set());
  }
  const subObj = { chapterNumber, callback };
  activeCommentSubscribers.get(storyId)!.add(subObj);

  // 3. Fetch from Server API
  if (typeof window !== 'undefined' && hasBackendServer()) {
    fetch(buildApiUrl(`/api/comments?storyId=${encodeURIComponent(storyId)}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((serverList: RealtimeComment[] | null) => {
        if (Array.isArray(serverList)) {
          const current = getStoredComments(storyId);
          const map = new Map<string, RealtimeComment>();
          serverList.forEach((c) => map.set(c.id, c));
          current.forEach((c) => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredComments(storyId, merged);
          notifyCommentSubscribers(storyId, merged);
        }
      })
      .catch(() => {});
  }

  // 4. Firestore onSnapshot if available
  let unsubFirestore: (() => void) | null = null;
  if (!isFirestoreQuotaExhausted()) {
    try {
      const commentsColl = collection(db, 'comments');
      const q = query(
        commentsColl,
        where('storyId', '==', storyId),
        orderBy('createdAt', 'desc'),
        limit(60)
      );
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: RealtimeComment[] = [];
          snapshot.forEach((d) => {
            const item = d.data();
            const rawReplies = Array.isArray(item.replies) ? item.replies : [];
            const seenReplyIds = new Set<string>();
            const dedupedReplies: CommentReply[] = [];
            for (const r of rawReplies) {
              const replyId = r?.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              if (!seenReplyIds.has(replyId)) {
                seenReplyIds.add(replyId);
                dedupedReplies.push({
                  ...r,
                  id: replyId,
                  isAuthor: Boolean(r.isAuthor),
                  isCollaborator: Boolean(r.isCollaborator),
                  roleBadge: r.roleBadge || (r.isAuthor ? 'Tác giả' : r.isCollaborator ? 'Cộng sự' : undefined),
                  likes: typeof r.likes === 'number' ? r.likes : 0,
                  likedBy: Array.isArray(r.likedBy) ? r.likedBy : [],
                  replyToUser: r.replyToUser || undefined,
                  replyToId: r.replyToId || undefined,
                });
              }
            }

            list.push({
              id: d.id,
              storyId: item.storyId,
              chapterId: item.chapterId,
              chapterNumber: item.chapterNumber,
              user: item.user || 'Độc giả yêu truyện',
              userEmail: item.userEmail,
              userId: item.userId,
              isAuthor: Boolean(item.isAuthor),
              isCollaborator: Boolean(item.isCollaborator),
              roleBadge: item.roleBadge || (item.isAuthor ? 'Tác giả' : item.isCollaborator ? 'Cộng sự' : undefined),
              avatar: item.avatar || '🌸',
              text: item.text,
              createdAt: item.createdAt || new Date().toISOString(),
              rating: item.rating,
              likes: typeof item.likes === 'number' ? item.likes : 0,
              likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
              replies: dedupedReplies,
            });
          });

          // Merge with stored comments
          const current = getStoredComments(storyId);
          const map = new Map<string, RealtimeComment>();
          list.forEach((c) => map.set(c.id, c));
          current.forEach((c) => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredComments(storyId, merged);
          notifyCommentSubscribers(storyId, merged);
        },
        (err) => {
          console.warn(`Comments snapshot warning for ${storyId}:`, err);
        }
      );
    } catch {}
  }

  return () => {
    const set = activeCommentSubscribers.get(storyId);
    if (set) {
      set.delete(subObj);
      if (set.size === 0) activeCommentSubscribers.delete(storyId);
    }
    if (unsubFirestore) {
      try { unsubFirestore(); } catch {}
    }
  };
};

/**
 * Add a new real comment from any device/reader.
 */
export const postRealtimeComment = async (comment: {
  storyId: string;
  chapterNumber?: number;
  chapterId?: string;
  user: string;
  userEmail?: string | null;
  userId?: string | null;
  isAuthor?: boolean;
  isCollaborator?: boolean;
  roleBadge?: string;
  avatar?: string;
  text: string;
  rating?: number | null;
}): Promise<void> => {
  const newId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanComment: RealtimeComment = {
    id: newId,
    storyId: comment.storyId,
    chapterNumber: comment.chapterNumber || undefined,
    chapterId: comment.chapterId || undefined,
    user: comment.user.trim() || 'Bạn đọc yêu truyện',
    userEmail: comment.userEmail || undefined,
    userId: comment.userId || undefined,
    isAuthor: Boolean(comment.isAuthor),
    isCollaborator: Boolean(comment.isCollaborator),
    roleBadge: comment.roleBadge || (comment.isAuthor ? 'Tác giả' : comment.isCollaborator ? 'Cộng sự' : undefined),
    avatar: comment.avatar || (comment.isAuthor ? '🌸' : comment.isCollaborator ? '🌿' : '🌸'),
    text: comment.text.trim(),
    rating: comment.rating || undefined,
    likes: 0,
    likedBy: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };

  // 1. Immediate local UI update
  const current = getStoredComments(cleanComment.storyId);
  const updated = [cleanComment, ...current];
  saveStoredComments(cleanComment.storyId, updated);
  notifyCommentSubscribers(cleanComment.storyId, updated);

  // 2. Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl('/api/comments'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanComment),
    }).catch((apiErr) => {
      console.warn('Server comments post warning:', apiErr);
    });
  }

  // 3. Firestore persistence if available
  try {
    const commentsColl = collection(db, 'comments');
    await addDoc(commentsColl, sanitizeForFirestore({
      ...cleanComment,
      userEmail: cleanComment.userEmail || null,
      userId: cleanComment.userId || null,
      roleBadge: cleanComment.roleBadge || null,
      rating: cleanComment.rating || null,
    })).catch(() => {});

    // Increment comment count on story_stats
    const storyDocRef = doc(db, 'story_stats', comment.storyId);
    await updateDoc(storyDocRef, {
      commentCount: increment(1),
    }).catch(async () => {
      await setDoc(storyDocRef, {
        storyId: comment.storyId,
        views: 1,
        likes: 0,
        followers: 0,
        commentCount: 1,
        ratingSum: 0,
        ratingCount: 0,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    });

    // Increment global comment count
    const globalDocRef = doc(db, 'site_stats', STATS_DOC_ID);
    await updateDoc(globalDocRef, {
      totalComments: increment(1),
    }).catch(() => {});
  } catch (err) {
    console.warn('Firestore comment sync warning:', err);
  }
};

/**
 * Post an author, collaborator, or reader reply to an existing comment.
 * Visitors can reply freely without logging in.
 */
export const postCommentReply = async (
  commentId: string,
  reply: {
    user: string;
    text: string;
    avatar?: string;
    isAuthor?: boolean;
    isCollaborator?: boolean;
    roleBadge?: string;
    userEmail?: string | null;
    replyToUser?: string;
    replyToId?: string;
  }
): Promise<CommentReply> => {
  const fallbackUser = reply.isAuthor
    ? 'Mellifluous (Tác giả)'
    : reply.isCollaborator
    ? 'Cộng sự BQT'
    : 'Bạn đọc';

  const defaultAvatar = reply.isAuthor ? '🌸' : reply.isCollaborator ? '🌿' : '💬';

  const newReplyItem: CommentReply = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user: (reply.user && reply.user.trim()) || fallbackUser,
    avatar: reply.avatar || defaultAvatar,
    text: reply.text.trim(),
    createdAt: new Date().toISOString(),
    isAuthor: Boolean(reply.isAuthor),
    isCollaborator: Boolean(reply.isCollaborator),
    ...(reply.roleBadge
      ? { roleBadge: reply.roleBadge }
      : reply.isAuthor
      ? { roleBadge: 'Tác giả' }
      : reply.isCollaborator
      ? { roleBadge: 'Cộng sự' }
      : {}),
    userEmail: reply.userEmail || null,
    likes: 0,
    likedBy: [],
    ...(reply.replyToUser ? { replyToUser: reply.replyToUser } : {}),
    ...(reply.replyToId ? { replyToId: reply.replyToId } : {}),
  };

  // 1. Immediate local update across stories
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mel_comments_')) {
        const sId = key.replace('mel_comments_', '');
        const current = getStoredComments(sId);
        let found = false;
        const next = current.map((c) => {
          if (c.id === commentId) {
            found = true;
            const rawReplies = c.replies || [];
            return { ...c, replies: [...rawReplies, newReplyItem], lastRepliedAt: new Date().toISOString() };
          }
          return c;
        });
        if (found) {
          saveStoredComments(sId, next);
          notifyCommentSubscribers(sId, next);
          break;
        }
      }
    }
  }

  // 2. Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/comments/${encodeURIComponent(commentId)}/reply`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: newReplyItem }),
    }).catch((apiErr) => {
      console.warn('Server comment reply post warning:', apiErr);
    });
  }

  // 3. Firestore persistence if available
  try {
    const commentRef = doc(db, 'comments', commentId);
    const snap = await getDoc(commentRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentReplies: CommentReply[] = Array.isArray(data.replies) ? data.replies : [];
      const seenIds = new Set<string>();
      const cleanedReplies: CommentReply[] = [];
      for (const r of currentReplies) {
        if (r && r.id && !seenIds.has(r.id) && r.id !== newReplyItem.id) {
          seenIds.add(r.id);
          cleanedReplies.push(sanitizeForFirestore(r));
        }
      }
      cleanedReplies.push(sanitizeForFirestore(newReplyItem));
      await updateDoc(commentRef, sanitizeForFirestore({
        replies: cleanedReplies,
        lastRepliedAt: new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('Firestore reply update warning:', err);
  }

  return newReplyItem;
};

/**
 * Toggle heart / like on a realtime comment by any visitor or user.
 */
export const toggleCommentLike = async (
  commentId: string,
  visitorId: string
): Promise<{ likes: number; isLiked: boolean }> => {
  let newLikes = 0;
  let isLiked = false;

  // 1. Immediate local update
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mel_comments_')) {
        const sId = key.replace('mel_comments_', '');
        const current = getStoredComments(sId);
        let found = false;
        const next = current.map((c) => {
          if (c.id === commentId) {
            found = true;
            const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
            const hasLiked = likedBy.includes(visitorId);
            const nextLikedBy = hasLiked ? likedBy.filter((id) => id !== visitorId) : [...likedBy, visitorId];
            newLikes = Math.max(0, nextLikedBy.length);
            isLiked = !hasLiked;
            return { ...c, likes: newLikes, likedBy: nextLikedBy };
          }
          return c;
        });
        if (found) {
          saveStoredComments(sId, next);
          notifyCommentSubscribers(sId, next);
          break;
        }
      }
    }
  }

  // 2. Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/comments/${encodeURIComponent(commentId)}/like`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
    }).catch((apiErr) => {
      console.warn('Server comment like warning:', apiErr);
    });
  }

  // 3. Firestore persistence if available
  try {
    const commentRef = doc(db, 'comments', commentId);
    const snap = await getDoc(commentRef);
    if (snap.exists()) {
      const data = snap.data();
      const likedBy: string[] = Array.isArray(data.likedBy) ? data.likedBy : [];
      const hasLiked = likedBy.includes(visitorId);
      const newLikedBy = hasLiked
        ? likedBy.filter((id) => id !== visitorId)
        : [...likedBy, visitorId];
      const fl = Math.max(0, newLikedBy.length);
      await updateDoc(commentRef, {
        likes: fl,
        likedBy: newLikedBy,
      });
      return { likes: fl, isLiked: !hasLiked };
    }
  } catch (err) {
    console.warn('Toggle comment like warning:', err);
  }

  return { likes: newLikes, isLiked };
};

/**
 * Toggle heart / like on a nested comment reply by any visitor or user.
 */
export const toggleReplyLike = async (
  commentId: string,
  replyId: string,
  visitorId: string
): Promise<{ likes: number; isLiked: boolean }> => {
  let finalLikes = 0;
  let isLikedNow = false;

  // 1. Immediate local update
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mel_comments_')) {
        const sId = key.replace('mel_comments_', '');
        const current = getStoredComments(sId);
        let found = false;
        const next = current.map((c) => {
          if (c.id === commentId) {
            found = true;
            const replies = (c.replies || []).map((r) => {
              if (r.id === replyId) {
                const likedBy = Array.isArray(r.likedBy) ? r.likedBy : [];
                const hasLiked = likedBy.includes(visitorId);
                const nextLikedBy = hasLiked ? likedBy.filter((id) => id !== visitorId) : [...likedBy, visitorId];
                finalLikes = Math.max(0, nextLikedBy.length);
                isLikedNow = !hasLiked;
                return { ...r, likes: finalLikes, likedBy: nextLikedBy };
              }
              return r;
            });
            return { ...c, replies };
          }
          return c;
        });
        if (found) {
          saveStoredComments(sId, next);
          notifyCommentSubscribers(sId, next);
          break;
        }
      }
    }
  }

  // 2. Firestore persistence if available
  try {
    const commentRef = doc(db, 'comments', commentId);
    const snap = await getDoc(commentRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentReplies: CommentReply[] = data.replies || [];
      const updatedReplies: CommentReply[] = [];

      for (const r of currentReplies) {
        if (!r || !r.id) continue;
        if (r.id === replyId) {
          const likedBy = Array.isArray(r.likedBy) ? r.likedBy : [];
          const hasLiked = likedBy.includes(visitorId);
          const newLikedBy = hasLiked
            ? likedBy.filter((id) => id !== visitorId)
            : [...likedBy, visitorId];
          finalLikes = Math.max(0, newLikedBy.length);
          isLikedNow = !hasLiked;
          updatedReplies.push(sanitizeForFirestore({ ...r, likes: finalLikes, likedBy: newLikedBy }));
        } else {
          updatedReplies.push(sanitizeForFirestore(r));
        }
      }

      await updateDoc(commentRef, {
        replies: updatedReplies,
      });
    }
  } catch (err) {
    console.warn('Toggle reply like warning:', err);
  }

  return { likes: finalLikes, isLiked: isLikedNow };
};

/**
 * Delete a comment (Author / Moderator only)
 */
export const deleteComment = async (commentId: string): Promise<void> => {
  // 1. Immediate local removal
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mel_comments_')) {
        const sId = key.replace('mel_comments_', '');
        const current = getStoredComments(sId);
        if (current.some((c) => c.id === commentId)) {
          const next = current.filter((c) => c.id !== commentId);
          saveStoredComments(sId, next);
          notifyCommentSubscribers(sId, next);
          break;
        }
      }
    }
  }

  // 2. Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/comments/${encodeURIComponent(commentId)}`), {
      method: 'DELETE',
    }).catch((apiErr) => {
      console.warn('Server comment delete warning:', apiErr);
    });
  }

  // 3. Firestore delete if available
  try {
    await deleteDoc(doc(db, 'comments', commentId)).catch(() => {});
  } catch (err) {
    console.warn('Firestore delete comment warning:', err);
  }
};

/* ========================================================================
 * READER LETTERS & CONFESSIONS (HÒM THƯ TÂM SỰ CỦA ĐỘC GIẢ & TÁC GIẢ HỒI ĐÁP)
 * ======================================================================== */

/**
 * Subscribe to realtime reader letters and confessions (Dual-engine: local + Firestore sync).
 */
export const subscribeToReaderLetters = (
  callback: (letters: ReaderLetter[]) => void
): (() => void) => {
  // 1. Immediately emit current stored letters (0ms latency, guaranteed)
  callback(getStoredReaderLetters());

  // 2. Register to in-memory notification
  activeReaderLetterSubscribers.add(callback);

  // 3. Server API fetch
  if (typeof window !== 'undefined' && hasBackendServer()) {
    fetch(buildApiUrl('/api/letters'))
      .then((res) => (res.ok ? res.json() : null))
      .then((serverLetters) => {
        if (Array.isArray(serverLetters) && serverLetters.length > 0) {
          const current = getStoredReaderLetters();
          const letterMap = new Map<string, ReaderLetter>();
          serverLetters.forEach((l: ReaderLetter) => letterMap.set(l.id, l));
          current.forEach((l) => {
            if (!letterMap.has(l.id)) letterMap.set(l.id, l);
          });
          const merged = Array.from(letterMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredReaderLetters(merged);
          notifyReaderLetterSubscribers(merged);
        }
      })
      .catch(() => {});
  }

  // 4. Connect to Firestore realtime stream if not quota exhausted
  let unsubscribeFs: (() => void) | null = null;
  if (!isFirestoreQuotaExhausted()) {
    try {
      const lettersColl = collection(db, 'reader_letters');
      const q = query(lettersColl, orderBy('createdAt', 'desc'), limit(100));

      unsubscribeFs = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteList: ReaderLetter[] = [];
            snapshot.forEach((d) => {
              const item = d.data();
              remoteList.push({
                id: d.id,
                sender: item.sender || 'Bạn đọc giấu tên',
                senderEmail: item.senderEmail || undefined,
                senderUid: item.senderUid || undefined,
                avatar: item.avatar || '💌',
                content: item.content || '',
                type: item.type === 'private' ? 'private' : 'public',
                tag: item.tag || '🌸 Lời nhắn gửi',
                time: item.time || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'Vừa xong'),
                createdAt: item.createdAt || new Date().toISOString(),
                likes: item.likes || 0,
                replyFromMel: item.replyFromMel || undefined,
                repliedAt: item.repliedAt || undefined,
                repliedBy: item.repliedBy || undefined,
                secretLookupCode: item.secretLookupCode || undefined,
              });
            });

            // Merge remote list with local items that might not have synced yet
            const currentLocal = getStoredReaderLetters();
            const mergedMap = new Map<string, ReaderLetter>();
            // Remote first
            remoteList.forEach((item) => mergedMap.set(item.id, item));
            // Keep any local item not in remote
            currentLocal.forEach((item) => {
              if (!mergedMap.has(item.id)) {
                mergedMap.set(item.id, item);
              }
            });

            const finalList = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            saveStoredReaderLetters(finalList);
            notifyReaderLetterSubscribers(finalList);
          }
        },
        (err) => {
          console.warn('Firestore reader letters snapshot error (using local engine):', err);
        }
      );
    } catch {}
  }

  return () => {
    activeReaderLetterSubscribers.delete(callback);
    if (unsubscribeFs) {
      try { unsubscribeFs(); } catch {}
    }
  };
};

/**
 * Submit a reader letter/confession (Public or Private) with 100% reliability.
 */
export const sendReaderLetter = async (letter: {
  sender: string;
  senderEmail?: string;
  senderUid?: string;
  avatar?: string;
  content: string;
  type: 'public' | 'private';
  tag?: string;
  userEmail?: string;
  userId?: string;
}): Promise<{ id: string; secretLookupCode?: string }> => {
  const newId = `letter_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secretLookupCode =
    letter.type === 'private'
      ? `MEL-${Math.floor(10000 + Math.random() * 90000)}`
      : undefined;

  const newLetter: ReaderLetter = {
    id: newId,
    sender: letter.sender.trim() || 'Bạn đọc yêu mến',
    senderEmail: letter.senderEmail || letter.userEmail || undefined,
    senderUid: letter.senderUid || letter.userId || undefined,
    avatar: letter.avatar || (letter.type === 'public' ? '🌸' : '💌'),
    content: letter.content.trim(),
    type: letter.type,
    tag: letter.tag || '🌸 Lời nhắn gửi',
    time: 'Vừa xong',
    createdAt: new Date().toISOString(),
    likes: 0,
    replyFromMel: undefined,
    repliedAt: undefined,
    repliedBy: undefined,
    secretLookupCode,
  };

  // 1. Immediately persist to localStorage
  const currentLetters = getStoredReaderLetters();
  const updatedLetters = [newLetter, ...currentLetters.filter((l) => l.id !== newId)];
  saveStoredReaderLetters(updatedLetters);

  // 2. Immediately broadcast to UI in 0ms
  notifyReaderLetterSubscribers(updatedLetters);

  // 3. Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl('/api/letters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLetter),
    }).catch((apiErr) => {
      console.warn('Server reader letter post warning:', apiErr);
    });
  }

  // 4. Non-blocking asynchronous sync to Firestore
  try {
    const cleanDoc = {
      sender: newLetter.sender,
      senderEmail: newLetter.senderEmail || null,
      senderUid: newLetter.senderUid || null,
      avatar: newLetter.avatar,
      content: newLetter.content,
      type: newLetter.type,
      tag: newLetter.tag,
      time: 'Vừa xong',
      createdAt: newLetter.createdAt,
      likes: 0,
      replyFromMel: null,
      repliedAt: null,
      repliedBy: null,
      secretLookupCode: secretLookupCode || null,
    };
    setDoc(doc(db, 'reader_letters', newId), cleanDoc).catch((err) => {
      console.warn('Firestore async sync for reader letter warning:', err);
    });
  } catch (syncErr) {
    console.warn('Firestore setDoc call warning:', syncErr);
  }

  return { id: newId, secretLookupCode };
};

/**
 * Author or collaborator replies to a reader's letter/confession.
 */
export const replyToReaderLetter = async (
  letterId: string,
  replyText: string,
  authorName: string = 'Mellifluous (Tác giả)'
): Promise<void> => {
  const currentLetters = getStoredReaderLetters();
  const updated = currentLetters.map((l) => {
    if (l.id === letterId) {
      return {
        ...l,
        replyFromMel: replyText.trim(),
        repliedAt: new Date().toISOString(),
        repliedBy: authorName,
      };
    }
    return l;
  });
  saveStoredReaderLetters(updated);
  notifyReaderLetterSubscribers(updated);

  // Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/letters/${encodeURIComponent(letterId)}/reply`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyText, authorName }),
    }).catch((apiErr) => {
      console.warn('Server letter reply warning:', apiErr);
    });
  }

  try {
    const letterRef = doc(db, 'reader_letters', letterId);
    await updateDoc(letterRef, {
      replyFromMel: replyText.trim(),
      repliedAt: new Date().toISOString(),
      repliedBy: authorName,
    }).catch((err) => console.warn('Firestore reply sync warning:', err));
  } catch (err) {
    console.warn('Firestore updateDoc warning for reply:', err);
  }
};

/**
 * Delete a reader letter (Author / Moderator only)
 */
export const deleteReaderLetter = async (letterId: string): Promise<void> => {
  const currentLetters = getStoredReaderLetters();
  const updated = currentLetters.filter((l) => l.id !== letterId);
  saveStoredReaderLetters(updated);
  notifyReaderLetterSubscribers(updated);

  // Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/letters/${encodeURIComponent(letterId)}`), {
      method: 'DELETE',
    }).catch((apiErr) => {
      console.warn('Server letter delete warning:', apiErr);
    });
  }

  try {
    await deleteDoc(doc(db, 'reader_letters', letterId)).catch((err) => {
      console.warn('Firestore delete letter warning:', err);
    });
  } catch (err) {
    console.warn('deleteDoc error:', err);
  }
};

/**
 * Toggle like for a reader letter
 */
export const toggleLetterLike = async (letterId: string): Promise<void> => {
  const currentLetters = getStoredReaderLetters();
  const updated = currentLetters.map((l) => {
    if (l.id === letterId) {
      return { ...l, likes: (l.likes || 0) + 1 };
    }
    return l;
  });
  saveStoredReaderLetters(updated);
  notifyReaderLetterSubscribers(updated);

  // Server API sync for cross-device broadcast
  if (hasBackendServer()) {
    fetch(buildApiUrl(`/api/letters/${encodeURIComponent(letterId)}/like`), {
      method: 'POST',
    }).catch((apiErr) => {
      console.warn('Server letter like warning:', apiErr);
    });
  }

  try {
    const letterRef = doc(db, 'reader_letters', letterId);
    await updateDoc(letterRef, {
      likes: increment(1),
    }).catch((err) => console.warn('Firestore like letter warning:', err));
  } catch (err) {
    console.warn('toggleLetterLike warning:', err);
  }
};


/**
 * Register follower/email subscription in real time.
 */
export const subscribeNewsletter = async (
  email: string,
  targetStoryId: string = 'all'
): Promise<void> => {
  try {
    const coll = collection(db, 'newsletter_subscribers');
    await addDoc(coll, {
      email: email.trim().toLowerCase(),
      targetStoryId,
      subscribedAt: new Date().toISOString(),
    });

    const globalDocRef = doc(db, 'site_stats', STATS_DOC_ID);
    await updateDoc(globalDocRef, {
      totalFollowers: increment(1),
    }).catch(() => {});
  } catch (err) {
    console.warn('Newsletter subscription error:', err);
    throw err;
  }
};

/* ========================================================================
 * PUBLISHING & DYNAMIC CONTENT MANAGEMENT (TÁC GIẢ ĐĂNG BÀI KỂ TỪ KHI XUẤT BẢN)
 * ======================================================================== */

/**
 * Check if the site is in official publishing mode.
 */
export const getPublishingStatus = async (): Promise<{
  isPublished: boolean;
  publishedAt: string | null;
  totalStoriesCount: number;
}> => {
  try {
    const cfgRef = doc(db, 'site_config', CONFIG_DOC_ID);
    const snap = await getDoc(cfgRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isPublished: Boolean(data.isPublished),
        publishedAt: data.publishedAt || null,
        totalStoriesCount: data.totalStoriesCount || 0,
      };
    }
  } catch (e) {
    console.warn('Failed to load site config:', e);
  }
  return { isPublished: false, publishedAt: null, totalStoriesCount: 0 };
};

/**
 * Set the official publishing status of the site.
 */
export const setPublishingStatus = async (isPublished: boolean): Promise<void> => {
  const cfgRef = doc(db, 'site_config', CONFIG_DOC_ID);
  await setDoc(
    cfgRef,
    {
      isPublished,
      publishedAt: isPublished ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};

/**
 * Reset ALL website metrics to default 0 (Khởi tạo Website chính thức từ 0).
 * Clears visits, likes, followers, comments so tracking only starts from publication!
 */
export const resetAllMetricsToZero = async (): Promise<void> => {
  try {
    // 1. Reset Global site stats to 0
    const statsDocRef = doc(db, 'site_stats', STATS_DOC_ID);
    await setDoc(statsDocRef, {
      totalVisits: 1, // The current author
      totalFollowers: 0,
      totalComments: 0,
      totalLikes: 0,
      activeReaders: 1,
      lastResetAt: new Date().toISOString(),
      resetReason: 'Official site publication reset',
    });

    // 2. Reset story_stats for existing stories
    const storiesSnap = await getDocs(collection(db, 'story_stats'));
    const batch = writeBatch(db);
    storiesSnap.forEach((d) => {
      batch.set(d.ref, {
        storyId: d.id,
        views: 0,
        likes: 0,
        followers: 0,
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();

    // 3. Mark site as officially published
    await setPublishingStatus(true);

    // Clear local session storage markers
    sessionStorage.removeItem('mel_visited_recorded');
  } catch (err) {
    console.error('Reset all metrics error:', err);
    throw err;
  }
};

let hasCheckedBaseline = false;

const seedFirestoreBaselineIfEmpty = async () => {
  if (hasCheckedBaseline) return;
  hasCheckedBaseline = true;
  try {
    const statsSnap = await getDocs(collection(db, 'story_stats'));
    if (statsSnap.empty) {
      console.log('Seeding initial baseline stories and chapters to Firestore story_stats & chapter_stats...');
      const batch = writeBatch(db);
      STORIES.forEach((s) => {
        const sRef = doc(db, 'story_stats', s.id);
        batch.set(sRef, sanitizeForFirestore({
          ...s,
          storyId: s.id,
          updatedAt: '14/09/2026',
          deleted: false,
        }));
      });
      for (const [storyId, chapters] of Object.entries(SAMPLE_CHAPTERS)) {
        chapters.forEach((ch) => {
          const cRef = doc(db, 'chapter_stats', ch.id);
          batch.set(cRef, sanitizeForFirestore({
            ...ch,
            chapterId: ch.id,
            storyId,
            deleted: false,
          }));
        });
      }
      await batch.commit();
      console.log('Successfully seeded initial stories and chapters to Firestore story_stats & chapter_stats!');
    } else {
      // If Firestore already has documents, clean up any legacy mock story documents
      cleanupLegacyMockDataInFirestore();
    }
  } catch (err) {
    console.warn('Firestore baseline seed check warning:', err);
  }
};

let hasCleanedLegacy = false;
const cleanupLegacyMockDataInFirestore = async () => {
  if (hasCleanedLegacy || checkIsFirestoreBlocked()) return;
  hasCleanedLegacy = true;
  try {
    const legacyIds = ['mua-he-nam-ay', 'buc-thu-tinh-gui-may-troi', 'chiec-o-thang-bay', 'duoi-tan-cay-mua-ha'];
    const batch = writeBatch(db);
    for (const id of legacyIds) {
      batch.delete(doc(db, 'story_stats', id));
    }
    batch.set(doc(db, 'site_stats', 'deleted_records'), {
      storyIds: arrayUnion(...legacyIds),
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
    batch.set(doc(db, 'system_settings', 'deleted_stories'), {
      ids: arrayUnion(...legacyIds),
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
    await batch.commit();
    console.log('[Firestore] Cleaned up legacy mock stories from story_stats.');
  } catch (err) {
    console.warn('[Firestore] Legacy mock cleanup note:', err);
  }
};

/**
 * Subscribe to published stories from Firestore with immediate local fallback.
 * Authoritative cloud synchronization ensures consistency across all devices, browsers, and users.
 */
export const subscribeToPublishedStories = (
  callback: (stories: Story[]) => void
): (() => void) => {
  // 1. Immediately provide current stories
  const initial = getStoredStories();
  callback(initial);

  // 2. Register for local broadcasts
  activeStorySubscribers.add(callback);

  // 3. Multi-tier pull (Server API -> GitHub Raw CDN -> Bundled static)
  let pollInterval: any = null;
  if (typeof window !== 'undefined') {
    const syncRemoteStories = () => {
      const applyStories = (incoming: Story[]) => {
        if (!Array.isArray(incoming) || incoming.length === 0) return;
        const current = getStoredStories();
        const currentMap = new Map(current.map((s) => [s.id, s]));
        let changed = false;
        let localDel = new Set<string>();
        try {
          const raw = localStorage.getItem('mel_deleted_story_ids');
          if (raw) localDel = new Set(JSON.parse(raw));
        } catch {}

        const cleanIncoming = incoming.filter((s) => !localDel.has(s.id) && !LEGACY_MOCK_STORY_IDS.has(s.id));
        if (cleanIncoming.length === 0) return;

        const updatedList: Story[] = [];
        for (const s of cleanIncoming) {
          const existing = currentMap.get(s.id);
          if (!existing) {
            updatedList.push(s);
          } else {
            updatedList.push({
              ...existing,
              ...s,
              views: Math.max(Number(existing.views) || 0, Number(s.views) || 0),
              likes: Math.max(Number(existing.likes) || 0, Number(s.likes) || 0),
              completedChapters: Math.max(Number(existing.completedChapters) || 0, Number(s.completedChapters) || 0),
            });
          }
        }

        try {
          localStorage.setItem('mel_published_stories', JSON.stringify(updatedList));
        } catch {}
        callback(updatedList);
        notifyStorySubscribers(updatedList);
      };

      if (hasBackendServer()) {
        fetch(buildApiUrl('/api/stories'))
          .then((res) => (res.ok ? res.json() : null))
          .then((serverStories) => {
            if (Array.isArray(serverStories) && serverStories.length > 0) {
              applyStories(serverStories);
            }
          })
          .catch(() => {});
      }

      fetchRawGithubJson<Story[]>('stories.json')
        .then((ghStories) => {
          if (Array.isArray(ghStories) && ghStories.length > 0) {
            applyStories(ghStories);
          }
        })
        .catch(() => {});
    };

    syncRemoteStories();
    pollInterval = setInterval(syncRemoteStories, 10000);
  }

  // 4. Connect to Firestore story_stats if quota is healthy
  let unsubFirestoreStats: (() => void) | null = null;
  let unsubFirestoreStories: (() => void) | null = null;

  if (!checkIsFirestoreBlocked()) {
    try {
      const statsColl = collection(db, 'story_stats');
      unsubFirestoreStats = onSnapshot(
        statsColl,
        async (snapshot) => {
          if (snapshot.empty) {
            await seedFirestoreBaselineIfEmpty();
            return;
          }

          // Fetch cloud-wide deleted story IDs to ensure deletions propagate across all devices
          let cloudDeletedIds = new Set<string>();
          try {
            const statsDel = await getDoc(doc(db, 'site_stats', 'deleted_records'));
            if (statsDel.exists()) {
              const data = statsDel.data();
              if (Array.isArray(data?.storyIds)) {
                data.storyIds.forEach((id: string) => {
                  cloudDeletedIds.add(id);
                  recordStoryDeleted(id);
                });
              }
            }
          } catch {}

          try {
            const sysDel = await getDoc(doc(db, 'system_settings', 'deleted_stories'));
            if (sysDel.exists()) {
              const data = sysDel.data();
              if (Array.isArray(data?.ids)) {
                data.ids.forEach((id: string) => {
                  cloudDeletedIds.add(id);
                  recordStoryDeleted(id);
                });
              }
            }
          } catch {}

          let localDeletedIds = new Set<string>();
          try {
            const rawDel = localStorage.getItem('mel_deleted_story_ids');
            if (rawDel) localDeletedIds = new Set(JSON.parse(rawDel));
          } catch {}

          const currentStored = getStoredStories();
          const list: Story[] = [];
          const seenIds = new Set<string>();

          snapshot.forEach((d) => {
            const item = d.data() as any;
            const sId = item.id || item.storyId || d.id;
            if (item.deleted || isStoryDeleted(sId) || cloudDeletedIds.has(sId) || localDeletedIds.has(sId) || LEGACY_MOCK_STORY_IDS.has(sId)) {
              cloudDeletedIds.add(sId);
              recordStoryDeleted(sId);
              seenIds.add(sId);
              return;
            }

            if (item.title && item.author) {
              const fullStory: Story = {
                id: sId,
                title: item.title,
                originalTitle: item.originalTitle || '',
                author: item.author,
                translator: item.translator || 'Mellifluous',
                status: item.status || 'ongoing',
                genre: Array.isArray(item.genre) && item.genre.length > 0 ? item.genre : ['Ngôn tình', 'Ngọt sủng'],
                summary: item.summary || '',
                totalChapters: Number(item.totalChapters) || 1,
                completedChapters: Number(item.completedChapters) || 0,
                mainChaptersCount: Number(item.mainChaptersCount) || Number(item.totalChapters) || 1,
                extraChaptersCount: Number(item.extraChaptersCount) || 0,
                coverImage: item.coverImage || 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=800&auto=format&fit=crop',
                colorTheme: item.colorTheme || 'from-pink-100 to-rose-200 dark:from-pink-950/40 dark:to-rose-900/40',
                hasPassword: Boolean(item.hasPassword),
                passwordHint: item.passwordHint || '',
                passwordKey: item.passwordKey || '',
                updatedAt: item.updatedAt || 'Vừa đăng',
                views: Number(item.views) || 0,
                likes: Number(item.likes) || 0,
                featured: Boolean(item.featured),
              };
              list.push(fullStory);
              seenIds.add(sId);
            } else {
              const baseStory = STORIES.find((s) => s.id === sId);
              if (baseStory && !isStoryDeleted(baseStory.id)) {
                list.push({
                  ...baseStory,
                  views: Number(item.views) || baseStory.views,
                  likes: Number(item.likes) || baseStory.likes,
                  completedChapters: Number(item.completedChapters) || baseStory.completedChapters,
                });
                seenIds.add(sId);
              }
            }
          });

          // Ensure any local author-created stories not in Firestore yet and not deleted are retained
          currentStored.forEach((stored) => {
            if (!seenIds.has(stored.id) && !isStoryDeleted(stored.id) && !cloudDeletedIds.has(stored.id) && !localDeletedIds.has(stored.id) && !LEGACY_MOCK_STORY_IDS.has(stored.id)) {
              list.push(stored);
              seenIds.add(stored.id);
            }
          });

          STORIES.forEach((base) => {
            if (!seenIds.has(base.id) && !isStoryDeleted(base.id) && !cloudDeletedIds.has(base.id) && !localDeletedIds.has(base.id) && !LEGACY_MOCK_STORY_IDS.has(base.id)) {
              list.push(base);
              seenIds.add(base.id);
            }
          });

          list.sort((a, b) => {
            const timeA = parseSafeTimestamp(a.updatedAt);
            const timeB = parseSafeTimestamp(b.updatedAt);
            if (timeA !== timeB) {
              return timeB - timeA;
            }
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
          });

          try {
            localStorage.setItem('mel_published_stories', JSON.stringify(list));
          } catch {}

          callback(list);
          notifyStorySubscribers(list);

          // Keep server API synced in background if backend server exists
          if (typeof window !== 'undefined' && hasBackendServer()) {
            safeApiFetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stories: list }),
            }).catch(() => {});
          }
        },
        (err) => {
          flagFirestoreQuotaExceeded(err);
          console.warn('story_stats snapshot notice:', err?.message || err);
        }
      );
    } catch (e) {
      flagFirestoreQuotaExceeded(e);
      console.warn('Firestore story_stats subscription error:', e);
    }
  }

  // Also safely listen to stories collection if accessible
  try {
    const storiesColl = collection(db, 'stories');
    unsubFirestoreStories = onSnapshot(
      storiesColl,
      () => {},
      () => {}
    );
  } catch {}

  return () => {
    activeStorySubscribers.delete(callback);
    if (pollInterval) clearInterval(pollInterval);
    if (unsubFirestoreStats) unsubFirestoreStats();
    if (unsubFirestoreStories) unsubFirestoreStories();
  };
};

/**
 * Save or publish a story with multi-engine persistence (Local + Server API + Firestore).
 * Guarantees zero hangs, immediate local persistence, and background cloud synchronization.
 */
export const publishStory = async (story: Story): Promise<{
  success: boolean;
  github: { attempted: boolean; success: boolean; error?: string; commitUrl?: string };
}> => {
  const nowIso = new Date().toISOString();

  // 1. If previously deleted, unmark deleted in localStorage
  try {
    const rawDel = localStorage.getItem('mel_deleted_story_ids');
    if (rawDel) {
      const delList: string[] = JSON.parse(rawDel);
      const filtered = delList.filter((id) => id !== story.id);
      localStorage.setItem('mel_deleted_story_ids', JSON.stringify(filtered));
    }
  } catch {}

  // 2. Sanitize all fields to eliminate any undefined values
  const cleanStory: Story = {
    id: story.id,
    title: story.title.trim(),
    originalTitle: (story.originalTitle || '').trim(),
    author: story.author.trim(),
    translator: (story.translator || 'Mellifluous').trim(),
    status: story.status || 'ongoing',
    genre: Array.isArray(story.genre) && story.genre.length > 0 ? story.genre : ['Ngôn tình', 'Ngọt sủng'],
    summary: (story.summary || '').trim(),
    totalChapters: Number(story.totalChapters) || 1,
    completedChapters: Number(story.completedChapters) || 0,
    mainChaptersCount: Number(story.mainChaptersCount) || Number(story.totalChapters) || 1,
    extraChaptersCount: Number(story.extraChaptersCount) || 0,
    coverImage: story.coverImage || 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=800&auto=format&fit=crop',
    colorTheme: story.colorTheme || 'from-pink-100 to-rose-200 dark:from-pink-950/40 dark:to-rose-900/40',
    hasPassword: Boolean(story.hasPassword),
    passwordHint: (story.passwordHint || '').trim(),
    passwordKey: (story.passwordKey || '').trim().toLowerCase(),
    updatedAt: nowIso,
    views: Number(story.views) || 0,
    likes: Number(story.likes) || 0,
    featured: Boolean(story.featured),
  };

  // 3. Ensure live runtime cache has chapters initialized for this story
  if (getLiveChaptersRuntimeCache()[cleanStory.id] === undefined) {
    setLiveStoryChapters(cleanStory.id, getStoryChapters(cleanStory.id));
  }

  // 4. Synchronously persist into localStorage & runtime memory cache (INSTANT 0ms lag)
  try {
    const currentList = getStoredStories();
    const idx = currentList.findIndex((s) => s.id === cleanStory.id);
    let updatedList: Story[];
    if (idx >= 0) {
      updatedList = [...currentList];
      updatedList[idx] = cleanStory;
    } else {
      updatedList = [cleanStory, ...currentList];
    }
    localStorage.setItem('mel_published_stories', JSON.stringify(updatedList));
    notifyStorySubscribers(updatedList);
  } catch (localErr) {
    console.warn('Local storage save warning:', localErr);
  }

  // 5. Parallel background sync with timeout protection
  const syncTasks: Promise<any>[] = [];

  // A. Central Server API sync (instant and reliable)
  syncTasks.push(
    fetchWithTimeout('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanStory),
    }, 4000).catch((apiErr) => {
      console.warn('Server API story save note:', apiErr);
    })
  );

  // B. Firestore cloud sync (only if quota is healthy)
  if (!checkIsFirestoreBlocked()) {
    const firestoreSync = async () => {
      try {
        const fullStoryData = sanitizeForFirestore({
          ...cleanStory,
          storyId: cleanStory.id,
          deleted: false,
          updatedAt: nowIso,
          publishedAt: nowIso,
        });

        const statsRef = doc(db, 'story_stats', cleanStory.id);
        await setDoc(statsRef, fullStoryData, { merge: true });

        const storyRef = doc(db, 'stories', cleanStory.id);
        await setDoc(storyRef, fullStoryData, { merge: true }).catch(() => {});

        // Use setDoc merge instead of updateDoc to avoid crashing if doc does not exist
        const statsDelRef = doc(db, 'site_stats', 'deleted_records');
        await setDoc(statsDelRef, { storyIds: arrayRemove(cleanStory.id) }, { merge: true }).catch(() => {});

        const sysDelRef = doc(db, 'system_settings', 'deleted_stories');
        await setDoc(sysDelRef, { ids: arrayRemove(cleanStory.id) }, { merge: true }).catch(() => {});
      } catch (firestoreErr: any) {
        flagFirestoreQuotaExceeded(firestoreErr);
        console.warn('Firestore cloud sync note:', firestoreErr?.message || firestoreErr);
      }
    };

    syncTasks.push(withTimeout(firestoreSync(), 2500).catch((err) => console.warn('Firestore story timeout:', err)));
  }

  // C. GitHub Repository direct commit (if token configured and autoSync is enabled)
  const ghConfig = getGithubConfig();
  const ghCommitResult: { attempted: boolean; success: boolean; error?: string; commitUrl?: string } = {
    attempted: false,
    success: false,
  };

  if (ghConfig.token && ghConfig.autoSync) {
    ghCommitResult.attempted = true;
    const updatedStories = getStoredStories();
    const ghTask = commitGithubDataFile('stories.json', updatedStories, `Cập nhật tác phẩm: ${cleanStory.title} [skip ci]`)
      .then((res) => {
        ghCommitResult.success = res.success;
        ghCommitResult.error = res.error;
        ghCommitResult.commitUrl = res.commitUrl;
      })
      .catch((err) => {
        ghCommitResult.success = false;
        ghCommitResult.error = err?.message || 'Lỗi commit GitHub API';
        console.warn('[GitHubSync] Story commit note:', err);
      });
    syncTasks.push(ghTask);
  }

  // Safely wait for background tasks without hanging
  await Promise.allSettled(syncTasks);
  return { success: true, github: ghCommitResult };
};

/**
 * Delete a story with multi-engine persistence (Local + Server API + Firestore).
 * Guarantees deletion propagates to all devices and clients.
 */
export const deleteStory = async (storyId: string): Promise<void> => {
  // 1. Mark as deleted globally in runtime cache, mockData sets, and localStorage
  recordStoryDeleted(storyId);
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
  if (aliasId) recordStoryDeleted(aliasId);

  // 2. Remove from localStorage and runtime memory cache
  try {
    const currentList = getStoredStories();
    const updatedList = currentList.filter((s) => s.id !== storyId && s.id !== aliasId);
    localStorage.setItem('mel_published_stories', JSON.stringify(updatedList));
    localStorage.removeItem(`mel_chapters_${storyId}`);
    if (aliasId) localStorage.removeItem(`mel_chapters_${aliasId}`);
    setLiveStoryChapters(storyId, []);
    if (aliasId) setLiveStoryChapters(aliasId, []);
    notifyStorySubscribers(updatedList);
    notifyChapterSubscribers(storyId, []);
    if (aliasId) notifyChapterSubscribers(aliasId, []);
  } catch (localErr) {
    console.warn('Local delete warning:', localErr);
  }

  // 3. Background Central Server API delete & Firestore delete
  const delTasks: Promise<any>[] = [];

  delTasks.push(
    fetchWithTimeout(`/api/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
    }, 4000).catch((apiErr) => {
      console.warn('Server API delete story warning:', apiErr);
    })
  );

  if (!checkIsFirestoreBlocked()) {
    const firestoreDelete = async () => {
      try {
        await setDoc(doc(db, 'story_stats', storyId), { deleted: true, storyId, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        await deleteDoc(doc(db, 'stories', storyId)).catch(() => {});

        const statsDelRef = doc(db, 'site_stats', 'deleted_records');
        await setDoc(statsDelRef, { storyIds: arrayUnion(storyId) }, { merge: true }).catch(() => {});

        const sysDelRef = doc(db, 'system_settings', 'deleted_stories');
        await setDoc(sysDelRef, { ids: arrayUnion(storyId) }, { merge: true }).catch(() => {});

        // Delete all chapters belonging to this story from chapter_stats
        const qStats = query(collection(db, 'chapter_stats'), where('storyId', '==', storyId));
        const snapStats = await getDocs(qStats);
        const batchStats = writeBatch(db);
        snapStats.forEach((d) => {
          batchStats.set(doc(db, 'chapter_stats', d.id), { deleted: true }, { merge: true });
          batchStats.delete(d.ref);
        });
        await batchStats.commit().catch(() => {});

        // Also attempt old chapters collection
        try {
          const chaptersColl = collection(db, 'chapters');
          const q = query(chaptersColl, where('storyId', '==', storyId));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit().catch(() => {});
        } catch {}
      } catch (firestoreErr: any) {
        flagFirestoreQuotaExceeded(firestoreErr);
        console.warn('Firestore delete warning:', firestoreErr?.message || firestoreErr);
      }
    };

    delTasks.push(withTimeout(firestoreDelete(), 2500).catch((err) => console.warn('Firestore delete timeout:', err)));
  }

  // C. GitHub Repository direct commit (if token configured and autoSync is enabled)
  const ghConfig = getGithubConfig();
  if (ghConfig.token && ghConfig.autoSync) {
    const updatedStories = getStoredStories();
    delTasks.push(
      commitGithubDataFile('stories.json', updatedStories, `Xóa tác phẩm ID: ${storyId} [skip ci]`).catch((err) => {
        console.warn('[GitHubSync] Story delete commit note:', err);
      })
    );
  }

  await Promise.allSettled(delTasks);
};

/**
 * Subscribe to all chapters across the entire site in real time.
 * Automatically organizes chapters by storyId and notifies subscribers.
 */
export const subscribeToAllChapters = (
  callback: (chaptersMap: Record<string, Chapter[]>) => void
): (() => void) => {
  // 1. Provide current memory cache
  callback(getLiveChaptersRuntimeCache());
  activeAllChaptersSubscribers.add(callback);

  // 2. Fetch from server API & GitHub Raw CDN for multi-device sync
  let pollChaptersInterval: any = null;
  if (typeof window !== 'undefined') {
    const syncRemoteChapters = () => {
      const applyChaptersMap = (chaptersMap: any) => {
        if (chaptersMap && typeof chaptersMap === 'object') {
          for (const [sId, chList] of Object.entries(chaptersMap as Record<string, Chapter[]>)) {
            if (Array.isArray(chList) && chList.length > 0) {
              const currentList = getStoryChapters(sId);
              const merged = mergeChapters(currentList, chList);
              try {
                localStorage.setItem(`mel_chapters_${sId}`, JSON.stringify(merged));
              } catch {}
              setLiveStoryChapters(sId, merged);
              notifyChapterSubscribers(sId, merged);
            }
          }
          const fullCache = getLiveChaptersRuntimeCache();
          callback(fullCache);
          notifyAllChaptersSubscribers(fullCache);
        }
      };

      if (hasBackendServer()) {
        fetch(buildApiUrl('/api/chapters'))
          .then((res) => (res.ok ? res.json() : null))
          .then((chaptersMap) => {
            if (chaptersMap && typeof chaptersMap === 'object' && Object.keys(chaptersMap).length > 0) {
              applyChaptersMap(chaptersMap);
            }
          })
          .catch(() => {});
      }

      fetchRawGithubJson<Record<string, Chapter[]>>('chapters.json')
        .then((ghMap) => {
          if (ghMap && typeof ghMap === 'object') {
            applyChaptersMap(ghMap);
          }
        })
        .catch(() => {});
    };

    syncRemoteChapters();
    pollChaptersInterval = setInterval(syncRemoteChapters, 35000);
  }

  // 3. Listen to Firestore collection 'chapter_stats' if quota is healthy
  let unsubFirestore: (() => void) | null = null;
  if (!checkIsFirestoreBlocked()) {
    try {
      const chaptersColl = collection(db, 'chapter_stats');
      unsubFirestore = onSnapshot(
        chaptersColl,
        async (snapshot) => {
          let cloudDeletedChapterIds = new Set<string>();
          try {
            const statsDel = await getDoc(doc(db, 'site_stats', 'deleted_records'));
            if (statsDel.exists()) {
              const data = statsDel.data();
              if (Array.isArray(data?.chapterIds)) {
                data.chapterIds.forEach((id: string) => cloudDeletedChapterIds.add(id));
              }
            }
          } catch {}

          const grouped: Record<string, Chapter[]> = {};
          const storiesWithCloudChapters = new Set<string>();

          snapshot.forEach((d) => {
            const ch = { ...(d.data() as any), id: d.id };
            if (ch.storyId) storiesWithCloudChapters.add(ch.storyId);
            if (ch.deleted) {
              cloudDeletedChapterIds.add(ch.id);
            } else if (ch.storyId && !cloudDeletedChapterIds.has(ch.id)) {
              if (!grouped[ch.storyId]) grouped[ch.storyId] = [];
              grouped[ch.storyId].push(ch);
            }
          });

          // Link aliases
          if (grouped['anh-dao-5cm'] && !grouped['anh-dao-nam-centimet']) {
            grouped['anh-dao-nam-centimet'] = grouped['anh-dao-5cm'];
          } else if (grouped['anh-dao-nam-centimet'] && !grouped['anh-dao-5cm']) {
            grouped['anh-dao-5cm'] = grouped['anh-dao-nam-centimet'];
          }

          // Only fallback to baseline sample chapters for stories that have never had chapters published in Firestore
          const currentStories = getStoredStories();
          currentStories.forEach((s) => {
            if (!storiesWithCloudChapters.has(s.id) && (!grouped[s.id] || grouped[s.id].length === 0)) {
              const baseSamples = (SAMPLE_CHAPTERS[s.id] || []).filter((ch) => !cloudDeletedChapterIds.has(ch.id));
              if (baseSamples.length > 0) {
                grouped[s.id] = baseSamples;
              }
            }
          });

          // For each story, sort and update
          for (const [sId, chList] of Object.entries(grouped)) {
            if (isStoryDeleted(sId)) continue;
            chList.sort((a, b) => {
              const numA = Number(a.chapterNumber) || 0;
              const numB = Number(b.chapterNumber) || 0;
              if (numA !== numB) return numA - numB;
              const isExtraA = a.isExtra || a.partType === 'extra' ? 1 : 0;
              const isExtraB = b.isExtra || b.partType === 'extra' ? 1 : 0;
              return isExtraA - isExtraB;
            });
            try {
              localStorage.setItem(`mel_chapters_${sId}`, JSON.stringify(chList));
            } catch {}
            setLiveStoryChapters(sId, chList);
            notifyChapterSubscribers(sId, chList);
          }

          const fullCache = getLiveChaptersRuntimeCache();
          callback(fullCache);
          notifyAllChaptersSubscribers(fullCache);

          // Keep server API synced in background if backend server exists
          if (typeof window !== 'undefined' && hasBackendServer()) {
            safeApiFetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chapters: fullCache }),
            }).catch(() => {});
          }
        },
        (err) => {
          flagFirestoreQuotaExceeded(err);
          console.warn('chapter_stats snapshot error:', err?.message || err);
        }
      );
    } catch (e) {
      flagFirestoreQuotaExceeded(e);
      console.warn('Firestore chapter_stats subscription error:', e);
    }
  }

  return () => {
    activeAllChaptersSubscribers.delete(callback);
    if (pollChaptersInterval) clearInterval(pollChaptersInterval);
    if (unsubFirestore) unsubFirestore();
  };
};

/**
 * Subscribe to chapters for a story with real-time cloud and server synchronization.
 */
export const subscribeToStoryChapters = (
  storyId: string,
  callback: (chapters: Chapter[]) => void
): (() => void) => {
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;

  // 1. Provide combined local chapters immediately
  const initial = getStoryChapters(storyId);
  callback(initial);

  // 2. Register for memory updates
  if (!activeChapterSubscribers.has(storyId)) {
    activeChapterSubscribers.set(storyId, new Set());
  }
  activeChapterSubscribers.get(storyId)!.add(callback);
  if (aliasId) {
    if (!activeChapterSubscribers.has(aliasId)) {
      activeChapterSubscribers.set(aliasId, new Set());
    }
    activeChapterSubscribers.get(aliasId)!.add(callback);
  }

  // 3. Immediately query Server API with GitHub fallback for real-time consistency across devices
  if (typeof window !== 'undefined') {
    const handleIncomingChapters = (incoming: Chapter[]) => {
      if (Array.isArray(incoming) && incoming.length > 0) {
        const currentList = getStoryChapters(storyId);
        const merged = mergeChapters(currentList, incoming);
        setLiveStoryChapters(storyId, merged);
        try {
          localStorage.setItem(`mel_chapters_${storyId}`, JSON.stringify(merged));
          if (aliasId) localStorage.setItem(`mel_chapters_${aliasId}`, JSON.stringify(merged));
        } catch {}
        callback(merged);
        notifyChapterSubscribers(storyId, merged);
        if (aliasId) notifyChapterSubscribers(aliasId, merged);
      }
    };

    if (hasBackendServer()) {
      fetch(buildApiUrl(`/api/chapters?storyId=${encodeURIComponent(storyId)}`))
        .then((res) => (res.ok ? res.json() : null))
        .then((serverList) => {
          if (Array.isArray(serverList) && serverList.length > 0) {
            handleIncomingChapters(serverList);
          } else {
            // Fallback to GitHub raw JSON
            fetchRawGithubJson<Record<string, Chapter[]>>('chapters.json')
              .then((allChapters) => {
                if (allChapters) {
                  const list = allChapters[storyId] || (aliasId ? allChapters[aliasId] : null);
                  if (Array.isArray(list) && list.length > 0) {
                    handleIncomingChapters(list);
                  }
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          // Fallback to GitHub raw JSON on network error
          fetchRawGithubJson<Record<string, Chapter[]>>('chapters.json')
            .then((allChapters) => {
              if (allChapters) {
                const list = allChapters[storyId] || (aliasId ? allChapters[aliasId] : null);
                if (Array.isArray(list) && list.length > 0) {
                  handleIncomingChapters(list);
                }
              }
            })
            .catch(() => {});
        });
    } else {
      // Direct GitHub Raw JSON fallback on static hosting without custom backend
      fetchRawGithubJson<Record<string, Chapter[]>>('chapters.json')
        .then((allChapters) => {
          if (allChapters) {
            const list = allChapters[storyId] || (aliasId ? allChapters[aliasId] : null);
            if (Array.isArray(list) && list.length > 0) {
              handleIncomingChapters(list);
            }
          }
        })
        .catch(() => {});
    }
  }

  // 4. Connect to Firestore query on chapter_stats if quota is healthy
  let unsubFirestore: (() => void) | null = null;
  if (!checkIsFirestoreBlocked()) {
    try {
      const chaptersColl = collection(db, 'chapter_stats');
      const queryIds = [storyId];
      if (aliasId) queryIds.push(aliasId);

      const q = queryIds.length > 1
        ? query(chaptersColl, where('storyId', 'in', queryIds))
        : query(chaptersColl, where('storyId', '==', storyId));

      unsubFirestore = onSnapshot(
        q,
        async (snapshot) => {
          let cloudDeletedChapterIds = new Set<string>();
          try {
            const statsDel = await getDoc(doc(db, 'site_stats', 'deleted_records'));
            if (statsDel.exists()) {
              const data = statsDel.data();
              if (Array.isArray(data?.chapterIds)) {
                data.chapterIds.forEach((id: string) => cloudDeletedChapterIds.add(id));
              }
            }
          } catch {}

          const cloudChapters: Chapter[] = [];
          let hasAnyDocForThisStory = false;
          snapshot.forEach((d) => {
            hasAnyDocForThisStory = true;
            const ch = { ...(d.data() as any), id: d.id };
            if (ch.deleted) {
              cloudDeletedChapterIds.add(ch.id);
            } else if (!cloudDeletedChapterIds.has(ch.id)) {
              cloudChapters.push(ch);
            }
          });

          let finalChapters: Chapter[] = [];

          if (cloudChapters.length > 0) {
            finalChapters = cloudChapters;
          } else if (hasAnyDocForThisStory) {
            finalChapters = [];
          } else {
            const baseSamples = (SAMPLE_CHAPTERS[storyId] || (aliasId ? SAMPLE_CHAPTERS[aliasId] : []) || []);
            finalChapters = baseSamples.filter((ch) => !cloudDeletedChapterIds.has(ch.id));
          }

          finalChapters.sort((a, b) => {
            const numA = Number(a.chapterNumber) || 0;
            const numB = Number(b.chapterNumber) || 0;
            if (numA !== numB) return numA - numB;
            const isExtraA = a.isExtra || a.partType === 'extra' ? 1 : 0;
            const isExtraB = b.isExtra || b.partType === 'extra' ? 1 : 0;
            return isExtraA - isExtraB;
          });

          try {
            localStorage.setItem(`mel_chapters_${storyId}`, JSON.stringify(finalChapters));
            if (aliasId) localStorage.setItem(`mel_chapters_${aliasId}`, JSON.stringify(finalChapters));
          } catch {}
          setLiveStoryChapters(storyId, finalChapters);
          callback(finalChapters);
          notifyChapterSubscribers(storyId, finalChapters);
        },
        (err) => {
          flagFirestoreQuotaExceeded(err);
          console.warn(`chapter_stats snapshot error for ${storyId}:`, err?.message || err);
        }
      );
    } catch (e) {
      flagFirestoreQuotaExceeded(e);
      console.warn('Firestore chapter_stats subscription error:', e);
    }
  }

  return () => {
    activeChapterSubscribers.get(storyId)?.delete(callback);
    if (aliasId) activeChapterSubscribers.get(aliasId)?.delete(callback);
    if (unsubFirestore) unsubFirestore();
  };
};

/**
 * Publish a new chapter or extra for a story with multi-engine persistence (Local + Server API + Firestore).
 * Guarantees immediate UI update and zero hanging promises.
 */
export const publishChapter = async (chapter: Chapter): Promise<{
  success: boolean;
  github: { attempted: boolean; success: boolean; error?: string; commitUrl?: string };
}> => {
  const nowIso = new Date().toISOString();

  // 1. Sanitize all fields to eliminate undefined values
  const cleanChapter: Chapter = {
    id: chapter.id,
    storyId: chapter.storyId,
    chapterNumber: Number(chapter.chapterNumber) || 1,
    title: chapter.title.trim(),
    publishedAt: chapter.publishedAt || nowIso,
    updatedAt: nowIso,
    isLocked: Boolean(chapter.isLocked),
    passwordHint: (chapter.passwordHint || '').trim(),
    passwordKey: (chapter.passwordKey || '').trim().toLowerCase(),
    content: chapter.content.trim(),
    translatorNote: (chapter.translatorNote || '').trim(),
    wordCount: Number(chapter.wordCount) || (chapter.content ? chapter.content.trim().split(/\s+/).filter(Boolean).length : 0),
    isExtra: Boolean(chapter.isExtra),
    extraNumber: chapter.extraNumber || (chapter.isExtra ? Number(chapter.chapterNumber) : 0),
    partType: chapter.partType || (chapter.isExtra ? 'extra' : 'main'),
  };

  // 2. Save chapter to localStorage and runtime memory cache immediately (INSTANT 0ms lag)
  saveCustomChapterToStorage(cleanChapter);

  // 3. Update memory cache and notify chapter listeners immediately
  const allChapters = getStoryChapters(cleanChapter.storyId);
  setLiveStoryChapters(cleanChapter.storyId, allChapters);
  notifyChapterSubscribers(cleanChapter.storyId, allChapters);

  const aliasId = cleanChapter.storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : cleanChapter.storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
  if (aliasId) {
    setLiveStoryChapters(aliasId, allChapters);
    notifyChapterSubscribers(aliasId, allChapters);
  }

  activeAllChaptersSubscribers.forEach((cb) => {
    try { cb(getLiveChaptersRuntimeCache()); } catch {}
  });

  // 4. Update story completedChapters count in localStorage and notify
  try {
    const stories = getStoredStories();
    const target = stories.find((s) => s.id === cleanChapter.storyId || (aliasId && s.id === aliasId));
    if (target) {
      target.completedChapters = allChapters.length;
      target.updatedAt = nowIso;
      localStorage.setItem('mel_published_stories', JSON.stringify(stories));
      notifyStorySubscribers(stories);
    }
  } catch (err) {
    console.warn('Update story chapters count warning:', err);
  }

  // 5. Parallel background sync with timeout protection
  const syncTasks: Promise<any>[] = [];

  // A. Central Server API sync (instant and reliable)
  syncTasks.push(
    fetchWithTimeout('/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanChapter),
    }, 4000).catch((apiErr) => {
      console.warn('Server API chapter save note:', apiErr);
    })
  );

  // B. Firestore sync (only if quota is healthy)
  if (!checkIsFirestoreBlocked()) {
    const firestoreSync = async () => {
      try {
        const fullChapterData = sanitizeForFirestore({
          ...cleanChapter,
          chapterId: cleanChapter.id,
          deleted: false,
          publishedAt: cleanChapter.publishedAt || nowIso,
          updatedAt: nowIso,
        });

        const chapterStatsRef = doc(db, 'chapter_stats', cleanChapter.id);
        await setDoc(chapterStatsRef, fullChapterData, { merge: true });

        // Safely unmark from deleted records using setDoc merge
        const statsDelRef = doc(db, 'site_stats', 'deleted_records');
        await setDoc(statsDelRef, {
          chapterIds: arrayRemove(cleanChapter.id),
          storyIds: arrayRemove(cleanChapter.storyId),
        }, { merge: true }).catch(() => {});

        // Unmark story from local deleted list if present
        try {
          const rawDel = localStorage.getItem('mel_deleted_story_ids');
          if (rawDel) {
            const delList: string[] = JSON.parse(rawDel);
            const filtered = delList.filter((id) => id !== cleanChapter.storyId && (!aliasId || id !== aliasId));
            localStorage.setItem('mel_deleted_story_ids', JSON.stringify(filtered));
          }
        } catch {}

        // Update story_stats completedChapters & ensure deleted: false
        const storyStatsRef = doc(db, 'story_stats', cleanChapter.storyId);
        await setDoc(
          storyStatsRef,
          {
            storyId: cleanChapter.storyId,
            completedChapters: allChapters.length,
            updatedAt: nowIso,
            deleted: false,
          },
          { merge: true }
        );

        // Background writes to chapters & stories collections
        const chapterRef = doc(db, 'chapters', cleanChapter.id);
        await setDoc(chapterRef, fullChapterData, { merge: true }).catch(() => {});
        const storyRef = doc(db, 'stories', cleanChapter.storyId);
        await setDoc(storyRef, { completedChapters: allChapters.length, updatedAt: nowIso, deleted: false }, { merge: true }).catch(() => {});
      } catch (firestoreErr: any) {
        flagFirestoreQuotaExceeded(firestoreErr);
        console.warn('Firestore publish chapter note:', firestoreErr?.message || firestoreErr);
      }
    };

    syncTasks.push(withTimeout(firestoreSync(), 2500).catch((err) => console.warn('Firestore chapter timeout:', err)));
  }

  // C. GitHub Repository direct commit (if token configured and autoSync is enabled)
  const ghConfig = getGithubConfig();
  const ghCommitResult: { attempted: boolean; success: boolean; error?: string; commitUrl?: string } = {
    attempted: false,
    success: false,
  };

  if (ghConfig.token && ghConfig.autoSync) {
    ghCommitResult.attempted = true;
    const stories = getStoredStories();
    const rawChapters = getLiveChaptersRuntimeCache();
    const fullChaptersMap: Record<string, Chapter[]> = {};
    stories.forEach((s) => {
      fullChaptersMap[s.id] = rawChapters[s.id] || getStoryChapters(s.id) || [];
    });
    fullChaptersMap[cleanChapter.storyId] = allChapters;
    if (aliasId) fullChaptersMap[aliasId] = allChapters;

    const ghTask = commitGithubDataFile(
      'chapters.json',
      fullChaptersMap,
      `Cập nhật chương ${cleanChapter.chapterNumber}: ${cleanChapter.title} (${cleanChapter.storyId}) [skip ci]`
    )
      .then((res) => {
        ghCommitResult.success = res.success;
        ghCommitResult.error = res.error;
        ghCommitResult.commitUrl = res.commitUrl;
      })
      .catch((err) => {
        ghCommitResult.success = false;
        ghCommitResult.error = err?.message || 'Lỗi commit GitHub API';
        console.warn('[GitHubSync] Chapter commit note:', err);
      });
    syncTasks.push(ghTask);
  }

  await Promise.allSettled(syncTasks);
  return { success: true, github: ghCommitResult };
};

/**
 * Delete a chapter with multi-engine persistence (Local + Server API + Firestore).
 */
export const deleteChapter = async (storyId: string, chapterId: string): Promise<void> => {
  deleteCustomChapterFromStorage(storyId, chapterId);
  const remaining = getStoryChapters(storyId).filter((c) => c.id !== chapterId);
  setLiveStoryChapters(storyId, remaining);
  notifyChapterSubscribers(storyId, remaining);
  activeAllChaptersSubscribers.forEach((cb) => {
    try { cb(getLiveChaptersRuntimeCache()); } catch {}
  });

  // Update story completedChapters in local storage and notify
  try {
    const stories = getStoredStories();
    const target = stories.find((s) => s.id === storyId);
    if (target) {
      target.completedChapters = remaining.length;
      localStorage.setItem('mel_published_stories', JSON.stringify(stories));
      notifyStorySubscribers(stories);
    }
  } catch {}

  const delTasks: Promise<any>[] = [];

  // Server API delete with timeout
  delTasks.push(
    fetchWithTimeout(`/api/chapters/${encodeURIComponent(chapterId)}?storyId=${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
    }, 6000).catch((apiErr) => {
      console.warn('Server API chapter delete warning:', apiErr);
    })
  );

  // Cloud Firestore delete with timeout
  const firestoreDelete = async () => {
    try {
      await setDoc(doc(db, 'chapter_stats', chapterId), { deleted: true, id: chapterId, storyId }, { merge: true }).catch(() => {});
      await deleteDoc(doc(db, 'chapters', chapterId)).catch(() => {});

      // Record deletion in site_stats/deleted_records
      const statsDelRef = doc(db, 'site_stats', 'deleted_records');
      await setDoc(statsDelRef, { chapterIds: arrayUnion(chapterId) }, { merge: true }).catch(() => {});

      // Update story_stats completedChapters
      const storyStatsRef = doc(db, 'story_stats', storyId);
      await setDoc(
        storyStatsRef,
        { completedChapters: remaining.length, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});

      // Also attempt chapters & stories collections
      const storyRef = doc(db, 'stories', storyId);
      await setDoc(storyRef, { completedChapters: remaining.length, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn('Firestore delete chapter note:', err);
    }
  };

  delTasks.push(withTimeout(firestoreDelete(), 10000).catch((err) => console.warn('Firestore delete chapter timeout:', err)));

  // GitHub commit
  const ghConfig = getGithubConfig();
  if (ghConfig.token && ghConfig.autoSync) {
    const fullChaptersCache = getLiveChaptersRuntimeCache();
    delTasks.push(
      commitGithubDataFile('chapters.json', fullChaptersCache, `Xóa chương ID: ${chapterId} [skip ci]`).catch((err) => {
        console.warn('[GitHubSync] Chapter delete commit note:', err);
      })
    );
  }

  await Promise.allSettled(delTasks);
};

/**
 * Subscribe to Announcements / Notice board posts.
 */
export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void
): (() => void) => {
  // 1. Provide stored announcements immediately
  callback(getStoredAnnouncements());

  // 2. Register active memory listener
  activeAnnouncementSubscribers.add(callback);

  // 3. Immediately pull from Server API with GitHub Raw fallback
  let pollAnnInterval: any = null;
  if (typeof window !== 'undefined') {
    const syncAnnouncements = () => {
      if (hasBackendServer()) {
        fetch(buildApiUrl('/api/announcements'))
          .then((res) => (res.ok ? res.json() : null))
          .then((serverAnn) => {
            if (Array.isArray(serverAnn) && serverAnn.length > 0) {
              try {
                localStorage.setItem('mel_announcements', JSON.stringify(serverAnn));
              } catch {}
              callback(serverAnn);
            } else {
              fetchRawGithubJson<Announcement[]>('announcements.json')
                .then((ghAnn) => {
                  if (Array.isArray(ghAnn) && ghAnn.length > 0) {
                    try {
                      localStorage.setItem('mel_announcements', JSON.stringify(ghAnn));
                    } catch {}
                    callback(ghAnn);
                  }
                })
                .catch(() => {});
            }
          })
          .catch(() => {
            fetchRawGithubJson<Announcement[]>('announcements.json')
              .then((ghAnn) => {
                if (Array.isArray(ghAnn) && ghAnn.length > 0) {
                  try {
                    localStorage.setItem('mel_announcements', JSON.stringify(ghAnn));
                  } catch {}
                  callback(ghAnn);
                }
              })
              .catch(() => {});
          });
      } else {
        fetchRawGithubJson<Announcement[]>('announcements.json')
          .then((ghAnn) => {
            if (Array.isArray(ghAnn) && ghAnn.length > 0) {
              try {
                localStorage.setItem('mel_announcements', JSON.stringify(ghAnn));
              } catch {}
              callback(ghAnn);
            }
          })
          .catch(() => {});
      }
    };

    syncAnnouncements();
    pollAnnInterval = setInterval(syncAnnouncements, 60000);
  }

  // 4. Connect to Firestore only if quota is healthy
  let unsubFirestore: (() => void) | null = null;
  if (!checkIsFirestoreBlocked()) {
    try {
      const coll = collection(db, 'announcements');
      const q = query(coll, orderBy('date', 'desc'), limit(20));

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Announcement[] = [];
            snapshot.forEach((d) => {
              list.push({ ...(d.data() as Announcement), id: d.id });
            });
            try {
              localStorage.setItem('mel_announcements', JSON.stringify(list));
            } catch {}
            callback(list);
          }
        },
        (err) => {
          flagFirestoreQuotaExceeded(err);
          console.warn('Announcements snapshot warning:', err?.message || err);
        }
      );
    } catch (e) {
      flagFirestoreQuotaExceeded(e);
      console.warn('Firestore announcement subscription error:', e);
    }
  }

  return () => {
    activeAnnouncementSubscribers.delete(callback);
    if (pollAnnInterval) clearInterval(pollAnnInterval);
    if (unsubFirestore) unsubFirestore();
  };
};

/**
 * Publish an announcement with multi-engine persistence.
 */
export const publishAnnouncement = async (announcement: Announcement): Promise<void> => {
  const cleanAnn: Announcement = {
    id: announcement.id,
    title: announcement.title.trim(),
    tag: announcement.tag || 'Thông báo',
    content: announcement.content.trim(),
    date: announcement.date || new Date().toLocaleDateString('vi-VN'),
    isPinned: Boolean(announcement.isPinned),
  };

  let updatedAnnouncements: Announcement[] = [];
  try {
    const current = getStoredAnnouncements();
    updatedAnnouncements = [cleanAnn, ...current.filter((a) => a.id !== cleanAnn.id)];
    localStorage.setItem('mel_announcements', JSON.stringify(updatedAnnouncements));
    notifyAnnouncementSubscribers(updatedAnnouncements);
  } catch (err) {
    console.warn('Local announcement save warning:', err);
  }

  const tasks: Promise<any>[] = [];

  tasks.push(
    fetchWithTimeout('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanAnn),
    }, 3000).catch((apiErr) => {
      console.warn('Server API announcement save warning:', apiErr);
    })
  );

  if (!checkIsFirestoreBlocked()) {
    const firestoreSave = async () => {
      try {
        const noticeRef = doc(db, 'announcements', cleanAnn.id);
        await setDoc(noticeRef, cleanAnn);
      } catch (firestoreErr) {
        flagFirestoreQuotaExceeded(firestoreErr);
        console.warn('Firestore announcement save warning:', firestoreErr);
      }
    };
    tasks.push(withTimeout(firestoreSave(), 3500).catch((err) => console.warn('Firestore announcement timeout:', err)));
  }

  // GitHub Sync
  const ghConfig = getGithubConfig();
  if (ghConfig.token && ghConfig.autoSync) {
    tasks.push(
      commitGithubDataFile(
        'announcements.json',
        updatedAnnouncements,
        `Cập nhật thông báo: ${cleanAnn.title} [skip ci]`
      ).catch((err) => {
        console.warn('[GitHubSync] Announcement commit note:', err);
      })
    );
  }

  await Promise.allSettled(tasks);
};

/**
 * Delete an announcement with dual persistence.
 */
export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  let updatedAnn: Announcement[] = [];
  try {
    const current = getStoredAnnouncements();
    updatedAnn = current.filter((a) => a.id !== announcementId);
    localStorage.setItem('mel_announcements', JSON.stringify(updatedAnn));
    notifyAnnouncementSubscribers(updatedAnn);
  } catch (err) {
    console.warn('Local announcement delete warning:', err);
  }

  const tasks: Promise<any>[] = [];

  if (!checkIsFirestoreBlocked()) {
    const firestoreDel = async () => {
      try {
        await deleteDoc(doc(db, 'announcements', announcementId));
      } catch (firestoreErr) {
        flagFirestoreQuotaExceeded(firestoreErr);
        console.warn('Firestore announcement delete warning:', firestoreErr);
      }
    };
    tasks.push(withTimeout(firestoreDel(), 3500).catch((err) => console.warn('Firestore delete announcement timeout:', err)));
  }

  // GitHub Sync
  const ghConfig = getGithubConfig();
  if (ghConfig.token && ghConfig.autoSync) {
    tasks.push(
      commitGithubDataFile(
        'announcements.json',
        updatedAnn,
        `Xóa thông báo ID: ${announcementId} [skip ci]`
      ).catch((err) => {
        console.warn('[GitHubSync] Announcement delete commit note:', err);
      })
    );
  }

  await Promise.allSettled(tasks);
};

/**
 * Seed initial sample stories with STRICTLY 0 stats.
 */
export const seedSampleStoriesWithZeroStats = async (): Promise<void> => {
  // 1. Seed into localStorage with 0 stats
  const cleanZeroStories: Story[] = STORIES.map((s) => ({
    ...s,
    views: 0,
    likes: 0,
    updatedAt: 'Vừa đăng',
  }));

  try {
    localStorage.setItem('mel_published_stories', JSON.stringify(cleanZeroStories));
    localStorage.setItem('mel_announcements', JSON.stringify(ANNOUNCEMENTS));
    notifyStorySubscribers(cleanZeroStories);
    notifyAnnouncementSubscribers(ANNOUNCEMENTS);
  } catch (err) {
    console.warn('Local seed error:', err);
  }

  // 2. Seed into Firestore
  try {
    const batch = writeBatch(db);

    for (const s of cleanZeroStories) {
      const storyRef = doc(db, 'stories', s.id);
      batch.set(storyRef, s);

      const statsRef = doc(db, 'story_stats', s.id);
      batch.set(statsRef, {
        storyId: s.id,
        views: 0,
        likes: 0,
        followers: 0,
        ratingSum: 0,
        ratingCount: 0,
        commentCount: 0,
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed sample chapters
    for (const [storyId, chapters] of Object.entries(SAMPLE_CHAPTERS)) {
      for (const ch of chapters) {
        const chRef = doc(db, 'chapters', ch.id);
        batch.set(chRef, ch);
      }
    }

    // Seed sample announcements
    for (const ann of ANNOUNCEMENTS) {
      const annRef = doc(db, 'announcements', ann.id);
      batch.set(annRef, ann);
    }

    await batch.commit();
    await resetAllMetricsToZero();
  } catch (err) {
    console.warn('Firestore seed warning (local seed applied):', err);
  }
};

/**
 * Clear all stories and chapters for a 100% clean publication slate.
 */
export const clearAllStoriesAndChapters = async (): Promise<void> => {
  try {
    localStorage.setItem('mel_published_stories', JSON.stringify([]));
    localStorage.setItem('mel_announcements', JSON.stringify([]));
    notifyStorySubscribers([]);
    notifyAnnouncementSubscribers([]);
  } catch (err) {
    console.warn('Local clear warning:', err);
  }

  try {
    const storiesSnap = await getDocs(collection(db, 'stories'));
    const chaptersSnap = await getDocs(collection(db, 'chapters'));
    const announcementsSnap = await getDocs(collection(db, 'announcements'));
    const statsSnap = await getDocs(collection(db, 'story_stats'));

    const batch = writeBatch(db);
    storiesSnap.forEach((d) => batch.delete(d.ref));
    chaptersSnap.forEach((d) => batch.delete(d.ref));
    announcementsSnap.forEach((d) => batch.delete(d.ref));
    statsSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    await resetAllMetricsToZero();
  } catch (err) {
    console.warn('Firestore clear warning (local cleared):', err);
  }
};

// =========================================================================
// 8. COLLABORATORS & AUTHOR PRIVILEGES MANAGEMENT
// =========================================================================

const LOCAL_COLLABORATORS_KEY = 'mel_collaborators_cache';

export const INITIAL_COLLABORATOR_SEEDS: CollaboratorItem[] = [
  {
    id: 'collab_cuncondangiu07_gmail_com',
    email: 'cuncondangiu07@gmail.com',
    displayName: 'Mellifluous (Tác giả chính)',
    role: 'author',
    roleTitle: 'Tác giả chính • Mellifluous',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Tác giả & Dịch giả chính',
  },
  {
    id: 'collab_meomeoxinhxinh07_gmail_com',
    email: 'meomeoxinhxinh07@gmail.com',
    displayName: 'Mèo Con (Tác giả)',
    role: 'author',
    roleTitle: 'Tác giả • Mellifluous',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Đồng tác giả & Biên dịch',
  },
  {
    id: 'collab_nhatlinhpham010194_gmail_com',
    email: 'nhatlinhpham010194@gmail.com',
    displayName: 'Nhật Linh (Admin)',
    role: 'admin',
    roleTitle: 'Quản trị viên hệ thống',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Kỹ thuật & Quản trị hệ thống',
  },
  {
    id: 'collab_maianhpham927_gmail_com',
    email: 'maianhpham927@gmail.com',
    displayName: 'Mai Anh (Biên tập)',
    role: 'editor',
    roleTitle: 'Biên tập viên / Editor',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Hiệu đính & Soát lỗi chương',
  },
  {
    id: 'collab_duongtieuvi102_gmail_com',
    email: 'duongtieuvi102@gmail.com',
    displayName: 'Tiểu Vi (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Hỗ trợ duyệt bài & hồi âm',
  },
  {
    id: 'collab_nguyenplinh1002_gmail_com',
    email: 'nguyenplinh1002@gmail.com',
    displayName: 'Phương Linh (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Cộng tác viên nội dung',
  },
  {
    id: 'collab_nguyenlinhph0210_gmail_com',
    email: 'nguyenlinhph0210@gmail.com',
    displayName: 'Linh Nguyễn (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Hỗ trợ kiểm tra chương',
  },
  {
    id: 'collab_luclamly920_gmail_com',
    email: 'luclamly920@gmail.com',
    displayName: 'Lục Lam Ly (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Cộng tác viên biên tập',
  },
  {
    id: 'collab_uongthienyenvi123_gmail_com',
    email: 'uongthienyenvi123@gmail.com',
    displayName: 'Yến Vi (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Cộng tác viên đọc & rà soát',
  },
  {
    id: 'collab_vivi60810_gmail_com',
    email: 'vivi60810@gmail.com',
    displayName: 'Vivi (Cộng sự)',
    role: 'collaborator',
    roleTitle: 'Cộng sự Ban quản trị',
    addedBy: 'Hệ thống sáng lập',
    addedAt: '2025-01-01T00:00:00.000Z',
    note: 'Cộng tác viên hỗ trợ độc giả',
  },
];

export const getStoredCollaborators = (): CollaboratorItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_COLLABORATORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_COLLABORATOR_SEEDS;
};

export const subscribeToCollaborators = (
  callback: (list: CollaboratorItem[]) => void
): (() => void) => {
  // Emit local cache first for instant UI response
  const initial = getStoredCollaborators();
  callback(initial);

  if (checkIsFirestoreBlocked()) {
    return () => {};
  }

  const docRef = doc(db, 'site_stats', 'collaborators');
  return onSnapshot(
    docRef,
    (snapshot) => {
      let list: CollaboratorItem[] = [];
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data?.items)) {
          list = data.items;
        }
      }

      // Merge with initial seeds if snapshot is empty or to ensure core admins exist
      const mergedList = [...list];
      for (const seed of INITIAL_COLLABORATOR_SEEDS) {
        if (!mergedList.some((c) => c.email.toLowerCase() === seed.email.toLowerCase())) {
          mergedList.push(seed);
        }
      }

      // Cache locally
      try {
        localStorage.setItem(LOCAL_COLLABORATORS_KEY, JSON.stringify(mergedList));
      } catch {}
      callback(mergedList);
    },
    (err) => {
      console.warn('Collaborators snapshot warning (using local):', err);
      callback(getStoredCollaborators());
    }
  );
};

export const addCollaborator = async (
  item: Omit<CollaboratorItem, 'id' | 'addedAt'>
): Promise<CollaboratorItem> => {
  const cleanEmail = item.email.toLowerCase().trim();
  const docId = `collab_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const newCollab: CollaboratorItem = {
    ...item,
    id: docId,
    email: cleanEmail,
    addedAt: new Date().toISOString(),
  };

  // 1. Update local cache
  const current = getStoredCollaborators();
  const updated = [...current.filter((c) => c.email.toLowerCase() !== cleanEmail), newCollab];
  try {
    localStorage.setItem(LOCAL_COLLABORATORS_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Write to Firestore site_stats/collaborators
  try {
    await setDoc(doc(db, 'site_stats', 'collaborators'), { items: updated, updatedAt: new Date().toISOString() }, { merge: true });
    await setDoc(doc(db, COLLABORATORS_COLLECTION, docId), newCollab).catch(() => {});
  } catch (err) {
    console.warn('Firestore add collaborator warning (cached locally):', err);
  }

  return newCollab;
};

export const deleteCollaborator = async (collabId: string): Promise<void> => {
  // 1. Update local cache
  const current = getStoredCollaborators();
  const updated = current.filter((c) => c.id !== collabId && c.email.toLowerCase() !== collabId.toLowerCase());
  try {
    localStorage.setItem(LOCAL_COLLABORATORS_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Delete from Firestore site_stats/collaborators
  try {
    await setDoc(doc(db, 'site_stats', 'collaborators'), { items: updated, updatedAt: new Date().toISOString() }, { merge: true });
    await deleteDoc(doc(db, COLLABORATORS_COLLECTION, collabId)).catch(() => {});
  } catch (err) {
    console.warn('Firestore delete collaborator warning:', err);
  }
};

export const updateCollaboratorRole = async (
  collabId: string,
  role: CollaboratorItem['role'],
  roleTitle?: string
): Promise<void> => {
  const current = getStoredCollaborators();
  const updated = current.map((c) => {
    if (c.id === collabId || c.email.toLowerCase() === collabId.toLowerCase()) {
      return { ...c, role, roleTitle: roleTitle || c.roleTitle };
    }
    return c;
  });
  try {
    localStorage.setItem(LOCAL_COLLABORATORS_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await setDoc(doc(db, 'site_stats', 'collaborators'), { items: updated, updatedAt: new Date().toISOString() }, { merge: true });
    await setDoc(
      doc(db, COLLABORATORS_COLLECTION, collabId),
      { role, roleTitle: roleTitle || '', updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
  } catch (err) {
    console.warn('Firestore update collaborator role warning:', err);
  }
};

/**
 * Full update for Collaborator / Author / Admin item (Name, Email, Role, Note)
 */
export const updateCollaboratorFullData = async (
  collabId: string,
  data: Partial<Omit<CollaboratorItem, 'id'>>
): Promise<CollaboratorItem | null> => {
  const current = getStoredCollaborators();
  let updatedCollab: CollaboratorItem | null = null;
  const updated = current.map((c) => {
    if (c.id === collabId || c.email.toLowerCase() === collabId.toLowerCase()) {
      updatedCollab = {
        ...c,
        ...data,
      } as CollaboratorItem;
      return updatedCollab;
    }
    return c;
  });
  try {
    localStorage.setItem(LOCAL_COLLABORATORS_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await setDoc(doc(db, 'site_stats', 'collaborators'), { items: updated, updatedAt: new Date().toISOString() }, { merge: true });
    await setDoc(
      doc(db, COLLABORATORS_COLLECTION, collabId),
      { ...data, updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
  } catch (err) {
    console.warn('Firestore update collaborator warning:', err);
  }

  return updatedCollab;
};

// =========================================================================
// 9. USERNAME TO EMAIL DIRECTORY (USERNAME LOGIN & REGISTRATION)
// =========================================================================

const USERNAMES_COLLECTION = 'usernames';
const LOCAL_USERNAMES_KEY = 'mel_usernames_cache';

export const getStoredUsernames = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(LOCAL_USERNAMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const registerUsernameMapping = async (
  username: string,
  email: string,
  uid?: string
): Promise<void> => {
  const cleanUsername = username.toLowerCase().trim();
  const cleanEmail = email.toLowerCase().trim();

  // 1. Local storage
  const current = getStoredUsernames();
  current[cleanUsername] = cleanEmail;
  try {
    localStorage.setItem(LOCAL_USERNAMES_KEY, JSON.stringify(current));
  } catch {}

  // 2. Firestore
  try {
    await setDoc(doc(db, USERNAMES_COLLECTION, cleanUsername), {
      username: cleanUsername,
      email: cleanEmail,
      uid: uid || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Register username mapping warning:', err);
  }
};

export const lookupEmailByUsername = async (
  username: string
): Promise<string | null> => {
  const cleanUsername = username.toLowerCase().trim();

  // 1. Check local cache
  const localMap = getStoredUsernames();
  if (localMap[cleanUsername]) {
    return localMap[cleanUsername];
  }

  // 2. Check Firestore
  try {
    const snap = await getDoc(doc(db, USERNAMES_COLLECTION, cleanUsername));
    if (snap.exists()) {
      const data = snap.data();
      if (data.email) {
        localMap[cleanUsername] = data.email;
        try {
          localStorage.setItem(LOCAL_USERNAMES_KEY, JSON.stringify(localMap));
        } catch {}
        return data.email;
      }
    }
  } catch (err) {
    console.warn('Lookup email by username warning:', err);
  }

  return null;
};

export const checkUsernameAvailable = async (
  username: string
): Promise<boolean> => {
  const cleanUsername = username.toLowerCase().trim();
  const localMap = getStoredUsernames();
  if (localMap[cleanUsername]) return false;

  try {
    const snap = await getDoc(doc(db, USERNAMES_COLLECTION, cleanUsername));
    return !snap.exists();
  } catch {
    return true;
  }
};

// =========================================================================
// 9. USER PROFILE & AVATAR PERSISTENCE
// =========================================================================

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('Get user profile warning:', err);
  }
  // Try local fallback
  try {
    const raw = localStorage.getItem(`mel_profile_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  // 1. Save to local storage for instant offline access
  try {
    localStorage.setItem(`mel_profile_${profile.uid}`, JSON.stringify(profile));
  } catch {}

  // 2. Save to Firestore
  try {
    await setDoc(
      doc(db, USERS_COLLECTION, profile.uid),
      {
        ...profile,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore save user profile warning (cached locally):', err);
  }
};

export const subscribeToUserProfile = (
  uid: string,
  callback: (profile: UserProfile | null) => void
): (() => void) => {
  // First emit local cache
  try {
    const raw = localStorage.getItem(`mel_profile_${uid}`);
    if (raw) callback(JSON.parse(raw));
  } catch {}

  if (checkIsFirestoreBlocked()) {
    return () => {};
  }

  const userDocRef = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(
    userDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        try {
          localStorage.setItem(`mel_profile_${uid}`, JSON.stringify(data));
        } catch {}
        callback(data);
      }
    },
    (err) => {
      console.warn('User profile snapshot warning:', err);
    }
  );
};

// Account Credentials & Lookup helpers (Seamless Firestore authentication)
export interface StoredUserAccount extends UserProfile {
  passwordHash?: string;
  salt?: string;
  authProvider?: string;
  createdAt?: string;
}

export const findUserByEmail = async (email: string): Promise<StoredUserAccount | null> => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. First check if any user has this email in localStorage
  try {
    const cachedUid = localStorage.getItem(`mel_email_to_uid_${cleanEmail}`);
    if (cachedUid) {
      const cachedProfile = localStorage.getItem(`mel_account_${cachedUid}`);
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }
    }
  } catch {}

  // 2. Query Firestore users collection by email
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', cleanEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data() as StoredUserAccount;
      try {
        localStorage.setItem(`mel_email_to_uid_${cleanEmail}`, docData.uid);
        localStorage.setItem(`mel_account_${docData.uid}`, JSON.stringify(docData));
      } catch {}
      return docData;
    }
  } catch (err) {
    console.warn('Find user by email warning:', err);
  }

  // 3. Fallback: Check if document ID matches email-derived key
  try {
    const directDoc = await getDoc(doc(db, USERS_COLLECTION, `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`));
    if (directDoc.exists()) {
      return directDoc.data() as StoredUserAccount;
    }
  } catch {}

  return null;
};

export const findUserByUsername = async (username: string): Promise<StoredUserAccount | null> => {
  const cleanUsername = username.toLowerCase().trim();

  // 1. Check usernames collection mapping
  try {
    const usernameSnap = await getDoc(doc(db, USERNAMES_COLLECTION, cleanUsername));
    if (usernameSnap.exists()) {
      const uData = usernameSnap.data();
      if (uData.uid) {
        const userSnap = await getDoc(doc(db, USERS_COLLECTION, uData.uid));
        if (userSnap.exists()) {
          return userSnap.data() as StoredUserAccount;
        }
      }
      if (uData.email) {
        return await findUserByEmail(uData.email);
      }
    }
  } catch (err) {
    console.warn('Find user by username mapping warning:', err);
  }

  // 2. Direct query on users collection where username == cleanUsername
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('username', '==', cleanUsername),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as StoredUserAccount;
    }
  } catch (err) {
    console.warn('Query user by username warning:', err);
  }

  return null;
};

export const checkEmailAvailable = async (email: string): Promise<boolean> => {
  const found = await findUserByEmail(email);
  return !found;
};

export const saveUserAccount = async (account: StoredUserAccount): Promise<void> => {
  // Cache locally
  try {
    localStorage.setItem(`mel_account_${account.uid}`, JSON.stringify(account));
    localStorage.setItem(`mel_profile_${account.uid}`, JSON.stringify(account));
    localStorage.setItem(`mel_email_to_uid_${account.email.toLowerCase().trim()}`, account.uid);
  } catch {}

  // Save to Firestore users collection
  try {
    await setDoc(
      doc(db, USERS_COLLECTION, account.uid),
      {
        ...account,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Save user account to Firestore warning:', err);
  }

  // If username provided, also record in usernames directory
  if (account.username) {
    await registerUsernameMapping(account.username, account.email, account.uid);
  }
};


