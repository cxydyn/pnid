import { DocumentItem, FolderItem } from '../types';
import { saveDocumentBinary } from './db';

export interface UploadedFileEntry {
  file: File;
  relativePath: string;
}

/**
 * Recursively read FileSystemEntry tree from drag and drop
 */
export async function scanEntry(entry: any, path = ''): Promise<UploadedFileEntry[]> {
  const currentPath = path ? `${path}/${entry.name}` : entry.name;

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => {
        resolve([{ file, relativePath: currentPath }]);
      }, () => resolve([]));
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readAllEntries = async (): Promise<any[]> => {
      const all: any[] = [];
      let batch: any[] = [];
      do {
        batch = await new Promise((resolve) => {
          dirReader.readEntries((entries: any[]) => resolve(entries || []), () => resolve([]));
        });
        all.push(...batch);
      } while (batch.length > 0);
      return all;
    };

    const entries = await readAllEntries();
    const results: UploadedFileEntry[] = [];
    for (const child of entries) {
      const childFiles = await scanEntry(child, currentPath);
      results.push(...childFiles);
    }
    return results;
  }
  return [];
}

/**
 * Process a collection of files with relative paths, creating virtual folders and documents
 */
export async function processFolderUpload(
  fileEntries: UploadedFileEntry[],
  currentFolderId: string,
  existingFolders: FolderItem[],
  onFoldersCreated: (newFolders: FolderItem[]) => void,
  onDocumentsCreated: (newDocs: DocumentItem[]) => void
): Promise<{ foldersAdded: number; docsAdded: number }> {
  const folderCache = new Map<string, string>(); // path -> folderId
  const newFoldersList: FolderItem[] = [];
  const newDocsList: DocumentItem[] = [];

  // Helper to ensure path hierarchy exists
  const getOrCreateFolderId = (folderPathSegments: string[]): string => {
    let parentId = currentFolderId;
    let accumulatedPath = '';

    for (const segment of folderPathSegments) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

      if (folderCache.has(accumulatedPath)) {
        parentId = folderCache.get(accumulatedPath)!;
        continue;
      }

      // Check if already in existingFolders or newly created
      const foundExisting =
        existingFolders.find((f) => f.name.toLowerCase() === segment.toLowerCase() && f.parentId === parentId) ||
        newFoldersList.find((f) => f.name.toLowerCase() === segment.toLowerCase() && f.parentId === parentId);

      if (foundExisting) {
        folderCache.set(accumulatedPath, foundExisting.id);
        parentId = foundExisting.id;
      } else {
        const newFolderId = `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newFolder: FolderItem = {
          id: newFolderId,
          name: segment,
          parentId,
          createdAt: new Date().toISOString().substring(0, 10),
        };
        newFoldersList.push(newFolder);
        folderCache.set(accumulatedPath, newFolderId);
        parentId = newFolderId;
      }
    }

    return parentId;
  };

  // Process all files
  for (const { file, relativePath } of fileEntries) {
    if (!file.name.toLowerCase().endsWith('.pdf')) continue;

    // e.g. "RootFolder/SubFolder/P&ID-101.pdf" -> segments = ["RootFolder", "SubFolder"]
    const parts = relativePath.split('/');
    parts.pop(); // Remove file name

    const targetFolderId = parts.length > 0 ? getOrCreateFolderId(parts) : currentFolderId;

    try {
      const rawBuffer = await file.arrayBuffer();
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      let pageCount = 1;
      try {
        const pLib = (window as any).pdfjsLib;
        if (pLib) {
          const loadingTask = pLib.getDocument({ data: new Uint8Array(rawBuffer.slice(0)) });
          const doc = await loadingTask.promise;
          pageCount = doc.numPages;
        }
      } catch {
        pageCount = 1;
      }

      await saveDocumentBinary(docId, rawBuffer.slice(0));

      const newDoc: DocumentItem = {
        id: docId,
        name: file.name,
        folderId: targetFolderId,
        size: file.size,
        pageCount,
        uploadDate: new Date().toISOString().substring(0, 10),
        title: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        description: `Imported from folder '${parts.join('/') || 'Root'}'.`,
        equipmentTag: file.name.match(/[A-Z]+-\d+/i)?.[0]?.toUpperCase() || 'P&ID',
        systemUnit: parts[parts.length - 1] || 'Process Plant',
        isSample: false,
      };

      newDocsList.push(newDoc);
    } catch (err) {
      console.error('Failed to process file:', file.name, err);
    }
  }

  if (newFoldersList.length > 0) {
    onFoldersCreated(newFoldersList);
  }
  if (newDocsList.length > 0) {
    onDocumentsCreated(newDocsList);
  }

  return {
    foldersAdded: newFoldersList.length,
    docsAdded: newDocsList.length,
  };
}
