import React, { useState } from 'react';
import { PREBUILT_CP_DATA } from '../data';
import { CpFase, CpElement, AtpResult } from '../types';
import { 
  BookOpen, 
  Target, 
  ChevronRight, 
  Sparkles, 
  Printer, 
  Copy, 
  Check, 
  RotateCcw, 
  Info, 
  ListOrdered, 
  ClipboardCheck, 
  Activity, 
  ArrowRight,
  Sparkle
} from 'lucide-react';
import { exportAtpToDoc, downloadDocFile } from '../lib/exportUtils';
import { fetchWithRetry } from '../lib/fetchUtils';

export default function CapaianPembelajaranView() {
  const [selectedFaseId, setSelectedFaseId] = useState<string>('fase-a');
  const [activeElementId, setActiveElementId] = useState<string>('fase-a-terampil');
  
  // Generation state
  const [materiSpesifik, setMateriSpesifik] = useState('');
  const [saranaSpesifik, setSaranaSpesifik] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedAtp, setGeneratedAtp] = useState<AtpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const activeFase = PREBUILT_CP_DATA.find(f => f.id === selectedFaseId) || PREBUILT_CP_DATA[0];
  const activeElement = activeFase.elements.find(e => e.id === activeElementId) || activeFase.elements[0];

  // If fase changes, update active element automatically to avoid mismatch
  const handleFaseSelect = (faseId: string) => {
    setSelectedFaseId(faseId);
    const targetFase = PREBUILT_CP_DATA.find(f => f.id === faseId);
    if (targetFase && targetFase.elements.length > 0) {
      setActiveElementId(targetFase.elements[0].id);
    }
    // Clear previous generation
    setGeneratedAtp(null);
    setGenerationError(null);
  };

  const handleGenerateATP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedAtp(null);

    try {
      const response = await fetchWithRetry('/api/generate-atp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: `${activeFase.phaseName} (${activeFase.grades})`,
          element: activeElement.name,
          cpText: activeElement.description,
          materiSpesifik: materiSpesifik.trim(),
          saranaSpesifik: saranaSpesifik.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setGeneratedAtp(data);
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Gagal terhubung ke AI. Pastikan server aktif dan API Key terpasang.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedAtp) return;
    
    let text = `ALUR TUJUAN PEMBELAJARAN (ATP) & KRITERIA KETERCAPAIAN (KKTP)\n`;
    text += `=========================================================\n`;
    text += `Fase / Kelas: ${activeFase.phaseName} / ${activeFase.grades}\n`;
    text += `Elemen: ${activeElement.name}\n`;
    if (materiSpesifik) text += `Materi Spesifik: ${materiSpesifik}\n`;
    if (saranaSpesifik) text += `Kondisi Sarana: ${saranaSpesifik}\n\n`;
    
    text += `A. ALUR TUJUAN PEMBELAJARAN (ATP):\n`;
    generatedAtp.alurTujuanPembelajaran.forEach((step, i) => {
      text += `${i + 1}. ${step}\n`;
    });
    
    text += `\nB. KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP) & RUBRIK:\n`;
    generatedAtp.kriteriaKetercapaian.forEach((item, i) => {
      text += `${i + 1}. Kriteria: ${item.kriteria}\n`;
      text += `   - Baru Berkembang (BB): ${item.baruBerkembang}\n`;
      text += `   - Layak (L): ${item.layak}\n`;
      text += `   - Mahir (M): ${item.mahir}\n\n`;
    });
    
    text += `C. REKOMENDASI METODE PEMBELAJARAN:\n${generatedAtp.metodePembelajaran}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" /> Referensi Capaian Pembelajaran (CP)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standar Kompetensi & Alur Tujuan Pembelajaran (ATP) PJOK Kurikulum Merdeka Sekolah Dasar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Panel: CP Explorer (Bento Box) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          
          {/* Fase Select Buttons */}
          <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs flex gap-1">
            {PREBUILT_CP_DATA.map((fase) => (
              <button
                key={fase.id}
                onClick={() => handleFaseSelect(fase.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedFaseId === fase.id
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/10'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {fase.phaseName}
                <span className="block text-[9px] opacity-80 font-normal">{fase.grades}</span>
              </button>
            ))}
          </div>

          {/* CP Elements & Statements */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50">
              <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" /> Elemen CP {activeFase.phaseName}
              </h3>
            </div>
            
            <div className="divide-y divide-slate-50">
              {activeFase.elements.map((element) => {
                const isSelected = activeElementId === element.id;
                return (
                  <button
                    key={element.id}
                    onClick={() => {
                      setActiveElementId(element.id);
                      setGeneratedAtp(null);
                      setGenerationError(null);
                    }}
                    className={`w-full text-left p-4 transition-all hover:bg-slate-50 flex gap-3 cursor-pointer items-start ${
                      isSelected ? 'bg-emerald-50/50 border-l-4 border-emerald-600' : ''
                    }`}
                  >
                    <div className={`p-1 rounded-lg mt-0.5 ${
                      isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>
                          {element.name}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1 text-emerald-600' : 'text-slate-300'}`} />
                      </div>
                      <p className={`text-[10px] leading-relaxed line-clamp-3 ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
                        {element.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Information box */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-emerald-800 leading-relaxed">
              <span className="font-bold block mb-0.5">Mengenal Elemen PJOK</span>
              Kurikulum Merdeka membagi PJOK SD ke dalam 4 Elemen Utama. Ketuk pada elemen di atas untuk memuat teks Capaian Pembelajaran asli, lalu gunakan generator AI di sebelah kanan untuk menyusun ATP & KKTP Asesmen.
            </div>
          </div>

        </div>

        {/* Right Panel: AI ATP & KKTP Generator */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Main generator card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs">Formulasi ATP & Asesmen KKTP</h3>
                  <p className="text-[10px] text-slate-400">Turunkan CP menjadi tujuan pembelajaran berurutan & kriteria kelulusan</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-100 text-xs space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Konfigurasi Terpilih</span>
                <span className="text-emerald-600">{activeFase.phaseName} • {activeFase.grades}</span>
              </div>
              <p className="font-bold text-slate-700">{activeElement.name}</p>
              <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed border-t border-slate-150 pt-1.5">
                "{activeElement.description}"
              </p>
            </div>

            <form onSubmit={handleGenerateATP} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Materi Pokok Spesifik <span className="text-slate-400">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={materiSpesifik}
                    onChange={(e) => setMateriSpesifik(e.target.value)}
                    placeholder="Contoh: Kasti, Senam Lantai, Renang, dll."
                    className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Kondisi Sarpras / Batasan Sekolah <span className="text-slate-400">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={saranaSpesifik}
                    onChange={(e) => setSaranaSpesifik(e.target.value)}
                    placeholder="Contoh: Tanpa matras, halaman kecil, seadanya"
                    className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-slate-800 hover:bg-indigo-750 hover:from-indigo-600 hover:to-indigo-500 text-white font-extrabold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isGenerating ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Menyusun ATP Kurikulum Merdeka...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Formulasikan ATP & KKTP dengan AI
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Error Message */}
          {generationError && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2.5 items-start">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span className="font-bold">Gagal Merumuskan ATP: </span>
                {generationError}
              </div>
            </div>
          )}

          {/* Generated Result View */}
          {generatedAtp && (
            <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-md animate-fadeIn print:shadow-none">
              
              {/* Header result controls */}
              <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between no-print">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkle className="w-4 h-4 text-amber-500 fill-amber-500" /> Hasil Formulasi Kurikulum Merdeka
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!generatedAtp) return;
                      const docContent = exportAtpToDoc(
                        activeFase.phaseName,
                        activeFase.grades,
                        activeElement.name,
                        materiSpesifik,
                        saranaSpesifik,
                        generatedAtp
                      );
                      downloadDocFile(`ATP_KKTP_PJOK_${activeFase.phaseName.replace(/\s+/g, '_')}`, docContent);
                      setCopiedHtml(true);
                      setTimeout(() => setCopiedHtml(false), 2000);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedHtml ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Dokumen Diunduh!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-600" /> Ekspor Google Docs
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-slate-500" /> Berhasil Salin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" /> Salin Teks
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 text-slate-600 hover:text-indigo-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" /> Cetak RPP / PDF
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="p-6 space-y-6">
                
                {/* Print Title Header */}
                <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-6">
                  <h1 className="text-lg font-black text-slate-800">SADAR PJOK - FORMULASI ATP & KKTP ASESMEN</h1>
                  <p className="text-xs text-slate-500 mt-1">Sesuai Panduan Pembelajaran dan Asesmen Kurikulum Merdeka Kemendikbudristek</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Fase & Kelas</span>
                    <span className="font-bold text-slate-800">{activeFase.phaseName} ({activeFase.grades})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Elemen Pembelajaran</span>
                    <span className="font-bold text-slate-800">{activeElement.name}</span>
                  </div>
                  {materiSpesifik && (
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Fokus Materi Pokok</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded-md mt-0.5 inline-block">{materiSpesifik}</span>
                    </div>
                  )}
                  {saranaSpesifik && (
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Kondisi Penyesuaian Sarana</span>
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 inline-block">{saranaSpesifik}</span>
                    </div>
                  )}
                </div>

                {/* Section A: ATP Steps */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
                    <ListOrdered className="w-4 h-4 text-emerald-600" /> Alur Tujuan Pembelajaran (ATP) Berurutan
                  </h4>
                  <div className="space-y-3 pl-2">
                    {generatedAtp.alurTujuanPembelajaran.map((step, idx) => (
                      <div key={idx} className="flex gap-3 items-start text-xs text-slate-700">
                        <span className="w-5 h-5 shrink-0 bg-emerald-100 text-emerald-800 font-bold rounded-full flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <p className="pt-0.5 leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section B: KKTP Rubric Grid */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-l-4 border-indigo-500 pl-2">
                    <ClipboardCheck className="w-4 h-4 text-indigo-600" /> Kriteria Ketercapaian & Kategori Asesmen
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-250">
                    <table className="w-full text-xs text-slate-700 text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <th className="p-3 w-1/4">Kriteria Penilaian</th>
                          <th className="p-3 w-1/4 text-amber-800 bg-amber-50/35">Baru Berkembang (BB)</th>
                          <th className="p-3 w-1/4 text-indigo-800 bg-indigo-50/20">Layak (L)</th>
                          <th className="p-3 w-1/4 text-emerald-800 bg-emerald-50/20">Mahir / Sangat Baik (M)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {generatedAtp.kriteriaKetercapaian.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="p-3 font-bold text-slate-800 text-[11px]">{item.kriteria}</td>
                            <td className="p-3 text-[10px] leading-relaxed text-amber-700 bg-amber-50/10">{item.baruBerkembang}</td>
                            <td className="p-3 text-[10px] leading-relaxed text-indigo-700 bg-indigo-50/5">{item.layak}</td>
                            <td className="p-3 text-[10px] leading-relaxed text-emerald-700 bg-emerald-50/5">{item.mahir}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section C: Recommendation Method */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-2">
                  <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-600" /> Rekomendasi Pendekatan Mengajar PJOK
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed pl-5">
                    {generatedAtp.metodePembelajaran}
                  </p>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
