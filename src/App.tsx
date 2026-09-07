import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SystemSettings } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import AttendancePage from './components/AttendancePage';
import StudentListPage from './components/StudentListPage';
import ReportsPage from './components/ReportsPage';
import SettingsPage from './components/SettingsPage';
import { LogOut, Home, CheckSquare, Users, FileText, Settings, Loader2, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: 'e-Hadir Asrama SKT',
    logoUrl: ''
  });

  useEffect(() => {
    // Check local storage for session
    const session = localStorage.getItem('skt_session');
    if (session === 'active') {
      setIsLoggedIn(true);
    }
    setLoading(false);

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemSettings;
        console.log('Settings updated from Firestore', { name: data.systemName, logoLength: data.logoUrl?.length });
        setSettings({
          systemName: data.systemName || 'e-Hadir Asrama SKT',
          logoUrl: data.logoUrl || ''
        });
      } else {
        console.log('Settings document does not exist, using defaults');
      }
    }, (error) => {
      console.error('Error listening to settings:', error);
    });

    return () => {
      settingsUnsubscribe();
    };
  }, []);

  const handleLogin = (user: string, pass: string) => {
    if (user === 'warden' && pass === '123') {
      setIsLoggedIn(true);
      localStorage.setItem('skt_session', 'active');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('skt_session');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login settings={settings} onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'attendance': return <AttendancePage />;
      case 'students': return <StudentListPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage settings={settings} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 overflow-hidden font-sans relative">
      {/* Sidebar - Mobile Overlay */}
      <div 
        className={cn(
            "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
            isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar - Desktop & Mobile */}
      <div className={cn(
          "fixed inset-y-0 left-0 z-50 lg:relative lg:block transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab: string) => {
              setActiveTab(tab);
              setIsSidebarOpen(false);
          }} 
          settings={settings} 
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded p-0.5 flex items-center justify-center font-bold text-blue-600 text-[10px]">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span>SKT</span>
                )}
              </div>
              <span className="font-bold text-sm tracking-tight uppercase">{settings.systemName}</span>
           </div>
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="p-2 hover:bg-slate-800 rounded-md transition-colors"
           >
              <Menu className="w-6 h-6" />
           </button>
        </header>

        <div className="flex-1 p-4 sm:p-8 space-y-6">
            <header className="hidden lg:flex justify-between items-end mb-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-800 capitalize">
                  {activeTab === 'dashboard' ? 'Ringkasan Dashboard' : 
                   activeTab === 'attendance' ? 'Isi Kehadiran' :
                   activeTab === 'students' ? 'Senarai Murid' :
                   activeTab === 'reports' ? 'Laporan Kehadiran' : 'Tetapan Sistem'}
                </h2>
                <p className="text-slate-500 text-sm italic">Selamat datang, Warden Utama</p>
              </div>
              <div className="flex gap-3">
                 <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors border border-slate-200 bg-white shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Log Keluar
                </button>
              </div>
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="pb-20 lg:pb-0"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
        </div>

        {/* Floating Logout for Mobile */}
        <button
          onClick={handleLogout}
          className="lg:hidden fixed bottom-6 right-6 w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl z-20 border border-slate-700"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </main>
    </div>
  );
}
