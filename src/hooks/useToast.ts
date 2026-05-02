import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastState { message: string; type: ToastType; visible: boolean; }

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '', type: 'info', visible: false
  });
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);
  return { toast, showToast };
}
