/**
 * Centralized Prompt AI & JSON Export Generators for all SADAR PJOK menus.
 * Designed to provide pedagogical, Kurikulum Merdeka compliant system prompts
 * and structured data for Google Gemini & ChatGPT.
 */

export interface PromptTabDefinition {
  id: string;
  label: string;
  prompt: string;
  description?: string;
}

/**
 * Common System Persona for PJOK Kurikulum Merdeka prompts
 */
export const PJOK_SYSTEM_ROLE = `Anda adalah Asisten Pakar Ahli Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK) serta Konsultan Kurikulum Merdeka Kemendikbudristek RI. Anda memiliki keahlian mendalam dalam:
1. Capaian Pembelajaran (CP) dan Alur Tujuan Pembelajaran (ATP) PJOK Fase A, B, C, D, E, dan F.
2. Taksonomi Bloom Revisi (C1-C6), Taksonomi Dave/Simpson Ranah Psikomotor (P1-P5), dan SOLO Taxonomy.
3. Pembelajaran Berdiferensiasi (Konten, Proses, Produk) dan Pendekatan Deep Learning (Meaningful, Mindful, Joyful Learning).
4. Profil Pelajar Pancasila (P3): Mandiri, Gotong Royong, Bernalar Kritis, Kreatif, Berakhlak Mulia, Berkebinekaan Global.
5. Asesmen Otentik (Formatif, Sumatif, Asesmen Kinerja Praktik Lapangan, Rubrik Holistik & Analitik).`;

/**
 * 1. Capaian Pembelajaran (CP) Prompts
 */
