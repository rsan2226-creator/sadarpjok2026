import { ModulAjar, JurnalMengajar, RubrikFisik, ClassData, Student, AtpResult, DeepLearningRPM, KktpData, RpeData, ProtaData, ProsemData, SlidePresentationData, InteractiveLkpdData, CpToTpResult } from '../types';

/**
 * Utility to wrap HTML content into a Microsoft Word compatible HTML document format,
 * which Google Docs parses perfectly with standard page sizes, margins, fonts, and clean tables.
 */
function wrapWithDocShell(title: string, contentHtml: string): string {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 size */
      margin: 72.0pt 72.0pt 72.0pt 72.0pt; /* 1 inch margins */
      mso-header-margin: 36.0pt;
      mso-footer-margin: 36.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: "Arial", "Liberation Sans", sans-serif;
      font-size: 11pt;
      color: #1e293b;
      line-height: 1.5;
    }
    h1 {
      font-family: "Arial Black", "Arial", sans-serif;
      font-size: 16pt;
      color: #0f172a;
      margin-top: 18pt;
      margin-bottom: 6pt;
      text-transform: uppercase;
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
    }
    h2 {
      font-family: "Arial", sans-serif;
      font-size: 13pt;
      color: #0f172a;
      font-weight: bold;
      margin-top: 16pt;
      margin-bottom: 6pt;
      border-left: 4px solid #10b981;
      padding-left: 8px;
    }
    h3 {
      font-family: "Arial", sans-serif;
      font-size: 11pt;
      color: #1e293b;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 6pt;
    }
    .info-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      margin-bottom: 12pt;
      border-radius: 6px;
    }
    .info-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
    }
    .info-grid td {
      border: none;
      padding: 4px 8px;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10pt;
      margin-bottom: 12pt;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
      font-size: 10pt;
      border: 1px solid #cbd5e1;
      padding: 8px;
      text-align: left;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 8px;
      font-size: 10pt;
      color: #334155;
      vertical-align: top;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4pt;
    }
    .badge {
      background-color: #e0f2fe;
      color: #0369a1;
      padding: 2px 6px;
      font-size: 9pt;
      font-weight: bold;
      border-radius: 4px;
    }
    .badge-success {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-danger {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    .text-center {
      text-align: center;
    }
    .text-right {
      text-align: right;
    }
    .font-bold {
      font-weight: bold;
    }
    .font-mono {
      font-family: "Courier New", Courier, monospace;
    }
    .signature-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 40pt;
    }
    .signature-grid td {
      border: none;
      text-align: center;
      width: 50%;
      padding-top: 12px;
    }
    .bg-row-alt {
      background-color: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${contentHtml}
  </div>
</body>
</html>`;
}

/**
 * Triggers a browser download of a .doc (Google Docs compatible Word document) file.
 */
export function downloadDocFile(filename: string, docContent: string): void {
  const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Exports Modul Ajar (RPP) to Google Docs compatible Word Document
 */
export function exportModulToDoc(modul: ModulAjar): string {
  const tujuanItems = modul.tujuanPembelajaran.map(t => `<li style="margin-bottom: 4px;">🎯 ${t}</li>`).join('\n');
  const pendahuluanItems = modul.kegiatanPembelajaran.pendahuluan.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('\n');
  const intiItems = modul.kegiatanPembelajaran.inti.map(i => `<li style="margin-bottom: 4px;">${i}</li>`).join('\n');
  const penutupItems = modul.kegiatanPembelajaran.penutup.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('\n');
  const saranaItems = modul.saranaPrasarana.map(s => `<span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; font-size: 9pt; border-radius: 4px; margin-right: 6px; display: inline-block;">${s}</span>`).join(' ');

  const content = `
    <h1>MODUL AJAR / RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">KURIKULUM MERDEKA &bull; PENDIDIKAN JASMANI OLAHRAGA & KESEHATAN (PJOK)</p>
    
    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Materi Pokok:</strong> ${modul.materiPokok}</td>
          <td width="50%"><strong>Alokasi Waktu:</strong> ${modul.alokasiWaktu || '2 x 35 Menit'}</td>
        </tr>
        <tr>
          <td><strong>Jenjang/Kelas:</strong> Kelas ${modul.grade} SD</td>
          <td><strong>Dibuat Pada:</strong> ${new Date(modul.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
        <tr>
          <td><strong>Semester:</strong> Semester ${modul.semester === 1 ? 'I (Ganjil)' : 'II (Genap)'}</td>
          <td><strong>Metode:</strong> <span class="badge badge-success">Pembelajaran Fisik Aktif</span></td>
        </tr>
      </table>
    </div>

    <h2>I. TUJUAN PEMBELAJARAN</h2>
    <ul>
      ${tujuanItems || '<li>Tidak ada tujuan spesifik yang didefinisikan.</li>'}
    </ul>

    <h2>II. SARANA & PRASARANA (ALAT)</h2>
    <p style="margin-top: 6px; margin-bottom: 12px;">
      ${saranaItems || '<span style="color: #64748b;">Menggunakan lapangan terbuka sekolah standar.</span>'}
    </p>

    <h2>III. LANGKAH-LANGKAH PEMBELAJARAN</h2>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 10px; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        A. Kegiatan Pendahuluan (10 - 15 Menit) - <i>Fisik Hangat</i>
      </h3>
      <ul>
        ${pendahuluanItems || '<li>Melakukan baris-berbaris, absensi kelas, berdoa, dan pemanasan statis/dinamis yang menyenangkan.</li>'}
      </ul>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; margin-bottom: 10px; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #14532d; border-bottom: 1px solid #bbf7d0; padding-bottom: 4px;">
        B. Kegiatan Inti (45 - 50 Menit) - <i>Praktik Motorik</i>
      </h3>
      <ul>
        ${intiItems || '<li>Siswa menyimak demonstrasi guru tentang teknik gerak utama, lalu mempraktikkannya secara berulang berkelompok.</li>'}
      </ul>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 10px; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        C. Kegiatan Penutup (10 Menit) - <i>Pendinginan & Refleksi</i>
      </h3>
      <ul>
        ${penutupItems || '<li>Melakukan cooling down bersama, menarik kesimpulan esensi materi gerak, berdoa penutup, ganti baju kembali.</li>'}
      </ul>
    </div>

    <h2>IV. STRATEGI ASESMEN / PENILAIAN</h2>
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; font-size: 10pt;">
      ${modul.rubrikPenilaian || 'Kombinasi Asesmen Formatif (Keaktifan Gerak & Sportivitas), dan Asesmen Sumatif melalui Tes Rubrik Kinerja Motorik yang telah divalidasi sistem.'}
    </div>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(modul.title || 'Modul_Ajar_PJOK', content);
}

/**
 * 2. Exports Capaian Pembelajaran (CP) to Google Docs compatible Word Document
 */
export function exportCpToDoc(faseName: string, grades: string, elements: any[]): string {
  const items = elements.map((el, idx) => `
    <div style="margin-bottom: 15pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
      <div style="background-color: #f1f5f9; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; font-weight: bold; font-size: 11pt; color: #0f172a;">
        Elemen ${idx + 1}: ${el.name}
      </div>
      <div style="padding: 12px; font-size: 10pt; color: #334155; line-height: 1.6;">
        ${el.description}
      </div>
    </div>
  `).join('\n');

  const content = `
    <h1>CAPAIAN PEMBELAJARAN (CP) PJOK</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">STANDAR NASIONAL &bull; KURIKULUM MERDEKA SD</p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 6px; margin-bottom: 15pt;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <strong style="font-size: 13pt; color: #1e3a8a;">${faseName}</strong><br>
            <span style="font-size: 9.5pt; color: #475569;">Fokus Tingkatan Kelas: ${grades}</span>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="badge" style="background-color: #3b82f6; color: #ffffff; padding: 4px 8px; font-size: 9pt; border-radius: 4px;">SADAR PJOK</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 10pt;">
      ${items}
    </div>
  `;

  return wrapWithDocShell(`CP_PJOK_${faseName.replace(' ', '_')}`, content);
}

/**
 * 3. Exports Student Attendance List to Google Docs compatible Word Document
 */
export function exportAbsensiToDoc(activeClass: ClassData, date: string): string {
  const rows = activeClass.students.map((st, idx) => {
    const status = st.attendance[date] || 'Belum Diisi';
    let statusStyle = 'background-color: #f1f5f9; color: #475569;';
    if (status === 'H') statusStyle = 'background-color: #d1fae5; color: #065f46; font-weight: bold;';
    if (status === 'S') statusStyle = 'background-color: #dbeafe; color: #1e40af; font-weight: bold;';
    if (status === 'I') statusStyle = 'background-color: #fef3c7; color: #92400e; font-weight: bold;';
    if (status === 'A') statusStyle = 'background-color: #fee2e2; color: #991b1b; font-weight: bold;';

    let h = 0, s = 0, i = 0, a = 0;
    Object.values(st.attendance).forEach(v => {
      if (v === 'H') h++;
      if (v === 'S') s++;
      if (v === 'I') i++;
      if (v === 'A') a++;
    });

    const bgRow = idx % 2 === 1 ? 'class="bg-row-alt"' : '';

    return `
      <tr ${bgRow}>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${idx + 1}</td>
        <td style="font-weight: bold;">
          <div>${st.name}</div>
          ${st.nisn ? `<div style="font-size: 8.5pt; font-weight: normal; color: #64748b; font-family: monospace;">NISN: ${st.nisn}</div>` : ''}
        </td>
        <td style="text-align: center; font-weight: bold;">${st.gender}</td>
        <td style="text-align: center;"><span style="padding: 2px 8px; border-radius: 4px; font-size: 9pt; ${statusStyle}">${status}</span></td>
        <td style="text-align: right; font-family: 'Courier New', monospace; font-size: 9pt; color: #475569;">${h} H &bull; ${s} S &bull; ${i} I &bull; ${a} A</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1>REKAP PRESENSI HARIAN SISWA</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">DOKUMEN ADMINISTRASI GURU PJOK SD</p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Rombongan Belajar:</strong> ${activeClass.name}</td>
          <td width="50%" style="text-align: right;"><strong>Total Murid:</strong> ${activeClass.students.length} Siswa</td>
        </tr>
        <tr>
          <td><strong>Tanggal Presensi:</strong> ${date}</td>
          <td style="text-align: right;"><strong>Kelas:</strong> Kelas ${activeClass.grade} SD</td>
        </tr>
      </table>
    </div>

    <table>
      <thead>
        <tr>
          <th width="8%" style="text-align: center;">No.</th>
          <th width="40%">Nama Siswa</th>
          <th width="12%" style="text-align: center;">L/P</th>
          <th width="20%" style="text-align: center;">Status Kehadiran</th>
          <th width="20%" style="text-align: right;">Akumulasi Semester</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${date}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`Presensi_PJOK_${activeClass.name.replace(' ', '_')}`, content);
}

