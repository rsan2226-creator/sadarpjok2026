import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CLASSES, INITIAL_JOURNALS, INITIAL_MODULS, PREBUILT_RUBRIKS } from './src/data';
import { generateSummativeAssessment } from './src/utils/summativeGenerator';

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
    let url = process.env.SUPABASE_URL || 'https://gohycvfxflwwmdogiwse.supabase.co';
    const anonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvaHljdmZ4Zmx3d21kb2dpd3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjAxODIsImV4cCI6MjEwMDg5NjE4Mn0.kUE56HSrf0AZB0a7HFDz2mjrEaPskQ-4RSOWDhrymPQ';
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

// Tracking for Gemini API access restriction (e.g. 403 PERMISSION_DENIED / Project Access Denied)
let geminiAccessDeniedUntil = 0;
const GEMINI_DENIED_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown

function isGeminiAccessDenied(): boolean {
  return Boolean(geminiAccessDeniedUntil && Date.now() < geminiAccessDeniedUntil);
}

function markGeminiAccessDenied() {
  geminiAccessDeniedUntil = Date.now() + GEMINI_DENIED_COOLDOWN_MS;
}

function checkAndMarkAccessDenied(error: any) {
  let errStr = '';
  try {
    errStr = error?.message || String(error || '');
    if (typeof error === 'object') {
      errStr += ' ' + JSON.stringify(error);
    }
  } catch (e) {
    errStr = String(error);
  }
  if (
    errStr.includes('403') ||
    errStr.includes('PERMISSION_DENIED') ||
    errStr.includes('denied access') ||
    errStr.includes('Project Access Denied')
  ) {
    markGeminiAccessDenied();
  }
}