export function getCpPrompts(currentFase: string, currentElement: string, cpText: string): PromptTabDefinition[] {
  return [
    {
      id: 'bedah_cp',
      label: 'Bedah Kompetensi & Konten CP',
      description: 'Menganalisis kalimat Capaian Pembelajaran menjadi kompetensi inti dan lingkup materi.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Lakukan dekonstruksi dan analisis mendalam terhadap Capaian Pembelajaran (CP) PJOK berikut:
- Fase: ${currentFase || 'Fase A/B/C/D/E/F'}
- Elemen: ${currentElement || 'Keterampilan / Pengetahuan / Pemanfaatan Gerak'}
- Kalimat CP: "${cpText || 'Peserta didik menunjukkan kemampuan dalam mempraktikkan dan menganalisis aktivitas pola gerak dasar...'}"

INSTRUKSI DETAIL:
1. Identifikasi Kompetensi Kunci (Kata kerja tindakan yang dituntut).
2. Identifikasi Konten / Materi Pokok PJOK yang harus dikuasai siswa.
3. Petakan tingkat kesulitan kognitif dan psikomotorik yang sesuai dengan tahapan usia/fase siswa.
4. Hubungkan dengan Dimensi Profil Pelajar Pancasila (P3) yang paling relevan.
5. Sajikan dalam tabel terstruktur dan berikan rekomendasi aktivitas gerak yang menyenangkan (joyful movement).`
    },
    {
      id: 'turunkan_atp',
      label: 'Alur Penurunan ke ATP',
      description: 'Panduan menurunkan CP menjadi Alur Tujuan Pembelajaran (ATP) berurutan dari mudah ke kompleks.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah Alur Tujuan Pembelajaran (ATP) PJOK yang logis, bertahap, dan terukur berdasarkan Capaian Pembelajaran berikut:
- Fase: ${currentFase || 'Semua Fase'}
- Elemen: ${currentElement || 'Elemen Terpilih'}
- Teks CP: "${cpText || 'Capaian Pembelajaran PJOK Kurikulum Merdeka'}"

FORMAT KELUARAN YANG DIINGINKAN:
1. Tabel Alur TP yang memuat:
   - Kode TP (misal: TP.1.1, TP.1.2)
   - Rumusan Tujuan Pembelajaran (memenuhi unsur Kompetensi + Konten)
   - Alokasi Perkiraan Waktu (Jam Pelajaran / JP)
   - Indikator Ketercapaian (IKTP)
   - Rekomendasi Media & Fasilitas (Bola, Lapangan, Kerucut/Cone, Modifikasi Alat)
2. Prinsip Pengurutan (Scaffolding): Jelaskan bagaimana alur bergerak dari keterampilan gerak fundamental menuju kombinasi taktik sederhana.`
    },
    {
      id: 'diferensiasi_cp',
      label: 'Strategi Pembelajaran Berdiferensiasi',
      description: 'Menyusun strategi diferensiasi konten, proses, dan produk sesuai keragaman fisik siswa.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Buatlah rancangan Pembelajaran Berdiferensiasi PJOK untuk mengakomodasi keragaman kondisi fisik, kebugaran, dan minat belajar siswa pada CP:
"${cpText || 'Pengembangan gerak dasar dan kebugaran jasmani'}"

RANCANG STRATEGI BERDASARKAN:
1. Diferensiasi Konten: Modifikasi aturan permainan, ukuran lapangan, atau alat bantu (misal: bola spon vs bola standar).
2. Diferensiasi Proses: Pengorganisasian stasiun belajar (circuits learning) dengan tingkat tantangan berjenjang (Pemula, Menengah, Mahir).
3. Diferensiasi Produk: Beragam bentuk unjuk kerja (praktik gerak langsung, video pendek, atau lembar refleksi diri).
4. Penanganan Khusus: Panduan inklusif untuk siswa dengan keterbatasan fisik ringan atau stamina rendah.`
    }
  ];
}

/**
 * 2. Formulasi CP ke TP Prompts
 */
export function getCpToTpPrompts(data: { fase?: string; kelas?: string; elemen?: string; cpText?: string; tpList?: any[] }): PromptTabDefinition[] {
  const tpSummary = data.tpList && data.tpList.length > 0 
    ? data.tpList.map((t, idx) => `${idx + 1}. [${t.kode || 'TP'}] ${t.rumusanTp || t.tujuanPembelajaran || ''}`).join('\n')
    : '(Belum ada TP yang diformulasikan)';

  return [
    {
      id: 'generator_tp',
      label: 'Formula TP Standar ABCD & Bloom',
      description: 'Menyusun rumusan Tujuan Pembelajaran baru yang presisi dan terukur.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rumuskan Tujuan Pembelajaran (TP) PJOK Kurikulum Merdeka yang memenuhi kaidah ABCD (Audience, Behavior, Condition, Degree) dan Taksonomi Bloom/SOLO.
- Fase: ${data.fase || 'B'} | Kelas: ${data.kelas || '4'}
- Elemen: ${data.elemen || 'Keterampilan Gerak'}
- Kalimat CP: "${data.cpText || 'Peserta didik mempraktikkan variasi dan kombinasi pola gerak dasar lokomotor, non-lokomotor, dan manipulatif...'}"

INSTRUKSI:
1. Buat minimal 4-6 rumusan TP yang mencakup aspek Psikomotorik (kemampuan gerak), Kognitif (pengetahuan konsep gerak), dan Afektif (sportivitas & kerjasama).
2. Tentukan Kata Kerja Operasional (KKO) yang tepat dan dapat diamati secara objektif di lapangan.
3. Sertakan IKTP (Indikator Ketercapaian Tujuan Pembelajaran) untuk setiap TP.`
    },
    {
      id: 'validasi_tp',
      label: 'Telaah & Review TP Eksisting',
      description: 'Mengevaluasi apakah TP yang sudah dirumuskan sudah realistis dan terukur di lapangan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Lakukan telaah kritis (Peer Review) terhadap daftar Rumusan TP PJOK berikut:
${tpSummary}

ASPEK YANG PERLU DINILAI:
1. Kejelasan KKO (Apakah kata kerja operasional terukur dan tidak multitafsir?).
2. Ketercapaian di Lapangan (Apakah realistis dicapai dengan alokasi JP dan sarana sekolah Indonesia?).
3. Integrasi Profil Pelajar Pancasila (Apakah nilai karakter melekat alami dalam aktivitas gerak?).
4. Berikan saran penyempurnaan redaksional untuk setiap TP agar semakin sempurna!`
    }
  ];
}

/**
 * 3. KKTP Generator Prompts
 */
export function getKktpPrompts(data: { tp?: string; materi?: string; kelas?: string }): PromptTabDefinition[] {
  return [
    {
      id: 'rubrik_kktp',
      label: 'Rubrik Deskripsi 4 Kategori KKTP',
      description: 'Menyusun kriteria ketercapaian dengan 4 level: Perlu Bimbingan, Cukup, Baik, Sangat Baik.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah instrumen Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) PJOK:
- Materi Pokok: ${data.materi || 'Kebugaran Jasmani / Keterampilan Permainan Bola'}
- Tujuan Pembelajaran (TP): "${data.tp || 'Mempraktikkan gerak dasar dengan koordinasi yang baik serta mematuhi aturan'}"
- Kelas / Fase: ${data.kelas || 'Fase B (Kelas 4)'}

INSTRUKSI PENYUSUNAN:
1. Gunakan Pendekatan Rubrik Deskriptif 4 Kategori:
   - Perlu Bimbingan (0 - 65%): Belum menguasai teknik dasar, butuh pendampingan intensif.
   - Cukup (66 - 75%): Menguasai teknik dasar namun gerakan masih kaku/terputus.
   - Baik (76 - 85%): Mampu mempraktikkan gerakan dengan lancar dan konsisten.
   - Sangat Baik (86 - 100%): Menguasai variasi gerakan sempurna, mampu membimbing rekan sebaya.
2. Buat indikator unjuk kerja fisik yang jelas (misal: posisi kaki, ayunan tangan, perkenaan bola).
3. Sertakan panduan intervensi bagi siswa yang berada di kategori 'Perlu Bimbingan'.`
    },
    {
      id: 'interval_nilai',
      label: 'Skala Interval & Tindak Lanjut',
      description: 'Menentukan ambang batas ketuntasan dan program intervensi cepat guru di lapangan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rancanglah pedoman Interval Nilai KKTP PJOK dan Program Intervensi Praktik:
- TP: "${data.tp || 'Aktivitas Kebugaran & Permainan'}"

Sertakan:
1. Tabel Konversi Kuantitatif ke Kualitatif (Rentang Skor 0-100).
2. Bentuk Tindak Lanjut Nyata di Lapangan:
   - Siswa belum tuntas: Latihan drill gerak sederhana berulang dengan teman sebaya.
   - Siswa tuntas: Permainan kompetisi mini (game-based practice) yang menantang kreativitas taktik.`
    }
  ];
}

/**
 * 4. RPE & Analisis Jam Prompts
 */
export function getRpePrompts(data: { semester?: string; tahunAjaran?: string; totalPekan?: number; pekanEfektif?: number }): PromptTabDefinition[] {
  return [
    {
      id: 'rpe_distribusi',
      label: 'Distribusi Alokasi JP PJOK',
      description: 'Membagi pekan efektif ke dalam seluruh lingkup materi PJOK secara proporsional.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah rekomendasi Distribusi Jam Pelajaran (JP) PJOK berdasarkan Rincian Pekan Efektif (RPE):
- Semester: ${data.semester || '1 (Ganjil)'}
- Tahun Ajaran: ${data.tahunAjaran || '2024/2025'}
- Total Pekan: ${data.totalPekan || 20} Pekan
- Pekan Efektif: ${data.pekanEfektif || 16} Pekan (Setara ${Number(data.pekanEfektif || 16) * 3} JP jika 3 JP/pekan)

INSTRUKSI:
1. Petakan alokasi JP untuk materi:
   - Permainan Invasi (Sepakbola/Bola Tangan)
   - Permainan Net (Bola Voli/Bulutangkis)
   - Permainan Lapangan (Kasti/Rounders)
   - Atletik / Gerak Dasar
   - Senam Lantai & Irama
   - Kebugaran Jasmani
   - Pola Hidup Sehat (Teori)
   - Cadangan / Asesmen Sumatif Akhir Semester
2. Pastikan proporsi seimbang antara materi dominan outdoor dan materi cadangan bila cuaca hujan.`
    }
  ];
}

