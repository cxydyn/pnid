import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  googleSignOut,
  getAccessToken,
  listGoogleDriveFiles,
  downloadGoogleDriveFile,
  uploadFileToGoogleDrive,
  createGoogleDriveFolder,
  deleteGoogleDriveFile,
  DriveFileItem,
} from '../utils/googleAuth';
import { DocumentItem, FolderItem, Hotspot, Annotation, RCAInvestigation } from '../types';
import {
  X,
  Cloud,
  Folder,
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  FolderPlus,
  ExternalLink,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import JSZip from 'jszip';
import { getAllDocumentBinaries, getAllAttachmentBinaries } from '../utils/db';

interface GoogleDriveModalProps {
  documents: DocumentItem[];
  folders: FolderItem[];
  hotspots: Hotspot[];
  annotations: Annotation[];
  rcaInvestigations: RCAInvestigation[];
  activeDocument?: DocumentItem;
  activePdfBuffer?: ArrayBuffer | null;
  onImportDocumentFromDrive: (doc: DocumentItem, buffer: ArrayBuffer) => void;
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  documents,
  folders,
  hotspots,
  annotations,
  rcaInvestigations,
  activeDocument,
  activePdfBuffer,
  onImportDocumentFromDrive,
  onClose,
  onShowToast,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [currentDriveFolderId, setCurrentDriveFolderId] = useState<string | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<Array<{ id?: string; name: string }>>([
    { name: 'My Drive' },
  ]);

  // Confirmation modal for destructive operations
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Check auth on open
  useEffect(() => {
    async function checkToken() {
      const existingToken = await getAccessToken();
      if (existingToken) {
        setToken(existingToken);
        loadFiles();
      }
    }
    checkToken();
  }, []);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setToken(res.accessToken);
        onShowToast('success', 'Connected to Google Drive', `Signed in as ${res.user.email}`);
        await loadFiles(currentDriveFolderId);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      onShowToast('error', 'Authentication Failed', err?.message || 'Could not connect to Google Drive.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setCurrentUser(null);
    setToken(null);
    setDriveFiles([]);
    onShowToast('info', 'Disconnected', 'Signed out from Google Drive.');
  };

  const loadFiles = async (folderId?: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listGoogleDriveFiles(true, folderId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Load drive files error:', err);
      onShowToast('error', 'Google Drive Error', err?.message || 'Failed to list files.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleOpenFolder = (folder: DriveFileItem) => {
    setCurrentDriveFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFiles(folder.id);
  };

  const handleNavigateBreadcrumb = (idx: number) => {
    const target = folderPath[idx];
    const newPath = folderPath.slice(0, idx + 1);
    setFolderPath(newPath);
    setCurrentDriveFolderId(target.id);
    loadFiles(target.id);
  };

  // Import PDF from Google Drive into Workspace
  const handleImportFile = async (file: DriveFileItem) => {
    setIsOperating(true);
    try {
      onShowToast('info', 'Downloading from Drive', file.name);
      const buffer = await downloadGoogleDriveFile(file.id);

      const newDoc: DocumentItem = {
        id: `gdoc-${file.id}`,
        name: file.name,
        folderId: 'f-root',
        size: buffer.byteLength,
        pageCount: 1,
        uploadDate: new Date().toISOString().substring(0, 10),
        title: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        description: 'Imported from Google Drive cloud storage.',
        equipmentTag: file.name.match(/[A-Z]+-\d+/i)?.[0]?.toUpperCase() || 'P&ID-CLOUD',
        systemUnit: 'Google Drive',
        isSample: false,
      };

      onImportDocumentFromDrive(newDoc, buffer);
      onShowToast('success', 'Imported Successfully', `${file.name} is now loaded into your workspace.`);
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      onShowToast('error', 'Import Failed', err?.message || 'Failed to download file from Google Drive.');
    } finally {
      setIsOperating(false);
    }
  };

  // Save current active P&ID drawing to Google Drive
  const handleSaveActiveDocToDrive = async () => {
    if (!activeDocument || !activePdfBuffer) {
      onShowToast('warning', 'No Active Drawing', 'Open a P&ID drawing first before saving to Drive.');
      return;
    }

    setIsOperating(true);
    try {
      onShowToast('info', 'Saving to Google Drive', activeDocument.name);
      await uploadFileToGoogleDrive(
        activeDocument.name,
        'application/pdf',
        activePdfBuffer,
        currentDriveFolderId
      );
      onShowToast('success', 'Saved to Google Drive', `${activeDocument.name} has been uploaded to your Drive.`);
      loadFiles(currentDriveFolderId);
    } catch (err: any) {
      console.error('Save doc error:', err);
      onShowToast('error', 'Upload Failed', err?.message || 'Failed to save document to Google Drive.');
    } finally {
      setIsOperating(false);
    }
  };

  // Save Complete Project Backup (.zip) to Google Drive
  const handleSaveCompleteBackupToDrive = async () => {
    setIsOperating(true);
    try {
      onShowToast('info', 'Packaging Project Backup', 'Bundling PDFs, hotspots, and investigations...');
      const zip = new JSZip();

      const metadata = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        folders,
        documents,
        hotspots,
        annotations,
        rcaInvestigations,
      };
      zip.file('project_config.json', JSON.stringify(metadata, null, 2));

      const docBinaries = await getAllDocumentBinaries();
      const pdfsFolder = zip.folder('pdf_documents');
      if (pdfsFolder) {
        for (const [docId, buffer] of Object.entries(docBinaries)) {
          const doc = documents.find((d) => d.id === docId);
          const filename = doc ? doc.name : `${docId}.pdf`;
          pdfsFolder.file(filename, buffer);
        }
      }

      const attachments = await getAllAttachmentBinaries();
      const attFolder = zip.folder('incident_evidence');
      if (attFolder) {
        for (const [attId, data] of Object.entries(attachments)) {
          if (typeof data === 'string' && data.startsWith('data:')) {
            const base64Data = data.split(',')[1];
            attFolder.file(`${attId}.png`, base64Data, { base64: true });
          } else if (data instanceof ArrayBuffer) {
            attFolder.file(`${attId}.bin`, data);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const backupFilename = `PID_Studio_Backup_${new Date().toISOString().substring(0, 10)}.zip`;

      onShowToast('info', 'Uploading Backup to Drive', backupFilename);
      await uploadFileToGoogleDrive(
        backupFilename,
        'application/zip',
        zipBlob,
        currentDriveFolderId
      );

      onShowToast('success', 'Cloud Backup Complete', `Entire project backup saved to your Google Drive!`);
      loadFiles(currentDriveFolderId);
    } catch (err: any) {
      console.error('Cloud backup error:', err);
      onShowToast('error', 'Cloud Backup Failed', err?.message || 'Failed to upload backup to Drive.');
    } finally {
      setIsOperating(false);
    }
  };

  // Create new folder in Drive
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsOperating(true);
    try {
      await createGoogleDriveFolder(newFolderName.trim(), currentDriveFolderId);
      onShowToast('success', 'Folder Created', newFolderName.trim());
      setNewFolderName('');
      setShowNewFolderInput(false);
      loadFiles(currentDriveFolderId);
    } catch (err: any) {
      onShowToast('error', 'Folder Creation Failed', err?.message);
    } finally {
      setIsOperating(false);
    }
  };

  // Confirm and delete file from Drive
  const handleExecuteDelete = async () => {
    if (!confirmDelete) return;
    setIsOperating(true);
    try {
      await deleteGoogleDriveFile(confirmDelete.id);
      onShowToast('info', 'File Deleted from Drive', confirmDelete.name);
      setConfirmDelete(null);
      loadFiles(currentDriveFolderId);
    } catch (err: any) {
      onShowToast('error', 'Delete Failed', err?.message);
    } finally {
      setIsOperating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Google Drive Cloud Workspace</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Save and import P&ID drawings and RCA investigation backups directly to and from your cloud drive.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Sign In State / Banner */}
          {!token ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-4 bg-slate-950/80 rounded-2xl border border-slate-800">
              <Cloud className="w-12 h-12 text-cyan-400" />
              <div className="max-w-md">
                <h3 className="text-sm font-bold text-white mb-1">Connect Your Google Drive</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sign in with your Google account to access, upload, and synchronize engineering drawings and
                  investigation records without storing data only locally.
                </p>
              </div>

              {/* Official Google Sign In Material Button Style */}
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="mt-2 flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl shadow-lg transition-all border border-slate-300 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isAuthenticating ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Authenticated User Banner & Quick Actions */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="font-medium text-slate-300">
                    Connected to Google Drive {currentUser?.email ? `(${currentUser.email})` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveActiveDocToDrive}
                    disabled={isOperating || !activeDocument}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg font-semibold shadow-sm transition-all"
                    title="Upload current P&ID drawing to Google Drive"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Active P&ID</span>
                  </button>

                  <button
                    onClick={handleSaveCompleteBackupToDrive}
                    disabled={isOperating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-slate-700 rounded-lg font-semibold transition-all"
                    title="Backup all project drawings and RCA data to Drive"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Backup Project to Drive</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Disconnect Google Drive"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drive File Browser Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-2">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 font-medium text-slate-400 overflow-x-auto py-1">
                  {folderPath.map((crumb, idx) => (
                    <React.Fragment key={crumb.id || 'root'}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                      <button
                        onClick={() => handleNavigateBreadcrumb(idx)}
                        className={`hover:text-white transition-colors truncate max-w-[120px] ${
                          idx === folderPath.length - 1 ? 'text-white font-bold' : ''
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {/* Actions: Refresh & New Folder */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowNewFolderInput((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => loadFiles(currentDriveFolderId)}
                    disabled={isLoadingFiles}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                    title="Refresh Drive files"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* New Folder Creation Input */}
              {showNewFolderInput && (
                <div className="p-3 bg-slate-950 rounded-xl border border-cyan-800/60 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Folder name in Drive (e.g. Unit 1 P&IDs)..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') setShowNewFolderInput(false);
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                  <button
                    onClick={handleCreateFolder}
                    disabled={isOperating}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewFolderInput(false)}
                    className="px-2.5 py-1.5 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Files Table / List */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                {isLoadingFiles ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-400 font-mono">Fetching Google Drive items...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    No PDF documents or folders found in this Google Drive directory.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Item Name</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Modified</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {driveFiles.map((item) => {
                        const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-900/70 transition-colors group cursor-pointer"
                            onClick={() => {
                              if (isFolder) handleOpenFolder(item);
                            }}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                {isFolder ? (
                                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                                )}
                                <span className={`font-medium truncate ${isFolder ? 'text-white' : 'text-slate-200'}`}>
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400 tabular-nums">
                              {item.size ? `${(parseInt(item.size) / 1024).toFixed(0)} KB` : '—'}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400 tabular-nums">
                              {item.modifiedTime ? item.modifiedTime.substring(0, 10) : '—'}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {!isFolder && (
                                  <button
                                    onClick={() => handleImportFile(item)}
                                    disabled={isOperating}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded font-medium transition-colors"
                                    title="Open and load into workspace"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Open</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDelete({ id: item.id, name: item.name })}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Delete from Drive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Google Drive API v3 · Permission-based cloud synchronization
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR DESTRUCTIVE OPERATIONS */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete from Google Drive?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white font-mono">{confirmDelete.name}</strong> from your Google Drive? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isOperating}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
