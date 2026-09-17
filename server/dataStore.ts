import fs from 'fs';
import path from 'path';
import { Story, Chapter, Announcement, ReaderLetter, RealtimeComment, CommentReply } from '../src/types';
import { STORIES, SAMPLE_CHAPTERS, ANNOUNCEMENTS } from '../src/data/mockData';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  mood?: string;
  audioUrl?: string;
  sourceType?: 'uploaded' | 'direct' | 'gdrive' | 'synth';
  fileSize?: string;
  mimeType?: string;
  totalChunks?: number;
  addedBy?: string;
  createdAt?: string;
  isLocalOnly?: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const PLAYLIST_FILE = path.join(DATA_DIR, 'playlist.json');
const LETTERS_FILE = path.join(DATA_DIR, 'letters.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const GENRES_FILE = path.join(DATA_DIR, 'genres.json');

// Default initial datasets
const DEFAULT_TRACKS: AudioTrack[] = [
  {
    id: 'track-1',
    title: 'Gió Thổi Mùa Hạ (夏天的风)',
    artist: 'Mellifluous Lofi Chill',
    duration: '03:45',
    mood: 'Rhodes Piano & Gió mùa hạ',
    sourceType: 'synth',
  },
  {
    id: 'track-2',
    title: 'Mùa Hè Năm Ấy (那年夏天)',
    artist: 'Acoustic Piano & Music Box',
    duration: '04:12',
    mood: 'Tiếng đàn êm dịu tuổi thanh xuân',
    sourceType: 'synth',
  },
  {
    id: 'track-3',
    title: 'Tớ Thích Cậu (我喜欢你)',
    artist: 'Sweet Warm Chords',
    duration: '03:30',
    mood: 'Giai điệu ngọt ngào chữa lành',
    sourceType: 'synth',
  },
  {
    id: 'track-4',
    title: 'Ký Ức Mùa Mưa Rào',
    artist: 'Ambient Rain & Chimes',
    duration: '02:58',
    mood: 'Chuông gió & giọt mưa tí tách',
    sourceType: 'synth',
  },
];

const DEFAULT_GENRES: string[] = [
  'Tất cả các thể loại mùa hè',
  'Ngôn tình',
  'Thanh xuân',
  'Ngọt sủng',
  'Học đường',
  'Hiện đại',
  'Ấm áp',
  'Song hướng thầm mến',
  'Vườn trường đại học',
  'Hài hước',
  'Nhẹ nhàng',
  'Gương vỡ lại lành',
  '1v1',
  'HE',
  'Chữa lành',
  'Cưới trước yêu sau',
  'Đô thị tình duyên',
  'Trọng sinh',
];

const DEFAULT_LETTERS: ReaderLetter[] = [
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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-memory caches for high performance
let cachedStories: Story[] = [];
let cachedChapters: Record<string, Chapter[]> = {};
let cachedAnnouncements: Announcement[] = [];
let cachedTracks: AudioTrack[] = [];
let cachedLetters: ReaderLetter[] = [];
let cachedComments: RealtimeComment[] = [];
let cachedGenres: string[] = [];

// Helper to write JSON safely
const writeJsonSafe = (filePath: string, data: any) => {
  try {
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    console.error(`Failed to write file ${filePath}:`, err);
  }
};

// Initialize or load all entities
export const initDataStore = () => {
  // 1. Stories
  if (fs.existsSync(STORIES_FILE)) {
    try {
      const content = fs.readFileSync(STORIES_FILE, 'utf-8');
      cachedStories = JSON.parse(content);
    } catch {
      cachedStories = [...STORIES];
      writeJsonSafe(STORIES_FILE, cachedStories);
    }
  } else {
    cachedStories = [...STORIES];
    writeJsonSafe(STORIES_FILE, cachedStories);
  }

  // 2. Chapters (grouped by storyId)
  if (fs.existsSync(CHAPTERS_FILE)) {
    try {
      const content = fs.readFileSync(CHAPTERS_FILE, 'utf-8');
      cachedChapters = JSON.parse(content);
    } catch {
      cachedChapters = { ...SAMPLE_CHAPTERS };
      writeJsonSafe(CHAPTERS_FILE, cachedChapters);
    }
  } else {
    cachedChapters = { ...SAMPLE_CHAPTERS };
    writeJsonSafe(CHAPTERS_FILE, cachedChapters);
  }

  // 3. Announcements
  if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
    try {
      const content = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf-8');
      cachedAnnouncements = JSON.parse(content);
    } catch {
      cachedAnnouncements = [...ANNOUNCEMENTS];
      writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
    }
  } else {
    cachedAnnouncements = [...ANNOUNCEMENTS];
    writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
  }

  // 4. Playlist / Tracks
  if (fs.existsSync(PLAYLIST_FILE)) {
    try {
      const content = fs.readFileSync(PLAYLIST_FILE, 'utf-8');
      cachedTracks = JSON.parse(content);
      if (!Array.isArray(cachedTracks) || cachedTracks.length === 0) {
        cachedTracks = [...DEFAULT_TRACKS];
        writeJsonSafe(PLAYLIST_FILE, cachedTracks);
      }
    } catch {
      cachedTracks = [...DEFAULT_TRACKS];
      writeJsonSafe(PLAYLIST_FILE, cachedTracks);
    }
  } else {
    cachedTracks = [...DEFAULT_TRACKS];
    writeJsonSafe(PLAYLIST_FILE, cachedTracks);
  }

  // 5. Reader Letters
  if (fs.existsSync(LETTERS_FILE)) {
    try {
      const content = fs.readFileSync(LETTERS_FILE, 'utf-8');
      cachedLetters = JSON.parse(content);
      if (!Array.isArray(cachedLetters) || cachedLetters.length === 0) {
        cachedLetters = [...DEFAULT_LETTERS];
        writeJsonSafe(LETTERS_FILE, cachedLetters);
      }
    } catch {
      cachedLetters = [...DEFAULT_LETTERS];
      writeJsonSafe(LETTERS_FILE, cachedLetters);
    }
  } else {
    cachedLetters = [...DEFAULT_LETTERS];
    writeJsonSafe(LETTERS_FILE, cachedLetters);
  }

  // 6. Comments
  if (fs.existsSync(COMMENTS_FILE)) {
    try {
      const content = fs.readFileSync(COMMENTS_FILE, 'utf-8');
      cachedComments = JSON.parse(content);
      if (!Array.isArray(cachedComments)) cachedComments = [];
    } catch {
      cachedComments = [];
      writeJsonSafe(COMMENTS_FILE, cachedComments);
    }
  } else {
    cachedComments = [];
    writeJsonSafe(COMMENTS_FILE, cachedComments);
  }

  // 7. Genres
  if (fs.existsSync(GENRES_FILE)) {
    try {
      const content = fs.readFileSync(GENRES_FILE, 'utf-8');
      cachedGenres = JSON.parse(content);
      if (!Array.isArray(cachedGenres) || cachedGenres.length === 0) {
        cachedGenres = [...DEFAULT_GENRES];
        writeJsonSafe(GENRES_FILE, cachedGenres);
      }
    } catch {
      cachedGenres = [...DEFAULT_GENRES];
      writeJsonSafe(GENRES_FILE, cachedGenres);
    }
  } else {
    cachedGenres = [...DEFAULT_GENRES];
    writeJsonSafe(GENRES_FILE, cachedGenres);
  }

  console.log(`[DataStore] Initialized: ${cachedStories.length} stories, ${Object.keys(cachedChapters).length} chapter sets, ${cachedAnnouncements.length} announcements, ${cachedTracks.length} tracks, ${cachedLetters.length} letters, ${cachedComments.length} comments, ${cachedGenres.length} genres.`);
};

// Vietnamese Slug Helper for Robust URL Lookup
export const toSlug = (str: string = ''): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Stories Operations
export const getAllStories = (): Story[] => {
  return [...cachedStories];
};

export const getStoryById = (id: string): Story | undefined => {
  if (!id) return undefined;
  const decodedId = decodeURIComponent(id).trim();
  const slugId = toSlug(decodedId);

  // 1. Exact ID match
  const exact = cachedStories.find((s) => s.id === decodedId || s.id === id);
  if (exact) return exact;

  // 2. Alias match for special stories
  if (decodedId === 'anh-dao-5cm' || slugId === 'anh-dao-5cm') {
    const alias = cachedStories.find((s) => s.id === 'anh-dao-nam-centimet' || s.id === 'anh-dao-5cm');
    if (alias) return alias;
  }
  if (decodedId === 'anh-dao-nam-centimet' || slugId === 'anh-dao-nam-centimet') {
    const alias = cachedStories.find((s) => s.id === 'anh-dao-5cm' || s.id === 'anh-dao-nam-centimet');
    if (alias) return alias;
  }

  // 3. Match by slugified ID, title, or original title
  return cachedStories.find((s) => {
    return (
      toSlug(s.id) === slugId ||
      toSlug(s.title) === slugId ||
      toSlug(s.originalTitle) === slugId
    );
  });
};

export const saveStory = (story: Story): Story => {
  const index = cachedStories.findIndex((s) => s.id === story.id);
  if (index >= 0) {
    cachedStories[index] = { ...cachedStories[index], ...story };
  } else {
    cachedStories = [story, ...cachedStories];
  }
  writeJsonSafe(STORIES_FILE, cachedStories);
  return story;
};

export const deleteStory = (storyId: string): boolean => {
  cachedStories = cachedStories.filter((s) => s.id !== storyId);
  delete cachedChapters[storyId];
  writeJsonSafe(STORIES_FILE, cachedStories);
  writeJsonSafe(CHAPTERS_FILE, cachedChapters);
  return true;
};

// Chapters Operations
export const getChaptersByStory = (storyId: string): Chapter[] => {
  if (!storyId) return [];
  const decodedId = decodeURIComponent(storyId).trim();
  const directList = cachedChapters[decodedId] || cachedChapters[storyId];
  if (directList && directList.length > 0) return directList;

  // Alias lookup
  if (decodedId === 'anh-dao-5cm') return cachedChapters['anh-dao-nam-centimet'] || [];
  if (decodedId === 'anh-dao-nam-centimet') return cachedChapters['anh-dao-5cm'] || [];

  // If queried by slug, find the resolved story first
  const resolved = getStoryById(decodedId);
  if (resolved && resolved.id !== decodedId) {
    return cachedChapters[resolved.id] || [];
  }

  return [];
};

export const getAllChaptersMap = (): Record<string, Chapter[]> => {
  return { ...cachedChapters };
};

export const saveChapter = (chapter: Chapter): Chapter => {
  const storyId = chapter.storyId;
  const list = cachedChapters[storyId] ? [...cachedChapters[storyId]] : [];
  
  const targetPart = chapter.partType || (chapter.isExtra ? 'extra' : 'main');
  const existingIdx = list.findIndex((c) => {
    const cPart = c.partType || (c.isExtra ? 'extra' : 'main');
    return c.id === chapter.id || (c.chapterNumber === chapter.chapterNumber && cPart === targetPart);
  });
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...chapter };
  } else {
    list.push(chapter);
  }

  list.sort((a, b) => a.chapterNumber - b.chapterNumber);
  cachedChapters[storyId] = list;
  writeJsonSafe(CHAPTERS_FILE, cachedChapters);

  // Automatically update story's completed chapters count and update timestamp
  const storyIdx = cachedStories.findIndex((s) => s.id === storyId);
  if (storyIdx >= 0) {
    cachedStories[storyIdx].completedChapters = list.length;
    cachedStories[storyIdx].updatedAt = new Date().toISOString();
    writeJsonSafe(STORIES_FILE, cachedStories);
  }

  return chapter;
};