/**
 * 5. PROTA & PROSEM Prompts
 */
export function getProtaProsemPrompts(type: 'prota' | 'prosem', data: any): PromptTabDefinition[] {
  return [
    {
      id: 'jadwal_generator',
      label: `Optimasi Alur ${type === 'prota' ? 'PROTA' : 'PROSEM'}`,
      description: `Rekomendasi urutan pembelajaran ${type.toUpperCase()} yang sesuai dengan kondisi fisik dan cuaca tahunan.`,
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Buatlah rencana optimalisasi ${type === 'prota' ? 'Program Tahunan (PROTA)' : 'Program Semester (PROSEM)'} PJOK Kurikulum Merdeka:
- Sasaran: SD/SMP/SMA PJOK
- Konteks: Kondisi sekolah di Indonesia (iklim tropis, musim hujan bulan Nov-Feb, lapangan multifungsi).

INSTRUKSI:
1. Urutkan lingkup materi dengan memperhatikan kurva kelelahan fisik siswa dan ketersediaan sarana.
2. Tempatkan materi teori kesehatan (kebersihan diri, gizi seimbang, bahaya merokok) pada pekan rawan cuaca ekstrem/hujan.
3. Rancang jeda pekan untuk Asesmen Sumatif Lingkup Materi dan Remedial.`
    }
  ];
}

/**
 * 6. Modul Ajar (RPP) Prompts
 */
export function getModulAjarPrompts(modul?: any): PromptTabDefinition[] {
  const judul = modul?.title || 'Modul Ajar PJOK';
  const materi = modul?.materiPokok || 'Aktivitas Permainan & Kebugaran';
  const kelas = modul?.grade ? `Kelas ${modul.grade}` : 'Kelas 4';

  return [
    {
      id: 'generator_modul',
      label: 'Sintaks Modul Ajar Lengkap',
      description: 'Menyusun Modul Ajar lengkap dengan Pertanyaan Pemantik, 3 Tahap Inti, dan Asesmen Otentik.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah Modul Ajar (RPP) PJOK Kurikulum Merdeka berstandar nasional yang lengkap dan inspiratif:
- Judul: ${judul}
- Materi Pokok: ${materi}
- Sasaran: ${kelas}
- Alokasi Waktu: 3 JP (3 x 35 Menit / 1 Pertemuan)

KOMPONEN WAJIB:
1. IDENTITAS & PROFIL: TP, Target Peserta Didik, Model Pembelajaran (Discovery / Problem-Based / Teaching Games for Understanding / TGfU).
2. PEMAHAMAN BERMAKNA & PERTANYAAN PEMANTIK: Pertanyaan menarik yang merangsang anak aktif bergerak dan berpikir kritis.
3. LANGKAH PEMBELAJARAN DETAIL:
   - Pendahuluan (15 menit): Pemanasan dinamis dalam bentuk permainan (Game-based warm up), apersepsi, ice breaking.
   - Kegiatan Inti (75 menit): Pembelajaran berdiferensiasi, eksplorasi gerak bebas, variasi tantangan gerak, permainan modifikasi.
   - Penutup (15 menit): Pendinginan (cooling down) santai, refleksi perasaan, apresiasi sportivitas.
4. ASESMEN: Lembar observasi unjuk kerja gerak & rubrik penilaian sikap gotong royong.`
    },
    {
      id: 'deep_learning_modul',
      label: 'Integrasi Deep Learning (Mindful, Meaningful, Joyful)',
      description: 'Meningkatkan modul ajar agar tidak sekadar latihan mekanik, tapi membentuk karakter mendalam.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Integrasikan prinsip Deep Learning ke dalam Modul Ajar PJOK "${judul} - ${materi}":

1. MINDFUL LEARNING (Sadar Penuh):
   - Bagaimana melatih kesadaran sensori siswa (merasakan detak jantung, ritme pernapasan, koordinasi mata dan tangan saat menyentuh bola).
2. MEANINGFUL LEARNING (Bermakna):
   - Mengaitkan aktivitas gerak ini dengan fungsi kesehatan jangka panjang, keselamatan diri, dan rasa percaya diri dalam kehidupan sehari-hari.
3. JOYFUL LEARNING (Menyenangkan):
   - Strategi mengubah latihan fisik yang berat menjadi tantangan bermain yang memicu tawa, kerjasama tim, dan antusiasme tinggi.`
    },
    {
      id: 'diferensiasi_modul',
      label: 'Adaptasi Diferensiasi & Inklusi',
      description: 'Panduan modifikasi gerakan bagi siswa dengan kemampuan motorik beragam di lapangan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Buatlah panduan modifikasi pembelajaran berdiferensiasi untuk Modul Ajar PJOK "${judul}":
- Level 1 (Kemampuan Dasar): Penyesuaian jarak lemparan/tendangan lebih dekat, bola lebih empuk, target lebih besar.
- Level 2 (Kemampuan Menengah): Aturan standar dengan variasi tempo.
- Level 3 (Tantangan Mahir): Pembatasan sentuhan bola, penjagaan satu lawan satu, peran sebagai pengatur serangan.
Sertakan tips komunikasi positif bagi guru saat memotivasi anak yang minder atau takut berbuat salah.`
    }
  ];
}

