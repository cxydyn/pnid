import React, { useState, useMemo, useRef } from 'react';
import { DocumentItem, FolderItem } from '../types';
import { scanEntry, processFolderUpload, UploadedFileEntry } from '../utils/folderUpload';
import {
  Folder,
  FolderPlus,
  FileText,
  Upload,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Download,
  Eye,
  Grid,
  List,
  Layers,
  HardDrive,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Plus,
  FolderUp,
  Cloud
} from 'lucide-react';

interface FileExplorerProps {
  documents: DocumentItem[];
  folders: FolderItem[];
  currentFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onOpenDocument: (docId: string) => void;
  onUploadPdf: (files: FileList | File[]) => void;
  onFolderUploadCompleted: (newFolders: FolderItem[], newDocs: DocumentItem[]) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameDocument: (docId: string, newTitle: string) => void;
  onDeleteDocument: (docId: string) => void;
  onMoveDocument: (docId: string, targetFolderId: string) => void;
  onDownloadDocument: (docId: string) => void;
  onOpenDataSync: () => void;
  onOpenGoogleDrive: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'folder' | 'document' | 'canvas';
  targetId?: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  documents,
  folders,
  currentFolderId,
  onSelectFolder,
  onOpenDocument,
  onUploadPdf,
  onFolderUploadCompleted,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameDocument,
  onDeleteDocument,
  onMoveDocument,
  onDownloadDocument,
  onOpenDataSync,
  onOpenGoogleDrive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(['f-root', 'f-boiler', 'f-cooling', 'f-gas'])
  );

  // Drag and drop state for files moving into folders
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingFilesOver, setIsDraggingFilesOver] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: 'canvas',
  });

  // Modal prompts
  const [promptModal, setPromptModal] = useState<{
    visible: boolean;
    title: string;
    placeholder: string;
    initialValue: string;
    action: (val: string) => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle folder upload input change
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessingUpload(true);
    try {
      const files = Array.from(e.target.files);
      const entries: UploadedFileEntry[] = files.map((file) => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }));

      const createdFolders: FolderItem[] = [];
      const createdDocs: DocumentItem[] = [];

      await processFolderUpload(
        entries,
        currentFolderId,
        folders,
        (newF) => createdFolders.push(...newF),
        (newD) => createdDocs.push(...newD)
      );

      onFolderUploadCompleted(createdFolders, createdDocs);
    } catch (err) {
      console.error('Folder upload processing error:', err);
    } finally {
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  // Toggle tree expansion
  const toggleFolderExpand = (folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Build tree hierarchy
  const folderMap = useMemo(() => {
    const map = new Map<string | null, FolderItem[]>();
    folders.forEach((f) => {
      const parent = f.parentId;
      if (!map.has(parent)) {
        map.set(parent, []);
      }
      map.get(parent)!.push(f);
    });
    return map;
  }, [folders]);

  // Current folder's path breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs: FolderItem[] = [];
    let curr = folders.find((f) => f.id === currentFolderId);
    while (curr) {
      crumbs.unshift(curr);
      curr = folders.find((f) => f.id === curr?.parentId);
    }
    return crumbs;
  }, [folders, currentFolderId]);

  // Filtered documents in current view
  const currentDocs = useMemo(() => {
    let list = documents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          (d.equipmentTag && d.equipmentTag.toLowerCase().includes(q))
      );
    } else {
      list = list.filter((d) => d.folderId === currentFolderId);
    }
    return list;
  }, [documents, currentFolderId, searchQuery]);

  // Child folders in current view
  const currentChildFolders = useMemo(() => {
    return folders.filter((f) => f.parentId === currentFolderId);
  }, [folders, currentFolderId]);

  // Context menu triggers
  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'document' | 'canvas', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 260),
      type,
      targetId,
    });
  };

  // Close context menu on outside click
  React.useEffect(() => {
    const handleClose = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [contextMenu.visible]);

  // Handle external file or folder drop (upload)
  const handleExplorerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFilesOver(false);

    // If dragging internal document to move
    if (draggedDocId && dragOverFolderId) {
      onMoveDocument(draggedDocId, dragOverFolderId);
      setDraggedDocId(null);
      setDragOverFolderId(null);
      return;
    }

    // Check if items support webkitGetAsEntry (for dropped folders)
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      setIsProcessingUpload(true);
      try {
        const entries: UploadedFileEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = (items[i] as any).webkitGetAsEntry();
          if (entry) {
            const scanned = await scanEntry(entry);
            entries.push(...scanned);
          }
        }

        if (entries.length > 0) {
          const createdFolders: FolderItem[] = [];
          const createdDocs: DocumentItem[] = [];

          await processFolderUpload(
            entries,
            currentFolderId,
            folders,
            (newF) => createdFolders.push(...newF),
            (newD) => createdDocs.push(...newD)
          );

          onFolderUploadCompleted(createdFolders, createdDocs);
          return;
        }
      } catch (err) {
        console.error('Drop folder scan error:', err);
      } finally {
        setIsProcessingUpload(false);
      }
    }

    // External file upload fallback
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadPdf(e.dataTransfer.files);
    }
  };

  // Render tree item recursively
  const renderTreeItem = (folder: FolderItem, level = 0) => {
    const children = folderMap.get(folder.id) || [];
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = currentFolderId === folder.id;
    const docCount = documents.filter((d) => d.folderId === folder.id).length;

    if (
      treeSearch &&
      !folder.name.toLowerCase().includes(treeSearch.toLowerCase()) &&
      !children.some((c) => c.name.toLowerCase().includes(treeSearch.toLowerCase()))
    ) {
      return null;
    }

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => onSelectFolder(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedDocId) {
              onMoveDocument(draggedDocId, folder.id);
              setDraggedDocId(null);
              setDragOverFolderId(null);
            }
          }}
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          } ${dragOverFolderId === folder.id ? 'ring-2 ring-cyan-400 bg-cyan-950/60' : ''}`}
          style={{ paddingLeft: `${Math.max(10, level * 16 + 8)}px` }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => toggleFolderExpand(folder.id, e)}
              className="p-0.5 text-slate-500 group-hover:text-slate-300 hover:text-white rounded"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400/90 shrink-0" />
          )}

          <span className="truncate flex-1">{folder.name}</span>

          {docCount > 0 && (
            <span className="text-[10px] tabular-nums px-1.5 py-0.2 text-slate-400 bg-slate-800 rounded font-mono">
              {docCount}
            </span>
          )}
        </div>

        {isExpanded && children.length > 0 && (
          <div className="flex flex-col">
            {children.map((child) => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-950 overflow-hidden text-slate-200">
      {/* Hidden File Input for uploading individual PDFs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadPdf(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden Folder Input for uploading entire directory trees */}
      <input
        type="file"
        ref={folderInputRef}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* LEFT SIDEBAR: Windows Explorer Tree View */}
      <aside className="w-72 shrink-0 border-r border-slate-800/80 bg-slate-900/60 flex flex-col backdrop-blur-sm">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>Virtual Storage</span>
          </div>
          <button
            onClick={() => {
              setPromptModal({
                visible: true,
                title: 'Create Virtual Folder',
                placeholder: 'Folder name (e.g. Unit 2 Boiler)',
                initialValue: '',
                action: (name) => {
                  if (name.trim()) onCreateFolder(name.trim(), currentFolderId);
                },
              });
            }}
            title="Create Folder in current directory"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Tree Search */}
        <div className="p-3 border-b border-slate-800/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search folders..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Folder Hierarchy Tree */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {folders.filter((f) => f.parentId === null).map((root) => renderTreeItem(root, 0))}
        </div>

        {/* Storage Info / Sync Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/80 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{documents.length} Drawings Cached</span>
            </div>
            <button
              onClick={onOpenDataSync}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>

          <button
            onClick={onOpenGoogleDrive}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 rounded-lg text-cyan-300 font-semibold transition-colors"
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google Drive Storage</span>
          </button>
        </div>
      </aside>

      {/* MAIN EXPLORER CONTENT */}
      <main
        className="flex-1 flex flex-col min-w-0 bg-slate-950"
        onContextMenu={(e) => handleContextMenu(e, 'canvas')}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFilesOver(true);
        }}
        onDragLeave={() => setIsDraggingFilesOver(false)}
        onDrop={handleExplorerDrop}
      >
        {/* Top Explorer Navigation & Action Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/30">
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 overflow-x-auto py-1">
            <button
              onClick={() => onSelectFolder('f-root')}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Drive</span>
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => onSelectFolder(crumb.id)}
                  className={`hover:text-white transition-colors truncate max-w-[140px] ${
                    idx === breadcrumbs.length - 1 ? 'text-white font-semibold' : ''
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Bar */}
            <div className="relative w-48 lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search drawings & tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Upload Folder Button */}
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition-all"
              title="Upload an entire folder hierarchy of PDF drawings"
            >
              <FolderUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Folder</span>
            </button>

            {/* Upload PDF Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              title="Upload individual PDF drawings"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </button>

            {/* Google Drive Workspace Button */}
            <button
              onClick={onOpenGoogleDrive}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 hover:text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              title="Open Google Drive Cloud Workspace"
            >
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Google Drive</span>
            </button>
          </div>
        </div>

        {/* Drag-over indicator overlay */}
        {isDraggingFilesOver && (
          <div className="absolute inset-0 bg-cyan-950/85 border-2 border-dashed border-cyan-400 z-40 flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none">
            <Upload className="w-12 h-12 text-cyan-400 animate-bounce" />
            <p className="text-sm font-semibold text-white">Drop PDF schematics or folders here to import</p>
            <p className="text-xs text-cyan-300">Folder structures will be automatically mapped to virtual directories</p>
          </div>
        )}

        {/* Processing folder / files upload spinner */}
        {isProcessingUpload && (
          <div className="absolute inset-0 bg-slate-950/80 z-40 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
            <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-white">Processing folder hierarchy & indexing PDF drawings...</p>
            <p className="text-xs text-slate-400">Saving binaries to high-speed offline storage</p>
          </div>
        )}

        {/* Explorer Items View */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Subfolders in current view */}
          {currentChildFolders.length > 0 && !searchQuery && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Folders</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {currentChildFolders.map((folder) => {
                  const docCount = documents.filter((d) => d.folderId === folder.id).length;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => onSelectFolder(folder.id)}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedDocId) {
                          onMoveDocument(draggedDocId, folder.id);
                          setDraggedDocId(null);
                          setDragOverFolderId(null);
                        }
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 cursor-pointer transition-all ${
                        dragOverFolderId === folder.id ? 'ring-2 ring-cyan-400 bg-cyan-950/80' : ''
                      }`}
                    >
                      <Folder className="w-7 h-7 text-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                          {folder.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">{docCount} items</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {searchQuery ? `Search Results (${currentDocs.length})` : `Drawings & Schematics (${currentDocs.length})`}
              </h4>
            </div>

            {currentDocs.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 bg-slate-900/20">
                <FileText className="w-10 h-10 text-slate-600" />
                <div className="text-sm font-medium text-slate-300">No P&ID diagrams found in this folder</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Upload an engineering PDF, drag and drop files directly onto this window, or create subfolders.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium rounded-lg transition-colors border border-slate-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload PDF Drawing</span>
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={() => setDraggedDocId(doc.id)}
                    onDragEnd={() => setDraggedDocId(null)}
                    onContextMenu={(e) => handleContextMenu(e, 'document', doc.id)}
                    onClick={() => onOpenDocument(doc.id)}
                    className="group relative flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-850 hover:border-slate-700 hover:shadow-lg cursor-pointer transition-all"
                  >
                    <div>
                      {/* Card Header with Icon and Tag */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        {doc.equipmentTag && (
                          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/50 px-2 py-0.5 rounded">
                            {doc.equipmentTag}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 line-clamp-1 transition-colors">
                        {doc.title || doc.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {doc.description || 'P&ID piping loop and equipment schematics.'}
                      </p>
                    </div>

                    {/* Metadata & Actions Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span>{doc.pageCount} {doc.pageCount === 1 ? 'Page' : 'Pages'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{(doc.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadDocument(doc.id);
                          }}
                          className="p-1 hover:text-white rounded"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDocument(doc.id);
                          }}
                          className="p-1 hover:text-cyan-400 rounded"
                          title="Open in Viewer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View Table */
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Drawing Title / Filename</th>
                      <th className="py-2.5 px-3">Tag / System</th>
                      <th className="py-2.5 px-3">Pages</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Uploaded</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        draggable
                        onDragStart={() => setDraggedDocId(doc.id)}
                        onDragEnd={() => setDraggedDocId(null)}
                        onContextMenu={(e) => handleContextMenu(e, 'document', doc.id)}
                        onClick={() => onOpenDocument(doc.id)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                                {doc.title || doc.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">{doc.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-cyan-400">
                          {doc.equipmentTag || '—'}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                          {doc.pageCount}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                          {(doc.size / 1024).toFixed(0)} KB
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                          {doc.uploadDate}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onDownloadDocument(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-white rounded"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenDocument(doc.id)}
                              className="p-1.5 text-cyan-400 hover:text-cyan-300 rounded"
                              title="Open Viewer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* RIGHT-CLICK CONTEXT MENU */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 w-52 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-slate-200 backdrop-blur-md animate-in fade-in"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'document' && contextMenu.targetId && (
            <>
              <button
                onClick={() => {
                  onOpenDocument(contextMenu.targetId!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-600 hover:text-white transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open in Viewer</span>
              </button>
              <button
                onClick={() => {
                  const doc = documents.find((d) => d.id === contextMenu.targetId);
                  setPromptModal({
                    visible: true,
                    title: 'Rename Drawing Title',
                    placeholder: 'Enter new title',
                    initialValue: doc?.title || doc?.name || '',
                    action: (newTitle) => onRenameDocument(contextMenu.targetId!, newTitle),
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename Title</span>
              </button>
              <button
                onClick={() => {
                  onDownloadDocument(contextMenu.targetId!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onDeleteDocument(contextMenu.targetId!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Drawing</span>
              </button>
            </>
          )}

          {contextMenu.type === 'folder' && contextMenu.targetId && (
            <>
              <button
                onClick={() => {
                  onSelectFolder(contextMenu.targetId!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-600 hover:text-white transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Folder</span>
              </button>
              <button
                onClick={() => {
                  const folder = folders.find((f) => f.id === contextMenu.targetId);
                  setPromptModal({
                    visible: true,
                    title: 'Rename Folder',
                    placeholder: 'Enter new folder name',
                    initialValue: folder?.name || '',
                    action: (newName) => onRenameFolder(contextMenu.targetId!, newName),
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename Folder</span>
              </button>
              <button
                onClick={() => {
                  setPromptModal({
                    visible: true,
                    title: 'Create Subfolder',
                    placeholder: 'Subfolder name',
                    initialValue: '',
                    action: (name) => {
                      if (name.trim()) onCreateFolder(name.trim(), contextMenu.targetId!);
                    },
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Subfolder</span>
              </button>
              {contextMenu.targetId !== 'f-root' && (
                <>
                  <div className="h-px bg-slate-800 my-1" />
                  <button
                    onClick={() => {
                      onDeleteFolder(contextMenu.targetId!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Folder</span>
                  </button>
                </>
              )}
            </>
          )}

          {contextMenu.type === 'canvas' && (
            <>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Upload PDF Here</span>
              </button>
              <button
                onClick={() => {
                  folderInputRef.current?.click();
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <FolderUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Folder Here</span>
              </button>
              <button
                onClick={() => {
                  setPromptModal({
                    visible: true,
                    title: 'Create Virtual Folder',
                    placeholder: 'Folder name',
                    initialValue: '',
                    action: (name) => {
                      if (name.trim()) onCreateFolder(name.trim(), currentFolderId);
                    },
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>New Folder</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onOpenGoogleDrive();
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-cyan-300 hover:bg-cyan-950/60 transition-colors"
              >
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Google Drive</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* PROMPT / RENAME MODAL */}
      {promptModal?.visible && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">{promptModal.title}</h3>
            <input
              type="text"
              autoFocus
              defaultValue={promptModal.initialValue}
              placeholder={promptModal.placeholder}
              id="promptModalInput"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (document.getElementById('promptModalInput') as HTMLInputElement)?.value;
                  promptModal.action(val);
                  setPromptModal(null);
                } else if (e.key === 'Escape') {
                  setPromptModal(null);
                }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPromptModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const val = (document.getElementById('promptModalInput') as HTMLInputElement)?.value;
                  promptModal.action(val);
                  setPromptModal(null);
                }}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
