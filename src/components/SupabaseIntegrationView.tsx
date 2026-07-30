import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  Terminal,
  Info,
  Key,
  Globe,
  Trash2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  getClientSupabaseCredentials, 
  saveClientSupabaseCredentials, 
  clearClientSupabaseCredentials 
} from '../lib/dbClient';

interface SupabaseStatus {
  configured: boolean;
  isClientSide: boolean;
  connected: boolean;
  allExist: boolean;
  tables: {
    classes: boolean;
    moduls: boolean;
    journals: boolean;
    rubriks: boolean;
  };
  sqlScript: string;
  error: string | null;
}

interface SupabaseIntegrationViewProps {
  supabaseStatus: SupabaseStatus | null;
  refetchStatus: () => Promise<void>;
}

export default function SupabaseIntegrationView({ supabaseStatus, refetchStatus }: SupabaseIntegrationViewProps) {
  const [copiedSql, setCopiedSql] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state with local storage credentials on mount or status refresh
  useEffect(() => {
    const creds = getClientSupabaseCredentials();
    if (creds) {
      setClientUrl(creds.url);
      setClientKey(creds.anonKey);
    } else {
      setClientUrl('');
      setClientKey('');
    }
  }, [supabaseStatus]);

  if (!supabaseStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-slate-500 font-medium">Memuat status integrasi database...</p>
      </div>
    );
  }

  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseStatus.sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleConnectClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientUrl.trim() || !clientKey.trim()) return;

    setIsSaving(true);
    try {
      saveClientSupabaseCredentials(clientUrl, clientKey);
      setSaveSuccess(true);
      await refetchStatus();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectClient = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus konfigurasi Supabase dari peramban ini? Data Anda akan kembali disimpan secara lokal.')) {
      clearClientSupabaseCredentials();
      setClientUrl('');
      setClientKey('');
      await refetchStatus();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl border border-slate-700">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Database className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Keamanan Data Awan (Cloud Sync)
          </div>
          <h2 className="text-3xl font-black tracking-tight">Integrasi Supabase Cloud</h2>
          <p className="text-slate-300 max-w-2xl leading-relaxed">
            Hubungkan administrasi <strong>SADAR PJOK</strong> Anda dengan database Supabase Cloud agar data 
            Anda tersimpan secara permanen, aman, dan dapat diakses dari perangkat mana pun secara real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Status Card */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit mb-4">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Status Kredensial</h3>
            <p className="text-xs text-slate-500 mb-4">Mengecek variabel lingkungan atau penyimpanan peramban.</p>
          </div>
          <div className="space-y-3">
            {supabaseStatus.configured ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Terkonfigurasi</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-200">
                <Info className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Penyimpanan Lokal</span>
              </div>
            )}
            <p className="text-[10px] text-slate-400 leading-tight">
              {supabaseStatus.configured 
                ? (supabaseStatus.isClientSide 
                    ? 'Koneksi aktif menggunakan Local Storage peramban Anda.' 
                    : 'Koneksi aktif menggunakan Server Environment Variables.')
                : 'Data disimpan di Local Storage peramban Anda saat ini.'}
            </p>
          </div>
        </div>

        {/* Database Health Card */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Kesehatan Tabel</h3>
            <p className="text-xs text-slate-500 mb-4">Mengecek keberadaan skema database.</p>
          </div>
          <div className="space-y-3">
            {supabaseStatus.configured && supabaseStatus.connected ? (
              supabaseStatus.allExist ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Semua Tabel Aktif</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                  <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">Setup Diperlukan</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-400 rounded-xl border border-slate-100">
                <XCircle className="w-4 h-4 text-slate-300" />
                <span className="text-xs font-bold uppercase tracking-wider">Belum Terhubung</span>
              </div>
            )}
            <p className="text-[10px] text-slate-400 leading-tight">
              {supabaseStatus.configured && supabaseStatus.connected
                ? (supabaseStatus.allExist 
                    ? 'Semua data otomatis tersinkronisasi ke cloud.' 
                    : 'Beberapa tabel belum ditemukan di skema publik.')
                : 'Hubungkan Supabase untuk mengaktifkan sinkronisasi cloud.'}
            </p>
          </div>
        </div>

        {/* Sync Mode Card */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl w-fit mb-4">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Mode Sinkron</h3>
            <p className="text-xs text-slate-500 mb-4">Metode penyimpanan data saat ini.</p>
          </div>
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              supabaseStatus.configured && supabaseStatus.allExist 
                ? 'bg-emerald-600 text-white border-emerald-700' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {supabaseStatus.configured && supabaseStatus.allExist ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {supabaseStatus.configured && supabaseStatus.allExist ? 'Cloud Sync' : 'Offline / Lokal'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {supabaseStatus.configured && supabaseStatus.allExist 
                ? 'Data aman tersimpan permanen di cloud.' 
                : 'Data disimpan aman di peramban Anda (aman dari refresh).'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Table Checklist & Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Skema Database (public)
            </h4>
            
            {supabaseStatus.configured && supabaseStatus.connected ? (
              <div className="space-y-3">
                {Object.entries(supabaseStatus.tables).map(([name, exists]) => (
                  <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs font-bold text-slate-600 font-mono">{name}</span>
                    {exists ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> READY
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                        <XCircle className="w-3 h-3" /> MISSING
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-2">
                <Database className="w-8 h-8 mx-auto text-slate-300" />
                <p>Hubungkan kredensial untuk melihat kesehatan skema tabel database cloud Anda.</p>
              </div>
            )}

            {supabaseStatus.configured && !supabaseStatus.allExist && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Skema Belum Lengkap:</strong> Beberapa tabel yang diperlukan belum ada di database Supabase Anda. 
                  Silakan jalankan Script SQL di panel kanan pada SQL Editor Supabase Anda.
                </p>
              </div>
            )}
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-emerald-800 mb-2">Mengapa Supabase?</h4>
            <ul className="space-y-2 text-xs text-emerald-700 leading-relaxed list-disc pl-4">
              <li>Penyimpanan data cloud gratis hingga 500MB (sangat cukup untuk seluruh administrasi guru seumur hidup).</li>
              <li>Keamanan tinggi dengan enkripsi standar industri.</li>
              <li>Ekspor dan edit data kapan saja melalui dashboard web Supabase yang intuitif.</li>
              <li>Sinkronisasi real-time instan ke seluruh perangkat Anda.</li>
            </ul>
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noreferrer" 
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-emerald-100 hover:bg-emerald-50 transition-all"
            >
              Buka Supabase.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right Side: Setup Instructions / Direct Connection Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Connection Form for Browser / Local Storage */}
          <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Hubungkan Langsung dari Peramban</h4>
                <p className="text-xs text-slate-500">Metode instan yang sangat cocok untuk deploy di Vercel.</p>
              </div>
            </div>

            {supabaseStatus.configured && !supabaseStatus.isClientSide ? (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 leading-relaxed space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-600" /> Kredensial Terkunci di Server
                </p>
                <p>
                  Aplikasi saat ini mendeteksi variabel lingkungan <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> yang diatur di tingkat server (AI Studio Secrets).
                </p>
                <p>
                  Untuk keamanan dan konsistensi, konfigurasi server ini diutamakan secara otomatis. Anda tidak perlu mengatur kredensial peramban secara terpisah.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConnectClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Supabase URL</label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={clientUrl}
                      onChange={(e) => setClientUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                      className="w-full text-xs font-mono border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                    <Globe className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Supabase Anon Key</label>
                  <div className="relative">
                    <input 
                      type={showKey ? 'text' : 'password'}
                      value={clientKey}
                      onChange={(e) => setClientKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full text-xs font-mono border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {saveSuccess ? 'Koneksi Tersimpan!' : 'Hubungkan Supabase'}
                  </button>

                  {supabaseStatus.isClientSide && (
                    <button
                      type="button"
                      onClick={handleDisconnectClient}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Putus Koneksi Peramban
                    </button>
                  )}
                </div>

                {saveSuccess && (
                  <p className="text-[11px] text-emerald-600 font-bold animate-pulse">
                    Kredensial disimpan! Mencoba menghubungi tabel-tabel Supabase...
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Step Instructions / SQL Runner */}
          <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Instruksi Konfigurasi SQL</h4>
              <button 
                onClick={refetchStatus}
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-8">
              {/* Step 1: SQL Setup */}
              <div className="relative pl-8 border-l-2 border-slate-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                </div>
                <h5 className="text-sm font-bold text-slate-800 mb-2">1. Jalankan Script SQL di Supabase</h5>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Buka dashboard Supabase Anda, masuk ke menu <strong>SQL Editor</strong>, 
                  buat query baru, tempelkan script di bawah, lalu klik tombol <strong>Run</strong> (Lari/Jalankan).
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setup SQL Script</span>
                    <button 
                      onClick={handleCopySql}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedSql ? 'Tersalin' : 'Salin Script SQL'}
                    </button>
                  </div>
                  
                  <div className="relative group">
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-2xl font-mono text-[10px] overflow-x-auto max-h-40 leading-relaxed border border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
                      {supabaseStatus.sqlScript ? supabaseStatus.sqlScript.trim() : ''}
                    </pre>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              </div>

              {/* Step 2: Refresh */}
              <div className="relative pl-8 border-l-2 border-slate-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                </div>
                <h5 className="text-sm font-bold text-slate-800 mb-2">2. Verifikasi Koneksi</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Setelah menyimpan kredensial di atas dan menjalankan script SQL di Supabase, klik tombol di bawah untuk memverifikasi apakah seluruh tabel sudah sukses terdeteksi.
                </p>
                
                <button 
                  onClick={refetchStatus}
                  className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-lg cursor-pointer animate-in fade-in zoom-in duration-300"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Status Integrasi
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