/**
 * 7. Deep Learning RPM Prompts
 */
export function getDeepLearningPrompts(topic?: string): PromptTabDefinition[] {
  return [
    {
      id: 'rpm_sintaks',
      label: 'Rancangan Pembelajaran Mendalam (RPM)',
      description: 'Menyusun dokumen RPM berdimensi Mindful, Meaningful, dan Joyful.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rancanglah Modul RPM (Rencana Pembelajaran Mendalam / Deep Learning) PJOK Kurikulum Merdeka:
- Topik / Materi: ${topic || 'Pendidikan Jasmani Berorientasi Nilai Kehidupan'}

KOMPONEN RPM:
1. Pemikiran Filosofis: Mengapa materi gerak ini esensial bagi pembentukan manusia seutuhnya (Holistic Health)?
2. The 3 Pillars of Deep Learning:
   - Mindful: Aktivitas mengasah fokus mental, ketenangan emosi saat menang/kalah.
   - Meaningful: Refleksi filosofis dari olahraga (misal: passing sepakbola = bukti bahwa keberhasilan butuh saling percaya).
   - Joyful: Pemanasan kreatif penuh keceriaan tanpa tekanan penilaian kaku.
3. Rubrik Refleksi Diri Siswa: 3 pertanyaan refleksi mendalam di akhir pelajaran.`
    }
  ];
}

/**
 * 8. Absensi & Penilaian Prompts
 */
export function getAbsensiPenilaianPrompts(className?: string, studentCount?: number): PromptTabDefinition[] {
  return [
    {
      id: 'catatan_rapor',
      label: 'Generator Narasi Deskripsi Rapor',
      description: 'Membuat narasi capaian kompetensi rapor otomatis berdasarkan capaian TP tertinggi dan TP yang perlu bimbingan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Buatlah bank kalimat deskripsi Rapor Kurikulum Merdeka untuk mata pelajaran PJOK (Rentang 25 - 45 kata per siswa):
- Kelas: ${className || 'Kelas PJOK'}

Sediakan contoh deskripsi untuk 3 profil siswa:
1. Siswa Berprestasi Tinggi: "Menunjukkan penguasaan sangat baik dalam mempraktikkan variasi pola gerak dasar lokomotor dan manipulatif serta konsisten menunjukkan sportivitas tinggi."
2. Siswa Berkembang Sesuai Harapan: "Menunjukkan penguasaan baik dalam konsep gerak dan kebugaran jasmani, perlu sedikit latihan konsistensi dalam servis bola voli."
3. Siswa Perlu Bimbingan: "Mampu memahami konsep hidup sehat, namun masih memerlukan pendampingan dalam koordinasi gerak lari estafet dan keseimbangan senam lantai."`
    },
    {
      id: 'analisis_kehadiran',
      label: 'Surat Komunikasi Walikelas / Orang Tua',
      description: 'Draf naskah pesan WhatsApp / surat resmi pemantauan kebugaran dan kehadiran siswa.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah draf pesan komunikasi santun dan suportif dari Guru PJOK kepada Orang Tua / Wali Siswa mengenai:
1. Sosialisasi pentingnya sarapan sehat sebelum jam pelajaran olahraga pagi.
2. Pengingat pemakaian pakaian olahraga lengkap dan membawa botol air minum pribadi (hidrasi).
3. Penjelasan bagi siswa yang sakit atau tidak dapat mengikuti aktivitas fisik berat dengan opsi tugas pengganti literasi kesehatan.`
    }
  ];
}

/**
 * 8b. Presensi Mingguan PJOK (1 Bulan) Prompts
 */
export function getAbsensiMingguanPjokPrompts(
  className?: string, 
  monthName?: string, 
  year?: number, 
  topics?: string[]
): PromptTabDefinition[] {
  const materiStr = topics && topics.length > 0 ? topics.join('; ') : 'Kebugaran Jasmani dan Permainan Gerak Dasar';
  return [
    {
      id: 'analisis_kehadiran_pjok',
      label: 'Analisis Partisipasi & Kebugaran Mingguan',
      description: 'Menganalisis keterlibatan gerak, kepatuhan pakaian olahraga, dan ketidakhadiran siswa dalam 1 bulan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Lakukan telaah dan analisis pedagogis terhadap data presensi mingguan mata pelajaran PJOK:
- Rombel / Kelas: ${className || 'Kelas PJOK SD'}
- Periode: Bulan ${monthName || 'Bulan Berjalan'} ${year || 2026}
- Materi / Topik Pertemuan 1 s.d. 4-5 Pekan: ${materiStr}

INSTRUKSI ANALISIS:
1. Evaluasi tingkat kehadiran siswa dalam aktivitas fisik lapangan (apakah siswa antusias mengikuti materi praktik mingguan).
2. Tinjauan kepatuhan seragam olahraga: dampak siswa yang tidak berseragam lengkap terhadap keselamatan (safety) dan kenyamanan gerak.
3. Rekomendasi solusi bagi siswa yang berstatus Sakit (S) atau Dispensasi fisik agar tetap mendapatkan nilai pemahaman gerak tanpa membahayakan kondisi kesehatannya.
4. Susun 3 tips motivasi gerak seru untuk pertemuan pekan berikutnya.`
    },
    {
      id: 'dispensasi_adaptif',
      label: 'Panduan Modifikasi Siswa Sakit/Dispensasi',
      description: 'Strategi penugasan alternatif yang edukatif bagi siswa yang tidak dapat beraktivitas fisik berat.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rancanglah panduan tugas alternatif & asesmen adaptif bagi siswa PJOK yang memiliki keterangan Sakit (S), Izin Sakit Ringan, atau Dispensasi Cedera fisik:
1. Peran Pengamat / Juri Teman Sebaya (Peer Assessor): Siswa bertugas mengamati teknik teman sekelas dengan lembar ceklis sederhana.
2. Peran Asisten Pencatat Skor & Waktu: Siswa mencatat waktu lari atau skor permainan kasti/voli.
3. Tugas Literasi Gerak: Ringkasan singkat aturan permainan dan pentingnya pemanasan/pendinginan.
4. Tips komunikasi empati guru agar siswa tidak merasa dikucilkan saat tidak bisa berlari di lapangan.`
    },
    {
      id: 'laporan_bulanan_pjok',
      label: 'Laporan Pembelajaran Mingguan ke Kepala Sekolah',
      description: 'Format naskah laporan kedinasan rekapitulasi keterlaksanaan jam tatap muka PJOK sebulan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah naskah laporan bulanan keterlaksanaan mata pelajaran PJOK kepada Kepala Sekolah:
- Rombel: ${className || 'Kelas PJOK'}
- Bulan / Tahun: ${monthName || 'Bulan Berjalan'} ${year || 2026}
- Rincian Pertemuan: 4 s.d. 5 Pekan Tatap Muka Lapangan

FORMAT DOKUMEN:
1. Pendahuluan (Ketercapaian Alokasi Waktu 3-4 JP per minggu).
2. Rekapitulasi Kehadiran & Partisipasi Siswa (Persentase Hadir, Sakit, Izin, Alpa).
3. Catatan Penggunaan Sarana & Prasarana Lapangan (Bola, Matras, Kerucut/Cone, Lapangan).
4. Catatan Keselamatan Siswa (Zero accident / Penanganan cedera ringan).
5. Tanda tangan resmi pelaporan oleh Guru Pengampu PJOK.`
    }
  ];
}

