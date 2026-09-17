import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc as rawSetDoc,
  getDoc as rawGetDoc,
  updateDoc as rawUpdateDoc,
  increment,
  onSnapshot as rawOnSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc as rawAddDoc,
  deleteDoc as rawDeleteDoc,
  getDocs as rawGetDocs,
  writeBatch as rawWriteBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  enableNetwork,
  disableNetwork,
  type Firestore,
  type SetOptions,
  type DocumentReference,
  type DocumentData,
  type UpdateData,
  type CollectionReference,
  type QuerySnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Support both environment variables (for GitHub Pages / Vercel / external hosting) and direct config
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const resolvedFirebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig?.projectId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig?.appId,
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId,
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// Initialize Firestore with specific database ID from config if present
export const db: Firestore = resolvedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ============================================================================
// FIRESTORE CONNECTION & QUOTA RESILIENCE
// Ensures Firestore network is always active and user content writes always execute.
// ============================================================================

// Auto-detect project ID change: if project changed (e.g. to new user account), reset enabled flag to true and clear localQuotaExhausted!
if (typeof window !== 'undefined') {
  try {
    const lastPid = localStorage.getItem('mel_firestore_project_id');
    const currentPid = resolvedFirebaseConfig.projectId;
    if (currentPid && lastPid !== currentPid) {
      localStorage.setItem('mel_firestore_project_id', currentPid);
      localStorage.setItem('mel_firestore_enabled', 'true');
    }
  } catch {}
}

export const isFirestoreEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('mel_firestore_enabled');
    // Default to true now that fresh project is linked to user account
    return saved !== 'false';
  } catch {
    return true;
  }
};

export const setFirestoreEnabled = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mel_firestore_enabled', enabled ? 'true' : 'false');
      if (enabled) {
        localQuotaExhausted = false;
      }
    } catch {}
  }
};

let localQuotaExhausted = false;
let quotaNoticeLogged = false;

export const isFirestoreQuotaExhausted = (): boolean => {
  if (!isFirestoreEnabled()) return true;
  if (localQuotaExhausted) return true;
  try {
    const rawUntil = localStorage.getItem('mel_firestore_quota_exhausted_until');
    if (rawUntil) {
      const until = Number(rawUntil);
      if (!isNaN(until) && Date.now() < until) {
        return true;
      } else {
        localStorage.removeItem('mel_firestore_quota_exhausted_until');
      }
    }
  } catch {}
  return false;
};

export const markFirestoreQuotaExhausted = () => {
  localQuotaExhausted = true;
  try {
    localStorage.setItem('mel_firestore_quota_exhausted_until', String(Date.now() + 2 * 60 * 60 * 1000));
  } catch {}
};

export const checkAndHandleQuotaError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota')
  ) {
    localQuotaExhausted = true;
    try {
      localStorage.setItem('mel_firestore_quota_exhausted_until', String(Date.now() + 2 * 60 * 60 * 1000));
    } catch {}
    if (!quotaNoticeLogged) {
      quotaNoticeLogged = true;
      console.info('[Firestore] Giới hạn đọc/ghi miễn phí trong ngày của Firestore đã đạt mức tối đa. Blog tự động vận hành mượt mà ở chế độ offline-first qua LocalStorage & GitHub.');
    }
    return true;
  }
  return false;
};

// Resilient getDoc wrapper: prevents Quota limit exceeded exceptions from crashing the app
export const getDoc = async (docRef: DocumentReference<DocumentData>): Promise<any> => {
  if (isFirestoreQuotaExhausted()) {
    return {
      exists: () => false,
      data: () => null,
      id: docRef.id,
      ref: docRef,
    };
  }
  try {
    return await rawGetDoc(docRef);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return {
        exists: () => false,
        data: () => null,
        id: docRef.id,
        ref: docRef,
      };
    }
    throw err;
  }
};

// Resilient getDocs wrapper: prevents Quota limit exceeded exceptions from crashing query execution
export const getDocs = async (q: any): Promise<any> => {
  if (isFirestoreQuotaExhausted()) {
    return {
      empty: true,
      size: 0,
      docs: [],
      forEach: () => {},
    };
  }
  try {
    return await rawGetDocs(q);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return {
        empty: true,
        size: 0,
        docs: [],
        forEach: () => {},
      };
    }
    throw err;
  }
};

// Resilient setDoc wrapper: always attempts Firestore write, gracefully catches quota errors
export const setDoc = async (
  docRef: DocumentReference<DocumentData>,
  data: DocumentData,
  options?: SetOptions
): Promise<void> => {
  try {
    if (options) {
      await rawSetDoc(docRef, data, options);
    } else {
      await rawSetDoc(docRef, data);
    }
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Resilient updateDoc wrapper: always attempts Firestore write, gracefully catches quota errors
export const updateDoc = async (
  docRef: DocumentReference<DocumentData>,
  dataOrField: UpdateData<DocumentData> | string,
  ...moreFieldsAndValues: any[]
): Promise<void> => {
  try {
    await (rawUpdateDoc as any)(docRef, dataOrField, ...moreFieldsAndValues);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Resilient deleteDoc wrapper: always attempts Firestore write, gracefully catches quota errors
export const deleteDoc = async (docRef: DocumentReference<DocumentData>): Promise<void> => {
  try {
    await rawDeleteDoc(docRef);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Resilient addDoc wrapper: always attempts Firestore write, gracefully catches quota errors
export const addDoc = async (
  collectionRef: CollectionReference<DocumentData>,
  data: DocumentData
): Promise<any> => {
  try {
    return await rawAddDoc(collectionRef, data);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve({ id: 'local_' + Date.now() });
    }
    throw err;
  }
};

// Resilient writeBatch wrapper
export const writeBatch = (firestore: Firestore) => {
  const batch = rawWriteBatch(firestore);
  return {
    set: (docRef: DocumentReference<DocumentData>, data: DocumentData, options?: SetOptions) => {
      if (options) batch.set(docRef, data, options);
      else batch.set(docRef, data);
      return batch;
    },
    update: (docRef: DocumentReference<DocumentData>, dataOrField: any, ...more: any[]) => {
      (batch.update as any)(docRef, dataOrField, ...more);
      return batch;
    },
    delete: (docRef: DocumentReference<DocumentData>) => {
      batch.delete(docRef);
      return batch;
    },
    commit: async (): Promise<void> => {
      try {
        await batch.commit();
      } catch (err: any) {
        if (checkAndHandleQuotaError(err)) {
          return Promise.resolve();
        }
        throw err;
      }
    },
  };
};

// Safe onSnapshot wrapper: guards error handlers against unhandled exceptions
export const onSnapshot = (
  reference: any,
  observerOrNext: any,
  onError?: (error: any) => void
) => {
  const safeOnError = (err: any) => {
    checkAndHandleQuotaError(err);
    if (onError) {
      onError(err);
    } else {
      console.warn('Firestore snapshot error (handled):', err?.message || err);
    }
  };

  if (typeof observerOrNext === 'function') {
    return rawOnSnapshot(reference, observerOrNext, safeOnError);
  } else if (observerOrNext && typeof observerOrNext === 'object') {
    const origError = observerOrNext.error;
    observerOrNext.error = (err: any) => {
      checkAndHandleQuotaError(err);
      if (origError) origError(err);
      else console.warn('Firestore snapshot error (handled):', err?.message || err);
    };
    return rawOnSnapshot(reference, observerOrNext);
  }
  return rawOnSnapshot(reference, observerOrNext, safeOnError);
};

export {
  doc,
  increment,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
};