export const deleteChapter = (storyId: string, chapterId: string): boolean => {
  if (cachedChapters[storyId]) {
    cachedChapters[storyId] = cachedChapters[storyId].filter((c) => c.id !== chapterId);
    writeJsonSafe(CHAPTERS_FILE, cachedChapters);

    // Update story completed chapters count
    const storyIdx = cachedStories.findIndex((s) => s.id === storyId);
    if (storyIdx >= 0) {
      cachedStories[storyIdx].completedChapters = cachedChapters[storyId].length;
      cachedStories[storyIdx].updatedAt = new Date().toISOString();
      writeJsonSafe(STORIES_FILE, cachedStories);
    }
    return true;
  }
  return false;
};

// Announcements Operations
export const getAllAnnouncements = (): Announcement[] => {
  return [...cachedAnnouncements];
};

export const saveAnnouncement = (ann: Announcement): Announcement => {
  const index = cachedAnnouncements.findIndex((a) => a.id === ann.id);
  if (index >= 0) {
    cachedAnnouncements[index] = { ...cachedAnnouncements[index], ...ann };
  } else {
    cachedAnnouncements = [ann, ...cachedAnnouncements];
  }
  writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
  return ann;
};

export const deleteAnnouncement = (announcementId: string): boolean => {
  cachedAnnouncements = cachedAnnouncements.filter((a) => a.id !== announcementId);
  writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
  return true;
};

