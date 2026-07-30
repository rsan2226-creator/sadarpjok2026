import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CLASSES, INITIAL_JOURNALS, INITIAL_MODULS, PREBUILT_RUBRIKS } from './src/data';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In-Memory Fallbacks (seeding with initial static data)
let inMemoryClasses = JSON.parse(JSON.stringify(INITIAL_CLASSES));
let inMemoryModuls = JSON.parse(JSON.stringify(INITIAL_MODULS));
let inMemoryJournals = JSON.parse(JSON.stringify(INITIAL_JOURNALS));
let inMemoryRubriks = JSON.parse(JSON.stringify(PREBUILT_RUBRIKS));

// Lazy-initialized Supabase Client with connection health & cooldown mechanism
let supabaseClient: any = null;
let supabaseLastFailureTime = 0;
const SUPABASE_COOLDOWN_MS = 60000; // 60s cooldown if Supabase connection times out or fails

function isSupabaseCoolingDown(): boolean {
  return Boolean(supabaseLastFailureTime && (Date.now() - supabaseLastFailureTime < SUPABASE_COOLDOWN_MS));
}

function markSupabaseFailed() {
  supabaseLastFailureTime = Date.now();
}

function getSupabaseClient() {
  if (isSupabaseCoolingDown()) {
    return null;
  }
  if (!supabaseClient) {
    let url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey || !url.trim() || !anonKey.trim()) {
      return null;
    }
    const lowerUrl = url.trim().toLowerCase();
    if (
      (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) ||
      lowerUrl.includes('your-supabase') ||
      lowerUrl.includes('example.com') ||
      lowerUrl.includes('placeholder')
    ) {
      return null;
    }
    // Clean URL suffix if provided in full-rest form
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/rest/v1/')) {
      cleanUrl = cleanUrl.slice(0, -9);
    } else if (cleanUrl.endsWith('/rest/v1')) {
      cleanUrl = cleanUrl.slice(0, -8);
    }
    try {
      supabaseClient = createClient(cleanUrl, anonKey.trim());
    } catch (e: any) {
      console.log('[Supabase Connect] Unable to create Supabase client:', e.message || e);
      return null;
    }
  }
  return supabaseClient;
}

// Helper to prevent long-hanging database requests on serverless environments
function queryWithTimeout<T = any>(promise: any, timeoutMs: number = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout of ${timeoutMs}ms exceeded`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Lazy-initialized Gemini Client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

// Robust retry wrapper to handle 503 (Service Unavailable/High Demand) and 429 (Rate Limit) errors with exponential backoff
async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 4, initialDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || '';
      let errorStr = '';
      try {
        errorStr = error ? (error.message || String(error)) : '';
        if (error && typeof error === 'object') {
          errorStr += ' ' + (error.status || '') + ' ' + (error.code || '') + ' ' + (error.statusText || '');
        }
      } catch (e) {
        errorStr = String(error);
      }

      const isTransient = 
        errorStr.includes('503') || 
        errorStr.includes('UNAVAILABLE') || 
        errorStr.includes('high demand') || 
        errorStr.includes('temporary') || 
        errorStr.includes('429') || 
        errorStr.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('high demand') ||
        errorMessage.includes('temporary') ||
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');

      if (attempt <= maxRetries && isTransient) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 800;
        console.warn(`[Gemini API] Transient error (503/429/Unavailable). Attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay)}ms... Error summary: ${errorMessage || 'Unknown Error'}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

function formatAiError(error: any, defaultMsg: string = 'Gagal memproses permintaan AI.'): string {
  if (!error) return defaultMsg;
  let rawMsg = error?.message || String(error || '');
  if (typeof error === 'object') {
    try {
      rawMsg += ' ' + JSON.stringify(error);
    } catch (e) {}
  }
  if (
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('403') ||
    rawMsg.includes('denied access') ||
    rawMsg.includes('Project Access Denied')
  ) {
    return 'Layanan AI Gemini sedang mengalami pembatasan akses (403 PERMISSION_DENIED: Your project has been denied access). Silakan perbarui GEMINI_API_KEY di Settings > Secrets atau hubungi administrator platform.';
  }
  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('Quota')) {
    return 'Batas kuota harian/menit Gemini API tercapai (429 Quota Exceeded). Silakan coba lagi dalam beberapa saat.';
  }
  return error?.message || defaultMsg;
}

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in the environment secrets. Please set it in Settings > Secrets.');
    }
    const rawClient = new GoogleGenAI({ apiKey });

    // Intercept generateContent calls to automatically apply the retry logic and seamless model fallbacks (e.g. from gemini-3.6-flash to gemini-flash-latest or gemini-3.1-flash-lite if daily quotas or rate-limits are hit)
    const originalGenerateContent = rawClient.models.generateContent.bind(rawClient.models);
    rawClient.models.generateContent = async function(params: any) {
      const originalModel = params?.model;
      try {
        return await callGeminiWithRetry(() => originalGenerateContent(params));
      } catch (error: any) {
        let errorStr = '';
        try {
          errorStr = error ? (error.message || String(error)) : '';
          if (error && typeof error === 'object') {
            errorStr += ' ' + JSON.stringify(error);
          }
        } catch (e) {
          errorStr = String(error);
        }

        const isQuotaOrTransient = 
          errorStr.includes('503') || 
          errorStr.includes('UNAVAILABLE') || 
          errorStr.includes('high demand') || 
          errorStr.includes('temporary') || 
          errorStr.includes('429') || 
          errorStr.includes('RESOURCE_EXHAUSTED') ||
          errorStr.includes('quota') ||
          errorStr.includes('Quota') ||
          errorStr.includes('limit') ||
          errorStr.includes('403') ||
          errorStr.includes('PERMISSION_DENIED') ||
          errorStr.includes('denied') ||
          errorStr.includes('permission');

        if (isQuotaOrTransient) {
          const fallbackModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'].filter(m => m !== originalModel);
          for (const fallbackModel of fallbackModels) {
            console.warn(`[Gemini API Fallback] '${originalModel}' encountered '${errorStr.slice(0, 100)}...'. Attempting automatic fallback to '${fallbackModel}'...`);
            try {
              const fallbackParams = { ...params, model: fallbackModel };
              return await callGeminiWithRetry(() => originalGenerateContent(fallbackParams));
            } catch (fallbackErr: any) {
              console.error(`[Gemini API Fallback] '${fallbackModel}' also failed.`);
            }
          }
        }
        throw error;
      }
    };

    aiClient = rawClient;
  }
  return aiClient;
}

// ==========================================
// INTELLIGENT OFFLINE FALLBACK GENERATORS
// ==========================================
function getFallbackModul(grade: any, materi: any, alokasiWaktu: any) {
  const g = grade || '1';
  const m = materi || 'Variasi Gerak Dasar Lokomotor, Non-Lokomotor, dan Manipulatif';
  const a = alokasiWaktu || '2 x 35 Menit (1 Pertemuan)';
  return {
    title: `Modul Ajar PJOK Kelas ${g} SD: ${m}`,
    materiPokok: m,
    alokasiWaktu: a,
    tujuanPembelajaran: [
      `Siswa dapat menjelaskan prosedur ${m} secara tepat dan aman.`,
      `Siswa dapat mempraktikkan gerakan dasar ${m} dengan koordinasi tubuh yang baik.`,
      `Siswa dapat menunjukkan sikap disiplin, kerja sama, dan percaya diri selama pembelajaran.`
    ],
    kegiatanPembelajaran: {
      pendahuluan: [
        'Guru menyapa siswa, mengecek kehadiran, dan memimpin doa.',
        'Apersepsi singkat dan penyampaian tujuan pembelajaran hari ini.',
        'Pemanasan dinamis dalam bentuk permainan edukatif selama 10-15 menit.'
      ],
      inti: [
        `Guru memberikan contoh dan memperagakan kombinasi gerakan ${m}.`,
        'Siswa melakukan latihan perorangan secara terarah dengan pengawasan guru.',
        'Siswa dibagi menjadi kelompok kecil untuk mempraktikkan materi dalam bentuk permainan sederhana.',
        'Guru memberikan umpan balik (feedback) koreksi gerakan fisik siswa.'
      ],
      penutup: [
        'Kegiatan pendinginan (cooling down) dan pelemasan otot.',
        'Refleksi bersama mengenai materi yang telah dipelajari.',
        'Apresiasi hasil latihan, penyampaian tugas rumah, dan doa penutup.'
      ]
    },
    saranaPrasarana: ['Cone / Pylon', 'Peluit', 'Bola Plastik / Bola Karet', 'Lapangan Sekolah'],
    rubrikPenilaian: 'Sangat Baik (Mahir): Gerakan lancar, seimbang, dan koordinasi tepat. Cukup Baik: Gerakan cukup lancar dengan sedikit koreksi. Perlu Bimbingan: Membutuhkan pendampingan langsung.'
  };
}

function getFallbackRubrik(materi: any, kategori: any) {
  const m = materi || 'Keterampilan Gerak Dasar';
  const k = kategori || 'Permainan & Olahraga';
  return {
    materi: m,
    kategori: k,
    indikator: [
      {
        namaIndikator: 'Keseimbangan dan Awalan Gerak',
        kriteria: {
          mahir: 'Posisi tubuh sangat stabil, fokus pandangan tepat ke depan, dan awalan gerak sempurna.',
          cukup: 'Posisi tubuh cukup stabil namun terkadang kehilangan keseimbangan di akhir gerakan.',
          perluBimbingan: 'Posisi tubuh belum stabil dan membutuhkan bantuan instruksi gerak dari guru.'
        }
      },
      {
        namaIndikator: 'Akurasi dan Koordinasi Motorik',
        kriteria: {
          mahir: 'Koordinasi tangan, kaki, dan mata sangat selaras saat melakukan gerakan fisik.',
          cukup: 'Koordinasi gerak cukup baik tetapi frekuensi irama gerak masih perlu perbaikan.',
          perluBimbingan: 'Koordinasi gerak kaku dan belum selaras.'
        }
      },
      {
        namaIndikator: 'Penyelesaian Gerak dan Sikap Tubuh Akhir',
        kriteria: {
          mahir: 'Mampu mengakhiri gerakan secara mulus dengan kontrol tubuh penuh.',
          cukup: 'Mengakhiri gerakan dengan kontrol tubuh yang cukup.',
          perluBimbingan: 'Kesulitan mengontrol kestabilan sikap akhir tubuh.'
        }
      }
    ]
  };
}

function getFallbackSoal(grade: any, materi: any, jumlahSoal: any) {
  const g = grade || '1';
  const m = materi || 'Gerak Dasar Lokomotor';
  return {
    materi: m,
    grade: g,
    soalList: [
      {
        id: 'soal-1',
        pertanyaan: `Gerakan berpindah tempat dari satu titik ke titik lain disebut gerakan...?`,
        pilihan: {
          A: 'Lokomotor',
          B: 'Non-lokomotor',
          C: 'Manipulatif',
          D: 'Statis'
        },
        kunciJawaban: 'A',
        pembahasan: 'Gerak lokomotor adalah gerakan tubuh yang menyebabkan terjadinya perpindahan tempat.'
      },
      {
        id: 'soal-2',
        pertanyaan: `Berikut ini yang merupakan contoh dari gerakan lokomotor saat berolahraga adalah...?`,
        pilihan: {
          A: 'Membungkukkan badan',
          B: 'Berlari dan melompat',
          C: 'Mengayunkan lengan',
          D: 'Memutar pinggang'
        },
        kunciJawaban: 'B',
        pembahasan: 'Berlari dan melompat berpindah posisi tubuh, sehingga termasuk gerak lokomotor.'
      },
      {
        id: 'soal-3',
        pertanyaan: `Sebelum melakukan aktivitas olahraga fisik, kita sebaiknya melakukan...?`,
        pilihan: {
          A: 'Makan makanan berat',
          B: 'Tidur terlentang',
          C: 'Pemanasan otot',
          D: 'Minum es segar'
        },
        kunciJawaban: 'C',
        pembahasan: 'Pemanasan berguna untuk menyiapkan otot dan mencegah risiko cedera olahraga.'
      }
    ]
  };
}

function getFallbackSummative(grade: any, materi: any) {
  const g = grade || '1';
  const m = materi || 'Penilaian Sumatif PJOK';
  return {
    judulUjian: `NASKAH SOAL SUMATIF PJOK KELAS ${g} SD`,
    kop: {
      dinasPendidikan: 'DINAS PENDIDIKAN KABUPATEN / KOTA',
      namaSekolah: 'SD NEGERI UTAMA',
      mataPelajaran: 'PJOK',
      kelas: g,
      semester: '1 (Ganjil)',
      tahunPelajaran: '2024/2025',
      alokasiWaktu: '60 Menit'
    },
    questions: [
      {
        id: 'sum-1',
        questionText: `Manakah di bawah ini yang merupakan contoh gerakan lokomotor dalam olahraga ${m}?`,
        options: ['A. Berlari menuju garis finis', 'B. Memutar persendian lengan', 'C. Mendorong dinding', 'D. Mengayunkan tangan'],
        correctAnswer: 'A',
        explanation: 'Berlari menyebabkan terjadinya perpindahan posisi tubuh dari titik A ke titik B.',
        kisiKisi: 'Disajikan jenis gerakan, siswa dapat mengidentifikasi gerakan lokomotor.',
        indikator: 'Mengidentifikasi gerakan berpindah tempat',
        levelKognitif: 'C2 / Pemahaman'
      },
      {
        id: 'sum-2',
        questionText: `Sikap tubuh yang benar saat melakukan gerakan lompat mendarat dengan dua kaki adalah...?`,
        options: ['A. Kaki kaku lurus', 'B. Lutut sedikit mengeper/ditekuk', 'C. Badan miring ke samping', 'D. Kepala menunduk tajam'],
        correctAnswer: 'B',
        explanation: 'Mengeperkan lutut saat mendarat meredam benturan dan menjaga keseimbangan tubuh.',
        kisiKisi: 'Disajikan teknik mendarat, siswa menentukan posisi tubuh yang aman.',
        indikator: 'Menjelaskan posisi mendarat yang aman',
        levelKognitif: 'C3 / Penerapan'
      },
      {
        id: 'sum-3',
        questionText: 'Tujuan utama melakukan pendinginan (cooling down) setelah melakukan aktivitas fisik adalah...?',
        options: ['A. Mengembalikan denyut jantung ke kondisi normal', 'B. Menambah beban kerja otot', 'C. Mempercepat rasa lelah', 'D. Meningkatkan suhu tubuh'],
        correctAnswer: 'A',
        explanation: 'Pendinginan bertahap menurunkan denyut nadi dan membantu pemulihan otot.',
        kisiKisi: 'Disajikan manfaat pendinginan, siswa menyebutkan tujuan utamanya.',
        indikator: 'Menjelaskan fungsi pendinginan',
        levelKognitif: 'C2 / Pemahaman'
      }
    ]
  };
}

function getFallbackKKO(tpText: any) {
  return {
    levelBloom: 'C3 / C4 (Menerapkan & Menganalisis)',
    kkoTerdeteksi: ['Menganalisis', 'Mempraktikkan'],
    analisisPendidikanMendalam: 'Tujuan pembelajaran ini telah mengandung kata kerja operasional yang menuntut pemahaman konseptual sekaligus artikulasi gerakan psikomotorik secara nyata.',
    rekomendasiRevisi: 'Penggunaan KKO sudah sangat tepat untuk pembelajaran PJOK berkesadaran tinggi.',
    contohIndikator: [
      'Siswa mampu menyebutkan urutan tahapan gerak secara lisan.',
      'Siswa mampu mempraktikkan gerakan secara langsung di lapangan.'
    ]
  };
}

function getFallbackDailyTest(grade: any, materi: any, tipe?: any) {
  const g = grade || '1';
  const m = materi || 'Ulangan Harian PJOK';
  const t = tipe === 'praktik' ? 'praktik' : 'tulis';
  return {
    title: `INSTRUMEN ULANGAN HARIAN PJOK KELAS ${g}`,
    grade: g,
    materi: m,
    tujuanPembelajaran: `Siswa dapat memahami dan mempraktikkan materi ${m} dengan aman dan penuh percaya diri.`,
    tipeUlangan: t,
    questions: [
      {
        id: 'q1',
        questionText: `Gerakan berpindah tempat dari satu posisi ke posisi lain disebut gerak...?`,
        options: ['A. Lokomotor', 'B. Non-lokomotor', 'C. Manipulatif', 'D. Pasif'],
        correctAnswer: 'A',
        explanation: 'Gerak lokomotor ditandai dengan adanya perpindahan seluruh posisi tubuh.'
      },
      {
        id: 'q2',
        questionText: `Aktivitas yang wajib dilakukan sebelum melakukan olahraga inti adalah...?`,
        options: ['A. Pemanasan', 'B. Makan berat', 'C. Tidur gantung', 'D. Pendinginan'],
        correctAnswer: 'A',
        explanation: 'Pemanasan mempersiapkan fleksibilitas otot dan organ sirkulasi darah.'
      }
    ],
    essayQuestions: [
      {
        id: 'e1',
        questionText: `Sebutkan 3 contoh gerakan lokomotor yang sering kamu lakukan di sekolah!`,
        keyAnswer: 'Berjalan, berlari, dan melompat.',
        scoreMax: 10
      }
    ],
    taskInstructions: [
      `1. Lakukan pemanasan mandiri atau bersama kelompok selama 5 menit.`,
      `2. Praktikkan gerakan ${m} melintasi lintasan sepanjang 10 meter.`,
      `3. Utamakan keselamatan fisik dan koordinasi tubuh yang seimbang.`
    ],
    rubricCriteria: [
      {
        id: 'r1',
        aspect: 'Sikap Awalan & Posisi Tubuh',
        score4: 'Posisi berdiri sangat siap, fokus mata tepat ke depan, keseimbangan sempurna.',
        score3: 'Posisi berdiri cukup siap, fokus mata ke depan, keseimbangan baik.',
        score2: 'Posisi kurang siap, posisi kepala menunduk, sesekali oleng.',
        score1: 'Posisi tidak siap dan membutuhkan arahan ulang dari guru.'
      },
      {
        id: 'r2',
        aspect: 'Pelaksanaan Gerakan Inti',
        score4: 'Rangkaian gerakan sangat mulus, ritme konsisten, tanpa kesalahan pola.',
        score3: 'Rangkaian gerakan cukup mulus dengan sedikit penyesuaian ritme.',
        score2: 'Gerakan kaku, terjadi penyesuaian posisi berkali-kali.',
        score1: 'Gerakan tidak teratur dan belum menguasai pola dasar.'
      }
    ],
    scoringFormula: 'Nilai Akhir = (Total Skor Perolehan / Total Skor Maksimal) x 100',
    gradingGuide: 'Predikat: 86-100 (Sangat Baik), 71-85 (Baik), 56-70 (Cukup), <56 (Perlu Bimbingan)'
  };
}

