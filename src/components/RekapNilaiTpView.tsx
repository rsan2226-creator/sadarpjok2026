import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  PlusCircle, 
  FileText, 
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { ClassData, Student } from '../types';
import { downloadDocFile } from '../lib/exportUtils';

interface RekapNilaiTpViewProps {
  classes: ClassData[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
}

// Preset TPs based on Grade to make the tool instantly useful
const GRADE_TP_PRESETS: { [grade: number]: { code: string; text: string }[] } = {
  1: [
    { code: 'TP 1.1', text: 'Mempraktikkan variasi pola gerak dasar lokomotor (jalan, lari, lompat).' },
    { code: 'TP 1.2', text: 'Mempraktikkan pola gerak dasar non-lokomotor (meliuk, menekuk, meregang).' },
    { code: 'TP 1.3', text: 'Menunjukkan perilaku sportivitas dan kerjasama dalam aktivitas permainan sederhana.' }
  ],
  2: [
    { code: 'TP 2.1', text: 'Mempraktikkan variasi gerak dasar lokomotor dan non-lokomotor dalam bentuk permainan.' },
    { code: 'TP 2.2', text: 'Mempraktikkan aktivitas senam lantai sederhana tanpa alat secara seimbang.' },
    { code: 'TP 2.3', text: 'Mengenal bagian-bagian tubuh dan cara menjaga kebersihannya.' }
  ],
  3: [
    { code: 'TP 3.1', text: 'Mempraktikkan kombinasi gerak dasar manipulatif (melempar, menangkap, menendang).' },
    { code: 'TP 3.2', text: 'Mempraktikkan gerak dasar langkah kaki dalam aktivitas gerak berirama.' },
    { code: 'TP 3.3', text: 'Mengidentifikasi makanan bergizi dan pengaruhnya bagi kesehatan tubuh.' }
  ],
  4: [
    { code: 'TP 4.1', text: 'Mempraktikkan variasi pola gerak dasar dalam permainan kasti (melempar, menangkap, memukul).' },
    { code: 'TP 4.2', text: 'Mempraktikkan kombinasi gerak dasar atletik lari dan lompat melalui permainan modifikasi.' },
    { code: 'TP 4.3', text: 'Mengidentifikasi jenis cedera ringan saat berolahraga dan cara penanganannya.' }
  ],
  5: [
    { code: 'TP 5.1', text: 'Mempraktikkan kombinasi gerak dasar passing bawah dan atas pada permainan bola voli.' },
    { code: 'TP 5.2', text: 'Mempraktikkan aktivitas senam lantai guling depan (roll depan) secara aman.' },
    { code: 'TP 5.3', text: 'Menerapkan konsep kebugaran jasmani untuk meningkatkan daya tahan jantung (cardio).' }
  ],
  6: [
    { code: 'TP 6.1', text: 'Mempraktikkan variasi dan kombinasi gerak dasar menembak (shooting) dalam bola basket.' },
    { code: 'TP 6.2', text: 'Mempraktikkan taktik penyerangan dan pertahanan sederhana dalam pencak silat.' },
    { code: 'TP 6.3', text: 'Mempraktikkan latihan kelincahan (shuttle run) untuk menjaga kebugaran tubuh.' }
  ]
};

export default function RekapNilaiTpView({ classes, selectedClassId, setSelectedClassId }: RekapNilaiTpViewProps) {
  const activeClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || classes[0] || { id: '', name: 'Tanpa Kelas', grade: 1, students: [] };
  }, [classes, selectedClassId]);

  // Subject and school year configs
  const [subject, setSubject] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const [semester, setSemester] = useState<1 | 2>(1);
  const [schoolYear, setSchoolYear] = useState('2026/2027');
  const [kktp, setKktp] = useState<number>(70); // Kriteria Ketercapaian Tujuan Pembelajaran

  // TPs State
  const [tps, setTps] = useState<{ id: string; code: string; text: string }[]>([]);
  const [newTpCode, setNewTpCode] = useState('');
  const [newTpText, setNewTpText] = useState('');
  const [isAddingTp, setIsAddingTp] = useState(false);

  // Scores state: { [studentId]: { [tpId]: score } }
  const [scores, setScores] = useState<{ [studentId: string]: { [tpId: string]: number } }>({});

  // Institutional Signatures
  const [teacherName, setTeacherName] = useState('Sandi Rafsanjani, S.Pd.');
  const [teacherNip, setTeacherNip] = useState('19940812 202321 1 002');
  const [principalName, setPrincipalName] = useState('H. Ahmad Dahlan, M.Pd.');
  const [principalNip, setPrincipalNip] = useState('19780102 200501 1 003');
  const [printCity, setPrintCity] = useState('Jakarta');

  // Load saved TPs and scores from localStorage on class change
  useEffect(() => {
    if (!activeClass.id) return;

    // Load TPs
    const savedTps = localStorage.getItem(`rekap_tp_list_${activeClass.id}`);
    if (savedTps) {
      setTps(JSON.parse(savedTps));
    } else {
      // Use defaults based on Grade
      const gradePresets = GRADE_TP_PRESETS[activeClass.grade] || GRADE_TP_PRESETS[1];
      const defaults = gradePresets.map((p, idx) => ({
        id: `tp-${activeClass.id}-${idx + 1}`,
        code: p.code,
        text: p.text
      }));
      setTps(defaults);
      localStorage.setItem(`rekap_tp_list_${activeClass.id}`, JSON.stringify(defaults));
    }

    // Load Scores
    const savedScores = localStorage.getItem(`rekap_tp_scores_${activeClass.id}`);
    if (savedScores) {
      setScores(JSON.parse(savedScores));
    } else {
      // Pre-fill with sensible random-ish or empty scores based on current student cognitive/psychomotor averages
      const initialScores: { [studentId: string]: { [tpId: string]: number } } = {};
      const gradePresets = GRADE_TP_PRESETS[activeClass.grade] || GRADE_TP_PRESETS[1];
      
      activeClass.students.forEach(student => {
        initialScores[student.id] = {};
        gradePresets.forEach((p, idx) => {
          const tpId = `tp-${activeClass.id}-${idx + 1}`;
          // Generate a score close to student's cognitive/psychomotor scores
          const baseScore = Math.round((student.scores.cognitive + student.scores.psychomotor) / 2) || 80;
          // Add a small deviation (-3 to +3)
          const randomDeviation = Math.floor(Math.random() * 7) - 3;
          initialScores[student.id][tpId] = Math.min(100, Math.max(0, baseScore + randomDeviation));
        });
      });
      
      setScores(initialScores);
      localStorage.setItem(`rekap_tp_scores_${activeClass.id}`, JSON.stringify(initialScores));
    }
  }, [activeClass.id, activeClass.grade, activeClass.students]);

  // Save changes to localStorage helper
  const saveTpsToStorage = (updatedTps: typeof tps) => {
    setTps(updatedTps);
    localStorage.setItem(`rekap_tp_list_${activeClass.id}`, JSON.stringify(updatedTps));
  };

  const saveScoresToStorage = (updatedScores: typeof scores) => {
    setScores(updatedScores);
    localStorage.setItem(`rekap_tp_scores_${activeClass.id}`, JSON.stringify(updatedScores));
  };

  // Add a new TP
  const handleAddTp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTpCode.trim() || !newTpText.trim()) return;

    const newTp = {
      id: `tp-${activeClass.id}-${Date.now()}`,
      code: newTpCode.trim(),
      text: newTpText.trim()
    };

    const updatedTps = [...tps, newTp];
    saveTpsToStorage(updatedTps);

    // Initialize scores for this new TP
    const updatedScores = { ...scores };
    activeClass.students.forEach(student => {
      if (!updatedScores[student.id]) {
        updatedScores[student.id] = {};
      }
      updatedScores[student.id][newTp.id] = 75; // Default score
    });
    saveScoresToStorage(updatedScores);

    setNewTpCode('');
    setNewTpText('');
    setIsAddingTp(false);
  };

  // Delete a TP
  const handleDeleteTp = (tpId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus TP ini? Semua nilai siswa untuk TP ini akan hilang.')) {
      const updatedTps = tps.filter(t => t.id !== tpId);
      saveTpsToStorage(updatedTps);

      // Clean scores
      const updatedScores = { ...scores };
      Object.keys(updatedScores).forEach(studentId => {
        delete updatedScores[studentId][tpId];
      });
      saveScoresToStorage(updatedScores);
    }
  };

  // Update specific student score
  const handleScoreChange = (studentId: string, tpId: string, val: string) => {
    let numericVal = parseInt(val, 10);
    if (isNaN(numericVal)) {
      numericVal = 0;
    }
    numericVal = Math.min(100, Math.max(0, numericVal));

    const updatedScores = {
      ...scores,
      [studentId]: {
        ...scores[studentId],
        [tpId]: numericVal
      }
    };
    saveScoresToStorage(updatedScores);
  };

  // Simulate sensible scores for the entire class (testing helper)
  const handleAutoFill = () => {
    if (window.confirm('Simulasikan pengisian nilai otomatis untuk kelas ini berdasarkan performa kognitif & psikomotorik siswa?')) {
      const updatedScores = { ...scores };
      activeClass.students.forEach(student => {
        updatedScores[student.id] = {};
        tps.forEach(tp => {
          const base = Math.round((student.scores.cognitive + student.scores.psychomotor) / 2) || 75;
          const randomDeviation = Math.floor(Math.random() * 11) - 5; // -5 to +5
          updatedScores[student.id][tp.id] = Math.min(100, Math.max(0, base + randomDeviation));
        });
      });
      saveScoresToStorage(updatedScores);
    }
  };

  // Clear all scores
  const handleClearScores = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset seluruh nilai pada tabel ini menjadi 0?')) {
      const updatedScores = { ...scores };
      activeClass.students.forEach(student => {
        updatedScores[student.id] = {};
        tps.forEach(tp => {
          updatedScores[student.id][tp.id] = 0;
        });
      });
      saveScoresToStorage(updatedScores);
    }
  };

  // Calculate stats for each student
  const studentStats = useMemo(() => {
    const stats: { 
      [studentId: string]: { 
        average: number; 
        isPassed: boolean; 
        passedCount: number; 
        failedCount: number; 
      } 
    } = {};

    activeClass.students.forEach(student => {
      const studentScores = scores[student.id] || {};
      let total = 0;
      let count = 0;
      let passedCount = 0;
      let failedCount = 0;

      tps.forEach(tp => {
        const score = studentScores[tp.id] ?? 0;
        total += score;
        count++;
        if (score >= kktp) {
          passedCount++;
        } else {
          failedCount++;
        }
      });

      const average = count > 0 ? Math.round(total / count) : 0;
      stats[student.id] = {
        average,
        isPassed: average >= kktp,
        passedCount,
        failedCount
      };
    });

    return stats;
  }, [activeClass.students, tps, scores, kktp]);

  // Overall class statistics summary
  const summaryStats = useMemo(() => {
    const studentList = activeClass.students;
    if (studentList.length === 0) {
      return { classAverage: 0, passedPercent: 0, totalPassed: 0, totalFailed: 0 };
    }

    let totalSum = 0;
    let passedCount = 0;

    studentList.forEach(student => {
      const avg = studentStats[student.id]?.average || 0;
      totalSum += avg;
      if (avg >= kktp) {
        passedCount++;
      }
    });

    const totalStudents = studentList.length;
    const classAverage = Math.round(totalSum / totalStudents);
    const passedPercent = Math.round((passedCount / totalStudents) * 100);

    return {
      classAverage,
      passedPercent,
      totalPassed: passedCount,
      totalFailed: totalStudents - passedCount
    };
  }, [activeClass.students, studentStats, kktp]);

  // Average score per TP column
  const tpClassAverages = useMemo(() => {
    const averages: { [tpId: string]: number } = {};
    tps.forEach(tp => {
      let sum = 0;
      let count = 0;
      activeClass.students.forEach(student => {
        const studentScores = scores[student.id] || {};
        const score = studentScores[tp.id];
        if (score !== undefined) {
          sum += score;
          count++;
        }
      });
      averages[tp.id] = count > 0 ? Math.round(sum / count) : 0;
    });
    return averages;
  }, [activeClass.students, tps, scores]);

  // CSV Export handler
  const handleExportCsv = () => {
    let csv = `REKAP NILAI HARIAN PER TUJUAN PEMBELAJARAN (TP)\n`;
    csv += `Mata Pelajaran: ${subject}\n`;
    csv += `Kelas: ${activeClass.name}\n`;
    csv += `Semester: ${semester}\n`;
    csv += `Tahun Pelajaran: ${schoolYear}\n`;
    csv += `KKTP Threshold: ${kktp}\n\n`;

    // Headers
    csv += `No,Nama Siswa,L/P,`;
    tps.forEach(tp => {
      csv += `"${tp.code} - ${tp.text.replace(/"/g, '""')}",`;
    });
    csv += `Rata-rata,Ketuntasan\n`;

    // Data rows
    activeClass.students.forEach((student, idx) => {
      csv += `${idx + 1},"${student.name}","${student.gender}",`;
      tps.forEach(tp => {
        const score = scores[student.id]?.[tp.id] ?? 0;
        csv += `${score},`;
      });
      const avg = studentStats[student.id]?.average || 0;
      const status = avg >= kktp ? 'Tuntas' : 'Perlu Remedial';
      csv += `${avg},"${status}"\n`;
    });

    // Class average footer
    csv += `,,Rata-rata Kelas,`;
    tps.forEach(tp => {
      csv += `${tpClassAverages[tp.id]},`;
    });
    csv += `${summaryStats.classAverage},\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Nilai_TP_${activeClass.name.replace(/\s+/g, '_')}_Sm${semester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Word Document Export handler
  const handleExportWord = () => {
    const fullHtml = `
      <div style="font-family: 'Times New Roman', Times, serif; padding: 20px; line-height: 1.5; color: #000;">
        <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; text-transform: uppercase; font-size: 14pt;">LAPORAN REKAPITULASI NILAI HARIAN PER TP</h2>
          <p style="margin: 5px 0 0 0; font-size: 11pt;">Mata Pelajaran: <strong>${subject}</strong> | Tahun Pelajaran: ${schoolYear}</p>
          <p style="margin: 2px 0 0 0; font-size: 10pt;">Kelas: ${activeClass.name} &bull; Semester: ${semester} &bull; KKTP: ${kktp}</p>
        </div>

        <h3 style="font-size: 12pt; text-transform: uppercase; margin-bottom: 8px;">A. Daftar Tujuan Pembelajaran (TP)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #000; padding: 6px; text-align: left; width: 15%;">Kode TP</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left;">Deskripsi Kompetensi / Tujuan Pembelajaran</th>
            </tr>
          </thead>
          <tbody>
            ${tps.map(tp => `
              <tr>
                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${tp.code}</td>
                <td style="border: 1px solid #000; padding: 6px;">${tp.text}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 style="font-size: 12pt; text-transform: uppercase; margin-bottom: 8px;">B. Matriks Laporan Nilai Siswa</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; text-align: center;">
          <thead>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <th style="border: 1px solid #000; padding: 6px; width: 5%;">No</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left; width: 25%;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px; width: 6%;">L/P</th>
              ${tps.map(tp => `<th style="border: 1px solid #000; padding: 6px;">${tp.code}</th>`).join('')}
              <th style="border: 1px solid #000; padding: 6px; width: 10%; background-color: #e2e8f0;">Rata-rata</th>
              <th style="border: 1px solid #000; padding: 6px; width: 12%;">Ketuntasan</th>
            </tr>
          </thead>
          <tbody>
            ${activeClass.students.map((student, idx) => {
              const avg = studentStats[student.id]?.average || 0;
              const ketuntasan = avg >= kktp ? 'Tuntas' : 'Remedial';
              return `
                <tr>
                  <td style="border: 1px solid #000; padding: 5px;">${idx + 1}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: left;"><strong>${student.name}</strong></td>
                  <td style="border: 1px solid #000; padding: 5px;">${student.gender}</td>
                  ${tps.map(tp => {
                    const score = scores[student.id]?.[tp.id] ?? 0;
                    return `<td style="border: 1px solid #000; padding: 5px;">${score}</td>`;
                  }).join('')}
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold; background-color: #f8fafc;">${avg}</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold; color: ${avg >= kktp ? '#16a34a' : '#dc2626'}">${ketuntasan}</td>
                </tr>
              `;
            }).join('')}
            <tr style="font-weight: bold; background-color: #f1f5f9;">
              <td colspan="3" style="border: 1px solid #000; padding: 6px; text-align: right;">RATA-RATA KELAS:</td>
              ${tps.map(tp => `<td style="border: 1px solid #000; padding: 6px;">${tpClassAverages[tp.id]}</td>`).join('')}
              <td style="border: 1px solid #000; padding: 6px; background-color: #e2e8f0;">${summaryStats.classAverage}</td>
              <td style="border: 1px solid #000; padding: 6px; color: #16a34a;">${summaryStats.passedPercent}% Tuntas</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; font-size: 11pt;">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="border: none; text-align: center;" width="40%">
                Mengetahui,<br/>
                Kepala Sekolah
                <br/><br/><br/><br/>
                <strong>${principalName}</strong><br/>
                NIP. ${principalNip}
              </td>
              <td style="border: none;" width="20%"></td>
              <td style="border: none; text-align: center;" width="40%">
                ${printCity}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
                Guru Mapel PJOK
                <br/><br/><br/><br/>
                <strong>${teacherName}</strong><br/>
                NIP. ${teacherNip}
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    downloadDocFile(`Rekap_Nilai_TP_Kelas_${activeClass.name.replace(/\s+/g, '_')}`, fullHtml);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="rekap-nilai-tp-view">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-cyan-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12 pointer-events-none">
          <Calculator className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-200 text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4 text-cyan-400" />
            Administrasi Kurikulum Merdeka
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            Rekap Nilai Per Tujuan Pembelajaran (TP)
          </h2>
          <p className="text-cyan-100 text-xs sm:text-sm max-w-4xl leading-relaxed">
            Kelola, hitung, dan petakan ketuntasan kriteria belajar (KKTP) siswa per Kompetensi Dasar/Tujuan Pembelajaran secara digital. Menghasilkan rata-rata akhir otomatis untuk pelaporan rapor yang rapi dan terstandarisasi.
          </p>
        </div>
      </div>

      {/* Class Statistics Dashboard Widget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 no-print">
        <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-teal-50 text-teal-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Jumlah Siswa</span>
            <p className="text-xl font-black text-slate-800 mt-0.5">{activeClass.students.length} Siswa</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-cyan-50 text-cyan-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Rata-rata Kelas</span>
            <p className="text-xl font-black text-slate-800 mt-0.5">{summaryStats.classAverage} / 100</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Tuntas Kriteria (≥ {kktp})</span>
            <p className="text-xl font-black text-emerald-700 mt-0.5">
              {summaryStats.totalPassed} <span className="text-xs text-slate-400 font-bold">({summaryStats.passedPercent}%)</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Perlu Remedial</span>
            <p className="text-xl font-black text-rose-700 mt-0.5">{summaryStats.totalFailed} Siswa</p>
          </div>
        </div>
      </div>

      {/* Main Form controls block (Hidden on Print) */}
      <div className="bg-white rounded-xl border border-slate-150 p-5 mb-8 space-y-4 shadow-sm no-print">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-700" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Konfigurasi Laporan &amp; Kelas</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoFill}
              className="px-3.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg text-xs font-bold transition-all border border-cyan-200 cursor-pointer flex items-center gap-1.5"
              title="Isi nilai simulasi untuk keperluan demo/cepat"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              <span>Simulasi Nilai</span>
            </button>
            <button
              onClick={handleClearScores}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Tabel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Pilih Rombel / Kelas</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white font-semibold"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Kelas {c.grade})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}
                className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value={1}>Ganjil (1)</option>
                <option value={2}>Genap (2)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Th Pelajaran</label>
              <input
                type="text"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <span>Batas Kriteria KKTP</span>
              <span className="text-[10px] text-slate-400 font-medium">(≥ Tuntas)</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={kktp}
              onChange={(e) => setKktp(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white font-extrabold text-teal-800"
            />
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side Column: Manage Objectives list (TPs) */}
        <div className="lg:col-span-4 space-y-6 no-print">
          <div className="bg-white rounded-xl border border-slate-150 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-600" />
                Daftar TP Kelas Ini
              </h4>
              <button
                onClick={() => setIsAddingTp(!isAddingTp)}
                className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-all"
                title="Tambah Tujuan Pembelajaran Baru"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Form to add a new TP */}
            {isAddingTp && (
              <form onSubmit={handleAddTp} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block font-bold text-slate-600 mb-0.5">Kode TP</label>
                    <input
                      type="text"
                      placeholder="TP 1.4"
                      value={newTpCode}
                      onChange={(e) => setNewTpCode(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-600 mb-0.5">Kompetensi Inti/TP</label>
                    <input
                      type="text"
                      placeholder="Mempraktikkan gerakan..."
                      value={newTpText}
                      onChange={(e) => setNewTpText(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTp(false)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-250 rounded cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            )}

            {/* TPs List */}
            <div className="space-y-2.5 text-xs">
              {tps.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-medium">
                  Belum ada Tujuan Pembelajaran yang ditambahkan.
                </div>
              ) : (
                tps.map(tp => (
                  <div 
                    key={tp.id} 
                    className="p-3 bg-slate-50/70 border border-slate-150 rounded-lg flex items-start justify-between gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <span className="inline-block px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-black uppercase">
                        {tp.code}
                      </span>
                      <p className="text-slate-700 font-medium leading-relaxed mt-1">
                        {tp.text}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTp(tp.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors shrink-0"
                      title="Hapus TP"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Teacher and Institutional Info block */}
          <div className="bg-white rounded-xl border border-slate-150 p-5 space-y-3.5 shadow-sm">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
              Pengesahan Laporan (Tanda Tangan)
            </h4>
            
            <div className="space-y-2.5 text-[11px]">
              <div>
                <label className="block font-bold text-slate-500 mb-0.5">Kota Cetak Laporan</label>
                <input
                  type="text"
                  value={printCity}
                  onChange={(e) => setPrintCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-0.5">Nama Guru Pengampu</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-0.5">NIP Guru</label>
                <input
                  type="text"
                  value={teacherNip}
                  onChange={(e) => setTeacherNip(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-0.5">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-0.5">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={principalNip}
                  onChange={(e) => setPrincipalNip(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Column: Main Grid Recaps Matrix */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Header Toolbar Actions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 no-print">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-600" />
              MATRIKS EVALUASI TP KELAS
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
              </button>

              <button
                onClick={handleExportWord}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Word</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-white rounded-lg text-xs font-bold border border-slate-750 cursor-pointer flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>

          {/* MAIN MATRIX RECAPS PRINT SHEET */}
          <div className="bg-white rounded-2xl border border-slate-250 shadow-md p-6 sm:p-8 space-y-6 relative print-sheet overflow-hidden">
            
            {/* Header Formality (KOP SURAT) */}
            <div className="text-center border-b-4 border-double border-slate-900 pb-4 mb-4 relative flex flex-col items-center">
              <span className="font-mono text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">DATA ADMINISTRASI ADMINISTRATOR GURU SD</span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                LAPORAN REKAPITULASI NILAI HARIAN PER TP
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                Mata Pelajaran: {subject} &bull; Semester {semester} &bull; Tahun Pelajaran {schoolYear}
              </p>
              <div className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 mt-3 pt-2 border-t border-slate-100/50">
                <span>Kelas: {activeClass.name}</span>
                <span>KKTP: {kktp}</span>
              </div>
            </div>

            {/* Interactive Grid Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-250 font-black uppercase text-[9px] tracking-wider text-center">
                    <th className="p-3 border-r border-slate-200 w-12">No</th>
                    <th className="p-3 border-r border-slate-200 text-left min-w-[160px]">Nama Siswa</th>
                    <th className="p-3 border-r border-slate-200 w-12">L/P</th>
                    
                    {/* TP Column Headers */}
                    {tps.map(tp => (
                      <th 
                        key={tp.id} 
                        className="p-3 border-r border-slate-200 w-20 text-center cursor-help group relative"
                        title={tp.text}
                      >
                        <span className="underline decoration-dotted decoration-teal-500 font-extrabold">{tp.code}</span>
                        {/* Tooltip on hover */}
                        <span className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg max-w-xs z-30 font-medium normal-case">
                          {tp.text}
                        </span>
                      </th>
                    ))}

                    <th className="p-3 border-r border-slate-200 w-24 bg-teal-50/50 text-teal-900 font-extrabold text-center">Rata-rata</th>
                    <th className="p-3 text-center w-28">Ketuntasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium text-center">
                  {activeClass.students.map((student, sIdx) => {
                    const stats = studentStats[student.id] || { average: 0, isPassed: false };
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50">
                        <td className="p-3 border-r border-slate-200 text-slate-400 font-mono font-bold">
                          {sIdx + 1}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-left font-extrabold text-slate-800">
                          {student.name}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 font-bold">
                          {student.gender}
                        </td>

                        {/* Interactive dynamic TP scores inputs */}
                        {tps.map(tp => {
                          const score = scores[student.id]?.[tp.id] ?? 0;
                          return (
                            <td key={tp.id} className="p-2 border-r border-slate-200 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={score}
                                onChange={(e) => handleScoreChange(student.id, tp.id, e.target.value)}
                                className="w-14 px-1 py-1 text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50/50 hover:bg-slate-100 rounded border border-transparent hover:border-slate-300 transition-all no-print"
                              />
                              <span className="hidden print:inline font-bold">{score}</span>
                            </td>
                          );
                        })}

                        {/* Student Average score */}
                        <td className="p-3 border-r border-slate-200 font-black text-slate-900 bg-teal-50/30 text-center text-sm">
                          {stats.average}
                        </td>

                        {/* Ketuntasan badge indicator */}
                        <td className="p-3">
                          {stats.average >= kktp ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              Tuntas
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                              Remedial
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Footer Class average indicators */}
                  <tr className="bg-slate-100/80 text-slate-800 font-extrabold text-[11px] border-t-2 border-slate-300">
                    <td colSpan={3} className="p-3 border-r border-slate-200 text-right uppercase tracking-wider">
                      Rata-rata Kelas
                    </td>
                    
                    {tps.map(tp => (
                      <td key={tp.id} className="p-3 border-r border-slate-200 text-teal-800 font-black">
                        {tpClassAverages[tp.id]}
                      </td>
                    ))}

                    <td className="p-3 border-r border-slate-200 bg-teal-100/50 text-teal-950 font-black text-center text-xs">
                      {summaryStats.classAverage}
                    </td>

                    <td className="p-3 text-emerald-700 font-black text-center">
                      {summaryStats.passedPercent}% Tuntas
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Standard Signature Blocks for official report (visible on print or export) */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-slate-800 font-medium border-t border-slate-100">
              <div className="space-y-12">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-extrabold">Kepala Sekolah</p>
                </div>
                <div>
                  <p className="font-extrabold underline">{principalName}</p>
                  <p className="text-slate-500">NIP. {principalNip}</p>
                </div>
              </div>

              <div className="space-y-12">
                <div>
                  <p>{printCity}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="font-extrabold">Guru Mapel PJOK</p>
                </div>
                <div>
                  <p className="font-extrabold underline">{teacherName}</p>
                  <p className="text-slate-500">NIP. {teacherNip}</p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
