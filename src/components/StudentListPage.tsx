import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Student } from '../types';
import { UserPlus, Upload, Search, Edit2, Minus, X, Check, Loader2, FileSpreadsheet, Sparkles, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import {
  cleanClassName,
  cleanDisplayName,
  filterAndDeduplicateStudents,
  normalizeStudentName,
} from '../lib/studentUtils';

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBuangModalOpen, setIsBuangModalOpen] = useState(false);
  const [itemTerpilih, setItemTerpilih] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    class: '',
    active: true
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snapshot) => {
      const rawList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const cleanList = filterAndDeduplicateStudents(rawList);
      setStudents(cleanList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        class: student.class,
        active: true
      });
    } else {
      setEditingStudent(null);
      setFormData({ name: '', class: '', active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWorking(true);
    try {
      const trimmedName = cleanDisplayName(formData.name);
      const trimmedClass = cleanClassName(formData.class);
      const normKey = normalizeStudentName(trimmedName);

      if (!normKey || trimmedName === 'TIADA NAMA') {
        setStatusMsg({ type: 'error', text: 'Sila masukkan nama murid yang sah.' });
        setIsWorking(false);
        return;
      }

      if (editingStudent) {
        // Check if another active student already has this name
        const conflict = students.find(s => s.id !== editingStudent.id && normalizeStudentName(s.name) === normKey);
        if (conflict) {
          setStatusMsg({ type: 'error', text: `Murid dengan nama "${trimmedName}" sudah wujud dalam senarai.` });
          setIsWorking(false);
          return;
        }

        await updateDoc(doc(db, 'students', editingStudent.id!), {
          name: trimmedName,
          class: trimmedClass,
          active: true,
          status: 'active',
          deleted: false,
          updatedAt: new Date().toISOString()
        });
        setStatusMsg({ type: 'success', text: `Maklumat ${trimmedName} berjaya dikemaskini!` });
      } else {
        // Adding new student: check if already exists in active students list
        const existingStudent = students.find(s => normalizeStudentName(s.name) === normKey);
        if (existingStudent) {
          setStatusMsg({ 
            type: 'error', 
            text: `Murid "${trimmedName}" sudah wujud dalam senarai (Kelas: ${existingStudent.class || 'Tiada'}). Duplikasi tidak dibenarkan.` 
          });
          setIsWorking(false);
          return;
        }

        // Check if there was a previously soft-deleted record in Firestore to reactivate
        const allDocsSnap = await getDocs(collection(db, 'students'));
        const matchedDoc = allDocsSnap.docs.find(d => normalizeStudentName(d.data().name) === normKey);
        
        if (matchedDoc) {
          // Reactivate the existing document
          await updateDoc(doc(db, 'students', matchedDoc.id), {
            name: trimmedName,
            class: trimmedClass,
            active: true,
            status: 'active',
            deleted: false,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Create new record
          await addDoc(collection(db, 'students'), {
            name: trimmedName,
            class: trimmedClass,
            active: true,
            status: 'active',
            deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        setStatusMsg({ type: 'success', text: `Murid "${trimmedName}" berjaya ditambah!` });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Ralat: ' + (err instanceof Error ? err.message : 'Gagal menyimpan.') });
    } finally {
      setIsWorking(false);
    }
  };

  const handleOpenBuangModal = (student: Student) => {
    setItemTerpilih(student);
    setIsBuangModalOpen(true);
  };

  const onExecuteRemove = async () => {
    if (!itemTerpilih || isWorking) return;
    
    setIsWorking(true);
    try {
      const studentName = itemTerpilih.name;
      const normKey = normalizeStudentName(studentName);

      // Find all docs in Firestore with this normalized name to ensure all redundant copies are marked deleted
      const allDocsSnap = await getDocs(collection(db, 'students'));
      const docsToSoftDelete = allDocsSnap.docs.filter(d => 
        d.id === itemTerpilih.id || normalizeStudentName(d.data().name) === normKey
      );

      const batch = writeBatch(db);
      docsToSoftDelete.forEach(docSnap => {
        batch.update(doc(db, 'students', docSnap.id), {
          status: 'deleted',
          active: false,
          deleted: true,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();

      setIsBuangModalOpen(false);
      setItemTerpilih(null);
      setStatusMsg({ type: 'success', text: `Rekod ${studentName} telah dipadam.` });
    } catch (err: any) {
      console.error('Removal Error:', err);
      setStatusMsg({ type: 'error', text: 'Ralat: ' + (err.message || 'Gagal memproses.') });
    } finally {
      setIsWorking(false);
    }
  };

  // Upload XLSX with automatic deduplication
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMsg({ type: 'info', text: 'Sedang membaca dan memproses fail XLSX...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (!rows || rows.length === 0) {
          setStatusMsg({ type: 'error', text: 'Fail XLSX kosong atau tiada data.' });
          setUploading(false);
          return;
        }

        // 1. Deduplicate records WITHIN the uploaded file itself
        // Map keyed by normalizeStudentName -> { rawName, cleanClass }
        const fileUniqueMap = new Map<string, { rawName: string; cleanClass: string }>();
        let duplicatesInFileCount = 0;

        for (const row of rows) {
          // Check common column name variations
          const rawName = String(
            row.Nama || 
            row['Nama Murid'] || 
            row['NAMA MURID'] || 
            row['Nama Penuh'] || 
            row['NAMA PENUH'] || 
            row.NAMA || 
            row.Name || 
            row.NAME || 
            row.name || 
            row.Murid || 
            ''
          ).trim();

          // Skip header repetitions or empty rows
          if (!rawName || rawName.toUpperCase() === 'NAMA' || rawName.toUpperCase() === 'TIADA NAMA') {
            continue;
          }

          const rawClass = String(
            row.Kelas || 
            row.KELAS || 
            row.Class || 
            row.CLASS || 
            row.class || 
            row.Tingkatan || 
            row.TINGKATAN || 
            row.Tahun || 
            row.TAHUN || 
            ''
          ).trim();

          const normKey = normalizeStudentName(rawName);
          if (!normKey) continue;

          if (fileUniqueMap.has(normKey)) {
            duplicatesInFileCount++;
            // If previous entry had no class and this row has class info, update it
            const prev = fileUniqueMap.get(normKey)!;
            if ((!prev.cleanClass || prev.cleanClass === '') && rawClass !== '') {
              fileUniqueMap.set(normKey, { rawName: prev.rawName, cleanClass: rawClass });
            }
          } else {
            fileUniqueMap.set(normKey, { rawName, cleanClass: rawClass });
          }
        }

        const totalUniqueInFile = fileUniqueMap.size;
        if (totalUniqueInFile === 0) {
          setStatusMsg({ type: 'error', text: 'Tiada nama murid sah dijumpai dalam fail XLSX. Sila pastikan ruangan "Nama" dan "Kelas" diisi mengikut template.' });
          setUploading(false);
          return;
        }

        // 2. Fetch all existing Firestore docs to cross-reference
        const existingDocsSnap = await getDocs(collection(db, 'students'));
        const existingDocsByNormKey = new Map<string, Array<{ id: string; data: any }>>();

        existingDocsSnap.docs.forEach(d => {
          const studentData = d.data();
          const key = normalizeStudentName(studentData.name);
          if (!key) return;
          if (!existingDocsByNormKey.has(key)) {
            existingDocsByNormKey.set(key, []);
          }
          existingDocsByNormKey.get(key)!.push({ id: d.id, data: studentData });
        });

        // 3. Prepare batched writes (up to 400 operations per batch)
        const batchList: Array<ReturnType<typeof writeBatch>> = [];
        let currentBatch = writeBatch(db);
        let currentOpCount = 0;

        const addOp = () => {
          currentOpCount++;
          if (currentOpCount >= 400) {
            batchList.push(currentBatch);
            currentBatch = writeBatch(db);
            currentOpCount = 0;
          }
        };

        let newAddedCount = 0;
        let updatedCount = 0;

        for (const [normKey, { rawName, cleanClass }] of fileUniqueMap.entries()) {
          const finalDisplayName = cleanDisplayName(rawName);
          const finalClassName = cleanClassName(cleanClass);

          const existingMatches = existingDocsByNormKey.get(normKey);

          if (existingMatches && existingMatches.length > 0) {
            // Document already exists in Firestore!
            // Update the primary document to be active and have the latest class
            const primaryDoc = existingMatches[0];
            const updatedClass = finalClassName || cleanClassName(primaryDoc.data.class) || '';

            currentBatch.update(doc(db, 'students', primaryDoc.id), {
              name: finalDisplayName,
              class: updatedClass,
              active: true,
              status: 'active',
              deleted: false,
              updatedAt: new Date().toISOString()
            });
            addOp();
            updatedCount++;

            // If there were redundant duplicate documents in Firestore for this name, mark them deleted
            for (let i = 1; i < existingMatches.length; i++) {
              currentBatch.update(doc(db, 'students', existingMatches[i].id), {
                status: 'deleted',
                active: false,
                deleted: true,
                updatedAt: new Date().toISOString()
              });
              addOp();
            }
          } else {
            // New student: create brand new document
            const newRef = doc(collection(db, 'students'));
            currentBatch.set(newRef, {
              name: finalDisplayName,
              class: finalClassName,
              active: true,
              status: 'active',
              deleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            addOp();
            newAddedCount++;
          }
        }

        if (currentOpCount > 0) {
          batchList.push(currentBatch);
        }

        // Commit all batches sequentially
        for (const b of batchList) {
          await b.commit();
        }

        let msg = `Berjaya memproses ${totalUniqueInFile} murid unik (${newAddedCount} baru, ${updatedCount} dikemaskini).`;
        if (duplicatesInFileCount > 0) {
          msg += ` Sebanyak ${duplicatesInFileCount} nama berulang dalam template telah digabungkan secara automatik.`;
        }

        setStatusMsg({ type: 'success', text: msg });
      } catch (err) {
        console.error('Error importing XLSX:', err);
        setStatusMsg({ type: 'error', text: 'Ralat memproses fail XLSX. Sila pastikan format sah.' });
      } finally {
        setUploading(false);
        // Reset file input value so user can upload same file again if desired
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { 'Nama': 'AHMAD BIN ALI', 'Kelas': '6 CEMERLANG' },
      { 'Nama': 'SITI BINTI ABU', 'Kelas': '5 GEMERLAP' },
      { 'Nama': 'MUHAMMAD AMIR BIN OTHMAN', 'Kelas': '4 BESTARI' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Senarai_Murid.xlsx');
  };

  // Clean all existing duplicates in database if any exist
  const handleConsolidateDatabaseDuplicates = async () => {
    setIsWorking(true);
    try {
      const allDocsSnap = await getDocs(collection(db, 'students'));
      const activeGroups = new Map<string, Array<{ id: string; data: any }>>();

      allDocsSnap.docs.forEach(d => {
        const data = d.data();
        // Only consider non-deleted records
        if (data.status === 'deleted' || data.active === false || data.deleted === true) return;
        const key = normalizeStudentName(data.name);
        if (!key) return;
        if (!activeGroups.has(key)) {
          activeGroups.set(key, []);
        }
        activeGroups.get(key)!.push({ id: d.id, data });
      });

      let duplicateDocsFound = 0;
      const batch = writeBatch(db);

      activeGroups.forEach((docList) => {
        if (docList.length > 1) {
          // Keep first doc, mark remaining as deleted
          for (let i = 1; i < docList.length; i++) {
            batch.update(doc(db, 'students', docList[i].id), {
              status: 'deleted',
              active: false,
              deleted: true,
              updatedAt: new Date().toISOString()
            });
            duplicateDocsFound++;
          }
        }
      });

      if (duplicateDocsFound > 0) {
        await batch.commit();
        setStatusMsg({ type: 'success', text: `Berjaya membersihkan ${duplicateDocsFound} rekod duplikasi daripada pangkalan data!` });
      } else {
        setStatusMsg({ type: 'info', text: 'Tiada rekod duplikasi dijumpai. Pangkalan data anda sudah bersih dan teratur.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Ralat: ' + (err.message || 'Gagal membersihkan duplikasi.') });
    } finally {
      setIsWorking(false);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (s.class || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className={cn(
          "fixed top-4 right-4 z-[99] px-6 py-4 rounded-lg shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3 max-w-lg",
          statusMsg.type === 'success' ? "bg-emerald-600 text-white" :
          statusMsg.type === 'error' ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
        )}>
          {statusMsg.type === 'error' && <X className="w-5 h-5 shrink-0" />}
          {statusMsg.type === 'success' && <Check className="w-5 h-5 shrink-0" />}
          {statusMsg.type === 'info' && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
          <span className="leading-snug">{statusMsg.text}</span>
        </div>
      )}

      {/* Header Stat & Action Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Murid Asrama</h3>
              <span className="text-xl font-black text-slate-800">{students.length} Orang</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

          <div className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama atau kelas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 pl-9 pr-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium outline-none"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-md shadow-sm text-xs font-bold transition-colors cursor-pointer"
            title="Muat turun template Excel untuk muat naik senarai murid"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Template XLSX
          </button>

          <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-md shadow-sm text-xs font-bold transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? 'Memproses...' : 'Muat naik XLSX'}
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-md shadow-sm text-xs font-bold transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Murid
          </button>

          <button 
            onClick={handleConsolidateDatabaseDuplicates}
            disabled={isWorking}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold transition-colors"
            title="Periksa dan buang sebarang nama berulang dalam pangkalan data secara automatik"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Semak Duplikasi
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest w-16">Bil</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Nama Penuh Murid</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-center">Kelas</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm whitespace-nowrap">{student.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">
                        {student.class || 'Tiada Kelas'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(student)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Kemaskini"
                        >
                          <Edit2 className="w-4.5 h-4.5" />
                        </button>
                        <button 
                          onClick={() => handleOpenBuangModal(student)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Padam Murid"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Memuatkan senarai murid...</span>
                      </div>
                    ) : searchTerm ? (
                      `Tiada murid sepadan dengan carian "${searchTerm}".`
                    ) : (
                      'Tiada murid dalam pangkalan data. Sila gunakan "Muat naik XLSX" atau "Tambah Murid".'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary Count */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>Menunjukkan {filteredStudents.length} daripada {students.length} murid aktif</span>
          <span className="text-[11px] text-slate-400 font-normal">* Setiap murid dipaparkan sekali sahaja secara unik tanpa duplikasi.</span>
        </div>
      </div>

      {/* Modal Kemaskini / Tambah */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white border-b border-slate-800">
              <h3 className="font-bold text-sm tracking-tight capitalize">
                {editingStudent ? 'Kemaskini Maklumat Murid' : 'Tambah Murid Asrama Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block tracking-wider">
                    Nama Penuh Murid
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={isWorking}
                    placeholder="Contoh: AHMAD BIN ALI"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 font-bold uppercase"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Nama murid akan dipastikan unik secara automatik.</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block tracking-wider">
                    Kelas / Tingkatan
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.class} 
                    onChange={(e) => setFormData({...formData, class: e.target.value})}
                    disabled={isWorking}
                    placeholder="Contoh: 6 CEMERLANG"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 font-semibold uppercase"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setIsModalOpen(false)} 
                   disabled={isWorking} 
                   className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-md text-sm hover:bg-slate-200 transition-all capitalize"
                 >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isWorking} 
                    className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-md text-sm shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 capitalize"
                  >
                    {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Simpan Murid
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buang */}
      {isBuangModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Minus className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Padam Rekod Murid?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Adakah anda pasti mahu memadam <span className="font-bold text-slate-800">{itemTerpilih?.name}</span>?
                Nama murid ini akan dikeluarkan daripada senarai murid dan halaman isi kehadiran.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsBuangModalOpen(false)} 
                  disabled={isWorking}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-md text-sm hover:bg-slate-200 transition-all capitalize"
                >
                  Batal
                </button>
                <button 
                  onClick={onExecuteRemove}
                  disabled={isWorking}
                  className="flex-1 bg-rose-600 text-white font-bold py-2.5 rounded-md text-sm shadow-md hover:bg-rose-700 transition-all flex items-center justify-center gap-2 capitalize"
                >
                  {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Ya, Padam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