function getFallbackATP(phase?: any, element?: any) {
  const p = phase || 'Fase A (Kelas 1 - 2)';
  const e = element || 'Keterampilan Gerak';
  return {
    alurTujuanPembelajaran: [
      `1.1 Peserta didik mampu menirukan variasi pola gerak dasar lokomotor (jalan, lari, melompat) dengan koordinasi tubuh yang seimbang pada ${p}.`,
      `1.2 Peserta didik mampu memperagakan kombinasi gerak dasar non-lokomotor (menekuk, mengayun, memutar) secara mandiri dan aman.`,
      `1.3 Peserta didik mampu melatih koordinasi gerak dasar manipulatif (melempar, menangkap, menendang) dalam kelompok kecil.`,
      `1.4 Peserta didik mampu mengarahkan gerakan sesuai petunjuk keselamatan dan menerapkan nilai-nilai sportivitas.`
    ],
    kriteriaKetercapaian: [
      {
        kriteria: 'Penguasaan Pola Gerak Dasar Lokomotor',
        baruBerkembang: 'Belum stabil, posisi kaki dan koordinasi tangan belum seirama.',
        layak: 'Mampu melakukan gerakan jalan dan lari dengan posisi tubuh seimbang.',
        mahir: 'Mampu melakukan kombinasi jalan, lari, dan melompat secara mulus tanpa kehilangan keseimbangan.'
      },
      {
        kriteria: 'Kepatuhan Keselamatan & Sportivitas',
        baruBerkembang: 'Membutuhkan teguran dan pendampingan langsung dari guru.',
        layak: 'Mampu mematuhi instruksi keselamatan dan bekerja sama cukup baik.',
        mahir: 'Menjadi teladan keselamatan dan aktif membantu serta menyemangati teman sekelompok.'
      }
    ],
    metodePembelajaran: 'Pendekatan Saintifik, Game-Based Learning (Permainan Edukatif Berkesadaran), dan Unjuk Kerja Lapangan.'
  };
}

function getFallbackCPTP(fase?: any, elemen?: any) {
  const f = fase || 'Fase A (Kelas 1 - 2)';
  const e = elemen || 'Keterampilan Gerak';
  return {
    fase: f,
    kelas: 'Kelas 1 - 2',
    elemen: e,
    cpAsli: `Pada akhir ${f}, peserta didik mampu menirukan dan mempraktikkan variasi pola gerak dasar pada elemen ${e} secara aman dan disiplin.`,
    materiSpesifik: 'Pola Gerak Dasar Lokomotor, Non-Lokomotor, dan Manipulatif',
    analisisDekonstruksi: {
      kompetensiUtama: ['Menirukan', 'Mempraktikkan', 'Mengidentifikasi', 'Menerapkan'],
      lingkupMateriUtama: ['Variasi Gerak Lokomotor', 'Variasi Gerak Non-Lokomotor', 'Variasi Gerak Manipulatif'],
      variasiKarakteristikSiswa: 'Mempertimbangkan perkembangan kognitif dan motorik kasar anak usia SD awal.'
    },
    daftarTp: [
      {
        kodeTp: 'TP-A.1',
        rumusanTp: 'Peserta didik mampu menjelaskan dan menirukan prosedur variasi gerak dasar lokomotor (jalan, lari, melompat) dengan benar.',
        kompetensiKko: 'Menjelaskan & Menirukan (C2 / P2)',
        lingkupMateri: 'Variasi Gerak Dasar Lokomotor',
        indikatorKetercapaian: [
          'Siswa dapat menyebutkan perbedaan jalan dan lari.',
          'Siswa dapat mempraktikkan gerak jalan lurus dan berbelok-belok.',
          'Siswa dapat melakukan lompatan dengan tumpuan dua kaki.'
        ],
        profilPancasila: 'Mandiri, Gotong Royong, Bernalar Kritis',
        targetKelasSemester: 'Kelas 1 / Semester 1',
        alokasiWaktu: '8 JP (4 Pertemuan)',
        rekomendasiAsesmen: 'Asesmen Formatif Unjuk Kerja Lapangan & Pengamatan Rubrik'
      },
      {
        kodeTp: 'TP-A.2',
        rumusanTp: 'Peserta didik mampu mempraktikkan kombinasi gerak dasar non-lokomotor (menekuk, memutar, mengayun) secara aman.',
        kompetensiKko: 'Mempraktikkan (P3)',
        lingkupMateri: 'Variasi Gerak Dasar Non-Lokomotor',
        indikatorKetercapaian: [
          'Siswa dapat melakukan gerakan mengayun lengan tanpa berpindah tempat.',
          'Siswa dapat membungkukkan badan menyentuh ujung kaki.'
        ],
        profilPancasila: 'Mandiri, Kreatif',
        targetKelasSemester: 'Kelas 1 / Semester 1',
        alokasiWaktu: '8 JP (4 Pertemuan)',
        rekomendasiAsesmen: 'Unjuk Kerja & Observasi Sikap'
      }
    ],
    rekomendasiPendekatan: 'Pendekatan Bermain (Play-Based Learning) dan Modifikasi Alat Sederhana',
    catatanPendidik: 'Dampingi siswa secara individual pada gerakan yang membutuhkan keseimbangan ekstra.'
  };
}

function getFallbackKKTP(grade?: any, materi?: any, mapel?: any) {
  const g = grade || '1';
  const m = materi || 'Variasi Gerak Dasar Lokomotor';
  const mp = mapel || 'PJOK';
  return {
    identitas: {
      satuanPendidikan: 'SD NEGERI UTAMA',
      mataPelajaran: mp,
      kelas: g,
      fase: parseInt(g) <= 2 ? 'A' : parseInt(g) <= 4 ? 'B' : 'C',
      semester: '1',
      tahunPelajaran: '2024/2025'
    },
    bab: 'Bab 1',
    materiPokok: m,
    deskripsiCp: `Peserta didik mampu mempraktikkan variasi gerak dasar ${m} secara mandiri dan aman.`,
    tujuanPembelajaran: `Siswa dapat memperagakan variasi gerak dasar ${m} dengan koordinasi tepat.`,
    kktpRows: [
      {
        no: '1',
        indikatorTp: `Keseimbangan dan Postur Tubuh saat melakukan ${m}`,
        interval0_60: 'Belum mampu menjaga keseimbangan tubuh (Perlu Bimbingan)',
        interval61_75: 'Mampu menjaga keseimbangan dengan sedikit penyesuaian (Cukup)',
        interval76_85: 'Posisi tubuh seimbang dan postur tegak stabil (Baik)',
        interval86_100: 'Sangat stabil, gerakan santai dan penuh rasa percaya diri (Sangat Baik)'
      },
      {
        no: '2',
        indikatorTp: `Akurasi dan Kelancaran Rangkaian Gerakan ${m}`,
        interval0_60: 'Gerakan sering terputus dan ragu-ragu (Perlu Bimbingan)',
        interval61_75: 'Gerakan lumayan lancar tetapi kecepatan kurang teratur (Cukup)',
        interval76_85: 'Rangkaian gerakan lancar dan koordinasi tangan-kaki tepat (Baik)',
        interval86_100: 'Sangat lancar, ritme konsisten dan teknik gerakan sempurna (Sangat Baik)'
      }
    ],
    rekomendasiTindakLanjut: 'Siswa yang memperoleh nilai interval 0-60 diberikan bimbingan perorangan saat jam olahraga.'
  };
}

function getFallbackRPE(tahunPelajaran?: any, semester?: any) {
  const tp = tahunPelajaran || '2024/2025';
  const sem = semester || '1';
  return {
    identitas: {
      namaSekolah: 'SD NEGERI UTAMA',
      mataPelajaran: 'PJOK',
      kelas: '1',
      semester: sem,
      tahunPelajaran: tp,
      jpPerMinggu: '4'
    },
    alokasiWaktu: {
      bulans: [
        { bulan: 'Juli', totalPekan: 4, efektif: 2, tidakEfektif: 2 },
        { bulan: 'Agustus', totalPekan: 5, efektif: 4, tidakEfektif: 1 },
        { bulan: 'September', totalPekan: 4, efektif: 4, tidakEfektif: 0 },
        { bulan: 'Oktober', totalPekan: 4, efektif: 4, tidakEfektif: 0 },
        { bulan: 'November', totalPekan: 4, efektif: 4, tidakEfektif: 0 },
        { bulan: 'Desember', totalPekan: 5, efektif: 2, tidakEfektif: 3 }
      ],
      totalPekan: 26,
      totalPekanEfektif: 20,
      totalPekanTidakEfektif: 6
    },
    pekanTidakEfektif: [
      { namaKegiatan: 'MPLS & Masa Transisi', jumlahPekan: 2, bulan: 'Juli' },
      { namaKegiatan: 'Peringatan HUT RI & Lomba Sekolah', jumlahPekan: 1, bulan: 'Agustus' },
      { namaKegiatan: 'Penilaian Akhir Semester (PAS) & Pembagian Rapor', jumlahPekan: 3, bulan: 'Desember' }
    ],
    totalPekanEfektifFormula: '26 total pekan - 6 pekan tidak efektif = 20 Pekan Efektif',
    totalJamEfektifFormula: '20 pekan efektif x 4 JP = 80 Jam Pelajaran (JP)',
    catatanAnalisis: 'Alokasi jam efektif sangat mencukupi untuk menyelesaikan seluruh bab Kurikulum Merdeka PJOK.',
    tanggalDokumen: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

function getFallbackProta(grade?: any, semester?: any, tahunPelajaran?: any) {
  const g = grade || '1';
  const tp = tahunPelajaran || '2024/2025';
  return {
    identitas: {
      mataPelajaran: 'PJOK',
      kelas: g,
      fase: parseInt(g) <= 2 ? 'A' : parseInt(g) <= 4 ? 'B' : 'C',
      tahunPelajaran: tp,
      totalJp2Semester: '96 JP',
      alokasiWaktuTiapMinggu: '4 JP / Pekan',
      semester1Weeks: '20',
      semester2Weeks: '20'
    },
    rows: [
      {
        no: '1',
        bab: 'Bab 1',
        tujuanPembelajaran: 'Peserta didik dapat memahami dan mempraktikkan variasi gerak dasar lokomotor.',
        materi: 'Gerak Dasar Lokomotor (Jalan, Lari, Lompat)',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 1'
      },
      {
        no: '2',
        bab: 'Bab 2',
        tujuanPembelajaran: 'Peserta didik dapat memahami dan mempraktikkan variasi gerak dasar non-lokomotor.',
        materi: 'Gerak Dasar Non-Lokomotor (Mengayun, Menekuk, Memutar)',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 1'
      },
      {
        no: '3',
        bab: 'Bab 3',
        tujuanPembelajaran: 'Peserta didik dapat memahami dan mempraktikkan variasi gerak dasar manipulatif.',
        materi: 'Gerak Dasar Manipulatif (Melempar & Menangkap Bola)',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 1'
      },
      {
        no: '4',
        bab: 'Bab 4',
        tujuanPembelajaran: 'Peserta didik dapat memperagakan aktivitas senam lantai sederhana.',
        materi: 'Aktivitas Senam Ketangkasan & Keseimbangan',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 2'
      },
      {
        no: '5',
        bab: 'Bab 5',
        tujuanPembelajaran: 'Peserta didik dapat bergerak sesuai irama musik/ketukan.',
        materi: 'Aktivitas Gerak Berirama (Ritmik)',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 2'
      },
      {
        no: '6',
        bab: 'Bab 6',
        tujuanPembelajaran: 'Peserta didik dapat mengidentifikasi kebiasaan hidup sehat dan kebersihan diri.',
        materi: 'Kebugaran Jasmani & Pemeliharaan Kebersihan Diri',
        alokasiWaktu: '16 JP (4 Pertemuan)',
        semester: 'Semester 2'
      }
    ],
    tanggalDokumen: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

function getFallbackProsem(grade?: any, semester?: any, tahunPelajaran?: any) {
  const g = grade || '1';
  const tp = tahunPelajaran || '2024/2025';

  const makeSemesterData = (semNum: number) => {
    const monthsHeader = semNum === 1
      ? [
          { monthName: 'Juli', totalWeeks: 4, nonEffectiveWeeks: [1, 2] },
          { monthName: 'Agustus', totalWeeks: 5, nonEffectiveWeeks: [3] },
          { monthName: 'September', totalWeeks: 4, nonEffectiveWeeks: [] },
          { monthName: 'Oktober', totalWeeks: 4, nonEffectiveWeeks: [] },
          { monthName: 'November', totalWeeks: 4, nonEffectiveWeeks: [] },
          { monthName: 'Desember', totalWeeks: 5, nonEffectiveWeeks: [3, 4, 5] }
        ]
      : [
          { monthName: 'Januari', totalWeeks: 4, nonEffectiveWeeks: [1] },
          { monthName: 'Februari', totalWeeks: 4, nonEffectiveWeeks: [] },
          { monthName: 'Maret', totalWeeks: 4, nonEffectiveWeeks: [3] },
          { monthName: 'April', totalWeeks: 4, nonEffectiveWeeks: [2, 3] },
          { monthName: 'Mei', totalWeeks: 5, nonEffectiveWeeks: [] },
          { monthName: 'Juni', totalWeeks: 4, nonEffectiveWeeks: [3, 4] }
        ];

    const topics = semNum === 1
      ? [
          { no: '1', bab: 'Bab 1', topik: 'Variasi Gerak Dasar Lokomotor', pert: '1-4', jp: '16 JP' },
          { no: '2', bab: 'Bab 2', topik: 'Variasi Gerak Dasar Non-Lokomotor', pert: '5-8', jp: '16 JP' },
          { no: '3', bab: 'Bab 3', topik: 'Variasi Gerak Dasar Manipulatif', pert: '9-12', jp: '16 JP' }
        ]
      : [
          { no: '4', bab: 'Bab 4', topik: 'Aktivitas Senam Lantai & Ketangkasan', pert: '13-16', jp: '16 JP' },
          { no: '5', bab: 'Bab 5', topik: 'Aktivitas Gerak Berirama (Ritmik)', pert: '17-20', jp: '16 JP' },
          { no: '6', bab: 'Bab 6', topik: 'Aktivitas Kebugaran & Kebersihan Diri', pert: '21-24', jp: '16 JP' }
        ];

    const rows = topics.map((t) => ({
      no: t.no,
      bab: t.bab,
      topik: t.topik,
      pertemuanKe: t.pert,
      alokasiWaktu: t.jp,
      months: monthsHeader.map((mh) => ({
        monthName: mh.monthName,
        weeks: Array.from({ length: mh.totalWeeks }, (_, wIdx) => {
          const wNum = wIdx + 1;
          const isNonEff = mh.nonEffectiveWeeks.includes(wNum);
          return {
            weekNum: wNum,
            value: isNonEff ? 'L' : '4',
            isEffective: !isNonEff
          };
        })
      }))
    }));

    return { monthsHeader, rows };
  };

  return {
    identitas: {
      mataPelajaran: 'PJOK',
      kelas: g,
      fase: parseInt(g) <= 2 ? 'A' : parseInt(g) <= 4 ? 'B' : 'C',
      tahunPelajaran: tp,
      alokasiWaktuTiapMinggu: '4 JP / Pekan'
    },
    ganjil: makeSemesterData(1),
    genap: makeSemesterData(2),
    keterangan: 'L = Libur/MPLS/Asesmen. Angka 4 = Alokasi 4 JP pada pekan efektif KBM.',
    tanggalDokumen: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    kepalaSekolah: 'Kepala Sekolah SD',
    guruMapel: 'Guru PJOK'
  };
}

function getFallbackSlides(topic: any, grade: any, totalSlides: any, reqBody?: any) {
  const t = topic || reqBody?.topikMateri || 'Pembelajaran PJOK SD';
  const g = grade || reqBody?.kelas || '1';
  const mp = reqBody?.mataPelajaran || 'PJOK';
  const f = reqBody?.fase || 'A';
  const count = parseInt(totalSlides || reqBody?.jumlahSlide) || 5;
  const slides = [];

  slides.push({
    slideNo: 1,
    layoutType: 'title_slide',
    title: t,
    points: [`Mata Pelajaran: ${mp} Kelas ${g} SD`, 'Kurikulum Merdeka', 'Selamat Belajar & Salam Olahraga!'],
    speakerNotes: 'Buka sesi dengan salam hangat dan motivasi semangat bergerak.',
    visualRecommendation: 'Visual anak SD gembira berolahraga di lapangan sekolah'
  });
  slides.push({
    slideNo: 2,
    layoutType: 'content_slide',
    title: 'Tujuan Pembelajaran Hari Ini',
    points: [
      `Memahami konsep dasar ${t}`,
      'Mempraktikkan teknik gerakan dengan aman',
      'Menjaga kekompakan dan disiplin kelompok'
    ],
    speakerNotes: 'Jelaskan tujuan utama yang ingin dicapai selama pembelajaran.',
    visualRecommendation: 'Ikon target dan anak-anak bekerja sama'
  });
  for (let i = 3; i <= count; i++) {
    slides.push({
      slideNo: i,
      layoutType: 'content_slide',
      title: `Materi & Langkah Latihan #${i - 2}`,
      points: [
        'Lakukan pemanasan fisik secukupnya',
        `Praktekkan variasi gerakan ${t}`,
        'Saling memberikan dukungan antar teman'
      ],
      speakerNotes: 'Arahkan siswa ke area praktik lapangan.',
      visualRecommendation: 'Diorama lapangan dan anak-anak melakukan gerakan fisik'
    });
  }
  return {
    identitas: {
      mataPelajaran: mp,
      kelas: g,
      fase: f,
      topikMateri: t,
      jumlahSlide: String(count),
      gayaDesain: reqBody?.gayaDesain || 'Sederhana & Minimalis',
      tanggalDokumen: reqBody?.tanggalDokumen || new Date().toLocaleDateString('id-ID'),
      guruPenyusun: reqBody?.guruPenyusun || 'Guru PJOK'
    },
    slides
  };
}

function getFallbackRPM(grade: any, materi: any, semester: any) {
  const g = grade || '1';
  const m = materi || 'Deep Learning PJOK';
  const sem = semester || '1';
  return {
    identitas: {
      mataPelajaran: 'PJOK',
      kelas: `Kelas ${g}`,
      semester: `Semester ${sem}`,
      materiPokok: m,
      alokasiWaktu: '8 Pertemuan (16 x 35 Menit)'
    },
    capaianPembelajaran: `Peserta didik mampu mempraktikkan dan menganalisis ${m} melalui pendekatan Deep Learning (Mindful, Meaningful, Joyful Learning).`,
    semuaPertemuan: Array.from({ length: 8 }, (_, idx) => ({
      pertemuanKe: idx + 1,
      topikSpesifik: `Pertemuan ${idx + 1}: Eksplorasi & Praktik ${m}`,
      fokusMendalam: 'Mindful (Berkesadaran) & Joyful (Menggembirakan)',
      kegiatanAwal: 'Sapa, Doa, Pemanasan Games Edukatif.',
      kegiatanInti: 'Demonstrasi teknik, latihan terstruktur, permainan kelompok.',
      kegiatanPenutup: 'Pendinginan, Refleksi Bermakna, Doa.'
    })),
    identifikasiDeepLearning: 'Mengintegrasikan olah pikir, olah rasa, olah raga, dan olah karsa secara harmonis.',
    desainPengalamanBelajar: 'Siswa terlibat aktif dalam eksplorasi langsung di lapangan dan berdiskusi kelompok.',
    evaluasiAsesmen: 'Asesmen Formatif (Pengamatan Gerak) & Asesmen Sumatif (Keterampilan Gerak).',
    tandaTangan: {
      mengetahuiKepalaSekolah: 'Kepala Sekolah SD',
      guruPenyusun: 'Guru PJOK'
    },
    lampiran: 'Rubrik Penilaian & Lembar Observasi Sikap',
    lkpdList: ['LKPD 1: Pengenalan Gerak', 'LKPD 2: Tantangan Kelompok']
  };
}

function getFallbackLKPD(reqBody: any) {
  const { mataPelajaran = 'PJOK', kelas = '1', topikMateri = 'Gerak Dasar', guruPenyusun = 'Guru', gayaDesain = 'cute_kids', sekolah = 'SD Negeri' } = reqBody || {};
  return {
    identitas: {
      mataPelajaran,
      kelas: `Kelas ${kelas}`,
      topikMateri,
      guruPenyusun,
      gayaDesain,
      tanggalDokumen: new Date().toLocaleDateString('id-ID'),
      sekolah,
      alokasiWaktu: '2 x 35 Menit'
    },
    judulMenarik: `LKPD Interaktif: ${topikMateri}`,
    sections: [
      {
        sectionTitle: 'A. Petunjuk & Mari Memahami',
        icon: '📌',
        introText: 'Bacalah petunjuk di bawah ini dengan ceria bersama teman-temanmu!',
        contentBlocks: [
          {
            blockType: 'text',
            exactText: `Dalam materi ${topikMateri}, kita belajar bagaimana menggerakkan tubuh dengan aman dan tepat. Pahami setiap gerakan sebelum mempraktikkannya!`
          },
          {
            blockType: 'question',
            questionData: {
              id: 'q1',
              questionText: `Sebutkan 2 hal penting yang harus diperhatikan saat melakukan gerakan ${topikMateri}?`,
              answerBoxStyle: 'rounded_large',
              placeholderText: 'Tuliskan jawabanmu di sini...',
              score: '50'
            }
          }
        ],
        visualDesignTip: 'Sajikan dengan kotak berwarna lembut dan ikon menarik.'
      },
      {
        sectionTitle: 'B. Mari Mengaplikasikan & Bereksplorasi',
        icon: '🎯',
        introText: 'Praktikkan gerakan di bawah ini bersama kelompokmu!',
        contentBlocks: [
          {
            blockType: 'question',
            questionData: {
              id: 'q2',
              questionText: 'Ceritakan pengalamanmu saat mempraktikkan gerakan ini di lapangan!',
              answerBoxStyle: 'dotted_box',
              placeholderText: 'Tuliskan pengalaman menyenangkanmu...',
              score: '50'
            }
          }
        ],
        visualDesignTip: 'Beri ruang kotak bergaris putus-putus untuk jawaban siswa.'
      }
    ],
    penutupMotivasi: 'Luar biasa! Kamu telah menyelesaikan LKPD ini dengan semangat tinggi! Tetap rajin berolahraga ya!',
    selfReflectionChecklist: [
      'Saya sudah melakukan pemanasan sebelum praktik.',
      'Saya dapat mempraktikkan gerakan dengan aman.',
      'Saya bekerja sama dengan baik bersama teman.'
    ]
  };
}

function getFallbackCover(reqBody: any) {
  const { judul = 'MODUL AJAR PJOK', subJudul = '', mataPelajaran = 'PJOK', kelas = '1', semester = '1', tahunAjaran = '2024/2025', disusunOleh = 'Guru PJOK', namaSekolah = 'SD Negeri' } = reqBody || {};
  return {
    judulUtama: judul,
    subJudulKreatif: subJudul || `Perencanaan Pembelajaran Kurikulum Merdeka - ${mataPelajaran}`,
    taglineSekolah: 'Mewujudkan Generasi Sehat, Cerdas, Berkarakter, dan Berani',
    kutipanMotivasi: 'Di dalam tubuh yang sehat terdapat jiwa yang kuat.',
    sumberKutipan: 'Peribahasa Bijak',
    detailDokumen: {
      jenisDokumen: 'Dokumen Perencanaan Pembelajaran',
      mataPelajaran,
      kelasFase: `Kelas ${kelas}`,
      semester: `Semester ${semester}`,
      tahunAjaran
    },
    informasiPenyusun: {
      namaPenyusun: disusunOleh,
      nipKeterangan: 'Guru Mata Pelajaran',
      jabatan: 'Guru PJOK'
    },
    instansi: {
      namaSekolah,
      dinasPendidikan: 'Dinas Pendidikan Kabupaten/Kota',
      kotaKabupaten: 'Indonesia'
    },
    gayaVisual: {
      rekomendasiWarnaBg: 'emerald',
      borderStyle: 'double_classic',
      patternDescription: 'Frame bingkai elegan dengan ornamen garis ganda yang rapi',
      hiasanSudut: 'Ornamen sudut klasik simetris'
    }
  };
}

function getFallbackWorkload(reqBody: any) {
  const { teacherName = 'Guru PJOK', schoolName = 'SD Negeri', weeklyJpTarget = 24 } = reqBody || {};
  return {
    summaryStatus: `Analisis beban kerja mengajar untuk ${teacherName} di ${schoolName}.`,
    certificationStatus: 'MEMENUHI',
    certificationExplanation: `Beban mengajar dan ekuivalensi tugas tambahan telah memenuhi syarat minimal ${weeklyJpTarget} JP per pekan sesuai Permendikbud No. 15 Tahun 2018.`,
    strengths: [
      'Distribusi jam mengajar merata di setiap tingkat kelas.',
      'Memiliki tugas tambahan yang mendukung ekuivalensi jam mengajar (misal: Pembina Pramuka / Ekskul).'
    ],
    challenges: [
      'Aktivitas di lapangan menguras energi fisik cukup tinggi.',
      'Manajemen waktu antara persiapan materi praktik dan administrasi.'
    ],
    recommendations: [
      'Lakukan istirahat teratur dan konsumsi air putih yang cukup saat mengajar di lapangan.',
      'Gunakan modul ajar dan rubrik digital untuk menghemat waktu penyusunan administrasi.',
      'Optimalkan tugas tambahan ekuivalensi untuk menjaga stabilitas TPG sertifikasi.'
    ],
    weeklyDistributionChartData: [
      { day: 'Senin', hours: 5, intensity: 'Sedang' },
      { day: 'Selasa', hours: 6, intensity: 'Tinggi' },
      { day: 'Rabu', hours: 5, intensity: 'Sedang' },
      { day: 'Kamis', hours: 4, intensity: 'Sedang' },
      { day: 'Jumat', hours: 4, intensity: 'Ringan' }
    ]
  };
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. Generate Modul Ajar (Kurikulum Merdeka PJOK SD)
app.post('/api/generate-modul', async (req, res) => {
  try {
    const { grade, materi, alokasiWaktu } = req.body;
    if (!grade || !materi) {
      return res.status(400).json({ error: 'Grade dan Materi harus diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Buatkan Modul Ajar PJOK SD Kurikulum Merdeka yang lengkap, mendetail, dan profesional dalam Bahasa Indonesia.
Kelas: ${grade} SD
Materi Pokok: ${materi}
Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit (1 Pertemuan)'}

Modul Ajar harus disesuaikan dengan tingkat perkembangan anak SD kelas ${grade} secara aman dan menyenangkan.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah asisten pakar kurikulum PJOK Sekolah Dasar Kurikulum Merdeka yang premium dan berpengalaman di Indonesia. Anda bertugas menyusun Modul Ajar berkualitas tinggi dengan detail lengkap, bukan sekadar rangkuman. Format output harus selalu dalam bentuk JSON terstruktur sesuai schema yang diminta.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Judul Modul Ajar yang menarik, misal: Variasi Gerak Dasar Lokomotor Lompat',
            },
            materiPokok: {
              type: Type.STRING,
              description: 'Detail materi pokok yang diajarkan',
            },
            alokasiWaktu: {
              type: Type.STRING,
              description: 'Alokasi waktu pembelajaran, misal: 2 x 35 Menit',
            },
            tujuanPembelajaran: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Min 3 tujuan pembelajaran spesifik mencakup aspek Kognitif, Psikomotor, dan Afektif',
            },
            kegiatanPembelajaran: {
              type: Type.OBJECT,
              properties: {
                pendahuluan: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Alur pendahuluan pembelajaran: sapa, absen, doa, pemanasan menarik/game ringan selama 10-15 menit',
                },
                inti: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Alur kegiatan inti secara bertahap: demonstrasi, latihan individu, latihan kelompok, game modifikasi berorientasi kebugaran jasmani secara mendalam',
                },
                penutup: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Alur penutup: pendinginan (cooling down), refleksi bersama, evaluasi gerakan, motivasi, doa penutup',
                },
              },
              required: ['pendahuluan', 'inti', 'penutup'],
            },
            saranaPrasarana: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Alat dan sarana prasarana yang dibutuhkan (misal: cone, peluit, bola, matras)',
            },
            rubrikPenilaian: {
              type: Type.STRING,
              description: 'Kriteria penilaian performa gerakan fisik anak (Kategori Sangat Baik, Cukup, dan Perlu Bimbingan)',
            },
          },
          required: [
            'title',
            'materiPokok',
            'alokasiWaktu',
            'tujuanPembelajaran',
            'kegiatanPembelajaran',
            'saranaPrasarana',
            'rubrikPenilaian',
          ],
        },
      },
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Modul Ajar, using offline generator:', error?.message);
    const fallback = getFallbackModul(req.body?.grade, req.body?.materi, req.body?.alokasiWaktu);
    res.json(fallback);
  }
});

