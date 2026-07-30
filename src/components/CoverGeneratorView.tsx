import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Sliders, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  Info,
  User,
  School,
  Clock,
  Layout,
  HelpCircle,
  Lightbulb,
  Award,
  Globe,
  MapPin,
  FileSignature
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { copyAndOpenGoogleDocs, downloadDocFile } from '../lib/exportUtils';

export interface CoverData {
  judulUtama: string;
  subJudulKreatif: string;
  taglineSekolah: string;
  kutipanMotivasi: string;
  sumberKutipan: string;
  detailDokumen: {
    jenisDokumen: string;
    mataPelajaran: string;
    kelasFase: string;
    semester: string;
    tahunAjaran: string;
  };
  informasiPenyusun: {
    namaPenyusun: string;
    nipKeterangan: string;
    jabatan: string;
  };
  instansi: {
    namaSekolah: string;
    dinasPendidikan: string;
    kotaKabupaten: string;
  };
  gayaVisual: {
    rekomendasiWarnaBg: string;
    borderStyle: string;
    patternDescription: string;
    hiasanSudut: string;
  };
}

export default function CoverGeneratorView() {
  const [documentType, setDocumentType] = useState('Modul Ajar Kurikulum Merdeka');
  const [judul, setJudul] = useState('Kombinasi Pola Gerak Dasar Lokomotor, Non-Lokomotor, dan Manipulatif');
  const [subJudul, setSubJudul] = useState('Aktivitas Pembelajaran Permainan Lapangan dan Rekreasi');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [kelas, setKelas] = useState('Kelas IV (Fase B)');
  const [semester, setSemester] = useState('Semester Ganjil');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [disusunOleh, setDisusunOleh] = useState('Guru PJOK Premium, S.Pd.');
  const [nip, setNip] = useState('NIP. 19931012 202421 1 004');
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Pintar Bersama');
  const [dinasPendidikan, setDinasPendidikan] = useState('Dinas Pendidikan Pemuda dan Olahraga');
  const [kotaKabupaten, setKotaKabupaten] = useState('Kota Bandung');
  const [coverStyle, setCoverStyle] = useState<'classic_formal' | 'modern_minimalist' | 'cute_kids' | 'creative_art'>('classic_formal');
  const [warnaTema, setWarnaTema] = useState<'emerald' | 'blue' | 'indigo' | 'slate' | 'amber' | 'rose'>('emerald');
  const [logoType, setLogoType] = useState<'tutwuri' | 'kemenag' | 'pancasila' | 'custom_emoji' | 'none'>('tutwuri');
  const [customEmoji, setCustomEmoji] = useState('⚽');

  const [isGenerating, setIsGenerating] = useState(false);
  const [coverResult, setCoverResult] = useState<CoverData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerateCover = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    if (!judul.trim()) {
      setValidationError('Judul Cover wajib diisi.');
      return;
    }
    if (!disusunOleh.trim()) {
      setValidationError('Nama Penyusun wajib diisi.');
      return;
    }
    if (!namaSekolah.trim()) {
      setValidationError('Nama Sekolah wajib diisi.');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          judul,
          subJudul,
          mataPelajaran,
          kelas,
          semester,
          tahunAjaran,
          disusunOleh,
          nip,
          namaSekolah,
          dinasPendidikan,
          kotaKabupaten,
          coverStyle,
          warnaTema,
          logoType,
          customEmoji
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat desain cover dari AI.');
      }

      const data = await response.json();
      setCoverResult(data);
    } catch (err: any) {
      setApiError(err.message || 'Gagal memproses pembuatan cover.');
    } finally {
      setIsGenerating(false);
    }
  };

  // HTML Export to Microsoft Word
  const generateCoverDocHtml = (data: CoverData): string => {
    const themeColorHex = 
      warnaTema === 'emerald' ? '#0d9488' :
      warnaTema === 'blue' ? '#2563eb' :
      warnaTema === 'indigo' ? '#4f46e5' :
      warnaTema === 'slate' ? '#475569' :
      warnaTema === 'amber' ? '#d97706' : '#db2777';

    const secondaryColorHex = 
      warnaTema === 'emerald' ? '#0f766e' :
      warnaTema === 'blue' ? '#1d4ed8' :
      warnaTema === 'indigo' ? '#4338ca' :
      warnaTema === 'slate' ? '#334155' :
      warnaTema === 'amber' ? '#b45309' : '#be185d';

    const bgLightHex = 
      warnaTema === 'emerald' ? '#f0fdfa' :
      warnaTema === 'blue' ? '#eff6ff' :
      warnaTema === 'indigo' ? '#e0e7ff' :
      warnaTema === 'slate' ? '#f8fafc' :
      warnaTema === 'amber' ? '#fef3c7' : '#fdf2f8';

    const coverBorder = 
      coverStyle === 'classic_formal' ? `border: 8px double ${themeColorHex};` :
      coverStyle === 'modern_minimalist' ? `border-left: 12px solid ${themeColorHex}; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;` :
      coverStyle === 'cute_kids' ? `border: 4px dashed ${themeColorHex}; border-radius: 20px;` :
      `border: 3px solid ${themeColorHex}; border-radius: 12px;`;

    const fontStyle = 
      coverStyle === 'classic_formal' ? "font-family: 'Georgia', 'Times New Roman', serif;" :
      coverStyle === 'modern_minimalist' ? "font-family: 'Helvetica Neue', 'Arial', sans-serif; letter-spacing: 0.5px;" :
      coverStyle === 'cute_kids' ? "font-family: 'Comic Sans MS', 'Arial', sans-serif;" :
      "font-family: 'Trebuchet MS', 'Arial', sans-serif;";

    const logoHtml = 
      logoType === 'none' ? '' :
      `<div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 40pt;">${logoType === 'tutwuri' ? '🎓' : logoType === 'kemenag' ? '🕌' : logoType === 'pancasila' ? '🦅' : customEmoji}</span>
      </div>`;

    return `
      <div style="width: 100%; max-width: 700px; min-height: 980px; padding: 40px; background-color: #ffffff; ${coverBorder} ${fontStyle} box-sizing: border-box; position: relative;">
        
        <!-- HEADER INSTANSI -->
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${themeColorHex}; padding-bottom: 15px;">
          <p style="font-size: 10.5pt; text-transform: uppercase; margin: 0; color: #475569; letter-spacing: 1px; font-weight: bold;">
            ${data.instansi.dinasPendidikan || 'DINAS PENDIDIKAN'}
          </p>
          <h2 style="font-size: 14pt; margin: 5px 0; color: ${secondaryColorHex}; text-transform: uppercase; font-weight: 800;">
            ${data.instansi.namaSekolah}
          </h2>
          <p style="font-size: 9.5pt; color: #64748b; margin: 0; font-weight: bold; font-style: italic;">
            📍 ${data.instansi.kotaKabupaten} • "${data.taglineSekolah}"
          </p>
        </div>

        <!-- LOGO -->
        ${logoHtml}

        <!-- JUDUL UTAMA -->
        <div style="text-align: ${coverStyle === 'modern_minimalist' ? 'left' : 'center'}; margin-top: 20px; margin-bottom: 20px;">
          <span style="font-size: 11pt; font-weight: bold; background-color: ${bgLightHex}; color: ${secondaryColorHex}; padding: 6px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; text-transform: uppercase; border: 1px solid ${themeColorHex}40;">
            📚 ${data.detailDokumen.jenisDokumen}
          </span>
          <h1 style="font-size: 20pt; color: ${secondaryColorHex}; font-weight: 900; margin: 10px 0; line-height: 1.3; text-transform: uppercase;">
            ${data.judulUtama}
          </h1>
          <p style="font-size: 11.5pt; font-style: italic; color: #475569; margin: 5px 0;">
            "${data.subJudulKreatif}"
          </p>
        </div>

        <!-- DETAIL SPESIFIKASI DOKUMEN -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 40px 0; background-color: ${bgLightHex}; border-radius: 8px; padding: 15px;">
          <tr>
            <td style="padding: 10px; font-size: 10pt; border: none; font-weight: bold; color: ${secondaryColorHex};" width="30%">Mata Pelajaran</td>
            <td style="padding: 10px; font-size: 10pt; border: none; color: #1e293b;" width="70%">: ${data.detailDokumen.mataPelajaran || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-size: 10pt; border: none; font-weight: bold; color: ${secondaryColorHex};">Kelas / Fase</td>
            <td style="padding: 10px; font-size: 10pt; border: none; color: #1e293b;">: ${data.detailDokumen.kelasFase || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-size: 10pt; border: none; font-weight: bold; color: ${secondaryColorHex};">Semester</td>
            <td style="padding: 10px; font-size: 10pt; border: none; color: #1e293b;">: ${data.detailDokumen.semester || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-size: 10pt; border: none; font-weight: bold; color: ${secondaryColorHex};">Tahun Ajaran</td>
            <td style="padding: 10px; font-size: 10pt; border: none; color: #1e293b;">: ${data.detailDokumen.tahunAjaran || '-'}</td>
          </tr>
        </table>

        <!-- MOTIVASI QUOTE BOX -->
        <div style="background-color: #fafaf9; border-left: 4px solid ${themeColorHex}; padding: 12px 18px; margin: 30px 0; border-radius: 4px; font-style: italic;">
          <p style="font-size: 9.5pt; color: #44403c; line-height: 1.5; margin: 0 0 5px 0;">
            "${data.kutipanMotivasi}"
          </p>
          <strong style="font-size: 8.5pt; color: ${themeColorHex}; block; text-align: right;">
            — ${data.sumberKutipan}
          </strong>
        </div>

        <!-- DETAIL PENYUSUN -->
        <div style="margin-top: 50px; text-align: ${coverStyle === 'modern_minimalist' ? 'left' : 'center'};">
          <p style="font-size: 9pt; text-transform: uppercase; color: #64748b; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">
            Disusun Oleh:
          </p>
          <h3 style="font-size: 12pt; color: ${secondaryColorHex}; font-weight: bold; margin: 0 0 4px 0;">
            ${data.informasiPenyusun.namaPenyusun}
          </h3>
          <p style="font-size: 10pt; color: #475569; margin: 0;">
            ${data.informasiPenyusun.nipKeterangan || '-'}
          </p>
          <p style="font-size: 9.5pt; font-style: italic; color: #64748b; margin-top: 3px;">
            ${data.informasiPenyusun.jabatan || 'Guru PJOK'}
          </p>
        </div>

        <!-- FOOTER TAHUN -->
        <div style="position: absolute; bottom: 30px; left: 0; right: 0; text-align: center;">
          <p style="font-size: 9pt; color: #94a3b8; font-weight: bold; margin: 0; text-transform: uppercase;">
            ${data.instansi.namaSekolah} • KOTA ${data.instansi.kotaKabupaten.toUpperCase()}
          </p>
          <p style="font-size: 8pt; color: #cbd5e1; margin-top: 4px;">
            &copy; SADAR PJOK PREMIUM • Cover Generator AI
          </p>
        </div>

      </div>
    `;
  };

  const handleCopyAndGoToDocs = async () => {
    if (!coverResult) return;
    setCopySuccess(false);
    const contentHtml = generateCoverDocHtml(coverResult);
    const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Cover_Dokumen</title></head>
<body>${contentHtml}</body></html>`;
    const success = await copyAndOpenGoogleDocs(docHtml);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleDownloadDoc = () => {
    if (!coverResult) return;
    const contentHtml = generateCoverDocHtml(coverResult);
    const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Cover_Dokumen</title></head>
<body>${contentHtml}</body></html>`;
    downloadDocFile(`Cover_${documentType.replace(/\s+/g, '_')}_${judul.substring(0,25).replace(/\s+/g, '_')}.doc`, docHtml);
  };

  const handleDownloadImage = async () => {
    if (!canvasRef.current) return;
    setIsCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imageUri = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUri;
      link.download = `Cover_${documentType.replace(/\s+/g, '_')}_Kelas_${kelas.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to capture cover canvas:', err);
      alert('Terjadi kesalahan saat mengunduh gambar cover.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Theme palettes and structural rules based on styles & color themes
  const getStyleThemeClasses = () => {
    const isClassic = coverStyle === 'classic_formal';
    const isModern = coverStyle === 'modern_minimalist';
    const isCute = coverStyle === 'cute_kids';
    const isCreative = coverStyle === 'creative_art';

    // Color definitions
    let bgGradient = '';
    let borderClass = '';
    let titleClass = '';
    let accentBadgeClass = '';
    let specsTableClass = '';
    let quoteClass = '';
    let primaryText = '';
    let secondaryText = '';

    switch (warnaTema) {
      case 'emerald':
        bgGradient = 'from-teal-50 to-emerald-50';
        borderClass = isClassic ? 'border-8 double border-emerald-700' : isModern ? 'border-l-8 border-emerald-600' : isCute ? 'border-4 dashed border-emerald-400 rounded-3xl' : 'border border-emerald-500/20';
        titleClass = 'text-emerald-800 font-extrabold';
        accentBadgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        specsTableClass = 'bg-emerald-50/50 border border-emerald-100 rounded-xl';
        quoteClass = 'bg-teal-50/40 border-l-4 border-teal-500 text-teal-900';
        primaryText = 'text-emerald-800';
        secondaryText = 'text-teal-950';
        break;
      case 'blue':
        bgGradient = 'from-sky-50 to-blue-50';
        borderClass = isClassic ? 'border-8 double border-blue-700' : isModern ? 'border-l-8 border-blue-600' : isCute ? 'border-4 dashed border-blue-400 rounded-3xl' : 'border border-blue-500/20';
        titleClass = 'text-blue-800 font-extrabold';
        accentBadgeClass = 'bg-blue-100 text-blue-800 border border-blue-200';
        specsTableClass = 'bg-blue-50/50 border border-blue-100 rounded-xl';
        quoteClass = 'bg-sky-50/40 border-l-4 border-sky-500 text-sky-900';
        primaryText = 'text-blue-800';
        secondaryText = 'text-blue-950';
        break;
      case 'indigo':
        bgGradient = 'from-indigo-50 to-violet-50';
        borderClass = isClassic ? 'border-8 double border-indigo-700' : isModern ? 'border-l-8 border-indigo-600' : isCute ? 'border-4 dashed border-indigo-400 rounded-3xl' : 'border border-indigo-500/20';
        titleClass = 'text-indigo-800 font-extrabold';
        accentBadgeClass = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        specsTableClass = 'bg-indigo-50/50 border border-indigo-100 rounded-xl';
        quoteClass = 'bg-indigo-50/40 border-l-4 border-indigo-500 text-indigo-900';
        primaryText = 'text-indigo-800';
        secondaryText = 'text-indigo-950';
        break;
      case 'slate':
        bgGradient = 'from-zinc-50 to-slate-100';
        borderClass = isClassic ? 'border-8 double border-slate-700' : isModern ? 'border-l-8 border-slate-600' : isCute ? 'border-4 dashed border-slate-400 rounded-3xl' : 'border border-slate-500/20';
        titleClass = 'text-slate-800 font-extrabold';
        accentBadgeClass = 'bg-slate-100 text-slate-800 border border-slate-200';
        specsTableClass = 'bg-slate-50 border border-slate-200 rounded-xl';
        quoteClass = 'bg-zinc-100 border-l-4 border-slate-600 text-slate-900';
        primaryText = 'text-slate-800';
        secondaryText = 'text-slate-950';
        break;
      case 'amber':
        bgGradient = 'from-amber-50 to-orange-50';
        borderClass = isClassic ? 'border-8 double border-amber-700' : isModern ? 'border-l-8 border-amber-600' : isCute ? 'border-4 dashed border-amber-400 rounded-3xl' : 'border border-amber-500/20';
        titleClass = 'text-amber-800 font-extrabold';
        accentBadgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
        specsTableClass = 'bg-amber-50/50 border border-amber-100 rounded-xl';
        quoteClass = 'bg-amber-50/40 border-l-4 border-amber-500 text-amber-950';
        primaryText = 'text-amber-800';
        secondaryText = 'text-amber-950';
        break;
      case 'rose':
        bgGradient = 'from-rose-50 to-pink-50';
        borderClass = isClassic ? 'border-8 double border-rose-700' : isModern ? 'border-l-8 border-rose-600' : isCute ? 'border-4 dashed border-rose-400 rounded-3xl' : 'border border-rose-500/20';
        titleClass = 'text-rose-800 font-extrabold';
        accentBadgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
        specsTableClass = 'bg-rose-50/50 border border-rose-100 rounded-xl';
        quoteClass = 'bg-rose-50/40 border-l-4 border-rose-500 text-rose-950';
        primaryText = 'text-rose-800';
        secondaryText = 'text-rose-950';
        break;
    }

    return {
      bgGradient,
      borderClass,
      titleClass,
      accentBadgeClass,
      specsTableClass,
      quoteClass,
      primaryText,
      secondaryText,
      fontFamily: isClassic ? 'font-serif' : isModern ? 'font-sans tracking-wide' : isCute ? 'font-sans font-medium' : 'font-sans'
    };
  };

  const theme = getStyleThemeClasses();

  // Render official educational emblem/logo
  const renderLogo = () => {
    switch (logoType) {
      case 'tutwuri':
        return (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-md relative border-4 border-amber-300">
              <span className="text-3xl text-white font-bold">🎓</span>
              {/* Abstract decorative element representing Tut Wuri Handayani */}
              <div className="absolute -bottom-1 bg-amber-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase text-blue-900 border border-white">
                TUT WURI
              </div>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">LOGO TUT WURI HANDAYANI</p>
          </div>
        );
      case 'kemenag':
        return (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center shadow-md relative border-4 border-emerald-200">
              <span className="text-3xl text-white font-bold">🕌</span>
              <div className="absolute -bottom-1 bg-emerald-700 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase text-white border border-white">
                KEMENAG
              </div>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">IKHLAS BERAMAL</p>
          </div>
        );
      case 'pancasila':
        return (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-md relative border-4 border-red-500">
              <span className="text-3xl text-white">🦅</span>
              <div className="absolute -bottom-1 bg-red-600 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase text-white border border-white">
                PANCASILA
              </div>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">BHINNEKA TUNGGAL IKA</p>
          </div>
        );
      case 'custom_emoji':
        return (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center shadow-sm border-2 border-slate-300">
              <span className="text-4xl">{customEmoji}</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">KUSTOM PREFERENSI</p>
          </div>
        );
      case 'none':
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="cover-page-ai-generator">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
          <Award className="w-8 h-8 text-blue-200" />
          Rancang Halaman Cover Dokumen AI
        </h2>
        <p className="mt-2 text-blue-100 max-w-3xl text-sm sm:text-base leading-relaxed">
          Rancang halaman sampul (Cover Page) yang rapi, elegan, dan profesional untuk Modul Ajar, RPP, LKPD, Jurnal, atau Laporan Kinerja Anda. Disesuaikan dengan ornamen visual, logo resmi, tagline inspiratif, serta quote motivasi otomatis menggunakan kekuatan Gemini AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form parameter */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Parameter Cover Dokumen
            </h3>

            <form onSubmit={handleGenerateCover} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Dokumen <span className="text-rose-500">*</span>
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                >
                  <option value="Modul Ajar Kurikulum Merdeka">Modul Ajar Kurikulum Merdeka</option>
                  <option value="Rencana Pelaksanaan Pembelajaran (RPP)">Rencana Pelaksanaan Pembelajaran (RPP)</option>
                  <option value="Lembar Kerja Peserta Didik (LKPD)">Lembar Kerja Peserta Didik (LKPD)</option>
                  <option value="Buku Kerja Guru Aktif">Buku Kerja Guru Aktif</option>
                  <option value="Jurnal Harian Pembelajaran">Jurnal Harian Pembelajaran</option>
                  <option value="Laporan Hasil Portofolio Siswa">Laporan Hasil Portofolio Siswa</option>
                  <option value="Program Tahunan & Semester (PROTA/PROSEM)">Program Tahunan & Semester (PROTA/PROSEM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Utama Cover <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-semibold"
                  placeholder="Masukkan judul utama dokumen..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjudul Keterangan
                </label>
                <input
                  type="text"
                  value={subJudul}
                  onChange={(e) => setSubJudul(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  placeholder="Keterangan materi pokok / kompetensi inti..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  placeholder="Misal: Pendidikan Jasmani, Olahraga, dan Kesehatan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas / Fase
                  </label>
                  <input
                    type="text"
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    placeholder="Kelas IV (Fase B)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  >
                    <option value="Semester Ganjil">Semester Ganjil</option>
                    <option value="Semester Genap">Semester Genap</option>
                    <option value="Tahun Pelajaran">Tahun Pelajaran Utuh</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    value={tahunAjaran}
                    onChange={(e) => setTahunAjaran(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    placeholder="2026/2027"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Warna Tema
                  </label>
                  <select
                    value={warnaTema}
                    onChange={(e) => setWarnaTema(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-bold"
                  >
                    <option value="emerald">Emerald Teal (Hijau Tradisional)</option>
                    <option value="blue">Ocean Blue (Biru Resmi)</option>
                    <option value="indigo">Indigo Violet (Elegansi Modern)</option>
                    <option value="slate">Slate Silver (Klasik Monokrom)</option>
                    <option value="amber">Amber Gold (Kreatif / Ceria)</option>
                    <option value="rose">Rose Crimson (Lembut / Atraktif)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logo / Lambang Sampul
                </label>
                <select
                  value={logoType}
                  onChange={(e) => setLogoType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                >
                  <option value="tutwuri">Logo Tut Wuri Handayani (Kurikulum Merdeka)</option>
                  <option value="kemenag">Logo Kementerian Agama (Madrasah/Pendidikan Agama)</option>
                  <option value="pancasila">Logo Garuda Pancasila (Kebangsaan/Pancasila)</option>
                  <option value="custom_emoji">Custom Emoji (Gunakan Simbol Kegemaran)</option>
                  <option value="none">Tanpa Logo (Hanya Teks)</option>
                </select>
              </div>

              {logoType === 'custom_emoji' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Isi Emoji Kustom <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value)}
                    maxLength={5}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-center text-lg"
                    placeholder="⚽"
                  />
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identitas Instansi & Penyusun</p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Disusun Oleh (Nama Lengkap & Gelar) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={disusunOleh}
                    onChange={(e) => setDisusunOleh(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    placeholder="Andi Wijaya, S.Pd."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP / No. Identitas Lain
                  </label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    placeholder="NIP. 19931012 202421 1 004"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Sekolah / Satuan Pendidikan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    placeholder="SD Negeri Pintar Bersama"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dinas Pendidikan
                    </label>
                    <input
                      type="text"
                      value={dinasPendidikan}
                      onChange={(e) => setDinasPendidikan(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                      placeholder="Dinas Pendidikan"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kota / Kabupaten
                    </label>
                    <input
                      type="text"
                      value={kotaKabupaten}
                      onChange={(e) => setKotaKabupaten(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                      placeholder="Bandung"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gaya & Ornamen Cover <span className="text-rose-500">*</span>
                </label>
                <select
                  value={coverStyle}
                  onChange={(e) => setCoverStyle(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  required
                >
                  <option value="classic_formal">Formal Tradisional (Bingkai Garis Ganda & Serif)</option>
                  <option value="modern_minimalist">Modern Minimalist (Bersih, Garis Ramping & Elegan)</option>
                  <option value="cute_kids">Cute Playful (Ceria, Berbingkai & Ramah Anak)</option>
                  <option value="creative_art">Artistik Kreatif (Abstrak, Daun & Lingkaran Berpola)</option>
                </select>
              </div>

              {validationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2.5 rounded-lg text-xs font-semibold">
                  ⚠️ {validationError}
                </div>
              )}

              {apiError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 rounded-lg text-xs leading-relaxed">
                  ⚠️ <strong>Gagal:</strong> {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Mendesain Cover AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Susun Cover dengan AI</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Interactive Cover Preview Canvas */}
        <div className="lg:col-span-8 space-y-6">
          {isGenerating ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Menyusun Sampul Dokumen...</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                Gemini AI sedang memformulasikan subjudul estetik, tagline dinamis, dan pepatah edukasi inspiratif untuk menghiasi sampul Anda sesuai dengan gaya desain <strong>{coverStyle === 'classic_formal' ? 'Formal Tradisional' : coverStyle === 'modern_minimalist' ? 'Modern Minimalist' : coverStyle === 'cute_kids' ? 'Cute Playful' : 'Artistik Kreatif'}</strong> yang Anda pilih!
              </p>
            </div>
          ) : coverResult ? (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="bg-white rounded-xl shadow-xs p-4 border border-slate-100 flex flex-wrap gap-2 justify-between items-center no-print">
                <span className="text-xs font-bold text-slate-500">Hasil Desain Cover:</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyAndGoToDocs}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Salin ke Docs / Clipboard</span>
                  </button>
                  <button
                    onClick={handleDownloadDoc}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Download Word</span>
                  </button>
                  <button
                    onClick={handleDownloadImage}
                    disabled={isCapturing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors border border-indigo-100 cursor-pointer"
                  >
                    {isCapturing ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Menyimpan PNG...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Unduh PNG</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Informational Guidelines */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 leading-relaxed flex gap-2.5 no-print">
                <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <strong>Panduan Cetak Sampul:</strong>
                  <p>Masing-masing gaya cover dirancang dengan presisi tata letak A4 portrait. Bila disalin ke Google Docs, gunakan margin <strong>"Normal" (2.54 cm)</strong> untuk mempertahankan keselarasan ornamen garis atau bingkai. Klik tombol <strong>"Unduh PNG"</strong> untuk menyimpannya sebagai file gambar beresolusi tinggi (2x scale) yang siap langsung diselipkan ke bagian depan dokumen Anda!</p>
                </div>
              </div>

              {/* Cover Live Canvas */}
              <div className="border border-slate-200 rounded-2xl shadow-xl bg-slate-150 overflow-x-auto p-4 flex justify-center">
                <div 
                  ref={canvasRef}
                  className={`w-[794px] h-[1123px] relative bg-white flex flex-col justify-between p-12 text-left shadow-lg overflow-hidden border-box ${theme.fontFamily}`}
                  style={{ boxSizing: 'border-box' }}
                >
                  
                  {/* Outer Frame Border */}
                  <div className={`absolute inset-4 pointer-events-none ${theme.borderClass}`}>
                    
                    {/* Classic corner hiasan (Formal corners) */}
                    {coverStyle === 'classic_formal' && (
                      <>
                        <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-slate-400"></div>
                        <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-slate-400"></div>
                        <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-slate-400"></div>
                        <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-slate-400"></div>
                      </>
                    )}

                    {/* Cute Kids visual corner elements */}
                    {coverStyle === 'cute_kids' && (
                      <>
                        <span className="absolute top-3 left-3 text-lg">☀️</span>
                        <span className="absolute top-3 right-3 text-lg">🎈</span>
                        <span className="absolute bottom-3 left-3 text-lg">🌸</span>
                        <span className="absolute bottom-3 right-3 text-lg">⭐</span>
                      </>
                    )}

                    {/* Creative Art corner botanical decals */}
                    {coverStyle === 'creative_art' && (
                      <>
                        <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-indigo-200/40 to-transparent rounded-full -translate-x-6 -translate-y-6"></div>
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-emerald-200/40 to-transparent rounded-full translate-x-8 translate-y-8"></div>
                      </>
                    )}
                  </div>

                  {/* Abstract shapes for Creative Art style */}
                  {coverStyle === 'creative_art' && (
                    <div className="absolute top-1/4 -right-12 w-64 h-64 rounded-full bg-gradient-to-tr from-violet-200/20 via-pink-100/10 to-transparent blur-3xl pointer-events-none"></div>
                  )}

                  {/* Top Header Instansi */}
                  <div className="w-full text-center border-b-2 border-slate-200 pb-4 relative z-10">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 leading-tight">
                      {coverResult.instansi.dinasPendidikan || 'DINAS PENDIDIKAN'}
                    </p>
                    <h3 className={`text-sm sm:text-base font-black uppercase mt-1 tracking-tight ${theme.primaryText}`}>
                      {coverResult.instansi.namaSekolah}
                    </h3>
                    <p className="text-[9.5px] font-bold text-slate-500 mt-0.5 italic flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {coverResult.instansi.kotaKabupaten} &bull; "{coverResult.taglineSekolah}"
                    </p>
                  </div>

                  {/* Logo block */}
                  <div className="my-2 relative z-10">
                    {renderLogo()}
                  </div>

                  {/* Document Title section */}
                  <div className={`my-4 relative z-10 ${coverStyle === 'modern_minimalist' ? 'text-left pl-6' : 'text-center'}`}>
                    <span className={`inline-block text-[10px] font-extrabold uppercase px-3.5 py-1.5 rounded-full ${theme.accentBadgeClass} mb-4 tracking-wider`}>
                      {coverResult.detailDokumen.jenisDokumen}
                    </span>
                    
                    <h1 className={`text-2xl sm:text-3xl font-black uppercase leading-tight tracking-tight mt-1 max-w-2xl mx-auto ${theme.primaryText}`}>
                      {coverResult.judulUtama}
                    </h1>
                    
                    <p className="text-xs sm:text-sm font-medium text-slate-500 italic mt-3 max-w-xl mx-auto leading-relaxed">
                      "{coverResult.subJudulKreatif}"
                    </p>
                  </div>

                  {/* Specs Table */}
                  <div className={`p-5 relative z-10 ${theme.specsTableClass} max-w-xl mx-auto w-full`}>
                    <table className="w-full text-xs font-semibold">
                      <tbody>
                        <tr className="border-b border-slate-200/50">
                          <td className={`py-2 pr-4 font-extrabold uppercase tracking-wide text-[10px] ${theme.primaryText}`} width="35%">Mata Pelajaran</td>
                          <td className="py-2 text-slate-700">: {coverResult.detailDokumen.mataPelajaran || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-200/50">
                          <td className={`py-2 pr-4 font-extrabold uppercase tracking-wide text-[10px] ${theme.primaryText}`}>Kelas &amp; Fase</td>
                          <td className="py-2 text-slate-700">: {coverResult.detailDokumen.kelasFase || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-200/50">
                          <td className={`py-2 pr-4 font-extrabold uppercase tracking-wide text-[10px] ${theme.primaryText}`}>Semester / Bab</td>
                          <td className="py-2 text-slate-700">: {coverResult.detailDokumen.semester || '-'}</td>
                        </tr>
                        <tr>
                          <td className={`py-2 pr-4 font-extrabold uppercase tracking-wide text-[10px] ${theme.primaryText}`}>Tahun Pelajaran</td>
                          <td className="py-2 text-slate-700">: {coverResult.detailDokumen.tahunAjaran || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Motivational Quote block */}
                  <div className={`p-4 rounded-xl text-xs max-w-lg mx-auto italic relative z-10 ${theme.quoteClass}`}>
                    <p className="leading-relaxed text-slate-700 font-medium">
                      "{coverResult.kutipanMotivasi}"
                    </p>
                    <span className={`block text-right text-[10px] font-extrabold uppercase tracking-wider mt-2 ${theme.primaryText}`}>
                      &mdash; {coverResult.sumberKutipan}
                    </span>
                  </div>

                  {/* Compiler details */}
                  <div className={`my-4 relative z-10 ${coverStyle === 'modern_minimalist' ? 'text-left pl-6' : 'text-center'}`}>
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Disusun Oleh:</p>
                    <h4 className={`text-base font-black ${theme.primaryText}`}>
                      {coverResult.informasiPenyusun.namaPenyusun}
                    </h4>
                    <p className="text-xs font-mono text-slate-600 font-medium mt-0.5">
                      {coverResult.informasiPenyusun.nipKeterangan || '-'}
                    </p>
                    <p className="text-xs text-slate-500 italic font-medium mt-1">
                      {coverResult.informasiPenyusun.jabatan || 'Guru Penyusun Kurikulum'}
                    </p>
                  </div>

                  {/* Year Footer */}
                  <div className="w-full text-center border-t border-slate-100 pt-3 relative z-10">
                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                      {coverResult.instansi.namaSekolah} &bull; TAHUN AJARAN {coverResult.detailDokumen.tahunAjaran || '2026/2027'}
                    </p>
                    <p className="text-[8px] text-slate-300 font-mono mt-1">&copy; 2026 SADAR PJOK PREMIUM &bull; COVER GENERATOR AI</p>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <FileSignature className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Menunggu Desain Cover</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                Silakan lengkapi parameters data di panel kiri, tentukan gaya visual yang Anda gemari, lalu klik tombol <strong>"Susun Cover dengan AI"</strong> untuk menampilkan pratinjau halaman sampul dokumen premium Anda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
