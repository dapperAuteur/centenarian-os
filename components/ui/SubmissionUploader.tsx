'use client';

// components/ui/SubmissionUploader.tsx
// Multi-file uploader for assignment submissions.
// Supports images, video, audio, and raw documents (PDF, DOC, DOCX, TXT, MD, etc.)
// Uses Cloudinary's resource_type routing: image / video (audio too) / raw (documents)

import { useRef, useState } from 'react';
import { Paperclip, X, Loader2, FileText, Film, Music, Image as ImageIcon } from 'lucide-react';

export interface SubmissionFile {
  url: string;
  name: string;
  type: string;
}

interface Props {
  files: SubmissionFile[];
  onChange: (files: SubmissionFile[]) => void;
  maxFiles?: number;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];

const ACCEPTED = [
  'image/*', 'video/*', 'audio/*',
  '.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xls', '.xlsx', '.ppt', '.pptx',
].join(',');

function ext(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function cloudinaryResourceType(file: File): 'image' | 'video' | 'raw' {
  const e = ext(file.name);
  if (IMAGE_EXTS.includes(e)) return 'image';
  if (VIDEO_EXTS.includes(e) || AUDIO_EXTS.includes(e)) return 'video';
  return 'raw';
}

function FilePreview({ file, onRemove }: { file: SubmissionFile; onRemove: () => void }) {
  const e = ext(file.name);
  const isImg = IMAGE_EXTS.includes(e);
  const isVid = VIDEO_EXTS.includes(e);
  const isAud = AUDIO_EXTS.includes(e);

  const Icon = isVid ? Film : isAud ? Music : isImg ? ImageIcon : FileText;

  return (
    <div className="flex items-start gap-3 bg-gray-800 rounded-xl p-3">
      {isImg ? (
        <img src={file.url} alt={file.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-14 h-14 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-fuchsia-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate mb-1">{file.name}</p>
        {isVid && (
          <video src={file.url} className="w-full max-h-24 rounded" controls />
        )}
        {isAud && (
          <audio src={file.url} className="w-full h-8" controls />
        )}
        {!isImg && !isVid && !isAud && (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-fuchsia-400 hover:underline"
          >
            View / download
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-gray-500 hover:text-red-400 transition shrink-0 mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function SubmissionUploader({ files, onChange, maxFiles = 5 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    if (files.length + selected.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }
    if (!cloudName || !uploadPreset) {
      setError('File upload is not configured.');
      return;
    }

    setUploading(true);
    setError(null);

    const uploaded: SubmissionFile[] = [];
    for (const file of selected) {
      const resourceType = cloudinaryResourceType(file);
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', uploadPreset);
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
          { method: 'POST', body: form },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!data.secure_url) throw new Error('No URL returned');
        uploaded.push({ url: data.secure_url, name: file.name, type: file.type });
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    onChange([...files, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {files.map((file, i) => (
        <FilePreview
          key={i}
          file={file}
          onRemove={() => onChange(files.filter((_, idx) => idx !== i))}
        />
      ))}

      {files.length < maxFiles && (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition disabled:opacity-50"
          >
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Paperclip className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Attach files'}
            <span className="text-gray-500 font-normal ml-1">
              image, video, audio, PDF, DOC, TXT, MD…
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            onChange={handleFiles}
            className="hidden"
          />
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
