import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Tag, Users, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/marketing/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/marketing/posts', icon: FileText, label: 'Posts' },
  { to: '/marketing/campaigns', icon: Tag, label: 'Campaigns' },
  { to: '/marketing/reps', icon: Users, label: 'Sales Reps' },
  { to: '/marketing/settings', icon: Settings, label: 'Settings' },
];

interface MarketingSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function MarketingSidebar({ isOpen, onClose }: MarketingSidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const sidebar = (
    <aside className="w-64 bg-navy-900 text-white flex flex-col h-screen">
      <div className="p-6 border-b border-navy-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Leegality Advocate</h1>
          <p className="text-xs text-navy-400 mt-0.5">Employee Advocacy Platform</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-navy-400 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors',
                active ? 'bg-accent-500/20 text-accent-300' : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-navy-800">
        <div className="flex items-center gap-3 mb-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-sm font-medium">
              {user?.name?.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-navy-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-navy-400 hover:text-white transition-colors w-full cursor-pointer"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden md:block fixed left-0 top-0 z-40">
        {sidebar}
      </div>

      {/* Mobile: overlay sidebar */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-10 h-full w-64 animate-slide-in">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
