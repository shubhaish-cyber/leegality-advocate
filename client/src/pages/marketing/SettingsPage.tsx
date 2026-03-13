import { useEffect, useState } from 'react';
import { Trash2, Plus, Link2, Copy, CheckCircle, Users, Mail, RefreshCw, XCircle, Bell, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/utils';

const PROTECTED_EMAIL = 'marketers@leegality.com';

interface MarketingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AllowedEmail {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  addedBy: { name: string };
}

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
  isRevoked: boolean;
  usedByEmail: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy: { name: string };
}

export function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<'marketing' | 'sales' | 'notifications'>('marketing');
  const [loading, setLoading] = useState(true);

  // Marketing data
  const [marketingUsers, setMarketingUsers] = useState<MarketingUser[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);

  // Sales data
  const [reps, setReps] = useState<Rep[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Notification state
  const [notifConfig, setNotifConfig] = useState({
    zohoCliqEnabled: false,
    zohoCliqClientId: '',
    zohoCliqClientSecret: '',
    zohoCliqRefreshToken: '',
    zohoCliqChannelName: '',
    zohoCliqDomain: 'com',
  });
  const [savingNotif, setSavingNotif] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  const fetchData = async () => {
    try {
      const [mu, ae, r, inv, notif] = await Promise.all([
        api.get('/api/settings/marketing-users'),
        api.get('/api/settings/allowed-emails'),
        api.get('/api/reps'),
        api.get('/api/invites'),
        api.get('/api/settings/notifications'),
      ]);
      setMarketingUsers(mu);
      setAllowedEmails(ae);
      setReps(r);
      setInvites(inv.invites || inv); // handle paginated or plain response
      setNotifConfig(notif);
    } catch (err: any) {
      toast(err.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addEmail = async (role: 'marketing' | 'rep') => {
    if (!newEmail.trim()) return toast('Email is required', 'error');
    setAdding(true);
    try {
      await api.post('/api/settings/allowed-emails', { email: newEmail.trim(), role });
      toast(`${newEmail.trim()} added to ${role === 'marketing' ? 'marketing' : 'sales'} allowlist`);
      setNewEmail('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to add email', 'error');
    } finally {
      setAdding(false);
    }
  };

  const removeEmail = async (id: string) => {
    try {
      await api.delete(`/api/settings/allowed-emails/${id}`);
      toast('Email removed');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to remove email', 'error');
    }
  };

  const generateInvite = async () => {
    try {
      await api.post('/api/invites');
      toast('Invite link generated');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to generate invite', 'error');
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/rep/onboard/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast('Link copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  const revokeInvite = async (id: string) => {
    try {
      await api.delete(`/api/invites/${id}`);
      toast('Invite revoked');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to revoke invite', 'error');
    }
  };

  const deleteMarketingUser = async (userId: string, userName: string) => {
    if (!confirm(`Permanently delete marketing user "${userName}"? They will lose access to the platform.`)) return;
    try {
      await api.delete(`/api/settings/marketing-users/${userId}`);
      toast('Marketing user deleted');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete user', 'error');
    }
  };

  const deleteRep = async (repId: string, repName: string) => {
    if (!confirm(`Permanently delete ${repName}? This will remove all their assignments too. This cannot be undone.`)) return;
    try {
      await api.delete(`/api/reps/${repId}`);
      toast('Rep deleted');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete rep', 'error');
    }
  };

  const extendInvite = async (id: string) => {
    try {
      // PATCH request for extend
      const res = await fetch(`/api/invites/${id}/extend`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to extend');
      toast('Invite extended by 7 days');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to extend invite', 'error');
    }
  };

  const saveNotifications = async () => {
    setSavingNotif(true);
    try {
      await api.put('/api/settings/notifications', notifConfig);
      toast('Notification settings saved');
    } catch (err: any) {
      toast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSavingNotif(false);
    }
  };

  const testNotification = async () => {
    setTestingNotif(true);
    try {
      await api.post('/api/settings/notifications/test');
      toast('Test notification sent! Check your Zoho Cliq channel.');
    } catch (err: any) {
      toast(err.message || 'Test failed', 'error');
    } finally {
      setTestingNotif(false);
    }
  };

  if (loading) return <PageLoader />;

  const marketingEmails = allowedEmails.filter((e) => e.role === 'marketing');
  const salesEmails = allowedEmails.filter((e) => e.role === 'rep');

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['marketing', 'sales', 'notifications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setNewEmail(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === t
                ? 'bg-accent-500 text-white'
                : 'bg-white text-navy-600 border border-navy-200 hover:bg-navy-50'
            }`}
          >
            {t === 'marketing' ? 'Marketing Team' : t === 'sales' ? 'Sales Reps' : 'Notifications'}
          </button>
        ))}
      </div>

      {/* Marketing Team Tab */}
      {tab === 'marketing' && (
        <div className="space-y-6">
          {/* Add Email */}
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <h2 className="font-semibold text-navy-900 mb-3">Add Marketing User</h2>
            <p className="text-sm text-navy-400 mb-4">
              Add an email address to allow them to sign in with Google.
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail('marketing')}
                placeholder="email@company.com"
                className="flex-1 rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
              <Button onClick={() => addEmail('marketing')} disabled={adding}>
                <Plus size={16} /> Add
              </Button>
            </div>
          </div>

          {/* Allowed Emails */}
          {marketingEmails.length > 0 && (
            <div className="bg-white rounded-xl border border-navy-100 p-5">
              <h2 className="font-semibold text-navy-900 mb-3">Allowed Emails</h2>
              <div className="space-y-2">
                {marketingEmails.map((entry) => {
                  const hasLoggedIn = marketingUsers.some(
                    (u) => u.email.toLowerCase() === entry.email.toLowerCase()
                  );
                  return (
                    <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-navy-50 last:border-0">
                      <Mail size={16} className="text-navy-300 shrink-0" />
                      <span className="text-sm text-navy-700 flex-1">{entry.email}</span>
                      <Badge variant={hasLoggedIn ? 'success' : 'warning'}>
                        {hasLoggedIn ? 'Active' : 'Pending'}
                      </Badge>
                      <span className="text-xs text-navy-400 hidden sm:inline">
                        by {entry.addedBy.name}
                      </span>
                      <button
                        onClick={() => removeEmail(entry.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logged-in Users */}
          {marketingUsers.length > 0 && (
            <div>
              <h2 className="font-semibold text-navy-900 mb-3">Logged-in Users</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {marketingUsers.map((user) => {
                  const isProtected = user.email.toLowerCase() === PROTECTED_EMAIL;
                  const isSelf = user.id === currentUser?.id;
                  const canDelete = !isProtected && !isSelf;

                  return (
                    <div key={user.id} className="bg-white rounded-xl border border-navy-100 p-5 relative group">
                      {canDelete && (
                        <button
                          onClick={() => deleteMarketingUser(user.id, user.name)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-navy-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 font-medium">
                            {user.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-navy-800 truncate">{user.name}</p>
                          <p className="text-xs text-navy-400 truncate">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="info">{user.role}</Badge>
                          {isProtected && <Badge variant="warning">Protected</Badge>}
                          {isSelf && <Badge variant="success">You</Badge>}
                        </div>
                      </div>
                      <p className="text-xs text-navy-300 mt-3">Joined {formatDate(user.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales Reps Tab */}
      {tab === 'sales' && (
        <div className="space-y-6">
          {/* Add Email */}
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <h2 className="font-semibold text-navy-900 mb-3">Add Sales Rep Email</h2>
            <p className="text-sm text-navy-400 mb-4">
              Add an email to pre-approve a sales rep. They'll still need to connect via an invite link below.
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail('rep')}
                placeholder="rep@company.com"
                className="flex-1 rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
              <Button onClick={() => addEmail('rep')} disabled={adding}>
                <Plus size={16} /> Add
              </Button>
            </div>
          </div>

          {/* Allowed Sales Emails */}
          {salesEmails.length > 0 && (
            <div className="bg-white rounded-xl border border-navy-100 p-5">
              <h2 className="font-semibold text-navy-900 mb-3">Pre-approved Emails</h2>
              <div className="space-y-2">
                {salesEmails.map((entry) => {
                  const hasOnboarded = reps.some(
                    (r) => r.email.toLowerCase() === entry.email.toLowerCase()
                  );
                  return (
                    <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-navy-50 last:border-0">
                      <Mail size={16} className="text-navy-300 shrink-0" />
                      <span className="text-sm text-navy-700 flex-1">{entry.email}</span>
                      <Badge variant={hasOnboarded ? 'success' : 'warning'}>
                        {hasOnboarded ? 'Onboarded' : 'Pending'}
                      </Badge>
                      <span className="text-xs text-navy-400 hidden sm:inline">
                        by {entry.addedBy.name}
                      </span>
                      <button
                        onClick={() => removeEmail(entry.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invite Links */}
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-navy-900">Invite Links</h2>
              <Button size="sm" onClick={generateInvite}>
                <Link2 size={14} /> Generate Link
              </Button>
            </div>
            {invites.length === 0 ? (
              <p className="text-sm text-navy-400">No invite links generated yet.</p>
            ) : (
              <div className="space-y-3">
                {invites.map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  const daysLeft = Math.ceil(
                    (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const isActive = !inv.isUsed && !inv.isRevoked && !expired;

                  return (
                    <div key={inv.id} className="bg-navy-50/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm mb-1.5">
                        <code className="bg-white px-2 py-1 rounded text-xs text-navy-600 font-mono flex-1 truncate overflow-x-auto">
                          {`${window.location.origin}/rep/onboard/${inv.token}`}
                        </code>
                        {inv.isUsed ? (
                          <Badge variant="success">Used</Badge>
                        ) : inv.isRevoked ? (
                          <Badge variant="danger">Revoked</Badge>
                        ) : expired ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : (
                          <Badge variant="warning">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-navy-400">
                        {inv.isUsed && inv.usedByEmail && (
                          <span>Used by {inv.usedByEmail}</span>
                        )}
                        {!inv.isUsed && !inv.isRevoked && !expired && (
                          <span>Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          {isActive && (
                            <>
                              <button
                                onClick={() => copyInviteLink(inv.token)}
                                className="p-1 rounded hover:bg-white text-navy-400 cursor-pointer"
                                title="Copy link"
                              >
                                {copied === inv.token ? (
                                  <CheckCircle size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => extendInvite(inv.id)}
                                className="p-1 rounded hover:bg-white text-navy-400 hover:text-accent-600 cursor-pointer"
                                title="Extend by 7 days"
                              >
                                <RefreshCw size={14} />
                              </button>
                              <button
                                onClick={() => revokeInvite(inv.id)}
                                className="p-1 rounded hover:bg-white text-navy-400 hover:text-red-500 cursor-pointer"
                                title="Revoke"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {!isActive && expired && !inv.isRevoked && !inv.isUsed && (
                            <button
                              onClick={() => extendInvite(inv.id)}
                              className="p-1 rounded hover:bg-white text-navy-400 hover:text-accent-600 cursor-pointer"
                              title="Extend by 7 days"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Existing Reps */}
          {reps.length > 0 && (
            <div>
              <h2 className="font-semibold text-navy-900 mb-3">Onboarded Reps</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reps.map((rep) => (
                  <div key={rep.id} className="bg-white rounded-xl border border-navy-100 p-5 relative group">
                    <button
                      onClick={() => deleteRep(rep.id, rep.name)}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {reps.length === 0 && (
            <EmptyState
              icon={<Users size={48} />}
              title="No reps onboarded yet"
              description="Generate an invite link and share it with your sales team."
            />
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-navy-100 p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <Bell size={18} className="text-accent-500" />
              <h2 className="font-semibold text-navy-900">Zoho Cliq Notifications</h2>
            </div>
            <p className="text-sm text-navy-400 mb-5">
              Get notified in a Zoho Cliq channel when posts are assigned to sales reps.
              Uses the Zoho Cliq REST API with OAuth2.
            </p>

            {/* Enable toggle */}
            <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notifConfig.zohoCliqEnabled}
                  onChange={(e) =>
                    setNotifConfig((prev) => ({ ...prev, zohoCliqEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-navy-200 rounded-full peer-checked:bg-accent-500 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
              </div>
              <span className="text-sm text-navy-700 font-medium">Enable notifications</span>
            </label>

            {/* Zoho Domain */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Zoho Region</label>
              <select
                value={notifConfig.zohoCliqDomain}
                onChange={(e) =>
                  setNotifConfig((prev) => ({ ...prev, zohoCliqDomain: e.target.value }))
                }
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              >
                <option value="com">Global (.com)</option>
                <option value="in">India (.in)</option>
                <option value="eu">Europe (.eu)</option>
                <option value="com.au">Australia (.com.au)</option>
                <option value="com.cn">China (.com.cn)</option>
              </select>
            </div>

            {/* Client ID */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Client ID</label>
              <input
                type="text"
                value={notifConfig.zohoCliqClientId}
                onChange={(e) =>
                  setNotifConfig((prev) => ({ ...prev, zohoCliqClientId: e.target.value }))
                }
                placeholder="1000.XXXXXXXXXXXXXXXXXXXX"
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
            </div>

            {/* Client Secret */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Client Secret</label>
              <input
                type="password"
                value={notifConfig.zohoCliqClientSecret}
                onChange={(e) =>
                  setNotifConfig((prev) => ({ ...prev, zohoCliqClientSecret: e.target.value }))
                }
                onFocus={(e) => {
                  if (e.target.value.startsWith('••')) e.target.value = '';
                  setNotifConfig((prev) => ({
                    ...prev,
                    zohoCliqClientSecret: e.target.value.startsWith('••') ? '' : prev.zohoCliqClientSecret,
                  }));
                }}
                placeholder="Leave empty to keep existing"
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
            </div>

            {/* Refresh Token */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Refresh Token</label>
              <input
                type="password"
                value={notifConfig.zohoCliqRefreshToken}
                onChange={(e) =>
                  setNotifConfig((prev) => ({ ...prev, zohoCliqRefreshToken: e.target.value }))
                }
                onFocus={(e) => {
                  if (e.target.value.startsWith('••')) e.target.value = '';
                  setNotifConfig((prev) => ({
                    ...prev,
                    zohoCliqRefreshToken: e.target.value.startsWith('••') ? '' : prev.zohoCliqRefreshToken,
                  }));
                }}
                placeholder="Leave empty to keep existing"
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
            </div>

            {/* Channel Name */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Channel Name</label>
              <input
                type="text"
                value={notifConfig.zohoCliqChannelName}
                onChange={(e) =>
                  setNotifConfig((prev) => ({ ...prev, zohoCliqChannelName: e.target.value }))
                }
                placeholder="e.g. marketing-updates"
                className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              />
              <p className="text-xs text-navy-400 mt-1.5">
                The exact channel name in Zoho Cliq where notifications will be posted.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button onClick={saveNotifications} disabled={savingNotif}>
                {savingNotif ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                variant="secondary"
                onClick={testNotification}
                disabled={testingNotif || !notifConfig.zohoCliqChannelName.trim()}
              >
                <Send size={14} />
                {testingNotif ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="bg-navy-50 rounded-xl p-5">
            <h3 className="font-semibold text-navy-800 mb-2.5">How to set up Zoho Cliq OAuth2</h3>
            <ol className="text-sm text-navy-600 space-y-2.5 list-decimal list-inside">
              <li>Go to <span className="font-medium">Zoho API Console</span> (api-console.zoho.com) and create a <span className="font-medium">Self Client</span></li>
              <li>Note your <span className="font-medium">Client ID</span> and <span className="font-medium">Client Secret</span></li>
              <li>In the Self Client, generate a code with scope: <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">ZohoCliq.Channels.ALL</code></li>
              <li>Exchange the code for a refresh token using the Zoho token API (POST to <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">accounts.zoho.{notifConfig.zohoCliqDomain}/oauth/v2/token</code> with grant_type=authorization_code)</li>
              <li>Enter all credentials above, set the channel name, and click <span className="font-medium">Send Test</span></li>
            </ol>
            <div className="mt-4 p-3 bg-white rounded-lg border border-navy-100">
              <p className="text-xs font-medium text-navy-500 mb-1.5">What the notification looks like:</p>
              <div className="text-xs text-navy-600 font-mono whitespace-pre-line leading-relaxed">
{`*New Post Assignment*

"First 150 chars of post caption..."
*Campaign:* Campaign Name

*Assigned to:* Rep Name
@rep@company.com`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
