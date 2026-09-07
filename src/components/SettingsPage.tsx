import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { SystemSettings } from '../types';
import { Settings, Save, Image as ImageIcon, Layout, CheckCircle, Loader2 } from 'lucide-react';

import { cn } from '../lib/utils';

interface SettingsPageProps {
  settings: SystemSettings;
}

export default function SettingsPage({ settings }: SettingsPageProps) {
  const [systemName, setSystemName] = useState(settings.systemName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Sync state ONLY when component mounts or when not dirty/saving
  // We use a ref to track if we've initialized the state from props
  const initialized = React.useRef(false);
  
  React.useEffect(() => {
    if (!initialized.current || (!saving && !isDirty)) {
      setSystemName(settings.systemName || 'e-Hadir Asrama SKT');
      setLogoUrl(settings.logoUrl || '');
      initialized.current = true;
    }
  }, [settings.systemName, settings.logoUrl, saving, isDirty]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsDirty(true);
      setFileName(file.name);
      
      if (file.size > 1024 * 1024 * 2) { // Allow up to 2MB selection, but we will resize
        alert('Format fail disokong, sedang memproses...');
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Resize to max 192px width/height to ensure reliable storage
          const MAX_SIZE = 192;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Use PNG to preserve logo transparency
            const compressedBase64 = canvas.toDataURL('image/png');
            setLogoUrl(compressedBase64);
            console.log('Image optimized for Firestore storage', { originalSize: file.size, finalSize: compressedBase64.length });
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    
    setSaving(true);
    setSaved(false);
    
    try {
      console.log('Attempting to save settings to Firestore...', { 
        systemName, 
        logoSize: logoUrl ? Math.round(logoUrl.length / 1024) + ' KB' : '0 KB' 
      });

      // Use a timeout for the firestore operation
      const savePromise = setDoc(doc(db, 'settings', 'config'), {
        systemName: systemName.trim() || 'e-Hadir Asrama SKT',
        logoUrl: logoUrl || ''
      });

      // Simple timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Masa tamat: Rangkaian mungkin perlahan.')), 10000)
      );

      await Promise.race([savePromise, timeoutPromise]);
      
      console.log('Settings saved successfully!');
      setSaved(true);
      setIsDirty(false);
      setFileName(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('CRITICAL: Error saving settings:', err);
      alert('Gagal menyimpan tetapan: ' + (err.message || 'Sila cuba lagi atau semak sambungan internet anda.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-12">
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-10">
            <div className="bg-slate-900 p-3 sm:p-4 rounded-lg shadow-lg">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Tetapan Sistem</h2>
              <p className="text-slate-400 text-xs sm:text-sm font-medium italic">Kustomasi identiti visual & penjenamaan</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-8 sm:space-y-10">
            {/* Branding Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-4">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 ml-1">
                    <Layout className="w-3.5 h-3.5 text-blue-500" />
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nama Sistem</label>
                  </div>
                  <input 
                    type="text" 
                    value={systemName} 
                    onChange={(e) => {
                      setSystemName(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Contoh: e-Hadir Asrama SKT"
                  />
                  <p className="mt-1.5 text-[9px] text-slate-400 px-1 italic">Nama ini akan dipaparkan pada sidebar tajuk utama.</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2 ml-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Muat Naik Logo Sekolah</label>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-md p-2">
                     <label className="bg-white border border-slate-200 px-3 py-1.5 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                        Pilih Gambar
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                     </label>
                     <span className="text-[10px] text-slate-400 font-medium truncate flex-1">
                        {fileName ? `Fail: ${fileName}` : (logoUrl ? 'Gambar terpilih' : 'Tiada fail terpilih')}
                     </span>
                  </div>
                  <p className="mt-1.5 text-[9px] text-slate-400 px-1 italic">Imej akan disimpan terus ke dalam pangkalan data (Maks 500KB).</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Previu Antaramuka
                </p>
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-lg shadow-xl shadow-slate-200/50 flex items-center justify-center p-4 border border-white font-bold text-blue-600">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl">SKT</span>
                  )}
                </div>
                <div className="mt-6 text-center">
                   <p className="text-xs font-bold text-slate-700">{systemName}</p>
                   <p className="text-[9px] text-slate-400 uppercase tracking-tight font-black mt-1">Pengurusan Asrama v1.0</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[10px] text-slate-400 font-medium italic text-center sm:text-left">
                Kemaskini masa nyata akan berlaku sebaik sahaja disimpan.
              </div>
              <button 
                type="submit" 
                disabled={saving}
                className={cn(
                  "w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded shadow-sm font-bold text-sm transition-all",
                  saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saved ? 'Berjaya Disimpan' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