// 2. Generate Rubrik Penilaian Fisik (Keterampilan Gerak)
app.post('/api/generate-rubrik', async (req, res) => {
  try {
    const { materi, kategori } = req.body;
    if (!materi) {
      return res.status(400).json({ error: 'Materi harus diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Buatkan rubrik penilaian keterampilan gerak PJOK SD yang mendetail untuk materi berikut:
Materi: ${materi}
Kategori Olahraga: ${kategori || 'Umum'}

Berikan 3 indikator penilaian fisik utama dengan kriteria pencapaian (Bagus/Mahir, Cukup/Layak, dan Kurang/Perlu Bimbingan) yang spesifik secara gerakan fisik (bukan sekadar kata umum).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar penilai atletik & olahraga SD di Indonesia. Susun rubrik penilaian yang sangat objektif dan berbasis gerak motorik anak. Format output harus selalu dalam JSON terstruktur sesuai schema yang diminta.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            materi: { type: Type.STRING },
            kategori: { type: Type.STRING },
            indikator: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nama: { type: Type.STRING, description: 'Nama Indikator Gerakan, misal: Sikap Ayunan Lengan' },
                  kriteriaBagus: { type: Type.STRING, description: 'Deskripsi gerakan yang sempurna/bagus' },
                  kriteriaCukup: { type: Type.STRING, description: 'Deskripsi gerakan yang cukup baik namun ada kekurangan' },
                  kriteriaKurang: { type: Type.STRING, description: 'Deskripsi gerakan yang kurang atau tidak sesuai teknik dasar' },
                },
                required: ['nama', 'kriteriaBagus', 'kriteriaCukup', 'kriteriaKurang'],
              },
            },
          },
          required: ['materi', 'kategori', 'indikator'],
        },
      },
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    // fallback jika schema key ada kesalahan ketik sedikit
    let text = response.text.trim();
    // ganti kcriteriaCukup ke kriteriaCukup jika model salah ketik
    text = text.replace(/"kcriteriaCukup"/g, '"kriteriaCukup"');
    
    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Rubrik, using offline generator:', error?.message);
    const fallback = getFallbackRubrik(req.body?.materi, req.body?.kategori);
    res.json(fallback);
  }
});

// 3. Generate Bank Soal Evaluasi PJOK (Kognitif)
app.post('/api/generate-soal', async (req, res) => {
  try {
    const { grade, materi, totalSoal } = req.body;
    if (!grade || !materi) {
      return res.status(400).json({ error: 'Grade dan Materi harus diisi.' });
    }

    const count = parseInt(totalSoal) || 5;
    const ai = getAiClient();
    const prompt = `Buatkan ${count} soal pilihan ganda (PG) PJOK SD untuk:
Kelas: ${grade} SD
Materi: ${materi}

Sertakan 4 pilihan jawaban (A, B, C, D), kunci jawaban yang benar, serta penjelasan singkat kenapa jawaban tersebut benar. Pertanyaan harus sesuai dengan kemampuan kognitif anak SD Kelas ${grade}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah penyusun soal ujian nasional/sekolah dasar PJOK terkemuka di Indonesia. Buat soal kognitif yang menguji pemahaman aturan permainan, manfaat kesehatan, pola hidup sehat, atau dasar gerakan. Format output harus selalu dalam JSON terstruktur sesuai schema yang diminta.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: 'Pertanyaan PJOK' },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '4 pilihan jawaban dimulai dari A, B, C, D (misal: "A. Mengoper bola")'
                  },
                  correctAnswer: { type: Type.STRING, description: 'Kunci jawaban yang benar (misal: "A")' },
                  explanation: { type: Type.STRING, description: 'Penjelasan ilmiah/praktis yang ramah anak kenapa jawaban tersebut benar' }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Soal, using offline generator:', error?.message);
    const fallback = getFallbackSoal(req.body?.grade, req.body?.materi, req.body?.totalSoal);
    res.json(fallback);
  }
});

// 3b. Generate Soal Sumatif & Kartu Soal
app.post('/api/generate-soal-sumatif', async (req, res) => {
  try {
    const {
      jenisUjian = 'Asesmen Sumatif Akhir Semester (SAS)',
      mataPelajaran = 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
      grade = '4',
      semester = 'Ganjil',
      tahunPelajaran = '2026/2027',
      babMateri,
      bentukSoal = 'pilihan_ganda',
      levelKognitif = 'campuran',
      totalSoal = '5',
      namaSekolah = 'SD Negeri Pintar Bersama',
      dinasPendidikan = 'Dinas Pendidikan Pemuda Dan Olahraga'
    } = req.body;

    if (!babMateri) {
      return res.status(400).json({ error: 'Bab / Materi Pembelajaran wajib diisi.' });
    }

    const count = parseInt(totalSoal) || 5;

    let bentukInstruction = '';
    if (bentukSoal === 'pilihan_ganda') {
      bentukInstruction = `Semua soal harus bertipe Pilihan Ganda (PG) dengan 4 opsi (A, B, C, D).`;
    } else if (bentukSoal === 'isian') {
      bentukInstruction = `Semua soal harus bertipe Isian Singkat yang memerlukan jawaban kata atau frasa pendek terarah.`;
    } else if (bentukSoal === 'uraian') {
      bentukInstruction = `Semua soal harus bertipe Uraian / Esai yang memerlukan jawaban penjelasan sistematis dan argumentatif.`;
    } else {
      bentukInstruction = `Kombinasikan jenis soal (misal: sebagian Pilihan Ganda, sebagian Isian, sebagian Uraian) dengan proporsional untuk total ${count} soal.`;
    }

    let levelInstruction = '';
    if (levelKognitif === 'lots') {
      levelInstruction = `Semua soal berfokus pada Level Kognitif Rendah / LOTS (Level 1 - C1 Mengingat / C2 Memahami).`;
    } else if (levelKognitif === 'mots') {
      levelInstruction = `Semua soal berfokus pada Level Kognitif Sedang / MOTS (Level 2 - C3 Menerapkan/Mengaplikasikan).`;
    } else if (levelKognitif === 'hots') {
      levelInstruction = `Semua soal berfokus pada Level Kognitif Tinggi / HOTS (Level 3 - C4 Menganalisis / C5 Mengevaluasi / C6 Mengkreasi) yang membutuhkan analisis situasi kontekstual, studi kasus, atau penalaran kritis murid.`;
    } else {
      levelInstruction = `Campurkan Level Kognitif secara variatif (LOTS, MOTS, dan HOTS) agar mencerminkan distribusi evaluasi yang berimbang.`;
    }

    const prompt = `Anda adalah seorang ahli penyusun evaluasi dan pembuat Kartu Soal standar Kementerian Pendidikan Indonesia yang berpengalaman tinggi.
Buatkan ${count} soal evaluasi untuk asesmen sumatif PJOK Sekolah Dasar.

Informasi Identitas Ujian:
- Jenis Ujian: ${jenisUjian}
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${grade} SD
- Semester: Semester ${semester}
- Tahun Pelajaran: ${tahunPelajaran}
- Bab / Topik Pembelajaran: ${babMateri}
- Nama Sekolah: ${namaSekolah}
- Dinas Pendidikan: ${dinasPendidikan}

Spesifikasi Soal:
- Jumlah Soal: ${count}
- Bentuk Soal: ${bentukSoal} (${bentukInstruction})
- Level Kognitif Target: ${levelKognitif} (${levelInstruction})

Tugas Anda:
Untuk setiap butir soal, buatlah data lengkap yang mencakup:
1. "noSoal": Nomor soal berurutan dimulai dari 1.
2. "bentukSoal": "Pilihan Ganda", "Isian Singkat", atau "Uraian" sesuai bentuknya.
3. "levelKognitif": Contoh: "Level 1 (C1 - Mengingat)", "Level 2 (C3 - Menerapkan)", atau "Level 3 (C4 - Menganalisis)".
4. "capaianPembelajaran": Rumusan Capaian Pembelajaran (CP) atau Alur Tujuan Pembelajaran (ATP) kurikulum Merdeka yang relevan untuk materi tersebut di Kelas ${grade} SD.
5. "indikatorSoal": Rumusan indikator soal yang spesifik dan operasional menggambarkan bagaimana stimulus soal diberikan dan apa yang diukur (contoh: "Disajikan gambar situasi permainan, siswa dapat mendiagnosis gerak manipulatif yang tepat...").
6. "question": Teks pertanyaan yang jelas, lugas, dan sesuai kaidah tata bahasa Indonesia yang baik dan benar. Jika Pilihan Ganda, pastikan pilihan jawabannya logis.
7. "options": Jika bentuk soal adalah Pilihan Ganda, sertakan 4 opsi (A, B, C, D) lengkap dengan label hurufnya (contoh: ["A. Berlari cepat", "B. Melompat jauh", ...]). Jika bentuk soal Isian atau Uraian, kosongkan array ini (isi []).
8. "correctAnswer": Kunci jawaban yang tepat. Jika PG berupa huruf (contoh: "A"). Jika Isian berupa kata kunci jawaban (contoh: "Non-lokomotor"). Jika Uraian berupa rangkuman jawaban ideal atau poin kunci jawaban.
9. "explanation": Penjelasan ilmiah, logis, dan edukatif mengapa jawaban tersebut benar, disesuaikan dengan psikologi anak SD kelas ${grade}.
10. "pedomanPenskoran": Panduan penskoran atau kriteria skor untuk butir soal tersebut. Contoh PG: "Skor 1 jika benar, skor 0 jika salah." Contoh Isian: "Skor 2 jika jawaban tepat, 0 jika salah." Contoh Uraian: "Skor maksimal 5 dengan rincian: menyebutkan 3 hal secara runtut (skor 5), menyebutkan 2 hal (skor 3), dst."

Format output wajib berupa JSON terstruktur yang valid sesuai schema berikut. Jangan ada teks penjelasan markdown tambahan di luar blok JSON.`;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar penulisan soal evaluasi standar nasional serta pembuatan instrumen kartu soal Kurikulum Merdeka yang ahli dalam menghasilkan instrumen evaluasi yang akurat, berbobot, dan sesuai standar administrasi sekolah di Indonesia dalam format JSON.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            judulUjian: { type: Type.STRING },
            kop: {
              type: Type.OBJECT,
              properties: {
                dinasPendidikan: { type: Type.STRING },
                namaSekolah: { type: Type.STRING },
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                semester: { type: Type.STRING },
                tahunPelajaran: { type: Type.STRING }
              },
              required: ['dinasPendidikan', 'namaSekolah', 'mataPelajaran', 'kelas', 'semester', 'tahunPelajaran']
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  noSoal: { type: Type.INTEGER },
                  bentukSoal: { type: Type.STRING },
                  levelKognitif: { type: Type.STRING },
                  capaianPembelajaran: { type: Type.STRING },
                  indikatorSoal: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  pedomanPenskoran: { type: Type.STRING }
                },
                required: ['noSoal', 'bentukSoal', 'levelKognitif', 'capaianPembelajaran', 'indikatorSoal', 'question', 'options', 'correctAnswer', 'explanation', 'pedomanPenskoran']
              }
            }
          },
          required: ['judulUjian', 'kop', 'questions']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon dari model AI.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Summative, using offline generator:', error?.message);
    const fallback = getFallbackSummative(req.body?.grade, req.body?.babMateri);
    res.json(fallback);
  }
});

// 3c. Analisis KKO Taksonomi Bloom & SOLO
app.post('/api/analyze-kko', async (req, res) => {
  try {
    const { tujuanPembelajaran, mataPelajaran = 'Pendidikan Jasmani, Olahraga, dan Kesehatan', grade = '4' } = req.body;
    if (!tujuanPembelajaran) {
      return res.status(400).json({ error: 'Tujuan Pembelajaran wajib diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Anda adalah pakar penulisan Kurikulum Merdeka dan Ahli Taksonomi Pendidikan (Bloom Revisi Anderson & SOLO Taxonomy).
Analisis Tujuan Pembelajaran (TP) berikut untuk Kelas ${grade} SD pada mata pelajaran ${mataPelajaran}:
TP Guru: "${tujuanPembelajaran}"

Tugas Anda:
1. Analisis tingkat kognitif TP tersebut berdasarkan Taksonomi Bloom (Revisi Anderson): C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), atau C6 (Mengkreasi). Tentukan kata kerja operasional (KKO) yang terdeteksi, berikan deskripsi kekuatan TP, serta rekomendasi perbaikan.
2. Analisis TP tersebut berdasarkan Taksonomi SOLO (Structure of Observed Learning Outcomes): Prestructural, Unistructural, Multistructural, Relational, atau Extended Abstract. Berikan penjelasan singkat tingkat SOLO dan rekomendasi peningkatan.
3. Berikan 4 rekomendasi rumusan TP alternatif yang lebih terstruktur dengan variasi tingkat kognitif:
   - Alternatif 1: Berfokus pada LOTS (C1/C2 atau Unistructural)
   - Alternatif 2: Berfokus pada MOTS (C3 atau Multistructural)
   - Alternatif 3: Berfokus pada HOTS (C4/C5/C6 atau Relational/Extended Abstract)
   - Alternatif 4: Rumusan ideal gabungan yang mencakup Kompetensi (KKO yang terukur) + Konten (Materi) + Variasi/Konteks nyata anak SD kelas ${grade}.
4. Untuk setiap alternatif, berikan usulan Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) yang operasional.

Sajikan dalam bentuk JSON terstruktur sesuai skema berikut tanpa penjelasan markdown tambahan di luar blok JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar kurikulum dan evaluasi pendidikan yang ahli dalam menganalisis serta merumuskan Alur Tujuan Pembelajaran menggunakan Taksonomi Bloom dan SOLO secara akurat dan berkualitas dalam format JSON.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalObjective: { type: Type.STRING },
            bloomAnalysis: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING },
                verba: { type: Type.STRING },
                description: { type: Type.STRING },
                strength: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ['level', 'verba', 'description', 'strength', 'recommendation']
            },
            soloAnalysis: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING },
                description: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ['level', 'description', 'recommendation']
            },
            suggestedObjectives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING },
                  taxonomyLevel: { type: Type.STRING },
                  text: { type: Type.STRING },
                  kko: { type: Type.STRING },
                  kktpSuggested: { type: Type.STRING }
                },
                required: ['level', 'taxonomyLevel', 'text', 'kko', 'kktpSuggested']
              }
            }
          },
          required: ['originalObjective', 'bloomAnalysis', 'soloAnalysis', 'suggestedObjectives']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon dari model AI.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for KKO Analysis, using offline generator:', error?.message);
    const fallback = getFallbackKKO(req.body?.tujuanPembelajaran);
    res.json(fallback);
  }
});

// 3d. Generate Ulangan Harian & Praktik Per Tujuan Pembelajaran (TP)
app.post('/api/generate-ulangan', async (req, res) => {
  try {
    const { tujuanPembelajaran, tipeUlangan, grade = '4', mataPelajaran = 'Pendidikan Jasmani, Olahraga, dan Kesehatan', jumlahSoal = 5 } = req.body;
    
    if (!tujuanPembelajaran || !tipeUlangan) {
      return res.status(400).json({ error: 'Tujuan Pembelajaran dan Tipe Ulangan wajib diisi.' });
    }

    const ai = getAiClient();
    let prompt = '';

    if (tipeUlangan === 'tulis') {
      prompt = `Anda adalah seorang ahli penyusun instrumen penilaian/evaluasi hasil belajar SD (Kurikulum Merdeka).
Buatkan instrumen **Ulangan Harian Tulis** yang bermutu tinggi, berbobot, kontekstual, dan sesuai dengan perkembangan kognitif anak usia SD kelas ${grade}.

Detail Acuan:
- Mata Pelajaran: ${mataPelajaran}
- Tujuan Pembelajaran (TP): "${tujuanPembelajaran}"
- Tingkat/Kelas: Kelas ${grade} SD
- Jumlah Soal Pilihan Ganda: ${jumlahSoal} soal (masing-masing 4 opsi pilihan: A, B, C, D)
- Jumlah Soal Essay/Uraian: 2-3 soal esai reflektif/penerapan nyata.

Tugas Anda:
1. Buat Kop Judul yang profesional.
2. Buatkan ${jumlahSoal} soal pilihan ganda yang bervariasi dari LOTS hingga HOTS sesuai dengan TP tersebut. Pastikan opsi jawaban homogen dan logis. Berikan penjelasan ringkas serta kunci jawaban.
3. Buatkan 2 soal uraian/essay yang merangsang daya nalar siswa, lengkap dengan kunci/ekspetasi jawaban serta skor maksimal masing-masing soal.
4. Tuliskan panduan singkat penskoran/rubrik penilaian nilai akhir (misalnya Bobot PG 60% dan Essay 40%).

Sajikan dalam bentuk JSON terstruktur sesuai skema respon yang ditentukan.`;
    } else {
      prompt = `Anda adalah ahli penyusun instrumen penilaian/evaluasi psikomotorik dan kinerja unjuk kerja (performance assessment) di Sekolah Dasar.
Buatkan instrumen **Ulangan Harian Praktik (Unjuk Kerja/Kinerja)** yang aman, terukur, objektif, dan sangat mudah diterapkan untuk mengukur pencapaian siswa pada TP berikut:

Detail Acuan:
- Mata Pelajaran: ${mataPelajaran}
- Tujuan Pembelajaran (TP): "${tujuanPembelajaran}"
- Tingkat/Kelas: Kelas ${grade} SD
- Tipe Penilaian: Penilaian Kinerja Psikomotor (Praktik Fisik / Keterampilan)

Tugas Anda:
1. Buat judul instrumen yang profesional.
2. Formulasikan serangkaian instruksi tugas praktik (task instructions) langkah-demi-langkah bagi siswa yang aman, konkret, dan ramah anak SD kelas ${grade}.
3. Buatkan rubrik penilaian unjuk kerja terperinci yang mencakup minimal 3 kriteria/aspek penilaian yang relevan dengan TP tersebut (misal untuk PJOK: Sikap Awalan/Persiapan, Sikap Pelaksanaan, dan Sikap Akhiran/Hasil Gerakan). Untuk setiap aspek, jabarkan deskriptor deskriptif yang jelas untuk skala skor:
   - Skor 4: Sangat Baik (mandiri, akurat, konsisten)
   - Skor 3: Baik (lancar, sedikit kesalahan teknis, mandiri)
   - Skor 2: Cukup (memerlukan bimbingan/intervensi kecil, kurang konsisten)
   - Skor 1: Perlu Bimbingan (kesulitan melakukan gerakan, membutuhkan pengawasan penuh)
4. Buatkan rumus pedoman penskoran akhir yang aplikatif bagi guru.

Sajikan dalam bentuk JSON terstruktur sesuai skema respon yang ditentukan.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar penilai kurikulum SD Kurikulum Merdeka yang menyusun soal ujian tulis atau instrumen ujian praktik secara komprehensif dalam format JSON.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            tujuanPembelajaran: { type: Type.STRING },
            materi: { type: Type.STRING },
            grade: { type: Type.STRING },
            tipeUlangan: { type: Type.STRING },
            // For written test (tulis)
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.INTEGER },
                  questionText: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ['number', 'questionText', 'options', 'correctAnswer', 'explanation']
              }
            },
            essayQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.INTEGER },
                  questionText: { type: Type.STRING },
                  expectedAnswer: { type: Type.STRING },
                  scoreMax: { type: Type.INTEGER }
                },
                required: ['number', 'questionText', 'expectedAnswer', 'scoreMax']
              }
            },
            // For practical test (praktik)
            taskInstructions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            rubricCriteria: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  criteriaName: { type: Type.STRING },
                  skor4: { type: Type.STRING },
                  skor3: { type: Type.STRING },
                  skor2: { type: Type.STRING },
                  skor1: { type: Type.STRING }
                },
                required: ['criteriaName', 'skor4', 'skor3', 'skor2', 'skor1']
              }
            },
            scoringFormula: { type: Type.STRING },
            gradingGuide: { type: Type.STRING }
          },
          required: ['title', 'tujuanPembelajaran', 'materi', 'grade', 'tipeUlangan', 'questions', 'essayQuestions', 'taskInstructions', 'rubricCriteria', 'scoringFormula', 'gradingGuide']
        }
      }
    });

    if (!response.text) {
      throw new Error('Gagal mendapatkan instrumen ulangan dari AI.');
    }

    const testData = JSON.parse(response.text.trim());
    res.json(testData);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Daily Test, using offline generator:', error?.message);
    const fallback = getFallbackDailyTest(req.body?.grade, req.body?.tujuanPembelajaran || 'Ulangan Harian');
    res.json(fallback);
  }
});

