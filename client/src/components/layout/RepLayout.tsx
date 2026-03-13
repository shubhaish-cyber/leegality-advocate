import { Outlet, Navigate } from 'react-router-dom';
import { RepHeader } from './RepHeader';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/Spinner';

export function RepLayout() {
  const { user, userType, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user || userType !== 'rep') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-surface/50">
      <RepHeader />
      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