/**
 * 4. Exports Student Scores Portfolio to Google Docs compatible Word Document
 */
export function exportPenilaianToDoc(activeClass: ClassData): string {
  const rows = activeClass.students.map((st, idx) => {
    const cog = st.scores.cognitive;
    const psy = st.scores.psychomotor;
    const aff = st.scores.affective;
    const avg = Math.round((cog + psy + aff) / 3);

    let avgStyle = 'color: #334155;';
    if (avg >= 85) avgStyle = 'color: #15803d; font-weight: bold; background-color: #f0fdf4;';
    else if (avg >= 70) avgStyle = 'color: #1e293b; font-weight: bold;';
    else avgStyle = 'color: #b91c1c; font-weight: bold; background-color: #fef2f2;';

    const bgRow = idx % 2 === 1 ? 'class="bg-row-alt"' : '';

    return `
      <tr ${bgRow}>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${idx + 1}</td>
        <td style="font-weight: bold;">
          <div>${st.name}</div>
          ${st.nisn ? `<div style="font-size: 8.5pt; font-weight: normal; color: #64748b; font-family: monospace;">NISN: ${st.nisn}</div>` : ''}
        </td>
        <td style="text-align: center; font-weight: bold;">${st.gender}</td>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${cog}</td>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${psy}</td>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${aff}</td>
        <td style="text-align: center; font-family: 'Courier New', monospace; ${avgStyle}">${avg}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1>REKAP NILAI KINERJA PJOK (PORTOFOLIO)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">DOKUMEN EVALUASI KOMPREHENSIF TIGA RANAH PJOK</p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Rombongan Belajar:</strong> ${activeClass.name}</td>
          <td width="50%" style="text-align: right;"><strong>Kategori:</strong> Formatif & Sumatif Terpadu</td>
        </tr>
        <tr>
          <td><strong>Aspek Evaluasi:</strong> Kognitif, Psikomotorik, Afektif</td>
          <td style="text-align: right;"><strong>Jenjang Kelas:</strong> Kelas ${activeClass.grade} SD</td>
        </tr>
      </table>
    </div>

    <table>
      <thead>
        <tr>
          <th width="6%" style="text-align: center;">No.</th>
          <th width="34%">Nama Siswa</th>
          <th width="8%" style="text-align: center;">L/P</th>
          <th width="13%" style="text-align: center;">Kognitif<br>(Pengetahuan)</th>
          <th width="13%" style="text-align: center;">Psikomotorik<br>(Keterampilan)</th>
          <th width="13%" style="text-align: center;">Afektif<br>(Sikap)</th>
          <th width="13%" style="text-align: center; background-color: #cbd5e1;">Rerata<br>(Nilai Akhir)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`Daftar_Nilai_PJOK_${activeClass.name.replace(' ', '_')}`, content);
}

/**
 * 5. Exports Jurnal Harian to Google Docs compatible Word Document
 */
export function exportJurnalToDoc(journals: JurnalMengajar[]): string {
  const rows = journals.map((j, idx) => {
    const bgRow = idx % 2 === 1 ? 'class="bg-row-alt"' : '';
    return `
      <tr ${bgRow}>
        <td style="text-align: center; font-family: 'Courier New', monospace;">${idx + 1}</td>
        <td style="font-family: 'Courier New', monospace; font-size: 9.5pt;">${j.date}</td>
        <td style="font-weight: bold; font-size: 9.5pt; text-align: center;">${j.className}</td>
        <td style="font-weight: bold; font-size: 9.5pt;">${j.materi}</td>
        <td style="font-size: 9.5pt; line-height: 1.4;">${j.catatanKejadian}</td>
        <td style="font-size: 9.5pt; line-height: 1.4; background-color: #f0fdf4; color: #14532d;">${j.tindakLanjut || '<span style="color: #94a3b8;">-</span>'}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1>JURNAL HARIAN GURU PJOK</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">LOG KEJADIAN, CATATAN CEDERA, DAN SPORTIVITAS LAPANGAN</p>

    <table>
      <thead>
        <tr>
          <th width="5%" style="text-align: center;">No.</th>
          <th width="15%">Tanggal</th>
          <th width="10%" style="text-align: center;">Rombel</th>
          <th width="20%">Materi</th>
          <th width="30%">Catatan Kejadian Pembelajaran</th>
          <th width="20%" style="background-color: #d1fae5;">Tindak Lanjut / Solusi</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Belum ada data jurnal mengajar yang direkam.</td></tr>'}
      </tbody>
    </table>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell('Jurnal_Harian_PJOK', content);
}

/**
 * 6. Exports Rubrik Fisik Kinerja to Google Docs compatible Word Document
 */
export function exportRubrikToDoc(rubrik: RubrikFisik): string {
  const cards = rubrik.indikator.map((ind, idx) => `
    <div style="margin-bottom: 15pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
      <div style="background-color: #f1f5f9; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; font-weight: bold; font-size: 10.5pt; color: #0f172a;">
        <span style="background-color: #059669; color: white; padding: 2px 6px; border-radius: 50%; font-family: monospace; font-size: 9.5pt; margin-right: 6px;">${idx + 1}</span>
        Indikator: ${ind.nama}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 0;">
        <tr>
          <th width="33.33%" style="background-color: #f0fdf4; color: #166534; border: none; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 9.5pt;">Sangat Baik (86-100)</th>
          <th width="33.33%" style="background-color: #fffbeb; color: #92400e; border: none; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 9.5pt;">Layak / Cukup (71-85)</th>
          <th width="33.33%" style="background-color: #fef2f2; color: #991b1b; border: none; border-bottom: 1px solid #cbd5e1; font-size: 9.5pt;">Perlu Bimbingan (0-70)</th>
        </tr>
        <tr>
          <td style="padding: 10px; font-size: 9.5pt; line-height: 1.5; border: none; border-right: 1px solid #cbd5e1; background-color: #fcfdfd;">${ind.kriteriaBagus}</td>
          <td style="padding: 10px; font-size: 9.5pt; line-height: 1.5; border: none; border-right: 1px solid #cbd5e1; background-color: #fdfdfc;">${ind.kriteriaCukup}</td>
          <td style="padding: 10px; font-size: 9.5pt; line-height: 1.5; border: none; background-color: #fdfcfc;">${ind.kriteriaKurang}</td>
        </tr>
      </table>
    </div>
  `).join('\n');

  const content = `
    <h1>RUBRIK ASESMEN MOTORIK (OLAHRAGA)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">DOKUMEN ASESMEN KINERJA NYATA PJOK</p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Materi Gerak:</strong> ${rubrik.materi}</td>
          <td width="50%" style="text-align: right;"><strong>Metode Penilaian:</strong> Skala Penilaian Kinerja Kualitatif</td>
        </tr>
        <tr>
          <td><strong>Kategori Cabang:</strong> ${rubrik.kategori}</td>
          <td style="text-align: right;"><strong>Fokus:</strong> Presisi, Mekanika Gerak & Koordinasi</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 15pt;">
      ${cards}
    </div>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`Rubrik_PJOK_${rubrik.materi.replace(' ', '_')}`, content);
}

/**
 * 7. Exports Evaluation Questions to Google Docs compatible Word Document
 */
export function exportSoalToDoc(grade: string, materi: string, questions: any[]): string {
  const qList = questions.map((q, idx) => {
    const opts = q.options.map((opt: string) => `
      <div style="padding: 4px 10px; margin-bottom: 3px; font-size: 10pt; color: #334155;">
        &bull; ${opt}
      </div>
    `).join('\n');

    return `
      <div style="margin-bottom: 15pt; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background-color: #f8fafc;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td width="4%" style="border: none; font-weight: bold; font-size: 11pt; font-family: monospace; padding: 2px; vertical-align: top;">${idx + 1}.</td>
            <td width="96%" style="border: none; font-weight: bold; font-size: 10.5pt; padding: 2px;">${q.question}</td>
          </tr>
        </table>
        <div style="margin-left: 20px; margin-top: 6px; margin-bottom: 8px;">
          ${opts}
        </div>
        <div style="margin-left: 20px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 9pt; color: #475569; font-style: italic;">
          <strong>Kunci Jawaban Guru:</strong> ${q.correctAnswer} <br>
          <strong>Penjelasan:</strong> ${q.explanation}
        </div>
      </div>
    `;
  }).join('\n');

  const content = `
    <h1>LEMBAR EVALUASI PENGETAHUAN (SOAL)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">UJIAN FORMATIF / SUMATIF KOGNITIF PJOK</p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Materi Pokok:</strong> ${materi}</td>
          <td width="50%" style="text-align: right;"><strong>Nama Siswa:</strong> ________________________</td>
        </tr>
        <tr>
          <td><strong>Tingkat Jenjang:</strong> Kelas ${grade} SD</td>
          <td style="text-align: right;"><strong>Tanggal Ujian:</strong> ________________________</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 15pt;">
      ${qList}
    </div>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`Lembar_Soal_PJOK_${materi.replace(' ', '_')}`, content);
}

/**
 * 8. Exports ATP (Alur Tujuan Pembelajaran) & KKTP Rubrics to Google Docs compatible Word Document
 */
export function exportAtpToDoc(
  faseName: string, 
  grades: string, 
  elementName: string, 
  materiSpesifik: string, 
  saranaSpesifik: string, 
  atp: AtpResult
): string {
  const atpSteps = atp.alurTujuanPembelajaran.map((step, idx) => `
    <tr>
      <td width="6%" style="text-align: center; font-family: monospace; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
      <td width="94%" style="line-height: 1.5; font-size: 10pt;">${step}</td>
    </tr>
  `).join('\n');

  const kktpRows = atp.kriteriaKetercapaian.map((item, idx) => {
    const bgRow = idx % 2 === 1 ? 'class="bg-row-alt"' : '';
    return `
      <tr ${bgRow}>
        <td style="text-align: center; font-family: 'Courier New', monospace; font-weight: bold;">${idx + 1}</td>
        <td style="font-weight: bold;">${item.kriteria}</td>
        <td style="background-color: #fff5f5; color: #991b1b;">${item.baruBerkembang}</td>
        <td style="background-color: #fffbeb; color: #92400e;">${item.layak}</td>
        <td style="background-color: #f0fdf4; color: #166534;">${item.mahir}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1>ALUR TUJUAN PEMBELAJARAN (ATP) & KKTP</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">FORMULASI ASESMEN DAN TUJUAN BELAJAR KURIKULUM MERDEKA</p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Fase / Kelas:</strong> ${faseName} (${grades})</td>
          <td width="50%" style="text-align: right;"><strong>Materi Spesifik:</strong> ${materiSpesifik || 'Kondisional'}</td>
        </tr>
        <tr>
          <td><strong>Elemen CP:</strong> ${elementName}</td>
          <td style="text-align: right;"><strong>Sarana Pendukung:</strong> ${saranaSpesifik || 'Standar Lapangan Sekolah'}</td>
        </tr>
      </table>
    </div>

    <h2>A. Alur Tujuan Pembelajaran (ATP)</h2>
    <table>
      <thead>
        <tr>
          <th width="8%" style="text-align: center;">Langkah</th>
          <th width="92%">Deskripsi Alur Tujuan Pembelajaran</th>
        </tr>
      </thead>
      <tbody>
        ${atpSteps}
      </tbody>
    </table>

    <h2>B. Rubrik Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)</h2>
    <table>
      <thead>
        <tr>
          <th width="6%" style="text-align: center;">No.</th>
          <th width="34%">Kriteria Asesmen</th>
          <th width="20%" style="background-color: #fee2e2; color: #991b1b;">Baru Berkembang</th>
          <th width="20%" style="background-color: #fef3c7; color: #92400e;">Layak</th>
          <th width="20%" style="background-color: #d1fae5; color: #065f46;">Mahir</th>
        </tr>
      </thead>
      <tbody>
        ${kktpRows}
      </tbody>
    </table>

    <h2>C. Rekomendasi Strategi & Metode Pembelajaran</h2>
    <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 12px; border-radius: 6px; font-size: 10pt; color: #1e1b4b; line-height: 1.5; white-space: pre-wrap;">
      ${atp.metodePembelajaran}
    </div>

    <table class="signature-grid">
      <tr>
        <td>
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
        <td>
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru PJOK</strong></p>
          <br><br><br>
          <p>___________________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`ATP_PJOK_${faseName}`, content);
}

/**
 * 9. Exports Deep Learning RPM (Rencana Pembelajaran Mendalam) & LKPD to Microsoft Word/Google Docs format
 */
export function exportRpmToDoc(rpm: DeepLearningRPM): string {
  // Build LKPD items
  const lkpdItems = rpm.lkpdList.map((lkpd) => `
    <div style="page-break-before: always; margin-top: 30pt; border-top: 2px solid #0f172a; padding-top: 20pt;">
      <h2 style="text-align: center; color: #1e3a8a;">${lkpd.title}</h2>
      <div style="font-size: 10pt; line-height: 1.6; color: #334155; white-space: pre-wrap;">
        ${lkpd.content}
      </div>
    </div>
  `).join('\n');

  const content = `
    <h1>PERENCANAAN PEMBELAJARAN MENDALAM (RPM)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: -4px;">
      PENDEKATAN DEEP LEARNING &bull; KURIKULUM MERDEKA
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 15pt; margin-bottom: 20pt;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="width: 30%; padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; font-size: 10.5pt;">
            KOMPONEN / SUB-KOMPONEN
          </th>
          <th style="width: 70%; padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; font-size: 10.5pt;">
            ISI RENCANA PELAKSANAAN PEMBELAJARAN
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- A. IDENTITAS -->
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11pt; color: #0f172a;">
            A. IDENTITAS
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Penyusun
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.penyusun}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Sekolah
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.sekolah}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Tahun Ajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.tahunAjaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Semester
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.semester}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Mata Pelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.mataPelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Kelas / Fase Capaian
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.kelasFase}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Bab
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.bab}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Topik
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.topik}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Alokasi Waktu
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identitas.alokasiWaktu}
          </td>
        </tr>

        <!-- B. IDENTIFIKASI -->
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11pt; color: #0f172a;">
            B. IDENTIFIKASI
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Identifikasi Murid
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.identifikasi.identifikasiMurid}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Materi Pelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.identifikasi.materiPelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Dimensi Profil Lulusan
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.identifikasi.dimensiProfilLulusan}
          </td>
        </tr>

        <!-- C. DESAIN PEMBELAJARAN -->
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11pt; color: #0f172a;">
            C. DESAIN PEMBELAJARAN
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Capaian Pembelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.desainPembelajaran.capaianPembelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Lintas Disiplin Ilmu
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.desainPembelajaran.lintasDisiplinIlmu}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Tujuan Pembelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.desainPembelajaran.tujuanPembelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Topik Pembelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.desainPembelajaran.topikPembelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Praktik Pedagogis
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.desainPembelajaran.praktikPedagogis}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Kemitraan Pembelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.desainPembelajaran.kemitraanPembelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Lingkungan Pembelajaran
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.desainPembelajaran.lingkunganPembelajaran}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Pemanfaatan Digital
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155;">
            ${rpm.desainPembelajaran.pemanfaatanDigital}
          </td>
        </tr>

        <!-- D. PENGALAMAN BELAJAR -->
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11pt; color: #0f172a;">
            D. PENGALAMAN BELAJAR
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Kegiatan Awal
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.pengalamanBelajar.kegiatanAwal}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Kegiatan Inti (P. 1 - 8)
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.pengalamanBelajar.kegiatanInti}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Kegiatan Penutup
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.pengalamanBelajar.kegiatanPenutup}
          </td>
        </tr>

        <!-- E. ASESMEN PEMBELAJARAN -->
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11pt; color: #0f172a;">
            E. ASESMEN PEMBELAJARAN
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Asesmen Awal
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.asesmenPembelajaran.awal}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Asesmen Proses
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.asesmenPembelajaran.proses}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; color: #334155;">
            Asesmen Akhir
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 10pt; color: #334155; white-space: pre-wrap;">
            ${rpm.asesmenPembelajaran.akhir}
          </td>
        </tr>
      </tbody>
    </table>

    <table class="signature-grid" style="width: 100%; border-collapse: collapse; margin-top: 30pt; margin-bottom: 30pt;">
      <tr>
        <td style="width: 50%; border: none; text-align: center; font-size: 10pt;">
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br><br>
          <p><strong>${rpm.tandaTangan.kepalaSekolah}</strong></p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
        <td style="width: 50%; border: none; text-align: center; font-size: 10pt;">
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru Mata Pelajaran</strong></p>
          <br><br><br><br>
          <p><strong>${rpm.tandaTangan.guruMapel}</strong></p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
      </tr>
    </table>

    <div style="page-break-before: always; margin-top: 30pt; border-top: 2px solid #0f172a; padding-top: 20pt;">
      <h1 style="text-align: center; color: #0f172a;">LAMPIRAN DOKUMEN RPM</h1>
      
      <div style="margin-top: 15pt;">
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. Asesmen Awal Pembelajaran</h2>
        <div style="font-size: 10pt; line-height: 1.6; color: #334155; white-space: pre-wrap; background-color: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px;">
          ${rpm.lampiran.asesmenAwal}
        </div>
      </div>

      <div style="margin-top: 15pt;">
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. Asesmen Proses Pembelajaran (Rubrik Penilaian)</h2>
        <div style="font-size: 10pt; line-height: 1.6; color: #334155; white-space: pre-wrap; background-color: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px;">
          ${rpm.lampiran.asesmenProses}
        </div>
      </div>

      <div style="margin-top: 15pt;">
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. Asesmen Akhir Pembelajaran</h2>
        <div style="font-size: 10pt; line-height: 1.6; color: #334155; white-space: pre-wrap; background-color: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px;">
          ${rpm.lampiran.asesmenAkhir}
        </div>
      </div>

      <div style="margin-top: 15pt;">
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">4. Ringkasan Materi Ajar</h2>
        <div style="font-size: 10pt; line-height: 1.6; color: #334155; white-space: pre-wrap; background-color: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px;">
          ${rpm.lampiran.materiAjar}
        </div>
      </div>
    </div>

    <!-- LKPD SECTIONS -->
    ${lkpdItems}
  `;

  return wrapWithDocShell(rpm.title || 'RPM_Deep_Learning', content);
}

/**
 * Copies rich HTML content directly to clipboard and opens a new Google Doc tab for immediate pasting
 */
export async function copyRichHtmlToClipboard(htmlContent: string): Promise<boolean> {
  try {
    // Plain text fallback (strip all html tags cleanly)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    const textBlob = new Blob([plainText], { type: 'text/plain' });
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    
    const clipboardItem = new ClipboardItem({
      'text/plain': textBlob,
      'text/html': htmlBlob,
    });
    
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (err) {
    console.error('Failed to copy rich HTML to clipboard:', err);
    // Fallback to plain text copy via traditional API
    try {
      await navigator.clipboard.writeText(htmlContent.replace(/<[^>]*>/g, ''));
      return true;
    } catch (e) {
      console.error('Fallback copy failed:', e);
      return false;
    }
  }
}

/**
 * Helper to copy generated content as beautiful rich doc and open https://docs.new
 */
export async function copyAndOpenGoogleDocs(htmlContent: string): Promise<boolean> {
  const copied = await copyRichHtmlToClipboard(htmlContent);
  if (copied) {
    // Open a new tab to docs.new so user can immediately paste with Ctrl+V / Cmd+V
    window.open('https://docs.new', '_blank');
  }
  return copied;
}

/**
 * 10. Exports KKTP (Kriteria Ketercapaian Tujuan Pembelajaran) with Interval and descriptions
 */
export function exportKktpToDoc(kktp: KktpData): string {
  const rows = kktp.kktpRows.map((row) => {
    return `
      <tr>
        <td style="text-align: center; vertical-align: top; border: 1px solid #cbd5e1; padding: 8px;">${row.no}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${kktp.bab}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${kktp.materiPokok}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${kktp.deskripsiCp}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${row.tujuanPembelajaran}</td>
        <td style="background-color: #fef2f2; font-size: 9pt; border: 1px solid #cbd5e1; padding: 8px; color: #991b1b;">${row.intervalDeskripsi.perluBimbingan}</td>
        <td style="background-color: #fffbeb; font-size: 9pt; border: 1px solid #cbd5e1; padding: 8px; color: #92400e;">${row.intervalDeskripsi.cukup}</td>
        <td style="background-color: #eff6ff; font-size: 9pt; border: 1px solid #cbd5e1; padding: 8px; color: #1e40af;">${row.intervalDeskripsi.baik}</td>
        <td style="background-color: #f0fdf4; font-size: 9pt; border: 1px solid #cbd5e1; padding: 8px; color: #065f46;">${row.intervalDeskripsi.sangatBaik}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1 style="text-align: center; margin-bottom: 5px;">KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)</h1>
    <p style="text-align: center; font-size: 10pt; font-weight: bold; color: #475569; margin-top: 0; margin-bottom: 20px;">
      INTERVAL NILAI DAN RUBRIK DESKRIPTIF KINERJA BELAJAR
    </p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Satuan Pendidikan:</strong> ${kktp.identitas.satuanPendidikan}</td>
          <td width="50%"><strong>Mata Pelajaran:</strong> ${kktp.identitas.mataPelajaran}</td>
        </tr>
        <tr>
          <td><strong>Semester:</strong> Semester ${kktp.identitas.semester}</td>
          <td><strong>Kelas / Fase:</strong> Kelas ${kktp.identitas.kelas} / Fase ${kktp.identitas.fase}</td>
        </tr>
        <tr>
          <td><strong>Tahun Pelajaran:</strong> ${kktp.identitas.tahunPelajaran}</td>
          <td><strong>Status Kurikulum:</strong> Kurikulum Merdeka</td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th rowspan="2" style="width: 4%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No</th>
          <th rowspan="2" style="width: 8%; border: 1px solid #cbd5e1; padding: 8px;">Bab</th>
          <th rowspan="2" style="width: 12%; border: 1px solid #cbd5e1; padding: 8px;">Materi Pokok</th>
          <th rowspan="2" style="width: 18%; border: 1px solid #cbd5e1; padding: 8px;">Deskripsi Capaian Pembelajaran</th>
          <th rowspan="2" style="width: 18%; border: 1px solid #cbd5e1; padding: 8px;">Tujuan Pembelajaran</th>
          <th colspan="4" style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; background-color: #1e293b;">Interval Nilai</th>
        </tr>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 6px; background-color: #fee2e2; color: #991b1b; font-size: 8.5pt;">Perlu Bimbingan (0-68)</th>
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 6px; background-color: #fef3c7; color: #92400e; font-size: 8.5pt;">Cukup (68-78)</th>
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 6px; background-color: #dbeafe; color: #1e40af; font-size: 8.5pt;">Baik (79-89)</th>
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 6px; background-color: #d1fae5; color: #065f46; font-size: 8.5pt;">Sangat Baik (90-100)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="signature-grid" style="width: 100%; border-collapse: collapse; margin-top: 40px;">
      <tr>
        <td style="width: 50%; border: none; text-align: center;">
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
        <td style="width: 50%; border: none; text-align: center;">
          <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru Mata Pelajaran</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`KKTP_${kktp.identitas.mataPelajaran.replace(/\s+/g, '_')}`, content);
}

