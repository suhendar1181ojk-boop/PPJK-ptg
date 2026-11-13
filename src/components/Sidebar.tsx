import {
  AlertTriangle,
  Code2,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppView, SessionUser } from '../types/ppjk';
import { canPerformAction } from '../utils/ppjkLogic';

interface SidebarProps {
  activeView: AppView;
  onSelectView: (v: AppView) => void;
  user: SessionUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  outstandingCount: number;
}

export function Sidebar({
  activeView,
  onSelectView,
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onLogout,
  outstandingCount,
}: SidebarProps) {
  const canAccessMaster =
    canPerformAction(user.role, 'manage_master') ||
    canPerformAction(user.role, 'manage_users');
  const canViewGas = canPerformAction(user.role, 'view_gas_code');

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    visible: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'checker', label: 'Rekap Checker', icon: UserCheck, visible: true },
    {
      id: 'outstanding',
      label: 'Outstanding',
      icon: AlertTriangle,
      badge: outstandingCount,
      visible: true,
    },
    { id: 'shipments', label: 'Semua Shipment', icon: FileSpreadsheet, visible: true },
    { id: 'master', label: 'Master & Pengaturan', icon: Database, visible: canAccessMaster },
    { id: 'gas', label: 'Kode GAS (Deploy)', icon: Code2, visible: canViewGas },
  ];

  const handleNav = (id: AppView) => {
    onSelectView(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#0B2545] text-white flex flex-col transition-all duration-200 no-print ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[256px]'
        } w-[264px] ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-base font-bold tracking-tight text-white truncate">
                PTG PPJK
              </div>
              <div className="text-[11px] text-white/65 truncate">
                Outstanding Tracker
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Perluas sidebar' : 'Lipat sidebar'}
            className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup menu"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav aria-label="Navigasi utama" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F28C28] text-white font-semibold'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                  </span>
                  {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/12 text-white/90'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        <div className="p-3.5 border-t border-white/10 shrink-0">
          {!collapsed && (
            <div className="mb-3 px-1">
              <div className="text-sm font-semibold text-white truncate">{user.nama}</div>
              <div className="text-xs text-white/65 truncate">{user.role}</div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Keluar dari akun"
            className="w-full min-h-[42px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
