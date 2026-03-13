import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, ExternalLink as ExternalLinkIcon, FileText, Pencil, Copy } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/utils';

interface Assignment {
  id: string;
  status: string;
  assignedAt: string;
  postedAt: string | null;
  skipReason: string | null;
  skipNotes: string | null;
  rep: { id: string; name: string; email: string; profilePicUrl: string | null };
}

interface Post {
  id: string;
  caption: string;
  imageUrl: string;
  mediaType: string;
  campaignTag: string | null;
  status: string;
  scheduledFor: string | null;
  deadline: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
  assignments: Assignment[];
}

interface Rep {
  id: string;
  name: string;
  email: string;
  profilePicUrl: string | null;
}

export function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [reps, setReps] = useState<Rep[]>([]);
  const [selectedReps, setSelectedReps] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const fetchPost = async () => {
    try {
      const data = await api.get(`/api/posts/${id}`);
      setPost(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPost(); }, [id]);

  const openAssignModal = async () => {
    const allReps = await api.get('/api/reps');
    setReps(allReps);
    const assigned = new Set(post?.assignments.map((a) => a.rep.id) || []);
    setSelectedReps(assigned);
    setShowAssign(true);
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      const currentAssigned = new Set(post?.assignments.map((a) => a.rep.id) || []);
      const newReps = [...selectedReps].filter((id) => !currentAssigned.has(id));
      if (newReps.length === 0) {
        toast('No new reps to assign', 'info');
        setShowAssign(false);
        return;
      }
      await api.post(`/api/posts/${id}/assign`, { repIds: newReps });
      toast(`Assigned to ${newReps.length} rep(s)`);
      setShowAssign(false);
      fetchPost();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  };

  const assignAll = async () => {
    setAssigning(true);
    try {
      const result = await api.post(`/api/posts/${id}/assign`, { repIds: 'all' });
      toast(`Assigned to ${result.newCount} new rep(s)`);
      setShowAssign(false);
      fetchPost();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const dup = await api.post(`/api/posts/${id}/duplicate`);
      toast('Post duplicated as draft');
      navigate(`/marketing/posts/${dup.id}/edit`);
    } catch (err: any) {
      toast(err.message || 'Duplication failed', 'error');
    }
  };

  const toggleStatus = async (newStatus: string) => {
    await api.put(`/api/posts/${id}`, { status: newStatus });
    toast(`Post ${newStatus === 'active' ? 'activated' : 'archived'}`);
    fetchPost();
  };

  if (loading) return <PageLoader />;
  if (!post) return <p>Post not found</p>;

  const statusVariant = post.status === 'active' ? 'success' : post.status === 'draft' ? 'neutral' : 'danger';
  const assignmentStatusVariant = (s: string) => s === 'posted' ? 'success' : s === 'skipped' ? 'danger' : 'warning';

  return (
    <div>
      <button onClick={() => navigate('/marketing/posts')} className="flex items-center gap-1 text-sm text-navy-400 hover:text-navy-600 mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Back to Posts
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Post Content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
            {(post.mediaType || 'image') === 'video' ? (
              <div>
                <video src={`/uploads/${post.imageUrl}`} controls className="w-full aspect-video bg-black" />
                {post.mediaTitle && (
                  <div className="bg-navy-800 px-4 py-2">
                    <p className="text-xs text-white font-medium">{post.mediaTitle}</p>
                  </div>
                )}
              </div>
            ) : (post.mediaType || 'image') === 'document' ? (
              <div>
                {post.mediaTitle && (
                  <div className="px-4 py-2.5 bg-white border-b border-navy-100">
                    <p className="text-sm font-semibold text-navy-800">{post.mediaTitle}</p>
                  </div>
                )}
                <iframe
                  src={`/uploads/${post.imageUrl}`}
                  className="w-full aspect-[4/3] border-0"
                  title="PDF Preview"
                />
                <div className="px-4 py-2 bg-navy-50 border-t border-navy-100 flex items-center justify-between">
                  <span className="text-xs text-navy-400 flex items-center gap-1">
                    <FileText size={12} /> PDF Document
                  </span>
                  <a
                    href={`/uploads/${post.imageUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-600 hover:text-accent-700 flex items-center gap-1"
                  >
                    Open in new tab <ExternalLinkIcon size={10} />
                  </a>
                </div>
              </div>
            ) : (
              <img src={`/uploads/${post.imageUrl}`} alt="" className="w-full aspect-[1.91/1] object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={statusVariant}>{post.status}</Badge>
                {post.campaignTag && <Badge variant="info">{post.campaignTag}</Badge>}
              </div>
              <p className="text-sm text-navy-700 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
              <div className="mt-4 pt-4 border-t border-navy-100 flex items-center justify-between text-xs text-navy-400">
                <span>Created by {post.createdBy.name} on {formatDate(post.createdAt)}</span>
                {post.scheduledFor && <span>Scheduled: {formatDate(post.scheduledFor)}</span>}
                {post.deadline && <span className="text-red-500">Deadline: {formatDate(post.deadline)}</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link to={`/marketing/posts/${post.id}/edit`}>
              <Button variant="secondary"><Pencil size={14} /> Edit</Button>
            </Link>
            <Button variant="secondary" onClick={handleDuplicate}>
              <Copy size={14} /> Duplicate
            </Button>
            {post.status === 'draft' && (
              <Button onClick={() => toggleStatus('active')}>Activate Post</Button>
            )}
            {post.status === 'active' && (
              <Button variant="ghost" onClick={() => toggleStatus('archived')}>Archive</Button>
            )}
            <a
              href={`/og/post/${post.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-sm text-accent-600 hover:text-accent-700 px-3 py-2"
            >
              <ExternalLinkIcon size={14} /> View OG Page
            </a>
          </div>
        </div>

        {/* Assignments Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-navy-900">Assignments</h2>
              <Button size="sm" onClick={openAssignModal}>
                <UserPlus size={14} /> Assign
              </Button>
            </div>

            {post.assignments.length === 0 ? (
              <p className="text-sm text-navy-400">No reps assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {post.assignments.map((a) => (
                  <div key={a.id}>
                    <div className="flex items-center gap-3">
                      {a.rep.profilePicUrl ? (
                        <img src={a.rep.profilePicUrl} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 text-xs font-medium">
                          {a.rep.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-800 truncate">{a.rep.name}</p>
                        <p className="text-xs text-navy-400">{formatDate(a.assignedAt)}</p>
                      </div>
                      <Badge variant={assignmentStatusVariant(a.status)}>{a.status}</Badge>
                    </div>
                    {a.status === 'skipped' && a.skipReason && (
                      <div className="ml-11 mt-1 text-xs text-navy-400">
                        <span className="font-medium text-navy-500">Reason:</span> {a.skipReason}
                        {a.skipNotes && <p className="mt-0.5 italic">{a.skipNotes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <h3 className="font-semibold text-navy-900 mb-3">Stats</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">
                  {post.assignments.filter((a) => a.status === 'posted').length}
                </p>
                <p className="text-xs text-navy-400">Posted</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">
                  {post.assignments.filter((a) => a.status === 'pending').length}
                </p>
                <p className="text-xs text-navy-400">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">
                  {post.assignments.filter((a) => a.status === 'skipped').length}
                </p>
                <p className="text-xs text-navy-400">Skipped</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign to Reps">
        <div className="mb-4">
          <Button size="sm" variant="secondary" onClick={assignAll} disabled={assigning}>
            Assign to All Reps
          </Button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {reps.map((rep) => {
            const alreadyAssigned = post?.assignments.some((a) => a.rep.id === rep.id);
            return (
              <label key={rep.id} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-navy-50 cursor-pointer ${alreadyAssigned ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedReps.has(rep.id)}
                  disabled={alreadyAssigned}
                  onChange={(e) => {
                    const next = new Set(selectedReps);
                    e.target.checked ? next.add(rep.id) : next.delete(rep.id);
                    setSelectedReps(next);
                  }}
                  className="rounded accent-accent-500"
                />
                <span className="text-sm text-navy-700">{rep.name}</span>
                <span className="text-xs text-navy-400">{rep.email}</span>
                {alreadyAssigned && <Badge variant="neutral">Assigned</Badge>}
              </label>
            );
          })}
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t border-navy-100">
          <Button onClick={handleAssign} disabled={assigning}>
            {assigning ? 'Assigning...' : 'Assign Selected'}
          </Button>
          <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
