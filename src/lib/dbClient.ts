import { createClient } from '@supabase/supabase-js';
import { ClassData, JurnalMengajar, ModulAjar, RubrikFisik } from '../types';
import { INITIAL_CLASSES, INITIAL_JOURNALS, INITIAL_MODULS, PREBUILT_RUBRIKS } from '../data';

// Local storage keys
const STORAGE_KEYS = {
  CLASSES: 'sadar_pjok_classes',
  MODULS: 'sadar_pjok_moduls',
  JOURNALS: 'sadar_pjok_journals',
  RUBRIKS: 'sadar_pjok_rubriks',
  SUPABASE_URL: 'sadar_pjok_client_supabase_url',
  SUPABASE_ANON_KEY: 'sadar_pjok_client_supabase_anon_key',
};

// Check if client-side Supabase is configured
export function getClientSupabaseCredentials() {
  const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
  const anonKey = localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
  if (url && anonKey) {
    return { url, anonKey };
  }
  return {
    url: 'https://gohycvfxflwwmdogiwse.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvaHljdmZ4Zmx3d21kb2dpd3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjAxODIsImV4cCI6MjEwMDg5NjE4Mn0.kUE56HSrf0AZB0a7HFDz2mjrEaPskQ-4RSOWDhrymPQ'
  };
}

export function saveClientSupabaseCredentials(url: string, anonKey: string) {
  if (url.trim() && anonKey.trim()) {
    localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, anonKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
  }
}

export function clearClientSupabaseCredentials() {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
}

// Instantiate client-side Supabase if config exists
let clientSupabaseInstance: any = null;
export function getClientSupabase() {
  const creds = getClientSupabaseCredentials();
  if (!creds) {
    clientSupabaseInstance = null;
    return null;
  }
  if (!clientSupabaseInstance) {
    try {
      let cleanedUrl = creds.url;
      if (cleanedUrl.endsWith('/rest/v1/')) {
        cleanedUrl = cleanedUrl.slice(0, -9);
      } else if (cleanedUrl.endsWith('/rest/v1')) {
        cleanedUrl = cleanedUrl.slice(0, -8);
      }
      clientSupabaseInstance = createClient(cleanedUrl, creds.anonKey);
    } catch (e) {
      console.error('Error creating client-side Supabase:', e);
      return null;
    }
  }
  return clientSupabaseInstance;
}

// Check status (Unified status checker for Header/Settings view)
export interface UnifiedDbStatus {
  configured: boolean; // Is Supabase configured (either client or server)
  isClientSide: boolean; // Is it client-side config?
  connected: boolean; // Is connection working
  allExist: boolean; // Do tables exist
  tables: {
    classes: boolean;
    moduls: boolean;
    journals: boolean;
    rubriks: boolean;
  };
  error: string | null;
  sqlScript: string;
}