// 4. Generate ATP & KKTP (Capaian Pembelajaran PJOK SD)
app.post('/api/generate-atp', async (req, res) => {
  try {
    const { phase, element, cpText, materiSpesifik, saranaSpesifik } = req.body;
    if (!phase || !element) {
      return res.status(400).json({ error: 'Fase dan Elemen harus diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Buatkan Alur Tujuan Pembelajaran (ATP) dan Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) berbasis Capaian Pembelajaran (CP) PJOK SD Kurikulum Merdeka.
Fase: ${phase}
Elemen: ${element}
CP Referensi: "${cpText || 'Gunakan referensi umum Kurikulum Merdeka untuk elemen ini'}"
Materi Spesifik (Opsional): ${materiSpesifik || 'Umum/Disesuaikan'}
Kondisi Sarana & Prasarana Sekolah (Opsional): ${saranaSpesifik || 'Standar/Halaman Sekolah'}

Tugas Anda:
1. Formulasikan Alur Tujuan Pembelajaran (ATP) sebanyak 3-4 tahap logis terurut.
2. Formulasikan Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) yang aplikatif mencakup deskripsi level penguasaan: Baru Berkembang (BB), Layak (L), dan Mahir (M).
3. Berikan saran metode/pendekatan pembelajaran PJOK yang menyenangkan dan ramah anak.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar penilai dan perancang kurikulum PJOK Sekolah Dasar Kurikulum Merdeka yang sangat berkompeten di Indonesia. Format output harus selalu dalam JSON terstruktur sesuai schema yang diminta.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alurTujuanPembelajaran: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Alur Tujuan Pembelajaran (ATP) berurutan dari dasar ke kompleks'
            },
            kriteriaKetercapaian: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kriteria: { type: Type.STRING, description: 'Nama kriteria keahlian/perilaku, misal: Teknik Dasar Awalan' },
                  baruBerkembang: { type: Type.STRING, description: 'Deskripsi kriteria jika siswa masih Baru Berkembang' },
                  layak: { type: Type.STRING, description: 'Deskripsi kriteria jika siswa sudah Layak / Cukup Mandiri' },
                  mahir: { type: Type.STRING, description: 'Deskripsi kriteria jika siswa sudah Mahir / Sangat Baik' }
                },
                required: ['kriteria', 'baruBerkembang', 'layak', 'mahir']
              },
              description: 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) untuk asesmen'
            },
            metodePembelajaran: {
              type: Type.STRING,
              description: 'Rekomendasi metode/pendekatan mengajar PJOK yang inklusif, aman, dan game-based'
            }
          },
          required: ['alurTujuanPembelajaran', 'kriteriaKetercapaian', 'metodePembelajaran']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for ATP, using offline generator:', error?.message);
    const fallback = getFallbackATP(req.body?.phase, req.body?.element || req.body?.materiSpesifik);
    res.json(fallback);
  }
});

// 4a. Generate Konversi/Formulasi CP ke TP (Capaian Pembelajaran ke Tujuan Pembelajaran)
app.post('/api/generate-cp-to-tp', async (req, res) => {
  try {
    const { fase, kelas, elemen, cpText, materiSpesifik, pendekatanFormat } = req.body;
    if (!fase || !elemen) {
      return res.status(400).json({ error: 'Fase dan Elemen wajib diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Formulasikan Capaian Pembelajaran (CP) menjadi Tujuan Pembelajaran (TP) terukur untuk mata pelajaran PJOK Sekolah Dasar Kurikulum Merdeka.

Data Input:
- Fase: ${fase || 'Fase A / B / C'}
- Target Kelas: ${kelas || 'Disesuaikan dengan Fase'}
- Elemen PJOK: ${elemen}
- Teks Capaian Pembelajaran (CP) Asli: "${cpText || 'Gunakan referensi CP Kurikulum Merdeka PJOK resmi'}"
- Topik / Materi Spesifik (Opsional): ${materiSpesifik || 'Umum (Pola Gerak Dasar & Kebugaran)'}
- Format Pendekatan: ${pendekatanFormat || 'Standar Kurikulum Merdeka (Kompetensi + Lingkup Materi)'}

Tugas Anda:
1. Dekonstruksi CP menjadi:
   - Kompetensi Utama (Kata Kerja Operasional / KKO Bloom-SOLO yang relevan)
   - Lingkup Materi Utama (Content Scope PJOK)
   - Variasi Karakteristik Peserta Didik SD
2. Formulasikan 3 - 5 Tujuan Pembelajaran (TP) yang logis, sistematis, hirarkis, serta dapat diukur (measurable) dari CP tersebut.
3. Untuk setiap TP, berikan:
   - Kode TP (misal: TP 1.1, TP 1.2, dst.)
   - Rumusan TP yang jelas dan berorientasi pada peserta didik
   - Identifikasi Kompetensi (KKO)
   - Lingkup Materi spesifik
   - Indikator Ketercapaian TP (IKTP) minimal 2-3 poin
   - Dimensi Profil Pelajar Pancasila (P3)
   - Target Kelas & Semester
   - Alokasi Waktu (JP)
   - Rekomendasi Asesmen PJOK (Tes Unjuk Kerja / Pengetahuan / Observasi Perilaku)
4. Berikan rekomendasi pendekatan pembelajaran dan catatan bimbingan guru.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar kurikulum PJOK Sekolah Dasar Kurikulum Merdeka yang berpengalaman merumuskan Capaian Pembelajaran (CP) menjadi Tujuan Pembelajaran (TP) yang kontekstual dan berkualitas tinggi. Selalu kembalikan respon berupa JSON sesuai schema yang ditentukan.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fase: { type: Type.STRING },
            kelas: { type: Type.STRING },
            elemen: { type: Type.STRING },
            cpAsli: { type: Type.STRING },
            materiSpesifik: { type: Type.STRING },
            analisisDekonstruksi: {
              type: Type.OBJECT,
              properties: {
                kompetensiUtama: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Daftar KKO / Kompetensi yang terkandung dalam CP'
                },
                lingkupMateriUtama: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Daftar materi / konten utama yang terkandung dalam CP'
                },
                variasiKarakteristikSiswa: { type: Type.STRING, description: 'Catatan karakteristik siswa SD pada fase ini' }
              },
              required: ['kompetensiUtama', 'lingkupMateriUtama', 'variasiKarakteristikSiswa']
            },
            daftarTp: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kodeTp: { type: Type.STRING, description: 'Contoh: TP 1.1' },
                  rumusanTp: { type: Type.STRING, description: 'Rumusan lengkap Tujuan Pembelajaran' },
                  kompetensiKko: { type: Type.STRING, description: 'Kompetensi / KKO yang digunakan' },
                  lingkupMateri: { type: Type.STRING, description: 'Lingkup materi spesifik' },
                  indikatorKetercapaian: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Indikator-indikator pencapaian TP (IKTP)'
                  },
                  profilPancasila: { type: Type.STRING, description: 'Profil Pelajar Pancasila yang dikembangkan' },
                  targetKelasSemester: { type: Type.STRING, description: 'Target Kelas & Semester' },
                  alokasiWaktu: { type: Type.STRING, description: 'Alokasi waktu dalam JP' },
                  rekomendasiAsesmen: { type: Type.STRING, description: 'Bentuk/Teknik Asesmen yang cocok' }
                },
                required: [
                  'kodeTp',
                  'rumusanTp',
                  'kompetensiKko',
                  'lingkupMateri',
                  'indikatorKetercapaian',
                  'profilPancasila',
                  'targetKelasSemester',
                  'alokasiWaktu',
                  'rekomendasiAsesmen'
                ]
              },
              description: 'Daftar Tujuan Pembelajaran terformulasi'
            },
            rekomendasiPendekatan: { type: Type.STRING, description: 'Rekomendasi metode/strategi mengajar' },
            catatanPendidik: { type: Type.STRING, description: 'Catatan praktis untuk guru' }
          },
          required: [
            'fase',
            'kelas',
            'elemen',
            'cpAsli',
            'materiSpesifik',
            'analisisDekonstruksi',
            'daftarTp',
            'rekomendasiPendekatan',
            'catatanPendidik'
          ]
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for CP-to-TP, using offline generator:', error?.message);
    const fallback = getFallbackCPTP(req.body?.fase, req.body?.elemen);
    res.json(fallback);
  }
});

