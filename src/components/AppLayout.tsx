import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

export type AppLayoutRole = 'user' | 'commerce';

const DEFAULT_SUBTITLE: Record<AppLayoutRole, string> = {
  user: 'Panel',
  commerce: 'Panel Comercio',
};

export interface AppLayoutProps {
  role: AppLayoutRole;
  /** Línea pequeña bajo “FLUXFIT” (misma jerarquía visual que AdminFluxFit sidebar). */
  subtitle?: string;
  /** Contenido a la derecha del bloque de título (ej. badge Premium). */
  headerRight?: ReactNode;
  children: React.ReactNode;
}

/**
 * Shell compartido: mismo rail que BottomNav en desktop, topbar estilo panel Admin,
 * fondo #F5F5F5 y contenedor central acotado como el main de AdminFluxFit.
 */
export function AppLayout({ role, subtitle, headerRight, children }: AppLayoutProps) {
  const sub = subtitle ?? DEFAULT_SUBTITLE[role];

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col md:flex-row">
      <BottomNav />
      <div className="flex-1 flex flex-col min-h-0 w-full md:ml-[200px] pb-16 md:pb-0">
        <header className="shrink-0 sticky top-0 z-30 bg-white border-b border-[#E5E5E5] px-4 pt-5 pb-4 md:px-6">
          <div className="max-w-[900px] mx-auto flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[#CC0000] font-medium text-lg leading-tight">FLUXFIT</p>
              <p className="text-xs text-[#999] mt-0.5">{sub}</p>
            </div>
            {headerRight ? <div className="flex-shrink-0 pt-0.5">{headerRight}</div> : null}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-[430px] mx-auto md:max-w-[900px] w-full px-4 py-4 md:px-6 md:py-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