export async function checkUnifiedDbStatus(): Promise<UnifiedDbStatus> {
  const clientCreds = getClientSupabaseCredentials();
  
  // 1. Try to check Server-side configuration first
  try {
    const res = await fetch('/api/supabase-status');
    if (res.ok) {
      const serverStatus = await res.json();
      if (serverStatus.configured) {
        return {
          configured: true,
          isClientSide: false,
          connected: serverStatus.connected,
          allExist: serverStatus.allExist,
          tables: serverStatus.tables,
          error: serverStatus.error,
          sqlScript: serverStatus.sqlScript
        };
      }
    }
  } catch (e) {
    // API failed, we might be on static Vercel build
    console.log('[Unified DB Check] API status endpoint not reachable. Falling back to client-side checks.');
  }

  // 2. Try Client-side configuration if server is not configured
  if (clientCreds) {
    const supabase = getClientSupabase();
    if (supabase) {
      const tables = { classes: false, moduls: false, journals: false, rubriks: false };
      let allExist = false;
      let connected = false;
      let errorMsg: string | null = null;

      try {
        const [resClasses, resModuls, resJournals, resRubriks] = await Promise.all([
          supabase.from('classes').select('id').limit(1),
          supabase.from('moduls').select('id').limit(1),
          supabase.from('journals').select('id').limit(1),
          supabase.from('rubriks').select('id').limit(1)
        ]);

        connected = true;
        tables.classes = !resClasses.error || resClasses.error.code !== '42P01';
        tables.moduls = !resModuls.error || resModuls.error.code !== '42P01';
        tables.journals = !resJournals.error || resJournals.error.code !== '42P01';
        tables.rubriks = !resRubriks.error || resRubriks.error.code !== '42P01';
        
        allExist = tables.classes && tables.moduls && tables.journals && tables.rubriks;
        if (resClasses.error && resClasses.error.code !== '42P01') {
          errorMsg = resClasses.error.message;
        }
      } catch (err: any) {
        errorMsg = err.message || 'Gagal menyambung ke Supabase dari peramban.';
      }

      return {
        configured: true,
        isClientSide: true,
        connected,
        allExist,
        tables,
        error: errorMsg,
        sqlScript: DEFAULT_SQL_SCRIPT
      };
    }
  }

  // 3. Fallback to Local Storage only
  return {
    configured: false,
    isClientSide: false,
    connected: false,
    allExist: false,
    tables: { classes: false, moduls: false, journals: false, rubriks: false },
    error: 'Supabase belum dikonfigurasi di server maupun peramban. Menggunakan Penyimpanan Lokal.',
    sqlScript: DEFAULT_SQL_SCRIPT
  };
}

// Helper to load fallback data from localStorage or standard mock data
function getLocalFallback<T>(key: string, initialData: T): T {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch (e) {
      console.error(`Error parsing localStorage key: ${key}`, e);
    }
  }
  return initialData;
}

function saveLocalFallback<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

function normalizeClasses(classes: ClassData[]): ClassData[] {
  if (!Array.isArray(classes)) return [];
  return classes.map(cls => ({
    ...cls,
    students: (cls.students || []).map(st => {
      const rawG = String(st.gender || '').trim().toUpperCase();
      const validGender: 'L' | 'P' = (rawG === 'P' || rawG === 'PEREMPUAN' || rawG === 'W' || rawG === 'WANITA' || rawG === 'FEMALE') ? 'P' : 'L';
      return {
        ...st,
        gender: validGender
      };
    })
  }));
}

// Unified CRUD operations
export async function getClasses(): Promise<ClassData[]> {
  // Check client Supabase
  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      const { data, error } = await clientSupabase.from('classes').select('*').order('name');
      if (!error && data) {
        const normalized = normalizeClasses(data as ClassData[]);
        saveLocalFallback(STORAGE_KEYS.CLASSES, normalized);
        return normalized;
      }
    } catch (e) {
      console.error('Error fetching classes from client Supabase:', e);
    }
  }

  // Check Server Supabase Proxy
  try {
    const res = await fetch('/api/classes');
    if (res.ok) {
      const data = await res.json();
      const normalized = normalizeClasses(data);
      saveLocalFallback(STORAGE_KEYS.CLASSES, normalized);
      return normalized;
    }
  } catch (e) {
    console.log('[DB Client] API /api/classes failed, using local storage.');
  }

  // Fallback to Local Storage
  const local = getLocalFallback<ClassData[]>(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
  return normalizeClasses(local);
}

export async function saveClasses(allClasses: ClassData[]): Promise<boolean> {
  // Always update local storage first (offline compatibility)
  saveLocalFallback(STORAGE_KEYS.CLASSES, allClasses);

  // Sync to Client Supabase
  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      for (const cls of allClasses) {
        await clientSupabase.from('classes').upsert({
          id: cls.id,
          name: cls.name,
          grade: cls.grade,
          students: cls.students
        });
      }
      return true;
    } catch (e) {
      console.error('Error syncing classes to client Supabase:', e);
    }
  }

  // Sync to Server Supabase Proxy
  try {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allClasses)
    });
    return res.ok;
  } catch (e) {
    console.error('[DB Client] API save classes failed:', e);
    return false;
  }
}

