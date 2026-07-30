import React, { useState } from 'react';
import { INITIAL_CLASSES, INITIAL_JOURNALS, INITIAL_MODULS, PREBUILT_RUBRIKS } from './data';
import { ClassData, JurnalMengajar, ModulAjar, RubrikFisik, Student, ActiveTab } from './types';
import Dashboard from './components/Dashboard';
import ModulAjarView from './components/ModulAjarView';
import JurnalView from './components/JurnalView';
import AbsensiPenilaianView from './components/AbsensiPenilaianView';
import RubrikFisikView from './components/RubrikFisikView';
import SoalEvaluasiView from './components/SoalEvaluasiView';
import CapaianPembelajaranView from './components/CapaianPembelajaranView';
import CetakLaporanView from './components/CetakLaporanView';
import { DeepLearningRPMView } from './components/DeepLearningRPMView';
import KktpGeneratorView from './components/KktpGeneratorView';
import RpeGeneratorView from './components/RpeGeneratorView';
import ProtaGeneratorView from './components/ProtaGeneratorView';
import ProsemGeneratorView from './components/ProsemGeneratorView';
import SlideGeneratorView from './components/SlideGeneratorView';
import LkpdGeneratorView from './components/LkpdGeneratorView';
import MateriAjarView from './components/MateriAjarView';
import CoverGeneratorView from './components/CoverGeneratorView';
import SoalSumatifView from './components/SoalSumatifView';
import KodeEtikIkrarView from './components/KodeEtikIkrarView';
import KkoTaxonomyView from './components/KkoTaxonomyView';
import UlanganHarianView from './components/UlanganHarianView';
import RekapNilaiTpView from './components/RekapNilaiTpView';
import SupabaseIntegrationView from './components/SupabaseIntegrationView';
import LoginView from './components/LoginView';
import AccountSettingsView from './components/AccountSettingsView';
import AnalisisJamMengajarView from './components/AnalisisJamMengajarView';
import CpToTpView from './components/CpToTpView';
import {
  checkUnifiedDbStatus,
  getClasses,
  saveClasses,
  deleteClass,
  getModuls,
  saveModul,
  deleteModul,
  getJournals,
  saveJournal,
  deleteJournal,
  getRubriks,
  saveRubrik,
  deleteRubrik
} from './lib/dbClient';

import { 
  Flame, 
  Users, 
  FileText, 
  Calendar, 
  CalendarRange,
  CalendarDays,
  Presentation,
  Award, 
  BrainCircuit, 
  Home, 
  Layers, 
  Heart,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  Database,
  CheckCircle2,
  XCircle,
  FileSignature,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Printer,
  Sparkles,
  Image,
  ClipboardList,
  ShieldCheck,
  Cpu,
  ListTodo,
  Calculator,
  Settings,
  LogOut,
  BarChart3,
  Target
} from 'lucide-react';

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