// Check Gemini API accessibility once quietly on startup
(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return;
    const testAi = new GoogleGenAI({ apiKey: key });
    await testAi.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'ping'
    });
  } catch (err: any) {
    checkAndMarkAccessDenied(err);
  }
})();

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
    const rawClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Intercept generateContent calls to automatically apply the retry logic and seamless model fallbacks
    const originalGenerateContent = rawClient.models.generateContent.bind(rawClient.models);
    rawClient.models.generateContent = async function(params: any) {
      const originalModel = params?.model;
      try {
        return await callGeminiWithRetry(() => originalGenerateContent(params));
      } catch (error: any) {
        checkAndMarkAccessDenied(error);
        let errorStr = '';
        try {
          errorStr = error ? (error.message || String(error)) : '';
          if (error && typeof error === 'object') {
            errorStr += ' ' + JSON.stringify(error);
          }
        } catch (e) {
          errorStr = String(error);
        }

        const isPermissionDenied =
          errorStr.includes('403') ||
          errorStr.includes('PERMISSION_DENIED') ||
          errorStr.includes('denied access') ||
          errorStr.includes('Project Access Denied');

        const isQuotaOrTransient =
          !isPermissionDenied && (
            errorStr.includes('503') || 
            errorStr.includes('UNAVAILABLE') || 
            errorStr.includes('high demand') || 
            errorStr.includes('temporary') || 
            errorStr.includes('429') || 
            errorStr.includes('RESOURCE_EXHAUSTED') ||
            errorStr.includes('quota') ||
            errorStr.includes('Quota') ||
            errorStr.includes('limit')
          );

        if (isQuotaOrTransient) {
          const fallbackModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'].filter(m => m !== originalModel);
          for (const fallbackModel of fallbackModels) {
            console.warn(`[Gemini API Fallback] '${originalModel}' encountered transient error. Attempting automatic fallback to '${fallbackModel}'...`);
            try {
              const fallbackParams = { ...params, model: fallbackModel };
              return await callGeminiWithRetry(() => originalGenerateContent(fallbackParams));
            } catch (fallbackErr: any) {
              checkAndMarkAccessDenied(fallbackErr);
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
  const g = String(grade || '4');
  const m = String(materi || 'Aktivitas Kebugaran Jasmani & Pola Hidup Sehat').trim();
  const count = Math.max(1, Math.min(20, parseInt(jumlahSoal) || 5));
  const lowerM = m.toLowerCase();

  // Bank of specialized questions per PJOK domain
  let domainQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }> = [];

  if (lowerM.includes('sepak') || lowerM.includes('bola kaki') || lowerM.includes('futsal')) {
    domainQuestions = [
      {
        question: `Gerakan menghentikan atau mengontrol bola yang meluncur di tanah dalam permainan sepak bola paling efektif menggunakan...?`,
        options: ['A. Kaki bagian dalam atau telapak kaki', 'B. Tumit kaki bagian belakang', 'C. Punggung tangan', 'D. Ujung jari kaki'],
        correctAnswer: 'A',
        explanation: 'Kaki bagian dalam memiliki bidang kontak yang lebar dan lembut sehingga mampu meredam laju bola dengan stabil.'
      },
      {
        question: `Operan bola jarak pendek (short pass) antar rekan satu tim dalam sepak bola umumnya menggunakan bagian...?`,
        options: ['A. Kaki bagian luar', 'B. Kaki bagian dalam', 'C. Ujung jari kaki', 'D. Lutut bagian bawah'],
        correctAnswer: 'B',
        explanation: 'Operan kaki bagian dalam menghasilkan operan datar yang terarah, akurat, dan mudah dikuasai teman.'
      },
      {
        question: `Pemain yang diperbolehkan memegang atau menangkap bola menggunakan tangan saat permainan sepak bola berlangsung adalah...?`,
        options: ['A. Bek penyerang', 'B. Kapten regu', 'C. Penjaga gawang (Kiper) di area penalti', 'D. Gelandang bertahan'],
        correctAnswer: 'C',
        explanation: 'Kiper adalah satu-satunya pemain yang memiliki hak eksklusif memegang bola di dalam area gawangnya sendiri.'
      },
      {
        question: `Gerakan menggiring bola (dribbling) melewati rintangan pemain lawan bertujuan untuk...?`,
        options: ['A. Menghabiskan waktu permainan', 'B. Mendekatkan bola ke gawang lawan atau mencari ruang tembak', 'C. Menendang bola ke luar lapangan', 'D. Menunjukkan gaya di depan penonton'],
        correctAnswer: 'B',
        explanation: 'Dribbling berfungsi menguasai bola sambil bergerak maju mendekati pertahanan atau area gawang musuh.'
      },
      {
        question: `Sikap sportivitas yang harus ditunjukkan ketika regu kita mengalami kekalahan dalam pertandingan sepak bola adalah...?`,
        options: ['A. Menyalahkan wasit yang memimpin', 'B. Menolak bersalaman dengan regu lawan', 'C. Menerima kekalahan dengan lapang dada dan memberi selamat kepada pemenang', 'D. Keluar lapangan tanpa berpamitan'],
        correctAnswer: 'C',
        explanation: 'Nilai luhur olahraga PJOK mengajarkan sportivitas, menghargai lawan, dan lapang dada terhadap hasil pertandingan.'
      },
      {
        question: `Istilah menendang bola langsung ke arah gawang untuk mencetak skor disebut...?`,
        options: ['A. Passing', 'B. Shooting', 'C. Heading', 'D. Dribbling'],
        correctAnswer: 'B',
        explanation: 'Shooting merupakan teknik tembakan keras dan terarah ke gawang lawan untuk menghasilkan gol.'
      },
      {
        question: `Apabila bola keluar melalui garis samping lapangan permainan sepak bola, maka pertandingan dimulai kembali dengan...?`,
        options: ['A. Tendangan sudut', 'B. Lemparan ke dalam (Throw-in)', 'C. Tendangan penalti', 'D. Tendangan gawang'],
        correctAnswer: 'B',
        explanation: 'Bola yang melintasi garis samping lapangan dilanjutkan dengan lemparan ke dalam menggunakan kedua tangan dari atas kepala.'
      }
    ];
  } else if (lowerM.includes('voli') || lowerM.includes('volly')) {
    domainQuestions = [
      {
        question: `Teknik dasar menerima bola servis atau serangan lawan yang posisinya rendah dalam bola voli adalah...?`,
        options: ['A. Passing bawah', 'B. Passing atas', 'C. Smash keras', 'D. Blocking rapat'],
        correctAnswer: 'A',
        explanation: 'Passing bawah dilakukan dengan mengaitkan kedua lengan lurus ke depan untuk memantulkan bola rendah secara terkontrol.'
      },
      {
        question: `Saat melakukan passing bawah bola voli, perkenaan bola yang tepat dan stabil adalah pada bagian...?`,
        options: ['A. Telapak tangan terbuka', 'B. Bagian lengan bawah antara pergelangan dan siku', 'C. Ujung jari jemari', 'D. Persendian bahu atas'],
        correctAnswer: 'B',
        explanation: 'Permukaan datar antara pergelangan tangan dan siku memberikan pantulan bola yang paling halus dan stabil.'
      },
      {
        question: `Pukulan permulaan untuk menandai dimulainya suatu reli dalam pertandingan bola voli disebut...?`,
        options: ['A. Spike / Smash', 'B. Servis (Service)', 'C. Toss / Set', 'D. Block'],
        correctAnswer: 'B',
        explanation: 'Servis adalah pukulan pertama dari belakang garis lapangan untuk mengarahkan bola masuk ke area lawan.'
      },
      {
        question: `Jumlah pemain utama setiap regu bola voli yang berada di dalam lapangan pertandingan resmi adalah...?`,
        options: ['A. 5 orang', 'B. 6 orang', 'C. 7 orang', 'D. 11 orang'],
        correctAnswer: 'B',
        explanation: 'Satu regu bola voli standar diisi oleh 6 orang pemain aktif di lapangan dengan posisi rotasi yang teratur.'
      },
      {
        question: `Tindakan membendung serangan smash lawan di depan net dengan menjulurkan kedua tangan ke atas disebut...?`,
        options: ['A. Dribble', 'B. Passing atas', 'C. Blocking (Bendungan)', 'D. Digging'],
        correctAnswer: 'C',
        explanation: 'Blocking bertujuan menghalangi atau memantulkan kembali bola smash keras agar tidak jatuh di area pertahanan sendiri.'
      }
    ];
  } else if (lowerM.includes('basket')) {
    domainQuestions = [
      {
        question: `Teknik mengoper bola setinggi dada kepada rekan satu tim dalam bola basket disebut...?`,
        options: ['A. Bounce pass', 'B. Chest pass', 'C. Overhead pass', 'D. Baseball pass'],
        correctAnswer: 'B',
        explanation: 'Chest pass dilakukan dengan mendorong bola menggunakan kedua tangan lurus setinggi dada agar cepat sampai ke rekan.'
      },
      {
        question: `Teknik memantulkan bola ke lantai lapangan secara berulang sambil bergerak maju disebut...?`,
        options: ['A. Dribbling (Menggiring bola)', 'B. Pivot', 'C. Rebound', 'D. Lay-up shoot'],
        correctAnswer: 'A',
        explanation: 'Dribbling dalam bola basket dilakukan dengan mendorong bola memakai telapak tangan terbuka dan pergelangan tangan lentur.'
      },
      {
        question: `Mengoper bola dengan cara memantulkannya terlebih dahulu ke lantai untuk mengelabui lawan dinamakan...?`,
        options: ['A. Chest pass', 'B. Bounce pass', 'C. Overhead pass', 'D. Hook pass'],
        correctAnswer: 'B',
        explanation: 'Bounce pass adalah operan pantulan yang efektif melewati penjagaan lawan yang memiliki postur tinggi.'
      },
      {
        question: `Berapa poin yang diperoleh jika seorang pemain bola basket berhasil memasukkan bola dari dalam area garis lingkaran penalti...?`,
        options: ['A. 1 Poin', 'B. 2 Poin', 'C. 3 Poin', 'D. 4 Poin'],
        correctAnswer: 'B',
        explanation: 'Tembakan lapangan standar di dalam garis busur menghasilkan 2 poin untuk tim pencetak.'
      },
      {
        question: `Gerakan memutar badan dengan salah satu kaki tetap menempel di lantai sebagai poros tumpuan dinamakan...?`,
        options: ['A. Pivot', 'B. Travelling', 'C. Double dribble', 'D. Free throw'],
        correctAnswer: 'A',
        explanation: 'Pivot digunakan untuk melindungi bola dari rebutan lawan sambil mencari celah operan atau tembakan tanpa melanggar aturan.'
      }
    ];
  } else if (lowerM.includes('kasti') || lowerM.includes('rounders') || lowerM.includes('bola kecil')) {
    domainQuestions = [
      {
        question: `Dalam permainan kasti, regu yang bertugas melempar bola dan mematikan pelari lawan dinamakan...?`,
        options: ['A. Regu Pemukul', 'B. Regu Penjaga', 'C. Regu Cadangan', 'D. Regu Wasit'],
        correctAnswer: 'B',
        explanation: 'Regu penjaga bertugas menangkap bola pukulan dan melempar bola ke tubuh pelari lawan yang belum menyentuh tiang hinggap.'
      },
      {
        question: `Saat menangkap bola lambung tinggi dalam permainan kasti, posisi kedua telapak tangan sebaiknya...?`,
        options: ['A. Terbuka membentuk kantong / corong menghadap ke arah datangnya bola', 'B. Mengepal keras ke depan', 'C. Menutup rapat dengan jari saling silang', 'D. Terlentang ke bawah'],
        correctAnswer: 'A',
        explanation: 'Membuka telapak tangan seperti kantong memudahkan penangkapan bola lambung dan meredam pantulan bola keluar.'
      },
      {
        question: `Pemain yang bertugas melambungkan bola kepada pemukul sesuai permintaan dalam permainan kasti disebut...?`,
        options: ['A. Pitcher / Pelambung', 'B. Catcher / Penangkap', 'C. Striker / Penyerang', 'D. Kapten tim'],
        correctAnswer: 'A',
        explanation: 'Pelambung bertugas memberikan umpan lambung yang stabil dan ramah kepada kawan satu regu yang sedang memukul.'
      },
      {
        question: `Setelah memukul bola dengan baik, tongkat pemukul kasti harus diletakkan...?`,
        options: ['A. Dilempar sekuat tenaga ke penonton', 'B. Di dalam ruang pemukul / area yang aman', 'C. Di tengah lapangan lintasan lari', 'D. Diberikan kepada wasit'],
        correctAnswer: 'B',
        explanation: 'Menaruh tongkat pemukul di tempat aman di dalam ruang pemukul menghindari cedera tersandung bagi pelari lain.'
      },
      {
        question: `Tempat pemberhentian yang aman bagi pelari kasti agar tidak terkena lemparan bola oleh regu penjaga disebut...?`,
        options: ['A. Garis gawang', 'B. Tiang hinggap / Base', 'C. Garis serang', 'D. Ring keranjang'],
        correctAnswer: 'B',
        explanation: 'Pelari yang telah menginjak atau menyentuh tiang hinggap berada dalam zona bebas dan tidak sah untuk dilempar.'
      }
    ];
  } else if (lowerM.includes('lari') || lowerM.includes('atletik') || lowerM.includes('lompat') || lowerM.includes('estafet')) {
    domainQuestions = [
      {
        question: `Aba-aba resmi pada start jongkok untuk nomor lari jarak pendek (sprint) secara berurutan adalah...?`,
        options: ['A. Satu, Dua, Tiga!', 'B. Bersedia, Siap, Ya / Bunyi Pistol!', 'C. Awas, Siap, Lari!', 'D. Mulai, Berlari, Selesai!'],
        correctAnswer: 'B',
        explanation: 'Standar start lari atletik menggunakan aba-aba terstruktur: Bersedia (posisi jongkok), Siap (angkat panggul), Ya! (tolakan kaki).'
      },
      {
        question: `Bagian kaki yang digunakan sebagai tumpuan utama saat berlari sprint secepat mungkin adalah...?`,
        options: ['A. Tumit kaki belakang', 'B. Ujung kaki bagian depan (bola kaki)', 'C. Telapak kaki bagian tengah secara datar', 'D. Mata kaki luar'],
        correctAnswer: 'B',
        explanation: 'Berlari dengan bola kaki depan meminimalisir hambatan tanah dan memberikan dorongan pegas yang lebih eksplosif.'
      },
      {
        question: `Benda berbentuk silinder pendek yang dibawa dan dipindahkan secara bergantian dalam lari estafet disebut...?`,
        options: ['A. Tongkat estafet', 'B. Kasti kayu', 'C. Peluru besi', 'D. Matras busa'],
        correctAnswer: 'A',
        explanation: 'Tongkat estafet dipindahkan dari pelari pertama hingga pelari terakhir di dalam zona pergantian tongkat.'
      },
      {
        question: `Urutan tahapan gerak yang benar pada cabang atletik lompat jauh adalah...?`,
        options: ['A. Mendarat, melayang, menumpu, awalan', 'B. Awalan lari, tolakan / tumpuan, melayang di udara, dan mendarat', 'C. Melompat, berlari, jongkok, melayang', 'D. Tolakan, awalan, mendarat, melayang'],
        correctAnswer: 'B',
        explanation: 'Lompat jauh diawali dengan lari cepat (awalan), hentakan satu kaki di papan (tumpuan), kontrol sikap di udara (melayang), dan mendarat dua kaki mengeper.'
      },
      {
        question: `Sikap tubuh yang benar saat menyentuh bak pasir pendaratan pada lompat jauh adalah...?`,
        options: ['A. Mendarat dengan satu kaki tegak lurus kaku', 'B. Mendarat dengan kedua kaki bersamaan dan lutut ditekuk mengeper', 'C. Menjatuhkan badan ke belakang', 'D. Menahan tubuh dengan kepala lebih dulu'],
        correctAnswer: 'B',
        explanation: 'Mendarat dengan dua kaki bersamaan dan lutut ditekuk mengeper menyerap benturan sehingga terhindar dari cedera lutut.'
      }
    ];
  } else if (lowerM.includes('senam') || lowerM.includes('roll') || lowerM.includes('guling') || lowerM.includes('lilin')) {
    domainQuestions = [
      {
        question: `Alas pengaman khusus yang wajib digunakan saat melakukan latihan gerak senam lantai adalah...?`,
        options: ['A. Karpet lantai tipis', 'B. Matras busa yang empuk dan rata', 'C. Lapangan berumput licin', 'D. Lantai ubin semen'],
        correctAnswer: 'B',
        explanation: 'Matras berfungsi menyerap hentakan dan melindungi tulang punggung serta leher dari benturan keras.'
      },
      {
        question: `Bagian tubuh yang pertama kali menyentuh matras setelah tangan bertumpu saat melakukan guling depan (forward roll) adalah...?`,
        options: ['A. Dahi kepala bagian depan', 'B. Tengkuk / leher bagian belakang', 'C. Punggung bawah', 'D. Ujung hidung'],
        correctAnswer: 'B',
        explanation: 'Menempelkan dagu ke dada membuat tengkuk menyentuh matras lebih dahulu, sehingga kepala terlindung dari tekanan berlebih.'
      },
      {
        question: `Sikap lilin dalam senam lantai melatih unsur kebugaran jasmani yaitu...?`,
        options: ['A. Kecepatan lari sprint', 'B. Keseimbangan tubuh dan kekuatan otot perut', 'C. Daya tahan paru-paru', 'D. Kelincahan gerak kaki'],
        correctAnswer: 'B',
        explanation: 'Sikap lilin menuntut kekuatan otot perut dan punggung untuk menopang kaki lurus tegak ke atas secara seimbang.'
      },
      {
        question: `Sebelum melakukan gerakan senam lantai guling depan atau kayang, siswa wajib melakukan...?`,
        options: ['A. Makan camilan manis', 'B. Pemanasan dan peregangan persendian leher serta pinggang', 'C. Berlari kencang mengelilingi sekolah', 'D. Duduk bersantai di kelas'],
        correctAnswer: 'B',
        explanation: 'Peregangan leher, punggung, dan pergelangan tangan sangat penting mencegah kram dan salah urat pada senam lantai.'
      },
      {
        question: `Saat mendarat mengakhiri gerakan guling ke depan, posisi kedua kaki sebaiknya...?`,
        options: ['A. Terbuka lebar ke samping', 'B. Merapat dengan lutut ditekuk ke posisi jongkok stabil', 'C. Kaki lurus membentur lantai', 'D. Menyilang ke belakang'],
        correctAnswer: 'B',
        explanation: 'Posisi jongkok dengan kaki rapat dan tangan ke depan menjaga momentum serta memudahkan tubuh berdiri kembali.'
      }
    ];
  } else if (lowerM.includes('renang') || lowerM.includes('air') || lowerM.includes('kolam')) {
    domainQuestions = [
      {
        question: `Aturan keselamatan paling mendasar yang harus dipatuhi murid di tepi kolam renang adalah...?`,
        options: ['A. Dilarang berlari-lari di tepi kolam yang licin', 'B. Boleh mendorong teman ke area dalam', 'C. Membawa makanan ke dalam kolam renang', 'D. Berenang tanpa pengawasan guru'],
        correctAnswer: 'A',
        explanation: 'Lantai tepi kolam basah dan sangat licin sehingga berlari dapat menyebabkan terpeleset dan cedera fatal.'
      },
      {
        question: `Gaya renang yang gerakannya menyerupai gerakan katak saat berenang di air disebut renang gaya...?`,
        options: ['A. Gaya Bebas (Crawl)', 'B. Gaya Dada (Breaststroke)', 'C. Gaya Punggung (Backstroke)', 'D. Gaya Kupu-kupu (Butterfly)'],
        correctAnswer: 'B',
        explanation: 'Gaya dada sering disebut gaya katak karena kombinasi kayuhan tangan dan tendangan kakinya meniru katak.'
      },
      {
        question: `Teknik pengambilan napas pada renang gaya dada dilakukan dengan cara...?`,
        options: ['A. Mengangkat kepala ke atas permukaan air saat tangan mendayung ke belakang', 'B. Membuka mulut di dalam air', 'C. Menghirup udara saat kepala berada di dasar kolam', 'D. Memutar kepala ke arah samping kiri dan kanan'],
        correctAnswer: 'A',
        explanation: 'Dorongan tangan ke dada mengangkat bahu dan kepala keluar dari air untuk mengambil napas melalui mulut.'
      },
      {
        question: `Alat bantu apung yang biasa dipakai bagi siswa pemula yang sedang belajar mengapung dan meluncur adalah...?`,
        options: ['A. Kacamata renang', 'B. Papan luncur / pelampung (kickboard)', 'C. Matras senam', 'D. Sepatu olahraga'],
        correctAnswer: 'B',
        explanation: 'Papan pelampung membantu menopang tubuh bagian atas agar siswa dapat fokus melatih dorongan kaki di air.'
      },
      {
        question: `Sebelum masuk ke dalam air kolam renang, tubuh kita harus dibasahi atau dibilas terlebih dahulu untuk...?`,
        options: ['A. Menyesuaikan suhu tubuh dengan air kolam dan menjaga kebersihan air', 'B. Menambah berat badan', 'C. Membasahi baju seragam sekolah', 'D. Mempercepat rasa lapar'],
        correctAnswer: 'A',
        explanation: 'Membasahi tubuh membantu otot beradaptasi dengan temperatur air dingin agar tidak mengalami kram mendadak.'
      }
    ];
  } else if (lowerM.includes('kebugaran') || lowerM.includes('daya tahan') || lowerM.includes('kekuatan') || lowerM.includes('kelincahan')) {
    domainQuestions = [
      {
        question: `Latihan push-up secara teratur dan berulang-ulang bertujuan untuk menguatkan otot...?`,
        options: ['A. Otot betis dan paha', 'B. Otot dada, bahu, dan lengan (triceps)', 'C. Otot leher bagian samping', 'D. Otot jari kaki'],
        correctAnswer: 'B',
        explanation: 'Push-up bertumpu pada kedua tangan dan ujung kaki yang menuntut kerja kontraksi otot dada serta lengan atas.'
      },
      {
        question: `Gerakan sit-up paling bermanfaat untuk melatih kekuatan dan kekencangan otot...?`,
        options: ['A. Otot perut (abdomen)', 'B. Otot tumit', 'C. Otot pergelangan tangan', 'D. Otot tempurung lutut'],
        correctAnswer: 'A',
        explanation: 'Sit-up menggerakkan tubuh bagian atas mendekati lutut yang digerakkan oleh kontraksi otot-otot dinding perut.'
      },
      {
        question: `Lari bolak-balik memindahkan balok atau menyentuh garis (shuttle run) bertujuan untuk mengukur dan melatih...?`,
        options: ['A. Kelenturan punggung', 'B. Kelincahan (agility) dan kecepatan mengubah arah', 'C. Ketinggian lompatan', 'D. Daya tahan pernapasan air'],
        correctAnswer: 'B',
        explanation: 'Kelincahan adalah kemampuan mengubah arah gerak tubuh dengan cepat dan tepat tanpa kehilangan keseimbangan.'
      },
      {
        question: `Untuk menjaga daya tahan jantung dan paru-paru (kardiovaskular), jenis latihan fisik yang paling tepat adalah...?`,
        options: ['A. Joging santai atau lari lintas alam secara teratur', 'B. Angkat beban berat sekali waktu', 'C. Duduk diam bermeditasi', 'D. Tidur siang lebih lama'],
        correctAnswer: 'A',
        explanation: 'Latihan aerobik berkelanjutan seperti joging memacu efisiensi pasokan oksigen oleh jantung dan paru-paru.'
      },
      {
        question: `Waktu istirahat tidur yang cukup dan ideal bagi anak usia Sekolah Dasar untuk pemulihan tubuh adalah...?`,
        options: ['A. 3 sampai 4 jam sehari', 'B. 8 sampai 10 jam setiap malam', 'C. 14 jam terus menerus', 'D. 1 jam saja'],
        correctAnswer: 'B',
        explanation: 'Anak usia sekolah membutuhkan tidur 8-10 jam untuk proses pertumbuhan optimal dan perbaikan jaringan sel tubuh.'
      }
    ];
  } else if (lowerM.includes('gizi') || lowerM.includes('sehat') || lowerM.includes('makanan') || lowerM.includes('kebersihan') || lowerM.includes('penyakit')) {
    domainQuestions = [
      {
        question: `Zat makanan yang menjadi sumber tenaga atau energi utama bagi tubuh kita saat berolahraga adalah...?`,
        options: ['A. Karbohidrat (seperti nasi, jagung, roti, dan kentang)', 'B. Lemak jenuh', 'C. Pengawet buatan', 'D. Pewarna sintetis'],
        correctAnswer: 'A',
        explanation: 'Karbohidrat dipecah menjadi glukosa yang digunakan otot sebagai bahan bakar utama dalam melakukan aktivitas fisik.'
      },
      {
        question: `Zat makanan yang berfungsi sebagai zat pembangun serta memperbaiki sel-sel tubuh yang rusak adalah...?`,
        options: ['A. Karbohidrat', 'B. Protein (seperti telur, ikan, tahu, tempe, susu)', 'C. Gula pasir', 'D. Minyak goreng'],
        correctAnswer: 'B',
        explanation: 'Protein mengandung asam amino esensial yang sangat penting dalam pembentukan jaringan otot dan pemulihan tubuh.'
      },
      {
        question: `Cara mencuci tangan yang benar untuk mencegah penularan kuman penyakit adalah...?`,
        options: ['A. Mengelap tangan pada celana olahraga', 'B. Mencuci dengan sabun di bawah air bersih yang mengalir minimal 20 detik', 'C. Mencelupkan tangan ke ember air kotor', 'D. Cukup membasahi ujung jari dengan air dingin'],
        correctAnswer: 'B',
        explanation: 'Air mengalir dan sabun merontokkan kuman, bakteri, serta virus yang menempel pada lipatan telapak tangan.'
      },
      {
        question: `Tindakan pertolongan pertama yang tepat saat mengalami luka lecet ringan akibat terjatuh di lapangan adalah...?`,
        options: ['A. Membiarkan luka terkena debu tanah', 'B. Membersihkan luka dengan air bersih mengalir lalu mengoleskan cairan antiseptik', 'C. Menggosok luka dengan kain kotor', 'D. Menutup luka dengan tanah liat'],
        correctAnswer: 'B',
        explanation: 'Membersihkan kotoran dengan air mengalir dan memberi antiseptik membunuh kuman serta mencegah infeksi luka.'
      },
      {
        question: `Menjaga kebersihan pakaian olahraga setelah digunakan berolahraga dilakukan dengan cara...?`,
        options: ['A. Langsung dicuci dengan sabun cuci hingga bersih dan dijemur', 'B. Dibiarkan menumpuk basah di dalam tas sekolah berhari-hari', 'C. Dipakai kembali berulang kali tanpa dicuci', 'D. Disemprot parfum tanpa dicuci'],
        correctAnswer: 'A',
        explanation: 'Baju olahraga yang basah oleh keringat mengandung bakteri yang mudah menimbulkan bau tidak sedap dan penyakit kulit jika tidak segera dicuci.'
      }
    ];
  } else if (lowerM.includes('silat') || lowerM.includes('bela diri') || lowerM.includes('pencak')) {
    domainQuestions = [
      {
        question: `Sikap dasar menapakkan kaki untuk memperkokoh posisi tubuh agar tidak mudah goyah atau jatuh saat diserang lawan dalam pencak silat disebut...?`,
        options: ['A. Kuda-kuda', 'B. Sikap istirahat', 'C. Langkah tegap', 'D. Duduk bersila'],
        correctAnswer: 'A',
        explanation: 'Kuda-kuda adalah tumpuan kaki yang kokoh untuk menopang berat badan dan menjaga keseimbangan saat menyerang atau bertahan.'
      },
      {
        question: `Sikap siap menghadapi lawan yang dilengkapi dengan koordinasi kesiagaan tangan dan tumpuan kaki disebut...?`,
        options: ['A. Sikap pasang', 'B. Sikap hormat', 'C. Sikap tidur', 'D. Sikap bersalaman'],
        correctAnswer: 'A',
        explanation: 'Sikap pasang merupakan kombinasi sikap kuda-kuda dan posisi tangan siaga dalam mengantisipasi serangan lawan.'
      },
      {
        question: `Gerakan tangan yang bertujuan membendung atau mengalihkan lintasan pukulan lawan agar tidak mengenai tubuh disebut teknik...?`,
        options: ['A. Tangkisan', 'B. Pukulan bandul', 'C. Tendangan sabit', 'D. Kuncian leher'],
        correctAnswer: 'A',
        explanation: 'Tangkisan berfungsi menghalau atau membelokkan arah serangan lawan dengan memanfaatkan lengan atau kaki.'
      },
      {
        question: `Nilai budi pekerti luhur utama yang wajib dimiliki oleh seorang pesilat sejati adalah...?`,
        options: ['A. Menggunakan ilmu bela diri untuk melindungi diri dan menolong sesama dengan rendah hati', 'B. Suka berkelahi dan memamerkan kekuatan di depan teman', 'C. Menantang siapa saja yang tidak disukai', 'D. Bersikap sombong dan arogan'],
        correctAnswer: 'A',
        explanation: 'Falsafah bela diri pencak silat mengajarkan ketaqwaan, kerendahan hati, membela kebenaran, dan menahan emosi.'
      },
      {
        question: `Pukulan lurus ke depan dengan sasaran dada lawan dalam pencak silat dilakukan dengan posisi kepalan tangan...?`,
        options: ['A. Menggenggam rapat dengan dorongan bahu dan lecutan pinggang', 'B. Terbuka lemas ke bawah', 'C. Mengacungkan satu jari telunjuk', 'D. Menekuk pergelangan tangan ke belakang'],
        correctAnswer: 'A',
        explanation: 'Dorongan bahu dan perputaran pinggang menyalurkan tenaga maksimal menuju kepalan tangan lurus ke sasaran.'
      }
    ];
  } else if (lowerM.includes('irama') || lowerM.includes('ritmik') || lowerM.includes('berirama')) {
    domainQuestions = [
      {
        question: `Unsur utama yang paling membedakan aktivitas gerak berirama (senam irama) dengan senam lainnya adalah...?`,
        options: ['A. Ketepatan gerakan mengikuti ketukan musik atau hitungan irama', 'B. Kecepatan mengangkat beban besi', 'C. Waktu tidur yang lama', 'D. Lari sekencang-kencangnya'],
        correctAnswer: 'A',
        explanation: 'Senam irama memadukan keselarasan antara gerak tubuh (langkah kaki dan ayunan lengan) dengan tempo ketukan musik.'
      },
      {
        question: `Sikap tubuh yang rileks, tidak kaku, dan gemulai saat melakukan gerakan senam irama disebut dengan unsur...?`,
        options: ['A. Keluwesan (fleksibilitas)', 'B. Kekakuan otot', 'C. Ketergesa-gesaan', 'D. Kekerasan pukulan'],
        correctAnswer: 'A',
        explanation: 'Keluwesan membuat transisi rangkaian gerak ayunan lengan dan langkah kaki mengalir indah tanpa ketegangan otot.'
      },
      {
        question: `Istilah langkah biasa dalam senam irama dikenal dengan sebutan...?`,
        options: ['A. Looppas', 'B. Bijtrekpas', 'C. Galoppas', 'D. Wallpas'],
        correctAnswer: 'A',
        explanation: 'Looppas adalah langkah biasa ke depan dengan tumit menapak terlebih dahulu diikuti telapak kaki dan ujung jari.'
      },
      {
        question: `Gerakan mengayunkan kedua lengan dari depan ke samping atau melingkar di atas kepala bertujuan untuk melatih kelenturan persendian...?`,
        options: ['A. Sendi bahu dan dada', 'B. Sendi pergelangan kaki', 'C. Sendi jari kelingking', 'D. Sendi lutut bagian bawah'],
        correctAnswer: 'A',
        explanation: 'Ayunan lengan melibatkan luas gerak sendi bahu yang membantu meregangkan otot dada dan punggung.'
      },
      {
        question: `Latihan gerak berirama yang dilakukan secara kompak bersama teman-teman sekelas dapat memupuk nilai...?`,
        options: ['A. Kekompakan, keselarasan, dan kebersamaan', 'B. Persaingan saling menjatuhkan', 'C. Keinginan tampil sendiri paling menonjol', 'D. Kemalasan bergerak'],
        correctAnswer: 'A',
        explanation: 'Senam irama beregu mengasah kepekaan menyamakan ritme bersama sehingga menumbuhkan gotong royong dan kekompakan.'
      }
    ];
  } else if (lowerM.includes('tradisional') || lowerM.includes('gobak') || lowerM.includes('benteng') || lowerM.includes('engklek')) {
    domainQuestions = [
      {
        question: `Dalam permainan tradisional gobak sodor (galasin), pemain yang bertugas menjaga garis lurus di tengah memotong lapangan dinamakan...?`,
        options: ['A. Penjaga garis sodor', 'B. Penjaga gawang', 'C. Pemain cadangan', 'D. Wasit penonton'],
        correctAnswer: 'A',
        explanation: 'Penjaga sodor memiliki hak bergerak bebas maju-mundur di sepanjang garis vertikal tengah untuk menghadang lawan melintas.'
      },
      {
        question: `Unsur kebugaran jasmani yang paling dominan dilatih saat bermain bentengan dan gobak sodor adalah...?`,
        options: ['A. Kelincahan (agility), kecepatan berlari, dan kerjasama tim', 'B. Daya tahan tidur', 'C. Kekuatan mengangkat meja', 'D. Ketenangan memanah'],
        correctAnswer: 'A',
        explanation: 'Permainan tradisional melatih respon gerak cepat, perubahan arah menghindar, dan koordinasi taktis bersama regu.'
      },
      {
        question: `Cara melompat pada petak-petak permainan tradisional engklek dilakukan dengan menggunakan...?`,
        options: ['A. Satu kaki bertumpu secara seimbang (engklek/hop)', 'B. Kedua tangan di lantai', 'C. Berjalan merangkak', 'D. Duduk meluncur'],
        correctAnswer: 'A',
        explanation: 'Engklek melatih kekuatan tungkai kaki tunggal dan keseimbangan tubuh dinamis saat mendarat di tiap petak gambar.'
      },
      {
        question: `Ketika seorang pemain regu penyerang tersentuh oleh tangan regu penjaga dalam permainan bentengan, maka pemain tersebut harus...?`,
        options: ['A. Menjadi tawanan di dekat benteng lawan hingga diselamatkan rekan setim', 'B. Keluar lapangan dan menangis', 'C. Mengganti peraturan sesuka hati', 'D. Memukul pemain yang menyentuh'],
        correctAnswer: 'A',
        explanation: 'Pemain yang tertawan dapat kembali bermain jika tersentuh oleh rekannya yang berhasil menerobos pertahanan lawan.'
      },
      {
        question: `Manfaat melestarikan permainan tradisional bagi anak-anak Indonesia adalah...?`,
        options: ['A. Menjaga warisan budaya bangsa, menjalin pertemanan akrab, dan menyehatkan tubuh secara gembira', 'B. Mengurangi waktu belajar', 'C. Menghabiskan uang jajan', 'D. Merusak lapangan sekolah'],
        correctAnswer: 'A',
        explanation: 'Permainan tradisional sarat kearifan lokal yang mengajarkan nilai sosial, kejujuran, dan keaktifan fisik tanpa gawai.'
      }
    ];
  } else if (lowerM.includes('bulu tangkis') || lowerM.includes('badminton') || lowerM.includes('tenis meja')) {
    domainQuestions = [
      {
        question: `Cara memegang raket bulu tangkis seperti sedang bersalaman tangan dengan orang lain dinamakan pegangan...?`,
        options: ['A. Forehand grip', 'B. Backhand grip', 'C. Penholder grip', 'D. American grip'],
        correctAnswer: 'A',
        explanation: 'Forehand grip menempatkan ibu jari dan jari telunjuk membentuk huruf V menyerupai jabat tangan yang mantap.'
      },
      {
        question: `Pukulan permulaan untuk menyeberangkan shuttlecock melewati net ke bidang servis lawan dalam bulu tangkis disebut...?`,
        options: ['A. Servis', 'B. Smash keras', 'C. Dropshot tipis', 'D. Netting'],
        correctAnswer: 'A',
        explanation: 'Servis adalah pukulan legal pembuka setiap reli poin dalam pertandingan bulu tangkis.'
      },
      {
        question: `Pukulan smash keras dan menukik tajam ke lantai lapangan lawan bertujuan utama untuk...?`,
        options: ['A. Mematikan lawan dan segera mencetak poin angka', 'B. Membuang shuttlecock ke luar garis', 'C. Mengulur waktu permainan', 'D. Menyerahkan shuttlecock kepada wasit'],
        correctAnswer: 'A',
        explanation: 'Smash merupakan senjata penyerangan utama yang mengandalkan kecepatan pukulan lecutan pergelangan tangan.'
      },
      {
        question: `Bola kecil bersayap bulu unggas yang digunakan dalam permainan bulu tangkis disebut...?`,
        options: ['A. Shuttlecock (Kok)', 'B. Bola kasti', 'C. Bola tenis karet', 'D. Frisbee'],
        correctAnswer: 'A',
        explanation: 'Shuttlecock terbuat dari gabus bundar yang dilapisi kulit dan ditancapi 16 helai bulu unggas pilihan.'
      }
    ];
  } else if (lowerM.includes('rokok') || lowerM.includes('napza') || lowerM.includes('miras') || lowerM.includes('narkoba')) {
    domainQuestions = [
      {
        question: `Zat berbahaya di dalam rokok yang bersifat adiktif sehingga menyebabkan orang menjadi kecanduan merokok adalah...?`,
        options: ['A. Nikotin', 'B. Vitamin C', 'C. Glukosa murni', 'D. Kalsium'],
        correctAnswer: 'A',
        explanation: 'Nikotin memengaruhi reseptor dopamine di otak sehingga memicu ketergantungan fisik dan psikis yang kuat.'
      },
      {
        question: `Gas beracun tidak berwarna dan tidak berbau yang dihasilkan dari asap rokok dan mengurangi pasokan oksigen darah adalah...?`,
        options: ['A. Karbon monoksida (CO)', 'B. Oksigen murni (O2)', 'C. Gas nitrogen cair', 'D. Uap air hangat'],
        correctAnswer: 'A',
        explanation: 'Karbon monoksida mengikat hemoglobin darah 200 kali lebih kuat daripada oksigen, sehingga organ tubuh kekurangan oksigen.'
      },
      {
        question: `Sikap yang paling tepat jika ada seseorang yang menawarkan rokok atau obat-obatan mencurigakan kepada kita adalah...?`,
        options: ['A. Menolak dengan tegas ("Katakan TIDAK!"), menjauh, dan segera melaporkan kepada guru atau orang tua', 'B. Menerimanya karena penasaran', 'C. Menyimpannya di dalam saku', 'D. Membagikannya kepada teman sekelas'],
        correctAnswer: 'A',
        explanation: 'Menjaga diri dari zat adiktif membutuhkan keberanian menolak secara asertif serta meminta pendampingan orang dewasa.'
      },
      {
        question: `Organ tubuh manusia yang paling rentan mengalami kerusakan parah akibat zat tar berbahaya pada asap rokok adalah...?`,
        options: ['A. Paru-paru dan jantung', 'B. Tulang tumit', 'C. Kuku jempol', 'D. Rambut alis'],
        correctAnswer: 'A',
        explanation: 'Tar mengendap pada silia dan alveolus paru-paru yang menyebabkan kanker, bronkitis kronis, dan penyumbatan arteri jantung.'
      }
    ];
  } else if (lowerM.includes('pubertas') || lowerM.includes('reproduksi') || lowerM.includes('kelamin')) {
    domainQuestions = [
      {
        question: `Tindakan menjaga kebersihan tubuh yang wajib dibiasakan saat memasuki masa pubertas karena kelenjar keringat mulai aktif adalah...?`,
        options: ['A. Mandi teratur minimal 2 kali sehari menggunakan sabun mandi dan mengeringkan tubuh dengan handuk bersih', 'B. Jarang mandi agar kulit tidak kering', 'C. Cukup menyemprotkan minyak wangi tanpa mandi', 'D. Tidak pernah berganti baju olahraga'],
        correctAnswer: 'A',
        explanation: 'Mandi teratur membersihkan keringat, sebum minyak, dan bakteri yang dapat menimbulkan bau badan dan gatal-gatal pada kulit.'
      },
      {
        question: `Pakaian dalam yang paling sehat dan aman untuk digunakan sehari-hari sebaiknya terbuat dari bahan...?`,
        options: ['A. Katun yang lembut dan mudah menyerap keringat', 'B. Plastik tebal yang kedap udara', 'C. Wol kaku yang panas', 'D. Kertas sekali pakai'],
        correctAnswer: 'A',
        explanation: 'Bahan katun menjaga sirkulasi udara pada area lipatan tubuh dan menyerap kelembapan sehingga mencegah timbulnya jamur kulit.'
      },
      {
        question: `Setelah buang air kecil atau buang air besar, cara membersihkan area tubuh yang benar adalah...?`,
        options: ['A. Membasuh dengan air bersih mengalir dari depan ke arah belakang lalu dikeringkan', 'B. Cukup mengusap dengan tangan kotor', 'C. Membiarkan basah tanpa dikeringkan', 'D. Mengelap pada baju seragam'],
        correctAnswer: 'A',
        explanation: 'Membasuh dari depan ke belakang mencegah perpindahan kuman bakteri dari anus ke saluran kemih.'
      },
      {
        question: `Bagian tubuh yang tertutup pakaian dalam merupakan area privasi pribadi yang...?`,
        options: ['A. Tidak boleh dilihat atau disentuh oleh orang lain sembarangan', 'B. Boleh diperlihatkan di tempat umum', 'C. Boleh difoto oleh orang asing', 'D. Tidak perlu dilindungi'],
        correctAnswer: 'A',
        explanation: 'Edukasi perlindungan diri mengajarkan bahwa anggota tubuh privat harus dijaga martabatnya demi keamanan dan keselamatan anak.'
      }
    ];
  } else if (parseInt(g) <= 2 || lowerM.includes('lokomotor') || lowerM.includes('non-lokomotor') || lowerM.includes('manipulatif')) {
    domainQuestions = [
      {
        question: `Gerakan berjalan ke depan dengan langkah santai dan pandangan mata tertuju ke...?`,
        options: ['A. Depan lintasan jalan', 'B. Atas langit-langit terus menerus', 'C. Belakang sambil memejamkan mata', 'D. Bawah sepatu tanpa melihat jalan'],
        correctAnswer: 'A',
        explanation: 'Memandang lurus ke depan menjaga keseimbangan tubuh dan membantu kita melihat rintangan di jalan.'
      },
      {
        question: `Perbedaan antara melompat dan meloncat dalam gerak lokomotor adalah...?`,
        options: ['A. Melompat bertumpu pada 1 kaki, sedangkan meloncat bertumpu pada 2 kaki bersamaan', 'B. Melompat sambil duduk di lantai', 'C. Meloncat dilakukan dengan tangan', 'D. Keduanya tidak menggunakan kaki'],
        correctAnswer: 'A',
        explanation: 'Secara keilmuan gerak dasar PJOK: melompat (jump/hop) menolak 1 kaki, meloncat (leap) menolak dengan 2 kaki bersamaan.'
      },
      {
        question: `Gerakan memutar kepala, mengayunkan kedua lengan, dan meliukkan badan ke samping tanpa berpindah tempat disebut gerak...?`,
        options: ['A. Gerak Non-lokomotor', 'B. Gerak Lokomotor', 'C. Gerak Manipulatif', 'D. Gerak Lari Cepat'],
        correctAnswer: 'A',
        explanation: 'Gerak non-lokomotor adalah aktivitas gerak yang dilakukan di tempat poros tubuh tanpa perpindahan letak posisi.'
      },
      {
        question: `Aktivitas melempar bola karet lunak ke arah keranjang sasaran termasuk contoh gerakan...?`,
        options: ['A. Gerak Manipulatif', 'B. Gerak Lokomotor', 'C. Gerak Non-lokomotor', 'D. Gerak Statis'],
        correctAnswer: 'A',
        explanation: 'Gerak manipulatif melibatkan keterampilan anggota tubuh mengontrol objek atau benda olahraga seperti bola.'
      },
      {
        question: `Waktu yang tepat untuk menggosok gigi setiap hari agar gigi tetap bersih, sehat, dan tidak berlubang adalah...?`,
        options: ['A. Pagi setelah sarapan dan malam sebelum tidur', 'B. Satu minggu sekali saja', 'C. Hanya saat gigi terasa sakit', 'D. Sambil tidur siang'],
        correctAnswer: 'A',
        explanation: 'Menggosok gigi setelah makan pagi dan sebelum tidur membersihkan sisa makanan dan mencegah bakteri merusak lapisan email gigi.'
      }
    ];
  } else {
    // General PJOK curriculum fundamentals matched with user topic
    domainQuestions = [
      {
        question: `Dalam pembelajaran materi "${m}" pada PJOK Kelas ${g} SD, tujuan utama pemanasan sebelum praktik adalah...?`,
        options: [
          'A. Menyiapkan otot dan sendi agar terhindar dari cedera',
          'B. Menghabiskan tenaga sebelum bermain',
          'C. Menunggu teman yang belum hadir',
          'D. Membuat tubuh menjadi cepat lelah'
        ],
        correctAnswer: 'A',
        explanation: 'Pemanasan bertahap menaikkan suhu tubuh dan elastisitas otot sehingga siap melakukan gerak inti dengan aman.'
      },
      {
        question: `Gerakan berpindah tempat dari satu posisi ke posisi lain dalam materi "${m}" termasuk kategori gerak...?`,
        options: [
          'A. Gerak Lokomotor',
          'B. Gerak Non-lokomotor',
          'C. Gerak Manipulatif',
          'D. Gerak Statis'
        ],
        correctAnswer: 'A',
        explanation: 'Gerak lokomotor adalah gerak dasar manusia yang ditandai dengan adanya perpindahan tempat tubuh (misal: berjalan, berlari, melompat).'
      },
      {
        question: `Sikap tubuh yang benar saat melakukan gerakan melompat dan mendarat dalam pembelajaran "${m}" adalah...?`,
        options: [
          'A. Kaki kaku lurus membentur tanah',
          'B. Kedua lutut sedikit mengeper (ditekuk) untuk meredam beban pendaratan',
          'C. Menjatuhkan pinggang ke samping',
          'D. Menumpu dengan satu ujung jari kaki saja'
        ],
        correctAnswer: 'B',
        explanation: 'Mengeperkan lutut saat mendarat mendistribusikan gaya hentakan secara merata dan mencegah cedera pada sendi lutut serta pergelangan kaki.'
      },
      {
        question: `Saat melakukan aktivitas fisik "${m}", sikap sportif yang harus ditunjukkan oleh setiap murid adalah...?`,
        options: [
          'A. Selalu ingin menang sendiri dengan cara curang',
          'B. Mengikuti aturan kegiatan, jujur, dan menghargai teman maupun guru',
          'C. Marah saat regunya mengalami kekalahan',
          'D. Mengejek teman yang belum menguasai gerakan'
        ],
        correctAnswer: 'B',
        explanation: 'Sportivitas menanamkan integritas, kepatuhan pada aturan, dan sikap saling menghargai sesama peserta didik.'
      },
      {
        question: `Setelah selesai mempraktikkan materi pembelajaran "${m}", kegiatan penutup yang bermanfaat untuk memulihkan denyut nadi adalah...?`,
        options: [
          'A. Pendinginan (cooling down) dan relaksasi napas',
          'B. Langsung meminum es manis dalam jumlah banyak',
          'C. Tidur tengkurap di lapangan terik',
          'D. Melompat-lompat sekeras-kerasnya'
        ],
        correctAnswer: 'A',
        explanation: 'Pendinginan membantu menurunkan detak jantung secara bertahap menuju ritme normal serta mengurangi penumpukan asam laktat di otot.'
      },
      {
        question: `Gerak memanipulasi atau mengendalikan suatu benda/alat (seperti bola, simpai, atau tongkat) dalam materi "${m}" disebut gerak...?`,
        options: [
          'A. Manipulatif',
          'B. Non-lokomotor',
          'C. Lokomotor',
          'D. Refleks'
        ],
        correctAnswer: 'A',
        explanation: 'Gerak manipulatif melibatkan penguasaan koordinasi mata, tangan, dan kaki terhadap objek atau alat olahraga.'
      },
      {
        question: `Pakaian yang paling tepat dan aman saat mengikuti praktik materi "${m}" di lapangan adalah...?`,
        options: [
          'A. Seragam pramuka lengkap dengan baret',
          'B. Kaos dan celana olahraga yang menyerap keringat serta sepatu olahraga',
          'C. Baju pesta dengan sandal jepit',
          'D. Pakaian tebal berbahan wol kaku'
        ],
        correctAnswer: 'B',
        explanation: 'Pakaian olahraga memberikan keleluasaan bergerak secara optimal dan sepatu olahraga melindungi kaki dari benturan dan gesekan lantai lapangan.'
      }
    ];
  }

  // Ensure we have enough questions by cycling or padding if count is large
  const resultQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }> = [];

  let idx = 0;
  while (resultQuestions.length < count) {
    const template = domainQuestions[idx % domainQuestions.length];
    if (resultQuestions.length < domainQuestions.length) {
      resultQuestions.push({ ...template });
    } else {
      // Create variations for large counts (e.g. 10 or 15 soal)
      const qNum = resultQuestions.length + 1;
      resultQuestions.push({
        question: `[Variasi Soal ${qNum}] Terkait materi "${m}" Kelas ${g} SD: ${template.question}`,
        options: [...template.options],
        correctAnswer: template.correctAnswer,
        explanation: template.explanation
      });
    }
    idx++;
  }

  const selectedQuestions = resultQuestions.slice(0, count);

  return {
    materi: m,
    grade: g,
    totalSoal: count,
    questions: selectedQuestions,
    soalList: selectedQuestions.map((q, i) => {
      const optA = q.options[0]?.replace(/^A\.\s*/, '') || '';
      const optB = q.options[1]?.replace(/^B\.\s*/, '') || '';
      const optC = q.options[2]?.replace(/^C\.\s*/, '') || '';
      const optD = q.options[3]?.replace(/^D\.\s*/, '') || '';
      return {
        id: `soal-${i + 1}`,
        pertanyaan: q.question,
        pilihan: {
          A: optA,
          B: optB,
          C: optC,
          D: optD
        },
        kunciJawaban: q.correctAnswer,
        pembahasan: q.explanation
      };
    })
  };
}

function getFallbackSummative(params: any, maybeMateri?: any) {
  const seed = params?.seed || (Date.now() + "_" + Math.random().toString(36).slice(2, 9));
  return generateSummativeAssessment({
    ...params,
    seed
  });
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
  const t = topic || reqBody?.topikMateri || 'Aktivitas Pola Gerak Dasar dan Kebugaran Jasmani';
  const g = grade || reqBody?.kelas || '5';
  const mp = reqBody?.mataPelajaran || 'Pendidikan Jasmani, Olahraga, dan Kesehatan';
  const f = reqBody?.fase || 'C';
  const count = parseInt(totalSlides || reqBody?.jumlahSlide) || 8;
  const penyusun = reqBody?.guruPenyusun || 'Guru Mata Pelajaran';
  const slides = [];

  slides.push({
    slideNo: 1,
    layoutType: 'Cover / Title Slide',
    title: t,
    points: [
      `Mata Pelajaran: ${mp}`,
      `Kelas: ${g} (Fase ${f})`,
      `Topik Utama: ${t}`,
      `Penyusun: ${penyusun}`,
      'Kurikulum Merdeka - Pembelajaran Mendalam & Menyenangkan'
    ],
    speakerNotes: `Buka sesi pembelajaran dengan mengucapkan salam hangat, perkenalkan topik "${t}", dan bangkitkan rasa antusias peserta didik dengan pertanyaan pemantik terkait pengalaman gerak mereka sehari-hari.`,
    visualRecommendation: `Background bertema olahraga dinamis dan modern dengan gradasi warna sesuai tema visual, menampilkan tipografi judul besar "${t}", ilustrasi peserta didik aktif bergerak, dan logo sekolah.`
  });

  slides.push({
    slideNo: 2,
    layoutType: 'Tujuan & Apersepsi',
    title: `Tujuan Pembelajaran: ${t}`,
    points: [
      `Memahami konsep dan variasi pola dalam ${t}`,
      `Mempraktikkan teknik dasar ${t} secara benar, aman, dan percaya diri`,
      'Menumbuhkan sikap sportivitas, disiplin, dan gotong royong dalam kelompok',
      'Mengidentifikasi manfaat gerakan bagi kebugaran tubuh'
    ],
    speakerNotes: `Jelaskan capaian pembelajaran yang harus dikuasai murid hari ini mengenai topik ${t}. Ajak murid mengamati demonstrasi singkat atau video singkat.`,
    visualRecommendation: `Grafik target panahan, ikon buku terbuka, dan diagram alur langkah pembelajaran yang komunikatif dan terstruktur rapi.`
  });

  slides.push({
    slideNo: 3,
    layoutType: 'Konsep Dasar & Pemahaman',
    title: `Konsep Dasar: ${t}`,
    points: [
      `Pengertian dan esensi dasar dari ${t}`,
      'Mengapa gerakan ini penting dilakukan dengan koordinasi tubuh yang tepat?',
      'Prinsip biomekanika sederhana: posisi tubuh, keseimbangan, dan tumpuan',
      'Contoh situasi nyata penerapan gerakan ini dalam kehidupan sehari-hari'
    ],
    speakerNotes: `Diskusikan bersama murid mengenai definisi dasar dan ajukan pertanyaan pemantik: "Siapa yang pernah mempraktikkan gerakan ini di rumah?".`,
    visualRecommendation: `Infografis anatomi gerak tubuh dengan petunjuk panah visual penanda arah gerakan dan postur yang benar.`
  });

  slides.push({
    slideNo: 4,
    layoutType: 'Tahapan & Teknik Praktik',
    title: `Tahapan Praktik: ${t}`,
    points: [
      '1. Sikap Awal: Berdiri tegak, pandangan fokus ke depan, rileks',
      `2. Gerakan Inti: Pelaksanaan teknik ${t} dengan ritme stabil`,
      '3. Sikap Akhir: Pendaratan/keseimbangan terjaga dengan aman',
      '4. Kesalahan Umum yang harus dihindari: tubuh terlalu kaku atau terburu-buru'
    ],
    speakerNotes: `Instruksikan peserta didik untuk memperhatikan peragaan 3 langkah utama pelaksanaan ${t}. Berikan penekanan pada aspek keselamatan diri.`,
    visualRecommendation: `Foto berseri 3 langkah gerakan (step-by-step) dengan highlight kotak berwarna pada tumpuan kaki dan ayunan tangan.`
  });

  for (let i = 5; i < count; i++) {
    slides.push({
      slideNo: i,
      layoutType: 'Aktivitas & Variasi Gerak',
      title: `Eksplorasi & Variasi ${t} (Bagian ${i - 4})`,
      points: [
        `Variasi latihan berpasangan dan beregu untuk materi ${t}`,
        'Permainan pos interaktif untuk mengasah kelincahan dan koordinasi',
        'Tantangan mini: Mencapai target gerak dengan teknik yang konsisten',
        'Saling memberikan umpan balik positif antar teman kelompok'
      ],
      speakerNotes: `Bagi peserta didik ke dalam kelompok-kelompok kecil. Awasi pelaksanaan aktivitas dan berikan dorongan semangat.`,
      visualRecommendation: `Foto ilustrasi kerja sama tim di lapangan sekolah dengan layout bento box modern.`
    });
  }

  slides.push({
    slideNo: count,
    layoutType: 'Refleksi & Kuis Penutup',
    title: `Refleksi & Evaluasi: ${t}`,
    points: [
      `Kuis Singkat: Apa kunci keberhasilan dalam melakukan ${t}?`,
      'Refleksi Diri: Apa tantangan paling berkesan hari ini dan bagaimana cara mengatasinya?',
      'Kesimpulan: Nilai kebugaran, kedisiplinan, dan kerja sama yang dipelajari',
      'Pesan Penutup: "Tubuh Sehat, Pikiran Cerdas, Hati Gembira! Sampai jumpa di pertemuan berikutnya!"'
    ],
    speakerNotes: `Lakukan pendinginan bersama, pimpin refleksi pembelajaran, berikan apresiasi kepada seluruh murid, dan tutup dengan doa bersama.`,
    visualRecommendation: `Visual emoji refleksi ceria (bintang emas, medali) dan teks ucapan terima kasih berukuran proporsional.`
  });

  return {
    identitas: {
      mataPelajaran: mp,
      kelas: g,
      fase: f,
      topikMateri: t,
      jumlahSlide: String(count),
      gayaDesain: reqBody?.gayaDesain || 'Sederhana & Minimalis (Slate & Off-White)',
      tanggalDokumen: reqBody?.tanggalDokumen || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      guruPenyusun: penyusun
    },
    slides
  };
}

function parseKelasFase(gradeInput: any, faseInput?: any): { kelas: string; fase: string; kelasFaseFormatted: string } {
  let g = String(gradeInput || '1').trim();
  let f = String(faseInput || '').trim();
  const gLower = g.toLowerCase();

  if (!f) {
    if (gLower.includes('fondasi') || gLower.includes('paud') || gLower.includes('tk')) {
      f = 'Fondasi';
    } else if (gLower.includes('10') || gLower.includes('sepuluh')) {
      f = 'E';
    } else if (gLower.includes('11') || gLower.includes('12') || gLower.includes('sebelas') || gLower.includes('dua belas')) {
      f = 'F';
    } else if (gLower.includes('7') || gLower.includes('8') || gLower.includes('9') || gLower.includes('tujuh') || gLower.includes('delapan') || gLower.includes('sembilan')) {
      f = 'D';
    } else if (gLower.includes('5') || gLower.includes('6') || gLower.includes('lima') || gLower.includes('enam')) {
      f = 'C';
    } else if (gLower.includes('3') || gLower.includes('4') || gLower.includes('tiga') || gLower.includes('empat')) {
      f = 'B';
    } else if (gLower.includes('1') || gLower.includes('2') || gLower.includes('satu') || gLower.includes('dua')) {
      f = 'A';
    } else {
      f = 'D';
    }
  }

  let cleanKelas = g;
  if (!gLower.includes('kelas') && !gLower.includes('paud') && !gLower.includes('tk') && !gLower.includes('fase')) {
    cleanKelas = `Kelas ${g}`;
  }

  let cleanFase = f.startsWith('Fase') ? f : `Fase ${f}`;
  let formatted = cleanKelas.toLowerCase().includes('fase') ? cleanKelas : `${cleanKelas} / ${cleanFase}`;

  return {
    kelas: cleanKelas,
    fase: cleanFase,
    kelasFaseFormatted: formatted
  };
}

function getFallbackRPM(reqBody: any) {
  const { kelas, fase, kelasFaseFormatted } = parseKelasFase(reqBody?.grade, reqBody?.fase);
  const m = reqBody?.materi || 'Aktivitas Pola Gerak Dasar dan Kebugaran Jasmani';
  const sem = reqBody?.semester || '1';
  const penyusun = reqBody?.penyusun || 'Lendi Ike Hermawan, S.Pd., Gr.';
  const sekolah = reqBody?.sekolah || 'SD Negeri 1';
  const tahunAjaran = reqBody?.tahunAjaran || '2025/2026';
  const mataPelajaran = reqBody?.mataPelajaran || 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)';
  const bab = reqBody?.bab || `Bab 1: ${m}`;
  const countPertemuan = Math.max(1, Math.min(16, parseInt(reqBody?.jumlahPertemuan) || 2));
  const alokasiWaktu = reqBody?.alokasiWaktu || `${countPertemuan * 2} × 35 Menit (${countPertemuan} Pertemuan)`;

  const lkpdList = Array.from({ length: countPertemuan }, (_, idx) => {
    const pNum = idx + 1;
    const stages = [
      'Eksplorasi Konsep & Observasi Awal (Mindful)',
      'Aplikasi Praktik Terbimbing & Analisis (Meaningful)',
      'Tantangan Kolaboratif & Pemecahan Masalah (Joyful)',
      'Kreasi, Refleksi Mendalam & Evaluasi Kinerja (Mindful & Meaningful)'
    ];
    const subTitle = stages[(pNum - 1) % stages.length];
    return {
      pertemuan: `Pertemuan ${pNum}`,
      title: `LKPD ${pNum}: ${subTitle} - ${m}`,
      content: `A. PETUNJUK PENGGUNAAN LKPD:
1. Bacalah instruksi kegiatan secara saksama bersama anggota kelompokmu.
2. Lakukan eksplorasi konsep materi dengan penuh konsentrasi dan kesadaran (Mindful).
3. Diskusikan solusi atas setiap tantangan belajar secara kolaboratif (Meaningful & Joyful).

B. AKTIVITAS PEMBELAJARAN (PERTEMUAN ${pNum}):
1. Memahami (Konseptual):
   - Amati contoh/peragaan materi ${m} pada Pertemuan ${pNum}.
   - Identifikasi langkah kunci pelaksanaan atau konsep utama yang harus diperhatikan!
   - Tuliskan hasil pemahaman kelompokmu: .....................................................

2. Mengaplikasikan (Praktik Nyata & Kolaborasi):
   - Lakukan simulasi/latihan langsung bersama kelompok dengan penuh semangat dan saling mendukung.
   - Catat kendala yang dihadapi dan bagaimana kelompokmu menyelesaikannya secara kreatif!
   - Hasil observasi kelompok: .....................................................

3. Merefleksikan (Refleksi Bermakna):
   - Apa pemahaman paling berharga yang kamu pelajari pada pertemuan ini?
   - Bagaimana perasaanmu setelah menyelesaikan seluruh aktivitas bersama kelompok?

C. PENUTUP & CATATAN GURU:
- Teruslah bersemangat! Setiap proses belajar bermakna akan membentuk karakter dan kompetensi unggulmu.
- Catatan / Umpan Balik Guru: .....................................................`
    };
  });

  return {
    title: 'PERENCANAAN PEMBELAJARAN MENDALAM',
    identitas: {
      penyusun,
      sekolah,
      tahunAjaran,
      semester: `${sem} (${sem === '1' ? 'Ganjil' : 'Genap'})`,
      mataPelajaran,
      kelasFase: kelasFaseFormatted,
      kelas,
      fase,
      topikElemen: `${bab} / ${m}`,
      bab,
      topik: m,
      alokasiWaktu,
      jumlahPertemuan: countPertemuan
    },
    identifikasi: {
      muridOps: `Identifikasi kesiapan murid sebelum belajar:
1. Pengetahuan Awal: Sebagian peserta didik telah mengenal konsep dan gerak dasar terkait materi ${m}, sebagian lainnya masih memerlukan bimbingan awal.
2. Minat Belajar: Minat belajar tinggi melalui aktivitas fisik yang kontekstual, eksploratif, dan interaktif.
3. Latar Belakang & Kebutuhan Belajar: Latar belakang bervariasi dengan kebutuhan belajar diferensiasi visual (peragaan langsung), auditori (instruksi terarah), dan kinestetik (praktik bertahap).`,
      materiPelajaranOps: `Analisis materi pelajaran:
1. Jenis Pengetahuan: Meliputi pengetahuan faktual (konsep gerak ${m}), konseptual (prinsip kebugaran & koordinasi), dan prosedural (urutan teknik pelaksanaan yang aman).
2. Relevansi Kehidupan Nyata: Keterampilan gerak bermanfaat untuk menjaga kesehatan, postur tubuh seimbang, dan kebugaran jasmani sehari-hari.
3. Tingkat Kesulitan: Bergradasi dari gerakan sederhana perorangan hingga kombinasi kelompok.
4. Struktur Materi: Pemanasan terarah -> Pemahaman gerak dasar -> Aplikasi tantangan -> Refleksi.
5. Integrasi Nilai & Karakter: Sportivitas, kerja sama, disiplin, peduli keselamatan, dan saling menghargai.`,
      dimensiProfilLulusan: [
        'DPL1 Keimanan dan Ketakwaan terhadap Tuhan YME',
        'DPL3 Penalaran Kritis',
        'DPL4 Kreativitas',
        'DPL5 Kolaborasi',
        'DPL6 Kemandirian',
        'DPL7 Kesehatan',
        'DPL8 Komunikasi'
      ],
      identifikasiMurid: `Identifikasi kesiapan murid sebelum belajar: Pengetahuan awal, minat, latar belakang, dan kebutuhan belajar terdiferensiasi pada materi ${m}.`,
      materiPelajaran: `Analisis materi pelajaran: Jenis pengetahuan yang akan dicapai, relevansi kehidupan nyata, tingkat kesulitan, struktur materi, serta integrasi nilai dan karakter.`
    },
    desainPembelajaran: {
      capaianPembelajaranOps: `Peserta didik mampu menunjukkan kemampuan dalam mempraktikkan, menganalisis, dan membiasakan aktivitas pola gerak dasar ${m} secara berkesadaran, bermakna, dan menggembirakan sesuai fase capaian.`,
      lintasDisiplinIlmuOps: `IPAS (Kesehatan organ gerak dan fungsi jantung/otot), Bahasa Indonesia (Komunikasi efektif instruksi gerak), Seni Budaya (Irama ritmik dan keindahan gerak).`,
      tujuanPembelajaran: `1. Peserta didik dapat mengidentifikasi konsep dan prosedur pelaksanaan gerak dasar ${m} dengan tepat dan berkesadaran.
2. Peserta didik dapat mempraktikkan kombinasi gerak dasar ${m} dalam bentuk permainan berkelompok secara kolaboratif dan menggembirakan.
3. Peserta didik dapat merefleksikan manfaat aktivitas fisik bagi kesehatan diri dan menunjukkan sikap sportivitas serta empati antarteman.`,
      topikPembelajaranOps: `Pola Gerak Dasar, Koordinasi Tubuh, dan Pembiasaan Hidup Sehat Melalui ${m}`,
      praktikPedagogis: `Model: Pembelajaran Berbasis Masalah (Problem-Based Learning) dan Pembelajaran Berbasis Proyek (Project-Based Learning) dengan pendekatan Pembelajaran Mendalam (Deep Learning: Berkesadaran/Mindful, Bermakna/Meaningful, Menggembirakan/Joyful).
Metode: Demonstrasi interaktif, latihan stasiun berputar (circuit practice), permainan kontekstual, diskusi kelompok, dan refleksi terbimbing.`,
      kemitraanPembelajaranOps: `Mitra kolaborasi: Teman sebaya (tutor sebaya), guru bidang studi lain / guru kelas, orang tua (pendampingan kebiasaan gerak sehat di rumah), serta tenaga kesehatan sekolah.`,
      lingkunganPembelajaran: `Integrasi ruang fisik (lapangan terbuka yang aman, area hijau, ruang serbaguna) dan ruang interaktif dengan budaya belajar yang saling menghargai perbedaan, berani mencoba, dan suportif.`,
      pemanfaatanDigitalOps: `Pemanfaatan video peragaan gerak (slow-motion), media visual interaktif, stopwatch digital, dan platform asesmen refleksi interaktif (seperti Ahaslides atau Google Forms).`,
      capaianPembelajaran: `Peserta didik mampu menunjukkan kemampuan dalam mempraktikkan aktivitas pola gerak dasar ${m} sesuai fase capaian.`,
      lintasDisiplinIlmu: `IPAS, Bahasa Indonesia, Seni Budaya`,
      topikPembelajaran: `Pola Gerak Dasar dan Penerapannya dalam Kehidupan Sehari-hari`,
      kemitraanPembelajaran: `Tutor sebaya, guru kelas, orang tua murid`,
      pemanfaatanDigital: `Video peragaan digital dan kuis refleksi interaktif`
    },
    pengalamanBelajar: {
      langkahPembelajaran: {
        awalOps: {
          prinsip: 'Berkesadaran, Bermakna, Menggembirakan',
          deskripsi: 'Pembuka dari proses pembelajaran yang bertujuan untuk mempersiapkan peserta didik sebelum memasuki inti pembelajaran. Kegiatan dalam tahap ini meliputi orientasi yang bermakna, apersepsi yang kontekstual, dan motivasi yang menggembirakan.'
        },
        inti: {
          prinsipUmum: 'Pada tahap ini, siswa aktif terlibat dalam pengalaman belajar memahami, mengaplikasikan, dan merefleksi. Guru menerapkan prinsip pembelajaran berkesadaran, bermakna, menyenangkan untuk mencapai tujuan pembelajaran. Pengalaman belajar tidak harus dilaksanakan dalam satu kali pertemuan.',
          memahami: {
            prinsip: 'Berkesadaran, Bermakna, Menggembirakan',
            kegiatan: [
              `Guru mengajak peserta didik mengamati peragaan / tayangan video interaktif gerak ${m} dan merasakan bagaimana tubuh merespons (Berkesadaran).`,
              `Peserta didik berdiskusi interaktif mengenai konsep gerak, letak tumpuan, serta manfaat gerakan bagi tubuh (Bermakna).`
            ]
          },
          mengaplikasi: {
            prinsip: 'Berkesadaran, Bermakna, Menggembirakan',
            kegiatan: [
              `Peserta didik secara berkelompok mempraktikkan gerak dasar ${m} melalui permainan sirkuit tantangan bergradasi (Menggembirakan).`,
              `Setiap kelompok saling mengamati dan memberikan umpan balik perbaikan teknik gerakan pada lembar kerja kelompok (Kolaboratif).`
            ]
          },
          merefleksi: {
            prinsip: 'Berkesadaran, Bermakna, Menggembirakan',
            kegiatan: [
              `Peserta didik menceritakan pengalaman gerak yang paling menyenangkan dan bagian mana yang paling menantang.`,
              `Guru dan peserta didik menyimpulkan kunci keberhasilan gerak bersama-sama secara berkesadaran.`
            ]
          }
        },
        penutupOps: {
          prinsip: 'Berkesadaran, Bermakna, dan Menggembirakan',
          deskripsi: 'Tahap akhir dalam proses pembelajaran yang bertujuan memberikan umpan balik yang konstruktif kepada siswa atas pengalaman belajar yang telah dilakukan, menyimpulkan pembelajaran, dan siswa terlibat dalam perencanaan pembelajaran selanjutnya.'
        }
      },
      kegiatanAwal: 'Pembuka proses pembelajaran: Orientasi berkesadaran (berdoa, presensi), apersepsi kontekstual, pemanasan permainan ceria (joyful), dan penyampaian tujuan pembelajaran.',
      kegiatanInti: 'Tahap Memahami (eksplorasi konsep berkesadaran), Mengaplikasikan (praktik stasiun berpasangan & kelompok joyful), dan Merefleksikan (evaluasi hasil gerak & umpan balik bermakna).',
      kegiatanPenutup: 'Pendinginan relaksasi, penarikan kesimpulan bersama, umpan balik konstruktif guru, refleksi perasaan belajar, dan doa penutup.'
    },
    asesmenPembelajaran: {
      awal: 'Asesmen Diagnostik Non-Kognitif (kondisi mental/emosi) dan Tanya Jawab Pemantik Kesiapan Belajar Awal.',
      proses: 'Asesmen Formatif: Observasi keaktifan diskusi kelompok, unjuk kerja praktik gerak, dan penilaian sikap (spiritual & sosial) sesuai rubrik.',
      akhir: 'Asesmen Sumatif: Tes tertulis pemahaman konsep, unjuk kerja rangkaian gerak ${m}, serta portofolio lembar refleksi.'
    },
    tandaTangan: {
      tempatTanggal: 'Jember, 1 Juli 2025',
      kepalaSekolah: {
        nama: '............................................',
        nip: 'NIP. ........................................'
      },
      guruMapel: {
        nama: penyusun,
        nip: 'NIP. ........................................'
      }
    },
    lampiran: {
      asesmenDiagnostikNonKognitif: {
        tujuan: 'Mengetahui kondisi awal mental para peserta didik',
        pertanyaan: [
          { no: 1, teks: 'Apa kabar hari ini?' },
          { no: 2, teks: 'Apakah ada yang sakit hari ini?' },
          { no: 3, teks: 'Apakah kalian dalam keadaan sehat?' },
          { no: 4, teks: 'Apakah anak-anak merasa bersemangat hari ini?' }
        ]
      },
      asesmenFormatif: {
        keterangan: {
          diskusi: 'Melatih kemampuan peserta didik dalam berkolaborasi dengan kelompoknya, melatih berbicara dan berani mengungkapkan pendapat, memunculkan ide-idenya, bekerja sama dalam tim.',
          presentasi: 'Melatih kemampuan peserta didik dalam melatih berbicara di depan umum, berani mengajukan pertanyaan terhadap pemaparan hasil kerja milik kelompok lain, memaksimalkan kerja kelompok.',
          unjukKerja: 'Menilai keterampilan proses yang dimiliki setiap anak, dan perkembangannya.'
        },
        rubrikPenilaian: [
          {
            skor: 5,
            deskripsi: 'Sangat aktif berkontribusi dalam diskusi dan presentasi, ide orisinal, komunikasi sangat jelas, keterampilan kerja sangat baik, dan konsisten.'
          },
          {
            skor: 4,
            deskripsi: 'Aktif berdiskusi dan presentasi, mampu menjelaskan ide dengan baik, keterampilan kerja terlihat dan berkembang.'
          },
          {
            skor: 3,
            deskripsi: 'Cukup aktif, sesekali berpartisipasi dalam diskusi/presentasi, menjawab jika ditanya, keterampilan dasar mulai terlihat.'
          },
          {
            skor: 2,
            deskripsi: 'Kurang aktif, jarang berbicara atau menyumbang ide, presentasi kurang jelas, keterampilan belum konsisten.'
          },
          {
            skor: 1,
            deskripsi: 'Tidak menunjukkan partisipasi, tidak memahami tugas, tidak menunjukkan keterampilan atau perkembangan kerja.'
          }
        ]
      },
      penilaianSikap: {
        spiritual: {
          teknik: 'Penilaian Diri',
          instrumen: 'Rubrik',
          indikator: [
            'Siswa berdoa sebelum dan sesudah memulai pembelajaran',
            'Siswa mempunyai rasa empati dan kasih sayang antar sesama',
            'Siswa saling membantu antar sesama',
            'Siswa mampu memahami diri sendiri dan nilai-nilai diri'
          ]
        },
        sosial: {
          teknik: 'Penilaian Antar Teman',
          instrumen: 'Rubrik',
          indikator: [
            'Siswa mampu berkomunikasi dengan baik',
            'Siswa mampu bekerja sama dengan baik',
            'Siswa peduli terhadap lingkungan',
            'Siswa mampu menghargai setiap perbedaan pendapat'
          ]
        },
        keterangan: `SL = Selalu : sangat baik (4)\nSR = Sering : baik (3)\nKD = Kadang-kadang : cukup (2)\nTP = Tidak Pernah : perlu bimbingan (1)`,
        rumusNilai: 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'
      },
      penilaianPengetahuan: {
        judul: 'Penilaian Kelompok Pengerjaan LKPD',
        aspekList: [
          'Kelengkapan Jawaban',
          'Ketepatan Konsep',
          'Penyajian Data / Praktik',
          'Refleksi atau Pemahaman Aplikatif'
        ],
        pedomanSkor: [
          {
            aspek: 'Kelengkapan Jawaban',
            skor4: 'Semua soal LKPD dijawab lengkap dan sesuai',
            skor3: 'Sebagian besar soal dijawab dengan tepat',
            skor2: 'Hanya sebagian kecil soal dijawab',
            skor1: 'Hampir seluruh soal kosong atau tidak sesuai'
          },
          {
            aspek: 'Ketepatan Konsep',
            skor4: 'Semua konsep materi tepat dan akurat',
            skor3: 'Ada 1–2 kekeliruan kecil dalam konsep',
            skor2: 'Beberapa konsep masih keliru',
            skor1: 'Banyak kesalahan konsep'
          },
          {
            aspek: 'Penyajian Data / Praktik',
            skor4: 'Data dan hasil unjuk kerja tersusun rapi serta sesuai konteks',
            skor3: 'Data cukup sesuai, hanya sedikit kekurangan',
            skor2: 'Penyajian kurang rapi atau tidak lengkap',
            skor1: 'Tidak menyusun data / penyajian tidak tepat'
          },
          {
            aspek: 'Refleksi atau Pemahaman Aplikatif',
            skor4: 'Memberikan jawaban reflektif yang bermakna dan mendalam',
            skor3: 'Memberikan jawaban cukup jelas dan logis',
            skor2: 'Jawaban masih umum dan kurang mendalam',
            skor1: 'Tidak menjawab atau sangat tidak relevan'
          }
        ],
        rumusNilai: 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'
      },
      penilaianKeterampilan: {
        judul: 'Penilaian Hasil Unjuk Kerja Kelompok',
        aspekList: [
          'Penguasaan & Penyusunan Gerak',
          'Penjelasan Proses',
          'Kerja Sama Kelompok',
          'Kreativitas Penyajian'
        ],
        pedomanSkor: [
          {
            aspek: 'Penguasaan & Penyusunan Gerak',
            skor4: 'Mempraktikkan gerak dengan teknik akurat, terkontrol, dan sesuai',
            skor3: 'Ada 1–2 kekeliruan kecil dalam koordinasi gerak',
            skor2: 'Gerakan kurang tepat atau tidak lengkap',
            skor1: 'Gerakan salah seluruhnya atau tidak dipraktikkan'
          },
          {
            aspek: 'Penjelasan Proses',
            skor4: 'Menjelaskan langkah gerak dengan jelas dan runtut',
            skor3: 'Penjelasan cukup baik, meski agak terbata-bata',
            skor2: 'Penjelasan kurang sistematis',
            skor1: 'Tidak bisa menjelaskan proses'
          },
          {
            aspek: 'Kerja Sama Kelompok',
            skor4: 'Semua anggota kelompok aktif dan berbagi tugas merata',
            skor3: 'Sebagian besar anggota kelompok aktif',
            skor2: 'Hanya sebagian kecil anggota yang aktif',
            skor1: 'Tidak tampak kerja sama kelompok'
          },
          {
            aspek: 'Kreativitas Penyajian',
            skor4: 'Menarik, visual/peragaan mendukung, sangat percaya diri',
            skor3: 'Cukup menarik, menggunakan media/peragaan sederhana',
            skor2: 'Kurang menarik, kurang percaya diri',
            skor1: 'Tidak menarik dan tidak percaya diri'
          }
        ],
        rumusNilai: 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'
      },
      pengayaanDanRemedial: {
        remedial: {
          tujuan: `Membantu peserta didik yang belum memahami konsep dasar materi ${m} agar dapat mengikuti pembelajaran sesuai tujuan.`,
          strategi: [
            {
              nama: 'Pendekatan Kontekstual',
              deskripsi: 'Gunakan kembali data dan peragaan sederhana dari kehidupan nyata untuk menjelaskan kembali konsep dasar gerak.'
            },
            {
              nama: 'Bimbingan Terstruktur',
              deskripsi: 'Guru memberikan penjelasan ulang tentang prinsip gerak, langkah-langkah pelaksanaan, dan peragaan bertahap.'
            },
            {
              nama: 'Latihan Bertahap',
              deskripsi: 'Siswa diberi latihan tambahan yang dimulai dari koordinasi sederhana lalu dilanjutkan ke variasi kombinasi.'
            },
            {
              nama: 'Bimbingan Sebaya',
              deskripsi: 'Pasangkan siswa yang kesulitan dengan teman yang telah memahami materi untuk diskusi dan latihan berpasangan.'
            }
          ]
        },
        pengayaan: {
          tujuan: 'Memberikan tantangan lebih bagi peserta didik yang cepat memahami materi untuk memperdalam dan memperluas pemahaman mereka.',
          strategi: [
            {
              nama: 'Membuat Variasi Soal / Gerak Sendiri',
              deskripsi: 'Siswa diminta merancang 3–5 variasi gerak / studi kasus berdasarkan lingkungan sekitar.'
            },
            {
              nama: 'Diskusi Lintas Kelompok',
              deskripsi: 'Siswa dengan kemampuan tinggi saling bertukar rancangan variasi dan memecahkan tantangan bersama.'
            },
            {
              nama: 'Kegiatan Tantangan',
              deskripsi: 'Guru memberikan tugas tambahan seperti menganalisis penerapan materi dalam olahraga prestasi / teknologi kebugaran.'
            }
          ]
        }
      },
      refleksi: {
        guru: [
          {
            no: 1,
            aspek: 'Penguasaan Materi',
            refleksiGuru: 'Apakah saya sudah memahami cukup baik materi dan aktifitas pembelajaran ini?',
            jawaban: ''
          },
          {
            no: 2,
            aspek: 'Penyampaian Materi',
            refleksiGuru: 'Apakah materi ini sudah tersampaikan dengan cukup baik kepada peserta didik?',
            jawaban: ''
          },
          {
            no: 3,
            aspek: 'Umpan balik',
            refleksiGuru: 'Apakah 100% peserta didik telah mencapai penguasaan tujuan pembelajaran yang ingin dicapai?',
            jawaban: ''
          }
        ],
        pesertaDidik: 'Menutup pembelajaran dengan meminta siswa melakukan refleksi terhadap apa yang sudah mereka pelajari dengan menjawab pertanyaan refleksi berbantuan Platform Ahaslides / Lembar Refleksi Diri.'
      },
      asesmenAwal: `1. Asesmen Diagnostik Non Kognitif: Mengetahui kondisi awal mental peserta didik melalui 4 pertanyaan kesiapan diri.\n2. Tanya jawab pemantik materi awal.`,
      asesmenProses: `1. Penilaian Sikap Spiritual & Sosial (Penilaian Diri & Antar Teman)\n2. Penilaian Formatif Pengetahuan (LKPD) & Keterampilan (Unjuk Kerja Kelompok).`,
      asesmenAkhir: `1. Asesmen Sumatif Lingkup Materi\n2. Uji unjuk kerja & portofolio refleksi siswa.`,
      materiAjar: `Ringkasan Materi Ajar: Penguasaan konsep esensial, prosedur pelaksanaan, dan pembiasaan gaya hidup sehat.`
    },
    lkpdList
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

    if (isGeminiAccessDenied()) {
      console.info('[AI Generator] Using offline template for Modul Ajar');
      const fallback = getFallbackModul(grade, materi, alokasiWaktu);
      return res.json(fallback);
    }

    const ai = getAiClient();
    const prompt = `Buatkan Modul Ajar PJOK SD Kurikulum Merdeka yang lengkap, mendetail, dan profesional dalam Bahasa Indonesia.
Kelas: ${grade} SD
Materi Pokok: ${materi}
Alokasi Waktu: ${alokasiWaktu || '2 x 35 Menit (1 Pertemuan)'}

Modul Ajar harus disesuaikan dengan tingkat perkembangan anak SD kelas ${grade} secara aman dan menyenangkan.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
    console.info('[AI Generator] Using offline template for Modul Ajar');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for Rubrik Penilaian');
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

    if (isGeminiAccessDenied()) {
      console.info('[AI Generator] Using offline template for Soal Evaluasi');
      const fallback = getFallbackSoal(grade, materi, totalSoal);
      return res.json(fallback);
    }

    const count = parseInt(totalSoal) || 5;
    const ai = getAiClient();
    const prompt = `Buatkan ${count} soal pilihan ganda (PG) PJOK SD untuk:
Kelas: ${grade} SD
Materi: ${materi}

Sertakan 4 pilihan jawaban (A, B, C, D), kunci jawaban yang benar, serta penjelasan singkat kenapa jawaban tersebut benar. Pertanyaan harus sesuai dengan kemampuan kognitif anak SD Kelas ${grade}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
    if (data.questions && !data.soalList) {
      data.soalList = data.questions.map((q: any, i: number) => ({
        id: `soal-${i + 1}`,
        pertanyaan: q.question,
        pilihan: {
          A: q.options?.[0]?.replace(/^A\.\s*/, '') || '',
          B: q.options?.[1]?.replace(/^B\.\s*/, '') || '',
          C: q.options?.[2]?.replace(/^C\.\s*/, '') || '',
          D: q.options?.[3]?.replace(/^D\.\s*/, '') || ''
        },
        kunciJawaban: q.correctAnswer,
        pembahasan: q.explanation
      }));
    }
    data.materi = materi;
    data.grade = grade;
    res.json(data);
  } catch (error: any) {
    checkAndMarkAccessDenied(error);
    console.info('[AI Generator] Using offline template for Soal Evaluasi');
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
      babMateriList: incomingMateriList,
      bentukSoal = 'pilihan_ganda',
      bentukSoalList: incomingBentukList,
      bentukSoalCounts: incomingCounts,
      bentukSoalDistribution: incomingDistribution,
      levelKognitif = 'campuran',
      totalSoal = '5',
      namaSekolah = 'SD Negeri Pintar Bersama',
      dinasPendidikan = 'Dinas Pendidikan Pemuda Dan Olahraga',
      jumlahOpsiPG = '4',
      skalaPenskoran = 'standar',
      modelStimulus = 'kontekstual',
      dimensiP3 = 'terpadu'
    } = req.body;

    let cleanBentukList: string[] = [];
    if (Array.isArray(incomingBentukList) && incomingBentukList.length > 0) {
      cleanBentukList = incomingBentukList.map((b: any) => {
        const s = String(b).toLowerCase();
        if (s.includes('kompleks')) return 'Pilihan Ganda Kompleks';
        if (s.includes('jodoh')) return 'Menjodohkan';
        if (s.includes('isian')) return 'Isian Singkat';
        if (s.includes('uraian') || s.includes('esai')) return 'Uraian';
        return 'Pilihan Ganda';
      });
      cleanBentukList = Array.from(new Set(cleanBentukList));
    } else if (typeof bentukSoal === 'string') {
      if (bentukSoal === 'campuran') {
        cleanBentukList = ['Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Menjodohkan', 'Isian Singkat', 'Uraian'];
      } else if (bentukSoal === 'pg_kompleks') {
        cleanBentukList = ['Pilihan Ganda Kompleks'];
      } else if (bentukSoal === 'menjodohkan') {
        cleanBentukList = ['Menjodohkan'];
      } else if (bentukSoal === 'isian') {
        cleanBentukList = ['Isian Singkat'];
      } else if (bentukSoal === 'uraian') {
        cleanBentukList = ['Uraian'];
      } else {
        cleanBentukList = ['Pilihan Ganda'];
      }
    }
    if (cleanBentukList.length === 0) {
      cleanBentukList = ['Pilihan Ganda'];
    }

    // Build explicit shape distribution
    const shapeDistribution: { name: string; count: number }[] = [];
    if (Array.isArray(incomingDistribution) && incomingDistribution.length > 0) {
      for (const item of incomingDistribution) {
        const sName = item.name || item.bentuk;
        const sCnt = Math.max(1, Math.min(25, parseInt(item.count) || 1));
        if (sName && cleanBentukList.includes(sName)) {
          shapeDistribution.push({ name: sName, count: sCnt });
        }
      }
    } else if (incomingCounts && typeof incomingCounts === 'object') {
      for (const b of cleanBentukList) {
        const sCnt = Math.max(1, Math.min(25, parseInt(incomingCounts[b]) || 1));
        shapeDistribution.push({ name: b, count: sCnt });
      }
    }

    let count = Math.min(25, Math.max(1, parseInt(totalSoal) || 5));
    if (shapeDistribution.length > 0) {
      count = shapeDistribution.reduce((acc, curr) => acc + curr.count, 0);
    }

    // Pre-calculate allocatedShapes list to enforce strict numbering and types
    const allocatedShapes: string[] = [];
    if (shapeDistribution.length > 0) {
      for (const sd of shapeDistribution) {
        for (let k = 0; k < sd.count; k++) {
          allocatedShapes.push(sd.name);
        }
      }
    } else {
      const basePerShape = Math.floor(count / cleanBentukList.length);
      let remShape = count % cleanBentukList.length;
      for (let s = 0; s < cleanBentukList.length; s++) {
        const curCount = basePerShape + (remShape > 0 ? 1 : 0);
        if (remShape > 0) remShape--;
        for (let k = 0; k < curCount; k++) {
          allocatedShapes.push(cleanBentukList[s]);
        }
      }
    }

    let cleanMateriList: string[] = [];
    if (Array.isArray(incomingMateriList) && incomingMateriList.length > 0) {
      cleanMateriList = incomingMateriList.map((m: any) => String(m).trim()).filter(Boolean);
    } else if (typeof babMateri === 'string') {
      cleanMateriList = babMateri.split(/\n|;/).map((s: string) => s.trim()).filter(Boolean);
    }
    if (cleanMateriList.length === 0) {
      cleanMateriList = ['Aktivitas Kebugaran Jasmani & Pola Hidup Sehat'];
    }

    const effectiveBabMateri = cleanMateriList.join('; ');
    req.body.babMateri = effectiveBabMateri;
    req.body.babMateriList = cleanMateriList;
    req.body.bentukSoalList = cleanBentukList;
    req.body.bentukSoalDistribution = shapeDistribution;
    req.body.bentukSoalCounts = incomingCounts;
    req.body.bentukSoal = cleanBentukList.join(', ');
    req.body.totalSoal = String(count);

    if (isGeminiAccessDenied()) {
      console.info('[AI Generator] Using offline template for Soal Sumatif');
      const fallback = getFallbackSummative(req.body);
      return res.json(fallback);
    }

    let opsiCountNote = '4 opsi (A, B, C, D)';
    if (jumlahOpsiPG === '3') opsiCountNote = '3 opsi (A, B, C) untuk Kelas 1-2 SD';
    if (jumlahOpsiPG === '5') opsiCountNote = '5 opsi (A, B, C, D, E)';

    let bentukInstruction = '';
    if (shapeDistribution.length > 0) {
      let currentNumber = 1;
      const breakdownText = shapeDistribution.map(sd => {
        const startNo = currentNumber;
        const endNo = currentNumber + sd.count - 1;
        currentNumber += sd.count;
        let extraNote = '';
        if (sd.name === 'Pilihan Ganda') extraNote = `(${opsiCountNote})`;
        if (sd.name === 'Pilihan Ganda Kompleks') extraNote = `(stimulus 3-4 pernyataan Benar/Salah, field "pernyataanKompleks")`;
        if (sd.name === 'Menjodohkan') extraNote = `(3-4 pasangan konsep Kolom A & B, field "menjodohkanPairs")`;
        if (sd.name === 'Isian Singkat') extraNote = `(jawaban istilah/kata kunci esensial)`;
        if (sd.name === 'Uraian') extraNote = `(penalaran mendalam berbobot & rubrik penskoran 1-5)`;

        return `- ${sd.name}: ${sd.count} butir (Nomor ${startNo === endNo ? startNo : `${startNo} s.d ${endNo}`}) ${extraNote}`;
      }).join('\n');

      bentukInstruction = `Guru telah mengatur rincian jumlah butir soal per bentuk asesmen sebagai berikut:
${breakdownText}
Total keseluruhan instrumen: ${count} butir soal.

PETUNJUK WAJIB DISTRIBUSI:
1. Anda WAJIB membuat PERSIS jumlah butir soal sesuai dengan alokasi setiap bentuk di atas (jangan mengurangi atau menukar).
2. Urutkan soal secara rapi berkelompok per bentuk soal sesuai urutan di atas.
3. Pastikan nilai field "bentukSoal" pada masing-masing nomor soal sesuai dengan kelompok bentuknya.`;
    } else if (cleanBentukList.length === 1) {
      const b = cleanBentukList[0];
      if (b === 'Pilihan Ganda') {
        bentukInstruction = `Semua ${count} butir soal harus bertipe Pilihan Ganda (PG Tunggal) dengan ${opsiCountNote}.`;
      } else if (b === 'Pilihan Ganda Kompleks') {
        bentukInstruction = `Semua ${count} butir soal harus bertipe Pilihan Ganda Kompleks (PGK). Buatkan tabel 3-4 pernyataan terkait materi yang harus dinilai Benar (B) atau Salah (S) oleh siswa, lengkapi field "pernyataanKompleks" berupa array [{ "pernyataan": string, "jawabanBenar": "Benar" | "Salah" }].`;
      } else if (b === 'Menjodohkan') {
        bentukInstruction = `Semua ${count} butir soal harus bertipe Menjodohkan (Matching). Buatkan 3-4 pasangan konsep di Kolom A dan fungsi/keterangan di Kolom B, lengkapi field "menjodohkanPairs" berupa array [{ "premis": string, "pasangan": string }].`;
      } else if (b === 'Isian Singkat') {
        bentukInstruction = `Semua ${count} butir soal harus bertipe Isian Singkat yang menanyakan istilah atau konsep kunci gerak dengan jawaban pendek terarah.`;
      } else if (b === 'Uraian') {
        bentukInstruction = `Semua ${count} butir soal harus bertipe Uraian / Esai yang memerlukan jawaban penjelasan mendalam, analisis gerak, atau solusi situasi dengan rubrik penskoran berjenjang (skor maksimal 5).`;
      }
    } else {
      bentukInstruction = `Guru memilih ${cleanBentukList.length} bentuk soal sekaligus untuk dikombinasikan dalam instrumen ini: ${cleanBentukList.join(', ')}.
Anda WAJIB membagi dan mendistribusikan total ${count} butir soal secara proporsional ke dalam bentuk-bentuk soal terpilih tersebut.
Urutkan butir soal secara rapi dan berkelompok per bentuk soal (misal: bagian Pilihan Ganda terlebih dahulu dengan opsi (${opsiCountNote}), lalu Pilihan Ganda Kompleks/Menjodohkan/Isian, dan diakhiri dengan Uraian).
Pastikan field "bentukSoal" pada setiap butir soal diisi PERSIS dengan salah satu dari bentuk terpilih: ${cleanBentukList.map(s => `"${s}"`).join(', ')}.`;
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
Buatkan ${count} butir soal evaluasi untuk asesmen sumatif PJOK Sekolah Dasar.

Informasi Identitas Ujian:
- Jenis Ujian: ${jenisUjian}
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${grade} SD
- Semester: Semester ${semester}
- Tahun Pelajaran: ${tahunPelajaran}
- Nama Sekolah: ${namaSekolah}
- Dinas Pendidikan: ${dinasPendidikan}

Daftar Bab / Lingkup Materi yang Diujikan (${cleanMateriList.length} Lingkup Materi):
${cleanMateriList.map((m, idx) => `Bab ${idx + 1}: ${m}`).join('\n')}

PEDOMAN DISTRIBUSI SOAL KE MATERI:
Guru menentukan ${cleanMateriList.length} Bab/Lingkup Materi sebagai dasar ujian. Anda WAJIB membagi dan mendistribusikan total ${count} butir soal secara proporsional dan merata ke seluruh ${cleanMateriList.length} materi di atas.
Pada setiap butir soal, field "lingkupMateri" WAJIB diisi dengan nama Bab/Lingkup Materi yang diukur dari daftar di atas.

Spesifikasi & Opsi Pilihan Soal:
- Jumlah Soal: ${count}
- Bentuk Soal: ${bentukSoal} (${bentukInstruction})
- Jumlah Opsi Pilihan PG: ${opsiCountNote}
- Level Kognitif Target: ${levelKognitif} (${levelInstruction})
- Model Stimulus Soal: ${modelStimulus}
- Dimensi Profil Pelajar Pancasila: ${dimensiP3}
- Skala Penskoran: ${skalaPenskoran}

Tugas Anda:
Untuk setiap butir soal, buatlah data lengkap yang mencakup:
1. "noSoal": Nomor soal berurutan dimulai dari 1.
2. "bentukSoal": "Pilihan Ganda", "Pilihan Ganda Kompleks", "Menjodohkan", "Isian Singkat", atau "Uraian" sesuai bentuknya.
3. "levelKognitif": Contoh: "Level 1 (C1 - Mengingat)", "Level 2 (C3 - Menerapkan)", atau "Level 3 (C4 - Menganalisis)".
4. "lingkupMateri": Nama materi spesifik yang diuji dari daftar materi di atas.
5. "capaianPembelajaran": Rumusan Capaian Pembelajaran (CP) atau Alur Tujuan Pembelajaran (ATP) kurikulum Merdeka yang relevan untuk materi tersebut di Kelas ${grade} SD.
6. "indikatorSoal": Rumusan indikator soal yang spesifik dan operasional menggambarkan bagaimana stimulus soal diberikan dan apa yang diukur.
7. "question": Teks instruksi butir soal yang jelas, lugas, dan sesuai kaidah tata bahasa Indonesia yang baik dan benar.
8. "options": Jika bentuk soal adalah Pilihan Ganda biasa, sertakan opsi pilihan (${opsiCountNote}) lengkap dengan label hurufnya. Jika bukan PG biasa, berikan array kosong [].
9. "pernyataanKompleks": Khusus bentuk Pilihan Ganda Kompleks, sertakan array 3-4 objek berisi {"pernyataan": string, "jawabanBenar": "Benar" | "Salah"}. Jika bukan PG Kompleks, isi array kosong [].
10. "menjodohkanPairs": Khusus bentuk Menjodohkan, sertakan array 3-4 pasangan objek berisi {"premis": string, "pasangan": string}. Jika bukan Menjodohkan, isi array kosong [].
11. "correctAnswer": Kunci jawaban yang tepat.
12. "explanation": Penjelasan ilmiah, logis, dan edukatif mengapa jawaban tersebut benar.
13. "pedomanPenskoran": Panduan penskoran atau kriteria skor untuk butir soal tersebut.
14. "bobotSkor": Angka bobot skor per butir soal (misal PG: 1, PGK: 2, Menjodohkan: 2, Isian: 3, Uraian: 5).
15. "dimensiP3": Dimensi profil pelajar pancasila yang dilatih (misal: "Bernalar Kritis", "Gotong Royong", "Mandiri").

PANDUAN ANTI-DUPLIKASI DAN VARIASI BUTIR SOAL:
- Setiap butir soal WAJIB memiliki stimulus, pertanyaan, konsep teknis, dan sudut pandang yang UNIK dan BERBEDA satu sama lain. Jangan pernah mengulang pertanyaan yang sama persis.
- Acak sebaran kunci jawaban pilihan ganda (A, B, C, D) secara proporsional dan tidak monoton pada satu huruf saja.
- Gunakan seed pembeda unik: ${req.body.seed || Date.now()} untuk menghasilkan susunan soal yang baru dan bervariasi.

Format output wajib berupa JSON terstruktur yang valid sesuai schema berikut. Jangan ada teks penjelasan markdown tambahan di luar blok JSON.`;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.8,
        systemInstruction: `Anda adalah pakar penulisan soal evaluasi standar nasional serta pembuatan instrumen kartu soal Kurikulum Merdeka yang ahli dalam menghasilkan instrumen evaluasi yang akurat, berbobot, bervariasi unik tanpa duplikasi, dan sesuai standar administrasi sekolah di Indonesia dalam format JSON. Pastikan materi, tingkat kesulitan, dan Capaian Pembelajaran (CP) benar-benar sesuai dengan jenjang Kelas ${grade} SD dan terdistribusi secara berimbang ke seluruh materi yang ditentukan.`,
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
                  lingkupMateri: { type: Type.STRING },
                  capaianPembelajaran: { type: Type.STRING },
                  indikatorSoal: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  pernyataanKompleks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pernyataan: { type: Type.STRING },
                        jawabanBenar: { type: Type.STRING }
                      },
                      required: ['pernyataan', 'jawabanBenar']
                    }
                  },
                  menjodohkanPairs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        premis: { type: Type.STRING },
                        pasangan: { type: Type.STRING }
                      },
                      required: ['premis', 'pasangan']
                    }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  pedomanPenskoran: { type: Type.STRING },
                  bobotSkor: { type: Type.INTEGER },
                  dimensiP3: { type: Type.STRING }
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

    // Normalisasi struktur data output
    if (!data.judulUjian) {
      data.judulUjian = `${jenisUjian.toUpperCase()} - PJOK KELAS ${grade} SD`;
    }
    if (!data.kop) {
      data.kop = {
        dinasPendidikan,
        namaSekolah,
        mataPelajaran,
        kelas: grade,
        semester,
        tahunPelajaran
      };
    } else {
      data.kop.dinasPendidikan = data.kop.dinasPendidikan || dinasPendidikan;
      data.kop.namaSekolah = data.kop.namaSekolah || namaSekolah;
      data.kop.mataPelajaran = data.kop.mataPelajaran || mataPelajaran;
      data.kop.kelas = data.kop.kelas || grade;
      data.kop.semester = data.kop.semester || semester;
      data.kop.tahunPelajaran = data.kop.tahunPelajaran || tahunPelajaran;
    }
    data.kop.lingkupMateriList = cleanMateriList;
    data.kop.lingkupMateri = effectiveBabMateri;
    data.kop.bentukSoalList = cleanBentukList;
    data.kop.bentukSoal = cleanBentukList.join(', ');
    data.kop.bentukSoalDistribution = shapeDistribution.length > 0 ? shapeDistribution : undefined;
    data.kop.bentukSoalSummary = shapeDistribution.length > 0 ? shapeDistribution.map(s => `${s.name}: ${s.count} soal`).join(' • ') : cleanBentukList.join(', ');
    data.kop.totalSoal = count;

    if (Array.isArray(data.questions)) {
      data.questions = data.questions.map((q: any, idx: number) => {
        let matchedBentuk = allocatedShapes[idx] || cleanBentukList.find(b => b.toLowerCase() === String(q.bentukSoal || '').toLowerCase());
        if (!matchedBentuk) {
          const lower = String(q.bentukSoal || '').toLowerCase();
          if (lower.includes('kompleks') && cleanBentukList.includes('Pilihan Ganda Kompleks')) matchedBentuk = 'Pilihan Ganda Kompleks';
          else if (lower.includes('jodoh') && cleanBentukList.includes('Menjodohkan')) matchedBentuk = 'Menjodohkan';
          else if (lower.includes('isian') && cleanBentukList.includes('Isian Singkat')) matchedBentuk = 'Isian Singkat';
          else if (lower.includes('uraian') && cleanBentukList.includes('Uraian')) matchedBentuk = 'Uraian';
          else if (cleanBentukList.includes('Pilihan Ganda')) matchedBentuk = 'Pilihan Ganda';
          else matchedBentuk = cleanBentukList[idx % cleanBentukList.length];
        }

        let bobot = q.bobotSkor;
        if (!bobot) {
          if (matchedBentuk === 'Pilihan Ganda') bobot = 1;
          else if (matchedBentuk === 'Pilihan Ganda Kompleks') bobot = 2;
          else if (matchedBentuk === 'Menjodohkan') bobot = 2;
          else if (matchedBentuk === 'Isian Singkat') bobot = 3;
          else if (matchedBentuk === 'Uraian') bobot = 5;
          else bobot = 1;
        }

        const qMateri = q.lingkupMateri || cleanMateriList[idx % cleanMateriList.length];

        return {
          noSoal: q.noSoal || idx + 1,
          bentukSoal: matchedBentuk,
          levelKognitif: q.levelKognitif || 'Level 2 (C3 - Menerapkan)',
          lingkupMateri: qMateri,
          capaianPembelajaran: q.capaianPembelajaran || `Peserta didik mampu memahami dan mempraktikkan keterampilan gerak pada materi ${qMateri} sesuai jenjang kelas ${grade} SD.`,
          indikatorSoal: q.indikatorSoal || q.indikator || `Disajikan stimulus mengenai ${qMateri}, peserta didik dapat menentukan jawaban yang tepat.`,
          question: q.question || q.questionText || q.pertanyaan || '',
          options: Array.isArray(q.options) ? q.options : [],
          pernyataanKompleks: Array.isArray(q.pernyataanKompleks) ? q.pernyataanKompleks : undefined,
          menjodohkanPairs: Array.isArray(q.menjodohkanPairs) ? q.menjodohkanPairs : undefined,
          correctAnswer: q.correctAnswer || q.kunciJawaban || 'A',
          explanation: q.explanation || q.pembahasan || '',
          pedomanPenskoran: q.pedomanPenskoran || (q.bentukSoal === 'Uraian' ? 'Skor maksimal 5 sesuai kelengkapan uraian' : 'Skor 1 jika benar, 0 jika salah'),
          bobotSkor: bobot,
          dimensiP3: q.dimensiP3 || 'Gotong Royong & Mandiri'
        };
      });
    }

    res.json(data);
  } catch (error: any) {
    checkAndMarkAccessDenied(error);
    console.info('[AI Generator] Using offline template for Soal Sumatif');
    const fallback = getFallbackSummative(req.body);
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for KKO Analysis');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for Daily Test');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for ATP');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for CP-to-TP');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for KKTP');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for RPE');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for PROTA');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for PROSEM');
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
    const prompt = `Buatkan rancangan Slide Presentasi PPT (PowerPoint) Pembelajaran Kurikulum Merdeka yang interaktif, berpusat pada murid, dan berstruktur profesional:
Mata Pelajaran: ${mataPelajaran}
Kelas: Kelas ${kelas} (Fase ${fase})
Topik/Materi Pembelajaran: ${topikMateri}
Jumlah Slide: ${slidesCount} Slide
Gaya Desain Visual: ${gayaDesain}
Guru Penyusun: ${guruPenyusun || 'Guru Kelas'}

Ketentuan Sangat Penting:
1. TOPIK / MATERI PEMBELAJARAN "${topikMateri}" WAJIB menjadi tema utama dan ditampilkan secara eksplisit:
   - Pada Slide 1 (Cover / Judul): Tampilkan topik "${topikMateri}" sebagai Judul Utama atau Subjudul Utama yang besar dan jelas, bersama Mata Pelajaran ${mataPelajaran}, Kelas ${kelas} (Fase ${fase}), dan Penyusun.
   - Pada Slide 2: Tujuan Pembelajaran & Apersepsi khusus materi "${topikMateri}".
   - Pada Slide 3 s.d. (N-1): Pembahasan Materi Inti "${topikMateri}" (konsep, teknik/langkah kerja, contoh nyata, aktivitas eksplorasi).
   - Pada Slide Terakhir (Slide N): Refleksi, Kuis/Asesmen Pemahaman Cepat untuk materi "${topikMateri}", kesimpulan, dan pesan penutup.
2. Konten Slide (points):
   - Buat 3-5 poin (bullet points) padat, tajam, dan mudah dipahami oleh murid.
3. Rekomendasi Visual (visualRecommendation):
   - Deskripsikan konsep visual yang sesuai dengan materi "${topikMateri}" dan gaya "${gayaDesain}".
4. Catatan Pemateri (speakerNotes):
   - Berikan arahan narasi guru untuk memandu murid memahami materi "${topikMateri}".

Kembalikan hasil dalam format JSON terstruktur lengkap sesuai schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for Slides');
    const fallback = getFallbackSlides(
      req.body?.topikMateri,
      req.body?.kelas,
      req.body?.jumlahSlide,
      req.body
    );
    res.json(fallback);
  }
});

