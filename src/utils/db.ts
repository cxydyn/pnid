/**
 * IndexedDB storage utility for heavy binary files (PDFs and image attachments).
 * Includes an in-memory fallback cache if IndexedDB is restricted in iframe sandboxes.
 */

const DB_NAME = 'PID_RCA_Studio_DB';
const DB_VERSION = 1;
const STORE_DOCS = 'documents_blob';
const STORE_ATTACHMENTS = 'attachments_blob';

// In-memory fallback
const memoryDocs = new Map<string, ArrayBuffer>();
const memoryAttachments = new Map<string, string | ArrayBuffer>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS);
        }
        if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          db.createObjectStore(STORE_ATTACHMENTS);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save PDF document buffer into IndexedDB
 */
export async function saveDocumentBinary(docId: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  const buffer =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data.slice(0);

  if (buffer.byteLength > 0) {
    memoryDocs.set(docId, buffer);
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.put(buffer, docId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Falls back to memory cache silently
  }
}

/**
 * Retrieve PDF document buffer
 */
export async function getDocumentBinary(docId: string): Promise<ArrayBuffer | null> {
  if (memoryDocs.has(docId)) {
    const cached = memoryDocs.get(docId)!;
    if (cached.byteLength > 0) {
      return cached.slice(0);
    }
    memoryDocs.delete(docId);
  }

  try {
    const db = await openDatabase();
    return await new Promise<ArrayBuffer | null>((resolve) => {
      const tx = db.transaction(STORE_DOCS, 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.get(docId);
      req.onsuccess = () => {
        if (req.result && (req.result as ArrayBuffer).byteLength > 0) {
          const buf = req.result as ArrayBuffer;
          memoryDocs.set(docId, buf);
          resolve(buf.slice(0));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete PDF document from IndexedDB
 */
export async function deleteDocumentBinary(docId: string): Promise<void> {
  memoryDocs.delete(docId);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.delete(docId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Save attachment (image base64 or array buffer)
 */
export async function saveAttachmentBinary(id: string, data: string | ArrayBuffer): Promise<void> {
  memoryAttachments.set(id, data);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
      const store = tx.objectStore(STORE_ATTACHMENTS);
      const req = store.put(data, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Memory fallback active
  }
}

/**
 * Retrieve attachment data
 */
export async function getAttachmentBinary(id: string): Promise<string | ArrayBuffer | null> {
  if (memoryAttachments.has(id)) {
    return memoryAttachments.get(id)!;
  }

  try {
    const db = await openDatabase();
    return await new Promise<string | ArrayBuffer | null>((resolve) => {
      const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
      const store = tx.objectStore(STORE_ATTACHMENTS);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          memoryAttachments.set(id, req.result);
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Get all document binaries for backup export
 */
export async function getAllDocumentBinaries(): Promise<{ [docId: string]: ArrayBuffer }> {
  const result: { [docId: string]: ArrayBuffer } = {};
  for (const [key, val] of memoryDocs.entries()) {
    result[key] = val;
  }

  try {
    const db = await openDatabase();
    const records = await new Promise<{ key: string; value: ArrayBuffer }[]>((resolve) => {
      const tx = db.transaction(STORE_DOCS, 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const items: { key: string; value: ArrayBuffer }[] = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          items.push({ key: String(cursor.key), value: cursor.value });
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => resolve(items);
    });

    for (const item of records) {
      result[item.key] = item.value;
    }
  } catch {
    // Use memoryDocs
  }

  return result;
}

/**
 * Get all attachments for backup export
 */
export async function getAllAttachmentBinaries(): Promise<{ [id: string]: string | ArrayBuffer }> {
  const result: { [id: string]: string | ArrayBuffer } = {};
  for (const [key, val] of memoryAttachments.entries()) {
    result[key] = val;
  }

  try {
    const db = await openDatabase();
    const records = await new Promise<{ key: string; value: string | ArrayBuffer }[]>((resolve) => {
      const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
      const store = tx.objectStore(STORE_ATTACHMENTS);
      const items: { key: string; value: string | ArrayBuffer }[] = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          items.push({ key: String(cursor.key), value: cursor.value });
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => resolve(items);
    });

    for (const item of records) {
      result[item.key] = item.value;
    }
  } catch {
    // Use memoryAttachments
  }

  return result;
}
