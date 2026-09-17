import { Story, Chapter, Announcement, RecentUpdate } from '../types';

export const DELETED_OR_LEGACY_STORY_IDS = new Set([
  'anh-dao-nam-centimet',
  'anh-dao-5cm',
  'mua-he-nam-ay',
  'buc-thu-tinh-gui-may-troi',
  'chiec-o-thang-bay',
  'duoi-tan-cay-mua-ha',
]);

export const isStoryDeleted = (storyId?: string): boolean => {
  if (!storyId) return true;
  const cleanId = storyId.trim().toLowerCase();
  if (DELETED_OR_LEGACY_STORY_IDS.has(cleanId) || DELETED_OR_LEGACY_STORY_IDS.has(storyId)) return true;
  try {
    const raw = localStorage.getItem('mel_deleted_story_ids');
    if (raw) {
      const list: string[] = JSON.parse(raw);
      if (Array.isArray(list) && (list.includes(storyId) || list.includes(cleanId))) return true;
    }
  } catch {}
  return false;
};

export const recordStoryDeleted = (storyId: string): void => {
  if (!storyId) return;
  const cleanId = storyId.trim().toLowerCase();
  DELETED_OR_LEGACY_STORY_IDS.add(cleanId);
  DELETED_OR_LEGACY_STORY_IDS.add(storyId);
  if (cleanId === 'anh-dao-5cm' || cleanId === 'anh-dao-nam-centimet') {
    DELETED_OR_LEGACY_STORY_IDS.add('anh-dao-5cm');
    DELETED_OR_LEGACY_STORY_IDS.add('anh-dao-nam-centimet');
  }
  try {
    const raw = localStorage.getItem('mel_deleted_story_ids');
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(storyId)) list.push(storyId);
    if (!list.includes(cleanId)) list.push(cleanId);
    localStorage.setItem('mel_deleted_story_ids', JSON.stringify(list));

    localStorage.removeItem(`mel_chapters_${storyId}`);
    localStorage.removeItem(`mel_chapters_${cleanId}`);

    const rawStories = localStorage.getItem('mel_published_stories');
    if (rawStories) {
      const parsed: Story[] = JSON.parse(rawStories);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((s) => s.id !== storyId && s.id !== cleanId);
        localStorage.setItem('mel_published_stories', JSON.stringify(filtered));
      }
    }
  } catch {}

  delete liveChaptersRuntimeCache[storyId];
  delete liveChaptersRuntimeCache[cleanId];
};

export const STORIES: Story[] = [
  {
    id: 'chao-tiep-ha',
    title: 'chào tiếp ha',
    originalTitle: '',
    author: 'hees loooo',
    translator: 'Mellifluous',
    status: 'ongoing',
    genre: ['Học đường', 'Gương vỡ lại lành'],
    summary: 'nj',
    totalChapters: 30,
    completedChapters: 0,
    mainChaptersCount: 30,
    extraChaptersCount: 0,
    coverImage: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=800&auto=format&fit=crop',
    colorTheme: 'from-pink-100 to-rose-200 dark:from-pink-950/40 dark:to-rose-900/40',
    hasPassword: false,
    passwordHint: '',
    passwordKey: '',
    updatedAt: '2026-09-17T14:32:22.973Z',
    views: 0,
    likes: 0,
    featured: true,
  },
];

export const SAMPLE_CHAPTERS: Record<string, Chapter[]> = {
  'chao-tiep-ha': [],
};

/**
 * Get stored custom chapters from localStorage for a specific story.
 */
