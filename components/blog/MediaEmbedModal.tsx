'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import CloudinaryUploader from './CloudinaryUploader';
import { Youtube, Code2, ImageIcon, Video } from 'lucide-react';

type Tab = 'youtube' | 'social' | 'image' | 'video';

type MediaPayload =
  | { type: 'youtube'; url: string }
  | { type: 'social'; html: string; platform: string }
  | { type: 'image'; url: string; publicId: string }
  | { type: 'video'; url: string; publicId: string };

interface MediaEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (payload: MediaPayload) => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
  { id: 'social', label: 'Social embed', icon: <Code2 className="w-4 h-4" /> },
  { id: 'image', label: 'Image', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'video', label: 'Video', icon: <Video className="w-4 h-4" /> },
];

const PLATFORMS = ['Twitter / X', 'Instagram', 'TikTok', 'Facebook', 'Other'];

export default function MediaEmbedModal({ isOpen, onClose, onInsert }: MediaEmbedModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [platform, setPlatform] = useState('Twitter / X');
  const [error, setError] = useState('');

  const handleClose = () => {
    setYoutubeUrl('');
    setEmbedCode('');
    setError('');
    onClose();
  };

  const handleYouTubeInsert = () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }
    const isYoutube = /youtube\.com|youtu\.be/.test(youtubeUrl);
    if (!isYoutube) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    onInsert({ type: 'youtube', url: youtubeUrl.trim() });
    handleClose();
  };

  const handleSocialInsert = () => {
    if (!embedCode.trim()) {
      setError('Please paste an embed code');
      return;
    }
    onInsert({ type: 'social', html: embedCode.trim(), platform });
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Insert media" size="md">
      <div className="p-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* YouTube tab */}
        {activeTab === 'youtube' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">YouTube URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              onKeyDown={(e) => e.key === 'Enter' && handleYouTubeInsert()}
            />
            <button
              type="button"
              onClick={handleYouTubeInsert}
              className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
            >
              Embed video
            </button>
          </div>
        )}

        {/* Social embed tab */}
        {activeTab === 'social' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embed code
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Paste the embed code from the platform (e.g. Twitter &ldquo;Share → Embed&rdquo;).
              </p>
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='<blockquote class="twitter-tweet">...</blockquote>'
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSocialInsert}
              className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
            >
              Insert embed
            </button>
          </div>
        )}

        {/* Image upload tab */}
        {activeTab === 'image' && (
          <CloudinaryUploader
            mediaType="image"
            onUploadSuccess={(result) => {
              onInsert({ type: 'image', url: result.url, publicId: result.publicId });
              handleClose();
            }}
          />
        )}

        {/* Video upload tab */}
        {activeTab === 'video' && (
          <CloudinaryUploader
            mediaType="video"
            onUploadSuccess={(result) => {
              onInsert({ type: 'video', url: result.url, publicId: result.publicId });
              handleClose();
            }}
          />
        )}
      </div>
    </Modal>
  );
}
