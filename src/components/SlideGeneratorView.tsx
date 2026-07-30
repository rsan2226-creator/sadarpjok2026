import React, { useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Presentation,
  Sliders,
  Download,
  BookOpen,
  Layout,
  MessageSquare,
  Compass
} from 'lucide-react';
import { SlidePresentationData } from '../types';
import { downloadDocFile, copyAndOpenGoogleDocs, exportSlidesToDoc } from '../lib/exportUtils';

export default function SlideGeneratorView() {
  // Input states
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [kelas, setKelas] = useState('5');
  const [fase, setFase] = useState('C');
  const [topikMateri, setTopikMateri] = useState('Kombinasi Pola Gerak Dasar Lokomotor, Non-Lokomotor, dan Manipulatif');
  const [jumlahSlide, setJumlahSlide] = useState('8');
  const [gayaDesain, setGayaDesain] = useState('Sederhana & Minimalis (Slate & Off-White)');
  const [guruPenyusun, setGuruPenyusun] = useState('Ahmad Rafsanjani, S.Pd.');
  const [tanggalDokumen, setTanggalDokumen] = useState('');

  // Status states
  const [slidesResult, setSlidesResult] = useState<SlidePresentationData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Active slide index for previewing in mockup
  const [activePreviewIdx, setActivePreviewIdx] = useState<number>(0);

  // Auto-calculate Fase based on Kelas
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

  const handleGenerateSlides = async (e: React.FormEvent) => {
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
    if (!topikMateri.trim()) {
      setValidationError('Topik / Materi Pembelajaran wajib diisi.');
      return;
    }
    if (!jumlahSlide.trim()) {
      setValidationError('Jumlah slide wajib diisi.');
      return;
    }

    setIsGenerating(true);
    setSlidesResult(null);

    const docDate = tanggalDokumen.trim() || `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    try {
      const response = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mataPelajaran,
          kelas,
          fase,
          topikMateri,
          jumlahSlide,
          gayaDesain,
          guruPenyusun,
          tanggalDokumen: docDate
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal merancang slide dari AI.');
      }

      const data = await response.json();
      setSlidesResult(data);
      setActivePreviewIdx(0); // reset preview to first slide
    } catch (err: any) {
      setApiError(err.message || 'Gagal memproses pembuatan rancangan slide.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAndGoToDocs = async () => {
    if (!slidesResult) return;
    setCopySuccess(false);
    const docHtml = exportSlidesToDoc(slidesResult);
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!slidesResult) return;
    const docHtml = exportSlidesToDoc(slidesResult);
    downloadDocFile(`PPT_${topikMateri.replace(/\s+/g, '_')}_Kelas_${kelas}.doc`, docHtml);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="slide-presentation-generator">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
          <Presentation className="w-8 h-8 text-indigo-200" />
          Rancangan Slide Presentasi PPT Pembelajaran
        </h2>
        <p className="mt-2 text-indigo-100 max-w-3xl text-sm sm:text-base leading-relaxed">
          Rancang slide presentasi PowerPoint interaktif untuk KBM Anda menggunakan AI. Dapatkan pembagian topik per slide secara merata, lengkap dengan tata letak visual, konten poin-poin terstruktur, serta catatan guru (speaker notes) yang siap diekspor ke Google Dokumen / Word.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Help */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Formulir Slide PPT
            </h3>

            {validationError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleGenerateSlides} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                  placeholder="Contoh: PJOK, Matematika, IPAS"
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
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topik / Materi Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={topikMateri}
                  onChange={(e) => setTopikMateri(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                  placeholder="Contoh: Siklus Air atau Pencernaan Manusia"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Slide <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={jumlahSlide}
                    onChange={(e) => setJumlahSlide(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    required
                  >
                    <option value="5">5 Slide (Ringkas)</option>
                    <option value="8">8 Slide (Standar)</option>
                    <option value="10">10 Slide (Lengkap)</option>
                    <option value="12">12 Slide (Mendalam)</option>
                    <option value="15">15 Slide (Komprehensif)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gaya Desain Visual <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={gayaDesain}
                    onChange={(e) => setGayaDesain(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    required
                  >
                    <option value="Sederhana & Minimalis (Slate & Off-White)">Sederhana & Minimalis</option>
                    <option value="Profesional & Formal (Navy & Emas)">Profesional & Formal (Navy)</option>
                    <option value="Kreatif & Berwarna (Teal, Pink, & Kuning)">Kreatif & Berwarna</option>
                    <option value="Interaktif & Menyenangkan (Hijau Daun & Oranye)">Interaktif & Ceria</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Guru Penyusun (Opsional)
                </label>
                <input
                  type="text"
                  value={guruPenyusun}
                  onChange={(e) => setGuruPenyusun(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                  placeholder="Contoh: Nama Anda, S.Pd."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Dokumen (Opsional)
                </label>
                <input
                  type="text"
                  value={tanggalDokumen}
                  onChange={(e) => setTanggalDokumen(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                  placeholder="Bila kosong menggunakan tanggal hari ini"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl py-3 px-4 text-xs font-bold shadow-md hover:from-indigo-700 hover:to-purple-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyusun Rancangan Slide...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    Rancang Slide PPT AI
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Guidance */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              Alur Rancangan PPT Interaktif
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
              <li><strong>Slide 1:</strong> Judul & Subjudul menarik yang berpusat pada murid.</li>
              <li><strong>Slide 2:</strong> Apersepsi & Kompetensi Dasar / Tujuan Pembelajaran.</li>
              <li><strong>Slide Inti:</strong> Poin-poin penjelas dengan muatan pertanyaan interaktif pemancing nalar kritis siswa.</li>
              <li><strong>Slide Terakhir:</strong> Refleksi, kuis interaktif (Asesmen Formatif), serta pesan penutup pembelajaran.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Output Showcase & Preview */}
        <div className="lg:col-span-8 space-y-6">
          {apiError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-rose-600" />
              <div>
                <h5 className="font-bold">Gagal Merancang Slide</h5>
                <p className="text-xs text-rose-700 mt-1">{apiError}</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="bg-white rounded-xl shadow-md p-12 border border-slate-100 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <h4 className="text-lg font-bold text-slate-800 font-sans tracking-tight">Kecerdasan Buatan Sedang Berpikir...</h4>
              <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed font-mono">
                Gemini AI sedang menyusun materi ({topikMateri}) menjadi {jumlahSlide} bagian slide, mengonseptualisasikan kombinasi visual untuk tema "{gayaDesain}", dan mendikte speaker notes naratif yang interaktif untuk membantu Anda mengajar secara prima di kelas.
              </p>
            </div>
          )}

          {!slidesResult && !isGenerating && !apiError && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Presentation className="w-16 h-16 text-slate-300 mb-4" />
              <h4 className="text-lg font-bold text-slate-700">Rancangan PPT Belum Dibuat</h4>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                Silakan isi data topik mata pelajaran, jumlah slide, dan gaya desain di panel kiri, kemudian tekan tombol <strong>"Rancang Slide PPT AI"</strong> untuk memulai penyusunan cerdas.
              </p>
            </div>
          )}

          {slidesResult && !isGenerating && (
            <div className="space-y-6">
              {/* Document Actions */}
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    Rancangan Slide PPT Siap!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Silakan salin langsung ke Google Dokumen Anda (landscape) atau unduh file Microsoft Word (.doc).
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
                  <strong>Petunjuk Cepat Penggunaan:</strong> Klik tombol <strong>"Salin & Buka Google Dokumen"</strong> di atas. Kami akan mengkopi seluruh data slide Anda. Tab baru berisi Google Dokumen kosong akan otomatis terbuka. Tekan <strong>Ctrl+V</strong> (atau <strong>Cmd+V</strong>) di tab kosong tersebut untuk menempelkan outline slide yang rapi dan terstruktur horizontal!
                </div>
              </div>

              {/* Slide Mockup Visualizer (16:9 Aspect Ratio) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <Layout className="w-4 h-4 text-indigo-600" />
                    Pratinjau Visual Slide (16:9 Mockup)
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                    Slide {activePreviewIdx + 1} dari {slidesResult.slides.length}
                  </span>
                </div>

                {/* The 16:9 interactive mock card */}
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl border border-slate-700 shadow-xl overflow-hidden relative flex flex-col justify-between p-6 sm:p-10 text-white select-none">
                  {/* Decorative background grid elements */}
                  <div className="absolute inset-0 bg-[radial-gradient(#4338ca_1px,transparent_1px)] [background-size:16px_16px] opacity-15"></div>
                  
                  {/* Slide header banner */}
                  <div className="flex items-center justify-between relative z-10 border-b border-slate-700/60 pb-3">
                    <span className="text-[10px] sm:text-xs font-bold tracking-widest text-indigo-400 uppercase">
                      {slidesResult.identitas.mataPelajaran}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                      {slidesResult.slides[activePreviewIdx].layoutType}
                    </span>
                  </div>

                  {/* Slide Main Content */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-auto relative z-10 items-center">
                    <div className="md:col-span-8 space-y-3">
                      <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                        {slidesResult.slides[activePreviewIdx].title}
                      </h3>
                      <ul className="space-y-2 text-xs sm:text-sm md:text-base text-slate-200 pl-4 list-disc font-medium leading-relaxed">
                        {slidesResult.slides[activePreviewIdx].points.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Right Mock Asset suggestion */}
                    <div className="hidden md:block md:col-span-4 bg-slate-800/60 border border-indigo-500/20 rounded-xl p-4 text-[10px] sm:text-xs text-indigo-200/90 leading-relaxed h-full flex flex-col justify-center">
                      <p className="font-bold text-white mb-1.5 flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-indigo-400" />
                        Arah Visual:
                      </p>
                      <p className="text-slate-300 italic font-mono text-[10px]">
                        {slidesResult.slides[activePreviewIdx].visualRecommendation}
                      </p>
                    </div>
                  </div>

                  {/* Slide Footer */}
                  <div className="flex items-center justify-between relative z-10 border-t border-slate-700/40 pt-3">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                      Penyusun: {slidesResult.identitas.guruPenyusun || 'Guru Kelas'} | Kelas {slidesResult.identitas.kelas}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-indigo-400 font-extrabold tracking-widest">
                      SLIDE {slidesResult.slides[activePreviewIdx].slideNo}
                    </span>
                  </div>
                </div>

                {/* Slide pagination controls */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2">
                  <button
                    disabled={activePreviewIdx === 0}
                    onClick={() => setActivePreviewIdx(prev => prev - 1)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition cursor-pointer font-bold disabled:opacity-45"
                  >
                    Sebelumnya
                  </button>
                  
                  {/* Indicator chips */}
                  <div className="flex flex-wrap gap-1 justify-center max-w-[60%]">
                    {slidesResult.slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePreviewIdx(idx)}
                        className={`w-6 h-6 rounded-md text-[10px] font-bold transition flex items-center justify-center ${
                          idx === activePreviewIdx 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={activePreviewIdx === slidesResult.slides.length - 1}
                    onClick={() => setActivePreviewIdx(prev => prev + 1)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition cursor-pointer font-bold disabled:opacity-45"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>

              {/* Speaker Notes Viewer for selected slide */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm space-y-2">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Panduan Guru (Speaker Notes) - Slide {activePreviewIdx + 1}
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-medium bg-white/80 p-3 rounded-lg border border-emerald-100">
                  "{slidesResult.slides[activePreviewIdx].speakerNotes}"
                </p>
              </div>

              {/* Complete Deck Outline Details List */}
              <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
                <div className="bg-slate-850 text-white px-6 py-4">
                  <h3 className="text-md font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    Rincian Lengkap Struktur Slide Deck
                  </h3>
                </div>

                <div className="p-6 space-y-6 divide-y divide-slate-100">
                  {slidesResult.slides.map((slide, sIdx) => (
                    <div key={slide.slideNo} className={`pt-6 ${sIdx === 0 ? 'pt-0' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <h4 className="text-sm font-bold text-slate-800">
                          Slide {slide.slideNo}: {slide.title}
                        </h4>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 self-start">
                          {slide.layoutType}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teks Slide</p>
                          <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                            {slide.points.map((pt, pIdx) => (
                              <li key={pIdx}>{pt}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-1">Panduan Visual</p>
                            <p className="text-xs text-slate-500 italic bg-pink-50/50 p-2 rounded border border-pink-100/40">
                              {slide.visualRecommendation}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Catatan Pemateri</p>
                            <p className="text-xs text-slate-600 font-mono leading-relaxed bg-emerald-50/30 p-2 rounded border border-emerald-100/40">
                              {slide.speakerNotes}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
