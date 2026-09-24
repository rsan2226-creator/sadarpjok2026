export interface Student {
  id: string;
  name: string;
  nisn?: string;
  gender: 'L' | 'P'; // Laki-laki / Perempuan
  attendance: { [date: string]: 'H' | 'S' | 'I' | 'A' }; // Hadir, Sakit, Izin, Alpha
  scores: {
    cognitive: number; // Pengetahuan (0-100)
    psychomotor: number; // Keterampilan Gerak (0-100)
    affective: number; // Sikap/Sportivitas (0-100)
  };
}

export interface ClassData {
  id: string;
  name: string; // e.g., "Kelas 1-A", "Kelas 4-B", "Kelas 6-C"
  grade: number; // 1 to 6
  students: Student[];
}

export interface ModulAjar {
  id: string;
  title: string;
  grade: number;
  semester: 1 | 2;
  materiPokok: string;
  alokasiWaktu: string;
  tujuanPembelajaran: string[];
  kegiatanPembelajaran: {
    pendahuluan: string[];
    inti: string[];
    penutup: string[];
  };
  saranaPrasarana: string[];
  rubrikPenilaian: string;
  createdAt: string;
  isAiGenerated?: boolean;
}

export interface JurnalMengajar {
  id: string;
  date: string;
  classId: string;
  className: string;
  materi: string;
  catatanKejadian: string; // Kejadian penting, cedera, sportivitas luar biasa, dll.
  tindakLanjut: string;
}

export interface RubrikFisik {
  id: string;
  materi: string;
  kategori: string; // Bola Besar, Bola Kecil, Senam, Atletik, Air, dll.
  indikator: {
    nama: string;
    kriteriaBagus: string;
    kriteriaCukup: string;
    kriteriaKurang: string;
  }[];
}

export interface CpElement {
  id: string;
  name: string; // e.g. "Keterampilan Gerak", "Pengetahuan Gerak"
  description: string; // CP statement
}

export interface CpFase {
  id: string;
  phaseName: string; // Fase A, Fase B, Fase C
  grades: string; // "Kelas 1 - 2", etc.
  elements: CpElement[];
}

export interface AtpResult {
  alurTujuanPembelajaran: string[];
  kriteriaKetercapaian: {
    kriteria: string;
    baruBerkembang: string;
    layak: string;
    mahir: string;
  }[];
  metodePembelajaran: string;
}

export type ActiveTab = 'dashboard' | 'modul' | 'jurnal' | 'absensi' | 'penilaian' | 'rubrik' | 'soal' | 'cp' | 'cp_to_tp' | 'cetak' | 'rpm' | 'kktp' | 'rpe' | 'prota' | 'prosem' | 'slides' | 'lkpd' | 'materi' | 'cover' | 'soal_sumatif' | 'kode_etik' | 'kko' | 'ulangan' | 'rekap_tp' | 'supabase' | 'pengaturan' | 'analisis_jam';

export interface TpItem {
  kodeTp: string;
  rumusanTp: string;
  kompetensiKko: string;
  lingkupMateri: string;
  indikatorKetercapaian: string[];
  profilPancasila: string;
  targetKelasSemester: string;
  alokasiWaktu: string;
  rekomendasiAsesmen: string;
}

export interface CpToTpResult {
  fase: string;
  kelas: string;
  elemen: string;
  cpAsli: string;
  materiSpesifik: string;
  analisisDekonstruksi: {
    kompetensiUtama: string[];
    lingkupMateriUtama: string[];
    variasiKarakteristikSiswa: string;
  };
  daftarTp: TpItem[];
  rekomendasiPendekatan: string;
  catatanPendidik: string;
}

export interface SlideItem {
  slideNo: number;
  title: string;
  layoutType: string;
  points: string[];
  visualRecommendation: string;
  speakerNotes: string;
}

export interface SlidePresentationData {
  identitas: {
    mataPelajaran: string;
    kelas: string;
    fase: string;
    topikMateri: string;
    jumlahSlide: string;
    gayaDesain: string;
    tanggalDokumen: string;
    guruPenyusun?: string;
  };
  slides: SlideItem[];
}

export interface ProsemWeekValue {
  weekNum: number;
  value: string; // e.g. "4", "2", "L", "PTS", "PAS", "MPLS" or empty
  isEffective: boolean;
}

