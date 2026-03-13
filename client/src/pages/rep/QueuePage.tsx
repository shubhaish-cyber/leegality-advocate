import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, FileText, Film, Mail, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { truncate, formatDate } from '../../lib/utils';

interface Assignment {
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
    createdAt: string;
    deadline: string | null;
  };
}

function MediaThumbnail({ post }: { post: Assignment['post'] }) {
  const mType = post.mediaType || 'image';

  if (mType === 'video') {
    return (
      <div className="w-20 h-20 rounded-lg bg-navy-900 flex-shrink-0 flex items-center justify-center">
        <Film size={24} className="text-white" />
      </div>
    );
  }

  if (mType === 'document') {
    return (
      <div className="w-20 h-20 rounded-lg bg-red-50 flex-shrink-0 flex items-center justify-center">
        <FileText size={24} className="text-red-400" />
      </div>
    );
  }

  return (
    <img
      src={`/uploads/${post.imageUrl}`}
      alt=""
      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
    />
  );
}

export function QueuePage() {
  const { user, refetch } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'posted' | 'skipped'>('pending');
  const [workEmail, setWorkEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailDismissed, setEmailDismissed] = useState(false);

  const fetchQueue = () => {
    setLoading(true);
    api.get(`/api/queue?status=${tab}`)
      .then(setAssignments)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQueue(); }, [tab]);

  const showEmailBanner = user && !user.workEmail && !emailDismissed;

  const handleSaveWorkEmail = async () => {
    if (!workEmail.trim()) return;
    setSavingEmail(true);
    try {
      await api.put('/api/queue/profile/work-email', { workEmail: workEmail.trim() });
      await refetch();
    } catch {
      // ignore
    } finally {
      setSavingEmail(false);
    }
  };

  const tabs = [
    { key: 'pending' as const, label: 'Pending' },
    { key: 'posted' as const, label: 'Posted' },
    { key: 'skipped' as const, label: 'Skipped' },
  ];

  return (
    <div>
      {/* Work email prompt */}
      {showEmailBanner && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Mail size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-1">Add your work email</p>
              <p className="text-xs text-blue-600 mb-3">
                This is used to tag you in Zoho Cliq notifications when posts are assigned.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 text-sm border border-blue-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveWorkEmail()}
                />
                <button
                  onClick={handleSaveWorkEmail}
                  disabled={savingEmail || !workEmail.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  {savingEmail ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <button onClick={() => setEmailDismissed(true)} className="text-blue-400 hover:text-blue-600 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-lg p-1 border border-navy-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              tab === t.key
                ? 'bg-accent-500 text-white shadow-sm'
                : 'text-navy-500 hover:text-navy-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<Inbox size={48} />}
          title={tab === 'pending' ? 'All caught up!' : `No ${tab} posts`}
          description={tab === 'pending' ? 'New posts will appear here when marketing assigns them to you.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link
              key={a.id}
              to={`/rep/queue/${a.id}`}
              className="block bg-white rounded-xl border border-navy-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 p-4">
                <MediaThumbnail post={a.post} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.post.campaignTag && (
                      <Badge variant="info">{a.post.campaignTag}</Badge>
                    )}
                    {a.status === 'posted' && <Badge variant="success">Posted</Badge>}
                  </div>
                  <p className="text-sm text-navy-700 leading-relaxed">
                    {truncate(a.post.caption, 100)}
                  </p>
                  <p className="text-xs text-navy-300 mt-1">
                    {a.postedAt ? `Posted ${formatDate(a.postedAt)}` : `Assigned ${formatDate(a.assignedAt)}`}
                  </p>
                  {a.status === 'pending' && a.post.deadline && (
                    <p className="text-xs text-red-400 mt-0.5">
                      Due by {formatDate(a.post.deadline)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