/**
 * 11. Exports Rincian Pekan Efektif (RPE) to Microsoft Word compatible format
 */
export function exportRpeToDoc(rpe: RpeData): string {
  const bulanRows = rpe.alokasiWaktu.bulans.map((b) => {
    return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${b.no}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${b.bulan}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${b.jumlahPekan}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #16a34a;">${b.pekanEfektif}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; color: #dc2626;">${b.pekanTidakEfektif}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; color: #475569;">${b.keterangan || '-'}</td>
      </tr>
    `;
  }).join('\n');

  const tidakEfektifRows = rpe.pekanTidakEfektif.map((act) => {
    return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${act.no}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${act.uraianKegiatan}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${act.jumlahPekan}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; color: #475569;">${act.keterangan || '-'}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1 style="text-align: center; margin-bottom: 5px;">RINCIAN PEKAN EFEKTIF (RPE)</h1>
    <p style="text-align: center; font-size: 11pt; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 25px; text-transform: uppercase;">
      TAHUN PELAJARAN ${rpe.identitas.tahunPelajaran}
    </p>

    <div class="info-box">
      <table class="info-grid">
        <tr>
          <td width="50%"><strong>Nama Sekolah:</strong> ${rpe.identitas.namaSekolah}</td>
          <td width="50%"><strong>Mata Pelajaran:</strong> ${rpe.identitas.mataPelajaran}</td>
        </tr>
        <tr>
          <td><strong>Semester:</strong> Semester ${rpe.identitas.semester}</td>
          <td><strong>Kelas:</strong> Kelas ${rpe.identitas.kelas}</td>
        </tr>
        <tr>
          <td><strong>JP Per Minggu:</strong> ${rpe.identitas.jpPerMinggu} JP</td>
          <td><strong>Status Kurikulum:</strong> Kurikulum Merdeka</td>
        </tr>
      </table>
    </div>

    <h2 style="font-size: 11pt; color: #0f172a; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; text-transform: uppercase;">
      A. PERHITUNGAN ALOKASI WAKTU
    </h2>
    <h3 style="font-size: 10pt; color: #334155; margin-top: 15px; margin-bottom: 8px;">
      1. Jumlah Pekan dalam Satu Semester
    </h3>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="width: 6%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No</th>
          <th style="width: 24%; border: 1px solid #cbd5e1; padding: 8px;">Bulan</th>
          <th style="width: 16%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">Jumlah Pekan</th>
          <th style="width: 16%; text-align: center; border: 1px solid #cbd5e1; padding: 8px; background-color: #15803d;">Pekan Efektif</th>
          <th style="width: 16%; text-align: center; border: 1px solid #cbd5e1; padding: 8px; background-color: #b91c1c;">Tidak Efektif</th>
          <th style="width: 22%; border: 1px solid #cbd5e1; padding: 8px;">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${bulanRows}
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="text-align: center; border: 1px solid #cbd5e1; padding: 10px;">Jumlah</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 10px;">${rpe.alokasiWaktu.totalPekan}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 10px; color: #15803d;">${rpe.alokasiWaktu.totalPekanEfektif}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 10px; color: #b91c1c;">${rpe.alokasiWaktu.totalPekanTidakEfektif}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px;">-</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 10pt; color: #334155; margin-top: 20px; margin-bottom: 8px;">
      2. Rincian Pekan Tidak Efektif
    </h3>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="width: 8%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No</th>
          <th style="width: 42%; border: 1px solid #cbd5e1; padding: 8px;">Uraian Kegiatan</th>
          <th style="width: 18%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">Jumlah Pekan</th>
          <th style="width: 32%; border: 1px solid #cbd5e1; padding: 8px;">Keterangan / Waktu Pelaksanaan</th>
        </tr>
      </thead>
      <tbody>
        ${tidakEfektifRows}
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="text-align: center; border: 1px solid #cbd5e1; padding: 10px;">Jumlah Total Pekan Tidak Efektif</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 10px; color: #b91c1c;">${rpe.alokasiWaktu.totalPekanTidakEfektif}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px;">Pekan</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 10pt; color: #334155; margin-top: 20px; margin-bottom: 8px;">
      3. Jumlah Pekan Efektif
    </h3>
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-family: monospace; font-size: 10pt; color: #1e293b;">
      <strong>Rumus:</strong> Jumlah Pekan Efektif = Jumlah Pekan dalam Semester - Jumlah Pekan Tidak Efektif<br/>
      <strong>Perhitungan:</strong> ${rpe.totalPekanEfektifFormula}
    </div>

    <h3 style="font-size: 10pt; color: #334155; margin-top: 20px; margin-bottom: 8px;">
      4. Jumlah Jam Pelajaran (JP) Efektif
    </h3>
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 25px; font-family: monospace; font-size: 10pt; color: #1e293b;">
      <strong>Rumus:</strong> Jumlah Jam Efektif = Jumlah Pekan Efektif x JP Per Pekan<br/>
      <strong>Perhitungan:</strong> ${rpe.totalJamEfektifFormula}
    </div>

    ${rpe.catatanAnalisis ? `
    <h2 style="font-size: 11pt; color: #0f172a; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; text-transform: uppercase;">
      B. CATATAN & REKOMENDASI ANALISIS KALENDER
    </h2>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; font-size: 10pt; line-height: 1.6; color: #14532d; margin-bottom: 30px;">
      ${rpe.catatanAnalisis}
    </div>
    ` : ''}

    <table class="signature-grid" style="width: 100%; border-collapse: collapse; margin-top: 40px;">
      <tr>
        <td style="width: 50%; border: none; text-align: center;">
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
        <td style="width: 50%; border: none; text-align: center;">
          <p>${rpe.tanggalDokumen || 'Jakarta, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru Mata Pelajaran</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`RPE_${rpe.identitas.mataPelajaran.replace(/\s+/g, '_')}`, content);
}

/**
 * 12. Exports Program Tahunan (PROTA) to Microsoft Word compatible format
 */
export function exportProtaToDoc(prota: ProtaData): string {
  const rowsHtml = prota.rows.map((row) => {
    return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${row.no}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${row.bab}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${row.tujuanPembelajaran}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-style: italic;">${row.materi}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e3a8a;">${row.alokasiWaktu}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${row.semester}</td>
      </tr>
    `;
  }).join('\n');

  const content = `
    <h1 style="text-align: center; margin-bottom: 5px;">PROGRAM TAHUNAN (PROTA)</h1>
    <p style="text-align: center; font-size: 11pt; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 25px; text-transform: uppercase;">
      TAHUN PELAJARAN ${prota.identitas.tahunPelajaran}
    </p>

    <div class="info-box" style="margin-bottom: 20px; border: 1px solid #94a3b8; border-radius: 6px; padding: 12px; background-color: #f8fafc;">
      <table class="info-grid" style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <tr>
          <td style="padding: 4px;" width="50%"><strong>Mata Pelajaran:</strong> ${prota.identitas.mataPelajaran}</td>
          <td style="padding: 4px;" width="50%"><strong>Kelas / Fase:</strong> Kelas ${prota.identitas.kelas} / Fase ${prota.identitas.fase}</td>
        </tr>
        <tr>
          <td style="padding: 4px;"><strong>Total JP 2 Semester:</strong> ${prota.identitas.totalJp2Semester}</td>
          <td style="padding: 4px;"><strong>Alokasi JP per Minggu:</strong> ${prota.identitas.alokasiWaktuTiapMinggu}</td>
        </tr>
        <tr>
          <td style="padding: 4px;"><strong>Semester 1 (Ganjil):</strong> ${prota.identitas.semester1Weeks} Pekan</td>
          <td style="padding: 4px;"><strong>Semester 2 (Genap):</strong> ${prota.identitas.semester2Weeks} Pekan</td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 25px; font-size: 10pt;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No Bab/ATP</th>
          <th style="width: 20%; border: 1px solid #cbd5e1; padding: 8px;">Bab</th>
          <th style="width: 35%; border: 1px solid #cbd5e1; padding: 8px;">Tujuan Pembelajaran</th>
          <th style="width: 15%; border: 1px solid #cbd5e1; padding: 8px;">Materi</th>
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">Alokasi Waktu</th>
          <th style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">Semester</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <table class="signature-grid" style="width: 100%; border-collapse: collapse; margin-top: 40px; font-size: 10pt;">
      <tr>
        <td style="width: 50%; border: none; text-align: center;">
          <p>Mengetahui,</p>
          <p><strong>Kepala Sekolah</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
        <td style="width: 50%; border: none; text-align: center;">
          <p>${prota.tanggalDokumen || 'Jakarta, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p><strong>Guru Mata Pelajaran</strong></p>
          <br><br><br><br>
          <p>___________________________</p>
          <p style="font-size: 9pt; color: #64748b;">NIP. _______________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithDocShell(`PROTA_${prota.identitas.mataPelajaran.replace(/\s+/g, '_')}`, content);
}

/**
 * Utility to wrap HTML content into a Landscape Microsoft Word compatible format
 */
export function wrapWithLandscapeDocShell(title: string, contentHtml: string): string {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 841.9pt 595.3pt; /* A4 Landscape size */
      margin: 36.0pt 36.0pt 36.0pt 36.0pt; /* 0.5 inch margins */
      mso-header-margin: 36.0pt;
      mso-footer-margin: 36.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: "Arial", "Liberation Sans", sans-serif;
      font-size: 8.5pt;
      color: #1e293b;
      line-height: 1.3;
    }
    h1 {
      font-family: "Arial Black", "Arial", sans-serif;
      font-size: 14pt;
      color: #0f172a;
      margin-top: 10pt;
      margin-bottom: 4pt;
      text-transform: uppercase;
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4px;
    }
    h2 {
      font-family: "Arial", sans-serif;
      font-size: 11pt;
      color: #0f172a;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 4pt;
      border-left: 4px solid #10b981;
      padding-left: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 15px;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 3px;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      color: #0f172a;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${contentHtml}
  </div>
</body>
</html>`;
}

