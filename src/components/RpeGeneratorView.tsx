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
  Calendar,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import { RpeData } from '../types';
import { downloadDocFile, copyAndOpenGoogleDocs, exportRpeToDoc } from '../lib/exportUtils';
import { downloadHtmlAsPdf, printHtmlDocument } from '../lib/pdfUtils';

export default function RpeGeneratorView() {
  // Input states
  const [namaSekolah, setNamaSekolah] = useState('SD Ceria 23');
  const [kelas, setKelas] = useState('V');
  const [jpPerMinggu, setJpPerMinggu] = useState('4');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [semester, setSemester] = useState('Ganjil');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [catatanTambahan, setCatatanTambahan] = useState(
    "Minggu ke-1 & 2 Juli: Libur Semester Genap TA Sebelumnya\n" +
    "Minggu ke-3 Desember: Asesmen Sumatif Akhir Semester (SAS)\n" +
    "Minggu ke-4 Desember: Pembagian Rapor & Libur Semester Ganjil"
  );

  // Status states
  const [rpeResult, setRpeResult] = useState<RpeData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleGenerateRpe = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // Form validation
    if (!namaSekolah.trim()) {
      setValidationError('Nama Sekolah wajib diisi.');
      return;
    }
    if (!kelas.trim()) {
      setValidationError('Kelas wajib diisi.');
      return;
    }
    if (!jpPerMinggu.trim() || isNaN(parseInt(jpPerMinggu, 10)) || parseInt(jpPerMinggu, 10) <= 0) {
      setValidationError('Jumlah JP Per Minggu harus diisi dengan angka positif.');
      return;
    }
    if (!mataPelajaran.trim()) {
      setValidationError('Mata Pelajaran wajib diisi.');
      return;
    }
    if (!semester.trim()) {
      setValidationError('Semester wajib diisi.');
      return;
    }
    if (!tahunPelajaran.trim()) {
      setValidationError('Tahun Pelajaran wajib diisi.');
      return;
    }

    setIsGenerating(true);
    setRpeResult(null);

    try {
      const response = await fetch('/api/generate-rpe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namaSekolah,
          kelas,
          jpPerMinggu: parseInt(jpPerMinggu, 10),
          mataPelajaran,
          semester,
          tahunPelajaran,
          catatanTambahan
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Terjadi kesalahan sistem AI saat menyusun RPE.');
      }

      const data = await response.json();
      setRpeResult(data);
    } catch (err: any) {
      setApiError(err.message || 'Gagal menyusun Rincian Pekan Efektif.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAndGoToDocs = async () => {
    if (!rpeResult) return;
    setCopySuccess(false);
    const docHtml = exportRpeToDoc(rpeResult);
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!rpeResult) return;
    const docHtml = exportRpeToDoc(rpeResult);
    const filename = `RPE_${rpeResult.identitas.mataPelajaran.replace(/\s+/g, '_')}_Kelas${rpeResult.identitas.kelas}_${rpeResult.identitas.semester}`;
    downloadDocFile(filename, docHtml);
  };

  const handleDownloadPdf = async () => {
    if (!rpeResult || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const docHtml = exportRpeToDoc(rpeResult);
      const filename = `RPE_${rpeResult.identitas.mataPelajaran.replace(/\s+/g, '_')}_Kelas${rpeResult.identitas.kelas}_${rpeResult.identitas.semester}`;
      const success = await downloadHtmlAsPdf(filename, docHtml, {
        title: `RPE - ${rpeResult.identitas.mataPelajaran}`,
        orientation: 'portrait'
      });
      if (!success) {
        printHtmlDocument(docHtml, `RPE - ${rpeResult.identitas.mataPelajaran}`);
      }
    } catch (err) {
      console.error(err);
      const docHtml = exportRpeToDoc(rpeResult);
      printHtmlDocument(docHtml, `RPE - ${rpeResult.identitas.mataPelajaran}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!rpeResult) return;
    const docHtml = exportRpeToDoc(rpeResult);
    printHtmlDocument(docHtml, `RPE - ${rpeResult.identitas.mataPelajaran}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Kiri: Form Input Parameter RPE */}
      <div className="lg:col-span-4 space-y-4 no-print">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Penyusun RPE AI</h3>
              <p className="text-[10px] text-slate-300 font-medium">Rincian Pekan Efektif & Alokasi Waktu</p>
            </div>
          </div>

          <form onSubmit={handleGenerateRpe} className="space-y-4">
            
            {/* Validasi Error Lokal */}
            {validationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Identitas Section */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">1. Informasi Sekolah & Mapel</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Nama Sekolah</label>
                  <input 
                    type="text" 
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="SD Ceria 23"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Mata Pelajaran</label>
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
                  <input 
                    type="text" 
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:outline-none focus:border-indigo-500"
                    placeholder="V"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">JP / Pekan</label>
                  <input 
                    type="number" 
                    value={jpPerMinggu}
                    onChange={(e) => setJpPerMinggu(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:outline-none focus:border-indigo-500"
                    placeholder="4"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 block">Tahun Pelajaran</label>
                <input 
                  type="text" 
                  value={tahunPelajaran}
                  onChange={(e) => setTahunPelajaran(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 2026/2027"
                />
              </div>
            </div>

            {/* Kalender Akademik Tambahan */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">2. Acara & Libur Kalender</span>
                <span className="text-[9px] text-slate-400 italic">Opsional</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 block">Keterangan Khusus / Rencana Kegiatan</label>
                <textarea 
                  value={catatanTambahan}
                  onChange={(e) => setCatatanTambahan(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-indigo-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="Masukkan rincian khusus libur, ujian, kegiatan sekolah, dll..."
                />
              </div>
            </div>

            {/* Action Submit */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-950/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menganalisis Kalender & RPE...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Susun RPE AI</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Informational Tip Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <h4 className="font-semibold text-xs text-slate-900">Tentang RPE (Rincian Pekan Efektif)</h4>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Rincian Pekan Efektif digunakan untuk memetakan alokasi waktu kegiatan belajar mengajar dalam satu semester. Formula dasarnya adalah:
          </p>
          <ul className="text-[10px] font-medium text-slate-600 list-disc pl-4 space-y-1">
            <li><b>Total Pekan:</b> Jumlah seluruh pekan per bulan.</li>
            <li><b>Pekan Efektif:</b> Pekan aktif KBM.</li>
            <li><b>Jam Efektif:</b> Pekan Efektif × Jumlah Jam Pelajaran (JP).</li>
          </ul>
        </div>
      </div>

      {/* Kanan: Hasil Pratinjau RPE & Ekspor */}
      <div className="lg:col-span-8 flex flex-col h-full min-h-[600px]">
        {isGenerating ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Menganalisis Kalender Akademik</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              AI sedang mengidentifikasi minggu efektif belajar, hari libur nasional, asesmen sumatif, dan merumuskan rekapitulasi pekan efektif...
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
            <h3 className="text-sm font-bold text-slate-800 mb-1">Penyusunan RPE Gagal</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
              {apiError}
            </p>
            <button
              onClick={handleGenerateRpe}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Coba Lagi
            </button>
          </div>
        ) : rpeResult ? (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Toolbar Aksi Atas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-800">Pratinjau Dokumen RPE</span>
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
                  RINCIAN PEKAN EFEKTIF (RPE)
                </h2>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  TAHUN PELAJARAN {rpeResult.identitas.tahunPelajaran}
                </h3>
              </div>

              {/* Grid Metadata Identitas */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">Nama Sekolah</span>
                  <span className="text-slate-800 font-bold">: {rpeResult.identitas.namaSekolah}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">Mata Pelajaran</span>
                  <span className="text-slate-800 font-bold">: {rpeResult.identitas.mataPelajaran}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">Kelas / Semester</span>
                  <span className="text-slate-800 font-bold">: Kelas {rpeResult.identitas.kelas} / Semester {rpeResult.identitas.semester}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span className="font-semibold text-slate-500 w-32 shrink-0">JP Per Minggu</span>
                  <span className="text-slate-800 font-bold">: {rpeResult.identitas.jpPerMinggu} JP / Pekan</span>
                </div>
              </div>

              {/* A. Perhitungan Alokasi Waktu */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wide">
                  A. PERHITUNGAN ALOKASI WAKTU
                </h3>
                
                {/* 1. Jumlah Pekan */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">1. Jumlah Pekan dalam Satu Semester</h4>
                  <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="border border-slate-300 px-3 py-2 text-center w-12">No</th>
                        <th className="border border-slate-300 px-3 py-2 w-32">Bulan</th>
                        <th className="border border-slate-300 px-3 py-2 text-center w-28">Jumlah Pekan</th>
                        <th className="border border-slate-300 px-3 py-2 text-center w-28 bg-emerald-800 text-emerald-50">Pekan Efektif</th>
                        <th className="border border-slate-300 px-3 py-2 text-center w-28 bg-red-800 text-red-50">Pekan Tidak Efektif</th>
                        <th className="border border-slate-300 px-3 py-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rpeResult.alokasiWaktu.bulans.map((b, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 align-middle">
                          <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-slate-500">{b.no}</td>
                          <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800">{b.bulan}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{b.jumlahPekan}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-600">{b.pekanEfektif}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-600">{b.pekanTidakEfektif}</td>
                          <td className="border border-slate-300 px-3 py-2 text-slate-500">{b.keterangan || '-'}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td colSpan={2} className="border border-slate-300 px-3 py-2 text-center">Jumlah</td>
                        <td className="border border-slate-300 px-3 py-2 text-center">{rpeResult.alokasiWaktu.totalPekan}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{rpeResult.alokasiWaktu.totalPekanEfektif}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{rpeResult.alokasiWaktu.totalPekanTidakEfektif}</td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-400">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. Pekan Tidak Efektif */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-700">2. Rincian Pekan Tidak Efektif</h4>
                  <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-700 text-white font-bold">
                        <th className="border border-slate-300 px-3 py-2 text-center w-12">No</th>
                        <th className="border border-slate-300 px-3 py-2 w-72">Uraian Kegiatan</th>
                        <th className="border border-slate-300 px-3 py-2 text-center w-36">Jumlah (Pekan)</th>
                        <th className="border border-slate-300 px-3 py-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rpeResult.pekanTidakEfektif.map((act, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-slate-500">{act.no}</td>
                          <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{act.uraianKegiatan}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-600">{act.jumlahPekan}</td>
                          <td className="border border-slate-300 px-3 py-2 text-slate-500">{act.keterangan || '-'}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td colSpan={2} className="border border-slate-300 px-3 py-2 text-center">Jumlah Total Pekan Tidak Efektif</td>
                        <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{rpeResult.alokasiWaktu.totalPekanTidakEfektif}</td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-500">Pekan</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Jumlah Pekan Efektif */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-xs font-bold text-slate-700">3. Jumlah Pekan Efektif</h4>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-800 space-y-1">
                    <p className="font-semibold text-slate-500">Rumus: Jumlah Pekan Efektif = Jumlah Pekan dalam Semester – Jumlah Pekan Tidak Efektif</p>
                    <p className="font-bold text-indigo-700 font-mono">Hasil: {rpeResult.totalPekanEfektifFormula}</p>
                  </div>
                </div>

                {/* 4. Jumlah Jam Efektif */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-xs font-bold text-slate-700">4. Jumlah Jam Pelajaran (JP) Efektif</h4>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-800 space-y-1">
                    <p className="font-semibold text-slate-500">Rumus: Jumlah Jam Efektif = Jumlah Pekan Efektif × JP Per Pekan</p>
                    <p className="font-bold text-indigo-700 font-mono">Hasil: {rpeResult.totalJamEfektifFormula}</p>
                  </div>
                </div>

              </div>

              {/* B. Catatan & Analisis */}
              {rpeResult.catatanAnalisis && (
                <div className="space-y-2 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wide">
                    B. CATATAN & REKOMENDASI ANALISIS KALENDER
                  </h3>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-950 leading-relaxed italic">
                    {rpeResult.catatanAnalisis}
                  </div>
                </div>
              )}

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
                    <p>{rpeResult.tanggalDokumen}</p>
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
            <h3 className="text-sm font-bold text-slate-800 mb-1">Rincian Pekan Efektif Belum Disusun</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              Silakan isi formulir identitas sekolah, tentukan jumlah jam pelajaran per pekan, lalu klik tombol <b>Susun RPE AI</b> untuk menyusun analisis otomatis.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Sesuai Format Kalender Pendidikan</span>
              <span>•</span>
              <span>Penghitungan Akurat AI</span>
              <span>•</span>
              <span>Salin Langsung Google Docs</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
