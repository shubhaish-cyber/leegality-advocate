import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { MarketingLayout } from './components/layout/MarketingLayout';
import { RepLayout } from './components/layout/RepLayout';

import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/marketing/DashboardPage';
import { PostsPage } from './pages/marketing/PostsPage';
import { PostFormPage } from './pages/marketing/PostFormPage';
import { PostDetailPage } from './pages/marketing/PostDetailPage';
import { PostEditPage } from './pages/marketing/PostEditPage';
import { RepsPage } from './pages/marketing/RepsPage';
import { RepDetailPage } from './pages/marketing/RepDetailPage';
import { CampaignsPage } from './pages/marketing/CampaignsPage';
import { SettingsPage } from './pages/marketing/SettingsPage';
import { OnboardPage } from './pages/rep/OnboardPage';
import { QueuePage } from './pages/rep/QueuePage';
import { PostViewPage } from './pages/rep/PostViewPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Unified Homepage */}
            <Route path="/" element={<HomePage />} />

            {/* Old login routes redirect to homepage */}
            <Route path="/marketing/login" element={<Navigate to="/" replace />} />
            <Route path="/rep/login" element={<Navigate to="/" replace />} />

            {/* Marketing Portal */}
            <Route path="/marketing" element={<MarketingLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="posts" element={<PostsPage />} />
              <Route path="posts/new" element={<PostFormPage />} />
              <Route path="posts/:id" element={<PostDetailPage />} />
              <Route path="posts/:id/edit" element={<PostEditPage />} />
              <Route path="reps" element={<RepsPage />} />
              <Route path="reps/:id" element={<RepDetailPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Sales Rep Portal */}
            <Route path="/rep/onboard/:token" element={<OnboardPage />} />
            <Route path="/rep" element={<RepLayout />}>
              <Route path="queue" element={<QueuePage />} />
              <Route path="queue/:id" element={<PostViewPage />} />
              <Route index element={<Navigate to="queue" replace />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-navy-900 mb-2">404</h1>
                  <p className="text-navy-400">Page not found</p>
                </div>
              </div>
            } />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
