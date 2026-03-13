import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';

export function OnboardPage() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [reason, setReason] = useState('');

  useEffect(() => {
    api.get(`/api/invites/${token}/validate`).then((data) => {
      if (data.valid) {
        setStatus('valid');
      } else {
        setStatus('invalid');
        setReason(data.reason === 'already_used' ? 'This link has already been used.' :
                  data.reason === 'expired' ? 'This link has expired.' : 'Invalid invite link.');
      }
    }).catch(() => {
      setStatus('invalid');
      setReason('Could not validate invite link.');
    });
  }, [token]);

  if (status === 'loading') return <PageLoader />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface/50 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Leegality Advocate</h1>

        {status === 'valid' ? (
          <>
            <p className="text-sm text-navy-500 mb-6">
              Welcome! Connect your LinkedIn to start sharing approved content with your network.
            </p>
            <Button
              size="lg"
              className="w-full bg-[#0077B5] hover:bg-[#006097]"
              onClick={() => (window.location.href = `/api/auth/linkedin?invite=${token}`)}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Connect LinkedIn
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-red-500 mb-4">{reason}</p>
            <p className="text-xs text-navy-400">Contact your marketing team for a new invite link.</p>
          </>
        )}
      </div>
    </div>
  );
}