const FALLBACK_STATUS = {
  configured: false,
  connected: false,
  allExist: false,
  tables: { classes: false, moduls: false, journals: false, rubriks: false },
  sqlScript: DEFAULT_SQL_SCRIPT,
  error: 'Gagal memuat status integrasi dari server.'
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('sadar_pjok_logged_in') === 'true';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [classes, setClasses] = useState<ClassData[]>(INITIAL_CLASSES);
  const [moduls, setModuls] = useState<ModulAjar[]>(INITIAL_MODULS);
  const [journals, setJournals] = useState<JurnalMengajar[]>(INITIAL_JOURNALS);
  const [rubriks, setRubriks] = useState<RubrikFisik[]>(PREBUILT_RUBRIKS);
  const [selectedClassId, setSelectedClassId] = useState<string>(INITIAL_CLASSES[0]?.id || '');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch all data from API/Supabase/LocalStorage on mount
  React.useEffect(() => {
    const initData = async () => {
      try {
        const [status, fetchedClasses, fetchedModuls, fetchedJournals, fetchedRubriks] = await Promise.all([
          checkUnifiedDbStatus(),
          getClasses(),
          getModuls(),
          getJournals(),
          getRubriks()
        ]);

        setSupabaseStatus(status);
        if (fetchedClasses) setClasses(fetchedClasses);
        if (fetchedModuls) setModuls(fetchedModuls);
        if (fetchedJournals) setJournals(fetchedJournals);
        if (fetchedRubriks) setRubriks(fetchedRubriks);
      } catch (err) {
        console.error('Error fetching backend data:', err);
        setSupabaseStatus(FALLBACK_STATUS);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const refetchStatus = async () => {
    try {
      const status = await checkUnifiedDbStatus();
      setSupabaseStatus(status);
    } catch (e) {
      console.error(e);
      setSupabaseStatus(FALLBACK_STATUS);
    }
  };

  // Core update handlers for reactivity and backend sync
  const handleUpdateStudents = async (classId: string, updatedStudents: Student[]) => {
    const updatedClasses = classes.map(c => {
      if (c.id === classId) {
        return { ...c, students: updatedStudents };
      }
      return c;
    });

    // Optimistically update frontend
    setClasses(updatedClasses);
    await saveClasses(updatedClasses);
  };

  const handleAddClass = async (newClass: ClassData) => {
    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    setSelectedClassId(newClass.id);
    await saveClasses(updatedClasses);
  };

  const handleDeleteClass = async (classId: string) => {
    const updatedClasses = classes.filter(c => c.id !== classId);
    setClasses(updatedClasses);
    if (selectedClassId === classId) {
      setSelectedClassId(updatedClasses[0]?.id || '');
    }
    await deleteClass(classId);
  };

  const handleAddModul = async (newModul: ModulAjar) => {
    setModuls(prev => [newModul, ...prev]);
    await saveModul(newModul);
  };

  const handleDeleteModul = async (id: string) => {
    setModuls(prev => prev.filter(m => m.id !== id));
    await deleteModul(id);
  };

  const handleAddJournal = async (newJournal: JurnalMengajar) => {
    setJournals(prev => [newJournal, ...prev]);
    await saveJournal(newJournal);
  };

  const handleDeleteJournal = async (id: string) => {
    setJournals(prev => prev.filter(j => j.id !== id));
    await deleteJournal(id);
  };

  const handleAddRubrik = async (newRubrik: RubrikFisik) => {
    setRubriks(prev => [newRubrik, ...prev]);
    await saveRubrik(newRubrik);
  };

  const handleDeleteRubrik = async (id: string) => {
    setRubriks(prev => prev.filter(r => r.id !== id));
    await deleteRubrik(id);
  };

  const navItems = [
    { id: 'dashboard', label: 'Beranda PJOK', icon: Home },
    { id: 'cp', label: 'Capaian Pembelajaran (CP)', icon: BookOpen },
    { id: 'cp_to_tp', label: 'Formulasi CP ke TP', icon: Target },
    { id: 'kktp', label: 'Penyusunan KKTP', icon: CheckCircle2 },
    { id: 'rpe', label: 'Rincian Pekan Efektif', icon: CalendarRange },
    { id: 'analisis_jam', label: 'Analisis Jam Mengajar', icon: BarChart3 },
    { id: 'prota', label: 'Program Tahunan (PROTA)', icon: Calendar },
    { id: 'prosem', label: 'Program Semester (PROSEM)', icon: CalendarDays },
    { id: 'slides', label: 'Slide Presentasi PPT', icon: Presentation },
    { id: 'materi', label: 'Materi Ajar Infografis', icon: BookOpen },
    { id: 'cover', label: 'Cover Halaman Sampul', icon: FileSignature },
    { id: 'lkpd', label: 'Rancang LKPD Gambar', icon: Image },
    { id: 'modul', label: 'Modul Ajar RPP', icon: FileText },
    { id: 'rpm', label: 'Modul Deep Learning', icon: Sparkles },
    { id: 'absensi', label: 'Absensi & Rombel', icon: Users },
    { id: 'penilaian', label: 'Portofolio Nilai', icon: Award },
    { id: 'jurnal', label: 'Jurnal Harian', icon: Calendar },
    { id: 'rubrik', label: 'Rubrik Fisik AI', icon: Layers },
    { id: 'soal', label: 'Bank Soal AI', icon: BrainCircuit },
    { id: 'soal_sumatif', label: 'Soal & Kartu Sumatif', icon: ClipboardList },
    { id: 'ulangan', label: 'Ulangan Harian & Praktik', icon: ListTodo },
    { id: 'rekap_tp', label: 'Rekap Nilai Per TP', icon: Calculator },
    { id: 'supabase', label: 'Integrasi Supabase', icon: Database },
    { id: 'pengaturan', label: 'Pengaturan Password', icon: Settings },
    { id: 'kode_etik', label: 'Kode Etik & Ikrar Guru', icon: ShieldCheck },
    { id: 'kko', label: 'KKO Bloom & SOLO', icon: Cpu },
    { id: 'cetak', label: 'Cetak Laporan', icon: Printer }
  ];

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top Banner & Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs no-print">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden text-slate-500 hover:text-slate-800 p-1 rounded-md"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
              <Flame className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-800 tracking-tight leading-none text-base">
                SADAR <span className="text-emerald-600">PJOK</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Administrasi Guru Premium
              </p>
            </div>
          </div>
        </div>

        {/* Supabase Status Indicator */}
        <div className="flex items-center gap-2">
          {supabaseStatus ? (
            <button
              onClick={() => setActiveTab('supabase')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs border cursor-pointer ${
                !supabaseStatus.configured
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/80'
                  : !supabaseStatus.allExist
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 animate-pulse'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${!supabaseStatus.configured ? 'text-slate-500' : 'text-current'}`} />
              <span>
                {!supabaseStatus.configured
                  ? 'Penyimpanan: Lokal'
                  : !supabaseStatus.allExist
                  ? 'Supabase: Setup Diperlukan'
                  : 'Penyimpanan: Cloud Aktif'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Checking Supabase...</span>
            </div>
          )}
        </div>

        {/* User Identity Banner & Sign Out */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-100 py-1.5 pl-3 pr-4 rounded-full">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
              P
            </div>
            <div className="text-left">
              <span className="text-xs font-semibold text-slate-700 block">Guru PJOK SD</span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">Fase A, B & C Premium</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
                sessionStorage.removeItem('sadar_pjok_logged_in');
                setIsLoggedIn(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer shadow-xs"
            title="Keluar / Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Multi-layout Body */}
      <div className="flex-1 flex relative">
        
        {/* Sidebar Nav (Desktop & Mobile drawer) */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-100 py-6 px-4 transform lg:transform-none lg:opacity-100 transition-all duration-300 ease-in-out lg:static lg:h-[calc(100vh-69px)] overflow-y-auto no-print
          ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:translate-x-0 opacity-0 lg:opacity-100'}
        `}>
          <div className="space-y-6 h-full flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3">Menu Navigasi</span>
              
              <nav className="space-y-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  // Handle Penilaian Tab falling under 'penilaian' sub-tab or custom tab
                  const isTabActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs text-left transition-all cursor-pointer ${
                        isTabActive 
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/10' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isTabActive ? 'text-white' : 'text-slate-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Credits & Portal Quality */}
            <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" /> Kurikulum Merdeka
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Platform penunjang efisiensi administrasi olahraga guru SD se-Indonesia.
              </p>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-20 lg:hidden"
          ></div>
        )}

        {/* Sub-view Controller Stage */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              classes={classes} 
              journals={journals} 
              moduls={moduls}
              onTabChange={(tab) => setActiveTab(tab)}
              setSelectedClassId={setSelectedClassId}
            />
          )}

          {activeTab === 'cp' && (
            <CapaianPembelajaranView />
          )}

          {activeTab === 'cp_to_tp' && (
            <CpToTpView />
          )}

          {activeTab === 'modul' && (
            <ModulAjarView 
              moduls={moduls}
              onAddModul={handleAddModul}
              onDeleteModul={handleDeleteModul}
            />
          )}

          {activeTab === 'rpm' && (
            <DeepLearningRPMView />
          )}

          {activeTab === 'absensi' && (
            <AbsensiPenilaianView 
              classes={classes}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              onUpdateStudents={handleUpdateStudents}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
            />
          )}

          {activeTab === 'penilaian' && (
            <AbsensiPenilaianView 
              classes={classes}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              onUpdateStudents={handleUpdateStudents}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
            />
          )}

          {activeTab === 'jurnal' && (
            <JurnalView 
              journals={journals}
              classes={classes}
              onAddJournal={handleAddJournal}
              onDeleteJournal={handleDeleteJournal}
            />
          )}

          {activeTab === 'rubrik' && (
            <RubrikFisikView 
              rubriks={rubriks}
              onAddRubrik={handleAddRubrik}
              onDeleteRubrik={handleDeleteRubrik}
            />
          )}

          {activeTab === 'soal' && (
            <SoalEvaluasiView />
          )}

          {activeTab === 'soal_sumatif' && (
            <SoalSumatifView />
          )}

          {activeTab === 'ulangan' && (
            <UlanganHarianView />
          )}

          {activeTab === 'rekap_tp' && (
            <RekapNilaiTpView 
              classes={classes}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
            />
          )}
          
          {activeTab === 'supabase' && (
            <SupabaseIntegrationView 
              supabaseStatus={supabaseStatus}
              refetchStatus={refetchStatus}
            />
          )}

          {activeTab === 'pengaturan' && (
            <AccountSettingsView />
          )}

          {activeTab === 'kode_etik' && (
            <KodeEtikIkrarView />
          )}

          {activeTab === 'kko' && (
            <KkoTaxonomyView />
          )}

          {activeTab === 'kktp' && (
            <KktpGeneratorView />
          )}

          {activeTab === 'rpe' && (
            <RpeGeneratorView />
          )}

          {activeTab === 'prota' && (
            <ProtaGeneratorView />
          )}

          {activeTab === 'prosem' && (
            <ProsemGeneratorView />
          )}

          {activeTab === 'slides' && (
            <SlideGeneratorView />
          )}

          {activeTab === 'materi' && (
            <MateriAjarView />
          )}

          {activeTab === 'cover' && (
            <CoverGeneratorView />
          )}

          {activeTab === 'lkpd' && (
            <LkpdGeneratorView />
          )}

          {activeTab === 'analisis_jam' && (
            <AnalisisJamMengajarView />
          )}

          {activeTab === 'cetak' && (
            <CetakLaporanView 
              classes={classes}
              moduls={moduls}
              journals={journals}
              rubriks={rubriks}
            />
          )}

        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-4 text-center text-xs text-slate-400 font-mono no-print">
        &copy; {new Date().getFullYear()} SADAR PJOK • Hub Administrasi Guru Premium
      </footer>
    </div>
  );
}
