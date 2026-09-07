import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Student, AttendanceRecord } from '../types';
import { FileDown, Calendar, Search, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { filterAndDeduplicateStudents } from '../lib/studentUtils';

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Mac' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Julai' },
    { value: 8, label: 'Ogos' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Disember' },
  ];

  const generateReport = async () => {
    setLoading(true);
    try {
      // 1. Get all students (filtered and deduplicated)
      const studentsSnap = await getDocs(collection(db, 'students'));
      const rawStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const students = filterAndDeduplicateStudents(rawStudents);

      // 2. Get all attendance for the month
      const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

      const q = query(collection(db, 'attendance'), 
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const attendanceSnap = await getDocs(q);
      const attendance = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);

      // 3. Prepare data for Excel
      const daysInMonth = eachDayOfInterval({
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0)
      });

      let grandTotalPresent = 0;
      let grandTotalMarked = 0;

      const reportData = students.map(student => {
        const studentAttendance = attendance.filter(a => a.studentId === student.id);
        const presentCount = studentAttendance.filter(a => a.status === 'Hadir').length;
        const absentCount = studentAttendance.filter(a => a.status === 'Tidak Hadir').length;
        const totalDaysMarked = studentAttendance.filter(a => a.status === 'Hadir' || a.status === 'Tidak Hadir').length;
        const percentage = totalDaysMarked > 0 ? ((presentCount / totalDaysMarked) * 100).toFixed(2) : '0.00';

        grandTotalPresent += presentCount;
        grandTotalMarked += totalDaysMarked;

        const row: any = {
          'Nama Murid': student.name,
          'Kelas': student.class,
          'Hadir (%)': `${percentage}%`,
          'Hadir (Hari)': presentCount,
          'Tidak Hadir (Hari)': absentCount,
        };

        // Add daily status
        daysInMonth.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayRecord = studentAttendance.find(a => a.date === dateStr);
          let displayStatus = '-';
          if (dayRecord) {
            if (dayRecord.status === 'Hadir') displayStatus = '/';
            else if (dayRecord.status === 'Tidak Hadir') displayStatus = 'X';
            else if (dayRecord.status === 'Cuti Sekolah') displayStatus = 'CS';
            else if (dayRecord.status === 'Cuti Umum') displayStatus = 'CU';
            else if (dayRecord.status === 'Cuti Peristiwa') displayStatus = 'CP';
          }
          row[format(day, 'd/M')] = displayStatus;
        });

        return row;
      });

      // Add overall summary row at the end
      const overallPercentage = grandTotalMarked > 0 ? ((grandTotalPresent / grandTotalMarked) * 100).toFixed(2) : '0';
      reportData.push({
        'Nama Murid': 'KESELURUHAN / RATA-RATA BULANAN',
        'Kelas': '-',
        'Hadir (%)': `${overallPercentage}%`,
        'Hadir (Hari)': '-',
        'Tidak Hadir (Hari)': '-',
      });

      // 4. Create Workbook
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kehadiran');

      // 5. Download
      XLSX.writeFile(workbook, `Laporan_Hadir_SKT_${months.find(m => m.value === month)?.label}_${year}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Ralat menjana laporan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12">
      <div className="bg-white rounded-xl p-6 sm:p-10 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 -mr-16 -mt-16" />
        
        <div className="relative z-10 flex items-center gap-6 mb-10">
          <div className="bg-slate-900 p-4 rounded-lg shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Eksport Laporan Bulanan</h2>
            <p className="text-slate-400 text-sm font-medium">Muat turun rekod kehadiran format XLSX</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block ml-1 tracking-widest">Pilih Bulan</label>
              <select 
                value={month} 
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 outline-none transition-all font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block ml-1 tracking-widest">Pilih Tahun</label>
              <select 
                value={year} 
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 outline-none transition-all font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 border-dashed">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Maklumat Laporan:</h4>
            <ul className="text-[11px] text-slate-400 space-y-1.5 font-medium leading-relaxed">
              <li className="flex items-center gap-2">• Ringkasan jumlah hadir & ponteng</li>
              <li className="flex items-center gap-2">• Pengiraan peratusan bulanan automatik</li>
              <li className="flex items-center gap-2">• Status harian (/) Hadir, (X) Absent</li>
              <li className="flex items-center gap-2">• Format standard Microsoft Excel (.xlsx)</li>
            </ul>
          </div>

          <button 
            onClick={generateReport}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 capitalize text-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            Jana & Muat Turun Fail
          </button>
        </div>
      </div>
    </div>
  );
}
