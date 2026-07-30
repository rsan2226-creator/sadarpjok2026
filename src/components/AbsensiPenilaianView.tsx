import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ClassData, Student } from '../types';
import { 
  Users, 
  Calendar, 
  Save, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Edit3, 
  Check, 
  ChevronRight,
  Sparkles,
  Award,
  TrendingUp,
  Brain,
  Activity,
  UserCheck,
  Plus,
  Trash2,
  Upload,
  FileSpreadsheet,
  FileUp,
  CheckCircle2,
  FileDown,
  ClipboardList,
  Printer,
  Copy
} from 'lucide-react';
import { exportAbsensiToDoc, exportPenilaianToDoc, downloadDocFile } from '../lib/exportUtils';

interface AbsensiPenilaianViewProps {
  classes: ClassData[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  onUpdateStudents: (classId: string, students: Student[]) => void;
  onAddClass?: (newClass: ClassData) => void;
  onDeleteClass?: (classId: string) => void;
}

export default function AbsensiPenilaianView({ 
  classes, 
  selectedClassId, 
  setSelectedClassId,
  onUpdateStudents,
  onAddClass,
  onDeleteClass
}: AbsensiPenilaianViewProps) {
  
  const [activeSubTab, setActiveSubTab] = useState<'absensi' | 'penilaian'>('absensi');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  // New Class form states
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<number>(1);
  const [classError, setClassError] = useState<string | null>(null);
  const [classSuccess, setClassSuccess] = useState<string | null>(null);
  const [isDeletingClassId, setIsDeletingClassId] = useState<string | null>(null);

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClassError(null);
    setClassSuccess(null);

    if (!newClassName.trim()) {
      setClassError('Nama kelas / rombel tidak boleh kosong.');
      return;
    }

    // Check if class with same name already exists
    const duplicate = classes.find(c => c.name.toLowerCase() === newClassName.trim().toLowerCase());
    if (duplicate) {
      setClassError(`Kelas dengan nama "${newClassName}" sudah ada.`);
      return;
    }

    const newClassId = 'class-' + Date.now();
    const newClassObj: ClassData = {
      id: newClassId,
      name: newClassName.trim(),
      grade: newClassGrade,
      students: []
    };

    if (onAddClass) {
      onAddClass(newClassObj);
      setClassSuccess(`Rombel "${newClassName.trim()}" berhasil ditambahkan!`);
      setNewClassName('');
      setTimeout(() => {
        setIsAddingClass(false);
        setClassSuccess(null);
      }, 1500);
    }
  };

  const handleConfirmDeleteClass = (classId: string) => {
    if (onDeleteClass) {
      onDeleteClass(classId);
    }
    setIsDeletingClassId(null);
  };

  // New Student form states
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'L' | 'P'>('L');
  const [newStudentNisn, setNewStudentNisn] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  
  // Bulk Excel import states
  const [importMode, setImportMode] = useState<'single' | 'excel'>('single');
  const [excelPasteText, setExcelPasteText] = useState('');
  const [importPreview, setImportPreview] = useState<{ name: string; gender: 'L' | 'P'; nisn?: string }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Score states for currently edited student
  const [editName, setEditName] = useState<string>('');
  const [editNisn, setEditNisn] = useState<string>('');
  const [editCognitive, setEditCognitive] = useState<number>(0);
  const [editPsychomotor, setEditPsychomotor] = useState<number>(0);
  const [editAffective, setEditAffective] = useState<number>(0);

  // Copy/Export status states
  const [isCopiedAbsensi, setIsCopiedAbsensi] = useState(false);
  const [isCopiedPenilaian, setIsCopiedPenilaian] = useState(false);

