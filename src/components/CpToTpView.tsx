import React, { useState } from 'react';
import { PREBUILT_CP_DATA } from '../data';
import { CpToTpResult, TpItem } from '../types';
import { 
  Target, 
  BookOpen, 
  Sparkles, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  Download, 
  Layers, 
  Cpu, 
  Award, 
  Info, 
  ArrowRight,
  ListOrdered,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { exportCpToTpToDoc, downloadDocFile } from '../lib/exportUtils';
import { fetchWithRetry } from '../lib/fetchUtils';

export default function CpToTpView() {
  const [selectedFaseId, setSelectedFaseId] = useState<string>('fase-a');
  const [activeElementId, setActiveElementId] = useState<string>('fase-a-terampil');
  const [targetKelas, setTargetKelas] = useState<string>('1');
  const [materiSpesifik, setMateriSpesifik] = useState<string>('');
  const [pendekatanFormat, setPendekatanFormat] = useState<string>('Standar Kurikulum Merdeka (Kompetensi + Lingkup Materi)');
  const [customCpText, setCustomCpText] = useState<string>('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<CpToTpResult | null>(null);

  // Edit TP modal / inline states
  const [editingTpIndex, setEditingTpIndex] = useState<number | null>(null);
  const [editingTp, setEditingTp] = useState<TpItem | null>(null);

  // Copy states
  const [copied, setCopied] = useState(false);

  const activeFase = PREBUILT_CP_DATA.find(f => f.id === selectedFaseId) || PREBUILT_CP_DATA[0];
  const activeElement = activeFase.elements.find(e => e.id === activeElementId) || activeFase.elements[0];

  // Auto-sync CP text when phase or element changes
  const handleFaseSelect = (faseId: string) => {
    setSelectedFaseId(faseId);
    const targetFase = PREBUILT_CP_DATA.find(f => f.id === faseId);
    if (targetFase && targetFase.elements.length > 0) {
      setActiveElementId(targetFase.elements[0].id);
      setCustomCpText(targetFase.elements[0].description);
    }
    // Sync default grade based on phase
    if (faseId === 'fase-a') setTargetKelas('1');
    else if (faseId === 'fase-b') setTargetKelas('3');
    else if (faseId === 'fase-c') setTargetKelas('5');

    setResultData(null);
    setGenerationError(null);
  };

  const handleElementSelect = (elementId: string) => {
    setActiveElementId(elementId);
    const targetEl = activeFase.elements.find(e => e.id === elementId);
    if (targetEl) {
      setCustomCpText(targetEl.description);
    }
    setResultData(null);
    setGenerationError(null);
  };

  // Formulate CP to TP using AI API
  const handleGenerateCpToTp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerationError(null);

    const cpContentToUse = customCpText.trim() || activeElement.description;

    try {
      const response = await fetchWithRetry('/api/generate-cp-to-tp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fase: `${activeFase.phaseName} (${activeFase.grades})`,
          kelas: `Kelas ${targetKelas}`,
          elemen: activeElement.name,
          cpText: cpContentToUse,
          materiSpesifik: materiSpesifik.trim(),
          pendekatanFormat
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data: CpToTpResult = await response.json();
      setResultData(data);
    } catch (err: any) {
      console.error('CP to TP Generation error:', err);
      setGenerationError(err.message || 'Gagal merumuskan TP. Pastikan koneksi server dan API Key aktif.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Editing a TP Item
  const startEditTp = (index: number) => {
    if (!resultData) return;
    setEditingTpIndex(index);
    setEditingTp({ ...resultData.daftarTp[index] });
  };

  const saveEditTp = () => {
    if (editingTpIndex === null || !editingTp || !resultData) return;
    const updatedTpList = [...resultData.daftarTp];
    updatedTpList[editingTpIndex] = editingTp;
    setResultData({
      ...resultData,
      daftarTp: updatedTpList
    });
    setEditingTpIndex(null);
    setEditingTp(null);
  };

  const deleteTp = (index: number) => {
    if (!resultData) return;
    if (confirm(`Apakah Anda yakin ingin menghapus ${resultData.daftarTp[index].kodeTp}?`)) {
      const updatedTpList = resultData.daftarTp.filter((_, i) => i !== index);
      setResultData({
        ...resultData,
        daftarTp: updatedTpList
      });
    }
  };

  const addEmptyTp = () => {
    if (!resultData) return;
    const nextNum = resultData.daftarTp.length + 1;
    const newTp: TpItem = {
      kodeTp: `TP 1.${nextNum}`,
      rumusanTp: 'Peserta didik mampu mempraktikkan variasi gerak dasar dengan koordinasi tubuh yang baik.',
      kompetensiKko: 'Mempraktikkan (P3)',
      lingkupMateri: 'Variasi Gerak Dasar Lokomotor',
      indikatorKetercapaian: ['Siswa dapat menjelaskan tahapan gerak', 'Siswa dapat melakukan gerakan secara mandiri'],
      profilPancasila: 'Mandiri, Gotong Royong',
      targetKelasSemester: `Kelas ${targetKelas} / Semester 1`,
      alokasiWaktu: '4 JP',
      rekomendasiAsesmen: 'Tes Praktik & Observasi'
    };

    setResultData({
      ...resultData,
      daftarTp: [...resultData.daftarTp, newTp]
    });
  };

  // Export handlers
  const handleDownloadDoc = () => {
    if (!resultData) return;
    const docHtml = exportCpToTpToDoc(resultData);
    downloadDocFile(`Formulasi_CP_ke_TP_${activeFase.phaseName}_${activeElement.name.replace(/\s+/g, '_')}`, docHtml);
  };

  const copyToClipboard = () => {
    if (!resultData) return;
    let text = `FORMULASI PENYUSUNAN CP KE TP (TUJUAN PEMBELAJARAN) - PJOK SD\n`;
    text += `=========================================================\n`;
    text += `Fase / Target: ${resultData.fase} / ${resultData.kelas}\n`;
    text += `Elemen: ${resultData.elemen}\n`;
    text += `CP Asli: "${resultData.cpAsli}"\n\n`;

    text += `1. HASIL DEKONSTRUKSI CP:\n`;
    text += `   - KKO Kompetensi: ${resultData.analisisDekonstruksi.kompetensiUtama.join(', ')}\n`;
    text += `   - Lingkup Materi: ${resultData.analisisDekonstruksi.lingkupMateriUtama.join(', ')}\n`;
    text += `   - Karakteristik Siswa: ${resultData.analisisDekonstruksi.variasiKarakteristikSiswa}\n\n`;

    text += `2. DAFTAR RUMUSAN TUJUAN PEMBELAJARAN (TP):\n`;
    resultData.daftarTp.forEach((tp) => {
      text += `\n[${tp.kodeTp}] ${tp.rumusanTp}\n`;
      text += `   • Kompetensi: ${tp.kompetensiKko} | Materi: ${tp.lingkupMateri}\n`;
      text += `   • Indikator: ${tp.indikatorKetercapaian.join('; ')}\n`;
      text += `   • Target: ${tp.targetKelasSemester} (${tp.alokasiWaktu}) | P3: ${tp.profilPancasila}\n`;
      text += `   • Asesmen: ${tp.rekomendasiAsesmen}\n`;
    });

    text += `\n3. STRATEGI PEMBELAJARAN:\n`;
    text += `   - Metode: ${resultData.rekomendasiPendekatan}\n`;
    text += `   - Catatan Guru: ${resultData.catatanPendidik}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-8 opacity-10 pointer-events-none">
          <Target className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-emerald-200 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Fitur Baru: Kurikulum Merdeka PJOK SD</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Formulasi & Analisis Penurunan CP ke TP
          </h2>
          <p className="text-slate-200 text-sm md:text-base leading-relaxed">
            Alat bantu kecerdasan buatan untuk membedah <span className="font-semibold text-emerald-200">Capaian Pembelajaran (CP)</span> menjadi <span className="font-semibold text-emerald-200">Tujuan Pembelajaran (TP)</span> terukur, sistematis, dan langsung siap dipetakan ke ATP & Modul Ajar.
          </p>
        </div>
      </div>

      {/* Main Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Setup Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Pilih Parameter Capaian Pembelajaran</h3>
                <p className="text-xs text-slate-500">Tentukan Fase, Elemen, dan Teks CP yang ingin dirumuskan</p>
              </div>
            </div>

            <form onSubmit={handleGenerateCpToTp} className="space-y-5">
              
              {/* Fase Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  1. Pilih Fase & Kelas SD
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PREBUILT_CP_DATA.map(f => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => handleFaseSelect(f.id)}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                        selectedFaseId === f.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm">{f.phaseName}</div>
                      <div className={`text-[10px] mt-0.5 font-normal ${selectedFaseId === f.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {f.grades}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Kelas Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Spesifik Kelas SD
                </label>
                <select
                  value={targetKelas}
                  onChange={(e) => setTargetKelas(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                >
                  {selectedFaseId === 'fase-a' && (
                    <>
                      <option value="1">Kelas 1 SD</option>
                      <option value="2">Kelas 2 SD</option>
                    </>
                  )}
                  {selectedFaseId === 'fase-b' && (
                    <>
                      <option value="3">Kelas 3 SD</option>
                      <option value="4">Kelas 4 SD</option>
                    </>
                  )}
                  {selectedFaseId === 'fase-c' && (
                    <>
                      <option value="5">Kelas 5 SD</option>
                      <option value="6">Kelas 6 SD</option>
                    </>
                  )}
                </select>
              </div>

              {/* Elemen Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  2. Pilih Elemen PJOK
                </label>
                <div className="space-y-2">
                  {activeFase.elements.map(el => (
                    <button
                      type="button"
                      key={el.id}
                      onClick={() => handleElementSelect(el.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        activeElementId === el.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span className="text-xs">{el.name}</span>
                      <ChevronRight className={`w-4 h-4 ${activeElementId === el.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Teks CP Active Field (Editable) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Teks Capaian Pembelajaran (CP)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const el = activeFase.elements.find(e => e.id === activeElementId);
                      if (el) setCustomCpText(el.description);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Riset CP Resmi
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={customCpText || activeElement.description}
                  onChange={(e) => setCustomCpText(e.target.value)}
                  placeholder="Isi atau sesuaikan kalimat Capaian Pembelajaran..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none resize-y"
                />
              </div>

              {/* Optional Specific Topic */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Materi / Topik Pembelajaran Spesifik (Opsional)
                </label>
                <input
                  type="text"
                  value={materiSpesifik}
                  onChange={(e) => setMateriSpesifik(e.target.value)}
                  placeholder="Contoh: Sepak Bola / Senam Lantai Roll Depan / Kasti"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Jika dikosongkan, AI akan merumuskan TP secara komprehensif mencakup seluruh cakupan elemen.
                </p>
              </div>

              {/* Formulation Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Format / Pendekatan Perumusan TP
                </label>
                <select
                  value={pendekatanFormat}
                  onChange={(e) => setPendekatanFormat(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                >
                  <option value="Standar Kurikulum Merdeka (Kompetensi + Lingkup Materi)">
                    Standar Kurikulum Merdeka (Kompetensi + Lingkup Materi)
                  </option>
                  <option value="Format ABCD (Audience, Behavior, Condition, Degree)">
                    Format ABCD (Audience, Behavior, Condition, Degree)
                  </option>
                  <option value="Pendekatan KKO Bloom Taxonomy & SOLO">
                    Pendekatan KKO Bloom & Taksonomi SOLO
                  </option>
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Membedah & Merumuskan TP (AI)...</span>
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 text-emerald-200" />
                    <span>Rumuskan CP Menjadi TP (AI)</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Guidelines Box */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>Prinsip Perumusan TP PJOK:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed pl-1">
              <li>TP memuat <strong>Kompetensi</strong> (kemampuan yang diperagakan) & <strong>Lingkup Materi</strong>.</li>
              <li>Satu CP dapat diturunkan menjadi 3 - 5 TP berurutan secara hirarkis.</li>
              <li>TP dapat langsung diekspor ke format Word atau dipetakan ke PROTA & PROSEM.</li>
            </ul>
          </div>
        </div>

        {/* Right Output Display Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {generationError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Info className="w-5 h-5 text-rose-600" />
                <span>Gagal Merumuskan TP</span>
              </div>
              <p className="text-xs leading-relaxed">{generationError}</p>
            </div>
          )}

          {!resultData && !isGenerating && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <Target className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-800 text-base">Belum Ada Hasil Formulasi TP</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih Fase, Elemen, dan klik tombol <span className="font-semibold text-emerald-600">"Rumuskan CP Menjadi TP (AI)"</span> di panel sebelah kiri untuk menghasilkan susunan Tujuan Pembelajaran yang lengkap.
                </p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
                <Sparkles className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Sedang Memproses Dekonstruksi CP & Formulasi TP...</h3>
                <p className="text-xs text-slate-500">Kecerdasan buatan sedang menganalisis Kata Kerja Operasional & Lingkup Materi PJOK.</p>
              </div>
            </div>
          )}

          {resultData && (
            <div className="space-y-6">
              
              {/* Action Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Hasil Formulasi CP ke TP</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
                  </button>

                  <button
                    onClick={handleDownloadDoc}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Word (.doc)</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    title="Cetak Laporan"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dekonstruksi CP Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 border-b border-slate-100 pb-3">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span>1. Analisis Dekonstruksi Capaian Pembelajaran (CP)</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-500 text-[10px] uppercase block tracking-wider">Teks CP Asli:</span>
                  <p className="italic font-medium text-slate-800 leading-relaxed">"{resultData.cpAsli}"</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  
                  {/* KKO / Kompetensi */}
                  <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3.5 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      🎯 Kompetensi Utama (KKO):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {resultData.analisisDekonstruksi.kompetensiUtama.map((komp, i) => (
                        <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300/60">
                          {komp}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Lingkup Materi */}
                  <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-3.5 space-y-2">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                      📚 Lingkup Materi Utama:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {resultData.analisisDekonstruksi.lingkupMateriUtama.map((mat, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-300/60">
                          {mat}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {resultData.analisisDekonstruksi.variasiKarakteristikSiswa && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="font-bold text-slate-700">Karakteristik Peserta Didik: </span>
                    <span>{resultData.analisisDekonstruksi.variasiKarakteristikSiswa}</span>
                  </div>
                )}
              </div>

              {/* Formulated TPs List / Table */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <ListOrdered className="w-4 h-4 text-emerald-600" />
                    <span>2. Rumusan Tujuan Pembelajaran (TP) Terstruktur ({resultData.daftarTp.length} TP)</span>
                  </div>

                  <button
                    onClick={addEmptyTp}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs flex items-center gap-1 border border-emerald-200 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah TP</span>
                  </button>
                </div>

                {/* List of TP Cards */}
                <div className="space-y-4">
                  {resultData.daftarTp.map((tp, index) => (
                    <div 
                      key={index} 
                      className="border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 md:p-5 transition-all bg-slate-50/40 hover:bg-white space-y-3"
                    >
                      {editingTpIndex === index && editingTp ? (
                        /* Edit TP Form */
                        <div className="space-y-3 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800">Edit {editingTp.kodeTp}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEditTp}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Save className="w-3 h-3" /> Simpan
                              </button>
                              <button
                                onClick={() => setEditingTpIndex(null)}
                                className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">Kode TP</label>
                              <input
                                type="text"
                                value={editingTp.kodeTp}
                                onChange={(e) => setEditingTp({ ...editingTp, kodeTp: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">Target & Waktu</label>
                              <input
                                type="text"
                                value={editingTp.targetKelasSemester}
                                onChange={(e) => setEditingTp({ ...editingTp, targetKelasSemester: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700">Rumusan Kalimat TP</label>
                            <textarea
                              rows={2}
                              value={editingTp.rumusanTp}
                              onChange={(e) => setEditingTp({ ...editingTp, rumusanTp: e.target.value })}
                              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">Kompetensi (KKO)</label>
                              <input
                                type="text"
                                value={editingTp.kompetensiKko}
                                onChange={(e) => setEditingTp({ ...editingTp, kompetensiKko: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">Lingkup Materi</label>
                              <input
                                type="text"
                                value={editingTp.lingkupMateri}
                                onChange={(e) => setEditingTp({ ...editingTp, lingkupMateri: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Read-only TP View Card */
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-extrabold tracking-tight">
                                {tp.kodeTp}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {tp.targetKelasSemester}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {tp.alokasiWaktu}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditTp(index)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                                title="Edit TP"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteTp(index)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Hapus TP"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* TP Statement */}
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm leading-snug">
                              {tp.rumusanTp}
                            </h4>
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Kompetensi & Materi:</span>
                              <span className="font-semibold text-slate-700">{tp.kompetensiKko}</span>
                              <span className="text-slate-400 mx-1">•</span>
                              <span className="text-slate-600">{tp.lingkupMateri}</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Profil Pancasila & Asesmen:</span>
                              <span className="font-semibold text-emerald-700">{tp.profilPancasila}</span>
                              <span className="text-slate-400 mx-1">•</span>
                              <span className="text-slate-600">{tp.rekomendasiAsesmen}</span>
                            </div>
                          </div>

                          {/* IKTP Indicators */}
                          {tp.indikatorKetercapaian && tp.indikatorKetercapaian.length > 0 && (
                            <div className="bg-slate-100/70 p-3 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Indikator Ketercapaian TP (IKTP):
                              </span>
                              <ul className="space-y-1 text-xs text-slate-700 pl-1">
                                {tp.indikatorKetercapaian.map((ind, iIdx) => (
                                  <li key={iIdx} className="flex items-start gap-2">
                                    <span className="text-emerald-600 font-bold text-xs">✓</span>
                                    <span>{ind}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Teaching Strategy Recommendation */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 border-b border-slate-100 pb-3">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>3. Rekomendasi Strategi & Catatan Guru</span>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
                    <span className="font-bold text-emerald-900 block mb-1">Pendekatan & Metode Pembelajaran:</span>
                    <p className="leading-relaxed">{resultData.rekomendasiPendekatan}</p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block mb-1">Catatan Pelaksanaan Guru:</span>
                    <p className="leading-relaxed text-slate-600">{resultData.catatanPendidik}</p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
