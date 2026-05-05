import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }> | string;
  hasSubmenu?: boolean;
  subItems?: { id: string; label: string }[];
}

interface AdminSidebarProps {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  showSubmenu?: boolean;
  onToggleSubmenu?: () => void;
  activeSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  logo?: string;
  title?: string;
}

export default function AdminSidebar({
  navItems,
  activeTab,
  onTabChange,
  showSubmenu = false,
  onToggleSubmenu,
  activeSubTab,
  onSubTabChange,
  logo = 'FLUXFIT',
  title = 'Panel Admin'
}: AdminSidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <aside style={{ width: 200, flexShrink: 0 }} className="bg-white border-r border-[#E5E5E5] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#F0F0F0]">
        <p style={{ color: '#CC0000', fontWeight: 500, fontSize: 18 }}>{logo}</p>
        <p style={{ fontSize: 12 }} className="text-[#999] mt-0.5">{title}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => {
                onTabChange(item.id);
                if (item.hasSubmenu && onToggleSubmenu) {
                  onToggleSubmenu();
                }
              }}
              style={{ fontSize: 14, padding: '0.625rem 1rem' }}
              className={`w-full text-left flex items-center justify-between gap-2.5 transition-colors ${
                activeTab === item.id
                  ? 'bg-[#CC0000] text-white'
                  : 'text-[#111] hover:bg-[#F5F5F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                {typeof item.icon === 'string' ? (
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                ) : (
                  <item.icon className="w-4 h-4" />
                )}
                <span className="font-medium">{item.label}</span>
              </div>
              {item.hasSubmenu && (
                <span className="text-xs">▼</span>
              )}
            </button>

            {/* Submenu */}
            {item.hasSubmenu && showSubmenu && activeTab === item.id && item.subItems && (
              <div className="ml-4 mt-1 space-y-1">
                {item.subItems.map((subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => onSubTabChange && onSubTabChange(subItem.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === subItem.id
                        ? 'bg-gray-200 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {subItem.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#F0F0F0]">
        <button
          onClick={handleLogout}
          style={{ fontSize: 13 }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#666] hover:bg-[#F5F5F5] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
