import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingUp, CheckCircle, XCircle, BarChart3, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/utils';

interface Assignment {
  id: string;
  status: string;
  assignedAt: string;
  postedAt: string | null;
  skipReason: string | null;
  skipNotes: string | null;
  post: {
    id: string;
    caption: string;
    imageUrl: string;
    campaignTag: string | null;
  };
}

interface RepDetail {
  id: string;
  name: string;
  email: string;
  profilePicUrl: string | null;
  isActive: boolean;
  onboardedVia: string | null;
  tokenExpiry: string | null;
  createdAt: string;
  assignments: Assignment[];
}

const statusVariant = (s: string) =>
  s === 'posted' ? 'success' : s === 'skipped' ? 'danger' : 'warning';

export function RepDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rep, setRep] = useState<RepDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const handleDeleteRep = async () => {
    if (!rep) return;
    if (!confirm(`Permanently delete ${rep.name}? This will remove all their assignments too. This cannot be undone.`)) return;
    try {
      await api.delete(`/api/reps/${id}`);
      toast('Rep deleted');
      navigate('/marketing/reps');
    } catch (err: any) {
      toast(err.message || 'Failed to delete rep', 'error');
    }
  };

  useEffect(() => {
    api.get(`/api/reps/${id}`)
      .then(setRep)
      .catch(() => setRep(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!rep) {
    return (
      <div>
        <button onClick={() => navigate('/marketing/reps')} className="flex items-center gap-1 text-sm text-navy-400 hover:text-navy-600 mb-4 cursor-pointer">
          <ArrowLeft size={16} /> Back to Reps
        </button>
        <p className="text-navy-500">Rep not found.</p>
      </div>
    );
  }

  const totalAssigned = rep.assignments.length;
  const posted = rep.assignments.filter((a) => a.status === 'posted').length;
  const skipped = rep.assignments.filter((a) => a.status === 'skipped').length;
  const pending = rep.assignments.filter((a) => a.status === 'pending').length;
  const postRate = totalAssigned > 0 ? Math.round((posted / totalAssigned) * 100) : 0;
  const skipRate = totalAssigned > 0 ? Math.round((skipped / totalAssigned) * 100) : 0;

  // Avg response time (posted only)
  const postedAssignments = rep.assignments.filter((a) => a.status === 'posted' && a.postedAt);
  let avgResponseHours = 0;
  if (postedAssignments.length > 0) {
    const totalMs = postedAssignments.reduce((sum, a) => {
      return sum + (new Date(a.postedAt!).getTime() - new Date(a.assignedAt).getTime());
    }, 0);
    avgResponseHours = Math.round(totalMs / postedAssignments.length / (1000 * 60 * 60));
  }

  const tokenExpired = rep.tokenExpiry ? new Date(rep.tokenExpiry) < new Date() : false;

  // Pagination
  const paginatedAssignments = rep.assignments.slice(0, page * perPage);
  const hasMore = paginatedAssignments.length < rep.assignments.length;

  const stats = [
    { label: 'Total Assigned', value: totalAssigned, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Posted', value: `${posted} (${postRate}%)`, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Skipped', value: `${skipped} (${skipRate}%)`, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Avg Response', value: avgResponseHours > 0 ? `${avgResponseHours}h` : '—', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <div>
      <button onClick={() => navigate('/marketing/reps')} className="flex items-center gap-1 text-sm text-navy-400 hover:text-navy-600 mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Back to Reps
      </button>

      {/* Rep Header */}
      <div className="bg-white rounded-xl border border-navy-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          {rep.profilePicUrl ? (
            <img src={rep.profilePicUrl} alt="" className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 text-xl font-semibold">
              {rep.name.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy-900">{rep.name}</h1>
              <Badge variant={rep.isActive ? 'success' : 'danger'}>
                {rep.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {tokenExpired && <Badge variant="danger">Token Expired</Badge>}
            </div>
            <p className="text-sm text-navy-400 mt-0.5">{rep.email}</p>
            <p className="text-xs text-navy-300 mt-1">Joined {formatDate(rep.createdAt)}</p>
          </div>
          <button
            onClick={handleDeleteRep}
            className="p-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer shrink-0"
            title="Delete rep"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg} ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-navy-900">{value}</p>
                <p className="text-xs text-navy-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment History */}
      <div className="bg-white rounded-xl border border-navy-100">
        <div className="p-5 border-b border-navy-100">
          <h2 className="font-semibold text-navy-900">Assignment History</h2>
          <p className="text-xs text-navy-400 mt-0.5">{totalAssigned} total assignments</p>
        </div>

        {rep.assignments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<TrendingUp size={40} />}
              title="No assignments yet"
              description="This rep hasn't been assigned any posts."
            />
          </div>
        ) : (
          <div className="divide-y divide-navy-100">
            {paginatedAssignments.map((a) => (
              <div key={a.id} className="p-4 hover:bg-navy-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <img
                    src={`/uploads/${a.post.imageUrl}`}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/marketing/posts/${a.post.id}`}
                      className="text-sm font-medium text-navy-800 hover:text-accent-600 truncate block"
                    >
                      {a.post.caption.substring(0, 80)}{a.post.caption.length > 80 ? '...' : ''}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {a.post.campaignTag && (
                        <span className="text-[11px] text-accent-500">{a.post.campaignTag}</span>
                      )}
                      <span className="text-[11px] text-navy-300">
                        Assigned {formatDate(a.assignedAt)}
                      </span>
                      {a.postedAt && (
                        <span className="text-[11px] text-green-500">
                          Posted {formatDate(a.postedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                </div>
                {a.status === 'skipped' && a.skipReason && (
                  <div className="ml-15 mt-2 text-xs text-navy-400 pl-15">
                    <span className="font-medium text-navy-500">Skip reason:</span> {a.skipReason}
                    {a.skipNotes && <p className="mt-0.5 italic">{a.skipNotes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="p-4 border-t border-navy-100 text-center">
            <button
              onClick={() => setPage(page + 1)}
              className="text-sm text-accent-600 hover:text-accent-700 font-medium cursor-pointer"
            >
              Load more ({rep.assignments.length - paginatedAssignments.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
