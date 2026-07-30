import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Download, 
  Printer, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  BrainCircuit,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileText,
  FileSignature,
  Layers,
  GraduationCap,
  Calendar,
  School,
  ClipboardList,
  ChevronRight,
  Bookmark,
  ChevronLeft
} from 'lucide-react';
import { downloadDocFile } from '../lib/exportUtils';

interface Question {
  noSoal: number;
  bentukSoal: string;
  levelKognitif: string;
  capaianPembelajaran: string;
  indikatorSoal: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  pedomanPenskoran: string;
}

interface SumatifResult {
  judulUjian: string;
  kop: {
    dinasPendidikan: string;
    namaSekolah: string;
    mataPelajaran: string;
    kelas: string;
    semester: string;
    tahunPelajaran: string;
  };
  questions: Question[];
}

export default function SoalSumatifView() {
  const [jenisUjian, setJenisUjian] = useState('Asesmen Sumatif Akhir Semester (SAS)');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [grade, setGrade] = useState('4');
  const [semester, setSemester] = useState('Ganjil');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [babMateri, setBabMateri] = useState('Kombinasi Pola Gerak Dasar Lokomotor, Non-lokomotor, dan Manipulatif');
  const [bentukSoal, setBentukSoal] = useState<'pilihan_ganda' | 'isian' | 'uraian' | 'campuran'>('pilihan_ganda');
  const [levelKognitif, setLevelKognitif] = useState<'lots' | 'mots' | 'hots' | 'campuran'>('campuran');
  const [totalSoal, setTotalSoal] = useState('5');
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Pintar Bersama');
  const [dinasPendidikan, setDinasPendidikan] = useState('Dinas Pendidikan Pemuda Dan Olahraga');

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SumatifResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Tab within the result view
  const [resultTab, setResultTab] = useState<'naskah' | 'kunci' | 'kartu'>('naskah');
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babMateri.trim()) return;

    setIsGenerating(true);
    setApiError(null);
    setResult(null);
    setActiveCardIdx(0);

    try {
      const response = await fetch('/api/generate-soal-sumatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenisUjian,
          mataPelajaran,
          grade,
          semester,
          tahunPelajaran,
          babMateri,
          bentukSoal,
          levelKognitif,
          totalSoal,
          namaSekolah,
          dinasPendidikan
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Terjadi kesalahan saat menyusun soal sumatif.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setApiError(err.message || 'Gagal menyusun paket soal sumatif & kartu soal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportNaskahDoc = () => {
    if (!result) return;

    const questionsHtml = result.questions.map((q, idx) => {
      let optionsHtml = '';
      if (q.options && q.options.length > 0) {
        optionsHtml = `
          <table style="width: 100%; border-collapse: collapse; border: none; margin-left: 20px; margin-top: 5px; margin-bottom: 10px;">
            <tr>
              <td style="border: none; padding: 2px 5px;" width="50%">${q.options[0] || ''}</td>
              <td style="border: none; padding: 2px 5px;" width="50%">${q.options[1] || ''}</td>
            </tr>
            <tr>
              <td style="border: none; padding: 2px 5px;">${q.options[2] || ''}</td>
              <td style="border: none; padding: 2px 5px;">${q.options[3] || ''}</td>
            </tr>
          </table>
        `;
      } else {
        optionsHtml = `
          <div style="margin-top: 30px; border-bottom: 1px dotted #cbd5e1; width: 95%; margin-left: 20px;"></div>
          <div style="margin-top: 20px; border-bottom: 1px dotted #cbd5e1; width: 95%; margin-left: 20px; margin-bottom: 15px;"></div>
        `;
      }

      return `
        <div style="margin-bottom: 15pt; line-height: 1.5;">
          <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
            <tr>
              <td style="border: none; padding: 2px; font-weight: bold;" width="4%" valign="top">${idx + 1}.</td>
              <td style="border: none; padding: 2px; font-weight: normal;" width="96%">${q.question} <span style="font-size: 8.5pt; color: #475569;">(${q.levelKognitif})</span></td>
            </tr>
          </table>
          ${optionsHtml}
        </div>
      `;
    }).join('\n');

    const fullHtml = `
      <div style="font-family: 'Arial', sans-serif;">
        <!-- KOP SEKOLAH -->
        <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0; text-transform: uppercase; font-size: 11pt;">${result.kop.dinasPendidikan.toUpperCase()}</h2>
          <h1 style="margin: 3px 0; font-size: 14pt; border: none; text-align: center; font-family: Arial; text-transform: uppercase;">${result.kop.namaSekolah.toUpperCase()}</h1>
          <p style="margin: 0; font-size: 9pt; font-style: italic;">Alamat Sekolah &bull; Kabupaten/Kota &bull; Provinsi</p>
        </div>

        <!-- JUDUL UJIAN -->
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px; font-size: 12pt;">${result.judulUjian}</h3>

        <!-- GRID IDENTITAS -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px;">
          <tr>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;" width="25%"><strong>Mata Pelajaran</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;" width="35%">: ${result.kop.mataPelajaran}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;" width="15%"><strong>Nama Siswa</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;" width="25%">: ____________________</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;"><strong>Kelas / Semester</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;">: Kelas ${result.kop.kelas} / ${result.kop.semester}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;"><strong>No. Absen</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;">: ____________________</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;"><strong>Tahun Pelajaran</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;">: ${result.kop.tahunPelajaran}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;"><strong>Nilai / Paraf</strong></td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9.5pt;">: ________ / ________</td>
          </tr>
        </table>

        <!-- PETUNJUK UMUM -->
        <div style="border: 1px solid #94a3b8; padding: 8px; margin-bottom: 20px; font-size: 9pt; background-color: #f8fafc;">
          <strong>Petunjuk Umum:</strong>
          <ol style="margin-top: 3px; margin-bottom: 0; padding-left: 15px;">
            <li>Tuliskan identitas Anda secara lengkap di kolom yang telah disediakan.</li>
            <li>Bacalah setiap butir soal dengan saksama sebelum memberikan jawaban.</li>
            <li>Kerjakan terlebih dahulu soal-soal yang Anda anggap lebih mudah.</li>
            <li>Periksa kembali seluruh lembar jawaban Anda sebelum diserahkan kepada pengawas kelas.</li>
          </ol>
        </div>

        <div style="margin-top: 15px;">
          ${questionsHtml}
        </div>
      </div>
    `;

    downloadDocFile(`Naskah_Soal_${result.judulUjian.replace(/\s+/g, '_')}_Kelas_${grade}`, fullHtml);
  };

  const handleExportKunciDoc = () => {
    if (!result) return;

    const keysHtml = result.questions.map((q, idx) => `
      <div style="margin-bottom: 15pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
        <p style="font-weight: bold; margin-bottom: 5px;">Soal No. ${idx + 1} (${q.bentukSoal} - ${q.levelKognitif})</p>
        <p style="margin-bottom: 5px;"><strong>Pertanyaan:</strong> ${q.question}</p>
        <p style="color: #0d9488; font-weight: bold; margin-bottom: 3px;">Kunci Jawaban: ${q.correctAnswer}</p>
        <p style="font-size: 9.5pt; color: #475569; margin-bottom: 5px;"><strong>Penjelasan Pedagogi:</strong> ${q.explanation}</p>
        <p style="font-size: 9.5pt; background-color: #fef3c7; padding: 5px; border-radius: 4px; display: inline-block;"><strong>Kriteria Skor:</strong> ${q.pedomanPenskoran}</p>
      </div>
    `).join('\n');

    const fullHtml = `
      <div style="font-family: 'Arial', sans-serif;">
        <h1 style="font-size: 15pt; border-bottom: 2px solid #000; padding-bottom: 6px; text-align: center;">KUNCI JAWABAN & PEDOMAN PENSKORAN</h1>
        <p style="text-align: center; font-size: 10pt; color: #475569; margin-top: -4px;">${result.judulUjian} &bull; Kelas ${result.kop.kelas}</p>
        
        <div style="margin-top: 20px;">
          ${keysHtml}
        </div>
      </div>
    `;

    downloadDocFile(`Kunci_Jawaban_${result.judulUjian.replace(/\s+/g, '_')}_Kelas_${grade}`, fullHtml);
  };

  const handleExportKartuSoalDoc = () => {
    if (!result) return;

    const cardsHtml = result.questions.map((q, idx) => `
      <div style="page-break-after: always; margin-bottom: 30pt;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-family: Arial, sans-serif;">
          <!-- BARIS KOP KARTU -->
          <tr style="background-color: #f1f5f9;">
            <td colspan="4" style="border: 1px solid #000; padding: 8px; text-align: center;">
              <strong style="font-size: 11pt; text-transform: uppercase;">KARTU SOAL SUMATIF SD (KURIKULUM MERDEKA)</strong><br>
              <span style="font-size: 9.5pt;">${result.kop.namaSekolah} &bull; ${result.kop.dinasPendidikan}</span>
            </td>
          </tr>
          <!-- IDENTITAS UTAMA -->
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;" width="25%"><strong>Mata Pelajaran</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;" width="25%">${result.kop.mataPelajaran}</td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;" width="25%"><strong>Bentuk Soal</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;" width="25%">${q.bentukSoal}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;"><strong>Kelas / Semester</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;">Kelas ${result.kop.kelas} / ${result.kop.semester}</td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;"><strong>Nomor Soal</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt; font-weight: bold; background-color: #f8fafc; text-align: center;">${q.noSoal}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;"><strong>Tahun Pelajaran</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;">${result.kop.tahunPelajaran}</td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;"><strong>Level Kognitif</strong></td>
            <td style="border: 1px solid #000; padding: 6px; font-size: 9pt;">${q.levelKognitif}</td>
          </tr>
          
          <!-- CAPAIAN PEMBELAJARAN & INDIKATOR -->
          <tr>
            <td colspan="4" style="border: 1px solid #000; padding: 8px; font-size: 9pt; background-color: #fafaf9;">
              <strong>Capaian Pembelajaran (CP) / Kompetensi Dasar:</strong><br>
              ${q.capaianPembelajaran}
            </td>
          </tr>
          <tr>
            <td colspan="4" style="border: 1px solid #000; padding: 8px; font-size: 9pt; background-color: #fafaf9;">
              <strong>Indikator Pencapaian Kompetensi / Indikator Soal:</strong><br>
              ${q.indikatorSoal}
            </td>
          </tr>

          <!-- RUMUSAN BUTIR SOAL -->
          <tr>
            <td colspan="4" style="border: 1px solid #000; padding: 10px; font-size: 9.5pt; min-height: 120px;" valign="top">
              <strong>RUMUSAN BUTIR SOAL:</strong><br>
              <p style="margin-top: 5px; font-weight: bold;">${q.question}</p>
              ${q.options && q.options.length > 0 ? `
                <div style="margin-left: 15px; margin-top: 6px;">
                  ${q.options.map(o => `<div style="margin-bottom: 2px;">${o}</div>`).join('')}
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- JAWABAN & PENSKORAN -->
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 8px; font-size: 9pt; background-color: #f0fdf4;" valign="top">
              <strong style="color: #166534;">KUNCI JAWABAN:</strong><br>
              <span style="font-weight: bold; font-size: 10pt; color: #166534;">${q.correctAnswer}</span>
              <p style="margin-top: 4px; font-size: 8.5pt; color: #374151;"><strong>Penjelasan:</strong> ${q.explanation}</p>
            </td>
            <td colspan="2" style="border: 1px solid #000; padding: 8px; font-size: 9pt; background-color: #fffbeb;" valign="top">
              <strong style="color: #92400e;">PEDOMAN PENSKORAN / EVALUASI:</strong><br>
              ${q.pedomanPenskoran}
            </td>
          </tr>
        </table>
      </div>
    `).join('\n');

    const fullHtml = `
      <div style="font-family: 'Arial', sans-serif;">
        <h1 style="font-size: 15pt; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 20px;">BERKAS BUNDEL KARTU SOAL SUMATIF</h1>
        ${cardsHtml}
      </div>
    `;

    downloadDocFile(`Kartu_Soal_Sumatif_${result.judulUjian.replace(/\s+/g, '_')}_Kelas_${grade}`, fullHtml);
  };

  const handleCopyClipboard = () => {
    if (!result) return;
    const cleanText = result.questions.map((q, idx) => {
      const opts = q.options.length > 0 ? `\nOpsi:\n${q.options.join('\n')}` : '';
      return `Soal No. ${idx + 1} (${q.bentukSoal} - ${q.levelKognitif})
Pertanyaan: ${q.question}${opts}
Kunci Jawaban: ${q.correctAnswer}
Penjelasan: ${q.explanation}
Skor: ${q.pedomanPenskoran}
----------------------------------------`;
    }).join('\n\n');

    navigator.clipboard.writeText(cleanText)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy text: ', err));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="summative-assessment-generator">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <FileSignature className="w-8 h-8 text-teal-300 animate-pulse" />
              Penyusun Soal Sumatif &amp; Kartu Soal AI
            </h2>
            <p className="mt-2 text-teal-100 max-w-2xl text-xs sm:text-sm leading-relaxed">
              Buat Soal Sumatif formal lengkap dengan <strong>Naskah Soal</strong> terstruktur, <strong>Kunci Jawaban &amp; Rubrik Penskoran</strong>, serta <strong>Kartu Soal Kurikulum Merdeka</strong> resmi yang siap dicetak dan diekspor ke Word / Google Docs.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shrink-0 text-center sm:text-left">
            <span className="text-[10px] uppercase font-bold tracking-widest text-teal-200 block">STANDAR NASIONAL</span>
            <span className="text-xs font-black text-white block mt-0.5">Kurikulum Merdeka 2026/2027</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Input Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              Pengaturan Asesmen
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Asesmen Sumatif <span className="text-rose-500">*</span>
                </label>
                <select
                  value={jenisUjian}
                  onChange={(e) => setJenisUjian(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                >
                  <option value="Asesmen Sumatif Akhir Semester (SAS)">Asesmen Sumatif Akhir Semester (SAS)</option>
                  <option value="Asesmen Sumatif Tengah Semester (STS)">Asesmen Sumatif Tengah Semester (STS)</option>
                  <option value="Asesmen Sumatif Lingkup Materi (Harian)">Asesmen Sumatif Lingkup Materi (Harian)</option>
                  <option value="Ujian Akhir Sekolah Dasar">Ujian Akhir Sekolah Dasar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                  placeholder="Misal: Pendidikan Jasmani, Olahraga, dan Kesehatan"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kelas SD <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>Kelas {n} SD</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bab / Lingkup Materi Utama <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={babMateri}
                  onChange={(e) => setBabMateri(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white font-medium"
                  placeholder="Contoh: Permainan Lapangan Tradisional & Aturan Kasti"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bentuk Soal
                  </label>
                  <select
                    value={bentukSoal}
                    onChange={(e) => setBentukSoal(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                  >
                    <option value="pilihan_ganda">Pilihan Ganda (PG)</option>
                    <option value="isian">Isian Singkat</option>
                    <option value="uraian">Uraian / Esai</option>
                    <option value="campuran">Campuran Variatif</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Level Kognitif
                  </label>
                  <select
                    value={levelKognitif}
                    onChange={(e) => setLevelKognitif(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                  >
                    <option value="campuran">Berimbang (LOTS-HOTS)</option>
                    <option value="hots">Fokus HOTS (C4 - C6)</option>
                    <option value="mots">Fokus MOTS (C3)</option>
                    <option value="lots">Fokus LOTS (C1 - C2)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Soal <span className="text-rose-500">*</span>
                </label>
                <select
                  value={totalSoal}
                  onChange={(e) => setTotalSoal(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                >
                  <option value="3">3 Soal</option>
                  <option value="5">5 Soal</option>
                  <option value="10">10 Soal</option>
                  <option value="15">15 Soal</option>
                </select>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identitas Sekolah Pembuat</p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Satuan Pendidikan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                    placeholder="SD Negeri Pintar Bersama"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dinas Pendidikan Daerah
                  </label>
                  <input
                    type="text"
                    value={dinasPendidikan}
                    onChange={(e) => setDinasPendidikan(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                    placeholder="Dinas Pendidikan Kota Bandung"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
                    placeholder="2026/2027"
                  />
                </div>
              </div>

              {apiError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2.5 rounded-lg text-xs leading-relaxed">
                  ⚠️ <strong>Gagal:</strong> {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menghitung &amp; Menulis Soal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Susun Soal &amp; Kartu Soal</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output View */}
        <div className="lg:col-span-8 space-y-6">
          {isGenerating ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[550px]">
              <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-teal-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Menyusun Naskah Asesmen Sumatif...</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                Gemini AI sedang menelaah taksonomi kognitif dan menyusun Capaian Pembelajaran, Indikator Butir Soal, serta pedoman penskoran sesuai rubrik formal sekolah dasar. Harap tunggu sesaat...
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Action and Navigation Header */}
              <div className="bg-white rounded-xl shadow-xs p-4 border border-slate-100 flex flex-wrap gap-4 justify-between items-center no-print">
                {/* Result Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setResultTab('naskah')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${resultTab === 'naskah' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    📝 Naskah Soal Siswa
                  </button>
                  <button
                    onClick={() => setResultTab('kunci')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${resultTab === 'kunci' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    🔑 Kunci &amp; Rubrik Guru
                  </button>
                  <button
                    onClick={() => setResultTab('kartu')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${resultTab === 'kartu' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    📇 Kartu Soal Keren
                  </button>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  {resultTab === 'naskah' && (
                    <button
                      onClick={handleExportNaskahDoc}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Word</span>
                    </button>
                  )}
                  {resultTab === 'kunci' && (
                    <button
                      onClick={handleExportKunciDoc}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Kunci Word</span>
                    </button>
                  )}
                  {resultTab === 'kartu' && (
                    <button
                      onClick={handleExportKartuSoalDoc}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Bundel Kartu</span>
                    </button>
                  )}

                  <button
                    onClick={handleCopyClipboard}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Salin Clipboard</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* RENDER TAB 1: NASKAH SOAL SISWA */}
              {resultTab === 'naskah' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6 print:p-0 print:border-none print:shadow-none">
                  
                  {/* Formal kop */}
                  <div className="text-center border-b-4 border-double border-slate-800 pb-3 mb-6 relative">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 leading-tight">
                      {result.kop.dinasPendidikan || 'DINAS PENDIDIKAN DAERAH'}
                    </p>
                    <h2 className="text-base font-extrabold uppercase mt-1 tracking-tight text-slate-800">
                      {result.kop.namaSekolah}
                    </h2>
                    <p className="text-[9.5px] text-slate-400 italic mt-0.5">
                      Alamat Satuan Pendidikan Utama &bull; Kurikulum Merdeka Terintegrasi AI
                    </p>
                  </div>

                  <h3 className="text-center text-sm font-black uppercase text-slate-800 tracking-wide">
                    {result.judulUjian}
                  </h3>

                  {/* Student Identity Grid */}
                  <div className="border border-slate-400 rounded-lg p-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-xs font-semibold">
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Mata Pelajaran</span>
                        <span className="text-slate-800">: {result.kop.mataPelajaran}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Nama Lengkap</span>
                        <span className="text-slate-300">: _________________________</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Hari / Tanggal</span>
                        <span className="text-slate-300">: _________________________</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Kelas / Semester</span>
                        <span className="text-slate-800">: Kelas {result.kop.kelas} / {result.kop.semester}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Nomor Absen</span>
                        <span className="text-slate-300">: _________________________</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-400 w-24">Nilai Kinerja</span>
                        <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 font-extrabold">: ______ / ______</span>
                      </div>
                    </div>
                  </div>

                  {/* General Instructions */}
                  <div className="border border-slate-200/80 bg-slate-50 rounded-lg p-3 text-xs leading-relaxed text-slate-600">
                    <strong>Petunjuk Umum Pengisian:</strong>
                    <ol className="list-decimal pl-4 mt-1.5 space-y-1">
                      <li>Tulis terlebih dahulu identitas diri Anda pada kolom yang disediakan.</li>
                      <li>Periksa kelengkapan soal dan tanyakan kepada guru apabila terdapat cetakan yang kurang jelas.</li>
                      <li>Kerjakan soal-soal secara mandiri, jujur, dan penuh rasa sportivitas tinggi.</li>
                      <li>Periksa kembali pekerjaan Anda sebelum dikumpulkan kepada guru pengampu.</li>
                    </ol>
                  </div>

                  {/* Question list */}
                  <div className="space-y-6 pt-2">
                    {result.questions.map((q, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 font-mono">
                            {idx + 1}
                          </span>
                          <div className="space-y-2 flex-1">
                            <p className="font-semibold text-xs sm:text-sm text-slate-850 pt-0.5 leading-relaxed">
                              {q.question}
                            </p>

                            {/* Opsi Pilihan Ganda */}
                            {q.options && q.options.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                {q.options.map((opt, optIdx) => (
                                  <div 
                                    key={optIdx} 
                                    className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Underline area for essays */
                              <div className="pt-2 pb-6 space-y-3">
                                <div className="border-b border-dashed border-slate-300 w-full h-4"></div>
                                <div className="border-b border-dashed border-slate-300 w-full h-4"></div>
                                <div className="border-b border-dashed border-slate-300 w-full h-4"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Signature Section */}
                  <div className="grid grid-cols-2 text-center text-xs pt-12 border-t border-slate-100">
                    <div>
                      <p className="text-slate-500">Mengetahui,</p>
                      <p className="font-extrabold text-slate-850 mt-0.5">Kepala Sekolah</p>
                      <div className="h-16"></div>
                      <p className="font-extrabold text-slate-800 underline">________________________</p>
                      <p className="text-[10px] text-slate-400">NIP. ____________________</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Bandung, _________________</p>
                      <p className="font-extrabold text-slate-850 mt-0.5">Guru Pengampu Mapel</p>
                      <div className="h-16"></div>
                      <p className="font-extrabold text-slate-800 underline">________________________</p>
                      <p className="text-[10px] text-slate-400">NIP. ____________________</p>
                    </div>
                  </div>

                </div>
              )}

              {/* RENDER TAB 2: KUNCI JAWABAN & RUBRIK GURU */}
              {resultTab === 'kunci' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">Kunci Jawaban &amp; Pedoman Penskoran Resmi</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Materi: {babMateri} &bull; Kelas {grade} SD</p>
                  </div>

                  <div className="space-y-6 divide-y divide-slate-100">
                    {result.questions.map((q, idx) => (
                      <div key={idx} className={`pt-6 ${idx === 0 ? 'pt-0' : ''} space-y-3`}>
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 font-mono">
                            {idx + 1}
                          </span>
                          <div className="space-y-2 flex-1">
                            <p className="font-bold text-xs sm:text-sm text-slate-800">
                              {q.question}
                            </p>
                            <div className="bg-teal-50/50 border border-teal-100 p-3.5 rounded-xl space-y-2">
                              <p className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                Kunci Jawaban: <span className="bg-teal-100 px-2.5 py-0.5 rounded text-teal-950">{q.correctAnswer}</span>
                              </p>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                <strong>Penjelasan Analitis:</strong> {q.explanation}
                              </p>
                            </div>
                            <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl">
                              <p className="text-xs font-bold text-amber-900">
                                📋 Pedoman &amp; Kriteria Penskoran:
                              </p>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {q.pedomanPenskoran}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RENDER TAB 3: KARTU SOAL SUMATIF */}
              {resultTab === 'kartu' && (
                <div className="space-y-6">
                  {/* Card selector deck */}
                  <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 no-print flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveCardIdx(prev => Math.max(0, prev - 1))}
                        disabled={activeCardIdx === 0}
                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-xs font-extrabold text-slate-700">
                        Kartu Soal {activeCardIdx + 1} dari {result.questions.length}
                      </span>
                      <button
                        onClick={() => setActiveCardIdx(prev => Math.min(result.questions.length - 1, prev + 1))}
                        disabled={activeCardIdx === result.questions.length - 1}
                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      {result.questions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveCardIdx(i)}
                          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${activeCardIdx === i ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* The Kartu Soal Paper Grid */}
                  {result.questions.map((q, qIndex) => (
                    <div 
                      key={qIndex} 
                      className={`bg-white rounded-xl border-2 border-slate-300 p-6 shadow-md ${activeCardIdx === qIndex ? 'block' : 'hidden md:block md:opacity-40 hover:opacity-100 transition-opacity'}`}
                    >
                      <div className="text-center bg-slate-50 border border-slate-300 p-3 rounded-lg mb-4">
                        <h4 className="text-xs sm:text-sm font-black uppercase text-slate-800 leading-tight">
                          KARTU SOAL SUMATIF SD (KURIKULUM MERDEKA)
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {result.kop.namaSekolah} &bull; {result.kop.dinasPendidikan}
                        </p>
                      </div>

                      {/* Main grids */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-3">
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                              <tbody>
                                <tr className="border-b border-slate-100">
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600" width="40%">Mata Pelajaran</td>
                                  <td className="p-2 text-slate-800">{result.kop.mataPelajaran}</td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600">Kelas / Semester</td>
                                  <td className="p-2 text-slate-800">Kelas {result.kop.kelas} / {result.kop.semester}</td>
                                </tr>
                                <tr>
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600">Tahun Pelajaran</td>
                                  <td className="p-2 text-slate-800">{result.kop.tahunPelajaran}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                              <tbody>
                                <tr className="border-b border-slate-100">
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600" width="40%">Bentuk Soal</td>
                                  <td className="p-2 text-slate-800">{q.bentukSoal}</td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600">Nomor Soal</td>
                                  <td className="p-2 font-black text-amber-600 text-sm">{q.noSoal}</td>
                                </tr>
                                <tr>
                                  <td className="p-2 bg-slate-50 font-bold text-slate-600">Level Kognitif</td>
                                  <td className="p-2 text-slate-800 font-semibold">{q.levelKognitif}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* CP / Kompetensi & Indikator */}
                        <div className="space-y-3">
                          <div className="bg-amber-50/20 border border-amber-200/50 p-3 rounded-lg text-[11px] leading-relaxed">
                            <strong className="text-amber-800 text-[10px] uppercase tracking-wider block mb-1">Capaian Pembelajaran (CP):</strong>
                            <p className="text-slate-700">{q.capaianPembelajaran}</p>
                          </div>

                          <div className="bg-indigo-50/20 border border-indigo-200/50 p-3 rounded-lg text-[11px] leading-relaxed">
                            <strong className="text-indigo-800 text-[10px] uppercase tracking-wider block mb-1">Indikator Soal:</strong>
                            <p className="text-slate-700">{q.indikatorSoal}</p>
                          </div>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50/30">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">RUMUSAN BUTIR SOAL:</span>
                        <p className="font-extrabold text-xs sm:text-sm text-slate-800 leading-relaxed">
                          {q.question}
                        </p>
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="bg-white border border-slate-200 rounded-md p-2 text-xs text-slate-600">
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Grid: Kunci & Pedoman Penskoran */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                          <strong className="text-[10px] uppercase tracking-widest text-emerald-800 block mb-1">KUNCI JAWABAN GURU:</strong>
                          <span className="text-sm font-black text-emerald-950 bg-emerald-150 px-2.5 py-0.5 rounded border border-emerald-300">
                            {q.correctAnswer}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                            <strong>Analisis:</strong> {q.explanation}
                          </p>
                        </div>

                        <div className="bg-teal-50/30 border border-teal-200 p-4 rounded-lg">
                          <strong className="text-[10px] uppercase tracking-widest text-teal-800 block mb-1">PEDOMAN PENSKORAN:</strong>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                            {q.pedomanPenskoran}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400 flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <BrainCircuit className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-700">Belum Ada Soal Sumatif</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                Tentukan target asesmen sumatif (seperti STS atau SAS), pilih kelas, dan masukkan materi pokok di panel samping untuk memformulasikan soal ujian yang berimbang.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