export interface ProsemMonthData {
  monthName: string;
  weeks: ProsemWeekValue[];
}

export interface ProsemRow {
  no: string;
  bab: string;
  topik: string;
  pertemuanKe: string;
  alokasiWaktu: string;
  months: ProsemMonthData[];
}

export interface ProsemSemesterData {
  monthsHeader: {
    monthName: string;
    totalWeeks: number;
    nonEffectiveWeeks: number[]; // 1-indexed week numbers that are non-effective
  }[];
  rows: ProsemRow[];
}

export interface ProsemData {
  identitas: {
    mataPelajaran: string;
    kelas: string;
    fase: string;
    tahunPelajaran: string;
    alokasiWaktuTiapMinggu: string;
  };
  ganjil: ProsemSemesterData;
  genap: ProsemSemesterData;
  keterangan: string;
  tanggalDokumen: string;
  kepalaSekolah?: string;
  guruMapel?: string;
}

export interface ProtaRow {
  no: string;
  bab: string;
  tujuanPembelajaran: string;
  materi: string;
  alokasiWaktu: string;
  semester: string;
}

export interface ProtaData {
  identitas: {
    mataPelajaran: string;
    kelas: string;
    fase: string;
    tahunPelajaran: string;
    totalJp2Semester: string;
    alokasiWaktuTiapMinggu: string;
    semester1Weeks: string;
    semester2Weeks: string;
  };
  rows: ProtaRow[];
  tanggalDokumen: string;
  kepalaSekolah?: string;
  guruMapel?: string;
}

export interface RpeData {
  identitas: {
    namaSekolah: string;
    kelas: string;
    jpPerMinggu: number;
    mataPelajaran: string;
    semester: string;
    tahunPelajaran: string;
  };
  alokasiWaktu: {
    bulans: {
      no: number;
      bulan: string;
      jumlahPekan: number;
      pekanEfektif: number;
      pekanTidakEfektif: number;
      keterangan: string;
    }[];
    totalPekan: number;
    totalPekanEfektif: number;
    totalPekanTidakEfektif: number;
  };
  pekanTidakEfektif: {
    no: number;
    uraianKegiatan: string;
    jumlahPekan: number;
    keterangan: string;
  }[];
  totalPekanEfektifFormula: string;
  totalJamEfektifFormula: string;
  totalJamEfektif: number;
  tanggalDokumen: string;
  catatanAnalisis?: string;
}

export interface KktpData {
  identitas: {
    satuanPendidikan: string;
    mataPelajaran: string;
    kelas: string;
    fase: string;
    semester: string;
    tahunPelajaran: string;
  };
  bab: string;
  materiPokok: string;
  deskripsiCp: string;
  kktpRows: {
    no: string;
    tujuanPembelajaran: string;
    intervalDeskripsi: {
      perluBimbingan: string;
      cukup: string;
      baik: string;
      sangatBaik: string;
    };
  }[];
}