/**
 * 8c. Rekapitulasi Presensi 1 Semester PJOK Prompts
 */
export function getRekapSemesterPjokPrompts(
  className?: string,
  semester?: number,
  tahunAjaran?: string,
  avgAttendancePercent?: number,
  totalJp?: number
): PromptTabDefinition[] {
  return [
    {
      id: 'analisis_semester_pjok',
      label: 'Evaluasi & Refleksi Kehadiran 1 Semester',
      description: 'Analisis komprehensif kehadiran lapangan, kepatuhan seragam, dan pemenuhan alokasi JP PJOK semester.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Lakukan analisis evaluasi akhir semester terhadap keterlaksanaan dan kehadiran pembelajaran PJOK:
- Rombongan Belajar: ${className || 'Kelas PJOK SD'}
- Semester: Semester ${semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}
- Tahun Ajaran: ${tahunAjaran || '2026/2027'}
- Rata-rata Kehadiran Kelas: ${avgAttendancePercent || 92}%
- Total Alokasi JP Terealisasi: ${totalJp || 54} JP

INSTRUKSI ANALISIS:
1. Tinjau konsistensi kehadiran peserta didik selama 6 bulan dalam mengikuti aktivitas fisik lapangan.
2. Analisis tren ketidakhadiran (apakah ada bulan-bulan tertentu dengan lonjakan sakit akibat pergantian musim cuaca/hujan).
3. Evaluasi kepatuhan tata tertib berpakaian olahraga dan dampaknya terhadap keselamatan gerak siswa.
4. Rancang 3 strategi taktis untuk mempertahankan kebugaran dan meminimalkan angka ketidakhadiran di semester berikutnya.`
    },
    {
      id: 'deskripsi_rapor_kebugaran',
      label: 'Perumusan Kalimat Rapor Semester (Kehadiran & Disiplin Fisik)',
      description: 'Menyusun narasi deskripsi capaian rapor Kurikulum Merdeka terkait keaktifan fisik dan kehadiran semester.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah 4 tingkatan narasi deskripsi Rapor Kurikulum Merdeka aspek Kehadiran, Partisipasi Gerak, dan Kebiasaan Hidup Sehat untuk 1 Semester:
- Mata Pelajaran: PJOK
- Kelas: ${className || 'Kelas PJOK SD'}

FORMAT NARASI:
1. Kategori Sangat Baik (Kehadiran 95-100%): "Sangat aktif, bersemangat dan konsisten mempraktikkan gaya hidup aktif serta disiplin mengenakan seragam olahraga di setiap pertemuan lapangan."
2. Kategori Baik (Kehadiran 80-94%): "Menunjukkan partisipasi baik dalam sebagian besar aktivitas gerak lapangan dan mampu bekerja sama dengan sportif bersama teman."
3. Kategori Cukup (Kehadiran 70-79%): "Cukup aktif dalam aktivitas fisik, perlu meningkatkan kedisiplinan kehadiran dan kelengkapan pakaian olahraga."
4. Kategori Perlu Bimbingan (< 70% atau sering izin/sakit): "Perlu motivasi lebih dalam menjaga kebugaran jasmani dan pendampingan orang tua terkait kontinuitas kehadiran jam PJOK."`
    },
    {
      id: 'laporan_semester_kepsek',
      label: 'Laporan Keterlaksanaan Semester ke Kepala Sekolah & Pengawas',
      description: 'Naskah dinas laporan pertanggungjawaban keterlaksanaan kurikulum PJOK selama 1 semester.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Buatlah naskah Laporan Akhir Semester Keterlaksanaan Pembelajaran PJOK kepada Kepala Sekolah dan Pengawas Pembina:
- Sekolah: SD Negeri
- Rombel: ${className || 'Kelas PJOK'}
- Periode: Semester ${semester === 1 ? '1 (Ganjil)' : '2 (Genap)'} T.A. ${tahunAjaran || '2026/2027'}

STRUKTUR DOKUMEN:
1. Dasar Pelaksanaan (Kurikulum Merdeka PJOK & Standar Alokasi Jam Mengajar 3 JP/pekan).
2. Ketercapaian Alokasi Waktu Tatap Muka (Persentase keterlaksanaan materi lapangan vs teori kelas).
3. Rekapitulasi Kehadiran Kolektif (Hadir: %, Sakit: %, Izin: %, Alpa: %).
4. Kondisi Sarana Prasarana Olahraga (Alat bola, matras, lapangan) dan Insiden Keselamatan (Zero Accident).
5. Rekomendasi Pengadaan Sarana PJOK Semester Mendatang.
6. Kolom Tanda Tangan Guru Pengampu PJOK dan Mengetahui Kepala Sekolah.`
    }
  ];
}

/**
 * 9. Jurnal Harian Prompts
 */
export function getJurnalPrompts(journalCount?: number): PromptTabDefinition[] {
  return [
    {
      id: 'refleksi_jurnal',
      label: 'Refleksi Pedagogis Guru PJOK',
      description: 'Menyusun catatan reflektif pembelajaran di lapangan untuk dokumen evaluasi kinerja.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah format refleksi jurnal mengajar harian guru PJOK yang tajam dan profesional:
Memuat 4 kuadran reflektif:
1. Keberhasilan (What went well): Aktivitas apa yang paling memicu partisipasi aktif siswa di lapangan hari ini?
2. Hambatan Lapangan (Challenges): Faktor cuaca panas, keterbatasan alat bola, atau perselisihan sportivitas antar siswa.
3. Penanganan Langsung (Action taken): Solusi cepat yang diambil guru saat situasi terjadi.
4. Rencana Perbaikan Pekan Depan (Next steps): Penyesuaian modul atau penambahan variasi game.`
    }
  ];
}

