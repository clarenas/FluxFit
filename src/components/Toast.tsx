interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

const bgColor = {
  success: 'bg-[#16A34A]',
  error: 'bg-[#CC0000]',
  info: 'bg-[#111111]',
};

export function Toast({ message, type, visible }: ToastProps) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[390px] w-[90%] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${bgColor[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
    >
      {message}
    </div>
  );
}
