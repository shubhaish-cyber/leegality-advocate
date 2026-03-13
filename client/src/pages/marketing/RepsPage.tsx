import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Copy, CheckCircle, Users, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/utils';

interface Rep {
  id: string;
  name: string;
  email: string;
  profilePicUrl: string | null;
  isActive: boolean;
  createdAt: string;
  stats: { posted: number; pending: number; skipped: number; total: number };
}

interface Invite {
  id: string;
  token: string;
  isUsed: boolean;
  usedByEmail: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy: { name: string };
}

export function RepsPage() {
  const { toast } = useToast();
  const [reps, setReps] = useState<Rep[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    const [r, i] = await Promise.all([api.get('/api/reps'), api.get('/api/invites')]);
    setReps(r);
    setInvites(i.invites || i);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const generateInvite = async () => {
    const invite = await api.post('/api/invites');
    toast('Invite link generated');
    fetchData();
  };

  const deleteRep = async (e: React.MouseEvent, repId: string, repName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Permanently delete ${repName}? This will remove all their assignments too. This cannot be undone.`)) return;
    try {
      await api.delete(`/api/reps/${repId}`);
      toast('Rep deleted');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete rep', 'error');
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/rep/onboard/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast('Link copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Sales Reps</h1>
        <Button onClick={generateInvite}>
          <Link2 size={16} /> Generate Invite Link
        </Button>
      </div>

      {/* Invite Links */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-navy-100 p-5 mb-6">
          <h2 className="font-semibold text-navy-900 mb-3">Invite Links</h2>
          <div className="space-y-2">
            {invites.slice(0, 10).map((inv) => {
              const expired = new Date(inv.expiresAt) < new Date();
              return (
                <div key={inv.id} className="flex items-center gap-3 text-sm">
                  <code className="bg-navy-50 px-2 py-1 rounded text-xs text-navy-600 font-mono flex-1 truncate">
                    {`${window.location.origin}/rep/onboard/${inv.token}`}
                  </code>
                  {inv.isUsed ? (
                    <Badge variant="success">Used by {inv.usedByEmail}</Badge>
                  ) : expired ? (
                    <Badge variant="danger">Expired</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">Pending</Badge>
                      <button
                        onClick={() => copyInviteLink(inv.token)}
                        className="p-1.5 rounded hover:bg-navy-50 text-navy-400 cursor-pointer"
                      >
                        {copied === inv.token ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rep List */}
      {reps.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No reps onboarded yet"
          description="Generate an invite link and share it with your sales team to get started."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reps.map((rep) => (
            <Link key={rep.id} to={`/marketing/reps/${rep.id}`} className="block bg-white rounded-xl border border-navy-100 p-5 hover:shadow-md transition-shadow relative group">
              <button
                onClick={(e) => deleteRep(e, rep.id, rep.name)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-navy-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="Delete rep"
              >
                <Trash2 size={14} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                {rep.profilePicUrl ? (
                  <img src={rep.profilePicUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 font-medium">
                    {rep.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-800 truncate">{rep.name}</p>
                  <p className="text-xs text-navy-400 truncate">{rep.email}</p>
                </div>
                <Badge variant={rep.isActive ? 'success' : 'danger'}>
                  {rep.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-navy-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-navy-700">{rep.stats.total}</p>
                  <p className="text-[11px] text-navy-400">Assigned</p>
                </div>
                <div className="bg-green-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-green-600">{rep.stats.posted}</p>
                  <p className="text-[11px] text-navy-400">Posted</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-amber-600">{rep.stats.pending}</p>
                  <p className="text-[11px] text-navy-400">Pending</p>
                </div>
              </div>
              <p className="text-xs text-navy-300 mt-3">Joined {formatDate(rep.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