// 4b. Generate KKTP (Kriteria Ketercapaian Tujuan Pembelajaran) dengan Interval
app.post('/api/generate-kktp', async (req, res) => {
  try {
    const {
      satuanPendidikan,
      mataPelajaran,
      kelas,
      fase,
      semester,
      tahunPelajaran,
      bab,
      materiPokok,
      deskripsiCp,
      tujuanPembelajaran,
    } = req.body;

    if (!satuanPendidikan || !mataPelajaran || !kelas || !fase || !semester || !tahunPelajaran || !bab || !materiPokok || !deskripsiCp || !tujuanPembelajaran) {
      return res.status(400).json({ error: 'Seluruh input wajib diisi.' });
    }

    let tpList: string[] = [];
    if (Array.isArray(tujuanPembelajaran)) {
      tpList = tujuanPembelajaran;
    } else if (typeof tujuanPembelajaran === 'string') {
      tpList = tujuanPembelajaran.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    if (tpList.length === 0) {
      return res.status(400).json({ error: 'Tujuan Pembelajaran harus memiliki minimal satu kriteria.' });
    }

    const ai = getAiClient();
    const prompt = `Buatkan deskripsi kriteria ketercapaian tujuan pembelajaran (KKTP) untuk setiap Tujuan Pembelajaran berikut berdasarkan materi, kelas, dan fase:
Mata Pelajaran: ${mataPelajaran}
Satuan Pendidikan: ${satuanPendidikan}
Kelas/Fase: Kelas ${kelas} / Fase ${fase}
Semester: ${semester}
Tahun Pelajaran: ${tahunPelajaran}
Bab: ${bab}
Materi Pokok: ${materiPokok}
Deskripsi CP: "${deskripsiCp}"

Daftar Tujuan Pembelajaran (TP):
${tpList.map((tp, idx) => `${idx + 1}. ${tp}`).join('\n')}

Tugas Anda:
Bagi setiap Tujuan Pembelajaran di atas, rumuskan deskripsi kriteria pencapaian konkret yang dibagi menjadi 4 interval nilai:
1. Perlu Bimbingan (0–68): Apa kriteria konkret/kondisi siswa yang menunjukkan mereka berada di tingkat ini untuk TP ini? (Tulis deskripsi konkret yang ringkas dan padat)
2. Cukup (68–78): Apa kriteria konkret/kondisi siswa yang menunjukkan mereka berada di tingkat ini untuk TP ini? (Tulis deskripsi konkret yang ringkas dan padat)
3. Baik (79–89): Apa kriteria konkret/kondisi siswa yang menunjukkan mereka berada di tingkat ini untuk TP ini? (Tulis deskripsi konkret yang ringkas dan padat)
4. Sangat Baik (90–100): Apa kriteria konkret/kondisi siswa yang menunjukkan mereka berada di tingkat ini untuk TP ini? (Tulis deskripsi konkret yang ringkas dan padat)

Pastikan deskripsinya relevan secara motorik/pengetahuan olahraga atau keilmuan mapel tersebut, to-the-point, dan tidak terlalu panjang agar respon cepat dan terhindar dari timeout.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar penilai kurikulum sekolah di Indonesia. Buatkan KKTP interval nilai terstruktur dalam format JSON. Setiap deskripsi interval harus menggambarkan kriteria performa siswa secara konkret dan terukur. Jaga agar setiap deskripsi tetap padat dan ringkas (maksimal 1-2 kalimat per deskripsi) agar respons cepat.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                satuanPendidikan: { type: Type.STRING },
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                fase: { type: Type.STRING },
                semester: { type: Type.STRING },
                tahunPelajaran: { type: Type.STRING },
              },
              required: ['satuanPendidikan', 'mataPelajaran', 'kelas', 'fase', 'semester', 'tahunPelajaran'],
            },
            bab: { type: Type.STRING },
            materiPokok: { type: Type.STRING },
            deskripsiCp: { type: Type.STRING },
            kktpRows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  no: { type: Type.STRING },
                  tujuanPembelajaran: { type: Type.STRING },
                  intervalDeskripsi: {
                    type: Type.OBJECT,
                    properties: {
                      perluBimbingan: { type: Type.STRING, description: 'Deskripsi kriteria interval 0-68' },
                      cukup: { type: Type.STRING, description: 'Deskripsi kriteria interval 68-78' },
                      baik: { type: Type.STRING, description: 'Deskripsi kriteria interval 79-89' },
                      sangatBaik: { type: Type.STRING, description: 'Deskripsi kriteria interval 90-100' },
                    },
                    required: ['perluBimbingan', 'cukup', 'baik', 'sangatBaik'],
                  },
                },
                required: ['no', 'tujuanPembelajaran', 'intervalDeskripsi'],
              },
            },
          },
          required: ['identitas', 'bab', 'materiPokok', 'deskripsiCp', 'kktpRows'],
        },
      },
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for KKTP, using offline generator:', error?.message);
    const fallback = getFallbackKKTP(
      req.body?.kelas,
      req.body?.materiPokok || req.body?.bab,
      req.body?.mataPelajaran
    );
    res.json(fallback);
  }
});

// 4c. Generate Rincian Pekan Efektif (RPE)
app.post('/api/generate-rpe', async (req, res) => {
  try {
    const {
      namaSekolah,
      kelas,
      jpPerMinggu,
      mataPelajaran,
      semester,
      tahunPelajaran,
      catatanTambahan,
    } = req.body;

    if (!namaSekolah || !kelas || !jpPerMinggu || !mataPelajaran || !semester || !tahunPelajaran) {
      return res.status(400).json({ error: 'Seluruh input identitas wajib diisi.' });
    }

    const jpNum = parseInt(jpPerMinggu, 10);
    if (isNaN(jpNum) || jpNum <= 0) {
      return res.status(400).json({ error: 'Jumlah JP per Minggu harus berupa angka positif.' });
    }

    const ai = getAiClient();
    const isGanjil = semester.toLowerCase().includes('ganjil') || semester === '1';
    const bulansList = isGanjil 
      ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
      : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

    const prompt = `Buatkan Dokumen Rincian Pekan Efektif (RPE) Kurikulum Merdeka untuk:
Nama Sekolah: ${namaSekolah}
Kelas: Kelas ${kelas}
Mata Pelajaran: ${mataPelajaran}
Semester: ${semester} (${isGanjil ? 'Ganjil' : 'Genap'})
Tahun Pelajaran: ${tahunPelajaran}
JP Per Minggu/Pekan: ${jpNum} JP
Catatan Tambahan/Kondisi Kalender Akademik: ${catatanTambahan || 'Tidak ada'}

Tugas Anda:
1. Analisis alokasi pekan untuk 6 bulan berikut: ${bulansList.join(', ')}.
2. Untuk setiap bulan, tentukan:
   - Jumlah Pekan (biasanya berkisar 4 atau 5 pekan). Total jumlah pekan satu semester berkisar 25-27 pekan.
   - Pekan Efektif (jumlah pekan di mana KBM efektif berlangsung).
   - Pekan Tidak Efektif (jumlah pekan di mana KBM tidak berlangsung karena libur, asesmen, atau kegiatan khusus).
   - Keterangan (penjelasan singkat mengapa ada pekan tidak efektif, misal: 'Libur Akhir Semester', 'Asesmen Sumatif Akhir', 'Penyerahan Rapor').
3. Tulis daftar 'Pekan Tidak Efektif' secara rinci yang berisi nama kegiatan, durasi pekan, dan penjelasannya.
4. Hitung rekapitulasi:
   - Total Pekan dalam Semester (jumlah dari semua pekan per bulan).
   - Total Pekan Tidak Efektif (jumlah dari seluruh pekan tidak efektif).
   - Total Pekan Efektif = Total Pekan dalam Semester – Total Pekan Tidak Efektif.
   - Total Jam Efektif = Total Pekan Efektif × JP Per Pekan.
5. Rumuskan formula teks:
   - totalPekanEfektifFormula: Formatnya harus seperti "26 Pekan - 6 Pekan = 20 Pekan" (sesuaikan angkanya).
   - totalJamEfektifFormula: Formatnya harus seperti "20 Pekan x 4 JP = 80 JP" (sesuaikan angkanya).
6. Berikan tanggalDokumen yang sesuai (misal: "Ceria, 13 Juli 2026").
7. Berikan catatanAnalisis singkat mengenai rincian kalender pendidikan ini.

Pastikan data yang Anda hasilkan konsisten dan akurat secara matematis!`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar administrasi kurikulum sekolah Indonesia. Susunlah Rincian Pekan Efektif (RPE) dalam format JSON yang valid dan akurat secara matematis. Pastikan total pekan per bulan sesuai dengan akumulasi total pekan keseluruhan, dan rumus perhitungan jam efektif benar. Berikan deskripsi yang padat, profesional, dan realistis untuk kalender akademik Indonesia tahun pelajaran ${tahunPelajaran}.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                namaSekolah: { type: Type.STRING },
                kelas: { type: Type.STRING },
                jpPerMinggu: { type: Type.INTEGER },
                mataPelajaran: { type: Type.STRING },
                semester: { type: Type.STRING },
                tahunPelajaran: { type: Type.STRING },
              },
              required: ['namaSekolah', 'kelas', 'jpPerMinggu', 'mataPelajaran', 'semester', 'tahunPelajaran'],
            },
            alokasiWaktu: {
              type: Type.OBJECT,
              properties: {
                bulans: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      no: { type: Type.INTEGER },
                      bulan: { type: Type.STRING },
                      jumlahPekan: { type: Type.INTEGER },
                      pekanEfektif: { type: Type.INTEGER },
                      pekanTidakEfektif: { type: Type.INTEGER },
                      keterangan: { type: Type.STRING },
                    },
                    required: ['no', 'bulan', 'jumlahPekan', 'pekanEfektif', 'pekanTidakEfektif', 'keterangan'],
                  },
                },
                totalPekan: { type: Type.INTEGER },
                totalPekanEfektif: { type: Type.INTEGER },
                totalPekanTidakEfektif: { type: Type.INTEGER },
              },
              required: ['bulans', 'totalPekan', 'totalPekanEfektif', 'totalPekanTidakEfektif'],
            },
            pekanTidakEfektif: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  no: { type: Type.INTEGER },
                  uraianKegiatan: { type: Type.STRING },
                  jumlahPekan: { type: Type.INTEGER },
                  keterangan: { type: Type.STRING },
                },
                required: ['no', 'uraianKegiatan', 'jumlahPekan', 'keterangan'],
              },
            },
            totalPekanEfektifFormula: { type: Type.STRING },
            totalJamEfektifFormula: { type: Type.STRING },
            totalJamEfektif: { type: Type.INTEGER },
            tanggalDokumen: { type: Type.STRING },
            catatanAnalisis: { type: Type.STRING },
          },
          required: [
            'identitas',
            'alokasiWaktu',
            'pekanTidakEfektif',
            'totalPekanEfektifFormula',
            'totalJamEfektifFormula',
            'totalJamEfektif',
            'tanggalDokumen',
          ],
        },
      },
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for RPE, using offline generator:', error?.message);
    const fallback = getFallbackRPE(
      req.body?.tahunPelajaran,
      req.body?.semester
    );
    res.json(fallback);
  }
});

// 4d. Generate Program Tahunan (PROTA)
app.post('/api/generate-prota', async (req, res) => {
  try {
    const {
      mataPelajaran,
      kelas,
      fase,
      tahunPelajaran,
      totalJp2Semester,
      alokasiWaktuTiapMinggu,
      semester1Weeks,
      semester2Weeks,
      babSemester1,
      babSemester2,
      tujuanPembelajaranRaw,
      rentangProgram = 'full'
    } = req.body;

    if (!mataPelajaran || !kelas || !fase || !tahunPelajaran || !totalJp2Semester || !alokasiWaktuTiapMinggu) {
      return res.status(400).json({ error: 'Seluruh input parameter utama wajib diisi.' });
    }

    const ai = getAiClient();
    
    let prompt = '';
    if (rentangProgram === 'semester_1') {
      prompt = `Buatkan Dokumen Program Semester I (Ganjil) Kurikulum Merdeka (Format Tabel PROTA Ganjil) berdasar parameter berikut:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas}
Fase: Fase ${fase}
Tahun Pelajaran: ${tahunPelajaran}
Total JP Semester 1: ${totalJp2Semester}
Alokasi Waktu per Minggu: ${alokasiWaktuTiapMinggu}
Semester 1 (Ganjil): ${semester1Weeks || '20'} Pekan

Daftar Bab Semester 1:
${babSemester1 || 'Ditentukan otomatis oleh AI'}

Daftar Tujuan Pembelajaran Lengkap (ATP) Semester 1:
${tujuanPembelajaranRaw || 'Ditentukan otomatis berdasar kurikulum nasional'}

Tugas Anda:
1. Susunlah tabel Program untuk Semester I (Ganjil) dalam format data JSON terstruktur.
2. Setiap baris mewakili satu Alur Tujuan Pembelajaran (ATP) khusus untuk Semester I.
3. Kolom yang harus diisi:
   - no: Nomor urut bab dan ATP (contoh: "1.1", "1.2", "2.1", dsb.).
   - bab: Nama bab yang sesuai.
   - tujuanPembelajaran: Tulis ulang kalimat Tujuan Pembelajaran sesuai data di atas dengan presisi (jangan mengubah substansi).
   - materi: Pokok bahasan/sub-materi spesifik yang ditarik dari Tujuan Pembelajaran tersebut.
   - alokasiWaktu: Tuliskan jam pelajaran (contoh: "4 JP", "8 JP") yang disesuaikan dengan kompleksitas materi dan kelipatan alokasi waktu mingguan. Total alokasi waktu JP semua baris harus sinkron dengan total JP semester 1.
   - semester: Tuliskan "I (Ganjil)" secara tepat untuk semua baris.
4. Tentukan tanggalDokumen yang sesuai (misal: "Jakarta, 13 Juli 2026").
5. Tulis nama kepalaSekolah dan guruMapel placeholder jika tidak diisi.

Kembalikan hasil dalam format JSON yang valid.`;
    } else if (rentangProgram === 'semester_2') {
      prompt = `Buatkan Dokumen Program Semester II (Genap) Kurikulum Merdeka (Format Tabel PROTA Genap) berdasar parameter berikut:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas}
Fase: Fase ${fase}
Tahun Pelajaran: ${tahunPelajaran}
Total JP Semester 2: ${totalJp2Semester}
Alokasi Waktu per Minggu: ${alokasiWaktuTiapMinggu}
Semester 2 (Genap): ${semester2Weeks || '21'} Pekan

Daftar Bab Semester 2:
${babSemester2 || 'Ditentukan otomatis oleh AI'}

Daftar Tujuan Pembelajaran Lengkap (ATP) Semester 2:
${tujuanPembelajaranRaw || 'Ditentukan otomatis berdasar kurikulum nasional'}

Tugas Anda:
1. Susunlah tabel Program untuk Semester II (Genap) dalam format data JSON terstruktur.
2. Setiap baris mewakili satu Alur Tujuan Pembelajaran (ATP) khusus untuk Semester II.
3. Kolom yang harus diisi:
   - no: Nomor urut bab dan ATP (contoh: "3.1", "3.2", "4.1", dsb.).
   - bab: Nama bab yang sesuai.
   - tujuanPembelajaran: Tulis ulang kalimat Tujuan Pembelajaran sesuai data di atas dengan presisi (jangan mengubah substansi).
   - materi: Pokok bahasan/sub-materi spesifik yang ditarik dari Tujuan Pembelajaran tersebut.
   - alokasiWaktu: Tuliskan jam pelajaran (contoh: "4 JP", "8 JP") yang disesuaikan dengan kompleksitas materi dan kelipatan alokasi waktu mingguan. Total alokasi waktu JP semua baris harus sinkron dengan total JP semester 2.
   - semester: Tuliskan "II (Genap)" secara tepat untuk semua baris.
4. Tentukan tanggalDokumen yang sesuai (misal: "Jakarta, 13 Juli 2026").
5. Tulis nama kepalaSekolah dan guruMapel placeholder jika tidak diisi.

Kembalikan hasil dalam format JSON yang valid.`;
    } else {
      prompt = `Buatkan Dokumen Program Tahunan (PROTA) Kurikulum Merdeka berdasar parameter berikut:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas}
Fase: Fase ${fase}
Tahun Pelajaran: ${tahunPelajaran}
Total JP 2 Semester: ${totalJp2Semester}
Alokasi Waktu per Minggu: ${alokasiWaktuTiapMinggu}
Semester 1 (Ganjil): ${semester1Weeks || '20'} Pekan
Semester 2 (Genap): ${semester2Weeks || '21'} Pekan

Daftar Bab & Pembagian Semester:
- Bab Semester 1:
${babSemester1 || 'Ditentukan otomatis oleh AI'}

- Bab Semester 2:
${babSemester2 || 'Ditentukan otomatis oleh AI'}

Daftar Tujuan Pembelajaran Lengkap (ATP):
${tujuanPembelajaranRaw || 'Ditentukan otomatis berdasar kurikulum nasional'}

Tugas Anda:
1. Susunlah tabel Program Tahunan (PROTA) dalam format data JSON terstruktur.
2. Setiap baris mewakili satu Alur Tujuan Pembelajaran (ATP).
3. Kolom yang harus diisi:
   - no: Nomor urut bab dan ATP (contoh: "1.1", "1.2", "2.1", dsb.).
   - bab: Nama bab yang sesuai.
   - tujuanPembelajaran: Tulis ulang kalimat Tujuan Pembelajaran sesuai data di atas dengan presisi (jangan mengubah substansi).
   - materi: Pokok bahasan/sub-materi spesifik yang ditarik dari Tujuan Pembelajaran tersebut.
   - alokasiWaktu: Tuliskan jam pelajaran (contoh: "4 JP", "8 JP") yang disesuaikan dengan kompleksitas materi dan kelipatan alokasi waktu mingguan. Total alokasi waktu JP semua baris harus sinkron dengan perkiraan total JP 2 semester.
   - semester: Tuliskan "I (Ganjil)" atau "II (Genap)" secara tepat sesuai pembagian bab.
4. Tentukan tanggalDokumen yang sesuai (misal: "Jakarta, 13 Juli 2026").
5. Tulis nama kepalaSekolah dan guruMapel placeholder jika tidak diisi.

Kembalikan hasil dalam format JSON yang valid.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar kurikulum sekolah Indonesia yang menyusun Program Tahunan (PROTA) Kurikulum Merdeka secara rapi dan profesional dalam format JSON. Pastikan seluruh tujuan pembelajaran dipetakan ke bab yang benar dengan alokasi waktu (JP) yang realistis sesuai format mingguan dan total semester.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                fase: { type: Type.STRING },
                tahunPelajaran: { type: Type.STRING },
                totalJp2Semester: { type: Type.STRING },
                alokasiWaktuTiapMinggu: { type: Type.STRING },
                semester1Weeks: { type: Type.STRING },
                semester2Weeks: { type: Type.STRING }
              },
              required: ['mataPelajaran', 'kelas', 'fase', 'tahunPelajaran', 'totalJp2Semester', 'alokasiWaktuTiapMinggu']
            },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  no: { type: Type.STRING },
                  bab: { type: Type.STRING },
                  tujuanPembelajaran: { type: Type.STRING },
                  materi: { type: Type.STRING },
                  alokasiWaktu: { type: Type.STRING },
                  semester: { type: Type.STRING }
                },
                required: ['no', 'bab', 'tujuanPembelajaran', 'materi', 'alokasiWaktu', 'semester']
              }
            },
            tanggalDokumen: { type: Type.STRING },
            kepalaSekolah: { type: Type.STRING },
            guruMapel: { type: Type.STRING }
          },
          required: ['identitas', 'rows', 'tanggalDokumen']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for PROTA, using offline generator:', error?.message);
    const fallback = getFallbackProta(
      req.body?.kelas,
      req.body?.semester,
      req.body?.tahunPelajaran
    );
    res.json(fallback);
  }
});

