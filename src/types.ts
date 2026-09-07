export interface Student {
  id: string;
  name: string;
  class: string;
  active: boolean;
  status?: 'active' | 'deleted' | string;
  deleted?: boolean;
  updatedAt?: string;
}

export type AttendanceStatus = 'Hadir' | 'Tidak Hadir';

export type DayStatus = 'Sekolah' | 'Cuti Sekolah' | 'Cuti Umum' | 'Cuti Peristiwa';

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus | DayStatus;
  markedBy: string;
  timestamp: any; // Firestore Timestamp
}

export interface SystemSettings {
  systemName: string;
  logoUrl: string;
}
