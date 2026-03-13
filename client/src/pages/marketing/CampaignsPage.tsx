import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Pencil, Merge, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';

interface Campaign {
  name: string;
  postCount: number;
}

export function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Merge
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');

  const fetchCampaigns = () => {
    setLoading(true);
    api.get('/api/campaigns')
      .then(setCampaigns)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleRename = async () => {
    if (!newName.trim() || !renameTarget) return;
    try {
      await api.put(`/api/campaigns/${encodeURIComponent(renameTarget)}`, { newName: newName.trim() });
      toast(`Renamed "${renameTarget}" → "${newName.trim()}"`);
      setRenameTarget(null);
      setNewName('');
      fetchCampaigns();
    } catch (err: any) {
      toast(err.message || 'Rename failed', 'error');
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget.trim() || !mergeSource) return;
    try {
      await api.post('/api/campaigns/merge', { source: mergeSource, target: mergeTarget.trim() });
      toast(`Merged "${mergeSource}" into "${mergeTarget.trim()}"`);
      setMergeSource(null);
      setMergeTarget('');
      fetchCampaigns();
    } catch (err: any) {
      toast(err.message || 'Merge failed', 'error');
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove campaign tag "${name}" from all posts?`)) return;
    try {
      await api.delete(`/api/campaigns/${encodeURIComponent(name)}`);
      toast(`Removed campaign "${name}"`);
      fetchCampaigns();
    } catch (err: any) {
      toast(err.message || 'Remove failed', 'error');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Campaigns</h1>
          <p className="text-sm text-navy-400 mt-0.5">Manage campaign tags across your posts</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Tag size={48} />}
          title="No campaigns yet"
          description="Campaign tags will appear here once you tag posts with a campaign name."
        />
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-navy-400 uppercase tracking-wider">Campaign</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-navy-400 uppercase tracking-wider">Posts</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-navy-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {campaigns.map((c) => (
                <tr key={c.name} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-accent-500" />
                      <Link
                        to={`/marketing/posts?campaign=${encodeURIComponent(c.name)}`}
                        className="text-sm font-medium text-navy-800 hover:text-accent-600 transition-colors"
                      >
                        {c.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-50 text-accent-600">
                      {c.postCount}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/marketing/posts?campaign=${encodeURIComponent(c.name)}`}
                        className="p-1.5 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 cursor-pointer transition-colors"
                        title="View posts"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      <button
                        onClick={() => { setRenameTarget(c.name); setNewName(c.name); }}
                        className="p-1.5 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 cursor-pointer transition-colors"
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setMergeSource(c.name); setMergeTarget(''); }}
                        className="p-1.5 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 cursor-pointer transition-colors"
                        title="Merge into another"
                      >
                        <Merge size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(c.name)}
                        className="p-1.5 rounded hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors"
                        title="Remove tag"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename Modal */}
      <Modal isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename Campaign">
        <p className="text-sm text-navy-500 mb-4">
          Rename <strong>"{renameTarget}"</strong> across all posts.
        </p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New campaign name"
          className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 mb-4"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
        <div className="flex gap-2">
          <Button onClick={handleRename} disabled={!newName.trim() || newName === renameTarget}>
            Rename
          </Button>
          <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Merge Modal */}
      <Modal isOpen={!!mergeSource} onClose={() => setMergeSource(null)} title="Merge Campaign">
        <p className="text-sm text-navy-500 mb-4">
          Merge all posts from <strong>"{mergeSource}"</strong> into another campaign.
        </p>
        <select
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 mb-4"
        >
          <option value="">Select target campaign...</option>
          {campaigns
            .filter((c) => c.name !== mergeSource)
            .map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.postCount} posts)
              </option>
            ))}
        </select>
        <div className="flex gap-2">
          <Button onClick={handleMerge} disabled={!mergeTarget}>
            Merge
          </Button>
          <Button variant="ghost" onClick={() => setMergeSource(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
