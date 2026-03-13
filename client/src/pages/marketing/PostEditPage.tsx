import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Eye, X, FileText, Film, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Combobox } from '../../components/ui/Combobox';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { truncate } from '../../lib/utils';

type MediaType = 'image' | 'video' | 'document';

const ACCEPTED_TYPES = 'image/jpeg,image/png,video/mp4,video/quicktime,application/pdf';

const SIZE_LIMITS: Record<MediaType, number> = {
  image: 5 * 1024 * 1024,
  document: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
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

export function PostEditPage() {
  const { id } = useParams();
  const EDIT_DRAFT_KEY = `leegality-edit-draft-${id}`;
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [campaignTag, setCampaignTag] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('draft');
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  // Existing media from the server
  const [existingMediaUrl, setExistingMediaUrl] = useState('');
  const [existingMediaType, setExistingMediaType] = useState<MediaType>('image');

  // New media (if user picks a replacement)
  const [newMedia, setNewMedia] = useState<File | null>(null);
  const [newMediaPreview, setNewMediaPreview] = useState<string | null>(null);
  const [newMediaType, setNewMediaType] = useState<MediaType>('image');

  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<string[]>([]);

  // Whether we're showing new media or existing
  const hasNewMedia = newMedia !== null;
  const activeMediaType = hasNewMedia ? newMediaType : existingMediaType;

  useEffect(() => {
    api.get('/api/posts/campaigns').then(setCampaigns).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const post = await api.get(`/api/posts/${id}`);
        setCaption(post.caption || '');
        setMediaTitle(post.mediaTitle || '');
        setCampaignTag(post.campaignTag || '');
        setStatus(post.status || 'draft');
        setExistingMediaUrl(post.imageUrl || '');
        setExistingMediaType((post.mediaType as MediaType) || 'image');

        if (post.scheduledFor) {
          const dt = new Date(post.scheduledFor);
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setScheduledFor(local);
        }

        if (post.deadline) {
          const dt = new Date(post.deadline);
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setDeadline(local);
        }

        // Check for a saved edit draft
        try {
          const saved = localStorage.getItem(EDIT_DRAFT_KEY);
          if (saved) {
            const draft = JSON.parse(saved);
            if (draft.caption !== post.caption || draft.campaignTag !== (post.campaignTag || '')) {
              setShowRestoreBanner(true);
            }
          }
        } catch {}
      } catch {
        toast('Failed to load post', 'error');
        navigate('/marketing/posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(EDIT_DRAFT_KEY);
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
    localStorage.removeItem(EDIT_DRAFT_KEY);
    setShowRestoreBanner(false);
  };

  // Auto-save every 15 seconds
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      if (caption || campaignTag || scheduledFor || deadline) {
        localStorage.setItem(EDIT_DRAFT_KEY, JSON.stringify({ caption, mediaTitle, campaignTag, scheduledFor, deadline, status }));
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [caption, mediaTitle, campaignTag, scheduledFor, deadline, status, loading]);

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

    setNewMedia(file);
    setNewMediaType(type);

    if (type === 'image' || type === 'video') {
      setNewMediaPreview(URL.createObjectURL(file));
    } else {
      setNewMediaPreview(null);
    }
  };

  const clearNewMedia = () => {
    setNewMedia(null);
    setNewMediaPreview(null);
    setNewMediaType('image');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleMediaChange(file);
  };

  const handleSubmit = async () => {
    if (!caption.trim()) return toast('Caption is required', 'error');

    setSaving(true);
    try {
      // 1. Update text fields
      await api.put(`/api/posts/${id}`, {
        caption: caption.trim(),
        mediaTitle: (activeMediaType !== 'image' && mediaTitle.trim()) ? mediaTitle.trim() : null,
        campaignTag: campaignTag.trim() || null,
        scheduledFor: scheduledFor || null,
        deadline: deadline || null,
        status,
      });

      // 2. If new media was selected, upload it
      if (newMedia) {
        const formData = new FormData();
        formData.append('media', newMedia);
        await api.upload(`/api/posts/${id}/media`, formData);
      }

      localStorage.removeItem(EDIT_DRAFT_KEY);
      toast('Post updated successfully');
      navigate(`/marketing/posts/${id}`);
    } catch (err: any) {
      toast(err.message || 'Failed to update post', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Render the media area — show new media if picked, otherwise existing */
  const renderMediaArea = () => {
    if (hasNewMedia) {
      return (
        <div className="relative rounded-xl overflow-hidden border border-navy-200">
          {newMediaType === 'image' && newMediaPreview && (
            <img src={newMediaPreview} alt="Preview" className="w-full aspect-[1.91/1] object-cover" />
          )}
          {newMediaType === 'video' && newMediaPreview && (
            <video src={newMediaPreview} controls className="w-full aspect-video bg-black rounded-xl" />
          )}
          {newMediaType === 'document' && newMedia && (
            <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
              <FileText size={48} className="text-red-400" />
              <p className="text-sm font-medium text-navy-700">{newMedia.name}</p>
              <p className="text-xs text-navy-400">{formatSize(newMedia.size)}</p>
            </div>
          )}
          <button
            onClick={clearNewMedia}
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg hover:bg-white shadow cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-2 left-2 bg-accent-500 text-white text-[10px] font-medium px-2 py-0.5 rounded">
            New
          </div>
        </div>
      );
    }

    // Show existing media with a "Replace" overlay
    return (
      <div className="relative rounded-xl overflow-hidden border border-navy-200 group">
        {existingMediaType === 'image' && (
          <img src={`/uploads/${existingMediaUrl}`} alt="" className="w-full aspect-[1.91/1] object-cover" />
        )}
        {existingMediaType === 'video' && (
          <div className="w-full aspect-video bg-navy-900 flex items-center justify-center">
            <video src={`/uploads/${existingMediaUrl}`} controls className="w-full h-full" />
          </div>
        )}
        {existingMediaType === 'document' && (
          <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
            <FileText size={48} className="text-red-400" />
            <p className="text-xs text-navy-400">PDF Document</p>
          </div>
        )}
        <div
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          <div className="bg-white rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-sm font-medium text-navy-700">
            <Upload size={16} /> Replace Media
          </div>
        </div>
      </div>
    );
  };

  /** LinkedIn preview panel */
  const renderLinkedInPreview = () => {
    // Use new media preview if available, otherwise existing
    if (hasNewMedia) {
      if (newMediaType === 'image' && newMediaPreview) {
        return <img src={newMediaPreview} alt="Preview" className="w-full aspect-[1.91/1] object-cover border-t border-navy-100" />;
      }
      if (newMediaType === 'video' && newMediaPreview) {
        return (
          <div className="border-t border-navy-100">
            <video src={newMediaPreview} controls className="w-full aspect-video bg-black" />
            {mediaTitle && (
              <div className="bg-navy-800 px-3 py-2">
                <p className="text-xs text-white font-medium truncate">{mediaTitle}</p>
              </div>
            )}
          </div>
        );
      }
      if (newMediaType === 'document' && newMedia) {
        return (
          <div className="border-t border-navy-100">
            {mediaTitle && (
              <div className="bg-white px-3 py-2 border-b border-navy-100">
                <p className="text-sm font-semibold text-navy-800 truncate">{mediaTitle}</p>
              </div>
            )}
            <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
              <FileText size={40} className="text-red-400" />
              <p className="text-sm font-medium text-navy-700">{newMedia.name}</p>
              <p className="text-[10px] text-navy-400 uppercase tracking-wide">PDF Document</p>
            </div>
          </div>
        );
      }
    }

    // Existing media
    if (existingMediaType === 'image' && existingMediaUrl) {
      return <img src={`/uploads/${existingMediaUrl}`} alt="" className="w-full aspect-[1.91/1] object-cover border-t border-navy-100" />;
    }
    if (existingMediaType === 'video' && existingMediaUrl) {
      return (
        <div className="border-t border-navy-100">
          <video src={`/uploads/${existingMediaUrl}`} controls className="w-full aspect-video bg-black" />
          {mediaTitle && (
            <div className="bg-navy-800 px-3 py-2">
              <p className="text-xs text-white font-medium truncate">{mediaTitle}</p>
            </div>
          )}
        </div>
      );
    }
    if (existingMediaType === 'document' && existingMediaUrl) {
      return (
        <div className="border-t border-navy-100">
          {mediaTitle && (
            <div className="bg-white px-3 py-2 border-b border-navy-100">
              <p className="text-sm font-semibold text-navy-800 truncate">{mediaTitle}</p>
            </div>
          )}
          <div className="w-full aspect-[1.91/1] bg-red-50 flex flex-col items-center justify-center gap-2">
            <FileText size={40} className="text-red-400" />
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

  if (loading) return <PageLoader />;

  return (
    <div>
      <button
        onClick={() => navigate(`/marketing/posts/${id}`)}
        className="flex items-center gap-1 text-sm text-navy-400 hover:text-navy-600 mb-4 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to Post
      </button>

      <h1 className="text-2xl font-bold text-navy-900 mb-6">Edit Post</h1>

      {showRestoreBanner && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-800">You have unsaved changes from a previous edit session. Restore?</p>
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
          {/* Media */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Post Media</label>
            {renderMediaArea()}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMediaChange(e.target.files[0])}
            />
          </div>

          {/* Media Title — only for videos and documents */}
          {activeMediaType !== 'image' && (
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-2">
                Media Title
                <span className="ml-1 text-xs font-normal text-navy-400">
                  — headline shown on the {activeMediaType === 'video' ? 'video' : 'document'} on LinkedIn
                </span>
              </label>
              <input
                type="text"
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                maxLength={400}
                placeholder={activeMediaType === 'document' ? 'e.g. "3 mistakes that make eStamps non-compliant"' : 'e.g. "Watch: How Leegality simplifies eStamping"'}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/marketing/posts/${id}`)}>
              Cancel
            </Button>
          </div>
        </div>

        {/* LinkedIn Preview */}
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
