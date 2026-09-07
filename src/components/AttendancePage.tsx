import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, Timestamp, getDocs, where, writeBatch } from 'firebase/firestore';
import { Student, AttendanceRecord, AttendanceStatus, DayStatus } from '../types';
import { format } from 'date-fns';
import { Check, X, Calendar as CalendarIcon, Loader2, Save, Coffee, Info, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { filterAndDeduplicateStudents } from '../lib/studentUtils';

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | DayStatus>>({});
  const [holidayType, setHolidayType] = useState<DayStatus>('Sekolah');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Synchronize student list using exact same filtering and deduplication as StudentListPage
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const rawList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const cleanSortedStudents = filterAndDeduplicateStudents(rawList);
      setStudents(cleanSortedStudents);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoading(false);
    });

    return () => unsubStudents();
  }, []);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
        const snapshot = await getDocs(q);
        const records: Record<string, AttendanceStatus | DayStatus> = {};
        
        let dayStatus: DayStatus = 'Sekolah';
        
        snapshot.docs.forEach(d => {
          const data = d.data() as AttendanceRecord;
          if (['Cuti Sekolah', 'Cuti Umum', 'Cuti Peristiwa'].includes(data.status)) {
            dayStatus = data.status as DayStatus;
          }
          records[data.studentId] = data.status as AttendanceStatus | DayStatus;
        });
        
        setAttendance(records);
        setHolidayType(dayStatus);
      } catch (err) {
        console.error('Error fetching attendance records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [selectedDate]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus | DayStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleDeclareHoliday = (type: DayStatus) => {
    setHolidayType(type);
    const newAttendance: Record<string, AttendanceStatus | DayStatus> = {};
    students.forEach(s => {
      newAttendance[s.id!] = type === 'Sekolah' ? (attendance[s.id!] || 'Hadir') : type;
    });
    setAttendance(newAttendance);
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const newAttendance: Record<string, AttendanceStatus | DayStatus> = {};
    students.forEach(s => {
      newAttendance[s.id!] = status;
    });
    setAttendance(newAttendance);
  };

  const saveBatch = async () => {
    if (students.length === 0) {
      setStatusMsg({ type: 'error', text: 'Tiada murid untuk disimpan.' });
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Only save attendance for active, deduplicated students currently on the list
      students.forEach(student => {
        const studentId = student.id;
        const status = holidayType !== 'Sekolah' ? holidayType : (attendance[studentId] || 'Hadir');
        const id = `${selectedDate}_${studentId}`;
        const docRef = doc(db, 'attendance', id);
        batch.set(docRef, {
          studentId,
          date: selectedDate,
          status,
          markedBy: 'warden_utama',
          timestamp: Timestamp.now()
        });
      });
      
      await batch.commit();
      setStatusMsg({ type: 'success', text: `Kehadiran untuk ${students.length} murid pada ${selectedDate} berjaya disimpan!` });
    } catch (err) {
      console.error('Error saving batch attendance:', err);
      setStatusMsg({ type: 'error', text: 'Gagal menyimpan rekod kehadiran.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Memuatkan senarai kehadiran...</p>
      </div>
    );
  }

  const isHoliday = holidayType !== 'Sekolah';

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className={cn(
          "fixed top-4 right-4 z-[99] px-6 py-4 rounded-lg shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3",
          statusMsg.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {statusMsg.type === 'error' && <X className="w-5 h-5" />}
          {statusMsg.type === 'success' && <Check className="w-5 h-5" />}
          {statusMsg.text}
        </div>
      )}

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 text-slate-600 p-2.5 rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarikh Kehadiran</h3>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-0.5 block w-full bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Jumlah Murid</h3>
              <span className="text-sm font-black text-slate-800">{students.length} Orang</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Status Hari Ini</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {(['Sekolah', 'Cuti Sekolah', 'Cuti Umum', 'Cuti Peristiwa'] as DayStatus[]).map(type => (
                <button
                  key={type}
                  onClick={() => handleDeclareHoliday(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border whitespace-nowrap cursor-pointer",
                    holidayType === type 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {!isHoliday && (
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              <button
                onClick={() => handleMarkAll('Hadir')}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-200 transition-colors"
              >
                Tanda Semua Hadir
              </button>
              <button
                onClick={() => handleMarkAll('Tidak Hadir')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded border border-rose-200 transition-colors"
              >
                Tanda Semua Absent
              </button>
            </div>
          )}

          <button 
            onClick={saveBatch}
            disabled={saving || students.length === 0}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded shadow-lg shadow-blue-600/20 text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Rekod
          </button>
        </div>
      </div>

      {isHoliday && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-4"
        >
          <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Hari ini atau tarikh ini telah ditetapkan sebagai {holidayType}</h4>
            <p className="text-amber-700 text-xs mt-0.5">Semua murid ditanda secara automatik mengikut status hari ini. Klik "Simpan Rekod" untuk mengesahkan.</p>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest w-16">Bil</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Maklumat Murid</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-center">Tanda Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student, index) => (
                <tr key={student.id} className={cn("hover:bg-slate-50/50 transition-colors", isHoliday && "opacity-50 pointer-events-none")}>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                  <td className="px-6 py-4 border-l-4 border-transparent hover:border-blue-500 transition-all">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-tight whitespace-nowrap mt-0.5">
                        Kelas: {student.class || 'Tiada Kelas'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <StatusButton 
                        active={attendance[student.id!] === 'Hadir' || (!attendance[student.id!] && !isHoliday)} 
                        onClick={() => handleStatusChange(student.id!, 'Hadir')}
                        icon={Check}
                        label="HADIR"
                        activeClass="bg-emerald-600 text-white shadow-sm"
                        inactiveClass="text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70"
                      />
                      <StatusButton 
                        active={attendance[student.id!] === 'Tidak Hadir'} 
                        onClick={() => handleStatusChange(student.id!, 'Tidak Hadir')}
                        icon={X}
                        label="ABSENT"
                        activeClass="bg-rose-600 text-white shadow-sm"
                        inactiveClass="text-rose-700 bg-rose-50 hover:bg-rose-100/70"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>Jumlah murid dalam senarai kehadiran: {students.length} orang</span>
          <span className="text-[11px] text-slate-400 font-normal">Sama persis dengan halaman Senarai Murid. Murid yang dipadam telah dikeluarkan.</span>
        </div>
      </div>
      
      {students.length === 0 && !loading && (
        <div className="bg-white p-16 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
          <Info className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-bold text-slate-800">Tiada Murid Dijumpai</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Sila muat naik template XLSX atau tambah murid di menu "Senarai Murid" terlebih dahulu.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusButton({ active, onClick, icon: Icon, label, activeClass, inactiveClass }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all border border-transparent cursor-pointer",
        active ? activeClass : inactiveClass
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
