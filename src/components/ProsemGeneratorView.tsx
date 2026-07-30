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
  FileText
} from 'lucide-react';
import { ProsemData } from '../types';
import { downloadDocFile, copyAndOpenGoogleDocs, exportProsemToDoc } from '../lib/exportUtils';

export default function ProsemGeneratorView() {
  // Input states
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [kelas, setKelas] = useState('5');
  const [fase, setFase] = useState('C');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [alokasiWaktuTiapMinggu, setAlokasiWaktuTiapMinggu] = useState('4 JP');
  const [protaContent, setProtaContent] = useState(
    "Bab I: Aktivitas Pola Gerak Dasar Lokomotor & Non-Lokomotor (Total: 24 JP, Semester Ganjil)\n" +
    "- Topik A: Kombinasi jalan, lari, lompat (12 JP)\n" +
    "- Topik B: Prosedur variasi gerak non-lokomotor (12 JP)\n\n" +
    "Bab II: Aktivitas Kebugaran Jasmani untuk Kesehatan (Total: 16 JP, Semester Ganjil)\n" +
    "- Topik A: Latihan daya tahan jantung dan paru-paru (16 JP)\n\n" +
    "Bab III: Senam Lantai & Aktivitas Senam (Total: 20 JP, Semester Genap)\n" +
    "- Topik A: Tumpuan tangan & keseimbangan (12 JP)\n" +
    "- Topik B: Rangkaian senam lantai sederhana (8 JP)\n\n" +
    "Bab IV: Aktivitas Air & Renang Gaya Dada (Total: 20 JP, Semester Genap)\n" +
    "- Topik A: Gerakan meluncur & kaki renang (12 JP)\n" +
    "- Topik B: Koordinasi napas & kayuhan gaya dada (8 JP)"
  );

  // Status states
  const [prosemResult, setProsemResult] = useState<ProsemData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Auto-set Fase based on Kelas
  const handleKelasChange = (val: string) => {
    setKelas(val);
    if (val === '1' || val === '2') {
      setFase('A');
    } else if (val === '3' || val === '4') {
      setFase('B');
    } else if (val === '5' || val === '6') {
      setFase('C');
    } else if (val === '7' || val === '8' || val === '9') {
      setFase('D');
    } else if (val === '10') {
      setFase('E');
    } else if (val === '11' || val === '12') {
      setFase('F');
    }
  };

  const handleGenerateProsem = async (e: React.FormEvent) => {
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
    if (!protaContent.trim()) {
      setValidationError('Data Program Tahunan (PROTA) acuan wajib diisi atau dilampirkan.');
      return;
    }

    setIsGenerating(true);
    setProsemResult(null);

    try {
      const response = await fetch('/api/generate-prosem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mataPelajaran,
          kelas,
          fase,
          tahunPelajaran,
          alokasiWaktuTiapMinggu,
          protaContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menyusun Program Semester dari AI.');
      }

      const data = await response.json();
      setProsemResult(data);
    } catch (err: any) {
      setApiError(err.message || 'Gagal menyusun Program Semester (PROSEM).');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAndGoToDocs = async () => {
    if (!prosemResult) return;
    setCopySuccess(false);
    const docHtml = exportProsemToDoc(prosemResult);
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!prosemResult) return;
    const docHtml = exportProsemToDoc(prosemResult);
    downloadDocFile(`PROSEM_${mataPelajaran.replace(/\s+/g, '_')}_Kelas_${kelas}.doc`, docHtml);
  };

  // Render a single semester table in UI preview
  const renderSemesterPreviewTable = (semesterName: string, semesterData: any) => {
    if (!semesterData || !semesterData.monthsHeader || !semesterData.rows) {
      return null;
    }

    return (
      <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Program Semester - Semester {semesterName}
          </h4>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] text-xs">
            <thead>
              {/* Row 1: Month Headers */}
              <tr className="bg-slate-800 text-white border-b border-slate-700">
                <th rowSpan={2} className="px-3 py-3 border-r border-slate-700 text-center font-bold w-12">No</th>
                <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 font-bold w-48">Unit / Bab</th>
                <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 font-bold w-64">Topik / Konten Pembelajaran</th>
                <th rowSpan={2} className="px-3 py-3 border-r border-slate-700 text-center font-bold w-20">Pert. Ke-</th>
                <th rowSpan={2} className="px-3 py-3 border-r border-slate-700 text-center font-bold w-20">Alokasi</th>
                {semesterData.monthsHeader.map((m: any, idx: number) => (
                  <th 
                    key={idx} 
                    colSpan={m.totalWeeks} 
                    className="px-2 py-2 border-r border-slate-700 text-center font-bold bg-indigo-950"
                  >
                    {m.monthName}
                  </th>
                ))}
              </tr>
              {/* Row 2: Week Numbers */}
              <tr className="bg-slate-750 text-slate-200 border-b border-slate-700 text-center">
                {semesterData.monthsHeader.map((m: any, mIdx: number) => {
                  const weeks = [];
                  for (let w = 1; w <= m.totalWeeks; w++) {
                    const isNonEffective = m.nonEffectiveWeeks.includes(w);
                    weeks.push(
                      <th 
                        key={`${mIdx}-${w}`} 
                        className={`px-1 py-1 text-[10px] font-bold border-r border-slate-700 w-8 ${
                          isNonEffective ? 'bg-rose-950 text-rose-300' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {w}
                      </th>
                    );
                  }
                  return weeks;
                })}
              </tr>
            </thead>
            <tbody>
              {semesterData.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-2.5 border-r border-slate-200 text-center font-medium text-slate-600">{row.no}</td>
                  <td className="px-4 py-2.5 border-r border-slate-200 font-bold text-slate-800">{row.bab}</td>
                  <td className="px-4 py-2.5 border-r border-slate-200 text-slate-700">{row.topik}</td>
                  <td className="px-3 py-2.5 border-r border-slate-200 text-center text-slate-600 font-mono">{row.pertemuanKe}</td>
                  <td className="px-3 py-2.5 border-r border-slate-200 text-center font-semibold text-indigo-700">{row.alokasiWaktu}</td>
                  
                  {row.months.map((m: any) => {
                    const headerMonth = semesterData.monthsHeader.find((h: any) => h.monthName === m.monthName);
                    return m.weeks.map((w: any, wIdx: number) => {
                      const isNonEffectiveHeader = headerMonth ? headerMonth.nonEffectiveWeeks.includes(w.weekNum) : !w.isEffective;
                      
                      let cellClass = '';
                      let cellText = w.value || '';
                      
                      if (isNonEffectiveHeader || !w.isEffective) {
                        cellClass = 'bg-slate-100 text-slate-400'; // default non-effective column
                        if (w.value && (w.value.includes('L') || w.value.toLowerCase().includes('libur'))) {
                          cellClass = 'bg-yellow-100 text-yellow-800 font-bold'; // Holiday
                        } else if (w.value && (w.value.includes('MPLS') || w.value.toLowerCase().includes('asesmen') || w.value.includes('PTS') || w.value.includes('PAS') || w.value.includes('PAT') || w.value.includes('STS') || w.value.includes('SAS'))) {
                          cellClass = 'bg-blue-100 text-blue-800 font-bold'; // Assessment / MPLS
                        }
                      } else if (w.value) {
                        cellClass = 'bg-emerald-50 text-emerald-800 font-bold'; // Scheduled learning
                      }

                      return (
                        <td 
                          key={`${m.monthName}-${w.weekNum}`}
                          className={`px-1 py-2 border-r border-slate-200 text-center font-bold ${cellClass}`}
                        >
                          {cellText}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-emerald-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Penyusunan Program Semester (PROSEM)
        </h2>
        <p className="mt-2 text-emerald-100 max-w-3xl text-sm sm:text-base leading-relaxed">
          Ubah Program Tahunan (PROTA) menjadi Program Semester yang detail secara otomatis. AI kami akan mendistribusikan jam pelajaran secara matematis dan berurutan sesuai pekan efektif & tidak efektif kalender akademik sekolah.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Form Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Formulir Parameter
            </h3>

            {validationError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleGenerateProsem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                  placeholder="Contoh: Pendidikan Pancasila, PJOK"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={kelas}
                    onChange={(e) => handleKelasChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    required
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={`${i + 1}`}>Kelas {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fase <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fase}
                    onChange={(e) => setFase(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 cursor-not-allowed font-bold text-center"
                    readOnly
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    placeholder="Contoh: 2026/2027"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alokasi Waktu Mingguan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={alokasiWaktuTiapMinggu}
                    onChange={(e) => setAlokasiWaktuTiapMinggu(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    required
                  >
                    <option value="2 JP">2 JP / Minggu</option>
                    <option value="3 JP">3 JP / Minggu</option>
                    <option value="4 JP">4 JP / Minggu</option>
                    <option value="5 JP">5 JP / Minggu</option>
                    <option value="6 JP">6 JP / Minggu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data Acuan PROTA (Copy-Paste) <span className="text-rose-500">*</span>
                </label>
                <div className="text-[10px] text-slate-500 mb-1 leading-relaxed">
                  Tempel teks hasil Program Tahunan (PROTA) atau rincian materi & total JP yang akan dijadwalkan di bawah ini.
                </div>
                <textarea
                  value={protaContent}
                  onChange={(e) => setProtaContent(e.target.value)}
                  rows={8}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white leading-relaxed"
                  placeholder="Format bebas, pastikan memuat Nama Bab, Topik, dan Alokasi JP..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-emerald-600 to-indigo-700 text-white rounded-xl py-3 px-4 text-xs font-bold shadow-md hover:from-emerald-700 hover:to-indigo-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyusun PROSEM Melalui AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    Susun Program Semester
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Guidelines info card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              Ketentuan Distribusi PROSEM
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
              <li>Setiap pekan dibagi menjadi kolom kecil 1 s.d. 4 atau 5 secara horizontal.</li>
              <li>Pekan tidak efektif diarsir warna slate/biru/kuning secara vertikal.</li>
              <li>Asesmen Sumatif Tengah Semester (PTS/STS) diatur pada September pekan ke-3 & 4, serta Maret pekan ke-1 & 2.</li>
              <li>Asesmen Sumatif Akhir Semester (PAS/SAS/PAT) diatur pada Desember pekan ke-1 & 2, serta Juni pekan ke-1 & 2.</li>
              <li>Kegiatan Masa Pengenalan Lingkungan Sekolah (MPLS) hanya dimunculkan khusus untuk Kelas 1, 7, atau 10 pada Juli pekan ke-1 & 2.</li>
            </ul>
          </div>
        </div>

        {/* Output Area Column */}
        <div className="lg:col-span-8 space-y-6">
          {apiError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-rose-600" />
              <div>
                <h5 className="font-bold">Pembuatan PROSEM Gagal</h5>
                <p className="text-xs text-rose-700 mt-1">{apiError}</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="bg-white rounded-xl shadow-md p-12 border border-slate-100 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <h4 className="text-lg font-bold text-slate-800">Menyusun Struktur PROSEM...</h4>
              <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
                Gemini AI sedang menghitung dan memetakan alokasi JP per topik pembelajaran Anda ke dalam kalender akademik semester ganjil dan genap secara matematis...
              </p>
            </div>
          )}

          {!prosemResult && !isGenerating && !apiError && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-16 h-16 text-slate-300 mb-4" />
              <h4 className="text-lg font-bold text-slate-700">Program Semester Belum Dibuat</h4>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                Silakan isi data identitas mata pelajaran Anda di panel kiri, tempel acuan PROTA, lalu tekan tombol <strong>"Susun Program Semester"</strong> untuk memproses lewat kecerdasan buatan.
              </p>
            </div>
          )}

          {prosemResult && !isGenerating && (
            <div className="space-y-6">
              {/* Document Actions */}
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    PROSEM Berhasil Disusun!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Silakan unduh file Word (.doc) lanskap atau salin langsung ke Google Dokumen Anda.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={handleCopyAndGoToDocs}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white text-xs px-4 py-2.5 rounded-lg font-bold transition shadow-sm cursor-pointer"
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Tersalin! Membuka Docs...
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Salin & Buka Google Dokumen
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadDoc}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Dokumen Word (.doc)
                  </button>
                </div>
              </div>

              {/* Informational message about clipboard & google docs */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 leading-relaxed flex gap-2">
                <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Petunjuk Google Dokumen:</strong> Setelah menekan tombol <strong>"Salin & Buka Google Dokumen"</strong>, tab baru Google Dokumen kosong akan terbuka otomatis. Cukup tempel hasil tadi dengan menekan tombol keyboard <strong>Ctrl+V</strong> (atau <strong>Cmd+V</strong> pada Mac) untuk menempel tabel landscape rapi tanpa mengubah format aslinya!
                </div>
              </div>

              {/* Ganjil Preview */}
              {renderSemesterPreviewTable('Ganjil (Semester I)', prosemResult.ganjil)}

              {/* Genap Preview */}
              {renderSemesterPreviewTable('Genap (Semester II)', prosemResult.genap)}

              {/* Keterangan & Catatan preview */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Keterangan & Catatan Agenda Khusus Kalender Akademik:
                </h5>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {prosemResult.keterangan || 'Agenda Khusus menyesuaikan kalender akademik daerah setempat.'}
                </p>
              </div>

              {/* Signatures preview */}
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200 text-center text-xs">
                <div>
                  <p className="text-slate-500">Mengetahui,</p>
                  <p className="font-bold text-slate-800 mt-1">Kepala Sekolah</p>
                  <div className="h-16"></div>
                  <p className="font-bold text-slate-800 underline">
                    {prosemResult.kepalaSekolah || '___________________________'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">NIP. _______________________</p>
                </div>
                <div>
                  <p className="text-slate-500">
                    {prosemResult.tanggalDokumen || 'Jakarta, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-bold text-slate-800 mt-1">Guru Mata Pelajaran</p>
                  <div className="h-16"></div>
                  <p className="font-bold text-slate-800 underline">
                    {prosemResult.guruMapel || '___________________________'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">NIP. _______________________</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