/**
 * 10. Rubrik Fisik AI Prompts
 */
export function getRubrikFisikPrompts(materi?: string): PromptTabDefinition[] {
  return [
    {
      id: 'rubrik_gerak',
      label: 'Rubrik Tes Gerak Otentik & TKJI',
      description: 'Rubrik evaluasi biomekanika gerak cabang olahraga dan tes kebugaran jasmani.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah Rubrik Penilaian Kinerja Praktik (Psychomotor Authentic Rubric) untuk cabang:
- Materi / Cabang Olahraga: ${materi || 'Keterampilan Dasar Sepakbola / Bola Voli / Senam / Atletik'}

KRITERIA ASESMEN:
1. Tahap Persiapan (Sikap Awal): Keseimbangan tubuh, pandangan mata, posisi tumpuan kaki.
2. Tahap Pelaksanaan (Gerakan Inti): Koordinasi tungkai dan lengan, titik perkenaan bola/alat, transfer tenaga.
3. Tahap Akhir (Follow-Through): Gerak lanjutan, pemulihan keseimbangan tubuh.
4. Format Skor: 1 (Kurang), 2 (Cukup), 3 (Baik), 4 (Sangat Baik) lengkap dengan deskriptor operasional.`
    }
  ];
}

/**
 * 11. Slide PPT & Materi Ajar Prompts
 */
export function getSlideMateriPrompts(title?: string): PromptTabDefinition[] {
  return [
    {
      id: 'outline_slide',
      label: 'Outline Naskah Slide Presentasi (10 Slide)',
      description: 'Naskah slide presentasi visual siap salin ke PowerPoint / Gamma App / Canva.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susun naskah slide presentasi edukasi interaktif untuk siswa dengan materi:
- Judul: ${title || 'Pola Hidup Sehat & Kebugaran Jasmani PJOK'}

STRUKTUR 10 SLIDE:
- Slide 1: Judul Keren & Maskot PJOK
- Slide 2: Pertanyaan Pemantik / Tebak Gambar
- Slide 3: Mengapa Tubuh Kita Butuh Bergerak?
- Slide 4: Konsep Gerak Inti (Anatomi & Prinsip Fisik Sederhana)
- Slide 5: Langkah Praktik 1-2-3 (Visual Step)
- Slide 6: Kesalahan Umum yang Sering Terjadi di Lapangan
- Slide 7: Tips Keselamatan & Pencegahan Cedera
- Slide 8: Kuis Kilat 3 Soal Interaktif (Benar/Salah)
- Slide 9: Tantangan Gerak di Rumah (Home Movement Challenge)
- Slide 10: Pesan Motivasi Juara & Penutup`
    }
  ];
}

