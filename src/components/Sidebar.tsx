import {
  AlertTriangle,
  Anchor,
  ChevronRight,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Ship,
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
  doBelumCount?: number;
  suratJalanCount?: number;
  pendingBillingCount?: number;
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
  doBelumCount = 0,
  suratJalanCount = 0,
  pendingBillingCount = 0,
}: SidebarProps) {
  const canAccessMaster =
    canPerformAction(user.role, 'manage_master') ||
    canPerformAction(user.role, 'manage_users');

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    visible: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    {
      id: 'outstanding',
      label: 'Outstanding',
      icon: AlertTriangle,
      badge: outstandingCount,
      visible: true,
    },
    { id: 'checker', label: 'Rekap Checker', icon: UserCheck, visible: true },
    {
      id: 'do',
      label: 'Kesiapan D/O',
      icon: Anchor,
      badge: doBelumCount,
      visible: true,
    },
    {
      id: 'surat-jalan',
      label: 'Surat Jalan',
      icon: ClipboardList,
      badge: suratJalanCount,
      visible: true,
    },
    {
      id: 'penagihan',
      label: 'Penagihan & Owner',
      icon: Receipt,
      badge: pendingBillingCount,
      visible: true,
    },
    { id: 'shipments', label: 'Semua Shipment', icon: FileSpreadsheet, visible: true },
    { id: 'report-nopen', label: 'Report NOPEN (PIB)', icon: FileText, visible: true },
    { id: 'master', label: 'Master & Pengaturan', icon: Database, visible: canAccessMaster },
  ];

  const handleNav = (id: AppView) => {
    onSelectView(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#0B2545] dark:bg-[#0D111C] text-white flex flex-col border-r border-white/10 dark:border-white/[0.06] overflow-hidden transition-[transform,width] duration-200 no-print ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[256px]'
        } w-[264px] ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Subtle bottom-left violet/indigo wave accent matching dark ERP aesthetic */}
        <div
          aria-hidden="true"
          className="hidden dark:block pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-tr from-[#7C3AED]/30 via-[#4F46E5]/15 to-transparent blur-2xl"
        />

        {/* Brand Header */}
        <div className="relative z-10 h-16 px-4 border-b border-white/10 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] via-[#6366F1] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-violet-600/25 shrink-0">
                <Ship className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold tracking-tight text-white leading-tight truncate">
                  PTG PPJK
                </div>
                <div className="text-[10.5px] text-white/60 dark:text-slate-400 truncate">
                  Customs &amp; Tracking
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Perluas sidebar' : 'Lipat sidebar'}
            className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
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

        {/* Navigation Links */}
        <nav aria-label="Navigasi utama" className="relative z-10 flex-1 p-3 space-y-1.5 overflow-y-auto">
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
                  className={`w-full min-h-[42px] flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white font-semibold shadow-md dark:shadow-lg dark:shadow-violet-600/25'
                      : 'text-white/75 dark:text-slate-300/85 hover:bg-white/10 dark:hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-white/70 dark:text-slate-400'
                      }`}
                    />
                    {!collapsed && (
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    )}
                  </span>

                  {!collapsed && (
                    <span className="flex items-center gap-1.5 shrink-0">
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span
                          className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : item.id === 'surat-jalan'
                                ? 'bg-sky-500/20 text-sky-200 border border-sky-400/25'
                                : item.id === 'penagihan'
                                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/30'
                                  : 'bg-red-500/20 text-red-200 border border-red-400/25'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {!isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 dark:text-slate-600" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Bottom User Profile & Logout */}
        <div className="relative z-10 p-3.5 border-t border-white/10 dark:border-white/[0.06] shrink-0">
          {!collapsed && (
            <div className="mb-3 px-1">
              <div className="text-xs font-semibold text-white truncate">{user.nama}</div>
              <div className="text-[11px] text-white/60 dark:text-slate-400 truncate">
                {user.role}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Keluar dari akun"
            className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-transparent dark:border-white/[0.06] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
