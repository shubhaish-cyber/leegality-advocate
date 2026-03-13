import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

export function RepLoginPage() {
  const { user, userType, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const error = params.get('error');

  useEffect(() => {
    if (!loading && user && userType === 'rep') {
      navigate('/rep/queue', { replace: true });
    }
  }, [user, userType, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface/50 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">Leegality Advocate</h1>
          <p className="text-sm text-navy-400 mt-1">Connect your LinkedIn to share approved content</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error === 'token_failed' ? 'Failed to connect LinkedIn.' : 'Something went wrong.'}
          </div>
        )}

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

        <p className="text-xs text-navy-300 mt-6">
          You'll be asked to connect your LinkedIn account once. Posts are published through your profile.
        </p>
      </div>
    </div>
  );
}
