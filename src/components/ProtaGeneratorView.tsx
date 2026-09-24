import React, { useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  ClipboardList,
  CalendarDays,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import { ProtaData } from '../types';
import { downloadDocFile, copyAndOpenGoogleDocs, exportProtaToDoc } from '../lib/exportUtils';
import { downloadHtmlAsPdf, printHtmlDocument } from '../lib/pdfUtils';
import { fetchWithRetry } from '../lib/fetchUtils';

export default function ProtaGeneratorView() {
  // Input states
  const [rentangProgram, setRentangProgram] = useState<'full' | 'semester_1' | 'semester_2'>('full');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [kelas, setKelas] = useState('5');
  const [fase, setFase] = useState('C');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [totalJp2Semester, setTotalJp2Semester] = useState('144 JP');
  const [alokasiWaktuTiapMinggu, setAlokasiWaktuTiapMinggu] = useState('4 JP');
  const [semester1Weeks, setSemester1Weeks] = useState('20');
  const [semester2Weeks, setSemester2Weeks] = useState('21');
  const [babSemester1, setBabSemester1] = useState(
    "Bab I: Aktivitas Pola Gerak Dasar Lokomotor & Non-Lokomotor\n" +
    "Bab II: Aktivitas Kebugaran Jasmani untuk Kesehatan"
  );
  const [babSemester2, setBabSemester2] = useState(
    "Bab III: Senam Lantai & Aktivitas Senam\n" +
    "Bab IV: Aktivitas Air & Renang Gaya Dada"
  );
  const [tujuanPembelajaranRaw, setTujuanPembelajaranRaw] = useState(
    "1. Peserta didik dapat mempraktikkan kombinasi gerak dasar lokomotor (jalan, lari, lompat).\n" +
    "2. Peserta didik dapat menjelaskan prosedur variasi pola gerak dasar non-lokomotor secara berkelompok.\n" +
    "3. Peserta didik dapat mempraktikkan latihan daya tahan jantung dan paru-paru untuk kebugaran jasmani.\n" +
    "4. Peserta didik dapat mengidentifikasi bentuk-bentuk aktivitas senam lantai dengan tumpuan tangan.\n" +
    "5. Peserta didik dapat mendemonstrasikan gerakan meluncur dan gerakan kaki pada renang gaya dada."
  );

  // Status states
  const [protaResult, setProtaResult] = useState<ProtaData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Auto-set Fase based on Kelas
  const handleKelasChange = (val: string) => {
    setKelas(val);
    if (val === '1' || val === '2') {
      setFase('A');
    } else if (val === '3' || val === '4') {
      setFase('B');
    } else if (val === '5' || val === '6') {
      setFase('C');
    }
  };

  const handleRentangProgramChange = (val: 'full' | 'semester_1' | 'semester_2') => {
    setRentangProgram(val);
    if (val === 'full') {
      setTotalJp2Semester('144 JP');
      setTujuanPembelajaranRaw(
        "1. Peserta didik dapat mempraktikkan kombinasi gerak dasar lokomotor (jalan, lari, lompat).\n" +
        "2. Peserta didik dapat menjelaskan prosedur variasi pola gerak dasar non-lokomotor secara berkelompok.\n" +
        "3. Peserta didik dapat mempraktikkan latihan daya tahan jantung dan paru-paru untuk kebugaran jasmani.\n" +
        "4. Peserta didik dapat mengidentifikasi bentuk-bentuk aktivitas senam lantai dengan tumpuan tangan.\n" +
        "5. Peserta didik dapat mendemonstrasikan gerakan meluncur dan gerakan kaki pada renang gaya dada."
      );
    } else if (val === 'semester_1') {
      setTotalJp2Semester('72 JP');
      setTujuanPembelajaranRaw(
        "1. Peserta didik dapat mempraktikkan kombinasi gerak dasar lokomotor (jalan, lari, lompat).\n" +
        "2. Peserta didik dapat menjelaskan prosedur variasi pola gerak dasar non-lokomotor secara berkelompok.\n" +
        "3. Peserta didik dapat mempraktikkan latihan daya tahan jantung dan paru-paru untuk kebugaran jasmani."
      );
    } else {
      setTotalJp2Semester('72 JP');
      setTujuanPembelajaranRaw(
        "1. Peserta didik dapat mengidentifikasi bentuk-bentuk aktivitas senam lantai dengan tumpuan tangan.\n" +
        "2. Peserta didik dapat mendemonstrasikan gerakan meluncur dan gerakan kaki pada renang gaya dada."
      );
    }
  };

  const handleGenerateProta = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // Form validation
    if (!mataPelajaran.trim()) {
      setValidationError('Mata Pelajaran wajib diisi.');
      return;
    }
    if (!kelas.trim()) {
      setValidationError('Kelas wajib diisi.');
      return;
    }
    if (!fase.trim()) {
      setValidationError('Fase wajib diisi.');
      return;
    }
    if (!tahunPelajaran.trim()) {
      setValidationError('Tahun Pelajaran wajib diisi.');
      return;
    }
    if (!totalJp2Semester.trim()) {
      setValidationError('Total JP wajib diisi.');
      return;
    }
    if (!alokasiWaktuTiapMinggu.trim()) {
      setValidationError('Alokasi Waktu Tiap Minggu wajib diisi.');
      return;
    }
    if (rentangProgram !== 'semester_2' && !babSemester1.trim()) {
      setValidationError('Daftar Bab Semester 1 wajib diisi.');
      return;
    }
    if (rentangProgram !== 'semester_1' && !babSemester2.trim()) {
      setValidationError('Daftar Bab Semester 2 wajib diisi.');
      return;
    }
    if (!tujuanPembelajaranRaw.trim()) {
      setValidationError('Tujuan Pembelajaran wajib diisi.');
      return;
    }

    setIsGenerating(true);
    setProtaResult(null);

    try {
      const response = await fetchWithRetry('/api/generate-prota', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mataPelajaran,
          kelas,
          fase,
          tahunPelajaran,
          totalJp2Semester,
          alokasiWaktuTiapMinggu,
          semester1Weeks,
          semester2Weeks,
          babSemester1: rentangProgram === 'semester_2' ? '' : babSemester1,
          babSemester2: rentangProgram === 'semester_1' ? '' : babSemester2,
          tujuanPembelajaranRaw,
          rentangProgram
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Terjadi kesalahan sistem AI saat memproses Program Tahunan.');
      }

      const data = await response.json();
      setProtaResult(data);
    } catch (err: any) {
      setApiError(err.message || 'Gagal menyusun Program Tahunan (PROTA).');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAndGoToDocs = async () => {
    if (!protaResult) return;
    setCopySuccess(false);
    const docHtml = exportProtaToDoc(protaResult);
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!protaResult) return;
    const docHtml = exportProtaToDoc(protaResult);
    const filename = `PROTA_${protaResult.identitas.mataPelajaran.replace(/\s+/g, '_')}_Kelas${protaResult.identitas.kelas}`;
    downloadDocFile(filename, docHtml);
  };

  const handleDownloadPdf = async () => {
    if (!protaResult || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const docHtml = exportProtaToDoc(protaResult);
      const filename = `PROTA_${protaResult.identitas.mataPelajaran.replace(/\s+/g, '_')}_Kelas${protaResult.identitas.kelas}`;
      const success = await downloadHtmlAsPdf(filename, docHtml, {
        title: `Program Tahunan - ${protaResult.identitas.mataPelajaran}`,
        orientation: 'landscape'
      });
      if (!success) {
        printHtmlDocument(docHtml, `PROTA - ${protaResult.identitas.mataPelajaran}`);
      }
    } catch (err) {
      console.error(err);
      const docHtml = exportProtaToDoc(protaResult);
      printHtmlDocument(docHtml, `PROTA - ${protaResult.identitas.mataPelajaran}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!protaResult) return;
    const docHtml = exportProtaToDoc(protaResult);
    printHtmlDocument(docHtml, `PROTA - ${protaResult.identitas.mataPelajaran}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Kiri: Form Input Parameter PROTA */}
      <div className="lg:col-span-4 space-y-4 no-print">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Penyusun PROTA AI</h3>
              <p className="text-[10px] text-slate-300 font-medium">Buat Program Tahunan Otomatis</p>
            </div>
          </div>

          <form onSubmit={handleGenerateProta} className="space-y-4">
            
            {/* Validasi Error Lokal */}
            {validationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Rentang Program Selector Segment */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Rentang Program</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => handleRentangProgramChange('full')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${rentangProgram === 'full' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  1 Tahun
                </button>
                <button
                  type="button"
                  onClick={() => handleRentangProgramChange('semester_1')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${rentangProgram === 'semester_1' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  Smt 1 (Ganjil)
                </button>
                <button
                  type="button"
                  onClick={() => handleRentangProgramChange('semester_2')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${rentangProgram === 'semester_2' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  Smt 2 (Genap)
                </button>
              </div>
            </div>

            {/* Identitas Section */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">1. Identitas Mata Pelajaran</span>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Nama Mata Pelajaran</label>
                  <input 
                    type="text" 
                    value={mataPelajaran}
                    onChange={(e) => setMataPelajaran(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="PJOK..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Kelas</label>
                  <select
                    value={kelas}
                    onChange={(e) => handleKelasChange(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {['1', '2', '3', '4', '5', '6'].map(k => (
                      <option key={k} value={k}>Kelas {k}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Fase (Otomatis)</label>
                  <input 
                    type="text" 
                    value={`Fase ${fase}`}
                    disabled
                    className="w-full bg-slate-800/40 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400 cursor-not-allowed text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Tahun Pelajaran</label>
                  <input 
                    type="text" 
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="2026/2027"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">
                    {rentangProgram === 'full' ? 'Total JP (2 Semester)' : rentangProgram === 'semester_1' ? 'Total JP (Smt 1)' : 'Total JP (Smt 2)'}
                  </label>
                  <input 
                    type="text" 
                    value={totalJp2Semester}
                    onChange={(e) => setTotalJp2Semester(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="144 JP"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Alokasi Waktu per Minggu</label>
                  <input 
                    type="text" 
                    value={alokasiWaktuTiapMinggu}
                    onChange={(e) => setAlokasiWaktuTiapMinggu(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="4 JP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {rentangProgram !== 'semester_2' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-300 block">Smt 1 Weeks</label>
                    <input 
                      type="number" 
                      value={semester1Weeks}
                      onChange={(e) => setSemester1Weeks(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                {rentangProgram !== 'semester_1' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-300 block">Smt 2 Weeks</label>
                    <input 
                      type="number" 
                      value={semester2Weeks}
                      onChange={(e) => setSemester2Weeks(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Pembagian Bab per Semester */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">2. Pembagian Bab Semester</span>
              
              {rentangProgram !== 'semester_2' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Daftar Bab Semester 1 (Ganjil)</label>
                  <textarea 
                    value={babSemester1}
                    onChange={(e) => setBabSemester1(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Sebutkan bab..."
                  />
                </div>
              )}

              {rentangProgram !== 'semester_1' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Daftar Bab Semester 2 (Genap)</label>
                  <textarea 
                    value={babSemester2}
                    onChange={(e) => setBabSemester2(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Sebutkan bab..."
                  />
                </div>
              )}
            </div>

            {/* Tujuan Pembelajaran Lengkap */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">3. Tujuan Pembelajaran (TP)</span>
                <span className="text-[9px] text-slate-400 italic">Satu per baris</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 block">Salin Tujuan Pembelajaran di Sini</label>
                <textarea 
                  value={tujuanPembelajaranRaw}
                  onChange={(e) => setTujuanPembelajaranRaw(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-indigo-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="Masukkan kalimat tujuan pembelajaran..."
                />
              </div>
            </div>

            {/* Action Submit */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-950/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {rentangProgram === 'full' 
                      ? 'Menyusun Tabel PROTA...' 
                      : rentangProgram === 'semester_1' 
                      ? 'Menyusun Program Smt 1...' 
                      : 'Menyusun Program Smt 2...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>
                    {rentangProgram === 'full' 
                      ? 'Susun Program Tahunan AI' 
                      : rentangProgram === 'semester_1' 
                      ? 'Susun Program Semester 1 (Ganjil)' 
                      : 'Susun Program Semester 2 (Genap)'}
                  </span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Informational Tip Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <h4 className="font-semibold text-xs text-slate-900">
              {rentangProgram === 'full' ? 'Tentang Program Tahunan' : 'Tentang Program Per Semester'}
            </h4>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {rentangProgram === 'full' 
              ? 'Program Tahunan (PROTA) Kurikulum Merdeka menyusun pemetaan alokasi waktu (JP) pembelajaran sepanjang tahun ajaran agar seluruh Alur Tujuan Pembelajaran (ATP) tercapai seimbang antara Semester 1 & 2.'
              : rentangProgram === 'semester_1'
              ? 'Program Semester I (Ganjil) Kurikulum Merdeka menyusun pemetaan alokasi waktu (JP) pembelajaran sepanjang semester ganjil agar Alur Tujuan Pembelajaran (ATP) semester ganjil tercapai.'
              : 'Program Semester II (Genap) Kurikulum Merdeka menyusun pemetaan alokasi waktu (JP) pembelajaran sepanjang semester genap agar Alur Tujuan Pembelajaran (ATP) semester genap tercapai.'}
          </p>
        </div>
      </div>

      {/* Kanan: Hasil Pratinjau PROTA & Ekspor */}
      <div className="lg:col-span-8 flex flex-col h-full min-h-[600px]">
        {isGenerating ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Menganalisis Tujuan & Alokasi JP</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              Gemini AI sedang mengelompokkan tujuan pembelajaran ke dalam bab-bab semester, memetakan materi pokok, serta menghitung alokasi waktu yang proporsional...
            </p>
            <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full w-2/3 rounded-full animate-infinite-scroll"></div>
            </div>
          </div>
        ) : apiError ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Penyusunan PROTA Gagal</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
              {apiError}
            </p>
            <button
              onClick={handleGenerateProta}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Coba Lagi
            </button>
          </div>
        ) : protaResult ? (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Toolbar Aksi Atas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-800">Pratinjau Dokumen PROTA</span>
              </div>
              
              <div className="flex items-center flex-wrap gap-2">
                
                {/* Salin ke Clipboard & Buka Google Docs */}
                <button
                  onClick={handleCopyAndGoToDocs}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                  title="Salin tabel rapi dan buat dokumen Google baru otomatis"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Disalin! Membuka Google Docs...</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin & Buka Google Docs</span>
                      <ExternalLink className="w-3 h-3 text-indigo-200" />
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-75"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>{isExportingPdf ? 'Memproses PDF...' : 'Unduh PDF'}</span>
                </button>

                <button
                  onClick={handleDownloadDoc}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh Word</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>

            {/* Lembar Cetak Dokumen Real */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6 overflow-x-auto print-sheet">
              
              {/* Identitas Dokumen Atas */}
              <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                  {rentangProgram === 'semester_1' 
                    ? 'PROGRAM SEMESTER I (GANJIL)' 
                    : rentangProgram === 'semester_2' 
                    ? 'PROGRAM SEMESTER II (GENAP)' 
                    : 'PROGRAM TAHUNAN (PROTA)'}
                </h2>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  KURIKULUM MERDEKA - TP {protaResult.identitas.tahunPelajaran}
                </h3>
              </div>

              {/* Grid Metadata Identitas */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">Mata Pelajaran</span>
                  <span className="text-slate-800 font-bold">: {protaResult.identitas.mataPelajaran}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">Kelas / Fase</span>
                  <span className="text-slate-800 font-bold">: Kelas {protaResult.identitas.kelas} / Fase {protaResult.identitas.fase}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">
                    {rentangProgram === 'full' ? 'Total JP (2 Smt)' : 'Total JP'}
                  </span>
                  <span className="text-slate-800 font-bold">: {protaResult.identitas.totalJp2Semester}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">JP per Pekan</span>
                  <span className="text-slate-800 font-bold">: {protaResult.identitas.alokasiWaktuTiapMinggu}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">
                    {rentangProgram === 'full' ? 'Semester 1 / 2' : rentangProgram === 'semester_1' ? 'Semester Ganjil' : 'Semester Genap'}
                  </span>
                  <span className="text-slate-800 font-bold">
                    : {rentangProgram === 'full' 
                      ? `${protaResult.identitas.semester1Weeks} Pekan / ${protaResult.identitas.semester2Weeks} Pekan` 
                      : rentangProgram === 'semester_1' 
                      ? `${protaResult.identitas.semester1Weeks} Pekan` 
                      : `${protaResult.identitas.semester2Weeks} Pekan`}
                  </span>
                </div>
              </div>

              {/* Tabel Utama PROTA */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th className="border border-slate-300 px-3 py-2 text-center w-16">No Bab/ATP</th>
                      <th className="border border-slate-300 px-3 py-2 w-48">Bab</th>
                      <th className="border border-slate-300 px-3 py-2">Tujuan Pembelajaran</th>
                      <th className="border border-slate-300 px-3 py-2 w-36">Materi</th>
                      <th className="border border-slate-300 px-3 py-2 text-center w-24">Alokasi Waktu</th>
                      <th className="border border-slate-300 px-3 py-2 text-center w-24">Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protaResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 align-top">
                        <td className="border border-slate-300 px-3 py-2.5 text-center font-semibold text-slate-600">{row.no}</td>
                        <td className="border border-slate-300 px-3 py-2.5 font-bold text-slate-800">{row.bab}</td>
                        <td className="border border-slate-300 px-3 py-2.5 text-slate-900 leading-relaxed">{row.tujuanPembelajaran}</td>
                        <td className="border border-slate-300 px-3 py-2.5 text-slate-500 italic">{row.materi}</td>
                        <td className="border border-slate-300 px-3 py-2.5 text-center font-bold text-indigo-700">{row.alokasiWaktu}</td>
                        <td className="border border-slate-300 px-3 py-2.5 text-center text-slate-600">{row.semester}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tanda Tangan */}
              <div className="grid grid-cols-2 text-center text-xs text-slate-800 pt-8 border-t border-slate-100">
                <div className="space-y-12">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-bold">Kepala Sekolah</p>
                  </div>
                  <div>
                    <p className="font-bold underline">___________________________</p>
                    <p className="text-[10px] text-slate-500">NIP. _______________________</p>
                  </div>
                </div>
                <div className="space-y-12">
                  <div>
                    <p>{protaResult.tanggalDokumen}</p>
                    <p className="font-bold">Guru Mata Pelajaran</p>
                  </div>
                  <div>
                    <p className="font-bold underline">___________________________</p>
                    <p className="text-[10px] text-slate-500">NIP. _______________________</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">PROTA Belum Disusun</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              Lengkapi formulir parameter di panel kiri termasuk daftar Bab Semester 1 & 2 serta seluruh daftar Tujuan Pembelajaran (ATP), kemudian klik tombol <b>Susun Program Tahunan AI</b>.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Kurikulum Merdeka</span>
              <span>•</span>
              <span>Pembagian Semester Akurat</span>
              <span>•</span>
              <span>Ekspor Google Docs</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