/**
 * Exports Program Semester (PROSEM) to Microsoft Word compatible format (Landscape)
 */
export function exportProsemToDoc(prosem: ProsemData): string {
  function buildSemesterTable(semesterName: string, semesterData: any) {
    const monthsHeaderHtml = semesterData.monthsHeader.map((m: any) => {
      return `<th colspan="${m.totalWeeks}" style="border: 1px solid #94a3b8; padding: 4px; background-color: #e2e8f0; text-align: center; font-weight: bold;">${m.monthName}</th>`;
    }).join('\n');

    const weeksHeaderHtml = semesterData.monthsHeader.map((m: any) => {
      let weekCells = '';
      for (let w = 1; w <= m.totalWeeks; w++) {
        const isNonEffective = m.nonEffectiveWeeks.includes(w);
        const cellStyle = isNonEffective 
          ? 'border: 1px solid #94a3b8; padding: 4px; background-color: #cbd5e1; text-align: center; font-size: 7.5pt;'
          : 'border: 1px solid #94a3b8; padding: 4px; background-color: #f1f5f9; text-align: center; font-size: 7.5pt;';
        weekCells += `<th style="${cellStyle}">${w}</th>`;
      }
      return weekCells;
    }).join('\n');

    const rowsHtml = semesterData.rows.map((row: any) => {
      const weekValueCells = row.months.map((m: any) => {
        const headerMonth = semesterData.monthsHeader.find((h: any) => h.monthName === m.monthName);
        return m.weeks.map((w: any) => {
          const isNonEffectiveHeader = headerMonth ? headerMonth.nonEffectiveWeeks.includes(w.weekNum) : !w.isEffective;
          
          let cellColor = '#ffffff';
          let cellText = w.value || '';
          
          if (isNonEffectiveHeader || !w.isEffective) {
            cellColor = '#f1f5f9'; // light gray/slate for non-effective column blocks
            if (w.value && (w.value.includes('L') || w.value.toLowerCase().includes('libur'))) {
              cellColor = '#fef08a'; // yellow for holidays
            } else if (w.value && (w.value.includes('MPLS') || w.value.toLowerCase().includes('asesmen') || w.value.includes('PTS') || w.value.includes('PAS') || w.value.includes('PAT') || w.value.includes('STS') || w.value.includes('SAS'))) {
              cellColor = '#bfdbfe'; // blue for assessments/MPLS
            }
          }
          
          return `<td style="border: 1px solid #94a3b8; padding: 4px; text-align: center; background-color: ${cellColor}; font-weight: bold; min-width: 18px;">${cellText}</td>`;
        }).join('\n');
      }).join('\n');

      return `
        <tr>
          <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">${row.no}</td>
          <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${row.bab}</td>
          <td style="border: 1px solid #94a3b8; padding: 4px;">${row.topik}</td>
          <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">${row.pertemuanKe}</td>
          <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center; font-weight: bold; color: #1e3a8a;">${row.alokasiWaktu}</td>
          ${weekValueCells}
        </tr>
      `;
    }).join('\n');

    return `
      <h2 style="font-size: 11pt; color: #0f172a; border-left: 4px solid #10b981; padding-left: 6px; margin-top: 15px; margin-bottom: 8px;">PROGRAM SEMESTER - SEMESTER ${semesterName.toUpperCase()}</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 25px;">
        <thead>
          <tr style="background-color: #1e293b; color: #ffffff;">
            <th rowspan="2" style="border: 1px solid #94a3b8; padding: 4px; text-align: center; width: 4%;">No</th>
            <th rowspan="2" style="border: 1px solid #94a3b8; padding: 4px; width: 12%;">Unit / Bab</th>
            <th rowspan="2" style="border: 1px solid #94a3b8; padding: 4px; width: 22%;">Topik / Konten Pembelajaran</th>
            <th rowspan="2" style="border: 1px solid #94a3b8; padding: 4px; text-align: center; width: 6%;">Pert. Ke</th>
            <th rowspan="2" style="border: 1px solid #94a3b8; padding: 4px; text-align: center; width: 6%;">Alokasi</th>
            ${monthsHeaderHtml}
          </tr>
          <tr>
            ${weeksHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  const content = `
    <h1 style="text-align: center; margin-bottom: 5px;">PROGRAM SEMESTER (PROSEM)</h1>
    <p style="text-align: center; font-size: 11pt; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 20px; text-transform: uppercase;">
      TAHUN PELAJARAN ${prosem.identitas.tahunPelajaran}
    </p>

    <div class="info-box" style="margin-bottom: 15px; border: 1px solid #94a3b8; border-radius: 6px; padding: 10px; background-color: #f8fafc;">
      <table class="info-grid" style="width: 100%; border-collapse: collapse; font-size: 9.5pt; border: none;">
        <tr>
          <td style="padding: 3px; border: none;" width="50%"><strong>Mata Pelajaran:</strong> ${prosem.identitas.mataPelajaran}</td>
          <td style="padding: 3px; border: none;" width="50%"><strong>Kelas / Fase:</strong> Kelas ${prosem.identitas.kelas} / Fase ${prosem.identitas.fase}</td>
        </tr>
        <tr>
          <td style="padding: 3px; border: none;"><strong>Alokasi JP per Minggu:</strong> ${prosem.identitas.alokasiWaktuTiapMinggu} JP</td>
          <td style="padding: 3px; border: none;"><strong>Tahun Pelajaran:</strong> ${prosem.identitas.tahunPelajaran}</td>
        </tr>
      </table>
    </div>

    ${buildSemesterTable('Ganjil (Semester I)', prosem.ganjil)}
    
    <div style="page-break-before: always;"></div>

    ${buildSemesterTable('Genap (Semester II)', prosem.genap)}

    <div class="keterangan-box" style="margin-top: 15px; border: 1px solid #cbd5e1; padding: 10px; background-color: #f8fafc; font-size: 8.5pt;">
      <strong>Keterangan & Catatan Agenda Khusus:</strong>
      <p style="margin: 4px 0 0 0; line-height: 1.4;">${prosem.keterangan || 'Agenda Khusus menyesuaikan Kalender Akademik daerah setempat.'}</p>
    </div>

    <table class="signature-grid" style="width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 9.5pt; border: none;">
      <tr>
        <td style="width: 50%; border: none; text-align: center; padding: 5px;">
          <p style="margin-bottom: 40px;">Mengetahui,<br><strong>Kepala Sekolah</strong></p>
          <p><strong>${prosem.kepalaSekolah || '___________________________'}</strong></p>
          <p style="font-size: 8pt; color: #64748b; margin-top: 2px;">NIP. _______________________</p>
        </td>
        <td style="width: 50%; border: none; text-align: center; padding: 5px;">
          <p style="margin-bottom: 40px;">${prosem.tanggalDokumen || 'Jakarta, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br><strong>Guru Mata Pelajaran</strong></p>
          <p><strong>${prosem.guruMapel || '___________________________'}</strong></p>
          <p style="font-size: 8pt; color: #64748b; margin-top: 2px;">NIP. _______________________</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithLandscapeDocShell(`PROSEM_${prosem.identitas.mataPelajaran.replace(/\s+/g, '_')}`, content);
}

/**
 * Exports Slide Presentation to Microsoft Word compatible format (Landscape)
 */
export function exportSlidesToDoc(data: SlidePresentationData): string {
  const slidesHtml = data.slides.map((slide) => {
    const pointsHtml = slide.points.map(p => `<li style="margin-bottom: 5px;">${p}</li>`).join('\n');
    return `
      <div class="slide-container" style="border: 2px solid #1e293b; border-radius: 8px; padding: 20px; background-color: #ffffff; margin-bottom: 25px; page-break-after: always; min-height: 400px; font-family: 'Arial', sans-serif;">
        <!-- Slide Header -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 12px;">
          <tr>
            <td style="border: none; padding: 0; text-align: left;">
              <span style="font-size: 10.5pt; font-weight: bold; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">SLIDE ${slide.slideNo} dari ${data.identitas.jumlahSlide}</span>
            </td>
            <td style="border: none; padding: 0; text-align: right;">
              <span style="font-size: 8.5pt; font-weight: bold; color: #475569; background-color: #f1f5f9; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">Layout: ${slide.layoutType}</span>
            </td>
          </tr>
        </table>

        <!-- Slide Title -->
        <h2 style="font-size: 17pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">
          ${slide.title}
        </h2>

        <!-- Slide Content Area (2 Columns in Landscape) -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 15px;">
          <tr>
            <!-- Left Side: Content Points -->
            <td style="border: none; width: 60%; vertical-align: top; padding-right: 15px;">
              <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px; border-radius: 4px; min-height: 180px;">
                <p style="font-size: 9.5pt; font-weight: bold; color: #475569; margin-top: 0; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Teks Slide / Poin Utama:</p>
                <ul style="font-size: 10.5pt; color: #0f172a; line-height: 1.5; margin-top: 0; padding-left: 20px;">
                  ${pointsHtml}
                </ul>
              </div>
            </td>

            <!-- Right Side: Visual Recommendations -->
            <td style="border: none; width: 40%; vertical-align: top;">
              <div style="background-color: #fdf2f8; border: 1px dashed #db2777; padding: 12px; border-radius: 6px; min-height: 180px;">
                <p style="font-size: 9.5pt; font-weight: bold; color: #be185d; margin-top: 0; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">💡 Desain Visual & Media:</p>
                <p style="font-size: 9pt; color: #334155; line-height: 1.45; margin: 0; font-style: italic;">
                  ${slide.visualRecommendation}
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Speaker Notes Box -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin-top: 10px;">
          <p style="font-size: 9.5pt; font-weight: bold; color: #15803d; margin-top: 0; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">🎤 Catatan Suara / Panduan Guru:</p>
          <p style="font-size: 9.5pt; color: #1e293b; line-height: 1.45; margin: 0;">
            "${slide.speakerNotes}"
          </p>
        </div>
      </div>
    `;
  }).join('\n');

  const content = `
    <h1 style="text-align: center; margin-bottom: 5px; color: #1e3b8b;">RANCANGAN SLIDE PRESENTASI PPT</h1>
    <p style="text-align: center; font-size: 11pt; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 20px; text-transform: uppercase;">
      TOPIK MATERI: ${data.identitas.topikMateri}
    </p>

    <div class="info-box" style="margin-bottom: 25px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background-color: #f8fafc;">
      <table class="info-grid" style="width: 100%; border-collapse: collapse; font-size: 9.5pt; border: none;">
        <tr>
          <td style="padding: 4px; border: none;" width="50%"><strong>Mata Pelajaran:</strong> ${data.identitas.mataPelajaran}</td>
          <td style="padding: 4px; border: none;" width="50%"><strong>Kelas / Fase:</strong> Kelas ${data.identitas.kelas} / Fase ${data.identitas.fase}</td>
        </tr>
        <tr>
          <td style="padding: 4px; border: none;"><strong>Gaya Desain PPT:</strong> ${data.identitas.gayaDesain}</td>
          <td style="padding: 4px; border: none;"><strong>Jumlah Slide:</strong> ${data.identitas.jumlahSlide} Slide</td>
        </tr>
        <tr>
          <td style="padding: 4px; border: none;"><strong>Penyusun:</strong> ${data.identitas.guruPenyusun || 'Guru Kelas'}</td>
          <td style="padding: 4px; border: none;"><strong>Tanggal Dokumen:</strong> ${data.identitas.tanggalDokumen}</td>
        </tr>
      </table>
    </div>

    ${slidesHtml}
  `;

  return wrapWithLandscapeDocShell(`PPT_${data.identitas.topikMateri.replace(/\s+/g, '_')}`, content);
}

/**
 * Exports Interactive LKPD to Microsoft Word compatible format (Portrait, A4)
 */
export function exportLkpdToDoc(data: InteractiveLkpdData): string {
  const sectionsHtml = data.sections.map((section, idx) => {
    const blocksHtml = section.contentBlocks.map((block) => {
      if (block.blockType === 'text') {
        return `
          <p style="font-size: 10.5pt; color: #334155; line-height: 1.6; margin-bottom: 12px;">
            ${block.exactText || ''}
          </p>
        `;
      }

      if (block.blockType === 'highlight') {
        return `
          <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
            <p style="font-size: 10pt; font-weight: bold; color: #92400e; margin: 0 0 4px 0;">💡 PENTING / CATATAN UTAMA:</p>
            <p style="font-size: 10pt; color: #78350f; margin: 0; font-style: italic; line-height: 1.5;">
              ${block.exactText || ''}
            </p>
          </div>
        `;
      }

      if (block.blockType === 'question' && block.questionData) {
        const q = block.questionData;
        let boxStyle = 'border: 2px solid #cbd5e1; border-radius: 6px; min-height: 80px; padding: 10px;';
        if (q.answerBoxStyle === 'dotted_box') {
          boxStyle = 'border: 2px dashed #6366f1; border-radius: 6px; min-height: 80px; padding: 10px; background-color: #f8fafc;';
        } else if (q.answerBoxStyle === 'speech_bubble') {
          boxStyle = 'border: 1px solid #e2e8f0; border-radius: 12px; min-height: 80px; padding: 12px; background-color: #f0fdf4; border-left: 5px solid #10b981;';
        } else if (q.answerBoxStyle === 'ruled_lines') {
          boxStyle = 'border-bottom: 1px solid #cbd5e1; min-height: 80px; line-height: 24px; background-image: linear-gradient(rgba(0,0,0,0) 23px, #cbd5e1 24px); background-size: 100% 24px; padding: 4px;';
        }

        return `
          <div style="margin-bottom: 18px;">
            <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 6px;">
              <tr>
                <td style="border: none; padding: 0; font-size: 11pt; font-weight: bold; color: #1e293b;">
                  📝 ${q.questionText}
                </td>
                ${q.score ? `
                <td style="border: none; padding: 0; text-align: right; width: 80px;">
                  <span style="font-size: 8.5pt; font-weight: bold; background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">Skor: ${q.score}</span>
                </td>
                ` : ''}
              </tr>
            </table>
            <div style="${boxStyle}">
              <p style="font-size: 9pt; color: #94a3b8; margin: 0; font-style: italic;">
                ${q.placeholderText || 'Tuliskan jawaban rapi anak-anak di sini...'}
              </p>
            </div>
          </div>
        `;
      }

      if (block.blockType === 'table' && block.tableData) {
        const tbl = block.tableData;
        const headersHtml = tbl.headers.map(h => `<th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 9.5pt; color: #1e293b; text-align: left;">${h}</th>`).join('');
        const rowsHtml = tbl.rows.map(row => {
          const cellsHtml = row.map(cell => `<td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt; color: #334155; vertical-align: top;">${cell}</td>`).join('');
          return `<tr>${cellsHtml}</tr>`;
        }).join('\n');

        return `
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 15px;">
            <thead>
              <tr>${headersHtml}</tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }

      if (block.blockType === 'matching' && block.matchingData) {
        const mat = block.matchingData;
        const pairsHtml = mat.pairs.map((pair, pIdx) => {
          return `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 10pt; width: 45%; vertical-align: middle; background-color: #fafafa;">
                <strong>${pIdx + 1}.</strong> ${pair.leftItem}
              </td>
              <td style="border: none; width: 10%; text-align: center; font-size: 14pt; color: #94a3b8; vertical-align: middle;">
                &bull; &mdash;&mdash;&mdash;&gt; &bull;
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 10pt; width: 45%; vertical-align: middle; background-color: #fafafa;">
                ${pair.rightItem}
              </td>
            </tr>
          `;
        }).join('\n');

        return `
          <div style="margin-bottom: 18px; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; background-color: #f8fafc;">
            <p style="font-size: 10pt; font-weight: bold; color: #4338ca; margin-top: 0; margin-bottom: 8px;">
              🔗 Tarik Garis Penghubung (Aktivitas Mencocokkan):
            </p>
            <table style="width: 100%; border-collapse: collapse; border: none;">
              <thead>
                <tr>
                  <th style="border: none; padding: 4px; text-align: left; font-size: 9.5pt; color: #475569;">${mat.leftLabel || 'Kolom A'}</th>
                  <th style="border: none; padding: 4px; width: 10%;"></th>
                  <th style="border: none; padding: 4px; text-align: left; font-size: 9.5pt; color: #475569;">${mat.rightLabel || 'Kolom B'}</th>
                </tr>
              </thead>
              <tbody>
                ${pairsHtml}
              </tbody>
            </table>
          </div>
        `;
      }

      return '';
    }).join('\n');

    return `
      <div style="margin-bottom: 25px; page-break-inside: avoid;">
        <h3 style="font-size: 12pt; font-weight: bold; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 15px; margin-bottom: 12px; text-transform: uppercase;">
          ${section.icon} ${section.sectionTitle}
        </h3>
        ${section.introText ? `<p style="font-size: 10.5pt; color: #475569; font-style: italic; margin-bottom: 10px;">${section.introText}</p>` : ''}
        ${blocksHtml}
        ${section.visualDesignTip ? `<p style="font-size: 8.5pt; color: #64748b; margin-top: 4px; font-family: monospace;">📌 <i>Saran Desain: ${section.visualDesignTip}</i></p>` : ''}
      </div>
    `;
  }).join('\n');

  let reflectionHtml = '';
  if (data.selfReflectionChecklist && data.selfReflectionChecklist.length > 0) {
    const listItems = data.selfReflectionChecklist.map(item => {
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="border: none; padding: 6px; font-size: 9.5pt; color: #334155;">${item}</td>
          <td style="border: none; padding: 6px; text-align: center; width: 40px; font-size: 11pt; color: #cbd5e1;">[ &nbsp; ]</td>
          <td style="border: none; padding: 6px; text-align: center; width: 40px; font-size: 11pt; color: #cbd5e1;">[ &nbsp; ]</td>
        </tr>
      `;
    }).join('\n');

    reflectionHtml = `
      <div style="margin-top: 30px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; page-break-inside: avoid;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #15803d; margin-top: 0; margin-bottom: 8px; border-bottom: 1px solid #bbf7d0; padding-bottom: 4px;">
          🎯 REFLEKSI MANDIRI SISWA
        </h3>
        <p style="font-size: 9pt; color: #166534; margin-bottom: 10px;">Centanglah (v) pada kolom yang paling menggambarkan perasaanmu setelah menyelesaikan lembar kerja ini!</p>
        <table style="width: 100%; border-collapse: collapse; border: none;">
          <thead>
            <tr style="border-bottom: 2px solid #bbf7d0;">
              <th style="border: none; padding: 6px; text-align: left; font-size: 9.5pt; color: #15803d; font-weight: bold;">Pernyataan Refleksi</th>
              <th style="border: none; padding: 6px; text-align: center; width: 40px; font-size: 9.5pt; color: #15803d; font-weight: bold;">Ya</th>
              <th style="border: none; padding: 6px; text-align: center; width: 40px; font-size: 9.5pt; color: #15803d; font-weight: bold;">Tidak</th>
            </tr>
          </thead>
          <tbody>
            ${listItems}
          </tbody>
        </table>
      </div>
    `;
  }

  const content = `
    <div style="border: 4px double #4f46e5; border-radius: 10px; padding: 25px; background-color: #ffffff; font-family: 'Arial', sans-serif;">
      
      <!-- LKPD MAIN HEADER -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 20px;">
        <tr>
          <td style="border: none; padding: 0; vertical-align: middle;">
            <h1 style="text-align: left; margin: 0; font-size: 20pt; color: #1e3a8a; border: none; padding: 0; text-transform: uppercase; font-family: 'Arial Black', sans-serif;">
              LEMBAR KERJA PESERTA DIDIK
            </h1>
            <p style="font-size: 12pt; font-weight: bold; color: #4f46e5; margin: 4px 0 0 0; text-transform: uppercase;">
              ${data.judulMenarik}
            </p>
          </td>
          <td style="border: none; padding: 0; text-align: right; vertical-align: middle; width: 120px;">
            <div style="border: 2px solid #4f46e5; border-radius: 8px; padding: 8px; text-align: center; background-color: #f5f3ff;">
              <span style="font-size: 9pt; font-weight: bold; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">UKURAN</span><br/>
              <strong style="font-size: 12pt; color: #1e1b4b;">A4 PORTRAIT</strong>
            </div>
          </td>
        </tr>
      </table>

      <!-- IDENTITAS PANEL -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; border: none;">
          <tr>
            <td style="padding: 4px; border: none;" width="50%"><strong>Mata Pelajaran:</strong> ${data.identitas.mataPelajaran}</td>
            <td style="padding: 4px; border: none;" width="50%"><strong>Sekolah:</strong> ${data.identitas.sekolah || 'Sekolah Dasar'}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: none;"><strong>Kelas:</strong> Kelas ${data.identitas.kelas}</td>
            <td style="padding: 4px; border: none;"><strong>Materi Pembelajaran:</strong> ${data.identitas.topikMateri}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: none;"><strong>Guru Pengampu:</strong> ${data.identitas.guruPenyusun || 'Guru Kelas'}</td>
            <td style="padding: 4px; border: none;"><strong>Tanggal Terbit:</strong> ${data.identitas.tanggalDokumen}</td>
          </tr>
        </table>
      </div>

      <!-- STUDENT NAME & SCORE HEADER -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 10px; border-radius: 6px 0 0 6px; width: 65%;">
            <strong style="font-size: 9pt; color: #475569; text-transform: uppercase;">Nama Lengkap Siswa:</strong>
            <div style="border-bottom: 1px dashed #94a3b8; margin-top: 15px; font-size: 11pt; color: #cbd5e1;">&nbsp;</div>
          </td>
          <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 10px; border-radius: 0 6px 6px 0; width: 35%; text-align: center;">
            <strong style="font-size: 9pt; color: #475569; text-transform: uppercase;">NILAI AKHIR:</strong>
            <div style="font-size: 18pt; font-weight: bold; color: #4f46e5; margin-top: 4px;">______ / 100</div>
          </td>
        </tr>
      </table>

      <!-- LKPD MAIN SECTIONS -->
      ${sectionsHtml}

      <!-- REFLECTION AND SELF EVALUATION -->
      ${reflectionHtml}

      <!-- FOOTER BANNER -->
      ${data.penutupMotivasi ? `
      <div style="margin-top: 30px; text-align: center; border-top: 1px dashed #cbd5e1; pt-15px;">
        <p style="font-size: 11pt; font-weight: bold; color: #4f46e5; margin-bottom: 2px;">
          ⭐ ${data.penutupMotivasi} ⭐
        </p>
        <p style="font-size: 8.5pt; color: #94a3b8; margin-top: 0;">Teruslah Belajar dengan Ceria & Kreatif! Kita Semua Adalah Juara!</p>
      </div>
      ` : ''}

    </div>
  `;

  return wrapWithDocShell(`LKPD_${data.identitas.topikMateri.replace(/\s+/g, '_')}`, content);
}

/**
 * Exports CP ke TP Formulation Data to Word / Google Docs compatible HTML Document
 */
export function exportCpToTpToDoc(data: CpToTpResult): string {
  const tpRowsHtml = data.daftarTp.map((tp, idx) => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; background-color: #f8fafc;">
        ${tp.kodeTp}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">
        <strong style="color: #0f172a;">${tp.rumusanTp}</strong>
        <div style="margin-top: 6px; font-size: 9.5pt; color: #475569;">
          <strong>Indikator Ketercapaian (IKTP):</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            ${tp.indikatorKetercapaian.map(ind => `<li>${ind}</li>`).join('')}
          </ul>
        </div>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt;">
        <div><strong>KKO:</strong> ${tp.kompetensiKko}</div>
        <div style="margin-top: 4px;"><strong>Materi:</strong> ${tp.lingkupMateri}</div>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt; text-align: center;">
        ${tp.targetKelasSemester}
        <div style="margin-top: 4px; font-size: 8.5pt; color: #10b981; font-weight: bold;">${tp.alokasiWaktu}</div>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt;">
        <div><strong>P3:</strong> ${tp.profilPancasila}</div>
        <div style="margin-top: 4px;"><strong>Asesmen:</strong> ${tp.rekomendasiAsesmen}</div>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="max-width: 800px; margin: 0 auto;">
      <h1 style="text-align: center; font-size: 16pt; color: #0f172a; margin-bottom: 4px;">
        FORMULASI PENYUSUNAN CP KE TP (TUJUAN PEMBELAJARAN)
      </h1>
      <p style="text-align: center; font-size: 10pt; color: #64748b; margin-top: 0; margin-bottom: 20px;">
        MATA PELAJARAN PJOK SD - KURIKULUM MERDEKA
      </p>

      <!-- IDENTITAS CP -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 6px 12px; font-size: 10pt; width: 25%;"><strong>Fase / Kelas Target:</strong></td>
          <td style="padding: 6px 12px; font-size: 10pt;">${data.fase} (${data.kelas || 'Sesuai Fase'})</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-size: 10pt;"><strong>Elemen PJOK:</strong></td>
          <td style="padding: 6px 12px; font-size: 10pt; font-weight: bold; color: #059669;">${data.elemen}</td>
        </tr>
        ${data.materiSpesifik ? `
        <tr>
          <td style="padding: 6px 12px; font-size: 10pt;"><strong>Topik Spesifik:</strong></td>
          <td style="padding: 6px 12px; font-size: 10pt;">${data.materiSpesifik}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 12px; font-size: 10pt; vertical-align: top;"><strong>Teks CP Asli:</strong></td>
          <td style="padding: 6px 12px; font-size: 9.5pt; font-style: italic; color: #334155; line-height: 1.4;">
            "${data.cpAsli}"
          </td>
        </tr>
      </table>

      <!-- HASIL DEKONSTRUKSI -->
      <h2 style="font-size: 12pt; color: #0f172a; border-left: 4px solid #10b981; padding-left: 8px; margin-top: 20px;">
        1. HASIL DEKONSTRUKSI CP (ANALISIS KOMPETENSI & LINGKUP MATERI)
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f1f5f9;">
          <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 40%;">Kompetensi Utama (KKO)</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 60%;">Lingkup Materi Utama</th>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: top;">
            <ul style="margin: 0; padding-left: 18px;">
              ${data.analisisDekonstruksi.kompetensiUtama.map(k => `<li>${k}</li>`).join('')}
            </ul>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: top;">
            <ul style="margin: 0; padding-left: 18px;">
              ${data.analisisDekonstruksi.lingkupMateriUtama.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </td>
        </tr>
      </table>

      <!-- DAFTAR RUMUSAN TP -->
      <h2 style="font-size: 12pt; color: #0f172a; border-left: 4px solid #10b981; padding-left: 8px; margin-top: 20px;">
        2. RUMUSAN TUJUAN PEMBELAJARAN (TP) TERSTRUKTUR
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="border: 1px solid #0f172a; padding: 8px; width: 10%;">Kode</th>
            <th style="border: 1px solid #0f172a; padding: 8px; width: 42%;">Rumusan Tujuan Pembelajaran & Indikator</th>
            <th style="border: 1px solid #0f172a; padding: 8px; width: 20%;">KKO & Materi</th>
            <th style="border: 1px solid #0f172a; padding: 8px; width: 13%;">Kelas / Waktu</th>
            <th style="border: 1px solid #0f172a; padding: 8px; width: 15%;">P3 & Asesmen</th>
          </tr>
        </thead>
        <tbody>
          ${tpRowsHtml}
        </tbody>
      </table>

      <!-- CATATAN & STRATEGI PEMBELAJARAN -->
      <h2 style="font-size: 12pt; color: #0f172a; border-left: 4px solid #10b981; padding-left: 8px; margin-top: 20px;">
        3. REKOMENDASI STRATEGI & CATATAN PENDIDIK
      </h2>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 10pt;">
        <p style="margin-top: 0; margin-bottom: 8px;">
          <strong>Metode / Pendekatan:</strong> ${data.rekomendasiPendekatan}
        </p>
        <p style="margin: 0;">
          <strong>Catatan Guru:</strong> ${data.catatanPendidik}
        </p>
      </div>

      <!-- LEMBAR TANDA TANGAN -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 40px; font-size: 10pt;">
        <tr>
          <td style="width: 50%; border: none; text-align: center;">
            Mengetahui,<br/>
            Kepala Sekolah SD<br/><br/><br/><br/>
            ___________________________<br/>
            NIP. .....................................
          </td>
          <td style="width: 50%; border: none; text-align: center;">
            ......................., .................... ${new Date().getFullYear()}<br/>
            Guru Mata Pelajaran PJOK<br/><br/><br/><br/>
            ___________________________<br/>
            NIP. .....................................
          </td>
        </tr>
      </table>
    </div>
  `;

  return wrapWithDocShell(`FORMULASI_CP_KE_TP_${data.elemen.replace(/\s+/g, '_')}`, content);
}