// 4e. Generate Program Semester (PROSEM)
app.post('/api/generate-prosem', async (req, res) => {
  try {
    const {
      mataPelajaran,
      kelas,
      fase,
      tahunPelajaran,
      alokasiWaktuTiapMinggu,
      protaContent
    } = req.body;

    if (!mataPelajaran || !kelas || !fase || !tahunPelajaran) {
      return res.status(400).json({ error: 'Mata pelajaran, kelas, fase, dan tahun pelajaran wajib diisi.' });
    }

    const weeklyJp = parseInt(alokasiWaktuTiapMinggu || '4', 10);

    const ai = getAiClient();
    const prompt = `Buatlah Program Semester (PROSEM) lengkap untuk Ganjil (Semester I) dan Genap (Semester II) berdasarkan Program Tahunan (PROTA) berikut:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas}
Fase: Fase ${fase}
Tahun Pelajaran: ${tahunPelajaran}
Alokasi JP per Minggu: ${weeklyJp} JP

Data PROTA Acuan:
${protaContent || 'Gunakan kurikulum standar nasional jika tidak dilampirkan'}

Ketentuan Penting Penjadwalan Pekan Efektif & Tidak Efektif:
1. Pembagian Pekan per Bulan:
   - Juli: 4 pekan (2 efektif, 2 tidak efektif). Pekan 1-2 tidak efektif (Libur Semester / MPLS jika kelas 1/7/10). Pekan 3-4 efektif.
   - Agustus: 4 pekan (4 efektif, 0 tidak efektif).
   - September: 4 pekan (2 efektif, 2 tidak efektif). Pekan 3-4 tidak efektif (Asesmen Sumatif Tengah Semester / PTS).
   - Oktober: 4 pekan (4 efektif, 0 tidak efektif).
   - November: 4 pekan (4 efektif, 0 tidak efektif).
   - Desember: 4 pekan (2 efektif, 2 tidak efektif). Pekan 1-2 tidak efektif (Asesmen Sumatif Akhir Semester / PAS), pekan 3-4 tidak efektif (Libur Semester).
   - Januari: 4 pekan (4 efektif, 0 tidak efektif).
   - Februari: 4 pekan (4 efektif, 0 tidak efektif).
   - Maret: 4 pekan (0 efektif, 4 tidak efektif). Pekan 1-2 tidak efektif (Asesmen Sumatif Tengah Semester / PTS), pekan 3-4 tidak efektif (Kegiatan Keagamaan / Libur awal Ramadan).
   - April: 5 pekan (5 efektif, 0 tidak efektif).
   - Mei: 4 pekan (4 efektif, 0 tidak efektif).
   - Juni: 4 pekan (2 efektif, 2 tidak efektif). Pekan 1-2 tidak efektif (Asesmen Sumatif Akhir Semester / PAT), pekan 3-4 tidak efektif (Libur Kenaikan Kelas).

2. Aturan Distribusi JP Mingguan:
   - Total JP per minggu adalah ${weeklyJp} JP.
   - Distribusikan alokasi waktu tiap baris materi/ATP secara berurutan pada pekan-pekan EFEKTIF saja.
   - Jika satu pekan tersisa JP (misal materi A sisa 2 JP dari total 4 JP mingguan), maka sisa 2 JP di pekan tersebut digunakan untuk memulai materi berikutnya (Materi B), sehingga total pengisian JP di pekan tersebut tetap tepat ${weeklyJp} JP.
   - Pada pekan TIDAK EFEKTIF, isi kolom value dengan tanda strip "-" atau nama kegiatannya seperti "MPLS", "PTS", "PAS", atau "L" (Libur) dan pastikan isEffective = false.

3. Keterangan:
   - Jika kelas adalah 1, 7, atau 10, sebutkan adanya kegiatan Masa Pengenalan Lingkungan Sekolah (MPLS) di pekan 1-2 Juli. Jika kelas selain itu, tidak perlu sebutkan MPLS.

Susunlah struktur data PROSEM secara lengkap untuk semester Ganjil dan Genap sesuai schema JSON berikut.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah asisten pakar kurikulum sekolah yang menyusun Program Semester (PROSEM) Kurikulum Merdeka secara akurat, konsisten, dan rapi dalam format JSON. Distribusikan JP secara berurutan dan matematis agar jumlah JP per pekan efektif tepat sesuai alokasi mingguan.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                fase: { type: Type.STRING },
                tahunPelajaran: { type: Type.STRING },
                alokasiWaktuTiapMinggu: { type: Type.STRING }
              },
              required: ['mataPelajaran', 'kelas', 'fase', 'tahunPelajaran', 'alokasiWaktuTiapMinggu']
            },
            ganjil: {
              type: Type.OBJECT,
              properties: {
                monthsHeader: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      monthName: { type: Type.STRING },
                      totalWeeks: { type: Type.INTEGER },
                      nonEffectiveWeeks: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER }
                      }
                    },
                    required: ['monthName', 'totalWeeks', 'nonEffectiveWeeks']
                  }
                },
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      no: { type: Type.STRING },
                      bab: { type: Type.STRING },
                      topik: { type: Type.STRING },
                      pertemuanKe: { type: Type.STRING },
                      alokasiWaktu: { type: Type.STRING },
                      months: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            monthName: { type: Type.STRING },
                            weeks: {
                              type: Type.ARRAY,
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  weekNum: { type: Type.INTEGER },
                                  value: { type: Type.STRING },
                                  isEffective: { type: Type.BOOLEAN }
                                },
                                required: ['weekNum', 'value', 'isEffective']
                              }
                            }
                          },
                          required: ['monthName', 'weeks']
                        }
                      }
                    },
                    required: ['no', 'bab', 'topik', 'pertemuanKe', 'alokasiWaktu', 'months']
                  }
                }
              },
              required: ['monthsHeader', 'rows']
            },
            genap: {
              type: Type.OBJECT,
              properties: {
                monthsHeader: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      monthName: { type: Type.STRING },
                      totalWeeks: { type: Type.INTEGER },
                      nonEffectiveWeeks: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER }
                      }
                    },
                    required: ['monthName', 'totalWeeks', 'nonEffectiveWeeks']
                  }
                },
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      no: { type: Type.STRING },
                      bab: { type: Type.STRING },
                      topik: { type: Type.STRING },
                      pertemuanKe: { type: Type.STRING },
                      alokasiWaktu: { type: Type.STRING },
                      months: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            monthName: { type: Type.STRING },
                            weeks: {
                              type: Type.ARRAY,
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  weekNum: { type: Type.INTEGER },
                                  value: { type: Type.STRING },
                                  isEffective: { type: Type.BOOLEAN }
                                },
                                required: ['weekNum', 'value', 'isEffective']
                              }
                            }
                          },
                          required: ['monthName', 'weeks']
                        }
                      }
                    },
                    required: ['no', 'bab', 'topik', 'pertemuanKe', 'alokasiWaktu', 'months']
                  }
                }
              },
              required: ['monthsHeader', 'rows']
            },
            keterangan: { type: Type.STRING },
            tanggalDokumen: { type: Type.STRING },
            kepalaSekolah: { type: Type.STRING },
            guruMapel: { type: Type.STRING }
          },
          required: ['identitas', 'ganjil', 'genap', 'keterangan', 'tanggalDokumen']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for PROSEM, using offline generator:', error?.message);
    const fallback = getFallbackProsem(
      req.body?.kelas,
      req.body?.semester,
      req.body?.tahunPelajaran
    );
    res.json(fallback);
  }
});

// 4f. Generate Slide Presentasi PPT (PowerPoint)
app.post('/api/generate-slides', async (req, res) => {
  try {
    const {
      mataPelajaran,
      kelas,
      fase,
      topikMateri,
      jumlahSlide,
      gayaDesain,
      guruPenyusun,
      tanggalDokumen
    } = req.body;

    if (!mataPelajaran || !kelas || !fase || !topikMateri || !jumlahSlide || !gayaDesain) {
      return res.status(400).json({ error: 'Mata pelajaran, kelas, fase, topik materi, jumlah slide, dan gaya desain wajib diisi.' });
    }

    const slidesCount = parseInt(jumlahSlide || '8', 10);
    const ai = getAiClient();
    const prompt = `Buatkan rancangan Slide Presentasi PPT (PowerPoint) Pembelajaran yang interaktif, menarik, dan berstruktur profesional:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas}
Fase: Fase ${fase}
Topik/Materi: ${topikMateri}
Jumlah Slide: ${slidesCount} Slide
Gaya Desain Visual: ${gayaDesain}
Guru Penyusun: ${guruPenyusun || 'Guru Kelas'}

Ketentuan Penyusunan Slide:
1. Struktur Alur Slide:
   - Slide 1: Slide Judul Presentasi yang memikat, memuat judul besar, sub-judul, dan identitas.
   - Slide 2: Tujuan Pembelajaran atau Agenda (Apersepsi & target kompetensi).
   - Slide 3 s.d. (N-1): Slide Pembahasan Materi Inti secara berurutan, terstruktur, interaktif, dengan pertanyaan pemantik atau contoh relevan untuk anak SD.
   - Slide Terakhir (Slide N): Slide Evaluasi/Penutup, berisi kuis singkat, kesimpulan, atau ajakan berefleksi serta ucapan terima kasih.
2. Konten Slide (points):
   - Jangan buat teks terlalu padat atau paragraf panjang. Gunakan 3-5 poin-poin penting (bullet points) yang ringkas, tajam, dan mudah dipahami.
3. Rekomendasi Visual (visualRecommendation):
   - Deskripsikan rancangan desain slide secara mendetail (rekomendasi kombinasi warna latar belakang, penempatan ikon, penggunaan gambar ilustrasi atau foto, grafik, dan tata letak/layout modern sesuai Gaya Desain yang dipilih).
4. Catatan Pemateri (speakerNotes):
   - Berikan teks panduan/narasi untuk guru mengenai apa yang harus dijelaskan secara lisan dan instruksi aktivitas interaktif bersama murid saat menampilkan slide tersebut.

Kembalikan hasil dalam format JSON terstruktur lengkap sesuai schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar desain teknologi instruksional dan media pembelajaran interaktif Indonesia yang ahli menyusun rancangan slide presentasi PPT (PowerPoint) kurikulum merdeka dalam format JSON secara kreatif, lengkap, dan berstruktur rapi.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                fase: { type: Type.STRING },
                topikMateri: { type: Type.STRING },
                jumlahSlide: { type: Type.STRING },
                gayaDesain: { type: Type.STRING },
                tanggalDokumen: { type: Type.STRING },
                guruPenyusun: { type: Type.STRING }
              },
              required: ['mataPelajaran', 'kelas', 'fase', 'topikMateri', 'jumlahSlide', 'gayaDesain', 'tanggalDokumen']
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNo: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  layoutType: { type: Type.STRING },
                  points: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  visualRecommendation: { type: Type.STRING },
                  speakerNotes: { type: Type.STRING }
                },
                required: ['slideNo', 'title', 'layoutType', 'points', 'visualRecommendation', 'speakerNotes']
              }
            }
          },
          required: ['identitas', 'slides']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Slides, using offline generator:', error?.message);
    const fallback = getFallbackSlides(
      req.body?.mataPelajaran,
      req.body?.kelas,
      req.body?.topikMateri
    );
    res.json(fallback);
  }
});

