import { useEffect, useState } from 'react';

interface ModernAlertProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export default function ModernAlert({ open, title = 'System Update', message, onClose }: ModernAlertProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(timer);
    }
    setShow(false);
    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`
          relative w-full max-w-[380px] rounded-3xl p-8
          bg-gradient-to-br from-[var(--color-navy)] via-[var(--color-teal-dark)] to-[var(--color-teal)]
          border border-[var(--color-mint)]/35
          shadow-[0_0_40px_rgba(22,113,115,0.36)]
          transition-all duration-500
          ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        `}
      >
        <div className="absolute -inset-1 rounded-3xl bg-[var(--color-mint)]/20 blur-2xl -z-10"></div>

        <p className="text-sm text-[var(--color-mint)]/90 mb-2">Notifikasi Sistem</p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{title}</h2>
        <p className="text-[var(--color-surface)]/95 mb-6 whitespace-pre-wrap">{message}</p>

        <button
          onClick={onClose}
          className="
            w-full py-3 rounded-full
            bg-[var(--color-mint)] text-[var(--color-navy)] font-semibold
            hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(134,221,208,0.48)]
            transition-all duration-300
          "
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
