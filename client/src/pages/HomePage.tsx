import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export function HomePage() {
  const { user, userType, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const error = params.get('error');

  useEffect(() => {
    if (!loading && user) {
      if (userType === 'marketing') navigate('/marketing/dashboard', { replace: true });
      if (userType === 'rep') navigate('/rep/queue', { replace: true });
    }
  }, [user, userType, loading, navigate]);

  const errorMessages: Record<string, string> = {
    unauthorized: 'Your email is not authorized to access this platform.',
    no_code: 'Authentication was cancelled.',
    token_failed: 'Failed to authenticate. Please try again.',
    server_error: 'Something went wrong. Please try again.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface/50 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy-900">Leegality Advocate</h1>
          <p className="text-navy-400 mt-2">LinkedIn Employee Advocacy Platform</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
            {errorMessages[error] || 'An error occurred.'}
          </div>
        )}

        {/* Two cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Marketing Card */}
          <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-navy-900">Marketing Team</h2>
            </div>
            <p className="text-sm text-navy-400 mb-5 flex-1">
              Create posts, assign them to reps, and track engagement analytics.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => (window.location.href = '/api/auth/google')}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </Button>
          </div>

          {/* Sales Rep Card */}
          <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#0077B5]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-navy-900">Sales Reps</h2>
            </div>
            <p className="text-sm text-navy-400 mb-5 flex-1">
              Publish approved posts to your LinkedIn profile in one tap.
            </p>
            <Button
              size="lg"
              className="w-full bg-[#0077B5] hover:bg-[#006097]"
              onClick={() => (window.location.href = '/api/auth/linkedin')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Sign in with LinkedIn
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-navy-300 text-center mt-6">
          Marketing team uses Google SSO · Sales reps connect via LinkedIn
        </p>
      </div>
    </div>
  );
}
