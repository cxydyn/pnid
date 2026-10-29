/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  DocumentItem,
  FolderItem,
  Hotspot,
  Annotation,
  RCAInvestigation,
  ToastMessage,
} from './types';
import {
  INITIAL_DOCUMENTS,
  INITIAL_FOLDERS,
  INITIAL_HOTSPOTS,
  INITIAL_RCA,
  generateSamplePidPdf,
} from './utils/sampleData';
import {
  saveDocumentBinary,
  getDocumentBinary,
  deleteDocumentBinary,
  saveAttachmentBinary,
} from './utils/db';
import { FileExplorer } from './components/FileExplorer';
import { PdfViewer } from './components/PdfViewer';
import { RcaDashboard } from './components/RcaDashboard';
import { PrintReportView } from './components/PrintReportView';
import { DataSyncModal } from './components/DataSyncModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { ToastContainer } from './components/ToastContainer';
import {
  Layers,
  HardDrive,
  FileText,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  Eye,
  Sliders,
  Printer,
  Cloud,
  Star
} from 'lucide-react';

const STORAGE_KEY_DOCS = 'pid_studio_docs_v1';
const STORAGE_KEY_FOLDERS = 'pid_studio_folders_v1';
const STORAGE_KEY_HOTSPOTS = 'pid_studio_hotspots_v1';
const STORAGE_KEY_ANNOTATIONS = 'pid_studio_annotations_v1';
const STORAGE_KEY_RCA = 'pid_studio_rca_v1';