export async function deleteClass(classId: string): Promise<boolean> {
  const current = await getClasses();
  const updated = current.filter(c => c.id !== classId);
  saveLocalFallback(STORAGE_KEYS.CLASSES, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('classes').delete().eq('id', classId);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    await fetch(`/api/classes/${classId}`, { method: 'DELETE' }).catch(() => null);
  } catch (e) {}
  
  return true;
}

export async function getModuls(): Promise<ModulAjar[]> {
  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      const { data, error } = await clientSupabase.from('moduls').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          grade: d.grade,
          semester: d.semester,
          materiPokok: d.materi_pokok,
          alokasiWaktu: d.alokasi_waktu,
          tujuanPembelajaran: d.tujuan_pembelajaran,
          kegiatanPembelajaran: d.kegiatan_pembelajaran,
          saranaPrasarana: d.sarana_prasarana,
          rubrikPenilaian: d.rubrik_penilaian,
          createdAt: d.created_at
        }));
        saveLocalFallback(STORAGE_KEYS.MODULS, mapped);
        return mapped as ModulAjar[];
      }
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/moduls');
    if (res.ok) {
      const data = await res.json();
      saveLocalFallback(STORAGE_KEYS.MODULS, data);
      return data;
    }
  } catch (e) {}

  return getLocalFallback<ModulAjar[]>(STORAGE_KEYS.MODULS, INITIAL_MODULS);
}

export async function saveModul(modul: ModulAjar): Promise<boolean> {
  const current = await getModuls();
  const exists = current.some(m => m.id === modul.id);
  const updated = exists ? current.map(m => m.id === modul.id ? modul : m) : [modul, ...current];
  saveLocalFallback(STORAGE_KEYS.MODULS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('moduls').upsert({
        id: modul.id,
        title: modul.title,
        grade: modul.grade,
        semester: modul.semester,
        materi_pokok: modul.materiPokok,
        alokasi_waktu: modul.alokasiWaktu,
        tujuan_pembelajaran: modul.tujuanPembelajaran,
        kegiatan_pembelajaran: modul.kegiatanPembelajaran,
        sarana_prasarana: modul.saranaPrasarana,
        rubrik_penilaian: modul.rubrikPenilaian,
        created_at: modul.createdAt
      });
      return true;
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/moduls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modul)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteModul(id: string): Promise<boolean> {
  const current = await getModuls();
  const updated = current.filter(m => m.id !== id);
  saveLocalFallback(STORAGE_KEYS.MODULS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('moduls').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    await fetch(`/api/moduls/${id}`, { method: 'DELETE' }).catch(() => null);
  } catch (e) {}

  return true;
}

export async function getJournals(): Promise<JurnalMengajar[]> {
  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      const { data, error } = await clientSupabase.from('journals').select('*').order('date', { ascending: false });
      if (!error && data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          date: d.date,
          classId: d.class_id,
          className: d.class_name,
          materi: d.materi,
          catatanKejadian: d.catatan_kejadian,
          tindakLanjut: d.tindak_lanjut
        }));
        saveLocalFallback(STORAGE_KEYS.JOURNALS, mapped);
        return mapped as JurnalMengajar[];
      }
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/journals');
    if (res.ok) {
      const data = await res.json();
      saveLocalFallback(STORAGE_KEYS.JOURNALS, data);
      return data;
    }
  } catch (e) {}

  return getLocalFallback<JurnalMengajar[]>(STORAGE_KEYS.JOURNALS, INITIAL_JOURNALS);
}

