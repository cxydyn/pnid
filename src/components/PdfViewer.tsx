import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentItem, Hotspot, Annotation, ActionType, DropdownOption, AnnotationType, Point } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Search,
  PenTool,
  Highlighter,
  Type,
  Eraser,
  Link,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Save,
  Sliders,
  FileText,
  AlertTriangle,
  Menu,
  X,
  ExternalLink,
  Check,
  MousePointer
} from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocumentBinary } from '../utils/db';

// Ensure worker is configured
if (typeof window !== 'undefined') {
  const pLib = (window as any).pdfjsLib || pdfjsLib;
  if (pLib && pLib.GlobalWorkerOptions) {
    pLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}

interface PdfViewerProps {
  documentItem: DocumentItem;
  pdfData: ArrayBuffer | null;
  hotspots: Hotspot[];
  annotations: Annotation[];
  allDocuments: DocumentItem[];
  onBackToExplorer: () => void;
  onOpenRca: (rcaId: string, equipmentTag?: string, equipmentName?: string) => void;
  onNavigateToDocument: (targetDocId: string, targetPageNum?: number) => void;
  onSaveHotspots: (updatedHotspots: Hotspot[]) => void;
  onSaveAnnotations: (updatedAnnotations: Annotation[]) => void;
  onUpdatePdfData: (newPdfData: ArrayBuffer, newPageCount: number) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

type ToolMode = 'select' | 'pan' | 'magnifier' | 'hotspot' | 'pen' | 'highlighter' | 'text' | 'eraser';

export const PdfViewer: React.FC<PdfViewerProps> = ({
  documentItem,
  pdfData,
  hotspots,
  annotations,
  allDocuments,
  onBackToExplorer,
  onOpenRca,
  onNavigateToDocument,
  onSaveHotspots,
  onSaveAnnotations,
  onUpdatePdfData,
  onShowToast,
}) => {
  // Navigation & Viewport State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(documentItem.pageCount || 1);
  const [scale, setScale] = useState(1.1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [activeTool, setActiveTool] = useState<ToolMode>('pan');

  // Pan offsets
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 });

  // Magnifier state
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Hotspot Drawing State
  const [isDrawingHotspot, setIsDrawingHotspot] = useState(false);
  const [hotspotStart, setHotspotStart] = useState<{ x: number; y: number } | null>(null);
  const [currentHotspotRect, setCurrentHotspotRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );

  // Hotspot configuration dialog state
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);

  // Active Hotspot Popup (Dropdown or Note)
  const [activePopupHotspot, setActivePopupHotspot] = useState<{
    hotspot: Hotspot;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  // Annotation Drawing State
  const [isDrawingAnnotation, setIsDrawingAnnotation] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; normX: number; normY: number } | null>(
    null
  );
  const [textInputVal, setTextInputVal] = useState('');

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);

  // Page dimensions in CSS pixels
  const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 600 });

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    let currentLoadingTask: any = null;

    async function loadPdf() {
      if (!pdfData) return;

      try {
        let validBuffer = pdfData;
        if (validBuffer.byteLength === 0) {
          const fresh = await getDocumentBinary(documentItem.id);
          if (fresh && fresh.byteLength > 0) {
            validBuffer = fresh;
            onUpdatePdfData(fresh, documentItem.pageCount);
          } else {
            return;
          }
        }

        const pLib = (window as any).pdfjsLib || pdfjsLib;
        // Always pass a cloned slice of the buffer to prevent web worker transfer from detaching our state
        const bufferCopy = validBuffer.slice(0);
        const dataCopy = new Uint8Array(bufferCopy);

        currentLoadingTask = pLib.getDocument({ data: dataCopy });
        const loadedDoc = await currentLoadingTask.promise;
        if (isCancelled) return;
        pdfDocRef.current = loadedDoc;
        setTotalPages(loadedDoc.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Error loading PDF document:', err);
          onShowToast('error', 'Failed to load PDF', 'The document data could not be parsed.');
        }
      }
    }

    loadPdf();
    return () => {
      isCancelled = true;
      if (currentLoadingTask) {
        try {
          currentLoadingTask.destroy?.();
        } catch {}
      }
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfData, documentItem.id]);

  // Render Current Page onto High-DPI Canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDocRef.current.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale, rotation: rotation });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // High-DPI screen backing scale
      const dpr = window.devicePixelRatio || 2;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      setPageDimensions({ width: viewport.width, height: viewport.height });

      ctx.save();
      ctx.scale(dpr, dpr);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      ctx.restore();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [currentPage, scale, rotation]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Filter hotspots and annotations for current page and doc
  const pageHotspots = hotspots.filter(
    (h) => h.docId === documentItem.id && h.pageNum === currentPage
  );
  const pageAnnotations = annotations.filter(
    (a) => a.docId === documentItem.id && a.pageNum === currentPage
  );

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(4.0, +(s + 0.2).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(0.4, +(s - 0.2).toFixed(2)));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth - 80;
      const baseW = pageDimensions.width / scale;
      setScale(Math.max(0.5, +(containerW / baseW).toFixed(2)));
      setPanOffset({ x: 0, y: 0 });
    }
  };
  const handleFitPage = () => {
    if (containerRef.current) {
      const containerH = containerRef.current.clientHeight - 80;
      const baseH = pageDimensions.height / scale;
      setScale(Math.max(0.4, +(containerH / baseH).toFixed(2)));
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < totalPages) setCurrentPage((p) => p + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) setCurrentPage((p) => p - 1);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key.toLowerCase() === 'm') {
        setActiveTool((t) => (t === 'magnifier' ? 'pan' : 'magnifier'));
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('hotspot');
      } else if (e.key === 'Escape') {
        setActiveTool('pan');
        setIsDrawingHotspot(false);
        setIsDrawingAnnotation(false);
        setCurrentHotspotRect(null);
        setActivePopupHotspot(null);
        setTextInputPos(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, pageDimensions, scale]);

  // Mouse wheel zoom towards cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setScale((s) => Math.min(4.0, Math.max(0.4, +(s + delta).toFixed(2))));
    }
  };

  // Magnifier Rendering on MouseMove
  const updateMagnifier = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'magnifier' || !canvasRef.current || !magnifierCanvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    if (mouseX < 0 || mouseY < 0 || mouseX > canvasRect.width || mouseY > canvasRect.height) {
      setMagnifierPos((prev) => ({ ...prev, visible: false }));
      return;
    }

    setMagnifierPos({
      x: e.clientX,
      y: e.clientY,
      visible: true,
    });

    const magCanvas = magnifierCanvasRef.current;
    const magCtx = magCanvas.getContext('2d');
    if (!magCtx) return;

    const lensRadius = 80;
    const zoomFactor = 2.8;

    magCtx.clearRect(0, 0, lensRadius * 2, lensRadius * 2);
    magCtx.save();
    // Circular clip
    magCtx.beginPath();
    magCtx.arc(lensRadius, lensRadius, lensRadius, 0, Math.PI * 2);
    magCtx.clip();

    // High quality background
    magCtx.fillStyle = '#0f172a';
    magCtx.fillRect(0, 0, lensRadius * 2, lensRadius * 2);

    // Source coordinates on main canvas
    const dpr = window.devicePixelRatio || 2;
    const srcX = mouseX * dpr;
    const srcY = mouseY * dpr;
    const srcW = (lensRadius * 2 * dpr) / zoomFactor;
    const srcH = (lensRadius * 2 * dpr) / zoomFactor;

    magCtx.drawImage(
      canvasRef.current,
      srcX - srcW / 2,
      srcY - srcH / 2,
      srcW,
      srcH,
      0,
      0,
      lensRadius * 2,
      lensRadius * 2
    );

    // Reticle crosshairs
    magCtx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    magCtx.lineWidth = 1.5;
    magCtx.beginPath();
    magCtx.moveTo(lensRadius - 20, lensRadius);
    magCtx.lineTo(lensRadius + 20, lensRadius);
    magCtx.moveTo(lensRadius, lensRadius - 20);
    magCtx.lineTo(lensRadius, lensRadius + 20);
    magCtx.stroke();

    // Center dot
    magCtx.fillStyle = '#06b6d4';
    magCtx.beginPath();
    magCtx.arc(lensRadius, lensRadius, 2.5, 0, Math.PI * 2);
    magCtx.fill();

    magCtx.restore();
  };

  // Convert canvas event point to 0-100% normalized coordinates
  const getNormalizedCoords = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { normX: 0, normY: 0, pxX: 0, pxY: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(100, (pxX / rect.width) * 100));
    const normY = Math.max(0, Math.min(100, (pxY / rect.height) * 100));
    return { normX, normY, pxX, pxY };
  };

  // Mouse Down Event Handler across Tools
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // 1. Pan Tool
    if (activeTool === 'pan' || e.shiftKey || e.altKey) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialOffsetX: panOffset.x,
        initialOffsetY: panOffset.y,
      };
      return;
    }

    const { normX, normY, pxX, pxY } = getNormalizedCoords(e);

    // 2. Hotspot Drawing Tool
    if (activeTool === 'hotspot') {
      setIsDrawingHotspot(true);
      setHotspotStart({ x: normX, y: normY });
      setCurrentHotspotRect({ x: normX, y: normY, w: 0, h: 0 });
      return;
    }

    // 3. Pen or Highlighter Tool
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawingAnnotation(true);
      setCurrentStroke([{ x: normX, y: normY }]);
      return;
    }

    // 4. Text Tool
    if (activeTool === 'text') {
      setTextInputPos({ x: pxX, y: pxY, normX, normY });
      setTextInputVal('');
      return;
    }
  };

  // Mouse Move Event Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Pan movement
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.initialOffsetX + dx,
        y: panStartRef.current.initialOffsetY + dy,
      });
      return;
    }

    // Magnifier update
    if (activeTool === 'magnifier') {
      updateMagnifier(e);
      return;
    }

    const { normX, normY } = getNormalizedCoords(e);

    // Hotspot rectangle sizing
    if (isDrawingHotspot && hotspotStart) {
      const minX = Math.min(hotspotStart.x, normX);
      const minY = Math.min(hotspotStart.y, normY);
      const w = Math.abs(normX - hotspotStart.x);
      const h = Math.abs(normY - hotspotStart.y);
      setCurrentHotspotRect({ x: minX, y: minY, w, h });
      return;
    }

    // Annotation drawing
    if (isDrawingAnnotation) {
      setCurrentStroke((prev) => [...prev, { x: normX, y: normY }]);
      return;
    }
  };

  // Mouse Up Event Handler
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Complete Hotspot creation
    if (isDrawingHotspot && currentHotspotRect) {
      setIsDrawingHotspot(false);
      setHotspotStart(null);

      if (currentHotspotRect.w > 2 && currentHotspotRect.h > 2) {
        // Open configuration dialog for new hotspot
        const newHotspot: Hotspot = {
          id: `hs-${Date.now()}`,
          docId: documentItem.id,
          pageNum: currentPage,
          x: currentHotspotRect.x,
          y: currentHotspotRect.y,
          width: currentHotspotRect.w,
          height: currentHotspotRect.h,
          label: 'New Equipment Hotspot',
          equipmentTag: 'TAG-001',
          actionType: 'note',
          note: 'Inspection notes and operational telemetry.',
        };
        setEditingHotspot(newHotspot);
      }
      setCurrentHotspotRect(null);
      return;
    }

    // Complete Pen / Highlighter Stroke
    if (isDrawingAnnotation && currentStroke.length > 1) {
      setIsDrawingAnnotation(false);
      const newAnnotation: Annotation = {
        id: `ann-${Date.now()}`,
        docId: documentItem.id,
        pageNum: currentPage,
        type: activeTool === 'highlighter' ? 'highlighter' : 'pen',
        points: currentStroke,
        color: activeTool === 'highlighter' ? '#facc15' : '#ef4444',
        strokeWidth: activeTool === 'highlighter' ? 14 : 3,
      };
      onSaveAnnotations([...annotations, newAnnotation]);
      setCurrentStroke([]);
      return;
    }
  };

  // Add text annotation
  const handleSaveTextAnnotation = () => {
    if (!textInputPos || !textInputVal.trim()) {
      setTextInputPos(null);
      return;
    }
    const newAnnotation: Annotation = {
      id: `ann-txt-${Date.now()}`,
      docId: documentItem.id,
      pageNum: currentPage,
      type: 'text',
      x: textInputPos.normX,
      y: textInputPos.normY,
      text: textInputVal.trim(),
      color: '#f8fafc',
      strokeWidth: 1,
      fontSize: 14,
    };
    onSaveAnnotations([...annotations, newAnnotation]);
    setTextInputPos(null);
    setTextInputVal('');
    onShowToast('success', 'Annotation added', 'Text callout saved.');
  };

  // Hotspot Click Action Dispatcher
  const handleHotspotClick = (e: React.MouseEvent, hs: Hotspot) => {
    e.stopPropagation();

    // If eraser tool active, delete hotspot
    if (activeTool === 'eraser') {
      const updated = hotspots.filter((h) => h.id !== hs.id);
      onSaveHotspots(updated);
      onShowToast('info', 'Hotspot removed', `Removed ${hs.label}`);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    switch (hs.actionType) {
      case 'rca':
        if (hs.rcaId) {
          onOpenRca(hs.rcaId, hs.equipmentTag, hs.label);
        } else {
          // Create or link new RCA
          const autoRcaId = `rca-${hs.equipmentTag || Date.now()}`;
          onOpenRca(autoRcaId, hs.equipmentTag, hs.label);
        }
        break;

      case 'direct_link':
        if (hs.directLink?.targetDocId) {
          onNavigateToDocument(hs.directLink.targetDocId, hs.directLink.targetPageNum || 1);
        } else if (hs.directLink?.targetPageNum) {
          setCurrentPage(hs.directLink.targetPageNum);
          onShowToast('info', 'Jumped Page', `Navigated to Page ${hs.directLink.targetPageNum}`);
        } else if (hs.directLink?.url) {
          window.open(hs.directLink.url, '_blank');
        }
        break;

      case 'dropdown':
        setActivePopupHotspot({
          hotspot: hs,
          anchorX: rect.left + rect.width / 2,
          anchorY: rect.bottom + 6,
        });
        break;

      case 'note':
        setActivePopupHotspot({
          hotspot: hs,
          anchorX: rect.left + rect.width / 2,
          anchorY: rect.bottom + 6,
        });
        break;
    }
  };

  // Save Hotspot configuration from modal
  const handleSaveHotspotConfig = (hs: Hotspot) => {
    const existingIndex = hotspots.findIndex((h) => h.id === hs.id);
    let updated: Hotspot[];
    if (existingIndex >= 0) {
      updated = [...hotspots];
      updated[existingIndex] = hs;
    } else {
      updated = [...hotspots, hs];
    }
    onSaveHotspots(updated);
    setEditingHotspot(null);
    onShowToast('success', 'Hotspot Saved', `Configured ${hs.label} (${hs.actionType.toUpperCase()})`);
  };

  // Delete Hotspot
  const handleDeleteHotspot = (id: string) => {
    const updated = hotspots.filter((h) => h.id !== id);
    onSaveHotspots(updated);
    setEditingHotspot(null);
    setActivePopupHotspot(null);
    onShowToast('info', 'Hotspot deleted');
  };

  // PDF Page Management using pdf-lib: Delete current page
  const handleDeletePage = async () => {
    if (!pdfData || totalPages <= 1) {
      onShowToast('warning', 'Cannot Delete Page', 'A document must have at least one page remaining.');
      return;
    }

    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      pdfDoc.removePage(currentPage - 1);
      const newBytes = await pdfDoc.save();
      const newPageCount = totalPages - 1;
      const arrayBuffer = newBytes.buffer.slice(newBytes.byteOffset, newBytes.byteOffset + newBytes.byteLength) as ArrayBuffer;

      onUpdatePdfData(arrayBuffer, newPageCount);
      setCurrentPage((p) => Math.min(p, newPageCount));
      onShowToast('success', 'Page Deleted', `Removed Page ${currentPage} from document.`);
    } catch (err) {
      console.error('Delete page error:', err);
      onShowToast('error', 'Delete Failed', 'Failed to modify PDF pages.');
    }
  };

  // PDF Page Management: Rotate current page permanently in PDF
  const handleRotatePagePermanent = async () => {
    if (!pdfData) return;
    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      const page = pdfDoc.getPage(currentPage - 1);
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + 90) % 360));
      const newBytes = await pdfDoc.save();
      const arrayBuffer = newBytes.buffer.slice(newBytes.byteOffset, newBytes.byteOffset + newBytes.byteLength) as ArrayBuffer;

      onUpdatePdfData(arrayBuffer, totalPages);
      renderCurrentPage();
      onShowToast('success', 'Page Rotated', `Permanently rotated Page ${currentPage} by 90°.`);
    } catch (err) {
      console.error('Rotate page error:', err);
      onShowToast('error', 'Rotation Failed', 'Failed to modify PDF rotation.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* TOP HEADER: Viewer Controls & Toolbar */}
      <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 z-30">
        {/* Left: Back & Document Meta */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToExplorer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Explorer</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-white truncate max-w-xs md:max-w-md">
              {documentItem.title || documentItem.name}
            </h2>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>{documentItem.equipmentTag || 'P&ID LOOP'}</span>
              <span aria-hidden="true">·</span>
              <span>{documentItem.systemUnit || 'Plant System'}</span>
            </div>
          </div>
        </div>

        {/* Center: Tools Palette */}
        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shadow-inner">
          {/* Pan Tool */}
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'pan' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Pan (Drag canvas to move)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {/* Magnifier Glass Tool */}
          <button
            onClick={() => setActiveTool((t) => (t === 'magnifier' ? 'pan' : 'magnifier'))}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'magnifier' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Magnifier Glass (Inspect fine P&ID tags - Key: M)"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-0.5" />

          {/* Hotspot Link Drawer Tool */}
          <button
            onClick={() => setActiveTool('hotspot')}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              activeTool === 'hotspot' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Draw Hotspot Link (Drag rectangle over equipment - Key: H)"
          >
            <Link className="w-4 h-4" />
            <span className="text-[11px] hidden md:inline font-medium">Add Hotspot</span>
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-0.5" />

          {/* Annotation Pen */}
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'pen' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Pen Drawing (Red)"
          >
            <PenTool className="w-4 h-4" />
          </button>

          {/* Highlighter */}
          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'highlighter' ? 'bg-yellow-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Highlighter (Yellow)"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          {/* Text Annotation */}
          <button
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'text' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Text Note (Click to type)"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Eraser */}
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTool === 'eraser' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Eraser (Click annotation or hotspot to remove)"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom, Page Navigation & PDF Page Mods */}
        <div className="flex items-center gap-2">
          {/* Page Stepper */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums px-2 text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="hidden lg:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums px-1.5 text-cyan-400 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitWidth}
              className="p-1.5 text-slate-400 hover:text-white rounded text-[10px] font-mono"
              title="Fit to Width"
            >
              Fit
            </button>
          </div>

          {/* Page Modification: Rotate & Delete */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-lg"
              title="Rotate View 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeletePage}
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/80 rounded-lg"
              title="Delete Current Page (pdf-lib)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT CANVAS AREA */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`relative flex-1 overflow-hidden bg-slate-950 flex items-center justify-center ${
          activeTool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        } ${activeTool === 'hotspot' ? 'cursor-crosshair' : ''} ${
          activeTool === 'pen' || activeTool === 'highlighter' ? 'cursor-crosshair' : ''
        } ${activeTool === 'text' ? 'cursor-text' : ''} ${activeTool === 'eraser' ? 'cursor-no-drop' : ''}`}
      >
        {/* PDF & Overlay Layer Container */}
        <div
          className="relative transition-transform duration-75 ease-out shadow-2xl rounded-sm"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            width: `${pageDimensions.width}px`,
            height: `${pageDimensions.height}px`,
          }}
        >
          {/* Main High-DPI PDF Render Canvas */}
          <canvas ref={canvasRef} className="block w-full h-full bg-slate-900 shadow-2xl" />

          {/* HOTSPOT OVERLAY BOXES */}
          {pageHotspots.map((hs) => {
            let bgClass = 'bg-cyan-500/20 border-cyan-400 hover:bg-cyan-500/35 text-cyan-300';
            let iconBadge = 'L';
            if (hs.actionType === 'rca') {
              bgClass = 'bg-rose-500/25 border-rose-500 hover:bg-rose-500/40 text-rose-200 animate-pulse';
              iconBadge = 'RCA';
            } else if (hs.actionType === 'dropdown') {
              bgClass = 'bg-amber-500/25 border-amber-400 hover:bg-amber-500/40 text-amber-200';
              iconBadge = 'MENU';
            } else if (hs.actionType === 'note') {
              bgClass = 'bg-emerald-500/25 border-emerald-400 hover:bg-emerald-500/40 text-emerald-200';
              iconBadge = 'NOTE';
            }

            return (
              <div
                key={hs.id}
                onClick={(e) => handleHotspotClick(e, hs)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingHotspot(hs);
                }}
                className={`absolute border-2 rounded cursor-pointer transition-all flex flex-col justify-between p-1 group ${bgClass}`}
                style={{
                  left: `${hs.x}%`,
                  top: `${hs.y}%`,
                  width: `${hs.width}%`,
                  height: `${hs.height}%`,
                }}
              >
                {/* Hotspot Header Badge */}
                <div className="flex items-center justify-between gap-1 pointer-events-none">
                  <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-900/90 text-white shadow">
                    {iconBadge}
                  </span>
                  <span className="text-[10px] font-mono font-bold truncate bg-slate-900/80 px-1 rounded text-white">
                    {hs.equipmentTag || hs.label}
                  </span>
                </div>

                {/* Hotspot Label Tooltip on Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-[11px] font-medium bg-slate-900/95 border border-slate-700 text-white px-2 py-1 rounded shadow-xl truncate">
                  {hs.label}
                </div>
              </div>
            );
          })}

          {/* Active Hotspot Creation Preview Rectangle */}
          {isDrawingHotspot && currentHotspotRect && (
            <div
              className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/25 pointer-events-none rounded"
              style={{
                left: `${currentHotspotRect.x}%`,
                top: `${currentHotspotRect.y}%`,
                width: `${currentHotspotRect.w}%`,
                height: `${currentHotspotRect.h}%`,
              }}
            />
          )}

          {/* ANNOTATIONS SVG OVERLAY (Pen, Highlighter, Text) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${pageDimensions.width} ${pageDimensions.height}`}
          >
            {/* Render existing annotations */}
            {pageAnnotations.map((ann) => {
              if (ann.type === 'pen' && ann.points && ann.points.length > 1) {
                const pathStr = ann.points
                  .map((p, idx) => {
                    const px = (p.x / 100) * pageDimensions.width;
                    const py = (p.y / 100) * pageDimensions.height;
                    return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                  })
                  .join(' ');
                return (
                  <path
                    key={ann.id}
                    d={pathStr}
                    stroke={ann.color}
                    strokeWidth={ann.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }

              if (ann.type === 'highlighter' && ann.points && ann.points.length > 1) {
                const pathStr = ann.points
                  .map((p, idx) => {
                    const px = (p.x / 100) * pageDimensions.width;
                    const py = (p.y / 100) * pageDimensions.height;
                    return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                  })
                  .join(' ');
                return (
                  <path
                    key={ann.id}
                    d={pathStr}
                    stroke={ann.color}
                    strokeWidth={ann.strokeWidth}
                    fill="none"
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    opacity={0.45}
                    style={{ mixBlendMode: 'multiply' }}
                  />
                );
              }

              if (ann.type === 'text' && ann.x !== undefined && ann.y !== undefined) {
                const px = (ann.x / 100) * pageDimensions.width;
                const py = (ann.y / 100) * pageDimensions.height;
                return (
                  <g key={ann.id}>
                    <rect
                      x={px - 4}
                      y={py - 16}
                      width={(ann.text?.length || 5) * 8.5 + 8}
                      height={22}
                      fill="#0f172a"
                      rx={4}
                      opacity={0.9}
                      stroke="#334155"
                      strokeWidth={1}
                    />
                    <text
                      x={px}
                      y={py}
                      fill="#38bdf8"
                      fontSize={13}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      {ann.text}
                    </text>
                  </g>
                );
              }

              return null;
            })}

            {/* In-progress stroke */}
            {isDrawingAnnotation && currentStroke.length > 1 && (
              <path
                d={currentStroke
                  .map((p, idx) => {
                    const px = (p.x / 100) * pageDimensions.width;
                    const py = (p.y / 100) * pageDimensions.height;
                    return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                  })
                  .join(' ')}
                stroke={activeTool === 'highlighter' ? '#facc15' : '#ef4444'}
                strokeWidth={activeTool === 'highlighter' ? 14 : 3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={activeTool === 'highlighter' ? 0.5 : 1}
              />
            )}
          </svg>

          {/* In-place Text Input on Click */}
          {textInputPos && (
            <div
              className="absolute z-40 flex items-center gap-1.5 p-1.5 bg-slate-900 border border-cyan-500 rounded-lg shadow-2xl"
              style={{ left: `${textInputPos.x}px`, top: `${textInputPos.y}px` }}
            >
              <input
                type="text"
                autoFocus
                placeholder="Enter callout note..."
                value={textInputVal}
                onChange={(e) => setTextInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTextAnnotation();
                  if (e.key === 'Escape') setTextInputPos(null);
                }}
                className="px-2 py-1 bg-slate-950 text-xs text-white border border-slate-700 rounded focus:outline-none focus:border-cyan-400 w-44 font-mono"
              />
              <button
                onClick={handleSaveTextAnnotation}
                className="p-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTextInputPos(null)}
                className="p-1 text-slate-400 hover:text-white rounded text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* FLOATING MAGNIFIER LENS */}
        {activeTool === 'magnifier' && magnifierPos.visible && (
          <div
            className="fixed z-50 pointer-events-none rounded-full overflow-hidden magnifier-lens border-2 border-cyan-400 shadow-2xl"
            style={{
              left: `${magnifierPos.x - 80}px`,
              top: `${magnifierPos.y - 80}px`,
              width: '160px',
              height: '160px',
            }}
          >
            <canvas ref={magnifierCanvasRef} width={160} height={160} className="w-full h-full block" />
          </div>
        )}

        {/* ACTIVE HOTSPOT ACTION POPUP (Dropdown Menu or Note Dialog) */}
        {activePopupHotspot && (
          <div
            className="fixed z-50 max-w-sm w-80 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-4 backdrop-blur-md animate-in fade-in zoom-in-95"
            style={{
              left: `${Math.min(activePopupHotspot.anchorX, window.innerWidth - 340)}px`,
              top: `${Math.min(activePopupHotspot.anchorY, window.innerHeight - 300)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold text-cyan-400">
                  {activePopupHotspot.hotspot.equipmentTag || 'EQUIPMENT HOTSPOT'}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {activePopupHotspot.hotspot.label}
                </div>
              </div>
              <button
                onClick={() => setActivePopupHotspot(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Options List */}
            {activePopupHotspot.hotspot.actionType === 'dropdown' && (
              <div className="mt-3 space-y-1.5">
                {activePopupHotspot.hotspot.dropdownOptions?.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (opt.actionType === 'doc' && opt.targetDocId) {
                        onNavigateToDocument(opt.targetDocId, opt.targetPageNum || 1);
                      } else if (opt.actionType === 'note') {
                        onShowToast('info', opt.label, opt.note);
                      } else if (opt.url) {
                        window.open(opt.url, '_blank');
                      }
                      setActivePopupHotspot(null);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-slate-950/60 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-700/50 flex items-center justify-between text-xs text-slate-200 transition-colors group"
                  >
                    <span className="truncate group-hover:text-cyan-300">{opt.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Pop-up Note */}
            {activePopupHotspot.hotspot.actionType === 'note' && (
              <div className="mt-3">
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                  {activePopupHotspot.hotspot.note || 'No notes entered.'}
                </div>
              </div>
            )}

            {/* Quick Action Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <button
                onClick={() => {
                  setEditingHotspot(activePopupHotspot.hotspot);
                  setActivePopupHotspot(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Edit Hotspot Settings
              </button>
              <button
                onClick={() => handleDeleteHotspot(activePopupHotspot.hotspot.id)}
                className="text-rose-400 hover:text-rose-300"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HOTSPOT CONFIGURATION MODAL */}
      {editingHotspot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Configure Equipment Hotspot</h3>
              <button onClick={() => setEditingHotspot(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Equipment Tag & Label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Equipment Tag</label>
                  <input
                    type="text"
                    value={editingHotspot.equipmentTag}
                    onChange={(e) =>
                      setEditingHotspot({ ...editingHotspot, equipmentTag: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. P-101A"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Display Label</label>
                  <input
                    type="text"
                    value={editingHotspot.label}
                    onChange={(e) => setEditingHotspot({ ...editingHotspot, label: e.target.value })}
                    placeholder="e.g. Centrifugal Feed Pump"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Action Type Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5">Action Trigger Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['rca', 'dropdown', 'direct_link', 'note'] as ActionType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditingHotspot({ ...editingHotspot, actionType: type })}
                      className={`p-2 rounded-lg border text-center font-medium capitalize transition-all ${
                        editingHotspot.actionType === type
                          ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {type === 'direct_link' ? 'Direct Link' : type === 'rca' ? 'RCA Fault Tree' : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Type Specific Configurations */}
              {editingHotspot.actionType === 'rca' && (
                <div className="p-3 bg-slate-950 rounded-lg border border-rose-900/50">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Root Cause Analysis Binding</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Clicking this hotspot will open the comprehensive RCA Investigation Dashboard (Incident Report,
                    5-Whys, Fishbone Ishikawa, and Logic Fault Tree) for equipment{' '}
                    <strong className="text-white font-mono">{editingHotspot.equipmentTag || 'selected'}</strong>.
                  </p>
                </div>
              )}

              {editingHotspot.actionType === 'direct_link' && (
                <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div>
                    <label className="block text-slate-400 mb-1">Target Document</label>
                    <select
                      value={editingHotspot.directLink?.targetDocId || documentItem.id}
                      onChange={(e) =>
                        setEditingHotspot({
                          ...editingHotspot,
                          directLink: { ...editingHotspot.directLink, targetDocId: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                    >
                      {allDocuments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title || d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Target Page Number</label>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={editingHotspot.directLink?.targetPageNum || 1}
                      onChange={(e) =>
                        setEditingHotspot({
                          ...editingHotspot,
                          directLink: { ...editingHotspot.directLink, targetPageNum: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {editingHotspot.actionType === 'note' && (
                <div>
                  <label className="block text-slate-400 mb-1">Pop-up Text Note</label>
                  <textarea
                    rows={4}
                    value={editingHotspot.note || ''}
                    onChange={(e) => setEditingHotspot({ ...editingHotspot, note: e.target.value })}
                    placeholder="Enter equipment operational remark, calibration setpoints, or safety notes..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-[11px] leading-relaxed"
                  />
                </div>
              )}

              {editingHotspot.actionType === 'dropdown' && (
                <div>
                  <label className="block text-slate-400 mb-1">Dropdown Link Items</label>
                  <div className="space-y-2 mb-2">
                    {(editingHotspot.dropdownOptions || []).map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => {
                            const opts = [...(editingHotspot.dropdownOptions || [])];
                            opts[idx].label = e.target.value;
                            setEditingHotspot({ ...editingHotspot, dropdownOptions: opts });
                          }}
                          className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const opts = (editingHotspot.dropdownOptions || []).filter((_, i) => i !== idx);
                            setEditingHotspot({ ...editingHotspot, dropdownOptions: opts });
                          }}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const opts = editingHotspot.dropdownOptions || [];
                      setEditingHotspot({
                        ...editingHotspot,
                        dropdownOptions: [
                          ...opts,
                          {
                            id: `opt-${Date.now()}`,
                            label: `Option ${opts.length + 1}`,
                            actionType: 'note',
                            note: 'Specification data',
                          },
                        ],
                      });
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-medium text-xs"
                  >
                    + Add Dropdown Item
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteHotspot(editingHotspot.id)}
                className="text-rose-400 hover:text-rose-300 text-xs font-medium"
              >
                Delete Hotspot
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingHotspot(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveHotspotConfig(editingHotspot)}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Save Hotspot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
