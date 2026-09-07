import React, { useState } from 'react';
import { SystemSettings } from '../types';
import { Loader2, Mail, Lock, ShieldCheck } from 'lucide-react';

interface LoginProps {
  settings: SystemSettings;
  onLogin: (user: string, pass: string) => boolean;
}

export default function Login({ settings, onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Artificial delay for better UX
    setTimeout(() => {
      const success = onLogin(username, password);
      if (!success) {
        setError('Nama pengguna atau kata laluan salah');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 overflow-hidden font-sans">
      {/* ... visual side remains same ... */}
      <div className="hidden md:flex md:w-[450px] bg-slate-900 p-12 flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-2 shadow-lg shadow-slate-900/20 font-bold text-blue-600 text-[10px]">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <span>SKT</span>
            )}
          </div>
          <span className="text-white font-bold text-xl tracking-tight uppercase whitespace-pre-wrap">{settings.systemName}</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white mb-6 leading-tight tracking-tight">
            Sistem Pengurusan Kehadiran Murid Asrama SKT
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-5 border border-slate-700/50">
              <span className="block text-blue-400 text-[10px] font-black uppercase mb-1 tracking-widest">Efisien</span>
              <span className="text-slate-300 text-sm font-medium">Rekod kehadiran pantas & automatik sepenuhnya.</span>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-5 border border-slate-700/50">
              <span className="block text-blue-400 text-[10px] font-black uppercase mb-1 tracking-widest">Integriti</span>
              <span className="text-slate-300 text-sm font-medium">Data tersimpan selamat di pelayan awan.</span>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
          © 2026 Admin Asrama SKT • Professional Edition
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 relative overflow-hidden">
        {/* Subtle background decoration for mobile */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-32 -mt-32 md:hidden" />
        
        <div className="w-full max-w-sm relative z-10">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
            {/* Logo for mobile/center view */}
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center p-2 mb-4 border border-slate-100 shadow-sm">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span className="font-bold text-blue-600 text-sm italic">SKT</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">{settings.systemName || 'Sistem Kehadiran'}</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Log Masuk Pentadbiran</p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-md text-xs font-bold mb-6 animate-shake">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Nama Pengguna</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-3 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-slate-700"
                    placeholder="Username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Kata Laluan</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-3 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-slate-700"
                    placeholder="Password"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Sistem Keselamatan Warden Aktif</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded shadow-sm transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Log Masuk Sekarang
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