// Playlist (Tracks) Operations
export const getAllTracks = (): AudioTrack[] => {
  return [...cachedTracks];
};

export const saveTrack = (track: AudioTrack): AudioTrack => {
  const index = cachedTracks.findIndex((t) => t.id === track.id);
  if (index >= 0) {
    cachedTracks[index] = { ...cachedTracks[index], ...track };
  } else {
    cachedTracks.push(track);
  }
  writeJsonSafe(PLAYLIST_FILE, cachedTracks);
  return track;
};

export const savePlaylist = (tracks: AudioTrack[]): AudioTrack[] => {
  cachedTracks = [...tracks];
  writeJsonSafe(PLAYLIST_FILE, cachedTracks);
  return cachedTracks;
};

export const deleteTrack = (trackId: string): boolean => {
  cachedTracks = cachedTracks.filter((t) => t.id !== trackId);
  writeJsonSafe(PLAYLIST_FILE, cachedTracks);
  return true;
};

// Reader Letters Operations
export const getAllLetters = (): ReaderLetter[] => {
  return [...cachedLetters];
};

export const saveLetter = (letter: ReaderLetter): ReaderLetter => {
  const index = cachedLetters.findIndex((l) => l.id === letter.id);
  if (index >= 0) {
    cachedLetters[index] = { ...cachedLetters[index], ...letter };
  } else {
    cachedLetters = [letter, ...cachedLetters];
  }
  writeJsonSafe(LETTERS_FILE, cachedLetters);
  return letter;
};

