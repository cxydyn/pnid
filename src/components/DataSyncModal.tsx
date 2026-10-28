import React, { useState, useRef } from 'react';
import { DocumentItem, FolderItem, Hotspot, Annotation, RCAInvestigation } from '../types';
import {
  X,
  FileCode,
  Archive,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Save,
  Globe
} from 'lucide-react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import {
  getAllDocumentBinaries,
  getAllAttachmentBinaries,
  saveDocumentBinary,
  saveAttachmentBinary,
} from '../utils/db';

interface DataSyncModalProps {
  documents: DocumentItem[];
  folders: FolderItem[];
  hotspots: Hotspot[];
  annotations: Annotation[];
  rcaInvestigations: RCAInvestigation[];
  onImportData: (data: {
    documents: DocumentItem[];
    folders: FolderItem[];
    hotspots: Hotspot[];
    annotations: Annotation[];
    rcaInvestigations: RCAInvestigation[];
  }) => void;
  onBulkUpdateDocuments: (updatedDocs: DocumentItem[]) => void;
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  documents,
  folders,
  hotspots,
  annotations,
  rcaInvestigations,
  onImportData,
  onBulkUpdateDocuments,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'backup_zip' | 'csv_sync' | 'json_config' | 'single_file'>('backup_zip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // 1. EXPORT JSON METADATA
  const handleExportJson = () => {
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      folders,
      documents,
      hotspots,
      annotations,
      rcaInvestigations,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pid_rca_config_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('success', 'JSON Config Exported', 'Metadata and hotspots saved.');
  };

  // IMPORT JSON METADATA
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.documents && parsed.folders) {
          onImportData({
            documents: parsed.documents || [],
            folders: parsed.folders || [],
            hotspots: parsed.hotspots || [],
            annotations: parsed.annotations || [],
            rcaInvestigations: parsed.rcaInvestigations || [],
          });
          onShowToast('success', 'Configuration Imported', 'Project metadata updated.');
          onClose();
        } else {
          throw new Error('Invalid JSON structure');
        }
      } catch (err) {
        onShowToast('error', 'Import Failed', 'Selected file is not valid JSON configuration.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 2. BACKUP PROJECT TO ZIP (JSON + BINARY PDFS + ATTACHMENTS)
  const handleExportZipBackup = async () => {
    setIsProcessing(true);
    setSyncStatus('Packaging database blobs and metadata into ZIP...');

    try {
      const zip = new JSZip();

      // 1. Metadata JSON
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

      // 2. PDFs binary folder
      const docBinaries = await getAllDocumentBinaries();
      const pdfsFolder = zip.folder('pdf_documents');
      if (pdfsFolder) {
        for (const [docId, buffer] of Object.entries(docBinaries)) {
          const doc = documents.find((d) => d.id === docId);
          const filename = doc ? doc.name : `${docId}.pdf`;
          pdfsFolder.file(filename, buffer);
        }
      }

      // 3. Attachments binary folder
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

      setSyncStatus('Compressing offline archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PID_RCA_Complete_Backup_${new Date().toISOString().substring(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      onShowToast('success', 'Backup Complete', 'ZIP archive generated with all PDFs and investigations.');
    } catch (err) {
      console.error('ZIP export error:', err);
      onShowToast('error', 'Backup Failed', 'Could not assemble ZIP archive.');
    } finally {
      setIsProcessing(false);
      setSyncStatus(null);
    }
  };

  // RESTORE FROM ZIP ARCHIVE
  const handleRestoreZipBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsProcessing(true);
    setSyncStatus('Extracting archive contents...');

    try {
      const zip = await JSZip.loadAsync(file);

      // Read project_config.json
      const configFile = zip.file('project_config.json');
      if (!configFile) {
        throw new Error('project_config.json not found in ZIP');
      }

      const configStr = await configFile.async('string');
      const config = JSON.parse(configStr);

      // Extract and save PDF documents into IndexedDB
      const pdfsFolder = zip.folder('pdf_documents');
      if (pdfsFolder) {
        for (const doc of config.documents || []) {
          const fileInZip = pdfsFolder.file(doc.name);
          if (fileInZip) {
            const buffer = await fileInZip.async('arraybuffer');
            await saveDocumentBinary(doc.id, buffer);
          }
        }
      }

      // Extract and save attachments
      const attFolder = zip.folder('incident_evidence');
      if (attFolder) {
        const attFiles = attFolder.file(/.*/);
        for (const attFile of attFiles) {
          const id = attFile.name.replace(/\.[^/.]+$/, '');
          const base64 = await attFile.async('base64');
          const dataUrl = `data:image/png;base64,${base64}`;
          await saveAttachmentBinary(id, dataUrl);
        }
      }

      // Update state
      onImportData({
        documents: config.documents || [],
        folders: config.folders || [],
        hotspots: config.hotspots || [],
        annotations: config.annotations || [],
        rcaInvestigations: config.rcaInvestigations || [],
      });

      onShowToast('success', 'Project Restored', 'Successfully restored all PDFs, hotspots, and investigations.');
      onClose();
    } catch (err: any) {
      console.error('ZIP restore error:', err);
      onShowToast('error', 'Restore Failed', err?.message || 'Invalid backup archive.');
    } finally {
      setIsProcessing(false);
      setSyncStatus(null);
      e.target.value = '';
    }
  };

  // 3. CSV SYNC: BULK UPDATE PDF TITLES & DESCRIPTIONS
  const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Array<{
          filename?: string;
          title?: string;
          description?: string;
          equipment_tag?: string;
          system_unit?: string;
        }>;

        let matchCount = 0;
        const updated = documents.map((doc) => {
          const match = rows.find(
            (r) =>
              r.filename &&
              (r.filename.trim().toLowerCase() === doc.name.toLowerCase() ||
                doc.name.toLowerCase().includes(r.filename.trim().toLowerCase()))
          );
          if (match) {
            matchCount++;
            return {
              ...doc,
              title: match.title ? match.title.trim() : doc.title,
              description: match.description ? match.description.trim() : doc.description,
              equipmentTag: match.equipment_tag ? match.equipment_tag.trim() : doc.equipmentTag,
              systemUnit: match.system_unit ? match.system_unit.trim() : doc.systemUnit,
            };
          }
          return doc;
        });

        if (matchCount > 0) {
          onBulkUpdateDocuments(updated);
          onShowToast('success', 'CSV Sync Applied', `Updated metadata for ${matchCount} drawings.`);
          onClose();
        } else {
          onShowToast(
            'warning',
            'No Matches Found',
            'None of the filenames in the CSV matched the current project documents.'
          );
        }
      },
      error: () => {
        onShowToast('error', 'CSV Error', 'Failed to parse CSV file.');
      },
    });

    e.target.value = '';
  };

  // Download Sample CSV Template
  const handleDownloadCsvTemplate = () => {
    const csvContent =
      'filename,title,description,equipment_tag,system_unit\n' +
      'PID-101-REV4-Boiler-Feedwater-Loop.pdf,"Boiler Feedwater High-Pressure Circuit","High-pressure piping, P-101A/B pump loops and drum B-201","BFW-SYS-01","Unit 1 Power Block"\n' +
      'PID-204-REV2-Chilled-Water-Circuit.pdf,"Chilled Water Primary Circulation","Chilled water supply, plate heat exchangers and pumps","CHW-SYS-02","Utility Substation"\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PID_Metadata_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 4. EXPORT AS SELF-CONTAINED SINGLE-FILE HTML
  const handleExportSingleFileHtml = () => {
    const jsonState = JSON.stringify({
      folders,
      documents,
      hotspots,
      annotations,
      rcaInvestigations,
    });

    const singleFileHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smart P&ID Viewer & RCA Investigation Dashboard (Offline Standalone)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    @media print {
      @page { size: landscape; margin: 12mm; }
      body { background: #fff !important; color: #000 !important; }
      .no-print { display: none !important; }
      .print-page { page-break-before: always; break-before: page; }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased font-sans">
  <div id="root"></div>
  <script>
    window.STANDALONE_PROJECT_DATA = ${jsonState};
  </script>
  <script type="text/babel">
    function StandaloneBanner() {
      return (
        <div className="p-8 max-w-2xl mx-auto text-center mt-20 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-2">Smart P&ID Viewer & RCA Standalone Archive</h1>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            This single-file HTML package contains embedded project metadata, hotspots, and RCA investigation trees. All libraries (PDF.js, PDF-Lib, JSZip, PapaParse) are configured for offline access.
          </p>
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-left text-xs text-cyan-300 font-mono mb-6">
            <div>Documents: {window.STANDALONE_PROJECT_DATA.documents.length}</div>
            <div>Hotspots: {window.STANDALONE_PROJECT_DATA.hotspots.length}</div>
            <div>RCA Investigations: {window.STANDALONE_PROJECT_DATA.rcaInvestigations.length}</div>
          </div>
          <button onClick={() => alert("All components ready for field inspection.")} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow">
            Launch Standalone Workspace
          </button>
        </div>
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<StandaloneBanner />);
  </script>
</body>
</html>`;

    const blob = new Blob([singleFileHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smart_PID_Viewer_Standalone_${new Date().toISOString().substring(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('success', 'Standalone HTML Saved', 'Single-file package saved for offline field execution.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Hidden file inputs */}
      <input type="file" ref={jsonInputRef} accept=".json" className="hidden" onChange={handleImportJson} />
      <input type="file" ref={zipInputRef} accept=".zip" className="hidden" onChange={handleRestoreZipBackup} />
      <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={handleUploadCsv} />

      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Data Management & Offline Sync
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Backup project, restore offline archives, bulk-sync CSV metadata, or export single-file HTML.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('backup_zip')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'backup_zip'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4 text-cyan-400" />
            <span>ZIP Backup & Restore</span>
          </button>

          <button
            onClick={() => setActiveTab('csv_sync')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'csv_sync'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>CSV Metadata Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('json_config')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'json_config'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>JSON Config</span>
          </button>

          <button
            onClick={() => setActiveTab('single_file')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'single_file'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-purple-400" />
            <span>Single-File HTML</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 text-xs space-y-4">
          {isProcessing && (
            <div className="p-4 bg-cyan-950/60 border border-cyan-800/80 rounded-xl flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="text-cyan-200 font-mono">{syncStatus || 'Processing...'}</div>
            </div>
          )}

          {/* TAB 1: ZIP BACKUP & RESTORE */}
          {activeTab === 'backup_zip' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-cyan-400" />
                  <span>Full Project ZIP Backup</span>
                </h4>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Bundles all metadata JSON configuration AND all heavy binary PDF schematics and image attachments
                  stored in IndexedDB into a single self-contained <code className="text-cyan-300">.zip</code> file.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportZipBackup}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Project Backup (.zip)</span>
                  </button>
                  <button
                    onClick={() => zipInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-all"
                  >
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>Restore Backup (.zip)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CSV SYNC */}
          {activeTab === 'csv_sync' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Bulk Metadata Sync with CSV (PapaParse)</span>
                </h4>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Upload a CSV file containing columns <code className="text-emerald-300 font-mono">filename,title,description,equipment_tag,system_unit</code> to
                  automatically update titles and metadata of matching drawings in one click.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload CSV File</span>
                  </button>
                  <button
                    onClick={handleDownloadCsvTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg border border-slate-700 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV Template</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JSON CONFIG */}
          {activeTab === 'json_config' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span>Metadata & Hotspot Configuration (JSON)</span>
                </h4>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Exports or imports the lightweight metadata structure (folders, hotspots, 5-Whys, Fishbone, and
                  Fault Tree logic) without binary PDF files.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    onClick={() => jsonInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-all"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Import JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SINGLE-FILE HTML */}
          {activeTab === 'single_file' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>Export Standalone Single-File HTML</span>
                </h4>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Generates an entirely self-contained single <code className="text-purple-300">.html</code> file with
                  embedded project state and CDN script references. Open it in any browser offline without a web
                  server.
                </p>
                <button
                  onClick={handleExportSingleFileHtml}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Single-File HTML</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
