import React from 'react';
import { Loader2, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ToastItem } from '../types';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7ECE7] bg-white p-12 text-center">
    <Loader2 className="h-7 w-7 animate-spin text-[#16865A]" aria-hidden="true" />
    <p className="mt-3 text-sm font-medium text-[#78847D]">{message}</p>
  </div>
);

export const ToastRegion: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  return (
    <div role="region" aria-label="Notifications" className="vox-toast-region">
      <div aria-live="polite" className="visually-hidden">
        {toasts[toasts.length - 1]?.message || ''}
      </div>
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;
        const iconColor =
          toast.type === 'success'
            ? 'text-[#16A34A]'
            : toast.type === 'error'
            ? 'text-[#DC2626]'
            : 'text-[#16865A]';
        return (
          <div key={toast.id} className="vox-toast flex items-start gap-3">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
            <p className="flex-1 text-sm font-medium text-[#202923]">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-[#78847D] hover:bg-[#F3F6F1] hover:text-[#202923]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
