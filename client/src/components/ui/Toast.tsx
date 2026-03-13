import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle size={18} className="text-green-500" />,
    error: <XCircle size={18} className="text-red-500" />,
    info: <AlertCircle size={18} className="text-accent-500" />,
  };

  return (
    <div className="flex items-center gap-3 bg-white border border-navy-100 shadow-lg rounded-lg px-4 py-3 min-w-[280px] animate-slide-up">
      {icons[toast.type]}
      <span className="text-sm text-navy-800 flex-1">{toast.message}</span>
      <button onClick={onRemove} className="text-navy-300 hover:text-navy-500 cursor-pointer">
        <X size={14} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
