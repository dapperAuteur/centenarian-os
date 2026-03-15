'use client';

import { useState, useCallback } from 'react';
import { Save, CheckCircle, Mic, Link2, Tags, Paperclip, ImagePlus, ChevronDown, ChevronUp } from 'lucide-react';
import AudioRecorder from '@/components/ui/AudioRecorder';
import AudioAttachmentList from '@/components/ui/AudioAttachmentList';
import { useAudioAttachments } from '@/lib/hooks/useAudioAttachments';
import ImageAttachmentPicker from '@/components/ui/ImageAttachmentPicker';
import ImageAttachmentGrid from '@/components/ui/ImageAttachmentGrid';
import { useImageAttachments } from '@/lib/hooks/useImageAttachments';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import MediaUploader from '@/components/ui/MediaUploader';
import type { ScanResult } from '@/components/scan/ScanButton';

type EntityType =
  | 'blog_post' | 'recipe' | 'daily_log' | 'focus_session'
  | 'task' | 'workout_log' | 'equipment' | 'trip';

interface EntryComposerFeatures {
  audio?: boolean;
  photos?: boolean;
  media?: boolean;
  activityLinks?: boolean;
  lifeCategories?: boolean;
}

interface EntryComposerProps {
  /** Polymorphic entity type for audio attachments, activity links, life categories */
  entityType: EntityType;
  /** Entity ID — null means entity not yet created (extras hidden until saved) */
  entityId: string | null;
  /** Which extras to show */
  features?: EntryComposerFeatures;
  /** Module's save handler */
  onSave: () => Promise<void>;
  /** Save button label */
  saveLabel?: string;
  /** Disable save button (module controls) */
  saveDisabled?: boolean;
  /** Hide the built-in save button (for modules with custom save UX like focus timer) */
  hideSaveButton?: boolean;
  /** Audio: compact mode (icon-only) */
  audioCompact?: boolean;
  /** Audio: max recording duration in seconds */
  audioMaxDuration?: number;
  /** Audio: auto-upload on stop (skip preview) */
  audioAutoUpload?: boolean;
  /** Media upload callback */
  onMediaUpload?: (url: string) => void;
  /** Media remove callback */
  onMediaRemove?: () => void;
  /** Current media URL for preview */
  currentMediaUrl?: string | null;
  /** Max photo attachments */
  maxPhotos?: number;
  /** OCR scan result callback */
  onScanResult?: (data: ScanResult) => void;
  /** Dark mode */
  variant?: 'light' | 'dark';
  /** Module's form fields */
  children: React.ReactNode;
}

type ExpandedSection = 'audio' | 'photos' | 'media' | 'links' | 'categories' | null;