export const replyLetter = (letterId: string, replyText: string, authorName: string = 'Mellifluous (Tác giả)'): ReaderLetter | undefined => {
  const index = cachedLetters.findIndex((l) => l.id === letterId);
  if (index >= 0) {
    cachedLetters[index] = {
      ...cachedLetters[index],
      replyFromMel: replyText.trim(),
      repliedAt: new Date().toISOString(),
      repliedBy: authorName,
    };
    writeJsonSafe(LETTERS_FILE, cachedLetters);
    return cachedLetters[index];
  }
  return undefined;
};

export const deleteLetter = (letterId: string): boolean => {
  cachedLetters = cachedLetters.filter((l) => l.id !== letterId);
  writeJsonSafe(LETTERS_FILE, cachedLetters);
  return true;
};

export const likeLetter = (letterId: string): { likes: number } | undefined => {
  const index = cachedLetters.findIndex((l) => l.id === letterId);
  if (index >= 0) {
    cachedLetters[index].likes = (Number(cachedLetters[index].likes) || 0) + 1;
    writeJsonSafe(LETTERS_FILE, cachedLetters);
    return { likes: cachedLetters[index].likes };
  }
  return undefined;
};

// Comments Operations
export const getAllComments = (storyId?: string, chapterNumber?: number): RealtimeComment[] => {
  let list = [...cachedComments];
  if (storyId) {
    list = list.filter((c) => c.storyId === storyId);
  }
  if (chapterNumber !== undefined && chapterNumber !== null) {
    list = list.filter((c) => c.chapterNumber === chapterNumber || !c.chapterNumber);
  }
  return list;
};

export const saveComment = (comment: RealtimeComment): RealtimeComment => {
  const index = cachedComments.findIndex((c) => c.id === comment.id);
  if (index >= 0) {
    cachedComments[index] = { ...cachedComments[index], ...comment };
  } else {
    cachedComments = [comment, ...cachedComments];
  }
  writeJsonSafe(COMMENTS_FILE, cachedComments);
  return comment;
};

export const replyComment = (commentId: string, reply: CommentReply): RealtimeComment | undefined => {
  const index = cachedComments.findIndex((c) => c.id === commentId);
  if (index >= 0) {
    const existingReplies = Array.isArray(cachedComments[index].replies) ? cachedComments[index].replies! : [];
    cachedComments[index] = {
      ...cachedComments[index],
      replies: [...existingReplies, reply],
    };
    writeJsonSafe(COMMENTS_FILE, cachedComments);
    return cachedComments[index];
  }
  return undefined;
};

export const deleteComment = (commentId: string): boolean => {
  cachedComments = cachedComments.filter((c) => c.id !== commentId);
  writeJsonSafe(COMMENTS_FILE, cachedComments);
  return true;
};

export const toggleCommentLike = (commentId: string, visitorId: string): { likes: number; isLiked: boolean } | undefined => {
  const index = cachedComments.findIndex((c) => c.id === commentId);
  if (index >= 0) {
    const comment = cachedComments[index];
    const likedBy: string[] = Array.isArray(comment.likedBy) ? comment.likedBy : [];
    const hasLiked = likedBy.includes(visitorId);
    const newLikedBy = hasLiked ? likedBy.filter((id) => id !== visitorId) : [...likedBy, visitorId];
    const newLikes = Math.max(0, newLikedBy.length);
    cachedComments[index] = {
      ...comment,
      likes: newLikes,
      likedBy: newLikedBy,
    };
    writeJsonSafe(COMMENTS_FILE, cachedComments);
    return { likes: newLikes, isLiked: !hasLiked };
  }
  return undefined;
};

// Genres Operations
export const getAllGenres = (): string[] => {
  return [...cachedGenres];
};

export const saveGenres = (genres: string[]): string[] => {
  cachedGenres = [...genres];
  writeJsonSafe(GENRES_FILE, cachedGenres);
  return cachedGenres;
};

export const addGenre = (genre: string): string[] => {
  const trimmed = genre.trim();
  if (trimmed && !cachedGenres.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
    cachedGenres.push(trimmed);
    writeJsonSafe(GENRES_FILE, cachedGenres);
  }
  return cachedGenres;
};

export const deleteGenre = (genre: string): string[] => {
  const target = genre.trim().toLowerCase();
  cachedGenres = cachedGenres.filter((g) => g.trim().toLowerCase() !== target);
  writeJsonSafe(GENRES_FILE, cachedGenres);
  return cachedGenres;
};