export const getStoredCustomChapters = (storyId: string): Chapter[] => {
  try {
    const raw = localStorage.getItem(`mel_chapters_${storyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
    if (aliasId) {
      const rawAlias = localStorage.getItem(`mel_chapters_${aliasId}`);
      if (rawAlias) {
        const parsedAlias = JSON.parse(rawAlias);
        if (Array.isArray(parsedAlias) && parsedAlias.length > 0) return parsedAlias;
      }
    }
  } catch {}
  return [];
};

/**
 * Save a custom chapter into localStorage without losing existing chapters.
 */
export const saveCustomChapterToStorage = (chapter: Chapter): void => {
  try {
    const existingChapters = getStoryChapters(chapter.storyId);
    const list = existingChapters.length > 0 ? [...existingChapters] : getStoredCustomChapters(chapter.storyId);
    const targetPartType = chapter.partType || (chapter.isExtra ? 'extra' : 'main');
    const existingIndex = list.findIndex(
      (c) => c.id === chapter.id || (c.chapterNumber === chapter.chapterNumber && (c.partType || (c.isExtra ? 'extra' : 'main')) === targetPartType)
    );
    if (existingIndex >= 0) {
      list[existingIndex] = chapter;
    } else {
      list.push(chapter);
    }
    // Sort by chapterNumber ascending
    list.sort((a, b) => {
      const numA = Number(a.chapterNumber) || 0;
      const numB = Number(b.chapterNumber) || 0;
      if (numA !== numB) return numA - numB;
      const isExtraA = a.isExtra || a.partType === 'extra' ? 1 : 0;
      const isExtraB = b.isExtra || b.partType === 'extra' ? 1 : 0;
      return isExtraA - isExtraB;
    });
    localStorage.setItem(`mel_chapters_${chapter.storyId}`, JSON.stringify(list));
    setLiveStoryChapters(chapter.storyId, list);
    const aliasId = chapter.storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : chapter.storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
    if (aliasId) {
      localStorage.setItem(`mel_chapters_${aliasId}`, JSON.stringify(list));
      setLiveStoryChapters(aliasId, list);
    }
  } catch {}
};

/**
 * Delete a custom chapter from localStorage.
 */
export const deleteCustomChapterFromStorage = (storyId: string, chapterId: string): void => {
  try {
    const list = getStoredCustomChapters(storyId);
    const filtered = list.filter((c) => c.id !== chapterId);
    localStorage.setItem(`mel_chapters_${storyId}`, JSON.stringify(filtered));
    setLiveStoryChapters(storyId, filtered);
  } catch {}
};

// Live synchronized chapters cache from Firestore across all devices and clients
const liveChaptersRuntimeCache: Record<string, Chapter[]> = {};

export const setLiveChaptersRuntimeCache = (cache: Record<string, Chapter[]>): void => {
  for (const [storyId, list] of Object.entries(cache)) {
    liveChaptersRuntimeCache[storyId] = list;
  }
};

export const setLiveStoryChapters = (storyId: string, chapters: Chapter[]): void => {
  liveChaptersRuntimeCache[storyId] = chapters;
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
  if (aliasId) {
    liveChaptersRuntimeCache[aliasId] = chapters;
  }
};

export const getLiveChaptersRuntimeCache = (): Record<string, Chapter[]> => {
  return { ...liveChaptersRuntimeCache };
};

export const getStoryChapters = (storyId: string): Chapter[] => {
  if (!storyId || isStoryDeleted(storyId)) {
    return [];
  }
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
  if (aliasId && isStoryDeleted(aliasId)) {
    return [];
  }

  // 1. Prioritize live real-time chapters from runtime synchronized cache if non-empty
  if (liveChaptersRuntimeCache[storyId] !== undefined && liveChaptersRuntimeCache[storyId].length > 0) {
    return liveChaptersRuntimeCache[storyId];
  }
  if (aliasId && liveChaptersRuntimeCache[aliasId] !== undefined && liveChaptersRuntimeCache[aliasId].length > 0) {
    return liveChaptersRuntimeCache[aliasId];
  }

  // 2. Retrieve custom author-published chapters from local storage if saved and non-empty
  try {
    const raw = localStorage.getItem(`mel_chapters_${storyId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    if (aliasId) {
      const rawAlias = localStorage.getItem(`mel_chapters_${aliasId}`);
      if (rawAlias !== null) {
        const parsedAlias = JSON.parse(rawAlias);
        if (Array.isArray(parsedAlias) && parsedAlias.length > 0) {
          return parsedAlias;
        }
      }
    }
  } catch {}

  // 3. Retrieve base sample chapters only for predefined seed stories if not yet initialized
  if (!isStoryDeleted(storyId) && SAMPLE_CHAPTERS[storyId] && SAMPLE_CHAPTERS[storyId].length > 0) {
    return SAMPLE_CHAPTERS[storyId];
  } else if (aliasId && !isStoryDeleted(aliasId) && SAMPLE_CHAPTERS[aliasId] && SAMPLE_CHAPTERS[aliasId].length > 0) {
    return SAMPLE_CHAPTERS[aliasId];
  }

  // 4. Return runtime cache if present (even if empty, for completely new empty stories)
  if (liveChaptersRuntimeCache[storyId] !== undefined) {
    return liveChaptersRuntimeCache[storyId];
  }

  return [];
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'tb-1',
    title: 'Bảng tin nhà Mel: Về lịch đăng chương và bảo vệ bản quyền phi lợi nhuận',
    tag: 'Thông báo',
    date: '14/09/2026',
    isPinned: true,
    content:
      'Xin chào các bạn độc giả dễ thương! Tớ là Mellifluous. Trang blog này là nơi tớ lưu giữ những bản dịch truyện ngôn tình thanh xuân mùa hè mà tớ yêu thích. Do công việc bận rộn nên tớ sẽ cập nhật chương truyện ngẫu hứng vào các buổi tối cuối tuần. Toàn bộ truyện là phi lợi nhuận, nghiêm cấm reup hoặc thương mại hóa dưới mọi hình thức nhé!',
  },
  {
    id: 'tb-2',
    title: 'Quy tắc đặt Password & Gợi ý giải mã chương VIP',
    tag: 'Lưu ý',
    date: '10/09/2026',
    isPinned: true,
    content:
      'Tất cả pass ở nhà Mel đều siêu dễ thương và liên quan trực tiếp đến chi tiết trong truyện (viết thường không dấu, không cách). Các bạn bấm vào tab "Password" trên thanh lá thư để xem chi tiết gợi ý nhé! Nếu gặp khó khăn hãy để lại bình luận ở mục Hỏi đáp, Mel sẽ hint thêm nha ~',
  },
  {
    id: 'tb-3',
    title: 'Cập nhật hệ thống: Đồng bộ trạng thái và danh sách chương truyện mới',
    tag: 'Hệ thống',
    date: '17/09/2026',
    content:
      'Hệ thống blog đã được nâng cấp tối ưu hóa đồng bộ dữ liệu thời gian thực trên mọi thiết bị và trình duyệt. Các tác phẩm đã hoàn và đang ra được tự động cập nhật chuẩn xác nhất.',
  },
  {
    id: 'tb-4',
    title: 'Mở chuyên mục Hòm thư bạn đọc & Tâm sự mùa hè',
    tag: 'Nhắc nhở',
    date: '20/08/2026',
    content:
      'Chuyên mục "Thư gửi độc giả & Tình cảm" đã chính thức tiếp nhận những bức thư từ độc giả thân yêu. Bạn có thể gửi gắm tâm sự, cảm nghĩ về từng nhân vật hoặc chia sẻ kỷ niệm thanh xuân của chính mình!',
  },
  {
    id: 'tb-5',
    title: 'Chào đón bạn đọc ghé thăm không gian lofi Mellifluous',
    tag: 'Thông báo',
    date: '01/08/2026',
    content:
      'Chúc các bạn độc giả có những phút giây an yên, thư thái cùng những trang truyện ngọt ngào, tiếng đàn lofi du dương và những cánh hoa anh đào rơi dịu dàng.',
  },
];

export const RECENT_UPDATES: RecentUpdate[] = [];

export const SUMMER_QUOTES = [
  {
    text: 'Tốc độ cánh hoa anh đào rơi là năm centimet một giây. Vậy phải mất bao lâu để hai trái tim đến được bên nhau?',
    book: 'Mellifluous 🌸 Tủ sách mùa hạ',
  },
  {
    text: 'Cậu là cơn mưa rào bất chợt của tuổi mười bảy, dù bị ướt sũng nhưng tớ vẫn muốn một lần nữa đắm chìm.',
    book: 'Thanh xuân không hối tiếc',
  },
  {
    text: 'Dưới tán cây râm mát mùa hạ, mọi bức thư chưa gửi đều đã tìm thấy người nhận của nó.',
    book: 'Gửi người mùa hạ',
  },
  {
    text: 'Gió mùa hè rất ngọt, nhưng không ngọt bằng khoảnh khắc cậu khẽ mỉm cười và gọi tên tớ giữa sân trường.',
    book: 'Mellifluous 🌸 Tủ sách mùa hạ',
  },
];

export const PLAYLIST = [
  { title: 'Gió Thổi Mùa Hạ (夏天的风)', artist: 'Ôn Lam', duration: '03:45' },
  { title: 'Mùa Hè Năm Ấy (那年夏天)', artist: 'Hứa Phi', duration: '04:12' },
  { title: 'Tớ Thích Cậu (我喜欢你)', artist: 'Cúc Tịnh Y', duration: '03:30' },
  { title: 'Cánh Hoa Anh Đào Rơi', artist: 'Lofi Chill Mel', duration: '02:58' },
];
