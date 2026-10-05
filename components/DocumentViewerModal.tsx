'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize, 
  Minimize, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  HardDrive,
  BookOpen,
  AlertTriangle,
  Layers,
  FileText,
  FolderOpen
} from 'lucide-react';
import { Material } from '@/lib/db/types';

interface DocumentViewerModalProps {
  material: Material | null;
  allowDownloads: boolean;
  isAdminOrOwner: boolean;
  onClose: () => void;
  onDownload?: (material: Material) => void;
}

export default function DocumentViewerModal({
  material,
  allowDownloads,
  isAdminOrOwner,
  onClose,
  onDownload,
}: DocumentViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [debouncedZoom, setDebouncedZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [driveEmbedUrl, setDriveEmbedUrl] = useState<string | null>(null);
  const [isImageType, setIsImageType] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  // Multi-PDF / Multi-part files bundle support
  const multiFiles: { title?: string; name?: string; url: string; size?: string; drive_file_id?: string }[] = React.useMemo(() => {
    if (!material?.file_url?.startsWith('[')) return [];
    try {
      const parsed = JSON.parse(material.file_url);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [material?.file_url]);

  useEffect(() => {
    setActiveFileIndex(0);
  }, [material?.id]);

  // Panning state for zoomed views
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const zoomLevelRef = useRef<number>(zoomLevel);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Debounce zoom level for PDF.js canvas re-rendering to keep trackpad pinch at 60fps
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedZoom(zoomLevel);
    }, 160);
    return () => clearTimeout(handler);
  }, [zoomLevel]);

  const canDownload = allowDownloads || isAdminOrOwner;

  // Helper to dynamically load Mozilla PDF.js without bundling issues
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject(new Error('Window undefined'));

      const setupWorkerAndResolve = (lib: any) => {
        try {
          if (lib && lib.GlobalWorkerOptions) {
            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
        } catch (e) {
          console.warn('Worker configuration notice:', e);
        }
        resolve(lib);
      };

      if ((window as any).pdfjsLib) {
        return setupWorkerAndResolve((window as any).pdfjsLib);
      }

      const existingScript = document.getElementById('pdfjs-dist-script') as HTMLScriptElement;
      if (existingScript) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((window as any).pdfjsLib) {
            clearInterval(interval);
            setupWorkerAndResolve((window as any).pdfjsLib);
          } else if (attempts > 40) {
            clearInterval(interval);
            reject(new Error('Timeout waiting for pdfjsLib'));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'pdfjs-dist-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          setupWorkerAndResolve(lib);
        } else {
          reject(new Error('pdfjsLib not defined after CDN load'));
        }
      };
      script.onerror = () => {
        // Fallback to local /pdf.min.js
        const localScript = document.createElement('script');
        localScript.src = '/pdf.min.js';
        localScript.onload = () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            setupWorkerAndResolve(lib);
          } else {
            reject(new Error('Local pdfjsLib not defined'));
          }
        };
        localScript.onerror = reject;
        document.head.appendChild(localScript);
      };
      document.head.appendChild(script);
    });
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key to exit fullscreen or close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle two-finger trackpad / mouse pad pinch-to-zoom (Wheel with ctrlKey) and touch pinch
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Touchpad pinch-to-zoom on Windows/Mac and Ctrl + mouse wheel both set e.ctrlKey = true
      if (e.ctrlKey) {
        e.preventDefault();
        // deltaY < 0 is pinch out (zoom in), deltaY > 0 is pinch in (zoom out)
        const zoomDelta = -e.deltaY * 0.45;
        setZoomLevel((prev) => {
          const next = Math.round(prev + zoomDelta);
          return Math.min(Math.max(next, 40), 300);
        });
      }
    };

    // Safari on Mac trackpad gesture events
    const handleGestureStart = (e: any) => {
      e.preventDefault();
    };
    const handleGestureChange = (e: any) => {
      e.preventDefault();
      if (e.scale) {
        setZoomLevel((prev) => {
          const next = Math.round(prev * e.scale);
          return Math.min(Math.max(next, 40), 300);
        });
      }
    };

    // Touchscreen 2-finger pinch
    let initialTouchDist = 0;
    let initialTouchZoom = 100;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialTouchZoom = zoomLevelRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialTouchDist > 0) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = currentDist / initialTouchDist;
        const nextZoom = Math.min(Math.max(Math.round(initialTouchZoom * scaleFactor), 40), 300);
        setZoomLevel(nextZoom);
      }
    };

    const handleTouchEnd = () => {
      initialTouchDist = 0;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart as any, { passive: false } as any);
    container.addEventListener('gesturechange', handleGestureChange as any, { passive: false } as any);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart as any);
      container.removeEventListener('gesturechange', handleGestureChange as any);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Mouse drag-to-pan handlers for zoomed documents
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 100 || !viewportRef.current) return;
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !viewportRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    viewportRef.current.scrollLeft = dragStart.scrollLeft - dx;
    viewportRef.current.scrollTop = dragStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Load document binary stream
  useEffect(() => {
    if (!material) return;

    let isCancelled = false;
    let localBlobUrl: string | null = null;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setDriveEmbedUrl(null);
    setCurrentPage(1);
    setTotalPages(1);

    const extractDriveId = (url: string): string | null => {
      if (!url) return null;
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) return idMatch[1];
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) return fileMatch[1];
      const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch) return dMatch[1];
      return null;
    };

    const loadDocument = async () => {
      try {
        const activeFile = multiFiles[activeFileIndex];
        const activeUrl = activeFile?.url || material.file_url;
        const activeTitle = activeFile?.title || activeFile?.name || material.title;

        const driveId = extractDriveId(activeUrl);
        const isImage = 
          /\.(png|jpe?g|webp|gif|svg)$/i.test(activeUrl) ||
          /\.(png|jpe?g|webp|gif|svg)$/i.test(activeTitle) ||
          material.material_type?.toLowerCase().includes('image');

        if (driveId && isImage) {
          setIsImageType(true);
          setPreviewBlobUrl(`https://lh3.googleusercontent.com/d/${driveId}`);
          setLoading(false);
          return;
        }

        // Try streaming the document binary via /api/materials/[id]/preview
        const previewQuery = multiFiles.length > 0 ? `?fileIndex=${activeFileIndex}` : '';
        const response = await fetch(`/api/materials/${material.id}/preview${previewQuery}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const blob = await response.blob();
          if (isCancelled) return;

          localBlobUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(localBlobUrl);

          // Check if image
          if (contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(material.file_url)) {
            setIsImageType(true);
            setLoading(false);
            return;
          }

          setIsImageType(false);

          // PDF document: load with PDF.js for canvas rendering
          try {
            const arrayBuffer = await blob.arrayBuffer();
            if (isCancelled) return;

            const pdfjsLib = await loadPdfJs();
            if (isCancelled) return;

            const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(arrayBuffer),
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true,
              standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
            });
            const doc = await loadingTask.promise;
            if (isCancelled) return;

            setPdfDoc(doc);
            setTotalPages(doc.numPages || 1);
            setLoading(false);
            return;
          } catch (pdfErr) {
            console.warn('PDF.js canvas init failed, checking fallback:', pdfErr);
            if (driveId) {
              setDriveEmbedUrl(`https://drive.google.com/file/d/${driveId}/preview`);
              setLoading(false);
              return;
            }
            if (material.file_url.startsWith('http')) {
              setDriveEmbedUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`);
              setLoading(false);
              return;
            }
            setError('Could not render document preview.');
            setLoading(false);
            return;
          }
        }

        // Fallback for Google Drive files if stream API response is not ok
        if (driveId) {
          setIsImageType(false);
          setDriveEmbedUrl(`https://drive.google.com/file/d/${driveId}/preview`);
          setLoading(false);
          return;
        }

        // Fallback for public HTTP files to Google Docs embedded viewer
        if (material.file_url.startsWith('http')) {
          setIsImageType(false);
          setDriveEmbedUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`);
          setLoading(false);
          return;
        }

        throw new Error(`Failed to load document: HTTP ${response.status}`);
      } catch (err: any) {
        if (isCancelled) return;
        const driveId = extractDriveId(material.file_url);
        if (driveId) {
          setIsImageType(false);
          setDriveEmbedUrl(`https://drive.google.com/file/d/${driveId}/preview`);
          setLoading(false);
          return;
        }
        if (material.file_url.startsWith('http')) {
          setIsImageType(false);
          setDriveEmbedUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`);
          setLoading(false);
          return;
        }
        console.error('Error loading document preview:', err);
        setError('Failed to load document preview. Please try again or download if allowed.');
        setLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [material, activeFileIndex, multiFiles]);

  // Render current PDF page onto high-resolution HTML5 canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || isImageType) return;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const container = viewportRef.current || viewerContainerRef.current;
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const containerWidth = container ? container.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 800);
        const unscaledViewport = page.getViewport({ scale: 1 });

        // Calculate responsive scale based on viewport width & debounced zoom percentage
        const horizontalPadding = isMobile ? 16 : 48;
        const targetWidth = Math.max(260, Math.min(containerWidth - horizontalPadding, isMobile ? window.innerWidth - 16 : 850));
        const baseScale = targetWidth / unscaledViewport.width;
        const finalScale = baseScale * (debouncedZoom / 100);

        const viewport = page.getViewport({ scale: finalScale, rotation });
        // Cap pixelRatio at 2 on mobile to conserve GPU/Canvas memory
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
        console.warn('Page render notice:', err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, debouncedZoom, rotation, isImageType]);

  if (!material) return null;

  const toggleViewerFullscreen = () => {
    if (!viewerContainerRef.current) return;

    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 40));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/90 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Document Viewer Container (Mobile edge-to-edge full screen, Desktop centered card) */}
      <div 
        ref={viewerContainerRef}
        className={`bg-slate-900 w-full flex flex-col shadow-2xl overflow-hidden transition-all ${
          isFullscreen 
            ? 'h-screen w-screen rounded-none border-0' 
            : 'h-[100dvh] sm:h-[92vh] sm:max-w-5xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-800'
        }`}
      >
        
        {/* Top Control Header */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-slate-950 text-white flex items-center justify-between gap-2 border-b border-slate-800 shrink-0">
          
          {/* Material Identity */}
          <div className="flex items-center gap-2 sm:gap-3 truncate min-w-0 max-w-[150px] xs:max-w-[200px] sm:max-w-md">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="truncate min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                {material.title}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {material.subject_code} • Year {material.year}
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Page Navigation */}
            {totalPages > 1 && (
              <div className="flex items-center bg-slate-800/80 rounded-xl px-1 py-0.5 border border-slate-700/60 text-xs">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <span className="px-1.5 text-[10px] sm:text-[11px] font-mono text-slate-300">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60 text-xs">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 40}
                className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg disabled:opacity-40 transition-colors"
                title="Zoom Out (-25%)"
              >
                <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono text-slate-200 hover:text-white cursor-pointer select-none"
                title="Two-finger pinch on touchpad or Ctrl + Scroll to zoom. Click to reset (100%)"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 300}
                className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg disabled:opacity-40 transition-colors"
                title="Zoom In (+25%)"
              >
                <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            {/* Rotation Control */}
            <button
              onClick={handleRotate}
              className="p-1.5 sm:p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-colors"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Document Viewer Fullscreen (Desktop/Tablet only since mobile is already 100dvh full screen) */}
            <button
              onClick={toggleViewerFullscreen}
              className="hidden sm:inline-flex p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Document Viewer'}
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>

            {/* Download Button */}
            {canDownload ? (
              <button
                onClick={() => {
                  if (onDownload) {
                    onDownload(material);
                  } else {
                    const activeUrl = multiFiles.length > 0 ? (multiFiles[activeFileIndex]?.url || material.file_url) : material.file_url;
                    const match = activeUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) || activeUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) {
                      window.open(`https://drive.google.com/uc?export=download&id=${match[1]}`, '_blank');
                    } else {
                      const dlQuery = multiFiles.length > 0 ? `?fileIndex=${activeFileIndex}` : '';
                      window.open(`/api/materials/${material.id}/download${dlQuery}`, '_blank');
                    }
                  }
                }}
                className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white text-xs font-bold shadow-xs transition-all active:scale-98"
                title="Download this document"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            ) : null}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-0.5 sm:ml-1"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>

          </div>
        </div>

        {/* Multi-Part / Multi-PDF Switcher Strip */}
        {multiFiles.length > 1 && (
          <div className="px-3 sm:px-6 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1.5 mr-1">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              Files ({multiFiles.length}):
            </span>
            {multiFiles.map((file, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (activeFileIndex !== idx) {
                    setActiveFileIndex(idx);
                    setCurrentPage(1);
                    setLoading(true);
                    setError(null);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none ${
                  activeFileIndex === idx
                    ? 'bg-gradient-to-r from-lpu-600 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[150px] sm:max-w-[220px]">
                  {file.title || file.name || `File ${idx + 1}`}
                </span>
                {file.size && (
                  <span className="text-[10px] opacity-75 font-mono">
                    ({file.size})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Embedded Document Viewport with Mouse Pad / Trackpad Zoom and Pan */}
        <div 
          ref={viewportRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 bg-slate-900/90 relative overflow-auto flex items-center justify-center p-2 sm:p-4 select-none ${
            zoomLevel > 100 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <div className="w-10 h-10 border-4 border-lpu-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Loading document inside viewer...</p>
            </div>
          ) : error ? (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md text-center mx-4">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-200">{error}</p>
              {canDownload && (
                <button
                  onClick={() => onDownload && onDownload(material)}
                  className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 text-white font-bold text-xs"
                >
                  Download Document
                </button>
              )}
            </div>
          ) : isImageType && previewBlobUrl ? (
            <div 
              className="w-full h-full overflow-auto flex items-center justify-center transition-transform duration-100 ease-out"
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewBlobUrl}
                alt={material.title}
                className="max-w-full max-h-full rounded-none sm:rounded-lg shadow-2xl object-contain bg-white"
              />
            </div>
          ) : driveEmbedUrl ? (
            <div className="w-full h-full overflow-auto flex items-start justify-center p-0 sm:p-4 select-none">
              <div 
                className="w-full h-full relative rounded-none sm:rounded-xl overflow-hidden bg-black shadow-2xl transition-transform duration-100 ease-out origin-top"
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  minHeight: '500px',
                }}
              >
                <iframe
                  src={driveEmbedUrl}
                  title={material.title}
                  className="w-full h-full rounded-none sm:rounded-xl border-0 bg-black min-h-[500px]"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
                {/* Security Shield: Covers and blocks the Google Drive top-right pop-out button */}
                <div 
                  className="absolute top-0 right-0 w-16 h-14 bg-black z-30 pointer-events-auto cursor-default rounded-tr-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title=""
                />
              </div>
            </div>
          ) : pdfDoc ? (
            <div 
              className="w-full h-full overflow-auto flex items-start justify-center p-1 sm:p-4 transition-transform duration-75 ease-out"
              style={{
                transform: `scale(${zoomLevel / debouncedZoom}) rotate(${rotation}deg)`,
                transformOrigin: 'top center',
              }}
            >
              <canvas
                ref={canvasRef}
                className="rounded-lg sm:rounded-xl shadow-2xl bg-white max-w-full"
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                }}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-400">Loading document...</div>
          )}
        </div>

        {/* Bottom Information & Security Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px]">
              <HardDrive className="w-3 h-3 text-slate-500" />
              {material.file_size}
            </span>
            <span>•</span>
            <span className="text-[11px]">
              {material.download_count} total downloads
            </span>
            <span>•</span>
            <span className="text-[11px]">
              Uploaded {new Date(material.created_at).toLocaleDateString()}
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Trackpad 2-finger pinch / Ctrl + Scroll to zoom
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {canDownload ? (
              <span className="text-emerald-400 font-medium">
                ✓ Full Access: Reading & Downloads Enabled
              </span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Global Policy: Reading & Zoom Enabled (Download Prohibited)
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
