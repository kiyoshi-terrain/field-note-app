/**
 * Google Drive API wrapper for PMTiles cloud sync.
 * Uses Google Identity Services (GIS) token model + Drive REST API v3.
 * No gapi dependency — all calls are plain fetch().
 */

const CLIENT_ID =
  '865685530520-bsqi11iuvurlp7upolhmnujc6kl38gqt.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'field-note-app';
const METADATA_FILENAME = 'metadata.json';

// ─── Types ──────────────────────────────────────────────

export interface DriveUser {
  email: string;
  name: string;
  picture: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

export interface OverlayMetadata {
  id: string;
  filename: string;
  opacity: number;
  visible: boolean;
  groupId: string;
  driveFileId: string;
  timestamp: number;
}

export interface SyncMetadata {
  version: number;
  overlays: OverlayMetadata[];
  groups: { id: string; name: string; expanded: boolean; order: number }[];
  lastSync: number;
}

// ─── GIS Token State ────────────────────────────────────

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let currentUser: DriveUser | null = null;
let appFolderId: string | null = null;

// Callback for sign-in result
type AuthCallback = (user: DriveUser | null, error?: string) => void;
let pendingAuthCallback: AuthCallback | null = null;

// ─── GIS Initialization ─────────────────────────────────

/** Load the GIS script tag if not already present */
function ensureGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GIS'));
    document.head.appendChild(script);
  });
}

/** Initialise the GIS token client (call once on app boot) */
export async function initGoogleAuth(): Promise<void> {
  await ensureGisScript();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        pendingAuthCallback?.(null, tokenResponse.error);
        pendingAuthCallback = null;
        return;
      }
      accessToken = tokenResponse.access_token;
      // Fetch user profile
      try {
        const res = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const info = await res.json();
        currentUser = {
          email: info.email,
          name: info.name || info.email,
          picture: info.picture || '',
        };
        pendingAuthCallback?.(currentUser);
      } catch {
        pendingAuthCallback?.(null, 'Failed to fetch user info');
      }
      pendingAuthCallback = null;
    },
  });
}

// ─── Auth ───────────────────────────────────────────────

export function signIn(): Promise<DriveUser> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialised'));
      return;
    }
    pendingAuthCallback = (user, error) => {
      if (user) resolve(user);
      else reject(new Error(error ?? 'Sign in failed'));
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function signOut(): void {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  currentUser = null;
  appFolderId = null;
}

export function getUser(): DriveUser | null {
  return currentUser;
}

export function isSignedIn(): boolean {
  return accessToken !== null;
}

// ─── Drive Helpers ──────────────────────────────────────

async function driveRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!accessToken) throw new Error('Not authenticated');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    // Token expired — clear & throw
    accessToken = null;
    currentUser = null;
    throw new Error('Token expired');
  }
  return res;
}

// ─── Folder Management ──────────────────────────────────

/** Get or create the app-specific folder in Drive root */
export async function getOrCreateAppFolder(): Promise<string> {
  if (appFolderId) return appFolderId;

  // Search for existing folder
  const q = encodeURIComponent(
    `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`,
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    appFolderId = data.files[0].id;
    return appFolderId!;
  }

  // Create new folder
  const createRes = await driveRequest(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  appFolderId = folder.id;
  return appFolderId!;
}

// ─── File Operations ────────────────────────────────────

/** Upload a PMTiles file (creates new or updates existing) */
export async function uploadPMTiles(
  filename: string,
  data: ArrayBuffer,
  existingFileId?: string,
): Promise<string> {
  const folderId = await getOrCreateAppFolder();

  const metadata: Record<string, unknown> = { name: filename };
  if (!existingFileId) {
    metadata.parents = [folderId];
  }

  const boundary = '----FieldNoteAppBoundary';
  const metaPart = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(prefix.length + data.byteLength + suffix.length);
  body.set(prefix, 0);
  body.set(new Uint8Array(data), prefix.length);
  body.set(suffix, prefix.length + data.byteLength);

  const url = existingFileId
    ? `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart&fields=id,name,size,modifiedTime`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,modifiedTime`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await driveRequest(url, {
    method,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body.buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${res.status} ${err}`);
  }

  const file = await res.json();
  return file.id;
}

/** Download a PMTiles file by Drive file ID */
export async function downloadPMTiles(
  fileId: string,
): Promise<ArrayBuffer> {
  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
  );
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  return res.arrayBuffer();
}

/** List all files in the app folder */
export async function listPMTilesFiles(): Promise<DriveFileInfo[]> {
  const folderId = await getOrCreateAppFolder();
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and name != '${METADATA_FILENAME}'`,
  );
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,size,modifiedTime)&orderBy=name&pageSize=200`,
  );
  const data = await res.json();
  return data.files || [];
}

/** Delete a file from Drive */
export async function deletePMTilesFile(fileId: string): Promise<void> {
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}

// ─── Metadata (JSON) Sync ───────────────────────────────

async function findMetadataFile(): Promise<string | null> {
  const folderId = await getOrCreateAppFolder();
  const q = encodeURIComponent(
    `name='${METADATA_FILENAME}' and '${folderId}' in parents and trashed=false`,
  );
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${q}&fields=files(id)`,
  );
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

/** Upload overlay/group metadata as JSON */
export async function uploadMetadata(
  metadata: SyncMetadata,
): Promise<void> {
  const folderId = await getOrCreateAppFolder();
  const existingId = await findMetadataFile();

  const metaJson = JSON.stringify(metadata, null, 2);
  const blob = new Blob([metaJson], { type: 'application/json' });

  const fileMetadata: Record<string, unknown> = {
    name: METADATA_FILENAME,
  };
  if (!existingId) {
    fileMetadata.parents = [folderId];
  }

  const boundary = '----MetaBoundary';
  const metaPart = JSON.stringify(fileMetadata);
  const blobArrayBuffer = await blob.arrayBuffer();

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(
    prefix.length + blobArrayBuffer.byteLength + suffix.length,
  );
  body.set(prefix, 0);
  body.set(new Uint8Array(blobArrayBuffer), prefix.length);
  body.set(suffix, prefix.length + blobArrayBuffer.byteLength);

  const url = existingId
    ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;
  const method = existingId ? 'PATCH' : 'POST';

  const res = await driveRequest(url, {
    method,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body.buffer,
  });

  if (!res.ok) {
    throw new Error(`Metadata upload failed: ${res.status}`);
  }
}

/** Download overlay/group metadata JSON */
export async function downloadMetadata(): Promise<SyncMetadata | null> {
  const fileId = await findMetadataFile();
  if (!fileId) return null;

  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
  );
  if (!res.ok) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
}
