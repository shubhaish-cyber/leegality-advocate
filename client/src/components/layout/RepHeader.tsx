import { LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function RepHeader() {
  const { user, logout } = useAuth();

  // Calculate token status
  const tokenExpiry = user?.tokenExpiry ? new Date(user.tokenExpiry) : null;
  const now = new Date();
  const isExpired = tokenExpiry ? tokenExpiry < now : false;
  const daysUntilExpiry = tokenExpiry
    ? Math.ceil((tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  return (
    <>
      {/* Token expiry warning banner */}
      {isExpired && (
        <div className="bg-red-500 text-white px-4 py-2.5 text-center">
          <div className="max-w-lg mx-auto flex items-center justify-center gap-2 text-sm">
            <AlertTriangle size={16} />
            <span className="font-medium">LinkedIn token expired.</span>
            <a
              href="/api/auth/linkedin/reconnect"
              className="underline font-semibold hover:text-red-100"
            >
              Reconnect now
            </a>
          </div>
        </div>
      )}
      {isExpiringSoon && !isExpired && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center">
          <div className="max-w-lg mx-auto flex items-center justify-center gap-2 text-sm">
            <AlertTriangle size={16} />
            <span>LinkedIn token expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.</span>
            <a
              href="/api/auth/linkedin/reconnect"
              className="underline font-semibold hover:text-amber-100"
            >
              Reconnect
            </a>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-navy-100 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-navy-900">Leegality Advocate</h1>
            <p className="text-xs text-navy-400">Your posting queue</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.profilePicUrl ? (
              <img src={user.profilePicUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0)}
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-navy-50 text-navy-400 cursor-pointer"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
