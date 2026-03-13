import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Eye, X, FileText, Film } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Combobox } from '../../components/ui/Combobox';
import { useToast } from '../../components/ui/Toast';
import { truncate } from '../../lib/utils';

type MediaType = 'image' | 'video' | 'document';

const ACCEPTED_TYPES = 'image/jpeg,image/png,video/mp4,video/quicktime,application/pdf';

const SIZE_LIMITS: Record<MediaType, number> = {
  image: 5 * 1024 * 1024,      // 5MB
  document: 10 * 1024 * 1024,  // 10MB
  video: 100 * 1024 * 1024,    // 100MB
};

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'image';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DRAFT_KEY = 'leegality-new-post-draft';

export function PostFormPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [campaignTag, setCampaignTag] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('draft');
  const [media, setMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  useEffect(() => {
    api.get('/api/posts/campaigns').then(setCampaigns).catch(() => {});
  }, []);

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.caption || draft.campaignTag || draft.scheduledFor) {
          setShowRestoreBanner(true);
        }
      }
    } catch {}
  }, []);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        setCaption(draft.caption || '');
        setMediaTitle(draft.mediaTitle || '');
        setCampaignTag(draft.campaignTag || '');
        setScheduledFor(draft.scheduledFor || '');
        setDeadline(draft.deadline || '');
        setStatus(draft.status || 'draft');
        toast('Draft restored');
      }
    } catch {}
    setShowRestoreBanner(false);
  };

  const dismissDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowRestoreBanner(false);
  };

  // Auto-save every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (caption || campaignTag || scheduledFor || deadline) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ caption, mediaTitle, campaignTag, scheduledFor, deadline, status }));
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [caption, mediaTitle, campaignTag, scheduledFor, deadline, status]);

  const handleMediaChange = (file: File) => {
    const type = getMediaType(file.type);
    const limit = SIZE_LIMITS[type];
    const limitMB = limit / (1024 * 1024);

    if (file.size > limit) {
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} files must be under ${limitMB}MB`, 'error');
      return;
    }

    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/jpg',
      'video/mp4', 'video/quicktime',
      'application/pdf',
    ];
    if (!allowedMimes.includes(file.type)) {
      toast('Only JPG, PNG, MP4, MOV, and PDF files are allowed', 'error');
      return;
    }

    setMedia(file);
    setMediaType(type);

    if (type === 'image' || type === 'video') {
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null); // PDF — no blob preview needed
    }
  };

  const clearMedia = () => {
    setMedia(null);
    setMediaPreview(null);
    setMediaType('image');
    setMediaTitle('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleMediaChange(file);
  };

  const handleSubmit = async () => {
    if (!caption.trim()) return toast('Caption is required', 'error');
    if (!media) return toast('Media file is required', 'error');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption.trim());
      formData.append('media', media);
      if (mediaTitle.trim() && mediaType !== 'image') formData.append('mediaTitle', mediaTitle.trim());
      if (campaignTag.trim()) formData.append('campaignTag', campaignTag.trim());
      if (scheduledFor) formData.append('scheduledFor', scheduledFor);
      if (deadline) formData.append('deadline', deadline);
      formData.append('status', status);

      const post = await api.upload('/api/posts', formData);
      localStorage.removeItem(DRAFT_KEY);
      toast('Post created successfully');
      navigate(`/marketing/posts/${post.id}`);
    } catch (err: any) {
      toast(err.message || 'Failed to create post', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Render the media preview for the upload area */
  const renderUploadPreview = () => {
    if (!media) return null;

    return (
      <div className="relative rounded-xl overflow-hidden border border-navy-200">
        {mediaType === 'image' && mediaPreview && (
          <img src={mediaPreview} alt="Preview" className="w-full aspect-[1.91/1] object-cover" />
        )}
        {mediaType === 'video' && mediaPreview && (
          <video src={mediaPreview} controls className="w-full aspect-video bg-black rounded-xl" />
        )}
        {mediaType === 'document' && (
          <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
            <FileText size={48} className="text-red-400" />
            <p className="text-sm font-medium text-navy-700">{media.name}</p>
            <p className="text-xs text-navy-400">{formatSize(media.size)}</p>
          </div>
        )}
        <button
          onClick={clearMedia}
          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg hover:bg-white shadow cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  /** Render media in the LinkedIn preview panel */
  const renderLinkedInPreview = () => {
    if (mediaType === 'image' && mediaPreview) {
      return <img src={mediaPreview} alt="Preview" className="w-full aspect-[1.91/1] object-cover border-t border-navy-100" />;
    }
    if (mediaType === 'video' && mediaPreview) {
      return (
        <div className="border-t border-navy-100">
          <video src={mediaPreview} controls className="w-full aspect-video bg-black" />
          {mediaTitle && (
            <div className="bg-navy-800 px-3 py-2">
              <p className="text-xs text-white font-medium truncate">{mediaTitle}</p>
            </div>
          )}
        </div>
      );
    }
    if (mediaType === 'document' && media) {
      return (
        <div className="border-t border-navy-100">
          {mediaTitle && (
            <div className="bg-white px-3 py-2 border-b border-navy-100">
              <p className="text-sm font-semibold text-navy-800 truncate">{mediaTitle}</p>
            </div>
          )}
          <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
            <FileText size={40} className="text-red-400" />
            <p className="text-sm font-medium text-navy-700">{media.name}</p>
            <p className="text-[10px] text-navy-400 uppercase tracking-wide">PDF Document</p>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full aspect-[1.91/1] bg-navy-50 border-t border-navy-100 flex items-center justify-center">
        <p className="text-sm text-navy-300">Media preview</p>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Create New Post</h1>

      {showRestoreBanner && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-800">You have an unsaved draft. Would you like to restore it?</p>
          <div className="flex items-center gap-2">
            <button onClick={restoreDraft} className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 cursor-pointer transition-colors">
              Restore
            </button>
            <button onClick={dismissDraft} className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 cursor-pointer transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-5">
          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Post Media</label>
            {media ? (
              renderUploadPreview()
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-navy-200 rounded-xl p-8 text-center cursor-pointer hover:border-accent-400 hover:bg-accent-50/30 transition-colors"
              >
                <Upload size={32} className="mx-auto text-navy-300 mb-3" />
                <p className="text-sm text-navy-500">Drag & drop or click to upload</p>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="text-xs text-navy-300">📷 JPG/PNG (5MB)</span>
                  <span className="text-xs text-navy-300">🎬 MP4/MOV (100MB)</span>
                  <span className="text-xs text-navy-300">📄 PDF (10MB)</span>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMediaChange(e.target.files[0])}
            />
          </div>

          {/* Media Title — only for videos and documents */}
          {media && mediaType !== 'image' && (
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-2">
                Media Title
                <span className="ml-1 text-xs font-normal text-navy-400">
                  — headline shown on the {mediaType === 'video' ? 'video' : 'document'} on LinkedIn
                </span>
              </label>
              <input
                type="text"
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                maxLength={400}
                placeholder={mediaType === 'document' ? 'e.g. "3 mistakes that make eStamps non-compliant"' : 'e.g. "Watch: How Leegality simplifies eStamping"'}
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
              <p className="text-xs text-navy-300 mt-1 text-right">{mediaTitle.length}/400</p>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="Write your LinkedIn post caption here..."
              className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 resize-none"
            />
            <p className="text-xs text-navy-300 mt-1 text-right">{caption.length}/3000</p>
          </div>

          {/* Campaign Tag */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Campaign Tag (optional)</label>
            <Combobox
              options={campaigns}
              value={campaignTag}
              onChange={setCampaignTag}
              placeholder="e.g. eStamping Launch, Webinar Apr"
              allowCustom
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Schedule Date (optional)</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">
              Deadline (optional)
              <span className="ml-1 text-xs font-normal text-navy-400">
                — pending assignments auto-skip after this
              </span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Status</label>
            <div className="flex gap-3">
              {['draft', 'active'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
                    status === s
                      ? 'bg-accent-500 text-white'
                      : 'bg-white text-navy-600 border border-navy-200 hover:bg-navy-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : 'Create Post'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/marketing/posts')}>
              Cancel
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <div className="flex items-center gap-2 mb-3 text-sm text-navy-500">
            <Eye size={16} />
            <span className="font-medium">LinkedIn Preview</span>
          </div>
          <div className="bg-white rounded-xl border border-navy-200 overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-navy-200" />
                <div>
                  <p className="text-sm font-semibold text-navy-800">Sales Rep Name</p>
                  <p className="text-xs text-navy-400">Title at Leegality</p>
                </div>
              </div>
              <p className="text-sm text-navy-700 whitespace-pre-wrap leading-relaxed">
                {caption || 'Your caption will appear here...'}
              </p>
            </div>
            {renderLinkedInPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
