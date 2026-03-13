import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Send, SkipForward, Loader2, RefreshCw, ExternalLink, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

const SKIP_REASONS = [
  'Not relevant to my audience',
  'Caption needs work',
  'Already posted similar content',
  'Other',
];

interface AssignmentDetail {
  id: string;
  status: string;
  assignedAt: string;
  postedAt: string | null;
  post: {
    id: string;
    caption: string;
    imageUrl: string;
    mediaType: string;
    campaignTag: string | null;
    deadline: string | null;
  };
}

export function PostViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showRepostConfirm, setShowRepostConfirm] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [skipNotes, setSkipNotes] = useState('');
  const [skipping, setSkipping] = useState(false);

  const fetchAssignment = () => {
    api.get(`/api/queue/${id}`).then(setAssignment).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const handlePublish = () => {
    setShowConfirm(true);
  };

  const confirmPublish = async () => {
    if (!assignment) return;
    setPublishing(true);
    try {
      await api.post(`/api/queue/${id}/publish`);
      toast('Posted to LinkedIn successfully!');
      navigate('/rep/queue');
    } catch (err: any) {
      const msg = err?.error || 'Failed to publish. Please try again.';
      toast(msg, 'error');
      setPublishing(false);
      setShowConfirm(false);
    }
  };

  const handleSkip = () => {
    setShowSkipModal(true);
  };

  const confirmSkip = async () => {
    setSkipping(true);
    try {
      await api.post(`/api/queue/${id}/skip`, {
        reason: skipReason || null,
        notes: skipNotes.trim() || null,
      });
      toast('Post skipped', 'info');
      navigate('/rep/queue');
    } catch (err: any) {
      toast(err.message || 'Failed to skip', 'error');
    } finally {
      setSkipping(false);
    }
  };

  const confirmRepost = async () => {
    if (!assignment) return;
    setReposting(true);
    try {
      await api.post(`/api/queue/${id}/repost`);
      toast('Reposted to LinkedIn successfully!');
      setShowRepostConfirm(false);
      setLoading(true);
      fetchAssignment();
    } catch (err: any) {
      const msg = err?.error || 'Failed to repost. Please try again.';
      toast(msg, 'error');
    } finally {
      setReposting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!assignment) return <p className="text-center text-navy-400 mt-8">Assignment not found</p>;

  const isPosted = assignment.status === 'posted';
  const mType = assignment.post.mediaType || 'image';

  /** Render media based on type */
  const renderMedia = () => {
    const src = `/uploads/${assignment.post.imageUrl}`;

    if (mType === 'video') {
      return (
        <div className="rounded-xl overflow-hidden border border-navy-100 mb-4">
          <video src={src} controls className="w-full aspect-video bg-black" />
        </div>
      );
    }

    if (mType === 'document') {
      return (
        <div className="rounded-xl overflow-hidden border border-navy-100 mb-4">
          <iframe
            src={src}
            className="w-full aspect-[4/3] border-0"
            title="PDF Preview"
          />
          <div className="px-4 py-2 bg-navy-50 border-t border-navy-100 flex items-center justify-between">
            <span className="text-xs text-navy-400 flex items-center gap-1">
              <FileText size={12} /> PDF Document
            </span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-600 hover:text-accent-700 flex items-center gap-1"
            >
              Open in new tab <ExternalLink size={10} />
            </a>
          </div>
        </div>
      );
    }

    // Default: image
    return (
      <div className="rounded-xl overflow-hidden border border-navy-100 mb-4">
        <img src={src} alt="" className="w-full aspect-[1.91/1] object-cover" />
      </div>
    );
  };

  const mediaLabel = mType === 'video' ? 'video' : mType === 'document' ? 'document' : 'image';

  return (
    <div>
      <button
        onClick={() => navigate('/rep/queue')}
        className="flex items-center gap-1 text-sm text-navy-400 hover:text-navy-600 mb-4 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to Queue
      </button>

      {/* Media */}
      {renderMedia()}

      {/* Deadline warning */}
      {assignment.post.deadline && assignment.status === 'pending' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-center">
          <p className="text-sm text-red-600">
            Deadline: {new Date(assignment.post.deadline).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {/* Campaign tag */}
      {assignment.post.campaignTag && (
        <div className="mb-3">
          <Badge variant="info">{assignment.post.campaignTag}</Badge>
        </div>
      )}

      {/* Caption preview */}
      <div className="bg-white rounded-xl border border-navy-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-navy-400 uppercase tracking-wide">Post Caption</span>
        </div>
        <p className="text-sm text-navy-700 whitespace-pre-wrap leading-relaxed">
          {assignment.post.caption}
        </p>
      </div>

      {/* Actions */}
      {isPosted ? (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700">You've shared this post!</p>
          </div>

          {/* Repost section */}
          {!showRepostConfirm ? (
            <div className="mt-3">
              <Button
                size="md"
                variant="secondary"
                className="w-full"
                onClick={() => setShowRepostConfirm(true)}
              >
                <RefreshCw size={16} /> Repost to LinkedIn
              </Button>
              <p className="text-xs text-navy-400 text-center mt-1.5">
                Use this if the post was removed from your profile
              </p>
            </div>
          ) : (
            <div className="bg-white border border-navy-200 rounded-xl p-5 text-center mt-3">
              <p className="text-sm font-medium text-navy-800 mb-1">
                Repost this content?
              </p>
              <p className="text-xs text-navy-400 mb-4">
                This will publish the {mediaLabel} and caption to your LinkedIn feed again.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={confirmRepost} disabled={reposting}>
                  {reposting ? (
                    <><Loader2 size={16} className="animate-spin" /> Reposting...</>
                  ) : (
                    <><RefreshCw size={16} /> Yes, repost it</>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setShowRepostConfirm(false)} disabled={reposting}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!showConfirm ? (
            <>
              <div className="bg-accent-50 rounded-xl p-4 mb-2">
                <p className="text-sm text-accent-700">
                  This will publish the {mediaLabel} and caption directly to your LinkedIn profile.
                </p>
              </div>
              <Button size="lg" className="w-full" onClick={handlePublish}>
                <Send size={18} /> Post to LinkedIn
              </Button>
              <Button size="md" variant="ghost" className="w-full" onClick={handleSkip}>
                <SkipForward size={16} /> Skip this post
              </Button>
            </>
          ) : (
            <div className="bg-white border border-navy-200 rounded-xl p-5 text-center">
              <p className="text-sm font-medium text-navy-800 mb-1">
                Ready to publish?
              </p>
              <p className="text-xs text-navy-400 mb-4">
                This will post the {mediaLabel} and caption to your LinkedIn feed.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={confirmPublish} disabled={publishing}>
                  {publishing ? (
                    <><Loader2 size={16} className="animate-spin" /> Publishing...</>
                  ) : (
                    <><CheckCircle size={16} /> Yes, publish it</>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={publishing}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip Feedback Modal */}
      <Modal isOpen={showSkipModal} onClose={() => setShowSkipModal(false)} title="Skip this post?">
        <p className="text-sm text-navy-500 mb-4">
          Help us improve — let us know why you're skipping this post.
        </p>
        <div className="space-y-2 mb-4">
          {SKIP_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                skipReason === reason
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-navy-200 hover:bg-navy-50'
              }`}
            >
              <input
                type="radio"
                name="skipReason"
                value={reason}
                checked={skipReason === reason}
                onChange={() => setSkipReason(reason)}
                className="accent-accent-500"
              />
              <span className="text-sm text-navy-700">{reason}</span>
            </label>
          ))}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-navy-700 mb-1">
            Additional notes (optional)
          </label>
          <textarea
            value={skipNotes}
            onChange={(e) => setSkipNotes(e.target.value)}
            rows={3}
            placeholder="Any specific feedback..."
            className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-2 border-t border-navy-100">
          <Button onClick={confirmSkip} disabled={skipping}>
            {skipping ? 'Skipping...' : 'Skip Post'}
          </Button>
          <Button variant="ghost" onClick={() => setShowSkipModal(false)} disabled={skipping}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