export default function EntryComposer({
  entityType,
  entityId,
  features = {},
  onSave,
  saveLabel = 'Save',
  saveDisabled = false,
  hideSaveButton = false,
  audioCompact = false,
  audioMaxDuration,
  audioAutoUpload = false,
  onMediaUpload,
  onMediaRemove,
  currentMediaUrl,
  maxPhotos = 10,
  onScanResult,
  variant = 'light',
  children,
}: EntryComposerProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<ExpandedSection>(null);

  const {
    attachments,
    addAttachment,
    removeAttachment,
  } = useAudioAttachments(entityType, entityId);

  const {
    attachments: imageAttachments,
    addAttachment: addImage,
    removeAttachment: removeImage,
  } = useImageAttachments(entityType, entityId);

  const dark = variant === 'dark';

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleAudioUploaded = useCallback(
    (url: string, publicId: string) => {
      addAttachment(url, publicId);
    },
    [addAttachment],
  );

  const handleAudioRemoved = useCallback(() => {
    // AudioRecorder reset — no-op, attachments managed via list
  }, []);

  const handleImageUploaded = useCallback(
    (url: string, publicId: string) => {
      addImage(url, publicId);
    },
    [addImage],
  );

  const toggleSection = (section: ExpandedSection) => {
    setExpanded((prev) => (prev === section ? null : section));
  };

  const hasAnyFeature = features.audio || features.photos || features.media || features.activityLinks || features.lifeCategories;
  const extrasAvailable = hasAnyFeature && !!entityId;

  // Style helpers
  const toolbarBtnBase = `flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm rounded-lg transition ${
    dark
      ? 'text-gray-300 hover:bg-gray-700'
      : 'text-gray-600 hover:bg-gray-100'
  }`;
  const toolbarBtnActive = dark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900';
  const sectionBg = dark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200';

  return (
    <div className="space-y-4">
      {/* Module's custom form fields */}
      {children}

      {/* Audio attachments (always visible if any exist) */}
      {features.audio && attachments.length > 0 && (
        <AudioAttachmentList
          attachments={attachments}
          onRemove={removeAttachment}
          variant={variant}
        />
      )}

      {/* Image attachments (always visible if any exist) */}
      {features.photos && imageAttachments.length > 0 && (
        <ImageAttachmentGrid
          attachments={imageAttachments}
          onRemove={removeImage}
          onScanResult={onScanResult}
          variant={variant}
        />
      )}

      {/* Extras toolbar */}
      {hasAnyFeature && (
        <div className="space-y-3">
          {extrasAvailable ? (
            <>
              <div className="flex flex-wrap gap-2">
                {features.audio && (
                  <button
                    type="button"
                    onClick={() => toggleSection('audio')}
                    className={`${toolbarBtnBase} ${expanded === 'audio' ? toolbarBtnActive : ''}`}
                    aria-expanded={expanded === 'audio'}
                  >
                    <Mic className="w-4 h-4 text-red-500" aria-hidden="true" />
                    Audio
                    {expanded === 'audio'
                      ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                  </button>
                )}
                {features.photos && (
                  <button
                    type="button"
                    onClick={() => toggleSection('photos')}
                    className={`${toolbarBtnBase} ${expanded === 'photos' ? toolbarBtnActive : ''}`}
                    aria-expanded={expanded === 'photos'}
                  >
                    <ImagePlus className="w-4 h-4 text-sky-500" aria-hidden="true" />
                    Photos
                    {expanded === 'photos'
                      ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                  </button>
                )}
                {features.media && (
                  <button
                    type="button"
                    onClick={() => toggleSection('media')}
                    className={`${toolbarBtnBase} ${expanded === 'media' ? toolbarBtnActive : ''}`}
                    aria-expanded={expanded === 'media'}
                  >
                    <Paperclip className="w-4 h-4" aria-hidden="true" />
                    Media
                    {expanded === 'media'
                      ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                  </button>
                )}
                {features.activityLinks && (
                  <button
                    type="button"
                    onClick={() => toggleSection('links')}
                    className={`${toolbarBtnBase} ${expanded === 'links' ? toolbarBtnActive : ''}`}
                    aria-expanded={expanded === 'links'}
                  >
                    <Link2 className="w-4 h-4" aria-hidden="true" />
                    Links
                    {expanded === 'links'
                      ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                  </button>
                )}
                {features.lifeCategories && (
                  <button
                    type="button"
                    onClick={() => toggleSection('categories')}
                    className={`${toolbarBtnBase} ${expanded === 'categories' ? toolbarBtnActive : ''}`}
                    aria-expanded={expanded === 'categories'}
                  >
                    <Tags className="w-4 h-4" aria-hidden="true" />
                    Tags
                    {expanded === 'categories'
                      ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                  </button>
                )}
              </div>

              {/* Expanded sections */}
              {expanded === 'audio' && features.audio && (
                <div className={`rounded-xl border p-4 ${sectionBg}`}>
                  <AudioRecorder
                    onUploaded={handleAudioUploaded}
                    onRemoved={handleAudioRemoved}
                    compact={audioCompact}
                    maxDuration={audioMaxDuration}
                    autoUpload={audioAutoUpload}
                    variant={variant}
                  />
                </div>
              )}

              {expanded === 'photos' && features.photos && (
                <div className={`rounded-xl border p-4 ${sectionBg}`}>
                  <ImageAttachmentPicker
                    onUploaded={handleImageUploaded}
                    maxImages={maxPhotos}
                    currentCount={imageAttachments.length}
                    variant={variant}
                  />
                </div>
              )}

              {expanded === 'media' && features.media && (
                <div className={`rounded-xl border p-4 ${sectionBg}`}>
                  <MediaUploader
                    onUpload={onMediaUpload || (() => {})}
                    onRemove={onMediaRemove}
                    currentUrl={currentMediaUrl}
                    dark={dark}
                  />
                </div>
              )}

              {expanded === 'links' && features.activityLinks && entityId && (
                <div className={`rounded-xl border p-4 ${sectionBg}`}>
                  <ActivityLinker
                    entityType={entityType as 'daily_log' | 'blog_post' | 'recipe' | 'focus_session' | 'task' | 'workout' | 'equipment' | 'trip'}
                    entityId={entityId}
                  />
                </div>
              )}

              {expanded === 'categories' && features.lifeCategories && entityId && (
                <div className={`rounded-xl border p-4 ${sectionBg}`}>
                  <LifeCategoryTagger
                    entityType={entityType as 'daily_log' | 'blog_post' | 'recipe' | 'focus_session' | 'task' | 'workout' | 'equipment' | 'trip'}
                    entityId={entityId}
                  />
                </div>
              )}
            </>
          ) : (
            entityId === null && (
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                Save first to add audio, photos, links, and tags
              </p>
            )
          )}
        </div>
      )}

      {/* Save button */}
      {!hideSaveButton && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saveDisabled}
            className={`w-full flex items-center justify-center px-6 py-4 rounded-lg text-lg font-semibold transition ${
              saved
                ? 'bg-lime-600 text-white'
                : dark
                  ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
                  : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saved ? (
              <>
                <CheckCircle className="w-6 h-6 mr-2" aria-hidden="true" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-6 h-6 mr-2" aria-hidden="true" />
                {saving ? 'Saving...' : saveLabel}
              </>
            )}
          </button>
          {error && (
            <p className="text-sm text-red-600 text-center" role="alert">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
