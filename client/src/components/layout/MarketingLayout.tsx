import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { MarketingSidebar } from './MarketingSidebar';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/Spinner';

export function MarketingLayout() {
  const { user, userType, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return <PageLoader />;
  if (!user || userType !== 'marketing') return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen">
      <MarketingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-navy-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="p-1 cursor-pointer">
          <Menu size={22} />
        </button>
        <h1 className="text-sm font-bold tracking-tight">Leegality Advocate</h1>
      </div>

      <main className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0 p-4 md:p-8 bg-surface/50 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
