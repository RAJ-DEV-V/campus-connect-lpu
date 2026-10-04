'use client';

import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';
import { Material } from '@/lib/db/types';

interface PdfPreviewModalProps {
  material: Material | null;
  onClose: () => void;
  onDownload: (material: Material) => void;
}

export default function PdfPreviewModal({ material, onClose, onDownload }: PdfPreviewModalProps) {
  if (!material) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 truncate pr-4">
            <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-base text-white truncate">{material.title}</h3>
              <p className="text-xs text-slate-400">
                {material.subject_code} • {material.subject} • {material.year === 1 ? '1st Year' : material.year === 2 ? '2nd Year' : material.year === 3 ? '3rd Year' : `${material.year}th Year`} • {material.file_size}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDownload(material)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white text-xs font-bold shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Frame / Preview Area */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
          <iframe
            src={`${material.file_url}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            title={material.title}
          />
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-4">
            <span><strong>Downloads:</strong> {material.download_count} students</span>
            <span>•</span>
            <span><strong>Type:</strong> {material.material_type}</span>
            <span>•</span>
            <span><strong>Uploaded:</strong> {new Date(material.created_at).toLocaleDateString()}</span>
          </div>

          <a
            href={material.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-lpu-600 hover:text-lpu-700 font-semibold"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