export default function App() {
  // Application Data States
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FOLDERS);
      return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
    } catch {
      return INITIAL_FOLDERS;
    }
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCS);
      return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  const [hotspots, setHotspots] = useState<Hotspot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HOTSPOTS);
      return saved ? JSON.parse(saved) : INITIAL_HOTSPOTS;
    } catch {
      return INITIAL_HOTSPOTS;
    }
  });

  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ANNOTATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [rcaInvestigations, setRcaInvestigations] = useState<RCAInvestigation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RCA);
      return saved ? JSON.parse(saved) : [INITIAL_RCA];
    } catch {
      return [INITIAL_RCA];
    }
  });

  // Navigation & View Routing
  const [currentView, setCurrentView] = useState<'explorer' | 'viewer' | 'rca' | 'print'>('explorer');
  const [currentFolderId, setCurrentFolderId] = useState<string>('f-boiler');
  const [activeDocId, setActiveDocId] = useState<string>('doc-pid-101');
  const [activeRcaId, setActiveRcaId] = useState<string>('rca-101');
  const [activePdfBuffer, setActivePdfBuffer] = useState<ArrayBuffer | null>(null);
  const [activePageNum, setActivePageNum] = useState<number>(1);

  // Navigation History (Mundur / Maju / Jump History)
  const [navHistory, setNavHistory] = useState<{ docId: string; pageNum: number }[]>([
    { docId: 'doc-pid-101', pageNum: 1 },
  ]);
  const [navIndex, setNavIndex] = useState(0);

  const pushNavHistory = (docId: string, pageNum = 1) => {
    const current = navHistory[navIndex];
    if (current && current.docId === docId && current.pageNum === pageNum) return;
    const newHist = [...navHistory.slice(0, navIndex + 1), { docId, pageNum }];
    if (newHist.length > 50) newHist.shift();
    setNavHistory(newHist);
    setNavIndex(newHist.length - 1);
  };

  const handleGoBack = () => {
    if (navIndex > 0) {
      const nextIdx = navIndex - 1;
      setNavIndex(nextIdx);
      const target = navHistory[nextIdx];
      setActivePageNum(target.pageNum);
      handleOpenDocument(target.docId, false, target.pageNum);
    }
  };

  const handleGoForward = () => {
    if (navIndex < navHistory.length - 1) {
      const nextIdx = navIndex + 1;
      setNavIndex(nextIdx);
      const target = navHistory[nextIdx];
      setActivePageNum(target.pageNum);
      handleOpenDocument(target.docId, false, target.pageNum);
    }
  };

  const handlePageChange = (newPageNum: number) => {
    setActivePageNum(newPageNum);
    setNavHistory((prev) => {
      const updated = [...prev];
      if (updated[navIndex]) {
        updated[navIndex] = { ...updated[navIndex], pageNum: newPageNum };
      }
      return updated;
    });
  };

  // Plotplan List & Toggle
  const plotPlanDocs = documents.filter((d) => d.isPlotPlan);

  const handleOpenPlotPlan = (docId?: string) => {
    const targetId = docId || plotPlanDocs[0]?.id || documents[0]?.id;
    if (targetId) {
      handleOpenDocument(targetId);
      showToast('info', 'Plot Plan Loaded', 'Switched to master terminal / facility plot plan.');
    }
  };

  const handleTogglePlotPlan = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, isPlotPlan: !d.isPlotPlan } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    showToast(
      'info',
      doc?.isPlotPlan ? 'Status Plot Plan Dihapus' : 'Ditandai Sebagai Plot Plan Utama',
      `${doc?.title || doc?.name}`
    );
  };

  // Modals & Feedback
  const [isDataSyncOpen, setIsDataSyncOpen] = useState(false);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast Dispatcher
  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HOTSPOTS, JSON.stringify(hotspots));
  }, [hotspots]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ANNOTATIONS, JSON.stringify(annotations));
  }, [annotations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RCA, JSON.stringify(rcaInvestigations));
  }, [rcaInvestigations]);

  // Ensure initial sample PDF binaries are seeded into IndexedDB
  useEffect(() => {
    async function seedSamplePdfs() {
      for (const doc of INITIAL_DOCUMENTS) {
        let existing = await getDocumentBinary(doc.id);
        if (!existing || existing.byteLength === 0) {
          try {
            const pdfBytes = await generateSamplePidPdf(doc.id);
            await saveDocumentBinary(doc.id, pdfBytes);
            existing = await getDocumentBinary(doc.id);
          } catch (err) {
            console.error('Failed to generate initial PDF for', doc.id, err);
          }
        }
        if (doc.id === activeDocId && !activePdfBuffer && existing && existing.byteLength > 0) {
          setActivePdfBuffer(existing.slice(0));
        }
      }
    }
    seedSamplePdfs();
  }, [activeDocId, activePdfBuffer]);

  // Open Document in Viewer
  const handleOpenDocument = async (docId: string, recordHistory = true, targetPageNum = 1) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    let buffer = await getDocumentBinary(docId);
    if ((!buffer || buffer.byteLength === 0) && doc.isSample) {
      // Regenerate if missing or detached
      const pdfBytes = await generateSamplePidPdf(docId);
      await saveDocumentBinary(docId, pdfBytes);
      buffer = await getDocumentBinary(docId);
    }

    if (buffer && buffer.byteLength > 0) {
      setActiveDocId(docId);
      setActivePageNum(targetPageNum);
      setActivePdfBuffer(buffer.slice(0));
      setCurrentView('viewer');
      if (recordHistory) {
        pushNavHistory(docId, targetPageNum);
      }
    } else {
      showToast('error', 'Document Unavailable', 'Binary data could not be located in storage.');
    }
  };

  // Upload PDF Files
  const handleUploadPdf = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    let successCount = 0;

    for (const file of fileArray) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;

      try {
        const rawBuffer = await file.arrayBuffer();
        const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        // Attempt reading page count using a cloned slice
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
          folderId: currentFolderId,
          size: file.size,
          pageCount,
          uploadDate: new Date().toISOString().substring(0, 10),
          title: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
          description: 'Uploaded engineering P&ID document.',
          equipmentTag: file.name.match(/[A-Z]+-\d+/i)?.[0]?.toUpperCase() || 'P&ID',
          systemUnit: 'Process Plant',
          isSample: false,
        };

        setDocuments((prev) => [newDoc, ...prev]);
        successCount++;
      } catch (err) {
        console.error('Upload error for', file.name, err);
      }
    }

    if (successCount > 0) {
      showToast('success', 'PDF Drawings Uploaded', `Successfully uploaded ${successCount} drawing(s).`);
    } else {
      showToast('warning', 'No PDF Uploaded', 'Please select valid .pdf files.');
    }
  };

  // Folder Operations
  const handleCreateFolder = (name: string, parentId: string | null) => {
    const newFolder: FolderItem = {
      id: `f-${Date.now()}`,
      name,
      parentId,
      createdAt: new Date().toISOString().substring(0, 10),
    };
    setFolders((prev) => [...prev, newFolder]);
    showToast('success', 'Folder Created', name);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    if (!newName.trim()) return;
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: newName.trim() } : f)));
    showToast('info', 'Folder Renamed', newName.trim());
  };

  const handleDeleteFolder = (folderId: string) => {
    // Cannot delete root
    if (folderId === 'f-root') return;
    // Move any documents in this folder to root
    setDocuments((prev) => prev.map((d) => (d.folderId === folderId ? { ...d, folderId: 'f-root' } : d)));
    // Delete folder and child folders
    setFolders((prev) => prev.filter((f) => f.id !== folderId && f.parentId !== folderId));
    if (currentFolderId === folderId) {
      setCurrentFolderId('f-root');
    }
    showToast('info', 'Folder Deleted');
  };

  // Document Operations
  const handleRenameDocument = (docId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, title: newTitle.trim() } : d)));
    showToast('info', 'Drawing Renamed');
  };

  const handleDeleteDocument = async (docId: string) => {
    await deleteDocumentBinary(docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setHotspots((prev) => prev.filter((h) => h.docId !== docId));
    setAnnotations((prev) => prev.filter((a) => a.docId !== docId));
    showToast('info', 'Drawing Deleted');
  };

  const handleMoveDocument = (docId: string, targetFolderId: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, folderId: targetFolderId } : d)));
    showToast('success', 'Drawing Moved');
  };

  const handleDownloadDocument = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const buffer = await getDocumentBinary(docId);
    if (!buffer) {
      showToast('error', 'Download Failed', 'File data not found in storage.');
      return;
    }
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Download Started', doc.name);
  };

  // RCA Launching from Hotspot or Navigation
  const handleOpenRca = (rcaId: string, equipmentTag?: string, equipmentName?: string) => {
    let rca = rcaInvestigations.find((r) => r.id === rcaId);
    if (!rca) {
      // Create new RCA
      rca = {
        ...INITIAL_RCA,
        id: rcaId,
        equipmentTag: equipmentTag || 'EQ-001',
        equipmentName: equipmentName || 'Industrial Process Equipment',
        incidentTitle: `Root Cause Investigation for ${equipmentTag || 'Equipment'}`,
        incidentDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setRcaInvestigations((prev) => [...prev, rca!]);
    }
    setActiveRcaId(rca.id);
    setCurrentView('rca');
  };

  const handleUpdateRca = (updatedRca: RCAInvestigation) => {
    setRcaInvestigations((prev) => prev.map((r) => (r.id === updatedRca.id ? updatedRca : r)));
  };

  // PDF Viewer Page Modifications
  const handleUpdatePdfData = async (newPdfData: ArrayBuffer, newPageCount: number) => {
    setActivePdfBuffer(newPdfData);
    await saveDocumentBinary(activeDocId, newPdfData);
    setDocuments((prev) =>
      prev.map((d) => (d.id === activeDocId ? { ...d, pageCount: newPageCount, size: newPdfData.byteLength } : d))
    );
  };

  // Jump from hotspot to another document
  const handleNavigateToDocument = async (targetDocId: string, targetPageNum = 1) => {
    const doc = documents.find((d) => d.id === targetDocId);
    if (!doc) return;
    let buffer = await getDocumentBinary(targetDocId);
    if (!buffer && doc.isSample) {
      const pdfBytes = await generateSamplePidPdf(targetDocId);
      await saveDocumentBinary(targetDocId, pdfBytes);
      buffer = await getDocumentBinary(targetDocId);
    }
    if (buffer) {
      setActiveDocId(targetDocId);
      setActivePageNum(targetPageNum);
      setActivePdfBuffer(buffer.slice(0));
      setCurrentView('viewer');
      pushNavHistory(targetDocId, targetPageNum);
      showToast('info', 'Document Switched', `Loaded ${doc.title || doc.name}`);
    }
  };

  // Import Document from Google Drive
  const handleImportDocumentFromDrive = async (doc: DocumentItem, buffer: ArrayBuffer) => {
    await saveDocumentBinary(doc.id, buffer);
    setDocuments((prev) => {
      const existingIdx = prev.findIndex((d) => d.id === doc.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = doc;
        return updated;
      }
      return [doc, ...prev];
    });
    setActiveDocId(doc.id);
    setActivePdfBuffer(buffer.slice(0));
    setCurrentView('viewer');
    showToast('success', 'Document Loaded', `Opened ${doc.name} from Google Drive.`);
  };

  // Find active records
  const activeDocument = documents.find((d) => d.id === activeDocId) || documents[0];
  const activeRca = rcaInvestigations.find((r) => r.id === activeRcaId) || rcaInvestigations[0];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* GLOBAL TOP NAVIGATION BAR (Zone 1: Brand wordmark, Zone 2: Navigation Links, Zone 3: Primary Action) */}
      <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between gap-8 z-40 no-print">
        {/* Zone 1: Single text element wordmark + Plotplan Fast-Switch */}
        <div className="flex items-center gap-4 shrink-0">
          <div
            onClick={() => setCurrentView('explorer')}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-4 h-4" />
            </div>
            <span>Apex P&ID & RCA Studio</span>
          </div>

          {plotPlanDocs.length > 0 && (
            <button
              onClick={() => handleOpenPlotPlan()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-950/70 hover:bg-amber-900 border border-amber-600/70 rounded-lg transition-all shadow-sm"
              title="Buka Plotplan Fasilitas / Terminal Utama"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Plotplan ({plotPlanDocs.length})</span>
            </button>
          )}
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setCurrentView('explorer')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              currentView === 'explorer' ? 'text-cyan-400 font-bold' : ''
            }`}
          >
            Drawings Explorer
          </button>
          <button
            onClick={() => {
              if (activeDocument) handleOpenDocument(activeDocument.id);
            }}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              currentView === 'viewer' ? 'text-cyan-400 font-bold' : ''
            }`}
          >
            Active P&ID Canvas
          </button>
          <button
            onClick={() => handleOpenRca('rca-101')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              currentView === 'rca' ? 'text-cyan-400 font-bold' : ''
            }`}
          >
            RCA Investigation ({rcaInvestigations.length})
          </button>
          <button
            onClick={() => setCurrentView('print')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              currentView === 'print' ? 'text-cyan-400 font-bold' : ''
            }`}
          >
            Document Report View
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsGoogleDriveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
            title="Google Drive Cloud Workspace"
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => setIsDataSyncOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Project Sync</span>
          </button>
        </div>
      </header>

      {/* VIEWPORT BODY */}
      <div className="flex-1 min-h-0 relative">
        {currentView === 'explorer' && (
          <FileExplorer
            documents={documents}
            folders={folders}
            currentFolderId={currentFolderId}
            onSelectFolder={setCurrentFolderId}
            onOpenDocument={handleOpenDocument}
            onUploadPdf={handleUploadPdf}
            onFolderUploadCompleted={(newFolders, newDocs) => {
              if (newFolders.length > 0) {
                setFolders((prev) => [...prev, ...newFolders]);
              }
              if (newDocs.length > 0) {
                setDocuments((prev) => [...newDocs, ...prev]);
                showToast(
                  'success',
                  'Folder Upload Complete',
                  `Imported ${newDocs.length} drawing(s)${newFolders.length > 0 ? ` into ${newFolders.length} folder(s)` : ''}.`
                );
              }
            }}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameDocument={handleRenameDocument}
            onDeleteDocument={handleDeleteDocument}
            onMoveDocument={handleMoveDocument}
            onDownloadDocument={handleDownloadDocument}
            onTogglePlotPlan={handleTogglePlotPlan}
            onOpenDataSync={() => setIsDataSyncOpen(true)}
            onOpenGoogleDrive={() => setIsGoogleDriveOpen(true)}
          />
        )}

        {currentView === 'viewer' && activeDocument && (
          <PdfViewer
            documentItem={activeDocument}
            pdfData={activePdfBuffer}
            hotspots={hotspots}
            annotations={annotations}
            allDocuments={documents}
            initialPageNum={activePageNum}
            onPageChange={handlePageChange}
            onBackToExplorer={() => setCurrentView('explorer')}
            onOpenRca={handleOpenRca}
            onNavigateToDocument={handleNavigateToDocument}
            onSaveHotspots={setHotspots}
            onSaveAnnotations={setAnnotations}
            onUpdatePdfData={handleUpdatePdfData}
            onShowToast={showToast}
            onDownloadPdf={() => handleDownloadDocument(activeDocId)}
            canGoBack={navIndex > 0}
            canGoForward={navIndex < navHistory.length - 1}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
          />
        )}

        {currentView === 'rca' && activeRca && (
          <RcaDashboard
            rca={activeRca}
            onUpdateRca={handleUpdateRca}
            onBackToViewer={() => {
              if (activePdfBuffer) {
                setCurrentView('viewer');
              } else {
                setCurrentView('explorer');
              }
            }}
            onOpenPrintReport={() => setCurrentView('print')}
            onShowToast={showToast}
          />
        )}

        {currentView === 'print' && activeRca && (
          <PrintReportView
            rca={activeRca}
            onClose={() => setCurrentView('rca')}
          />
        )}
      </div>

      {/* DATA SYNC & BACKUP MODAL */}
      {isDataSyncOpen && (
        <DataSyncModal
          documents={documents}
          folders={folders}
          hotspots={hotspots}
          annotations={annotations}
          rcaInvestigations={rcaInvestigations}
          onImportData={(data) => {
            setDocuments(data.documents);
            setFolders(data.folders);
            setHotspots(data.hotspots);
            setAnnotations(data.annotations);
            setRcaInvestigations(data.rcaInvestigations);
          }}
          onBulkUpdateDocuments={(updatedDocs) => setDocuments(updatedDocs)}
          onClose={() => setIsDataSyncOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* GOOGLE DRIVE CLOUD WORKSPACE MODAL */}
      {isGoogleDriveOpen && (
        <GoogleDriveModal
          documents={documents}
          folders={folders}
          hotspots={hotspots}
          annotations={annotations}
          rcaInvestigations={rcaInvestigations}
          activeDocument={activeDocument}
          activePdfBuffer={activePdfBuffer}
          onImportDocumentFromDrive={handleImportDocumentFromDrive}
          onClose={() => setIsGoogleDriveOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* TOAST SYSTEM */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
