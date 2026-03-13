import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image as ImageIcon, Film, FileText, Search, CheckSquare, Square, LayoutGrid, Calendar as CalendarIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { useDebounce } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Combobox } from '../../components/ui/Combobox';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { truncate, formatDate } from '../../lib/utils';
import { CalendarView } from './CalendarView';

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
  createdBy: { name: string };
  stats: { posted: number; pending: number; skipped: number; total: number };
}

const statusBadgeVariant = (s: string) =>
  s === 'active' ? 'success' : s === 'draft' ? 'neutral' : 'danger';

export function PostsPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');

  useEffect(() => {
    api.get('/api/posts/campaigns').then(setCampaigns).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (campaignFilter) params.set('campaign', campaignFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (viewMode === 'calendar') params.set('limit', '200');
    api.get(`/api/posts?${params}`).then((d) => setPosts(d.posts)).finally(() => setLoading(false));
  }, [filter, campaignFilter, debouncedSearch, viewMode]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const bulkAction = async (action: 'activate' | 'archive' | 'assign_all') => {
    try {
      const result = await api.post('/api/posts/bulk', {
        postIds: [...selectedIds],
        action,
      });
      const label = action === 'activate' ? 'Activated' : action === 'archive' ? 'Archived' : 'Assigned';
      toast(`${label} ${result.count || selectedIds.size} post(s)`);
      exitSelection();
      // Refetch
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (campaignFilter) params.set('campaign', campaignFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      api.get(`/api/posts?${params}`).then((d) => setPosts(d.posts)).finally(() => setLoading(false));
    } catch (err: any) {
      toast(err.message || 'Bulk action failed', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Posts</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-navy-200 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-accent-500 text-white' : 'bg-white text-navy-500 hover:bg-navy-50'}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'calendar' ? 'bg-accent-500 text-white' : 'bg-white text-navy-500 hover:bg-navy-50'}`}
              title="Calendar view"
            >
              <CalendarIcon size={16} />
            </button>
          </div>
          <Link to="/marketing/posts/new">
            <Button><Plus size={18} /> New Post</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="pl-9 pr-3 py-1.5 rounded-lg border border-navy-200 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 transition-colors w-48"
          />
        </div>
        {['all', 'draft', 'active', 'archived'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
              filter === s ? 'bg-accent-500 text-white' : 'bg-white text-navy-600 border border-navy-200 hover:bg-navy-50'
            }`}
          >
            {s}
          </button>
        ))}
        <Combobox
          options={campaigns}
          value={campaignFilter}
          onChange={setCampaignFilter}
          placeholder="All campaigns"
          className="w-52"
        />
        {viewMode === 'grid' && (
          <button
            onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              selectionMode ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200 hover:bg-navy-50'
            }`}
          >
            {selectionMode ? 'Cancel Selection' : 'Select'}
          </button>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={48} />}
          title="No posts yet"
          description="Create your first post to start distributing content to your sales team."
          action={
            <Link to="/marketing/posts/new">
              <Button>Create Post</Button>
            </Link>
          }
        />
      ) : viewMode === 'calendar' ? (
        <CalendarView posts={posts} />
      ) : (
        <>
          {selectionMode && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 text-sm text-navy-600 hover:text-navy-800 cursor-pointer"
              >
                {selectedIds.size === posts.length ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedIds.size === posts.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-navy-400">
                {selectedIds.size} selected
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {posts.map((post) => (
              <div key={post.id} className="relative">
                {selectionMode && (
                  <button
                    onClick={() => toggleSelect(post.id)}
                    className="absolute top-3 left-3 z-10 p-1 bg-white/90 rounded-lg shadow cursor-pointer"
                  >
                    {selectedIds.has(post.id) ? (
                      <CheckSquare size={20} className="text-accent-500" />
                    ) : (
                      <Square size={20} className="text-navy-400" />
                    )}
                  </button>
                )}
                <Link
                  to={selectionMode ? '#' : `/marketing/posts/${post.id}`}
                  onClick={(e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      toggleSelect(post.id);
                    }
                  }}
                  className={`block bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow group ${
                    selectedIds.has(post.id) ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-navy-100'
                  }`}
                >
                  <div className="aspect-[1.91/1] bg-navy-50 overflow-hidden">
                    {(post.mediaType || 'image') === 'video' ? (
                      <div className="w-full h-full bg-navy-900 flex items-center justify-center">
                        <Film size={40} className="text-white/60" />
                      </div>
                    ) : (post.mediaType || 'image') === 'document' ? (
                      <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center gap-2">
                        <FileText size={40} className="text-red-400" />
                        <p className="text-xs text-navy-400">PDF Document</p>
                      </div>
                    ) : (
                      <img
                        src={`/uploads/${post.imageUrl}`}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={statusBadgeVariant(post.status)}>
                        {post.status}
                      </Badge>
                      {post.campaignTag && (
                        <Badge variant="info">{post.campaignTag}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-navy-700 mb-3 leading-relaxed">
                      {truncate(post.caption, 120)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-navy-400">
                      <span>{formatDate(post.createdAt)}</span>
                      <div className="flex items-center gap-2">
                        {post.deadline && (
                          <span className="text-red-400">Due {formatDate(post.deadline)}</span>
                        )}
                        <span>
                          {post.stats.posted}/{post.stats.total} shared
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-6 bg-navy-700" />
          <button onClick={() => bulkAction('activate')} className="text-sm hover:text-accent-300 cursor-pointer transition-colors">
            Activate
          </button>
          <button onClick={() => bulkAction('archive')} className="text-sm hover:text-red-300 cursor-pointer transition-colors">
            Archive
          </button>
          <button onClick={() => bulkAction('assign_all')} className="text-sm hover:text-green-300 cursor-pointer transition-colors">
            Assign All Reps
          </button>
        </div>
      )}
    </div>
  );
}
