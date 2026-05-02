import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; title?: string; children: ReactNode; }

export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center justify-between rounded-t-2xl">
          {title && <h3 className="font-bold text-[#111111]">{title}</h3>}
          <button onClick={onClose} className="ml-auto p-1"><X size={20} className="text-[#666]" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