export interface DeepLearningRPM {
  title: string;
  identitas: {
    penyusun: string;
    sekolah: string;
    tahunAjaran: string;
    semester: string;
    mataPelajaran: string;
    kelasFase: string;
    topikElemen?: string;
    bab?: string;
    topik?: string;
    alokasiWaktu: string;
    jumlahPertemuan?: number | string;
    kelas?: string;
    fase?: string;
  };
  identifikasi: {
    muridOps: string;
    materiPelajaranOps: string;
    dimensiProfilLulusan: string[];
    identifikasiMurid?: string;
    materiPelajaran?: string;
  };
  desainPembelajaran: {
    capaianPembelajaranOps: string;
    lintasDisiplinIlmuOps: string;
    tujuanPembelajaran: string;
    topikPembelajaranOps: string;
    praktikPedagogis: string;
    kemitraanPembelajaranOps: string;
    lingkunganPembelajaran: string;
    pemanfaatanDigitalOps: string;
    capaianPembelajaran?: string;
    lintasDisiplinIlmu?: string;
    topikPembelajaran?: string;
    kemitraanPembelajaran?: string;
    pemanfaatanDigital?: string;
  };
  pengalamanBelajar: {
    langkahPembelajaran: {
      awalOps: {
        prinsip: string;
        deskripsi: string;
      };
      inti: {
        prinsipUmum: string;
        memahami: {
          prinsip: string;
          kegiatan: string[];
        };
        mengaplikasi: {
          prinsip: string;
          kegiatan: string[];
        };
        merefleksi: {
          prinsip: string;
          kegiatan: string[];
        };
      };
      penutupOps: {
        prinsip: string;
        deskripsi: string;
      };
    };
    kegiatanAwal?: string;
    kegiatanInti?: string;
    kegiatanPenutup?: string;
  };
  asesmenPembelajaran: {
    awal: string;
    proses: string;
    akhir: string;
  };
  tandaTangan: {
    tempatTanggal?: string;
    kepalaSekolah: {
      nama: string;
      nip: string;
    } | string;
    guruMapel: {
      nama: string;
      nip: string;
    } | string;
  };
  lampiran: {
    asesmenDiagnostikNonKognitif?: {
      tujuan: string;
      pertanyaan: { no: number; teks: string }[];
    };
    asesmenFormatif?: {
      keterangan: {
        diskusi: string;
        presentasi: string;
        unjukKerja: string;
      };
      rubrikPenilaian: { skor: number; deskripsi: string }[];
    };
    penilaianSikap?: {
      spiritual: {
        teknik: string;
        instrumen: string;
        indikator: string[];
      };
      sosial: {
        teknik: string;
        instrumen: string;
        indikator: string[];
      };
      keterangan: string;
      rumusNilai: string;
    };
    penilaianPengetahuan?: {
      judul: string;
      aspekList: string[];
      pedomanSkor: {
        aspek: string;
        skor4: string;
        skor3: string;
        skor2: string;
        skor1: string;
      }[];
      rumusNilai: string;
    };
    penilaianKeterampilan?: {
      judul: string;
      aspekList: string[];
      pedomanSkor: {
        aspek: string;
        skor4: string;
        skor3: string;
        skor2: string;
        skor1: string;
      }[];
      rumusNilai: string;
    };
    pengayaanDanRemedial?: {
      remedial: {
        tujuan: string;
        strategi: { nama: string; deskripsi: string }[];
      };
      pengayaan: {
        tujuan: string;
        strategi: { nama: string; deskripsi: string }[];
      };
    };
    refleksi?: {
      guru: { no: number; aspek: string; refleksiGuru: string; jawaban?: string }[];
      pesertaDidik: string;
    };
    asesmenAwal?: string;
    asesmenProses?: string;
    asesmenAkhir?: string;
    materiAjar?: string;
  };
  lkpdList?: {
    pertemuan: string;
    title: string;
    content: string;
  }[];
}

export interface LkpdContentBlock {
  blockType: 'text' | 'question' | 'table' | 'matching' | 'highlight' | 'illustrationPrompt' | 'pjokVisual';
  exactText?: string;
  questionData?: {
    id: string;
    questionText: string;
    answerBoxStyle: 'rounded_large' | 'dotted_box' | 'speech_bubble' | 'ruled_lines';
    placeholderText?: string;
    score?: string;
  };
  tableData?: {
    headers: string[];
    rows: string[][];
  };
  matchingData?: {
    leftLabel: string;
    rightLabel: string;
    pairs: {
      leftItem: string;
      rightItem: string;
    }[];
  };
  illustrationPrompt?: string;
  visualType?: 'sepakbola' | 'voli' | 'basket' | 'kasti' | 'senam' | 'atletik' | 'kebugaran' | 'renang' | 'gobaksodor' | 'silat';
  visualCaption?: string;
  visualDetails?: {
    label: string;
    desc: string;
  }[];
}

export interface LkpdSection {
  sectionTitle: string;
  icon: string;
  introText?: string;
  contentBlocks: LkpdContentBlock[];
  visualDesignTip?: string;
}

export interface InteractiveLkpdData {
  identitas: {
    mataPelajaran: string;
    kelas: string;
    topikMateri: string;
    guruPenyusun: string;
    gayaDesain: string;
    tanggalDokumen: string;
    sekolah?: string;
    alokasiWaktu?: string;
  };
  judulMenarik: string;
  sections: LkpdSection[];
  penutupMotivasi?: string;
  selfReflectionChecklist?: string[];
}


