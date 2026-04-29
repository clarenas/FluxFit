export function FluxFitLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { circle: 'w-8 h-8', icon: 14, text: 'text-lg' },
    md: { circle: 'w-12 h-12', icon: 20, text: 'text-2xl' },
    lg: { circle: 'w-24 h-24', icon: 40, text: 'text-5xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${s.circle} rounded-full bg-[#CC0000] flex items-center justify-center`}>
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5h11M6.5 17.5h11" />
          <rect x="3" y="4" width="3" height="4" rx="1" />
          <rect x="3" y="16" width="3" height="4" rx="1" />
          <rect x="18" y="4" width="3" height="4" rx="1" />
          <rect x="18" y="16" width="3" height="4" rx="1" />
          <line x1="6" y1="12" x2="18" y2="12" strokeWidth="3" />
        </svg>
      </div>
      <div className={`${s.text} font-bold italic tracking-tight`}>
        <span className="text-[#CC0000]">FLUX</span>
        <span className="text-[#111111]">FIT</span>
      </div>
      {size === 'lg' && <p className="text-base text-[#666666] font-normal not-italic">Tu gym. Tu momento.</p>}
    </div>
  );
}
