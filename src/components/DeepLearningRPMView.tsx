import React, { useState } from 'react';
import { Sparkles, FileText, ClipboardCopy, FileDown, BookOpen, User, Users, CheckCircle2, AlertCircle, RefreshCw, Printer, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DeepLearningRPM } from '../types';
import { exportRpmToDoc, downloadDocFile, copyAndOpenGoogleDocs, copyRichHtmlToClipboard } from '../lib/exportUtils';

export function DeepLearningRPMView() {
  // Input fields state
  const [grade, setGrade] = useState('');
  const [materi, setMateri] = useState('');
  const [penyusun, setPenyusun] = useState('');
  const [sekolah, setSekolah] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [semester, setSemester] = useState('1');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [bab, setBab] = useState('');
  const [alokasiWaktu, setAlokasiWaktu] = useState('');
  const [konteksTambahan, setKonteksTambahan] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [rpmResult, setRpmResult] = useState<DeepLearningRPM | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'rpm' | 'lampiran' | 'lkpd'>('rpm');
  const [selectedLkpdIndex, setSelectedLkpdIndex] = useState(0);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!grade.trim()) tempErrors.grade = 'Kelas wajib diisi';
    if (!materi.trim()) tempErrors.materi = 'Materi/Topik wajib diisi';
    if (!penyusun.trim()) tempErrors.penyusun = 'Nama Penyusun wajib diisi';
    if (!sekolah.trim()) tempErrors.sekolah = 'Nama Sekolah wajib diisi';
    if (!bab.trim()) tempErrors.bab = 'Bab wajib diisi';
    
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!validateForm()) {
      setErrorMessage('Harap isi semua kolom input yang wajib bertanda bintang (*).');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-rpm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          materi,
          penyusun,
          sekolah,
          tahunAjaran,
          semester,
          mataPelajaran,
          bab,
          alokasiWaktu,
          konteksTambahan
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Terjadi kesalahan sistem saat menghubungi Gemini.');
      }

      const data = await response.json();
      setRpmResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menyusun RPM. Pastikan kunci API Gemini Anda valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboardAndOpenDocs = async () => {
    if (!rpmResult) return;
    const docHtml = exportRpmToDoc(rpmResult);
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!rpmResult) return;
    const docHtml = exportRpmToDoc(rpmResult);
    const filename = `RPM_${rpmResult.identitas.mataPelajaran}_Kelas_${rpmResult.identitas.kelasFase}_${rpmResult.identitas.topik.replace(/\s+/g, '_')}`;
    downloadDocFile(filename, docHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
          Pembelajaran Mendalam (Deep Learning) - RPM & LKPD
        </h1>
        <p className="text-slate-500 mt-1 text-sm max-w-3xl">
          Rancang Rencana Pembelajaran Mendalam (RPM) bersintaks terstruktur dan Lembar Kerja Peserta Didik (LKPD) mandiri bermakna (mindful, meaningful, joyful) untuk 8 pertemuan penuh secara instan dengan kecerdasan Gemini.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Form Column (Left) */}
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={handleGenerate} className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 border-b pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Parameter Dokumen
            </h2>

            {/* Penyusun */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Penyusun (Nama Guru) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={penyusun}
                onChange={(e) => {
                  setPenyusun(e.target.value);
                  if (errors.penyusun) setErrors({ ...errors, penyusun: '' });
                }}
                className={`w-full text-sm border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  errors.penyusun ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200'
                }`}
                placeholder="Contoh: Soleh, S.Pd., M.Pd."
              />
              {errors.penyusun && <p className="text-rose-500 text-xs mt-1">{errors.penyusun}</p>}
            </div>

            {/* Sekolah */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={sekolah}
                onChange={(e) => {
                  setSekolah(e.target.value);
                  if (errors.sekolah) setErrors({ ...errors, sekolah: '' });
                }}
                className={`w-full text-sm border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  errors.sekolah ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200'
                }`}
                placeholder="Contoh: SMP Negeri 1 Jakarta"
              />
              {errors.sekolah && <p className="text-rose-500 text-xs mt-1">{errors.sekolah}</p>}
            </div>

            {/* Grid 2 Columns for small fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Kelas/Fase <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    if (errors.grade) setErrors({ ...errors, grade: '' });
                  }}
                  className={`w-full text-sm border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    errors.grade ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200'
                  }`}
                  placeholder="Contoh: 7"
                />
                {errors.grade && <p className="text-rose-500 text-xs mt-1">{errors.grade}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full text-sm border border-slate-200 px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Contoh: Matematika"
                />
              </div>
            </div>

            {/* Bab & Topik */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Bab <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bab}
                  onChange={(e) => {
                    setBab(e.target.value);
                    if (errors.bab) setErrors({ ...errors, bab: '' });
                  }}
                  className={`w-full text-sm border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    errors.bab ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200'
                  }`}
                  placeholder="Contoh: Bab 1: Bilangan Bulat"
                />
                {errors.bab && <p className="text-rose-500 text-xs mt-1">{errors.bab}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Topik Utama <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={materi}
                  onChange={(e) => {
                    setMateri(e.target.value);
                    if (errors.materi) setErrors({ ...errors, materi: '' });
                  }}
                  className={`w-full text-sm border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    errors.materi ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200'
                  }`}
                  placeholder="Contoh: Operasi Bilangan Bulat"
                />
                {errors.materi && <p className="text-rose-500 text-xs mt-1">{errors.materi}</p>}
              </div>
            </div>

            {/* Tahun Ajaran, Semester, Alokasi Waktu */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  className="w-full text-xs border border-slate-200 px-2 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="2026/2027"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full text-xs border border-slate-200 px-2 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                  <option value="1">1 (Ganjil)</option>
                  <option value="2">2 (Genap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Alokasi Waktu
                </label>
                <input
                  type="text"
                  value={alokasiWaktu}
                  onChange={(e) => setAlokasiWaktu(e.target.value)}
                  className="w-full text-xs border border-slate-200 px-2 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="16x40 Menit"
                />
              </div>
            </div>

            {/* Konteks Tambahan */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Konteks Tambahan (Opsional)
              </label>
              <textarea
                value={konteksTambahan}
                onChange={(e) => setKonteksTambahan(e.target.value)}
                className="w-full text-xs border border-slate-200 px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all h-20 resize-none"
                placeholder="Contoh: Fokuskan pada metode visual garis bilangan untuk siswa lambat belajar, atau integrasikan game kartu bilangan bulat..."
              />
            </div>

            {/* Error Message banner */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Action submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-medium text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-75 disabled:hover:bg-slate-900 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  Menganalisis & Menyusun...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Susun Perencanaan Mendalam
                </>
              )}
            </button>
          </form>

          {/* Quick tips about deep learning */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
              Mengapa Pendekatan Deep Learning?
            </h3>
            <p className="text-xs text-indigo-700/90 leading-relaxed">
              Model pembelajaran ini membimbing siswa melampaui hafalan rutin dengan mengedepankan pengalaman belajar holistik:
            </p>
            <ul className="text-xs text-indigo-800 space-y-1.5 list-disc list-inside pl-1 font-medium">
              <li><strong>Mindful</strong> (Berkesadaran penuh dalam proses)</li>
              <li><strong>Meaningful</strong> (Menemukan makna nyata & korelasi)</li>
              <li><strong>Joyful</strong> (Menggembirakan & membangun gairah)</li>
            </ul>
          </div>
        </div>

        {/* Output Column (Right) */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-stage"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4 min-h-[450px]"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="font-semibold text-slate-800 text-lg">Menyusun Rencana & LKPD Terbaik</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Kecerdasan AI sedang memetakan desain pembelajaran mendalam untuk 8 pertemuan penuh secara detail, membuat tabel komponen, rubrik penilaian, materi ajar, serta 8 bundel LKPD utuh...
                  </p>
                </div>
              </motion.div>
            ) : rpmResult ? (
              <motion.div
                key="output-stage"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Export & Action Panel */}
                <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                      <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Dokumen Pembelajaran Terbentuk</h3>
                      <p className="text-xs text-slate-400">Pilih opsi ekspor di samping untuk menyimpan atau menyunting.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Clipboard copy + Docs redirect (Requested feature) */}
                    <button
                      onClick={handleCopyToClipboardAndOpenDocs}
                      disabled={copiedStatus}
                      className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-medium text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <ClipboardCopy className="w-4 h-4 text-indigo-200" />
                      {copiedStatus ? 'Tersalin & Membuka Docs...' : 'Salin & Buka Google Dokumen'}
                    </button>

                    {/* Standard .doc Download */}
                    <button
                      onClick={handleDownloadDoc}
                      className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 active:scale-[0.98] border border-slate-700 text-slate-200 font-medium text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <FileDown className="w-4 h-4 text-slate-400" />
                      Unduh Berkas .Doc
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs for RPM Result Preview */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
                    <button
                      onClick={() => setActiveTab('rpm')}
                      className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'rpm'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      Tabel RPP (A-E)
                    </button>
                    <button
                      onClick={() => setActiveTab('lampiran')}
                      className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'lampiran'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-slate-400" />
                      Lampiran Dokumen
                    </button>
                    <button
                      onClick={() => setActiveTab('lkpd')}
                      className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'lkpd'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-4 h-4 text-slate-400" />
                      Lembar Kerja (LKPD) Siswa
                    </button>
                  </div>

                  <div className="p-6">
                    {/* Tab 1: RPM Table Content */}
                    {activeTab === 'rpm' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold text-slate-800 text-base">Tabel Rencana Pelaksanaan Pembelajaran</h3>
                          <span className="text-xs text-slate-400 italic">Format Tabel Dua Kolom</span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-slate-900 text-white text-xs uppercase font-semibold">
                                <th className="w-1/3 px-4 py-3 border border-slate-200">Komponen / Sub-komponen</th>
                                <th className="w-2/3 px-4 py-3 border border-slate-200">Isi Perencanaan Pembelajaran</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs text-slate-700 divide-y divide-slate-200">
                              {/* IDENTITAS CATEGORY */}
                              <tr className="bg-slate-50 font-bold text-slate-900">
                                <td colSpan={2} className="px-4 py-2.5 border border-slate-200 bg-indigo-50/40 text-indigo-900">A. IDENTITAS</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Penyusun</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.penyusun}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Sekolah</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.sekolah}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Tahun Ajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.tahunAjaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Semester</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.semester === '1' ? 'I (Ganjil)' : 'II (Genap)'}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Mata Pelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.mataPelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Kelas / Fase Capaian</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">Kelas {rpmResult.identitas.kelasFase}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Bab</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.bab}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Topik</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.topik}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Alokasi Waktu</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identitas.alokasiWaktu}</td>
                              </tr>

                              {/* IDENTIFIKASI CATEGORY */}
                              <tr className="bg-slate-50 font-bold text-slate-900">
                                <td colSpan={2} className="px-4 py-2.5 border border-slate-200 bg-indigo-50/40 text-indigo-900">B. IDENTIFIKASI</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Identifikasi Murid</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.identifikasi.identifikasiMurid}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Materi Pelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.identifikasi.materiPelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Dimensi Profil Lulusan</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.identifikasi.dimensiProfilLulusan}</td>
                              </tr>

                              {/* DESAIN PEMBELAJARAN CATEGORY */}
                              <tr className="bg-slate-50 font-bold text-slate-900">
                                <td colSpan={2} className="px-4 py-2.5 border border-slate-200 bg-indigo-50/40 text-indigo-900">C. DESAIN PEMBELAJARAN</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Capaian Pembelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.desainPembelajaran.capaianPembelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Lintas Disiplin Ilmu</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.desainPembelajaran.lintasDisiplinIlmu}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Tujuan Pembelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.desainPembelajaran.tujuanPembelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Topik Pembelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.desainPembelajaran.topikPembelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Praktik Pedagogis</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.desainPembelajaran.praktikPedagogis}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Kemitraan Pembelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.desainPembelajaran.kemitraanPembelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Lingkungan Pembelajaran</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.desainPembelajaran.lingkunganPembelajaran}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Pemanfaatan Digital</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800">{rpmResult.desainPembelajaran.pemanfaatanDigital}</td>
                              </tr>

                              {/* PENGALAMAN BELAJAR CATEGORY */}
                              <tr className="bg-slate-50 font-bold text-slate-900">
                                <td colSpan={2} className="px-4 py-2.5 border border-slate-200 bg-indigo-50/40 text-indigo-900">D. PENGALAMAN BELAJAR</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Kegiatan Awal</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.pengalamanBelajar.kegiatanAwal}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Kegiatan Inti (8 Pertemuan)</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{rpmResult.pengalamanBelajar.kegiatanInti}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Kegiatan Penutup</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{rpmResult.pengalamanBelajar.kegiatanPenutup}</td>
                              </tr>

                              {/* ASESMEN PEMBELAJARAN CATEGORY */}
                              <tr className="bg-slate-50 font-bold text-slate-900">
                                <td colSpan={2} className="px-4 py-2.5 border border-slate-200 bg-indigo-50/40 text-indigo-900">E. ASESMEN PEMBELAJARAN</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Asesmen Awal</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap">{rpmResult.asesmenPembelajaran.awal}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Asesmen Proses</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap">{rpmResult.asesmenPembelajaran.proses}</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-slate-200 font-semibold bg-slate-50/40">Asesmen Akhir</td>
                                <td className="px-4 py-3 border border-slate-200 text-slate-800 whitespace-pre-wrap">{rpmResult.asesmenPembelajaran.akhir}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Signatures view */}
                        <div className="grid grid-cols-2 gap-6 pt-6 border-t mt-4 text-center text-xs">
                          <div className="space-y-12">
                            <p className="text-slate-500">Mengetahui,</p>
                            <p className="font-bold text-slate-800 text-sm">Kepala Sekolah</p>
                            <div className="pt-6">
                              <p className="font-bold text-slate-900 underline">{rpmResult.tandaTangan.kepalaSekolah}</p>
                              <p className="text-slate-400">NIP. _______________________</p>
                            </div>
                          </div>

                          <div className="space-y-12">
                            <p className="text-slate-500">Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="font-bold text-slate-800 text-sm">Guru Mata Pelajaran</p>
                            <div className="pt-6">
                              <p className="font-bold text-slate-900 underline">{rpmResult.tandaTangan.guruMapel}</p>
                              <p className="text-slate-400">NIP. _______________________</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Lampiran Documents Content */}
                    {activeTab === 'lampiran' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold text-slate-800 text-base">Berkas Lampiran RPM</h3>
                        </div>

                        {/* Section 1: Asesmen Awal */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-3">
                          <h4 className="font-bold text-indigo-900 text-sm border-b pb-1.5">1. Asesmen Awal Pembelajaran</h4>
                          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            {rpmResult.lampiran.asesmenAwal}
                          </div>
                        </div>

                        {/* Section 2: Asesmen Proses */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-3">
                          <h4 className="font-bold text-indigo-900 text-sm border-b pb-1.5">2. Asesmen Proses Pembelajaran (Skala Rubrik)</h4>
                          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            {rpmResult.lampiran.asesmenProses}
                          </div>
                        </div>

                        {/* Section 3: Asesmen Akhir */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-3">
                          <h4 className="font-bold text-indigo-900 text-sm border-b pb-1.5">3. Asesmen Akhir Pembelajaran</h4>
                          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            {rpmResult.lampiran.asesmenAkhir}
                          </div>
                        </div>

                        {/* Section 4: Materi Ajar */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-3">
                          <h4 className="font-bold text-indigo-900 text-sm border-b pb-1.5">4. Materi Ajar Utama</h4>
                          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            {rpmResult.lampiran.materiAjar}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: LKPD Content */}
                    {activeTab === 'lkpd' && (
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
                          <h3 className="font-bold text-slate-800 text-base">Bundel Lembar Kerja Peserta Didik (LKPD)</h3>
                          <p className="text-xs text-slate-400 italic">Terdiri atas 8 Pertemuan Utuh Mandiri</p>
                        </div>

                        {/* Horizontal buttons for LKPD meetings Selection */}
                        <div className="flex flex-wrap gap-1.5 border-b pb-3">
                          {rpmResult.lkpdList.map((lkpd, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedLkpdIndex(idx)}
                              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                                selectedLkpdIndex === idx
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-slate-100 hover:bg-slate-200/75 text-slate-600'
                              }`}
                            >
                              Pertemuan {idx + 1}
                            </button>
                          ))}
                        </div>

                        {/* Active LKPD item display */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedLkpdIndex}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="bg-slate-50/50 p-6 rounded-xl border border-slate-200 shadow-inner space-y-4"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                              <h4 className="text-base font-bold text-slate-800">
                                {rpmResult.lkpdList[selectedLkpdIndex]?.title || `LKPD Pertemuan ${selectedLkpdIndex + 1}`}
                              </h4>
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                SINTAKS INTEGRATIF
                              </span>
                            </div>

                            {/* Complete LKPD markup style with non-table structured view */}
                            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
                              {rpmResult.lkpdList[selectedLkpdIndex]?.content}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200/80 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[450px]">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="font-semibold text-slate-800 text-sm">Menunggu Parameter Input</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tentukan nama penyusun, sekolah, mata pelajaran, bab, dan topik di panel kiri, lalu klik tombol susun untuk merakit modul RPM.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
