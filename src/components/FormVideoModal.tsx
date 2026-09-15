/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Video, ExternalLink, X, BookOpen } from 'lucide-react';
import { getYouTubeEmbedUrl, normalizeVideoUrl } from '../lib/workoutUtils';

interface FormVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  videoUrl: string;
  notes?: string;
}

export function FormVideoModal({
  isOpen,
  onClose,
  exerciseName,
  videoUrl,
  notes
}: FormVideoModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  const normalizedUrl = normalizeVideoUrl(videoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Form review video for ${exerciseName}`}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex-shrink-0">
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Form Review
              </div>
              <h3 className="text-base sm:text-lg font-black text-white truncate" title={exerciseName}>
                {exerciseName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {normalizedUrl && (
              <a
                href={normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                title="Open directly in YouTube / new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>YouTube</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close form review"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player or Fallback View */}
        <div className="relative bg-black flex items-center justify-center min-h-[220px] sm:min-h-[340px]">
          {embedUrl ? (
            <div className="w-full aspect-video">
              <iframe
                src={embedUrl}
                title={`Form review video for ${exerciseName}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-400">
                <Video className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-200">Video Link Configured</h4>
                <p className="text-xs text-zinc-400 break-all">
                  {normalizedUrl || videoUrl}
                </p>
              </div>
              {normalizedUrl && (
                <a
                  href={normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-950/50 active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
              )}
            </div>
          )}
        </div>

        {/* Notes & Cues Footer */}
        {notes && (
          <div className="p-4 sm:p-5 bg-zinc-950/80 border-t border-zinc-800 overflow-y-auto max-h-36">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Exercise Notes & Form Cues</span>
            </div>
            <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed italic">
              {notes}
            </p>
          </div>
        )}

        {/* Action bar for mobile */}
        <div className="sm:hidden p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2">
          {normalizedUrl && (
            <a
              href={normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open on YouTube</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