export async function saveJournal(journal: JurnalMengajar): Promise<boolean> {
  const current = await getJournals();
  const exists = current.some(j => j.id === journal.id);
  const updated = exists ? current.map(j => j.id === journal.id ? journal : j) : [journal, ...current];
  saveLocalFallback(STORAGE_KEYS.JOURNALS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('journals').upsert({
        id: journal.id,
        date: journal.date,
        class_id: journal.classId,
        class_name: journal.className,
        materi: journal.materi,
        catatan_kejadian: journal.catatanKejadian,
        tindak_lanjut: journal.tindakLanjut
      });
      return true;
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journal)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteJournal(id: string): Promise<boolean> {
  const current = await getJournals();
  const updated = current.filter(j => j.id !== id);
  saveLocalFallback(STORAGE_KEYS.JOURNALS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('journals').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    await fetch(`/api/journals/${id}`, { method: 'DELETE' }).catch(() => null);
  } catch (e) {}

  return true;
}

export async function getRubriks(): Promise<RubrikFisik[]> {
  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      const { data, error } = await clientSupabase.from('rubriks').select('*');
      if (!error && data) {
        saveLocalFallback(STORAGE_KEYS.RUBRIKS, data);
        return data as RubrikFisik[];
      }
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/rubriks');
    if (res.ok) {
      const data = await res.json();
      saveLocalFallback(STORAGE_KEYS.RUBRIKS, data);
      return data;
    }
  } catch (e) {}

  return getLocalFallback<RubrikFisik[]>(STORAGE_KEYS.RUBRIKS, PREBUILT_RUBRIKS);
}

export async function saveRubrik(rubrik: RubrikFisik): Promise<boolean> {
  const current = await getRubriks();
  const exists = current.some(r => r.id === rubrik.id);
  const updated = exists ? current.map(r => r.id === rubrik.id ? rubrik : r) : [rubrik, ...current];
  saveLocalFallback(STORAGE_KEYS.RUBRIKS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('rubriks').upsert({
        id: rubrik.id,
        materi: rubrik.materi,
        kategori: rubrik.kategori,
        indikator: rubrik.indikator
      });
      return true;
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch('/api/rubriks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rubrik)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteRubrik(id: string): Promise<boolean> {
  const current = await getRubriks();
  const updated = current.filter(r => r.id !== id);
  saveLocalFallback(STORAGE_KEYS.RUBRIKS, updated);

  const clientSupabase = getClientSupabase();
  if (clientSupabase) {
    try {
      await clientSupabase.from('rubriks').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    await fetch(`/api/rubriks/${id}`, { method: 'DELETE' }).catch(() => null);
  } catch (e) {}

  return true;
}

const DEFAULT_SQL_SCRIPT = `
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR UNTUK MEMBUAT TABEL --

-- 1. Tabel Kelas
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade INT NOT NULL,
  students JSONB NOT NULL
);

-- 2. Tabel Modul Ajar (RPP)
CREATE TABLE IF NOT EXISTS moduls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  grade INT NOT NULL,
  semester INT NOT NULL,
  materi_pokok TEXT NOT NULL,
  alokasi_waktu TEXT NOT NULL,
  tujuan_pembelajaran JSONB NOT NULL,
  kegiatan_pembelajaran JSONB NOT NULL,
  sarana_prasarana JSONB NOT NULL,
  rubrik_penilaian TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. Tabel Jurnal Mengajar
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  materi TEXT NOT NULL,
  catatan_kejadian TEXT NOT NULL,
  tindak_lanjut TEXT NOT NULL
);

-- 4. Tabel Rubrik Fisik
CREATE TABLE IF NOT EXISTS rubriks (
  id TEXT PRIMARY KEY,
  materi TEXT NOT NULL,
  kategori TEXT NOT NULL,
  indikator JSONB NOT NULL
);

-- Aktifkan Row Level Security (RLS) & Izinkan Akses Publik (Pilihan Sederhana untuk Demo)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moduls ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubriks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Allow public insert classes" ON classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update classes" ON classes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete classes" ON classes FOR DELETE USING (true);

CREATE POLICY "Allow public select moduls" ON moduls FOR SELECT USING (true);
CREATE POLICY "Allow public insert moduls" ON moduls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update moduls" ON moduls FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete moduls" ON moduls FOR DELETE USING (true);

CREATE POLICY "Allow public select journals" ON journals FOR SELECT USING (true);
CREATE POLICY "Allow public insert journals" ON journals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update journals" ON journals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete journals" ON journals FOR DELETE USING (true);

CREATE POLICY "Allow public select rubriks" ON rubriks FOR SELECT USING (true);
CREATE POLICY "Allow public insert rubriks" ON rubriks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rubriks" ON rubriks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete rubriks" ON rubriks FOR DELETE USING (true);
`;