/**
 * 12. LKPD Gambar Prompts
 */
export function getLkpdPrompts(title?: string): PromptTabDefinition[] {
  return [
    {
      id: 'desain_lkpd',
      label: 'Lembar Kerja Praktik Siswa Berdiferensiasi',
      description: 'Merancang format lembar kerja peserta didik yang visual, interaktif, dan memuat tugas gerak lapangan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rancang naskah Lembar Kerja Peserta Didik (LKPD) PJOK Kurikulum Merdeka yang ramah anak:
- Materi: ${title || 'Aktivitas Kebugaran & Permainan Tradisional'}

BAGIAN LKPD:
1. Misi Gerak (Story-based Mission): Ubah tugas fisik menjadi misi petualangan pahlawan kebugaran.
2. Gambar & Bagan Pos Lapangan: Instruksi per pos gerak (Pos A, Pos B, Pos C).
3. Lembar Pengamatan Teman Sebaya (Peer-Assessment): Checklist sederhana apakah teman sudah melakukan gerak dengan benar.
4. Refleksi Emotikon: Kolom ekspresi wajah (Senang, Lelah tapi Bangga, Perlu Belajar Lagi).`
    }
  ];
}

/**
 * 13. Cover Sampul Prompts
 */
export function getCoverPrompts(): PromptTabDefinition[] {
  return [
    {
      id: 'dalle_cover_prompt',
      label: 'Prompt AI Generator Gambar Cover (Midjourney / DALL-E)',
      description: 'Prompt bahasa Inggris detail untuk menghasilkan gambar sampul ilustrasi PJOK modern tanpa teks.',
      prompt: `Prompt Gambar AI (Salin ke Midjourney / DALL-E / Bing Image Creator):

"A vibrant, high-resolution vector illustration of Indonesian school students (elementary to middle school boys and girls) happily participating in dynamic physical education activities, playing sports on an outdoor sports field under morning sunlight. Modern Indonesian school sport uniforms in green and white colors, bright tropical trees in the background, joyful facial expressions, clean minimalist educational cover art style, cinematic lighting, ultra-detailed, flat design with rich depth, 8k resolution, aspect ratio 3:4 --v 6.0 --no text letters"`
    }
  ];
}

/**
 * 14. Ulangan Harian & Rekap Nilai TP Prompts
 */
export function getUlanganHarianPrompts(materi?: string): PromptTabDefinition[] {
  return [
    {
      id: 'kisi_ulangan',
      label: 'Kisi-Kisi & Soal Ulangan Harian PJOK',
      description: 'Paket ulangan harian: 10 PG HOTS, 5 Isian Singkat, dan 1 Penugasan Praktik Lapangan.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Susunlah paket Ulangan Harian PJOK Kurikulum Merdeka:
- Materi: ${materi || 'Kebugaran Jasmani & Pola Hidup Sehat'}
- Bentuk: 10 Soal Pilihan Ganda (berbasis stimulus situasi nyata), 5 Soal Isian Singkat, dan 1 Rubrik Penugasan Praktik.
- Kunci Jawaban Lengkap dan Pembahasan Pedagogis.`
    }
  ];
}

