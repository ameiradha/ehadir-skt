import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { Student, AttendanceRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Users, CheckCircle, XCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

import { cn } from '../lib/utils';
import { filterAndDeduplicateStudents } from '../lib/studentUtils';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    holidayToday: null as string | null,
  });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setLoading(true);
    
    // Fetch total students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const rawList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeStudents = filterAndDeduplicateStudents(rawList);
      setStats(prev => ({ ...prev, totalStudents: activeStudents.length }));
      setLoading(false); // Always stop loading once we get a snapshot
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoading(false); // Stop loading on error too
    });

    // Fetch daily attendance
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsubAttendance = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => d.data() as AttendanceRecord);
      setStats(prev => ({
        ...prev,
        presentToday: records.filter(r => r.status === 'Hadir').length,
        absentToday: records.filter(r => r.status === 'Tidak Hadir').length,
        holidayToday: records.filter(r => ['Cuti Sekolah', 'Cuti Umum', 'Cuti Peristiwa'].includes(r.status)).length > 0
          ? (records.find(r => ['Cuti Sekolah', 'Cuti Umum', 'Cuti Peristiwa'].includes(r.status))?.status as string)
          : null,
      }));
    }, (error) => {
      console.error('Error fetching attendance in Dashboard:', error);
    });

    // Fetch monthly trend (last 7 days for now)
    const fetchTrend = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const trendData = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        
        const qD = query(collection(db, 'attendance'), where('date', '==', dateStr));
        const snap = await getDocs(qD);
        trendData.push({
          name: format(d, 'dd/MM'),
          present: snap.docs.filter(doc => doc.data().status === 'Hadir').length,
          absent: snap.docs.filter(doc => doc.data().status === 'Tidak Hadir').length,
        });
      }
      setDailyData(trendData.reverse());
      setLoading(false);
    };

    fetchTrend();

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, []);

  const pieData = [
    { name: 'Hadir', value: stats.presentToday, color: '#2563eb' },
    { name: 'Tidak Hadir', value: stats.absentToday, color: '#dc2626' },
    { name: 'Belum Diisi', value: Math.max(0, stats.totalStudents - (stats.presentToday + stats.absentToday)), color: '#e5e7eb' }
  ];

  if (stats.holidayToday) {
     pieData.unshift({ name: 'Cuti', value: stats.totalStudents, color: '#64748b' });
  }

  if (loading && stats.totalStudents === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Mendapatkan data murid...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {stats.totalStudents === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-4">
          <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Tiada Murid Dikesan</h4>
            <p className="text-amber-700 text-xs mt-0.5">Sila pastikan anda telah memuat naik senarai murid di bahagian "Senarai Murid" untuk mula memaparkan statistik.</p>
          </div>
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Jumlah Murid" value={stats.totalStudents} subtext="Berdasarkan pendaftaran" />
        <StatCard 
          icon={CheckCircle} 
          label="Hadir Hari Ini" 
          value={stats.holidayToday ? 'CUTI' : stats.presentToday} 
          valueColor={stats.holidayToday ? 'text-slate-500' : 'text-emerald-600'} 
          subtext={stats.holidayToday ? stats.holidayToday : `${stats.totalStudents > 0 ? ((stats.presentToday / stats.totalStudents) * 100).toFixed(1) : 0}% Kehadiran`} 
        />
        <StatCard icon={XCircle} label="Tidak Hadir" value={stats.holidayToday ? 0 : stats.absentToday} valueColor="text-rose-500" subtext="Bukan alasan rasmi" />
        <StatCard icon={Clock} label="Peratusan Bulanan" value={`${stats.totalStudents > 0 ? ((stats.presentToday / stats.totalStudents) * 100).toFixed(1) : 0}%`} subtext="Sasaran: 97.0%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Weekly Trend */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-bold text-sm text-slate-800">Trend Kehadiran Mingguan</h4>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="present" name="Hadir" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Distribution */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-bold text-sm text-slate-800 mb-6">Status Kehadiran Hari Ini</h4>
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 space-y-3">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px] font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-500 uppercase tracking-wider">{item.name}</span>
                  </div>
                  <span className="text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, valueColor = "text-slate-800", subtext }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition-colors">
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <h3 className={cn("text-3xl font-bold", valueColor)}>{value}</h3>
      <p className="text-slate-400 text-[10px] mt-1 font-medium italic">{subtext}</p>
      <div className="absolute top-2 right-2 opacity-5">
        <Icon className="w-12 h-12" />
      </div>
    </div>
  );
}
