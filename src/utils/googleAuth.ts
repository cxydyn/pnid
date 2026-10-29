/**
 * Google Workspace / Google Drive Authentication & Integration
 * Uses Firebase Auth for Client-Side Google Sign-In with Drive Scopes.
 * Includes graceful handling for unauthorized domains, demo drive simulation,
 * and manual access token injection.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { generateSamplePidPdf } from './sampleData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let isDemoMode = false;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

let demoDriveFiles: DriveFileItem[] = [
  {
    id: 'demo-folder-1',
    name: 'Vopak Terminal P&ID Archive',
    mimeType: 'application/vnd.google-apps.folder',
    modifiedTime: new Date().toISOString(),
  },
  {
    id: 'demo-doc-1',
    name: 'PID-101-REV4-Boiler-Feedwater-Loop.pdf',
    mimeType: 'application/pdf',
    size: '245760',
    modifiedTime: new Date().toISOString(),
  },
  {
    id: 'demo-doc-2',
    name: 'PID-204-REV2-Chilled-Water-Circuit.pdf',
    mimeType: 'application/pdf',
    size: '198400',
    modifiedTime: new Date().toISOString(),
  },
  {
    id: 'demo-backup-1',
    name: 'PID_Studio_Backup_2026-10-28.zip',
    mimeType: 'application/zip',
    size: '512000',
    modifiedTime: new Date().toISOString(),
  },
];

/**
 * Initialize Google Auth listener
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (!isDemoMode) {
        cachedAccessToken = null;
      }
      if (onAuthFailure && !isDemoMode) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign In Popup with graceful domain fallback
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token otentikasi Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    isDemoMode = false;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (errorCode === 'auth/unauthorized-domain') {
      console.warn(
        `[GoogleAuth] Domain "${window.location.hostname}" belum di-whitelist di Firebase Authentication Authorized Domains.`
      );
    } else if (errorCode === 'auth/popup-closed-by-user') {
      console.warn('[GoogleAuth] Jendela pop-up Google Sign-In ditutup oleh pengguna.');
    } else {
      console.warn('[GoogleAuth] Catatan autentikasi:', error?.message);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Enable interactive simulated demo drive mode
 */
export const enableDemoDriveMode = (): { user: any; accessToken: string } => {
  isDemoMode = true;
  cachedAccessToken = 'demo-drive-token-simulated';
  return {
    user: {
      displayName: 'Vopak Engineering Terminal (Demo Cloud)',
      email: 'engineering@vopak.com',
      photoURL: null,
    } as any,
    accessToken: cachedAccessToken,
  };
};

/**
 * Injected manual access token (e.g. from developer console)
 */
export const setManualAccessToken = (tokenStr: string): string => {
  cachedAccessToken = tokenStr.trim();
  isDemoMode = false;
  return cachedAccessToken;
};

/**
 * Check if demo mode is active
 */
export const getIsDemoDriveMode = (): boolean => isDemoMode;

/**
 * Retrieve cached in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  isDemoMode = false;
};

/**
 * List files from Google Drive
 */
export const listGoogleDriveFiles = async (
  filterPdfsOnly = true,
  folderId?: string
): Promise<DriveFileItem[]> => {
  if (isDemoMode) {
    if (folderId) {
      return demoDriveFiles.filter((f) => f.parents?.includes(folderId));
    }
    return demoDriveFiles.filter((f) => !f.parents || f.parents.length === 0);
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Belum terhubung ke Google Drive.');

  let q = 'trashed = false';
  if (filterPdfsOnly) {
    q += " and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder')";
  }
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime, parents)');
  url.searchParams.set('orderBy', 'folder,name');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengambil daftar file Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Download file binary from Google Drive
 */
export const downloadGoogleDriveFile = async (fileId: string): Promise<ArrayBuffer> => {
  if (isDemoMode) {
    const sampleBytes = await generateSamplePidPdf('doc-pid-101');
    return sampleBytes.buffer.slice(sampleBytes.byteOffset, sampleBytes.byteOffset + sampleBytes.byteLength) as ArrayBuffer;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Belum terhubung ke Google Drive.');

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengunduh file dari Google Drive (${response.status})`);
  }

  return await response.arrayBuffer();
};

/**
 * Upload a file/document to Google Drive using multipart upload
 */
export const uploadFileToGoogleDrive = async (
  name: string,
  mimeType: string,
  fileData: ArrayBuffer | Blob,
  folderId?: string
): Promise<DriveFileItem> => {
  if (isDemoMode) {
    const sizeBytes = fileData instanceof Blob ? fileData.size : fileData.byteLength;
    const newDemoItem: DriveFileItem = {
      id: `demo-file-${Date.now()}`,
      name,
      mimeType,
      size: String(sizeBytes || 245760),
      modifiedTime: new Date().toISOString(),
      parents: folderId ? [folderId] : undefined,
    };
    demoDriveFiles = [newDemoItem, ...demoDriveFiles];
    return newDemoItem;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Belum terhubung ke Google Drive.');

  const metadata: any = {
    name,
    mimeType,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const blobData = fileData instanceof Blob ? fileData : new Blob([fileData], { type: mimeType });

  const metadataBlob = new Blob(
    [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ],
    { type: 'text/plain' }
  );

  const multipartBody = new Blob([metadataBlob, blobData, new Blob([closeDelimiter], { type: 'text/plain' })]);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengunggah ke Google Drive (${response.status})`);
  }

  return await response.json();
};

/**
 * Create a folder in Google Drive
 */
export const createGoogleDriveFolder = async (
  folderName: string,
  parentFolderId?: string
): Promise<DriveFileItem> => {
  if (isDemoMode) {
    const newFolder: DriveFileItem = {
      id: `demo-folder-${Date.now()}`,
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      modifiedTime: new Date().toISOString(),
      parents: parentFolderId ? [parentFolderId] : undefined,
    };
    demoDriveFiles = [newFolder, ...demoDriveFiles];
    return newFolder;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Belum terhubung ke Google Drive.');

  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal membuat folder di Google Drive (${response.status})`);
  }

  return await response.json();
};

/**
 * Delete a file in Google Drive
 */
export const deleteGoogleDriveFile = async (fileId: string): Promise<void> => {
  if (isDemoMode) {
    demoDriveFiles = demoDriveFiles.filter((f) => f.id !== fileId);
    return;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Belum terhubung ke Google Drive.');

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Gagal menghapus file dari Google Drive (${response.status})`);
  }
};
