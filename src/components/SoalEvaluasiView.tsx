import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { exportSoalToDoc, downloadDocFile } from '../lib/exportUtils';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function SoalEvaluasiView() {
  const [grade, setGrade] = useState('4');
  const [materi, setMateri] = useState('');
  const [totalSoal, setTotalSoal] = useState('5');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [revealAnswerIdx, setRevealAnswerIdx] = useState<{ [key: number]: boolean }>({});
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerateQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materi.trim()) return;

    setIsGenerating(true);
    setApiError(null);
    setQuestions([]);
    setRevealAnswerIdx({});

    try {
      const response = await fetch('/api/generate-soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          materi,
          totalSoal
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Terjadi kesalahan saat memanggil bank soal AI.');
      }

      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err: any) {
      setApiError(err.message || 'Gagal membuat soal evaluasi kognitif PJOK.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleRevealAnswer = (idx: number) => {
    setRevealAnswerIdx(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const printQuestions = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Settings Form */}
      <div className="lg:col-span-4 space-y-4 no-print">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">SADAR AI Bank Soal</h3>
              <p className="text-[10px] text-slate-300 font-medium">Buat Soal Pengetahuan PJOK Otomatis</p>
            </div>
          </div>

          <form onSubmit={handleGenerateQuestions} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Jenjang Kelas SD</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>Kelas {n} SD</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Materi Pembelajaran PJOK</label>
              <input
                type="text"
                value={materi}
                onChange={(e) => setMateri(e.target.value)}
                placeholder="Contoh: Pola Hidup Sehat & Gizi Seimbang"
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-lg text-xs px-3 py-2 placeholder-slate-400 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Jumlah Pertanyaan</label>
              <select
                value={totalSoal}
                onChange={(e) => setTotalSoal(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-lg text-xs px-3 py-2 focus:outline-none"
              >
                <option value="3">3 Soal</option>
                <option value="5">5 Soal</option>
                <option value="10">10 Soal</option>
              </select>
            </div>

            {apiError && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/20 rounded-lg text-rose-300 text-[10px] flex gap-1.5 items-start">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Merumuskan Soal...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Rumuskan Soal PJOK
                </>
              )}
            </button>
          </form>
        </div>

        {/* Informative Guidance */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2 text-xs">
          <h4 className="font-bold text-slate-800 flex items-center gap-1">
            <HelpCircle className="w-4 h-4 text-emerald-600" /> Kognitif Konten SD
          </h4>
          <p className="text-slate-500 leading-relaxed">
            Sistem merumuskan soal yang disesuaikan dengan kurikulum nasional. Kelas bawah (1-2) berfokus pada pengenalan gerak & keselamatan dasar. Kelas atas (4-6) berfokus pada aturan permainan, gizi seimbang, dan teori kebugaran jasmani.
          </p>
        </div>
      </div>

      {/* Questions Viewer */}
      <div className="lg:col-span-8">
        {questions.length > 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 no-print">
              <div>
                <h2 className="text-base font-extrabold text-slate-800">Ujian / Evaluasi Kognitif PJOK</h2>
                <p className="text-xs text-slate-400">Kelas {grade} SD • Materi: {materi}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const docContent = exportSoalToDoc(grade, materi, questions);
                    downloadDocFile(`Lembar_Soal_PJOK_Kelas_${grade}_${materi.replace(/\s+/g, '_')}`, docContent);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                  {isCopied ? 'Dokumen Diunduh!' : 'Ekspor Google Docs'}
                </button>
                <button
                  onClick={printQuestions}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" /> Cetak / PDF
                </button>
              </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
              <h2 className="text-lg font-black uppercase text-slate-800">LEMBAR EVALUASI PENGETAHUAN SISWA (PJOK)</h2>
              <p className="text-xs font-semibold text-slate-600">Kelas {grade} SD • Materi: {materi}</p>
              <div className="grid grid-cols-2 text-left text-xs mt-4 pt-3 border-t border-slate-200">
                <p>Nama Siswa: ______________________</p>
                <p className="text-right">Tanggal: ___________________</p>
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={idx} className="border border-slate-100 rounded-xl p-5 space-y-4 bg-slate-50/20 shadow-xs relative">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="font-semibold text-sm text-slate-800 pt-0.5 leading-relaxed">{q.question}</p>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-9">
                    {q.options.map((opt, optIdx) => (
                      <div 
                        key={optIdx} 
                        className="bg-white border border-slate-100 rounded-lg p-3 text-xs text-slate-700 font-medium"
                      >
                        {opt}
                      </div>
                    ))}
                  </div>

                  {/* Answer reveal bar */}
                  <div className="pl-9 pt-2 border-t border-slate-100/60 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
                    <button
                      onClick={() => toggleRevealAnswer(idx)}
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 w-max cursor-pointer"
                    >
                      {revealAnswerIdx[idx] ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Sembunyikan Jawaban Guru
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Lihat Jawaban & Penjelasan
                        </>
                      )}
                    </button>

                    {revealAnswerIdx[idx] && (
                      <div className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-lg text-xs text-slate-700 flex-1 space-y-1">
                        <p className="font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kunci Jawaban: {q.correctAnswer}
                        </p>
                        <p className="text-[11px] leading-relaxed text-slate-600">
                          <strong>Pedagogi SD:</strong> {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-slate-100 shadow-sm text-center text-slate-400">
            Formulasikan soal-soal teori olahraga SD berkualitas tinggi dengan menentukan sasaran kelas dan materi di panel samping.
          </div>
        )}
      </div>
    </div>
  );
}
