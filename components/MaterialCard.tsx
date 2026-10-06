'use client';

import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  Eye, 
  Calendar, 
  HardDrive, 
  CheckCircle2, 
  BookOpen,
  FileSpreadsheet,
  HelpCircle,
  Award,
  Layers,
  Bookmark,
  FileArchive,
  Presentation
} from 'lucide-react';
import { Material } from '@/lib/db/types';
import { isMaterialPreviewable } from '@/lib/drive-service';

export function getMaterialFileFormat(material: { file_name?: string | null; file_url?: string; mime_type?: string | null }) {
  const name = (material.file_name || '').toLowerCase();
  const url = (material.file_url || '').toLowerCase();
  const mime = (material.mime_type || '').toLowerCase();

  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || url.includes('.zip') || mime.includes('zip') || mime.includes('compressed')) {
    return { type: 'zip' as const, label: 'ZIP Archive', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/90', icon: FileArchive, ext: '.zip' };
  }
  if (name.endsWith('.pptx') || name.endsWith('.ppt') || url.includes('.pptx') || url.includes('.ppt') || mime.includes('presentation') || mime.includes('powerpoint')) {
    return { type: 'ppt' as const, label: 'PPT Slides', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90', icon: Presentation, ext: name.endsWith('.ppt') ? '.ppt' : '.pptx' };
  }
  if (name.endsWith('.docx') || name.endsWith('.doc') || url.includes('.docx') || mime.includes('word')) {
    return { type: 'doc' as const, label: 'Word Doc', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/90', icon: FileText, ext: '.docx' };
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || mime.startsWith('image/')) {
    return { type: 'image' as const, label: 'Images', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90', icon: FileText, ext: '.jpg' };
  }
  return { type: 'pdf' as const, label: 'PDF', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90', icon: FileText, ext: '.pdf' };
}

interface MaterialCardProps {
  material: Material;
  onPreview?: (mat: Material) => void;
  onDownloadComplete?: (mat: Material) => void;
  allowDownloads?: boolean;
  isAdmin?: boolean;
  isSaved?: boolean;
  onToggleSave?: (mat: Material) => void;
}

export function formatYearName(year: number): string {
  switch (year) {
    case 1:
      return '1st Year';
    case 2:
      return '2nd Year';
    case 3:
      return '3rd Year';
    case 4:
      return '4th Year';
    default:
      return `Year ${year}`;
  }
}

export default function MaterialCard({ 
  material, 
  onPreview, 
  onDownloadComplete,
  allowDownloads = true,
  isAdmin = false,
  isSaved = false,
  onToggleSave
}: MaterialCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadCount, setDownloadCount] = useState(material.download_count);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Normal users can download if global downloads are ON, or if the file CANNOT be previewed in the previewer (e.g. ZIP, RAR, 7Z, PPT, etc.)
  const canPreview = isMaterialPreviewable(material);
  const canDownload = allowDownloads || !canPreview;
  const fileFormat = getMaterialFileFormat(material);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (downloading) return;

    setDownloading(true);
    try {
      const downloadEndpoint = `/api/materials/${material.id}/download`;
      
      const link = document.createElement('a');
      link.href = downloadEndpoint;
      const cleanTitle = material.title.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 30);
      link.setAttribute('download', `${material.subject_code}_${cleanTitle}${fileFormat.ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadCount((prev) => prev + 1);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);

      if (onDownloadComplete) {
        onDownloadComplete({ ...material, download_count: downloadCount + 1 });
      }
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setDownloading(false);
    }
  };

  const getTypeBadge = () => {
    switch (material.material_type) {
      case 'Notes':
        return {
          icon: BookOpen,
          classes: 'bg-sky-50 text-sky-700 border-sky-200/90',
          dot: 'bg-sky-500',
        };
      case 'Mid-Term':
        return {
          icon: FileSpreadsheet,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
          dot: 'bg-emerald-500',
        };
      case 'End-Term':
        return {
          icon: Award,
          classes: 'bg-purple-50 text-purple-700 border-purple-200/90',
          dot: 'bg-purple-500',
        };
      case 'PYQs':
        return {
          icon: HelpCircle,
          classes: 'bg-amber-50 text-amber-700 border-amber-200/90',
          dot: 'bg-amber-500',
        };
      default:
        return {
          icon: FileText,
          classes: 'bg-slate-50 text-slate-700 border-slate-200/90',
          dot: 'bg-slate-500',
        };
    }
  };

  const badge = getTypeBadge();
  const BadgeIcon = badge.icon;
  const FormatIcon = fileFormat.icon;

  return (
    <div className="group relative bg-white hover:bg-gradient-to-b hover:from-white hover:to-orange-50/15 rounded-2xl border border-slate-200/80 hover:border-orange-400/60 p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_32px_-10px_rgba(249,115,22,0.14)] hover:-translate-y-1.5 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden">
      {/* Top subtle ambient glow bar on card hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-400/0 to-transparent group-hover:via-orange-500/80 transition-all duration-500 pointer-events-none" />

      <div>
        {/* Top Badges: Material Type + File Format + Year Badge + Subject Code + Bookmark */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${badge.classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} animate-pulse`} />
              <BadgeIcon className="w-3.5 h-3.5" />
              {material.material_type}
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${fileFormat.badgeClass}`}>
              <FormatIcon className="w-3.5 h-3.5" />
              {fileFormat.label}
            </span>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
              {formatYearName(material.year)}
            </span>
            {material.file_url?.startsWith('[') && (() => {
              try {
                const arr = JSON.parse(material.file_url);
                if (Array.isArray(arr) && arr.length > 1) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      {arr.length} PDFs
                    </span>
                  );
                }
              } catch {}
              return null;
            })()}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-mono font-bold text-orange-950 bg-orange-100/80 border border-orange-200/90 px-2 py-0.5 rounded-md shadow-2xs tracking-tight">
              {material.subject_code}
            </span>
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(material);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  isSaved
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300/50'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title={isSaved ? 'Remove from Saved' : 'Save Material'}
                aria-label={isSaved ? 'Remove from Saved' : 'Save Material'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-500' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-lpu-600 transition-colors line-clamp-2">
          {material.title}
        </h3>

        {/* Subject */}
        <p className="text-xs font-semibold text-slate-600 mt-1">
          {material.subject}
        </p>

        {/* Description */}
        {material.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
            {material.description}
          </p>
        )}
      </div>

      {/* Metadata & Actions */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3.5">
          <span className="flex items-center gap-1 font-medium">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            {material.file_size}
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Download className="w-3.5 h-3.5 text-slate-400" />
            {downloadCount} downloads
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {new Date(material.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onPreview && canPreview && (
            <button
              onClick={() => onPreview(material)}
              type="button"
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                canDownload 
                  ? 'text-slate-700 bg-slate-100/90 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/90 shadow-2xs active:scale-98' 
                  : 'col-span-2 text-white bg-slate-900 hover:bg-slate-800 font-bold shadow-xs active:scale-98'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {canDownload ? 'Preview' : 'Preview Document'}
            </button>
          )}

          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              type="button"
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-600'
                  : 'bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-orange-500/25 hover:shadow-md'
              } ${onPreview && canPreview ? '' : 'col-span-2'}`}
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Downloaded!
                </>
              ) : downloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  ⬇ Download
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