// 10. Generate Deep Learning RPM (Rencana Pembelajaran Mendalam) & LKPD
app.post('/api/generate-rpm', async (req, res) => {
  try {
    const { 
      grade, 
      fase: faseInput,
      materi, 
      penyusun, 
      sekolah, 
      tahunAjaran, 
      semester, 
      mataPelajaran, 
      bab, 
      alokasiWaktu,
      jumlahPertemuan = '2',
      konteksTambahan 
    } = req.body;

    if (!grade || !materi || !penyusun || !sekolah) {
      return res.status(400).json({ error: 'Input wajib (Kelas, Topik, Penyusun, Sekolah) harus diisi.' });
    }

    const { kelas, fase, kelasFaseFormatted } = parseKelasFase(grade, faseInput);
    const countPertemuan = Math.max(1, Math.min(16, parseInt(jumlahPertemuan) || 2));
    const finalAlokasi = alokasiWaktu || `${countPertemuan * 2} × 35 Menit (${countPertemuan} Pertemuan)`;

    const ai = getAiClient();
    const prompt = `Buatkan Perencanaan Pembelajaran Mendalam (RPM) Lengkap (${countPertemuan} Pertemuan) dengan struktur dan Lampiran Lengkap serta LKPD Lengkap untuk setiap pertemuan (Pertemuan 1 sampai Pertemuan ${countPertemuan}) berdasarkan data berikut:
Kelas / Fase Capaian: ${kelasFaseFormatted}
Mata Pelajaran: ${mataPelajaran || 'Matematika'}
Topik/Materi: ${materi}
Bab: ${bab || 'Bab 1'}
Penyusun: ${penyusun}
Sekolah: ${sekolah}
Tahun Ajaran: ${tahunAjaran || '2025/2026'}
Semester: ${semester || '1'}
Jumlah Pertemuan Mengajar: ${countPertemuan} Pertemuan
Alokasi Waktu: ${finalAlokasi}
Konteks Tambahan: ${konteksTambahan || 'Tidak ada'}

PENTING UNTUK MENCEGAH TIMEOUT JARINGAN (FAILED TO FETCH):
- Jaga agar semua teks penjelasan sangat PADAT, RINGKAS, dan to-the-point menggunakan poin-poin (bullet-points) singkat. Hindari paragraf narasi panjang lebar.
- Untuk kegiatan pembelajaran (Pengalaman Belajar) Pertemuan 1 s.d. ${countPertemuan}, gabungkan penjelasan atau tuliskan langkah-langkah secara ringkas dan lugas (maksimal 3-4 baris per pertemuan).
- Untuk LKPD (${countPertemuan} pertemuan), buatlah format template LKPD yang ringkas, instruktif, dan padat (maksimal 100-150 kata per LKPD).
- Seluruh isi output JSON harus berkisar antara 1.000 - 1.500 kata saja. Ini sangat penting agar API merespons dalam waktu kurang dari 15 detik.

A. Identitas
- Penyusun, Sekolah, Tahun Ajaran, Semester, Mata Pelajaran, Kelas/Fase Capaian (${kelasFaseFormatted}), Bab, Topik, Alokasi Waktu (${finalAlokasi})

B. Identifikasi
- Identifikasi Murid: ringkasan pengetahuan awal, minat belajar, kebutuhan belajar.
- Materi Pelajaran: faktual, konseptual, prosedural, metakognitif.
- Dimensi Profil Lulusan: pilih dimensi yang sesuai (penalaran kritis, kreativitas, kolaborasi, dll).

C. Desain Pembelajaran
- Capaian Pembelajaran, Lintas Disiplin Ilmu, Tujuan Pembelajaran (pertemuan 1-${countPertemuan} secara ringkas), Topik Pembelajaran, Praktik Pedagogis, Kemitraan, Lingkungan, Pemanfaatan Digital.

D. Pengalaman Belajar
- Langkah Kegiatan Awal (15 menit) secara singkat.
- Langkah Kegiatan Inti (60 menit): Pertemuan 1 s.d. ${countPertemuan} dijabarkan secara padat dan terstruktur (Memahami, Mengaplikasikan, Merefleksi secara ringkas).
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
Buat LKPD UTUH namun RINGKAS untuk setiap pertemuan (Pertemuan 1 sampai Pertemuan ${countPertemuan}) mencakup:
1. Identitas diri LKPD
2. Petunjuk penggunaan LKPD
3. Memahami (materi ringkas, 3 pertanyaan), Mengaplikasikan (tugas nyata), Merefleksikan (2-3 pertanyaan refleksi).
4. Penutup (penyemangat, catatan guru, checklist)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: `Anda adalah asisten pakar kurikulum Pembelajaran Mendalam (Deep Learning) Kurikulum Merdeka di Indonesia. Tugas Anda adalah menyusun Perencanaan Pembelajaran Mendalam (RPM) berkualitas tinggi secara lengkap untuk ${countPertemuan} pertemuan namun ditulis dengan sangat PADAT, RINGKAS, dan TO-THE-POINT (gunakan bullet-points singkat) untuk memastikan respons cepat dan tidak terjadi network timeout (Failed to fetch). Output wajib dalam format JSON terstruktur.`,
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
                tujuanPembelajaran: { type: Type.STRING, description: `Tujuan pembelajaran rinci Pertemuan 1-${countPertemuan}` },
                topikPembelajaran: { type: Type.STRING, description: `Sub topik dibahas setiap Pertemuan 1-${countPertemuan}` },
                praktikPedagogis: { type: Type.STRING, description: `Pendekatan Deep Learning, Model & Sintaks, Metode Pertemuan 1-${countPertemuan}` },
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
                kegiatanInti: { type: Type.STRING, description: `Langkah inti 60 menit per pertemuan untuk Pertemuan 1-${countPertemuan}. Harus sangat detail mencakup Memahami, Mengaplikasikan, Merefleksi beserta sintaks dan DPL.` },
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
              description: `Daftar LKPD lengkap untuk Pertemuan 1 sampai Pertemuan ${countPertemuan}`
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
    console.info('[AI Generator] Using offline template for RPM');
    const fallback = getFallbackRPM(req.body);
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
${(mataPelajaran.toLowerCase().includes('pjok') || mataPelajaran.toLowerCase().includes('jasmani') || (sekolah && sekolah.toLowerCase().includes('kalimantong'))) ? `Catatan Khusus Pembelajaran PJOK di ${sekolah || 'SD Negeri Kalimantong'}:
- Fokuskan materi pada aktivitas gerak fisik bermakna (pola gerak dasar lokomotor, non-lokomotor, manipulatif, aktivitas kebugaran jasmani, senam, atletik, atau permainan bola).
- Sertakan instruksi keselamatan di lapangan, pentingnya pemanasan (warming-up) dinamis, dan pendinginan (cooling-down) pasca latihan.
- Sediakan tabel pengamatan unjuk kerja teman sejawat (peer assessment) untuk mengevaluasi teknik gerak kawan secara objektif dan sportif.
- Buat pertanyaan nalar kritis tentang mekanika gerak tubuh (sikap tumpuan, perkenaan ayunan, koordinasi pandangan) serta nilai sportivitas, kejujuran, dan gaya hidup sehat aktif.
` : ''}Tugas Anda adalah merancang Lembar Kerja Peserta Didik (LKPD) yang lengkap dan terstruktur berdasarkan sintaks pembelajaran berikut:
- Sintaks Model & Metode Pembelajaran: ${sintaks || 'Pembelajaran Eksploratif Dinamis'}
- Topik Pembelajaran: ${topikMateri}
- Tujuan Pembelajaran: ${tujuanPembelajaran}
- Dimensi Profil Lulusan / Profil Pelajar Pancasila: ${dimensiProfil}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'SD Negeri Kalimantong'}
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
${(mataPelajaran.toLowerCase().includes('pjok') || mataPelajaran.toLowerCase().includes('jasmani') || (sekolah && sekolah.toLowerCase().includes('kalimantong'))) ? `Catatan Khusus Pembelajaran PJOK di ${sekolah || 'SD Negeri Kalimantong'}:
- Selaraskan dengan aktivitas fisik lapangan (pola gerak lokomotor, manipulatif, taktik bermain, pos sirkuit kebugaran, atau senam).
- Sediakan tabel evaluasi praktik/observasi teman sejawat (peer assessment) dan aturan keselamatan lapangan.
` : ''}Berikut adalah data identitas dokumen:
- Mata Pelajaran: ${mataPelajaran}
- Kelas: Kelas ${kelas}
- Topik / Materi Pembelajaran: ${topikMateri}
- Guru Penyusun: ${guruPenyusun}
- Sekolah: ${sekolah || 'SD Negeri Kalimantong'}
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for LKPD');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for Cover');
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
      model: 'gemini-3.7-flash',
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
    console.info('[AI Generator] Using offline template for Workload Analysis');
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