// 10. Generate Deep Learning RPM (Rencana Pembelajaran Mendalam) & LKPD
app.post('/api/generate-rpm', async (req, res) => {
  try {
    const { 
      grade, 
      materi, 
      penyusun, 
      sekolah, 
      tahunAjaran, 
      semester, 
      mataPelajaran, 
      bab, 
      alokasiWaktu,
      konteksTambahan 
    } = req.body;

    if (!grade || !materi || !penyusun || !sekolah) {
      return res.status(400).json({ error: 'Input wajib (Kelas, Topik, Penyusun, Sekolah) harus diisi.' });
    }

    const ai = getAiClient();
    const prompt = `Buatkan Perencanaan Pembelajaran Mendalam (RPM) Lengkap (8 Pertemuan) dengan struktur dan Lampiran Lengkap serta LKPD Lengkap untuk setiap pertemuan berdasarkan data berikut:
Kelas/Fase Capaian: Kelas ${grade}
Topik/Materi: ${materi}
Penyusun: ${penyusun}
Sekolah: ${sekolah}
Tahun Ajaran: ${tahunAjaran || '2026/2027'}
Semester: ${semester || '1'}
Mata Pelajaran: ${mataPelajaran || 'Matematika'}
Bab: ${bab || 'Bab 1'}
Alokasi Waktu: ${alokasiWaktu || '16x40 Menit (8 Pertemuan)'}
Konteks Tambahan: ${konteksTambahan || 'Tidak ada'}

PENTING UNTUK MENCEGAH TIMEOUT JARINGAN (FAILED TO FETCH):
- Jaga agar semua teks penjelasan sangat PADAT, RINGKAS, dan to-the-point menggunakan poin-poin (bullet-points) singkat. Hindari paragraf narasi panjang lebar.
- Untuk kegiatan pembelajaran (Pengalaman Belajar) Pertemuan 1 s.d. 8, gabungkan penjelasan atau tuliskan langkah-langkah secara ringkas dan lugas (maksimal 3-4 baris per pertemuan).
- Untuk LKPD (8 pertemuan), buatlah format template LKPD yang ringkas, instruktif, dan padat (maksimal 100-150 kata per LKPD).
- Seluruh isi output JSON harus berkisar antara 1.000 - 1.500 kata saja. Ini sangat penting agar API merespons dalam waktu kurang dari 15 detik.

A. Identitas
- Penyusun, Sekolah, Tahun Ajaran, Semester, Mata Pelajaran, Kelas/Fase Capaian, Bab, Topik, Alokasi Waktu (16x40 Menit / 8 Pertemuan)

B. Identifikasi
- Identifikasi Murid: ringkasan pengetahuan awal, minat belajar, kebutuhan belajar.
- Materi Pelajaran: faktual, konseptual, prosedural, metakognitif.
- Dimensi Profil Lulusan: pilih dimensi yang sesuai (penalaran kritis, kreativitas, kolaborasi, dll).

C. Desain Pembelajaran
- Capaian Pembelajaran, Lintas Disiplin Ilmu, Tujuan Pembelajaran (pertemuan 1-8 secara ringkas), Topik Pembelajaran, Praktik Pedagogis, Kemitraan, Lingkungan, Pemanfaatan Digital.

D. Pengalaman Belajar
- Langkah Kegiatan Awal (15 menit) secara singkat.
- Langkah Kegiatan Inti (60 menit): Pertemuan 1 s.d. 8 dijabarkan secara padat dan terstruktur (Memahami, Mengaplikasikan, Merefleksi secara ringkas).
- Langkah Kegiatan Penutup (5 menit) secara singkat.

E. Asesmen Pembelajaran
- Awal, Proses, Akhir (Jenis, Bentuk, dan Teknik secara singkat).

Tanda Tangan Kepala Sekolah: Soleh, S.Pd., M.Pd. dan Tanda Tangan Guru Mapel (${penyusun}).

LAMPIRAN:
- Asesmen Awal: 5 soal lisan/essay ringkas + kunci jawaban.
- Asesmen Proses: Rubrik Sikap, Pengetahuan, Keterampilan (ringkas).
- Asesmen Akhir: 5 soal akhir ringkas + kunci jawaban.
- Materi Ajar: Ringkasan konsep materi utama.

LKPD (Lembar Kerja Peserta Didik):
Buat LKPD UTUH namun RINGKAS untuk setiap pertemuan (Pertemuan 1 sampai Pertemuan 8) mencakup:
1. Identitas diri LKPD
2. Petunjuk penggunaan LKPD
3. Memahami (materi ringkas, 3 pertanyaan), Mengaplikasikan (tugas nyata), Merefleksikan (2-3 pertanyaan refleksi).
4. Penutup (penyemangat, catatan guru, checklist)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah asisten pakar kurikulum Pembelajaran Mendalam (Deep Learning) Kurikulum Merdeka di Indonesia. Tugas Anda adalah menyusun Perencanaan Pembelajaran Mendalam (RPM) berkualitas tinggi secara lengkap untuk 8 pertemuan namun ditulis dengan sangat PADAT, RINGKAS, dan TO-THE-POINT (gunakan bullet-points singkat) untuk memastikan respons cepat dan tidak terjadi network timeout (Failed to fetch). Output wajib dalam format JSON terstruktur.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            identitas: {
              type: Type.OBJECT,
              properties: {
                penyusun: { type: Type.STRING },
                sekolah: { type: Type.STRING },
                tahunAjaran: { type: Type.STRING },
                semester: { type: Type.STRING },
                mataPelajaran: { type: Type.STRING },
                kelasFase: { type: Type.STRING },
                bab: { type: Type.STRING },
                topik: { type: Type.STRING },
                alokasiWaktu: { type: Type.STRING }
              },
              required: ['penyusun', 'sekolah', 'tahunAjaran', 'semester', 'mataPelajaran', 'kelasFase', 'bab', 'topik', 'alokasiWaktu']
            },
            identifikasi: {
              type: Type.OBJECT,
              properties: {
                identifikasiMurid: { type: Type.STRING, description: 'Uraian lengkap pengetahuan awal, minat belajar, kebutuhan belajar' },
                materiPelajaran: { type: Type.STRING, description: 'Uraian faktual, konseptual, prosedural, metakognitif' },
                dimensiProfilLulusan: { type: Type.STRING, description: 'Dimensi profil lulusan yang sesuai' }
              },
              required: ['identifikasiMurid', 'materiPelajaran', 'dimensiProfilLulusan']
            },
            desainPembelajaran: {
              type: Type.OBJECT,
              properties: {
                capaianPembelajaran: { type: Type.STRING },
                lintasDisiplinIlmu: { type: Type.STRING },
                tujuanPembelajaran: { type: Type.STRING, description: 'Tujuan pembelajaran rinci Pertemuan 1-8' },
                topikPembelajaran: { type: Type.STRING, description: 'Sub topik dibahas setiap Pertemuan 1-8' },
                praktikPedagogis: { type: Type.STRING, description: 'Pendekatan Deep Learning, Model & Sintaks, Metode Pertemuan 1-8' },
                kemitraanPembelajaran: { type: Type.STRING },
                lingkunganPembelajaran: { type: Type.STRING },
                pemanfaatanDigital: { type: Type.STRING }
              },
              required: ['capaianPembelajaran', 'lintasDisiplinIlmu', 'tujuanPembelajaran', 'topikPembelajaran', 'praktikPedagogis', 'kemitraanPembelajaran', 'lingkunganPembelajaran', 'pemanfaatanDigital']
            },
            pengalamanBelajar: {
              type: Type.OBJECT,
              properties: {
                kegiatanAwal: { type: Type.STRING, description: 'Langkah awal 15 menit dengan prinsip berkesadaran, bermakna, menggembirakan' },
                kegiatanInti: { type: Type.STRING, description: 'Langkah inti 60 menit per pertemuan untuk Pertemuan 1-8. Harus sangat detail mencakup Memahami, Mengaplikasikan, Merefleksi beserta sintaks dan DPL.' },
                kegiatanPenutup: { type: Type.STRING, description: 'Langkah penutup 5 menit dengan prinsip berkesadaran, bermakna, menggembirakan' }
              },
              required: ['kegiatanAwal', 'kegiatanInti', 'kegiatanPenutup']
            },
            asesmenPembelajaran: {
              type: Type.OBJECT,
              properties: {
                awal: { type: Type.STRING },
                proses: { type: Type.STRING },
                akhir: { type: Type.STRING }
              },
              required: ['awal', 'proses', 'akhir']
            },
            tandaTangan: {
              type: Type.OBJECT,
              properties: {
                kepalaSekolah: { type: Type.STRING },
                guruMapel: { type: Type.STRING }
              },
              required: ['kepalaSekolah', 'guruMapel']
            },
            lampiran: {
              type: Type.OBJECT,
              properties: {
                asesmenAwal: { type: Type.STRING, description: '5 soal awal dan jawaban' },
                asesmenProses: { type: Type.STRING, description: 'Rubrik penilaian Sikap, Pengetahuan, Keterampilan (4 skala)' },
                asesmenAkhir: { type: Type.STRING, description: '5 soal akhir dan jawaban/proyek' },
                materiAjar: { type: Type.STRING, description: 'Materi ajar lengkap' }
              },
              required: ['asesmenAwal', 'asesmenProses', 'asesmenAkhir', 'materiAjar']
            },
            lkpdList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pertemuan: { type: Type.STRING, description: 'Pertemuan Ke-X' },
                  title: { type: Type.STRING, description: 'Judul LKPD Pertemuan Ke-X' },
                  content: { type: Type.STRING, description: 'Isi lengkap LKPD: Identitas diri, Petunjuk penggunaan, Sintaks Pembelajaran & Pengalaman Belajar (Memahami, Mengaplikasikan, Merefleksikan), Penutup dengan kata penyemangat, catatan guru, dan cek pemahaman' }
                },
                required: ['pertemuan', 'title', 'content']
              },
              description: 'Daftar LKPD lengkap untuk Pertemuan 1 sampai Pertemuan 8'
            }
          },
          required: [
            'title',
            'identitas',
            'identifikasi',
            'desainPembelajaran',
            'pengalamanBelajar',
            'asesmenPembelajaran',
            'tandaTangan',
            'lampiran',
            'lkpdList'
          ]
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for RPM, using offline generator:', error?.message);
    const fallback = getFallbackRPM(
      req.body?.grade,
      req.body?.materi,
      req.body?.semester
    );
    res.json(fallback);
  }
});

// ==========================================
// SUPABASE DATABASE PROXY API ENDPOINTS
// ==========================================

// 1. Get Supabase Status and Table Check
app.get('/api/supabase-status', async (req, res) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.json({
      configured: false,
      connected: false,
      tables: { classes: false, moduls: false, journals: false, rubriks: false },
      error: 'Variabel lingkungan Supabase belum diatur di .env.'
    });
  }

  const tables = {
    classes: false,
    moduls: false,
    journals: false,
    rubriks: false
  };
  let errorMsg: string | null = null;
  let isConnected = false;

  try {
    // Run all table queries concurrently with a strict 2-second timeout to prevent hanging on serverless hosts like Vercel
    const [resClasses, resModuls, resJournals, resRubriks] = await queryWithTimeout(
      Promise.all([
        supabase.from('classes').select('id').limit(1),
        supabase.from('moduls').select('id').limit(1),
        supabase.from('journals').select('id').limit(1),
        supabase.from('rubriks').select('id').limit(1)
      ]),
      2000
    );

    isConnected = true; // Connection is successful

    const errClasses = resClasses.error;
    const errModuls = resModuls.error;
    const errJournals = resJournals.error;
    const errRubriks = resRubriks.error;

    tables.classes = !errClasses || errClasses.code !== '42P01';
    if (errClasses && errClasses.code !== '42P01') {
      errorMsg = errClasses.message;
    }

    tables.moduls = !errModuls || errModuls.code !== '42P01';
    tables.journals = !errJournals || errJournals.code !== '42P01';
    tables.rubriks = !errRubriks || errRubriks.code !== '42P01';

    const allExist = tables.classes && tables.moduls && tables.journals && tables.rubriks;

    res.json({
      configured: true,
      connected: isConnected,
      tables,
      allExist,
      error: errorMsg,
      sqlScript: `
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR UNTUK MEMBUAT TABEL --

-- 1. Tabel Kelas
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade INT NOT NULL,
  students JSONB NOT NULL
);

-- 2. Tabel Modul Ajar (RPP)
CREATE TABLE IF NOT EXISTS moduls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  grade INT NOT NULL,
  semester INT NOT NULL,
  materi_pokok TEXT NOT NULL,
  alokasi_waktu TEXT NOT NULL,
  tujuan_pembelajaran JSONB NOT NULL,
  kegiatan_pembelajaran JSONB NOT NULL,
  sarana_prasarana JSONB NOT NULL,
  rubrik_penilaian TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. Tabel Jurnal Mengajar
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  materi TEXT NOT NULL,
  catatan_kejadian TEXT NOT NULL,
  tindak_lanjut TEXT NOT NULL
);

-- 4. Tabel Rubrik Fisik
CREATE TABLE IF NOT EXISTS rubriks (
  id TEXT PRIMARY KEY,
  materi TEXT NOT NULL,
  kategori TEXT NOT NULL,
  indikator JSONB NOT NULL
);

-- Aktifkan Row Level Security (RLS) & Izinkan Akses Publik (Pilihan Sederhana untuk Demo)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moduls ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubriks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Allow public insert classes" ON classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update classes" ON classes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete classes" ON classes FOR DELETE USING (true);

CREATE POLICY "Allow public select moduls" ON moduls FOR SELECT USING (true);
CREATE POLICY "Allow public insert moduls" ON moduls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update moduls" ON moduls FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete moduls" ON moduls FOR DELETE USING (true);

CREATE POLICY "Allow public select journals" ON journals FOR SELECT USING (true);
CREATE POLICY "Allow public insert journals" ON journals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update journals" ON journals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete journals" ON journals FOR DELETE USING (true);

CREATE POLICY "Allow public select rubriks" ON rubriks FOR SELECT USING (true);
CREATE POLICY "Allow public insert rubriks" ON rubriks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rubriks" ON rubriks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete rubriks" ON rubriks FOR DELETE USING (true);
`
    });
  } catch (error: any) {
    markSupabaseFailed();
    res.json({
      configured: true,
      connected: false,
      tables,
      allExist: false,
      error: 'Database Supabase tidak merespon/timeout. Menggunakan penyimpanan lokal.'
    });
  }
});

// 2. Fetch Classes
app.get('/api/classes', async (req, res) => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await queryWithTimeout(
        supabase.from('classes').select('*').order('name'),
        2000
      );
      if (!error && data) {
        return res.json(data);
      }
      if (error) {
        if (error.code !== '42P01') markSupabaseFailed();
      }
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json(inMemoryClasses);
});

// 3. Save Classes (Batch/Upsert)
app.post('/api/classes', async (req, res) => {
  const updatedClasses = req.body;
  inMemoryClasses = updatedClasses;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      for (const cls of updatedClasses) {
        await supabase.from('classes').upsert({
          id: cls.id,
          name: cls.name,
          grade: cls.grade,
          students: cls.students
        });
      }
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true });
});

// 3b. Delete Class
app.delete('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  inMemoryClasses = inMemoryClasses.filter((c: any) => c.id !== id);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('classes').delete().eq('id', id);
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true });
});

// 4. Fetch Moduls
app.get('/api/moduls', async (req, res) => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await queryWithTimeout(
        supabase.from('moduls').select('*').order('created_at', { ascending: false }),
        2000
      );
      if (!error && data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          grade: d.grade,
          semester: d.semester,
          materiPokok: d.materi_pokok,
          alokasiWaktu: d.alokasi_waktu,
          tujuanPembelajaran: d.tujuan_pembelajaran,
          kegiatanPembelajaran: d.kegiatan_pembelajaran,
          saranaPrasarana: d.sarana_prasarana,
          rubrikPenilaian: d.rubrik_penilaian,
          createdAt: d.created_at
        }));
        return res.json(mapped);
      }
      if (error) {
        if (error.code !== '42P01') markSupabaseFailed();
      }
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json(inMemoryModuls);
});

// 5. Save/Upsert a Modul
app.post('/api/moduls', async (req, res) => {
  const m = req.body;
  const index = inMemoryModuls.findIndex((x: any) => x.id === m.id);
  if (index >= 0) {
    inMemoryModuls[index] = m;
  } else {
    inMemoryModuls.unshift(m);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('moduls').upsert({
        id: m.id,
        title: m.title,
        grade: m.grade,
        semester: m.semester,
        materi_pokok: m.materiPokok,
        alokasi_waktu: m.alokasiWaktu,
        tujuan_pembelajaran: m.tujuanPembelajaran,
        kegiatan_pembelajaran: m.kegiatanPembelajaran,
        sarana_prasarana: m.saranaPrasarana,
        rubrik_penilaian: m.rubrikPenilaian,
        created_at: m.createdAt
      });
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true, modul: m });
});

// 6. Delete Modul
app.delete('/api/moduls/:id', async (req, res) => {
  const { id } = req.params;
  inMemoryModuls = inMemoryModuls.filter((m: any) => m.id !== id);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('moduls').delete().eq('id', id);
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true });
});

// 7. Fetch Journals
app.get('/api/journals', async (req, res) => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await queryWithTimeout(
        supabase.from('journals').select('*').order('date', { ascending: false }),
        2000
      );
      if (!error && data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          date: d.date,
          classId: d.class_id,
          className: d.class_name,
          materi: d.materi,
          catatanKejadian: d.catatan_kejadian,
          tindakLanjut: d.tindak_lanjut
        }));
        return res.json(mapped);
      }
      if (error) {
        if (error.code !== '42P01') markSupabaseFailed();
      }
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json(inMemoryJournals);
});

// 8. Save/Upsert a Journal
app.post('/api/journals', async (req, res) => {
  const j = req.body;
  const index = inMemoryJournals.findIndex((x: any) => x.id === j.id);
  if (index >= 0) {
    inMemoryJournals[index] = j;
  } else {
    inMemoryJournals.unshift(j);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('journals').upsert({
        id: j.id,
        date: j.date,
        class_id: j.classId,
        class_name: j.className,
        materi: j.materi,
        catatan_kejadian: j.catatanKejadian,
        tindak_lanjut: j.tindakLanjut
      });
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true, journal: j });
});

// 8b. Delete Journal
app.delete('/api/journals/:id', async (req, res) => {
  const { id } = req.params;
  inMemoryJournals = inMemoryJournals.filter((j: any) => j.id !== id);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('journals').delete().eq('id', id);
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json({ success: true });
});

// 9. Fetch Rubriks
app.get('/api/rubriks', async (req, res) => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await queryWithTimeout(
        supabase.from('rubriks').select('*'),
        2000
      );
      if (!error && data) {
        return res.json(data);
      }
      if (error) {
        if (error.code !== '42P01') markSupabaseFailed();
      }
    } catch (e: any) {
      markSupabaseFailed();
    }
  }
  res.json(inMemoryRubriks);
});

// 10. Save/Upsert Rubrik
app.post('/api/rubriks', async (req, res) => {
  const r = req.body;
  const index = inMemoryRubriks.findIndex((x: any) => x.id === r.id);
  if (index >= 0) {
    inMemoryRubriks[index] = r;
  } else {
    inMemoryRubriks.unshift(r);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('rubriks').upsert({
        id: r.id,
        materi: r.materi,
        kategori: r.kategori,
        indikator: r.indikator
      });
    } catch (e: any) {
      console.log('[Supabase Setup] Failed to sync rubrik with Supabase: Table may not exist yet.');
    }
  }
  res.json({ success: true, rubrik: r });
});

// 11. Delete Rubrik
app.delete('/api/rubriks/:id', async (req, res) => {
  const { id } = req.params;
  inMemoryRubriks = inMemoryRubriks.filter((r: any) => r.id !== id);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('rubriks').delete().eq('id', id);
    } catch (e: any) {
      console.log('[Supabase Setup] Failed to delete rubrik from Supabase: Table may not exist yet.');
    }
  }
  res.json({ success: true });
});

// 12. Generate Interactive LKPD (Lembar Kerja Peserta Didik) with AI
app.post('/api/generate-lkpd', async (req, res) => {
  try {
    const { 
      mode = 'raw',
      mataPelajaran, 
      kelas, 
      fase,
      sintaks,
      topikMateri, 
      tujuanPembelajaran,
      dimensiProfil,
      guruPenyusun, 
      gayaDesain, 
      sekolah,
      alokasiWaktu,
      kegiatanInti,
      rawText 
    } = req.body;

    if (!mataPelajaran || !kelas || !topikMateri || !guruPenyusun) {
      return res.status(400).json({ error: 'Mata Pelajaran, Kelas, Topik, dan Penyusun wajib diisi.' });
    }

    let prompt = '';
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    if (mode === 'v1') {
      if (!tujuanPembelajaran || !dimensiProfil) {
        return res.status(400).json({ error: 'Untuk LKPD Versi 1, Tujuan Pembelajaran dan Dimensi Profil wajib diisi.' });
      }
      prompt = `Anda adalah seorang Guru ${mataPelajaran} jenjang/kelas ${kelas} yang inspiratif dan berfokus pada pendidikan mendalam (Deep Learning).
Tugas Anda adalah merancang Lembar Kerja Peserta Didik (LKPD) yang lengkap dan terstruktur berdasarkan sintaks pembelajaran berikut:
- Sintaks Model & Metode Pembelajaran: ${sintaks || 'Pembelajaran Eksploratif Dinamis'}
- Topik Pembelajaran: ${topikMateri}
- Tujuan Pembelajaran: ${tujuanPembelajaran}
- Dimensi Profil Lulusan / Profil Pelajar Pancasila: ${dimensiProfil}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Gaya Desain Visual: ${gayaDesain}
- Tanggal Dokumen: ${dateStr}

LKPD harus mencakup bagian-bagian berikut secara utuh dan lengkap:
1. "Identitas Diri Siswa" (bagian ini akan diletakkan di header secara otomatis, jadi tidak perlu diletakkan sebagai section khusus).
2. "Petunjuk Penggunaan LKPD" (sebagai section pertama): berisi instruksi langkah-langkah mengerjakan, alat/bahan yang dibutuhkan, dan cara menjawab secara komunikatif.
3. "Sintaks Pembelajaran & Pengalaman Belajar Mendalam" (harus diintegrasikan menjadi satu dan ditampilkan tidak dalam bentuk tabel, gunakan beberapa section dengan tahapan sintaks ${sintaks || 'Pembelajaran'}):
   A. MEMAHAMI: Sajikan rangkuman materi singkat yang kaya/bermakna, tabel data atau gambar pendukung, lalu berikan pertanyaan pemahaman (minimal 3 soal nalar kritis dengan answerBoxStyle bervariasi).
   B. MENGAPLIKASIKAN: Buat sebuah tugas atau studi kasus nyata kontekstual yang dekat dengan kehidupan sehari-hari siswa, instruksi kerja yang sangat jelas, serta ruang bagi siswa untuk memikirkan solusinya.
   C. MEREFLEKSIKAN: Berikan 2 sampai 3 pertanyaan refleksi mendalam yang menuntun siswa untuk meninjau kembali proses belajarnya, kesulitan yang dihadapi, serta rencana tindak lanjut perbaikannya.
4. "Bagian Penutup & Evaluasi Mandiri": berikan ucapan penyemangat/motivasi yang menginspirasi, catatan guru, serta kolom cek pemahaman diri siswa berupa daftar checklist sederhana (kembalikan 3-5 kalimat pernyataan reflektif untuk selfReflectionChecklist).

Gunakan bahasa yang hangat, komunikatif, menyenangkan, ramah anak, dan mendorong pembelajaran aktif, bermakna, berkesadaran, serta menggembirakan. LKPD harus muncul secara utuh dengan isi yang lengkap, bukan hanya berupa kerangka kasar atau daftar isi!`;
    } else if (mode === 'v2') {
      if (!kegiatanInti) {
        return res.status(400).json({ error: 'Untuk LKPD Versi 2, isi Kegiatan Inti RPP wajib diisi.' });
      }
      prompt = `Anda adalah desainer teknologi pembelajaran profesional yang ahli merancang Lembar Kerja Peserta Didik (LKPD) yang lengkap, bermakna, dan terstruktur berdasarkan Kegiatan Inti RPP berikut:
"${kegiatanInti}"

LKPD ini dibuat khusus untuk setiap pertemuan sesuai dengan rincian kegiatan inti di atas.
Berikut adalah data identitas dokumen:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Gaya Desain Visual: ${gayaDesain}
- Tanggal Dokumen: ${dateStr}

LKPD harus mencakup bagian-bagian berikut secara utuh dan lengkap:
1. "Identitas Diri Siswa" (akan ditempatkan di atas secara otomatis).
2. "Petunjuk Penggunaan LKPD" (sebagai section pertama): berisi instruksi langkah-langkah mengerjakan, alat/bahan yang dibutuhkan, dan cara menjawab yang jelas.
3. "Sintaks Pembelajaran & Pengalaman Belajar Mendalam" (diintegrasikan secara selaras dengan langkah-langkah kegiatan inti di atas, tidak boleh dalam bentuk tabel, melainkan mengalir secara naratif-interaktif):
   A. MEMAHAMI: Sajikan ringkasan materi konseptual/teks instruksional yang harus dibaca berdasarkan kegiatan inti, dilengkapi minimal 3 soal pertanyaan pemahaman nalar kritis siswa.
   B. MENGAPLIKASIKAN: Buat tugas kasus nyata/studi kasus kontekstual yang sesuai kegiatan inti RPP untuk dikerjakan siswa, instruksi kerja yang rinci, dan sediakan ruang kotak jawaban menarik.
   C. MEREFLEKSIKAN: Berikan 2 sampai 3 pertanyaan refleksi mendalam yang menuntun siswa mengevaluasi proses belajarnya hari ini, hambatan yang dirasa, dan aksi nyata selanjutnya.
4. "Bagian Penutup & Evaluasi Mandiri": tambahkan ucapan penyemangat/motivasi yang menginspirasi, catatan guru, serta kolom cek pemahaman diri siswa berupa daftar checklist sederhana (kembalikan 3-5 kalimat pernyataan reflektif untuk selfReflectionChecklist).

Gunakan bahasa yang hangat, komunikatif, menyenangkan, ramah anak, dan mendorong pembelajaran aktif, bermakna, berkesadaran, serta menggembirakan. LKPD harus muncul secara utuh dengan isi yang lengkap, bukan hanya berupa kerangka kasar atau daftar isi!`;
    } else if (mode === 'info_v1') {
      if (!rawText) {
        return res.status(400).json({ error: 'Materi Rangkuman wajib diisi.' });
      }
      prompt = `Anda adalah seorang desainer infografis pendidikan profesional dan ilustrator 3D animation yang ahli dalam mengubah materi pembelajaran menjadi poster edukatif visual yang menarik, informatif, dan sangat disukai peserta didik.
Tugas Anda adalah mengubah materi yang diberikan menjadi sebuah infografis edukatif ukuran A4 (21 cm × 29,7 cm) orientasi portrait dengan gaya 3D cartoon animation berkualitas tinggi seperti ilustrasi film animasi anak modern.
Seluruh karakter, objek, lingkungan, ikon, dan elemen visual harus dibuat dalam bentuk 3D render yang halus, lucu, berwarna cerah, memiliki pencahayaan lembut, bayangan realistis, detail tinggi, dan tampilan premium. Desain harus terasa seperti perpaduan antara poster pendidikan dan dunia animasi 3D yang hidup, ceria, serta mampu menarik perhatian peserta didik sejak pandangan pertama.

Letakkan judul utama berukuran besar di bagian atas dengan tipografi kartun yang tebal, berwarna cerah, dan mudah dibaca. Tambahkan subjudul yang menarik serta karakter anak 3D yang berdiri di dekat judul sebagai pemandu belajar. Karakter tersebut harus menampilkan ekspresi ceria, ramah, dan penuh semangat sambil mengajak peserta didik mempelajari materi. Gunakan balon percakapan yang berisi kalimat pendek dan komunikatif untuk memberikan kesan interaktif.

Bagian utama infografis harus dibagi menjadi beberapa panel atau kotak informasi yang tersusun rapi dengan sudut membulat, efek bayangan lembut, dan tampilan modern. Setiap panel memuat satu konsep penting dari materi dan harus divisualisasikan menggunakan ilustrasi lingkungan 3D yang detail dan kontekstual.
Setiap panel harus memiliki judul yang jelas, ilustrasi utama yang dianjurkan (tuliskan petunjuk visualnya di illustrationPrompt), ikon pendukung, dan poin-poin informasi yang singkat serta mudah dipahami.
Gunakan komposisi visual yang kaya namun tetap rapi. Hindari paragraf panjang dan ubah seluruh informasi menjadi poin-poin pendek.

Pada bagian bawah poster, buat area khusus (kembalikan di penutupMotivasi) yang berisi rangkuman, pesan penting, solusi, tips, atau ajakan tindakan yang relevan dengan materi, disajikan sebagai penutup inspiratif.

Berikut adalah data Identitas Infografis:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Tanggal Dokumen: ${dateStr}

MATERI AJAR UNTUK INFOGRAFIS:
${rawText}

Rancanglah Infografis 3D Cartoon Animation tersebut secara kreatif dan kembalikan hasilnya dalam format JSON terstruktur sesuai responseSchema.`;
    } else if (mode === 'info_v2') {
      if (!rawText) {
        return res.status(400).json({ error: 'Materi Rangkuman wajib diisi.' });
      }
      prompt = `Anda adalah seorang desainer infografis pendidikan profesional yang ahli dalam mengubah materi pembelajaran menjadi poster edukatif visual yang menarik, mudah dipahami, dan ramah peserta didik.
Tugas Anda adalah mengubah materi yang diberikan menjadi sebuah infografis edukatif ukuran A4 (21 cm × 29,7 cm) orientasi portrait dengan gaya visual yang menyerupai poster pembelajaran anak modern. Desain harus menggunakan ilustrasi kartun 2D yang ceria, warna-warna cerah namun lembut, tata letak yang rapi, serta visual yang mampu membantu peserta didik memahami konsep secara cepat.
Letakkan judul utama berukuran besar dan mencolok di bagian atas disertai subjudul yang menarik perhatian. Tambahkan ilustrasi anak atau maskot yang seolah-olah mengajak pembaca untuk belajar melalui balon percakapan yang singkat dan komunikatif.

Di bagian tengah, tampilkan konsep utama materi dalam bentuk visual besar yang menjadi fokus infografis. Gunakan diagram, ilustrasi, panah proses, ikon, simbol, atau visualisasi lain yang relevan dengan materi.
Di bawah atau di samping visual utama, buat beberapa kotak informasi yang membagi materi menjadi bagian-bagian penting seperti pengertian, penyebab, ciri-ciri, komponen, manfaat, dampak, fungsi, jenis, langkah-langkah, atau kategori lain yang sesuai dengan materi. Setiap poin informasi harus disertai ilustrasi atau ikon pendukung dan ditulis menggunakan kalimat yang singkat, sederhana, dan mudah dipahami peserta didik. Hindari paragraf panjang.

Pada bagian bawah poster, buat area khusus yang berisi solusi, tips, langkah penerapan, cara melakukan, atau aksi nyata yang dapat dilakukan peserta didik sesuai dengan materi. Gunakan judul menarik seperti "Yuk Kita Lakukan!", "Ayo Praktik!", dsb.

Berikut adalah data Identitas Infografis:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Tanggal Dokumen: ${dateStr}

MATERI AJAR UNTUK INFOGRAFIS:
${rawText}

Rancanglah Infografis Cute 2D Cartoon tersebut secara kreatif dan kembalikan hasilnya dalam format JSON terstruktur sesuai responseSchema.`;
    } else if (mode === 'info_v3') {
      if (!rawText) {
        return res.status(400).json({ error: 'Materi Rangkuman wajib diisi.' });
      }
      prompt = `Anda adalah seorang desainer pembelajaran profesional sekaligus ahli dalam mengembangkan infografis pendidikan yang menarik, modern, dan mudah dipahami peserta didik.
Tugas Anda adalah mengubah rangkuman materi ajar yang diberikan menjadi infografis edukatif berbentuk visual dengan ukuran A4 (21 cm × 29,7 cm) orientasi portrait.
Desain harus menggunakan gaya modern, clean, edukatif, informatif, dan ramah siswa dengan perpaduan warna yang cerah namun tetap nyaman di mata. Infografis harus memiliki tampilan visual yang menarik, tidak monoton, serta memanfaatkan ilustrasi, ikon, diagram sederhana, dan elemen grafis pendukung agar materi lebih mudah dipahami sesuai karakter siswa generasi Gen Z.

Struktur tata letak wajib dibuat rapi, proporsional, dan sistematis:
- Bagian paling atas terdapat judul utama materi dengan desain header menarik, modern, dan berwarna.
- Di bawah judul terdapat subjudul atau identitas materi seperti mata pelajaran, kelas, bab, atau topik pembelajaran.
- Isi rangkuman materi disusun menjadi beberapa bagian atau poin utama menggunakan layout infografis yang terstruktur dan mudah diikuti (seperti box, card, timeline, flowchart, diagram, atau mind map sederhana).
- Gunakan kombinasi elemen visual seperti panah, garis penghubung, numbering, dan shape modern agar alur materi lebih jelas.

PENTING (KEWAJIBAN MUTLAK):
Seluruh isi teks, materi, definisi, rumus, poin-poin, dan penjelasan dalam rangkuman harus dipertahankan 100% sama persis dengan file asli tanpa ada pengurangan, penambahan, ataupun perubahan redaksi (verbatim). Tugas Anda hanya mengubah tampilan menjadi infografis visual yang lebih menarik tanpa mengubah isi materi.

Berikut adalah data Identitas Infografis:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Tanggal Dokumen: ${dateStr}

MATERI AJAR UNTUK INFOGRAFIS (HARUS 100% VERBATIM SAMA):
${rawText}

Rancanglah Infografis Modern Clean Gen Z tersebut secara kreatif dan kembalikan hasilnya dalam format JSON terstruktur sesuai responseSchema.`;
    } else if (mode === 'info_v4') {
      if (!rawText) {
        return res.status(400).json({ error: 'Materi Rangkuman wajib diisi.' });
      }
      prompt = `Anda adalah seorang desainer infografis pendidikan profesional sekaligus ilustrator clay art (claymation style) yang ahli dalam mengubah materi pembelajaran menjadi poster edukatif visual yang menarik, ramah anak, dan sangat mudah dipahami.
Tugas Anda adalah mengubah materi yang diberikan menjadi sebuah infografis edukatif ukuran A4 (21 cm × 29,7 cm) orientasi portrait dengan gaya 3D clay illustration seperti karakter dan objek yang dibuat dari plastisin atau clay berwarna-warni.
Seluruh elemen visual harus memiliki tekstur clay yang lembut, bentuk membulat, detail handmade yang unik, warna-warna cerah, pencahayaan hangat, serta kesan lucu dan menyenangkan. Hasil akhir harus terlihat seperti miniatur dunia edukasi yang dibuat dari clay premium.

Letakkan judul utama berukuran besar di bagian atas menggunakan tipografi yang tampak dibentuk dari clay berwarna cerah. Tambahkan subjudul serta karakter anak berbentuk clay yang berdiri di dekat judul.
Bagian utama infografis harus dibagi menjadi beberapa panel atau kotak informasi dengan sudut membulat yang tampak dibuat dari clay bertekstur lembut. Setiap panel memuat satu konsep penting dari materi dan harus divisualisasikan menggunakan diorama miniatur clay yang kaya detail (tuliskan petunjuk visualnya di illustrationPrompt).
Tambahkan berbagai elemen dekoratif berbentuk clay seperti awan, bunga, dedaunan, bintang, pelangi, buku, dll.

Berikut adalah data Identitas Infografis:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Tanggal Dokumen: ${dateStr}

MATERI AJAR UNTUK INFOGRAFIS:
${rawText}

Rancanglah Infografis 3D Clay Art tersebut secara kreatif dan kembalikan hasilnya dalam format JSON terstruktur sesuai responseSchema.`;
    } else {
      // mode === 'raw' (backward-compatible)
      if (!rawText) {
        return res.status(400).json({ error: 'Teks LKPD Asli wajib diisi untuk mode penataan ulang.' });
      }
      prompt = `Anda adalah desainer pembelajaran profesional sekaligus ahli dalam mengembangkan Lembar Kerja Peserta Didik (LKPD) interaktif berbasis visual yang menarik, bersih, edukatif, dan ramah siswa.
      
Tugas Anda adalah menata ulang dan mengubah LKPD mentah pada lampiran berikut menjadi LKPD bergambar interaktif dengan struktur terorganisir yang rapi.

PENTING (KEWAJIBAN MUTLAK):
1. Seluruh isi teks, soal, instruksi, dan materi dalam LKPD asli HARUS DIPERTAHANKAN 100% sama persis dengan file asli tanpa ada pengurangan, penambahan, ataupun perubahan redaksi (verbatim) pada kalimat soal dan materinya! Jangan meringkas atau menghilangkan bagian apa pun dari soal aslinya.
2. Tugas Anda HANYA menyajikan dan membungkus teks asli tersebut ke dalam struktur visual yang sangat rapi, menarik, interaktif, dan mudah dipahami dengan bantuan visual meta-data.
3. Tambahkan rekomendasi ikon (misalnya 📌, ✏️, 💡, 🔍, 🎯) untuk setiap bagian.
4. Tentukan jenis tampilan visual pendukung, seperti layout kotak jawaban (misalnya: 'rounded_large', 'dotted_box', 'speech_bubble', 'ruled_lines'), highlight warna, tabel rapi, serta diagram/ilustrasi sederhana yang relevan untuk memperkuat nalar kritis siswa.
5. Bahasa aslinya tidak boleh diubah (tetap menggunakan bahasa Indonesia), namun buat tampilannya sangat engaging dan mudah dibaca (Gen Z friendly).

Berikut adalah data Identitas LKPD:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Gaya Desain Visual: ${gayaDesain}
- Sekolah: ${sekolah || 'Sekolah Dasar'}
- Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit'}
- Tanggal Dokumen: ${dateStr}

LAMPIRAN LKPD ASLI (COPIED BY USER):
${rawText}

Rancanglah LKPD tersebut secara kreatif dan kembalikan hasilnya dalam format JSON terstruktur lengkap sesuai responseSchema.`;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar desain teknologi instruksional dan media pembelajaran interaktif Indonesia yang ahli menyusun rancangan Lembar Kerja Peserta Didik (LKPD) Kurikulum Merdeka yang visual, modern, dan rapi dalam format JSON terstruktur.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identitas: {
              type: Type.OBJECT,
              properties: {
                mataPelajaran: { type: Type.STRING },
                kelas: { type: Type.STRING },
                topikMateri: { type: Type.STRING },
                guruPenyusun: { type: Type.STRING },
                gayaDesain: { type: Type.STRING },
                tanggalDokumen: { type: Type.STRING },
                sekolah: { type: Type.STRING },
                alokasiWaktu: { type: Type.STRING }
              },
              required: ['mataPelajaran', 'kelas', 'topikMateri', 'guruPenyusun', 'gayaDesain', 'tanggalDokumen']
            },
            judulMenarik: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionTitle: { type: Type.STRING },
                  icon: { type: Type.STRING },
                  introText: { type: Type.STRING },
                  contentBlocks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        blockType: { type: Type.STRING },
                        exactText: { type: Type.STRING },
                        questionData: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            questionText: { type: Type.STRING },
                            answerBoxStyle: { type: Type.STRING },
                            placeholderText: { type: Type.STRING },
                            score: { type: Type.STRING }
                          },
                          required: ['questionText', 'answerBoxStyle']
                        },
                        tableData: {
                          type: Type.OBJECT,
                          properties: {
                            headers: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING }
                            },
                            rows: {
                              type: Type.ARRAY,
                              items: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                              }
                            }
                          }
                        },
                        matchingData: {
                          type: Type.OBJECT,
                          properties: {
                            leftLabel: { type: Type.STRING },
                            rightLabel: { type: Type.STRING },
                            pairs: {
                              type: Type.ARRAY,
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  leftItem: { type: Type.STRING },
                                  rightItem: { type: Type.STRING }
                                },
                                required: ['leftItem', 'rightItem']
                              }
                            }
                          }
                        },
                        illustrationPrompt: { type: Type.STRING }
                      },
                      required: ['blockType']
                    }
                  },
                  visualDesignTip: { type: Type.STRING }
                },
                required: ['sectionTitle', 'icon', 'contentBlocks']
              }
            },
            penutupMotivasi: { type: Type.STRING },
            selfReflectionChecklist: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['identitas', 'judulMenarik', 'sections']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for LKPD, using offline generator:', error?.message);
    const fallback = getFallbackLKPD(req.body);
    res.json(fallback);
  }
});

// 13. Generate Beautiful Cover Page for Modul/RPP/LKPD with AI
app.post('/api/generate-cover', async (req, res) => {
  try {
    const {
      documentType = 'Modul Ajar',
      judul,
      subJudul = '',
      mataPelajaran = '',
      kelas = '',
      semester = '',
      tahunAjaran = '',
      disusunOleh = '',
      nip = '',
      namaSekolah = '',
      dinasPendidikan = '',
      kotaKabupaten = '',
      coverStyle = 'classic_formal',
      warnaTema = 'emerald',
      logoType = 'tutwuri',
      customEmoji = '📚'
    } = req.body;

    if (!judul) {
      return res.status(400).json({ error: 'Judul Cover Dokumen wajib diisi.' });
    }

    const prompt = `Anda adalah seorang desainer grafis profesional dan ahli tata letak dokumen pendidikan resmi di Indonesia.
Tugas Anda adalah merancang elemen teks kreatif dan hiasan visual untuk Cover (Halaman Sampul) dokumen sekolah resmi.

Jenis Dokumen: \${documentType}
Judul Utama: \${judul}
Subjudul Asli: \${subJudul}
Mata Pelajaran: \${mataPelajaran}
Kelas/Fase: \${kelas}
Semester: \${semester}
Tahun Ajaran: \${tahunAjaran}
Disusun Oleh: \${disusunOleh}
NIP/Keterangan: \${nip}
Nama Sekolah: \${namaSekolah}
Dinas Pendidikan: \${dinasPendidikan}
Kota/Kabupaten: \${kotaKabupaten}
Gaya Cover: \${coverStyle}
Warna Tema: \${warnaTema}

Instruksi khusus berdasarkan Gaya Cover:
1. "classic_formal": Hasilkan cover bernuansa resmi, simetris, berwibawa, dengan bingkai garis ganda (double border), font serif elegan, ornamen sudut klasik, dan tata letak yang sangat rapi. Cocok untuk dokumen dinas/sekolah formal.
2. "modern_minimalist": Hasilkan cover bernuansa bersih, kontemporer, dengan pemanfaatan ruang negatif (whitespace) yang luas, aksen garis asimetris tipis yang estetik, tipografi sans-serif (Inter/Space Grotesk) yang modis, dan warna-warna yang soft.
3. "cute_kids": Hasilkan cover bernuansa ceria, ramah anak, penuh warna hangat, dengan bingkai awan/gelombang bertekstur lembut, ornamen buah, bintang, pelangi, dan balon dialog lucu. Sangat cocok untuk SD kelas bawah atau taman kanak-kanak.
4. "creative_art": Hasilkan cover artistik dengan motif abstrak, hiasan daun organik (botanical elements), lingkaran bertumpuk (bento/geometric elements), serta tata letak judul modern yang berani dan kreatif.

Kewajiban Mutlak:
- Anda harus mempertahankan seluruh data asli yang diinput di atas.
- Sempurnakan Subjudul aslinya agar lebih menarik (kembalikan di subJudulKreatif).
- Buatlah slogan atau tagline sekolah/pembelajaran yang inspiratif dan berbobot (taglineSekolah).
- Berikan kutipan/quote motivasi edukasi yang relevan (kutipanMotivasi) beserta nama tokoh pencetusnya atau peribahasa bijak (sumberKutipan).
- Berikan rincian deskripsi gaya visual yang cocok untuk gaya cover tersebut, termasuk dekorasi background, border, dan detail hiasan sudut (hiasanSudut) dalam format kata kunci atau kalimat pendek.

Rancanglah Cover tersebut secara istimewa dan kembalikan hasilnya dalam format JSON terstruktur lengkap sesuai responseSchema.`;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah pakar desain media cetak dan tata letak dokumen sekolah resmi Kurikulum Merdeka yang ahli merancang cover dokumen pendidikan berkualitas tinggi dalam format JSON terstruktur.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            judulUtama: { type: Type.STRING },
            subJudulKreatif: { type: Type.STRING },
            taglineSekolah: { type: Type.STRING },
            kutipanMotivasi: { type: Type.STRING },
            sumberKutipan: { type: Type.STRING },
            detailDokumen: {
              type: Type.OBJECT,
              properties: {
                jenisDokumen: { type: Type.STRING },
                mataPelajaran: { type: Type.STRING },
                kelasFase: { type: Type.STRING },
                semester: { type: Type.STRING },
                tahunAjaran: { type: Type.STRING }
              },
              required: ['jenisDokumen', 'mataPelajaran', 'kelasFase']
            },
            informasiPenyusun: {
              type: Type.OBJECT,
              properties: {
                namaPenyusun: { type: Type.STRING },
                nipKeterangan: { type: Type.STRING },
                jabatan: { type: Type.STRING }
              },
              required: ['namaPenyusun']
            },
            instansi: {
              type: Type.OBJECT,
              properties: {
                namaSekolah: { type: Type.STRING },
                dinasPendidikan: { type: Type.STRING },
                kotaKabupaten: { type: Type.STRING }
              },
              required: ['namaSekolah']
            },
            gayaVisual: {
              type: Type.OBJECT,
              properties: {
                rekomendasiWarnaBg: { type: Type.STRING },
                borderStyle: { type: Type.STRING },
                patternDescription: { type: Type.STRING },
                hiasanSudut: { type: Type.STRING }
              },
              required: ['borderStyle', 'patternDescription', 'hiasanSudut']
            }
          },
          required: ['judulUtama', 'subJudulKreatif', 'taglineSekolah', 'kutipanMotivasi', 'sumberKutipan', 'detailDokumen', 'informasiPenyusun', 'instansi', 'gayaVisual']
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon teks dari model Gemini.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Cover, using offline generator:', error?.message);
    const fallback = getFallbackCover(req.body);
    res.json(fallback);
  }
});

app.post('/api/analyze-workload', async (req, res) => {
  try {
    const {
      teacherName,
      schoolName,
      weeklyJpTarget = 24,
      schedule = [],
      extraDuties = [],
      notes = ''
    } = req.body;

    const ai = getAiClient();
    const prompt = `Lakukan analisis beban kerja mengajar dan beban administrasi untuk guru PJOK berikut:
Nama Guru: ${teacherName || 'Guru PJOK'}
Satuan Pendidikan: ${schoolName || 'SD Negeri'}
Target JP Minimum Sertifikasi: ${weeklyJpTarget} JP per pekan
Tugas Tambahan: ${extraDuties.join(', ') || 'Tidak ada'}
Jadwal Mengajar Saat Ini: ${JSON.stringify(schedule)}
Catatan Tambahan: ${notes || 'Tidak ada'}

Analisislah secara mendalam apakah beban kerja saat ini sudah memenuhi batas minimal 24 JP per pekan untuk tunjangan profesi guru (TPG) / sertifikasi di Indonesia, bagaimana distribusi fisiknya (karena PJOK menguras fisik di lapangan), kelelahan fisik, serta efisiensi beban administrasi. Berikan usulan solusi konkret dan inovatif jika jam mengajar kurang (misal melalui ekuivalensi tugas tambahan Kemendikbudristek seperti Pembina Ekskul, Pembina Pramuka, Koordinator P5, dsb).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah asisten pakar analis beban kerja dan manajemen karir guru/kepegawaian sekolah (Kemendikbudristek RI). Anda bertugas menganalisis jam mengajar guru PJOK dengan keahlian khusus tentang beban fisik guru olahraga di lapangan, regulasi Sertifikasi Guru (Permendikbud No 15 Tahun 2018), dan ekuivalensi jam mengajar. Format output harus selalu dalam bentuk JSON terstruktur sesuai schema yang diminta.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryStatus: { type: Type.STRING, description: 'Ringkasan singkat status beban kerja dan kelayakan sertifikasi' },
            certificationStatus: { type: Type.STRING, description: 'Kelayakan Sertifikasi: "MEMENUHI", "BELUM MEMENUHI", atau "OVERLOAD"' },
            certificationExplanation: { type: Type.STRING, description: 'Penjelasan detail kelayakan sertifikasi berdasarkan regulasi Kemendikbudristek' },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Kelebihan dari pola jadwal / beban kerja saat ini (minimal 2 poin)'
            },
            challenges: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Tantangan/risiko, terutama kelelahan fisik atau kendala administrasi (minimal 2 poin)'
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Rekomendasi taktis untuk mengoptimalkan jam mengajar, meningkatkan kebugaran guru, ekuivalensi tugas tambahan, dsb (minimal 3 poin)'
            },
            weeklyDistributionChartData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING, description: 'Nama Hari' },
                  hours: { type: Type.INTEGER, description: 'Total JP mengajar di hari tersebut' },
                  intensity: { type: Type.STRING, description: 'Tingkat intensitas fisik (Ringan, Sedang, Tinggi)' }
                },
                required: ['day', 'hours', 'intensity']
              },
              description: 'Data distribusi harian beban mengajar untuk divisualisasikan dalam chart'
            }
          },
          required: [
            'summaryStatus',
            'certificationStatus',
            'certificationExplanation',
            'strengths',
            'challenges',
            'recommendations',
            'weeklyDistributionChartData'
          ]
        }
      }
    });

    if (!response.text) {
      throw new Error('Tidak ada respon dari model AI.');
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.warn('[AI Fallback] Gemini API failed for Workload Analysis, using offline generator:', error?.message);
    const fallback = getFallbackWorkload(req.body);
    res.json(fallback);
  }
});

// Serve Vite dev server or static dist directory
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SADAR PJOK Full-Stack Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.NETLIFY) {
  startServer();
}

export default app;
