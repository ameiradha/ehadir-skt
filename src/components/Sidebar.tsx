import React from 'react';
import { Home, CheckSquare, Users, FileText, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { SystemSettings } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: SystemSettings;
}

export default function Sidebar({ activeTab, setActiveTab, settings }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'attendance', label: 'Isi Kehadiran', icon: CheckSquare },
    { id: 'students', label: 'Senarai Murid', icon: Users },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'settings', label: 'Tetapan', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 z-10 shrink-0 shadow-2xl lg:shadow-none">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800 shrink-0">
        <div className="w-10 h-10 rounded bg-white flex items-center justify-center p-1 font-bold text-blue-600 shadow-sm shadow-black/20 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-sm">SKT</span>
            )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-white text-sm leading-tight">{settings.systemName}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Sistem Kehadiran</span>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-200 group text-sm font-medium",
              activeTab === item.id
                ? "bg-blue-600/10 text-blue-400"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            )}
          >
            <item.icon className={cn(
                "w-5 h-5",
                activeTab === item.id ? "text-blue-400" : "text-slate-500 group-hover:text-slate-100"
            )} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Status Sistem</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[11px] font-semibold text-slate-400">Terhubung</span>
          </div>
        </div>
      </div>
    </div>
  );
}
