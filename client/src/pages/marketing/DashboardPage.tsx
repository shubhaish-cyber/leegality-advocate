import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, TrendingUp, CheckCircle, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';

interface Overview {
  totalPosts: number;
  activePosts: number;
  totalReps: number;
  activeReps: number;
  posted: number;
  pending: number;
  completionRate: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  profilePicUrl: string | null;
  postsThisMonth: number;
}

export function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/analytics/overview'),
      api.get('/api/analytics/leaderboard'),
    ]).then(([ov, lb]) => {
      setOverview(ov);
      setLeaderboard(lb);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const stats = [
    { label: 'Active Posts', value: overview?.activePosts ?? 0, icon: FileText, color: 'text-accent-500' },
    { label: 'Active Reps', value: overview?.activeReps ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Posts Shared', value: overview?.posted ?? 0, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Completion Rate', value: `${overview?.completionRate ?? 0}%`, icon: TrendingUp, color: 'text-amber-500' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-sm text-navy-400 mt-0.5">Overview of your advocacy program</p>
        </div>
        <Link to="/marketing/posts/new">
          <Button><Plus size={18} /> New Post</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-navy-100 p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-surface ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy-900">{value}</p>
                <p className="text-xs text-navy-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-navy-100 p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Top Sharers This Month</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-navy-400">No posts shared yet this month.</p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((rep, i) => (
              <Link key={rep.id} to={`/marketing/reps/${rep.id}`} className="flex items-center gap-4 p-2 -mx-2 rounded-lg hover:bg-navy-50 transition-colors">
                <span className="text-sm font-bold text-navy-300 w-6 text-right">#{i + 1}</span>
                {rep.profilePicUrl ? (
                  <img src={rep.profilePicUrl} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 text-sm font-medium">
                    {rep.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-800">{rep.name}</p>
                </div>
                <span className="text-sm font-semibold text-accent-600">{rep.postsThisMonth} posts</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