/**
 * 14b. Rekap Nilai Harian per TP 1 Semester Prompts
 */
export function getRekapNilaiTpPrompts(
  className?: string,
  grade?: number,
  semester?: number,
  classAverage?: number,
  kktp?: number,
  tpListStr?: string
): PromptTabDefinition[] {
  return [
    {
      id: 'analisis_rekap_semester',
      label: 'Analisis Evaluasi Nilai 1 Semester',
      description: 'Analisis komprehensif ketuntasan TP, nilai harian, dan rekomendasi tindak lanjut.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Lakukan telaah dan analisis komprehensif terhadap Laporan Rekapitulasi Nilai Harian per Tujuan Pembelajaran (TP) 1 Semester:
- Rombel / Kelas: ${className || 'Kelas PJOK SD'} (Kelas ${grade || 1})
- Semester: Semester ${semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}
- Batas Ketuntasan KKTP: ${kktp || 70}
- Rata-rata Nilai Akhir Kelas: ${classAverage || 78}
- Daftar Tujuan Pembelajaran (TP) Semester:
${tpListStr || '1. Gerak Dasar Lokomotor; 2. Gerak Dasar Non-Lokomotor; 3. Kebugaran Jasmani'}

INSTRUKSI ANALISIS:
1. Evaluasi pencapaian kompetensi: Tujuan Pembelajaran (TP) mana yang memiliki tingkat ketuntasan tertinggi dan terendah.
2. Analisis korelasi antara Nilai Harian Praktik Lapangan, Teori Pemahaman, dan Nilai Sumatif Akhir Semester (SAS).
3. Rancang rencana tindak lanjut pembinaan kebugaran dan teknik gerak untuk semester berikutnya.`
    },
    {
      id: 'narasi_rapor_kurmer',
      label: 'Panduan Narasi Deskripsi Rapor Kurikulum Merdeka',
      description: 'Standar perumusan narasi capaian tertinggi & terendah rapor semester PJOK.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Berikan panduan dan bank kalimat narasi deskripsi Rapor Kurikulum Merdeka bidang PJOK Semester ${semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}:
- Kelas: ${className || 'Kelas SD'}
- Standar KKTP: ${kktp || 70}

Sertakan:
1. Formula baku narasi capaian optimal (Kategori Sangat Baik / Nilai 90-100).
2. Formula baku narasi capaian berkembang baik (Kategori Baik / Nilai 80-89).
3. Formula baku narasi perlu penguatan/bimbingan (Kategori Kurang / Nilai < 70).
4. Contoh deskripsi konkret yang menggabungkan aspek keterampilan gerak fisik dan sikap sportivitas.`
    },
    {
      id: 'program_remedial_pengayaan',
      label: 'Program Remedial & Pengayaan Berbasis TP',
      description: 'Desain program perbaikan dan pengayaan praktis untuk siswa di bawah dan di atas KKTP.',
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Rancanglah draf resmi Program Remedial dan Pengayaan Hasil Asesmen Harian per TP PJOK:
- Tingkat: Kelas ${grade || 1} SD Semester ${semester === 1 ? '1' : '2'}
- Kriteria KKTP: ${kktp || 70}

FORMAT DOKUMEN:
1. Rencana Remedial: Pendampingan tutor sebaya, modifikasi alat/lapangan, dan tes ulang berbasis performa.
2. Rencana Pengayaan: Pemberian tantangan gerak kombinasi yang lebih dinamis dan peran kepemimpinan mini (kapten regu).
3. Format tabel monitoring pelaksanaan remedial & pengayaan beserta tanggal dan paraf guru.`
    }
  ];
}

/**
 * 15. Kode Etik, KKO & Cetak Laporan Prompts
 */
export function getKodeEtikKkoCetakPrompts(menuName: string): PromptTabDefinition[] {
  return [
    {
      id: 'prompt_menu',
      label: `Panduan Profesional ${menuName}`,
      description: `Rekomendasi implementasi praktis nilai-nilai profesionalisme guru PJOK.`,
      prompt: `${PJOK_SYSTEM_ROLE}

TUGAS: Berikan telaah dan panduan profesional untuk Guru PJOK terkait topik:
"${menuName}"

Sertakan:
1. Prinsip Etika & Keamanan di Lapangan Olahraga Sekolah.
2. Strategi keteladanan guru dalam membina karakter sportivitas siswa.
3. Keterkaitan langsung dengan standar kompetensi guru dan Kurikulum Merdeka.`
    }
  ];
}