  const activeClass = classes.find(c => c.id === selectedClassId) || classes[0];

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseExcelFile(file);
  };

  const parseExcelFile = (file: File) => {
    setImportError(null);
    setImportSuccessMsg(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length <= 1) {
          throw new Error('File Excel kosong atau tidak memiliki baris data.');
        }

        // Find headers
        const headers = data[0].map(h => String(h || '').trim().toLowerCase());
        let nameColIdx = -1;
        let genderColIdx = -1;
        let nisnColIdx = -1;

        // Smart column finder
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          if (h.includes('nama') || h.includes('name') || h === 'siswa') {
            nameColIdx = i;
          }
          if (h.includes('kelamin') || h.includes('gender') || h === 'l/p' || h === 'lp' || h === 'jk' || h === 'sex' || h.includes('jenis')) {
            genderColIdx = i;
          }
          if (h.includes('nisn') || h.includes('induk') || h === 'no induk' || h.includes('identitas')) {
            nisnColIdx = i;
          }
        }

        // Default fallbacks if header not found
        if (nameColIdx === -1) nameColIdx = 0;
        if (genderColIdx === -1) genderColIdx = 1;

        const parsed: { name: string; gender: 'L' | 'P'; nisn?: string }[] = [];
        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;

          const nameVal = String(row[nameColIdx] || '').trim();
          if (!nameVal) continue;

          let genderVal = String(row[genderColIdx] || '').trim().toUpperCase();
          let gender: 'L' | 'P' = 'L';
          if (genderVal.startsWith('P') || genderVal.includes('PEREMPUAN') || genderVal.includes('FEMALE') || genderVal === 'W') {
            gender = 'P';
          }

          const nisnVal = nisnColIdx !== -1 && row[nisnColIdx] !== undefined && row[nisnColIdx] !== null 
            ? String(row[nisnColIdx]).trim() 
            : undefined;

          parsed.push({ name: nameVal, gender, nisn: nisnVal });
        }

        if (parsed.length === 0) {
          throw new Error('Tidak ada data siswa valid yang ditemukan di file Excel ini.');
        }

        setImportPreview(parsed);
      } catch (err: any) {
        setImportError(err.message || 'Gagal membaca file Excel. Pastikan formatnya benar.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePasteParse = () => {
    setImportError(null);
    setImportSuccessMsg(null);
    if (!excelPasteText.trim()) return;

    try {
      const rows = excelPasteText.split(/\r?\n/);
      const parsed: { name: string; gender: 'L' | 'P'; nisn?: string }[] = [];

      rows.forEach(rowStr => {
        if (!rowStr.trim()) return;
        // Split by tabs (from excel copy paste) or commas/semicolons
        const cols = rowStr.split(/\t|,|;/);
        
        const cleanCols = cols.map(c => c.trim()).filter(Boolean);
        if (cleanCols.length === 0) return;

        // Skip header lines
        const firstColLower = cleanCols[0].toLowerCase();
        if (firstColLower === 'nama' || firstColLower === 'nama siswa' || firstColLower === 'name' || firstColLower === 'no' || firstColLower === 'nisn') {
          return;
        }

        let name = '';
        let gender: 'L' | 'P' = 'L';
        let nisn: string | undefined = undefined;

        if (cleanCols.length === 1) {
          name = cleanCols[0];
        } else {
          // Identify columns smartly: Name, NISN, Gender
          let foundGender: 'L' | 'P' | null = null;
          let foundNisn = '';
          let foundName = '';

          cleanCols.forEach((col, cIdx) => {
            const colUpper = col.toUpperCase();
            if (!foundGender && (colUpper === 'L' || colUpper === 'P' || colUpper === 'LAKIK' || colUpper === 'LAKI-LAKI' || colUpper === 'PEREMPUAN' || colUpper === 'FEMALE' || colUpper === 'MALE')) {
              foundGender = colUpper.startsWith('P') || colUpper.includes('PEREMPUAN') || colUpper.includes('FEMALE') ? 'P' : 'L';
            } else if (!foundNisn && /^\d{5,15}$/.test(col)) {
              foundNisn = col;
            } else if (cIdx === 0 && (/^\d+$/.test(col) || /^\d+\.$/.test(col))) {
              // Counter column, skip
            } else if (!foundName) {
              foundName = col;
            } else {
              foundName += ' ' + col;
            }
          });

          name = foundName || cleanCols[0];
          gender = foundGender || 'L';
          nisn = foundNisn || undefined;
        }

        if (name) {
          parsed.push({ name, gender, nisn });
        }
      });

      if (parsed.length === 0) {
        throw new Error('Format copy-paste tidak dikenal atau tidak ada nama siswa.');
      }

      setImportPreview(parsed);
    } catch (err: any) {
      setImportError(err.message || 'Gagal memproses teks copy-paste.');
    }
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      { 'Nama Siswa': 'Andi Wijaya', 'NISN (Opsional)': '0123456789', 'Jenis Kelamin (L/P)': 'L' },
      { 'Nama Siswa': 'Siti Rahma', 'NISN (Opsional)': '0123456790', 'Jenis Kelamin (L/P)': 'P' },
      { 'Nama Siswa': 'Budi Santoso', 'NISN (Opsional)': '', 'Jenis Kelamin (L/P)': 'L' },
      { 'Nama Siswa': 'Dewi Lestari', 'NISN (Opsional)': '', 'Jenis Kelamin (L/P)': 'P' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Siswa');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Siswa_SADAR_PJOK_${activeClass?.name || 'SD'}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const executeBulkImport = () => {
    if (!activeClass || importPreview.length === 0) return;

    const newStudents: Student[] = importPreview.map((item, idx) => ({
      id: 'student-bulk-' + Date.now() + '-' + idx,
      name: item.name,
      nisn: item.nisn || undefined,
      gender: item.gender,
      attendance: {},
      scores: {
        cognitive: 80,
        psychomotor: 80,
        affective: 80
      }
    }));

    const updatedStudents = [...activeClass.students, ...newStudents];
    onUpdateStudents(activeClass.id, updatedStudents);

    setImportSuccessMsg(`Berhasil menambahkan ${newStudents.length} siswa baru ke ${activeClass.name}!`);
    setImportPreview([]);
    setExcelPasteText('');
  };

  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !activeClass) return;

    const newStudent: Student = {
      id: 'student-' + Date.now(),
      name: newStudentName.trim(),
      nisn: newStudentNisn.trim() || undefined,
      gender: newStudentGender,
      attendance: {},
      scores: {
        cognitive: 80,
        psychomotor: 80,
        affective: 80
      }
    };

    const updatedStudents = [...activeClass.students, newStudent];
    onUpdateStudents(activeClass.id, updatedStudents);
    setNewStudentName('');
    setNewStudentNisn('');
    setIsAddingStudent(false);
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!activeClass) return;
    const updatedStudents = activeClass.students.filter(s => s.id !== studentId);
    onUpdateStudents(activeClass.id, updatedStudents);
    setDeletingStudentId(null);
  };

  const handleAttendanceChange = (studentId: string, status: 'H' | 'S' | 'I' | 'A') => {
    if (!activeClass) return;
    const updatedStudents = activeClass.students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          attendance: {
            ...s.attendance,
            [attendanceDate]: status
          }
        };
      }
      return s;
    });

    onUpdateStudents(activeClass.id, updatedStudents);
  };

  const startEditingScores = (student: Student) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditNisn(student.nisn || '');
    setEditCognitive(student.scores.cognitive);
    setEditPsychomotor(student.scores.psychomotor);
    setEditAffective(student.scores.affective);
  };

  const saveScores = (studentId: string) => {
    if (!activeClass) return;
    const updatedStudents = activeClass.students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          name: editName.trim(),
          nisn: editNisn.trim() || undefined,
          scores: {
            cognitive: editCognitive,
            psychomotor: editPsychomotor,
            affective: editAffective
          }
        };
      }
      return s;
    });

    onUpdateStudents(activeClass.id, updatedStudents);
    setEditingStudentId(null);
  };

  // Helper to get descriptive status
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'H': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'S': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'I': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'A': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-200';
    }
  };

  // Calculations for Active Class stats
  const studentsCount = activeClass?.students?.length || 0;
  const boysCount = (activeClass?.students || []).filter(s => s.gender === 'L').length || 0;
  const girlsCount = (activeClass?.students || []).filter(s => s.gender === 'P').length || 0;

  // Present today calculations
  const presentCount = (activeClass?.students || []).filter(s => s.attendance?.[attendanceDate] === 'H').length || 0;
  const sickCount = (activeClass?.students || []).filter(s => s.attendance?.[attendanceDate] === 'S').length || 0;
  const permissionCount = (activeClass?.students || []).filter(s => s.attendance?.[attendanceDate] === 'I').length || 0;
  const absentCount = (activeClass?.students || []).filter(s => s.attendance?.[attendanceDate] === 'A').length || 0;

  return (
    <div className="space-y-6">
      {/* Top Selector Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administrasi Rombel</span>
            <div className="flex items-center flex-wrap gap-3">
              <h2 className="text-xl font-bold text-slate-800">
                {activeClass ? activeClass.name : 'Belum Ada Rombongan Belajar'}
              </h2>
              {activeClass && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  Fase {activeClass.grade <= 2 ? 'A' : activeClass.grade <= 4 ? 'B' : 'C'} (Kelas {activeClass.grade})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {activeClass ? `${studentsCount} Siswa terdaftar (${boysCount} Laki-laki, ${girlsCount} Perempuan)` : 'Silakan tambahkan rombel kelas baru terlebih dahulu.'}
            </p>
          </div>

          {/* Dropdown Selector & Class Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Pilih Kelas:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={classes.length === 0}
              className="border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 font-medium bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
            >
              {classes.length === 0 ? (
                <option value="">(Tidak ada kelas)</option>
              ) : (
                classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => {
                setIsAddingClass(!isAddingClass);
                setIsDeletingClassId(null);
              }}
              className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                isAddingClass 
                  ? 'bg-slate-100 border-slate-300 text-slate-700' 
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
              title="Tambah Rombel Baru"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Rombel</span>
            </button>

            {activeClass && classes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsDeletingClassId(activeClass.id);
                  setIsAddingClass(false);
                }}
                className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg transition-colors cursor-pointer"
                title="Hapus Rombel Ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Add Class Form */}
        {isAddingClass && (
          <form onSubmit={handleCreateClassSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800">Tambah Rombongan Belajar (Rombel) Baru</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Rombel / Kelas</label>
                <input
                  type="text"
                  placeholder="Contoh: Kelas 5-C"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tingkatan / Grade</label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value={1}>Kelas 1 (Fase A)</option>
                  <option value={2}>Kelas 2 (Fase A)</option>
                  <option value={3}>Kelas 3 (Fase B)</option>
                  <option value={4}>Kelas 4 (Fase B)</option>
                  <option value={5}>Kelas 5 (Fase C)</option>
                  <option value={6}>Kelas 6 (Fase C)</option>
                </select>
              </div>
            </div>

            {classError && (
              <p className="text-xs text-rose-600 font-semibold">{classError}</p>
            )}
            {classSuccess && (
              <p className="text-xs text-emerald-600 font-semibold">{classSuccess}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingClass(false);
                  setClassError(null);
                  setClassSuccess(null);
                }}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                Simpan Rombel
              </button>
            </div>
          </form>
        )}

        {/* Custom Confirmation for deleting class */}
        {isDeletingClassId && (
          <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold text-rose-800">Konfirmasi Hapus Kelas</h4>
            </div>
            <p className="text-xs text-rose-700">
              Apakah Anda yakin ingin menghapus kelas <strong>{classes.find(c => c.id === isDeletingClassId)?.name}</strong>? 
              Tindakan ini akan menghapus seluruh data siswa, rekam absensi, dan penilaian di dalam kelas ini dari database lokal dan Supabase.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeletingClassId(null)}
                className="px-3 py-1.5 border border-rose-200 bg-white hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteClass(isDeletingClassId)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Tambah Siswa Baru */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100/50 text-emerald-800 rounded-lg">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Kelola Siswa {activeClass?.name}</h3>
              <p className="text-[10px] text-slate-400">Pendaftaran siswa baru kelas 1 sampai kelas 6 (Mendukung Excel & Copy-Paste)</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAddingStudent(!isAddingStudent);
              setImportPreview([]);
              setImportError(null);
              setImportSuccessMsg(null);
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {isAddingStudent ? 'Batal' : 'Tambah Siswa'}
          </button>
        </div>

        {isAddingStudent && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            {/* Mode Selector Tabs */}
            <div className="flex gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setImportMode('single')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  importMode === 'single'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Siswa Tunggal (Satu per Satu)
              </button>
              <button
                type="button"
                onClick={() => setImportMode('excel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  importMode === 'excel'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Impor Massal Excel / Copy-Paste
              </button>
            </div>

            {/* Error and Success Notifications */}
            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Gagal memproses data: </span>
                  {importError}
                </div>
              </div>
            )}

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Berhasil! </span>
                  {importSuccessMsg}
                </div>
              </div>
            )}

            {/* Render Tab 1: Single Student */}
            {importMode === 'single' && (
              <form onSubmit={handleAddStudentSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nama Lengkap Siswa</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Contoh: Muhammad Ali"
                    required
                    className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">NISN (Opsional)</label>
                  <input
                    type="text"
                    value={newStudentNisn}
                    onChange={(e) => setNewStudentNisn(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 0123456789"
                    maxLength={10}
                    className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jenis Kelamin</label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as 'L' | 'P')}
                    className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Simpan ke {activeClass?.name || 'Kelas'}
                  </button>
                </div>
              </form>
            )}

            {/* Render Tab 2: Excel Bulk */}
            {importMode === 'excel' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-xs">Petunjuk Penggunaan Impor Massal</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
                      Unggah file spreadsheet (.xlsx, .xls, .csv) atau tempelkan baris data siswa yang disalin langsung dari Microsoft Excel / Google Sheets. Kolom minimal berisi <strong className="text-slate-700">Nama Siswa</strong> dan <strong className="text-slate-700">Jenis Kelamin (L/P)</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="shrink-0 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-600 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <FileDown className="w-4 h-4 text-emerald-600" /> Unduh Template Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File Upload Panel */}
                  <div className="border border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-5 text-center flex flex-col justify-center items-center gap-2 bg-slate-50/20 transition-all relative">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Pilih File Excel / CSV</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Dukung .xlsx, .xls, .csv</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>

                  {/* Copy-Paste Text Area */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tempel dari Excel / Google Sheets</label>
                    <textarea
                      value={excelPasteText}
                      onChange={(e) => setExcelPasteText(e.target.value)}
                      placeholder="Contoh salinan kolom Excel:&#10;Muhammad Ali	L&#10;Siti Rahma	P&#10;Budi Santoso	L"
                      rows={4}
                      className="w-full border border-slate-200 rounded-lg text-xs p-2.5 font-mono text-slate-700 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handlePasteParse}
                      disabled={!excelPasteText.trim()}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> Proses Teks Copy-Paste
                    </button>
                  </div>
                </div>

                {/* Live Preview Impor */}
                {importPreview.length > 0 && (
                  <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-xs space-y-3 p-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 
                        Pratinjau Impor: {importPreview.length} Siswa Terdeteksi
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImportPreview([])}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 rounded text-[11px] font-bold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={executeBulkImport}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Masukkan ke {activeClass?.name}
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto pr-1">
                      <table className="w-full text-xs text-slate-700 text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <th className="p-2 w-12 text-center">No</th>
                            <th className="p-2">Nama Siswa</th>
                            <th className="p-2 w-28">Jenis Kelamin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="p-2 font-medium text-slate-800">{item.name}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.gender === 'L' 
                                    ? 'text-indigo-700 bg-indigo-50' 
                                    : 'text-rose-700 bg-rose-50'
                                }`}>
                                  {item.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab bar for Absensi vs Penilaian */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveSubTab('absensi')}
          className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'absensi'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Rekap Absensi Taktis
        </button>
        <button
          onClick={() => setActiveSubTab('penilaian')}
          className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'penilaian'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Award className="w-4 h-4" /> Portofolio Penilaian PJOK
        </button>
      </div>

      {/* SUB-TAB: ABSENSI */}
      {activeSubTab === 'absensi' && (
        <div className="space-y-6">
          {/* Export & Cetak Bar (no-print) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 no-print">
            <div className="text-xs">
              <p className="font-extrabold text-slate-800">Administrasi Presensi Kelas</p>
              <p className="text-[10px] text-slate-500 font-medium">Cetak laporan harian atau salin kode Tailwind CSS rapi.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!activeClass) return;
                  const docContent = exportAbsensiToDoc(activeClass, attendanceDate);
                  downloadDocFile(`Presensi_PJOK_${activeClass.name.replace(/\s+/g, '_')}_${attendanceDate}`, docContent);
                  setIsCopiedAbsensi(true);
                  setTimeout(() => setIsCopiedAbsensi(false), 2000);
                }}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {isCopiedAbsensi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                {isCopiedAbsensi ? 'Dokumen Diunduh!' : 'Ekspor Google Docs'}
              </button>
              <button
                onClick={() => window.print()}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" /> Cetak Absensi / PDF
              </button>
            </div>
          </div>

          {/* Attendance Date & Stats */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-slate-500 block">Atur Tanggal Presensi</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg text-xs pl-9 pr-3 py-2 text-slate-700"
                />
              </div>
            </div>

            {/* Quick stats for selected date */}
            <div className="md:col-span-8 grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <span className="text-[10px] text-emerald-800 font-bold block">Hadir</span>
                <span className="text-lg font-black text-emerald-700">{presentCount}</span>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-[10px] text-blue-800 font-bold block">Sakit</span>
                <span className="text-lg font-black text-blue-700">{sickCount}</span>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                <span className="text-[10px] text-amber-800 font-bold block">Izin</span>
                <span className="text-lg font-black text-amber-700">{permissionCount}</span>
              </div>
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg">
                <span className="text-[10px] text-rose-800 font-bold block">Alpha</span>
                <span className="text-lg font-black text-rose-700">{absentCount}</span>
              </div>
            </div>
          </div>

          {/* Student Grid / List for Attendance */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-xs font-bold text-slate-500">No.</th>
                    <th className="p-4 text-xs font-bold text-slate-500">Nama Siswa</th>
                    <th className="p-4 text-xs font-bold text-slate-500">L/P</th>
                    <th className="p-4 text-xs font-bold text-slate-500 text-center">Status Kehadiran Hari Ini</th>
                    <th className="p-4 text-xs font-bold text-slate-500 text-right font-mono">Rekap Semester</th>
                    <th className="p-4 text-xs font-bold text-slate-500 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {activeClass?.students.map((student, idx) => {
                    const currentStatus = student.attendance[attendanceDate] || '';
                    
                    // Count totals for student
                    let totalH = 0, totalS = 0, totalI = 0, totalA = 0;
                    Object.values(student.attendance).forEach(val => {
                      if (val === 'H') totalH++;
                      if (val === 'S') totalS++;
                      if (val === 'I') totalI++;
                      if (val === 'A') totalA++;
                    });

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-4 font-semibold text-slate-800">
                          <div>{student.name}</div>
                          {student.nisn ? (
                            <div className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">NISN: {student.nisn}</div>
                          ) : (
                            <div className="text-[10px] text-slate-300 font-mono font-normal mt-0.5 italic">NISN: -</div>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 font-mono font-bold">{student.gender}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* Hadir */}
                            <button
                              onClick={() => handleAttendanceChange(student.id, 'H')}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                                currentStatus === 'H' 
                                  ? 'bg-emerald-500 text-white border-emerald-500' 
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              H (Hadir)
                            </button>
                            {/* Sakit */}
                            <button
                              onClick={() => handleAttendanceChange(student.id, 'S')}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                                currentStatus === 'S' 
                                  ? 'bg-blue-500 text-white border-blue-500' 
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              S (Sakit)
                            </button>
                            {/* Izin */}
                            <button
                              onClick={() => handleAttendanceChange(student.id, 'I')}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                                currentStatus === 'I' 
                                  ? 'bg-amber-500 text-white border-amber-500' 
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              I (Izin)
                            </button>
                            {/* Alpha */}
                            <button
                              onClick={() => handleAttendanceChange(student.id, 'A')}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                                currentStatus === 'A' 
                                  ? 'bg-rose-500 text-white border-rose-500' 
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              A (Alpha)
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-right space-x-1 font-mono text-[11px]">
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">H:{totalH}</span>
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">S:{totalS}</span>
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">I:{totalI}</span>
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-bold">A:{totalA}</span>
                        </td>
                        <td className="p-4 text-right">
                          {deletingStudentId === student.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                onClick={() => setDeletingStudentId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingStudentId(student.id)}
                              className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: PENILAIAN */}
      {activeSubTab === 'penilaian' && (
        <div className="space-y-6">
          {/* Export & Cetak Bar (no-print) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 no-print">
            <div className="text-xs">
              <p className="font-extrabold text-slate-800">Portofolio Nilai Kinerja Siswa</p>
              <p className="text-[10px] text-slate-500 font-medium">Cetak seluruh daftar nilai kognitif, psikomotorik, & afektif atau salin kode Tailwind CSS.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!activeClass) return;
                  const docContent = exportPenilaianToDoc(activeClass);
                  downloadDocFile(`Daftar_Nilai_PJOK_${activeClass.name.replace(/\s+/g, '_')}`, docContent);
                  setIsCopiedPenilaian(true);
                  setTimeout(() => setIsCopiedPenilaian(false), 2000);
                }}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {isCopiedPenilaian ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                {isCopiedPenilaian ? 'Dokumen Diunduh!' : 'Ekspor Google Docs'}
              </button>
              <button
                onClick={() => window.print()}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" /> Cetak Portofolio / PDF
              </button>
            </div>
          </div>

          <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl flex items-start gap-3 text-teal-900 text-xs">
            <div className="p-1.5 bg-teal-500/10 text-teal-600 rounded mt-0.5">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-teal-950">Aspek Penilaian PJOK Kurikulum Merdeka</h4>
              <p className="mt-1 leading-relaxed">
                Penilaian wajib mencakup 3 aspek utama: <strong>Kognitif</strong> (Pengetahuan teori olahraga), <strong>Psikomotor</strong> (Keterampilan praktik gerak motorik di lapangan), dan <strong>Afektif</strong> (Sportivitas, gotong royong, dan tanggung jawab).
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-xs font-bold text-slate-500">No.</th>
                    <th className="p-4 text-xs font-bold text-slate-500">Nama Siswa</th>
                    <th className="p-4 text-xs font-bold text-slate-500">Kognitif (Teori)</th>
                    <th className="p-4 text-xs font-bold text-slate-500">Psikomotor (Gerak)</th>
                    <th className="p-4 text-xs font-bold text-slate-500">Afektif (Sikap)</th>
                    <th className="p-4 text-xs font-bold text-slate-500 text-center">Rata-rata</th>
                    <th className="p-4 text-xs font-bold text-slate-500 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {activeClass?.students.map((student, idx) => {
                    const isEditing = editingStudentId === student.id;
                    const averageScore = Math.round((student.scores.cognitive + student.scores.psychomotor + student.scores.affective) / 3);

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-4 font-semibold text-slate-800">
                          {isEditing ? (
                            <div className="space-y-2 max-w-[200px]">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 block uppercase">Nama Siswa</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 block uppercase">NISN</label>
                                <input
                                  type="text"
                                  value={editNisn}
                                  onChange={(e) => setEditNisn(e.target.value.replace(/\D/g, ''))}
                                  placeholder="Opsional"
                                  maxLength={10}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span>{student.name}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">({student.gender})</span>
                              </div>
                              {student.nisn ? (
                                <div className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">NISN: {student.nisn}</div>
                              ) : (
                                <div className="text-[10px] text-slate-300 font-mono font-normal mt-0.5 italic">NISN: -</div>
                              )}
                            </>
                          )}
                        </td>

                        {/* Cognitive Score */}
                        <td className="p-4 font-mono">
                          {isEditing ? (
                            <div className="space-y-0.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editCognitive}
                                onChange={(e) => setEditCognitive(parseInt(e.target.value) || 0)}
                                className="w-16 border border-slate-200 rounded px-1.5 py-1"
                              />
                              <span className="text-[10px] text-slate-400 block">0-100</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="font-bold text-slate-700">{student.scores.cognitive}</span>
                            </div>
                          )}
                        </td>

                        {/* Psychomotor Score */}
                        <td className="p-4 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editPsychomotor}
                              onChange={(e) => setEditPsychomotor(parseInt(e.target.value) || 0)}
                              className="w-16 border border-slate-200 rounded px-1.5 py-1"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="font-bold text-slate-700">{student.scores.psychomotor}</span>
                            </div>
                          )}
                        </td>

                        {/* Affective Score */}
                        <td className="p-4 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editAffective}
                              onChange={(e) => setEditAffective(parseInt(e.target.value) || 0)}
                              className="w-16 border border-slate-200 rounded px-1.5 py-1"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                              <span className="font-bold text-slate-700">{student.scores.affective}</span>
                            </div>
                          )}
                        </td>

                        {/* Average Score */}
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded font-bold font-mono ${
                            averageScore >= 80 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : averageScore >= 70 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {averageScore}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <button
                                onClick={() => saveScores(student.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Check className="w-3.5 h-3.5" /> Simpan
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditingScores(student)}
                                  className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit Nilai
                                </button>
                                {deletingStudentId === student.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleDeleteStudent(student.id)}
                                      className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                                    >
                                      Ya
                                    </button>
                                    <button
                                      onClick={() => setDeletingStudentId(null)}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeletingStudentId(student.id)}
                                    className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center"
                                    title="Hapus Siswa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
