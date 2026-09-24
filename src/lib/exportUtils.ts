import { ModulAjar, JurnalMengajar, RubrikFisik, ClassData, Student, AtpResult, DeepLearningRPM, KktpData, RpeData, ProtaData, ProsemData, SlidePresentationData, InteractiveLkpdData, CpToTpResult } from '../types';
import { getPjokDiagramHtml, detectPjokVisualType } from '../components/PjokVisualDiagram';

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

export interface RekapBulananMeta {
  bulan: number; // 1 - 12
  tahun: number; // e.g. 2026
  namaSekolah?: string;
  namaGuru?: string;
  nipGuru?: string;
  namaKepalaSekolah?: string;
  nipKepalaSekolah?: string;
  kota?: string;
}

/**
 * 3b. Exports Monthly Attendance Recap (Rekap Absensi Bulanan) to Microsoft Word compatible format (Landscape)
 */
export function exportRekapBulananToDoc(activeClass: ClassData, meta: RekapBulananMeta): string {
  const BULAN_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const HARI_INITIALS = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'];

  const bulanIdx = Math.max(1, Math.min(12, meta.bulan)) - 1;
  const namaBulan = BULAN_NAMES[bulanIdx];
  const daysInMonth = new Date(meta.tahun, meta.bulan, 0).getDate();
  const tahunAjaran = meta.bulan >= 7 
    ? `${meta.tahun}/${meta.tahun + 1}` 
    : `${meta.tahun - 1}/${meta.tahun}`;

  const namaSekolah = meta.namaSekolah || 'SD NEGERI KALIMANTONG';
  const namaGuru = meta.namaGuru || 'Ahmad Rafsanjani, S.Pd.';
  const nipGuru = meta.nipGuru || '19880512 201503 1 002';
  const namaKepalaSekolah = meta.namaKepalaSekolah || 'H. Muhammad Nur, M.Pd.';
  const nipKepalaSekolah = meta.nipKepalaSekolah || '19750814 199903 1 004';
  const kota = meta.kota || 'Kalimantong';
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const boysCount = (activeClass.students || []).filter(s => s.gender === 'L').length;
  const girlsCount = (activeClass.students || []).filter(s => s.gender === 'P').length;

  // Days metadata
  const daysMeta: { day: number; dateKey: string; isSunday: boolean; isSaturday: boolean; initial: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(meta.bulan).padStart(2, '0');
    const dateKey = `${meta.tahun}-${mStr}-${dStr}`;
    const dt = new Date(meta.tahun, bulanIdx, d);
    const dayOfWeek = dt.getDay();
    daysMeta.push({
      day: d,
      dateKey,
      isSunday: dayOfWeek === 0,
      isSaturday: dayOfWeek === 6,
      initial: HARI_INITIALS[dayOfWeek]
    });
  }

  // Count effective days in this month (non-Sundays)
  const effectiveDaysCount = daysMeta.filter(d => !d.isSunday).length;

  // Build Table Header Days
  const headerDaysHtml = daysMeta.map(dm => {
    const isWeekend = dm.isSunday;
    const isSat = dm.isSaturday;
    const bgStyle = isWeekend 
      ? 'background-color: #fee2e2; color: #b91c1c;' 
      : isSat 
        ? 'background-color: #f1f5f9; color: #475569;' 
        : 'background-color: #ffffff; color: #0f172a;';
    return `
      <th style="width: 17px; text-align: center; font-size: 6.5pt; padding: 2px 0; ${bgStyle} border: 1px solid #94a3b8;">
        <div>${dm.day}</div>
        <div style="font-size: 5.5pt; font-weight: normal;">${dm.initial}</div>
      </th>
    `;
  }).join('');

  // Daily Totals Accumulator
  const dailyH: number[] = new Array(daysInMonth).fill(0);
  const dailyS: number[] = new Array(daysInMonth).fill(0);
  const dailyI: number[] = new Array(daysInMonth).fill(0);
  const dailyA: number[] = new Array(daysInMonth).fill(0);

  let grandTotalH = 0;
  let grandTotalS = 0;
  let grandTotalI = 0;
  let grandTotalA = 0;

  // Build Student Rows
  const studentRows = (activeClass.students || []).map((student, sIdx) => {
    let studentH = 0;
    let studentS = 0;
    let studentI = 0;
    let studentA = 0;

    const daysCells = daysMeta.map((dm, dIdx) => {
      const status = student.attendance?.[dm.dateKey];
      if (dm.isSunday) {
        return `<td style="background-color: #fee2e2; text-align: center; font-size: 6.5pt; color: #dc2626; border: 1px solid #94a3b8;">L</td>`;
      }

      if (status === 'H') {
        studentH++;
        dailyH[dIdx]++;
        return `<td style="background-color: #f0fdf4; text-align: center; font-weight: bold; color: #166534; font-size: 7pt; border: 1px solid #94a3b8;">H</td>`;
      } else if (status === 'S') {
        studentS++;
        dailyS[dIdx]++;
        return `<td style="background-color: #eff6ff; text-align: center; font-weight: bold; color: #1d4ed8; font-size: 7pt; border: 1px solid #94a3b8;">S</td>`;
      } else if (status === 'I') {
        studentI++;
        dailyI[dIdx]++;
        return `<td style="background-color: #fefce8; text-align: center; font-weight: bold; color: #b45309; font-size: 7pt; border: 1px solid #94a3b8;">I</td>`;
      } else if (status === 'A') {
        studentA++;
        dailyA[dIdx]++;
        return `<td style="background-color: #fef2f2; text-align: center; font-weight: bold; color: #b91c1c; font-size: 7pt; border: 1px solid #94a3b8;">A</td>`;
      } else {
        return `<td style="text-align: center; color: #cbd5e1; font-size: 6pt; border: 1px solid #94a3b8;">.</td>`;
      }
    }).join('');

    grandTotalH += studentH;
    grandTotalS += studentS;
    grandTotalI += studentI;
    grandTotalA += studentA;

    // Total recorded interactions or against effective days
    const totalRecords = studentH + studentS + studentI + studentA;
    const baseDivider = totalRecords > 0 ? totalRecords : effectiveDaysCount;
    const percent = baseDivider > 0 ? Math.round((studentH / baseDivider) * 100) : 100;

    let percentStyle = 'color: #166534; font-weight: bold; background-color: #f0fdf4;';
    if (percent < 75) {
      percentStyle = 'color: #b91c1c; font-weight: bold; background-color: #fef2f2;';
    } else if (percent < 85) {
      percentStyle = 'color: #b45309; font-weight: bold; background-color: #fffbeb;';
    }

    const rowBg = sIdx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';

    return `
      <tr style="${rowBg}">
        <td style="text-align: center; font-size: 7.5pt; font-family: 'Courier New', monospace; border: 1px solid #94a3b8; padding: 2px;">${sIdx + 1}</td>
        <td style="font-size: 7.5pt; border: 1px solid #94a3b8; padding: 2px 4px; white-space: nowrap;">
          <strong>${student.name}</strong>
          ${student.nisn ? `<br><span style="font-size: 6pt; color: #64748b; font-family: monospace;">NISN: ${student.nisn}</span>` : ''}
        </td>
        <td style="text-align: center; font-size: 7pt; font-weight: bold; border: 1px solid #94a3b8; padding: 2px;">${student.gender}</td>
        ${daysCells}
        <td style="text-align: center; font-size: 7pt; font-weight: bold; color: #166534; background-color: #f0fdf4; border: 1px solid #94a3b8; padding: 2px;">${studentH}</td>
        <td style="text-align: center; font-size: 7pt; font-weight: bold; color: #1d4ed8; background-color: #eff6ff; border: 1px solid #94a3b8; padding: 2px;">${studentS}</td>
        <td style="text-align: center; font-size: 7pt; font-weight: bold; color: #b45309; background-color: #fefce8; border: 1px solid #94a3b8; padding: 2px;">${studentI}</td>
        <td style="text-align: center; font-size: 7pt; font-weight: bold; color: #b91c1c; background-color: #fef2f2; border: 1px solid #94a3b8; padding: 2px;">${studentA}</td>
        <td style="text-align: center; font-size: 7pt; ${percentStyle} border: 1px solid #94a3b8; padding: 2px;">${percent}%</td>
      </tr>
    `;
  }).join('');

  // Daily totals footer cells
  const footerDailyH = daysMeta.map((dm, idx) => {
    return `<td style="text-align: center; font-size: 6.5pt; font-weight: bold; color: #166534; background-color: #dcfce7; border: 1px solid #94a3b8; padding: 1px;">${dm.isSunday ? '-' : dailyH[idx]}</td>`;
  }).join('');

  const footerDailyS = daysMeta.map((dm, idx) => {
    return `<td style="text-align: center; font-size: 6.5pt; font-weight: bold; color: #1d4ed8; background-color: #dbeafe; border: 1px solid #94a3b8; padding: 1px;">${dm.isSunday ? '-' : dailyS[idx]}</td>`;
  }).join('');

  const footerDailyI = daysMeta.map((dm, idx) => {
    return `<td style="text-align: center; font-size: 6.5pt; font-weight: bold; color: #b45309; background-color: #fef3c7; border: 1px solid #94a3b8; padding: 1px;">${dm.isSunday ? '-' : dailyI[idx]}</td>`;
  }).join('');

  const footerDailyA = daysMeta.map((dm, idx) => {
    return `<td style="text-align: center; font-size: 6.5pt; font-weight: bold; color: #b91c1c; background-color: #fee2e2; border: 1px solid #94a3b8; padding: 1px;">${dm.isSunday ? '-' : dailyA[idx]}</td>`;
  }).join('');

  const totalPossible = (activeClass.students?.length || 1) * effectiveDaysCount;
  const classAvgPercent = totalPossible > 0 ? Math.round((grandTotalH / (grandTotalH + grandTotalS + grandTotalI + grandTotalA || totalPossible)) * 100) : 100;

  const content = `
    <!-- KOP RESMI DOKUMEN -->
    <div style="text-align: center; margin-bottom: 10pt; border-bottom: 2px solid #0f172a; padding-bottom: 6pt;">
      <h2 style="margin: 0; font-size: 13pt; text-transform: uppercase; color: #0f172a; border-left: none; padding-left: 0; font-weight: bold;">
        ${namaSekolah}
      </h2>
      <h1 style="margin: 3pt 0 3pt 0; font-size: 15pt; color: #0f172a; border-bottom: none; padding-bottom: 0; font-family: 'Arial Black', Arial, sans-serif;">
        REKAPITULASI PRESENSI / ABSENSI SISWA BULANAN
      </h1>
      <p style="margin: 0; font-size: 9.5pt; font-weight: bold; color: #334155;">
        BULAN: ${namaBulan.toUpperCase()} ${meta.tahun} &bull; TAHUN AJARAN ${tahunAjaran}
      </p>
    </div>

    <!-- IDENTITAS KELAS -->
    <table style="width: 100%; font-size: 8pt; margin-bottom: 8pt; border-collapse: collapse; border: none;">
      <tr>
        <td style="border: none; padding: 2px 0; width: 35%;"><strong>Rombongan Belajar:</strong> ${activeClass.name}</td>
        <td style="border: none; padding: 2px 0; width: 35%;"><strong>Mata Pelajaran:</strong> PJOK / Tematik Terpadu</td>
        <td style="border: none; padding: 2px 0; width: 30%; text-align: right;"><strong>Bulan / Tahun:</strong> ${namaBulan} ${meta.tahun}</td>
      </tr>
      <tr>
        <td style="border: none; padding: 2px 0;"><strong>Jenjang / Fase:</strong> Kelas ${activeClass.grade} SD (Fase ${activeClass.grade <= 2 ? 'A' : activeClass.grade <= 4 ? 'B' : 'C'})</td>
        <td style="border: none; padding: 2px 0;"><strong>Jumlah Siswa:</strong> ${activeClass.students.length} Orang (${boysCount} L / ${girlsCount} P)</td>
        <td style="border: none; padding: 2px 0; text-align: right;"><strong>Hari Efektif:</strong> ${effectiveDaysCount} Hari</td>
      </tr>
      <tr>
        <td style="border: none; padding: 2px 0;"><strong>Guru / Pengampu:</strong> ${namaGuru}</td>
        <td style="border: none; padding: 2px 0;"><strong>Kepala Sekolah:</strong> ${namaKepalaSekolah}</td>
        <td style="border: none; padding: 2px 0; text-align: right;"><strong>Rerata Kehadiran Kelas:</strong> <span style="font-weight: bold; color: #166534;">${classAvgPercent}%</span></td>
      </tr>
    </table>

    <!-- TABEL UTAMA REKAPITULASI PRESENSI BULANAN -->
    <table style="width: 100%; border-collapse: collapse; font-size: 7pt; margin-bottom: 10pt;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th rowspan="2" style="width: 24px; text-align: center; border: 1px solid #0f172a; padding: 4px 2px;">No.</th>
          <th rowspan="2" style="width: 130px; text-align: left; border: 1px solid #0f172a; padding: 4px 4px;">Nama Peserta Didik</th>
          <th rowspan="2" style="width: 24px; text-align: center; border: 1px solid #0f172a; padding: 4px 2px;">L/P</th>
          <th colspan="${daysInMonth}" style="text-align: center; border: 1px solid #0f172a; padding: 3px 2px; font-size: 7.5pt; letter-spacing: 0.5px;">
            TANGGAL BULAN ${namaBulan.toUpperCase()} ${meta.tahun}
          </th>
          <th colspan="4" style="text-align: center; border: 1px solid #0f172a; padding: 3px 2px; font-size: 7.5pt;">REKAPITULASI</th>
          <th rowspan="2" style="width: 32px; text-align: center; border: 1px solid #0f172a; padding: 4px 2px;">%</th>
        </tr>
        <tr style="background-color: #1e293b; color: #ffffff;">
          ${headerDaysHtml}
          <th style="width: 18px; text-align: center; font-size: 6.5pt; background-color: #166534; color: #ffffff; border: 1px solid #94a3b8;">H</th>
          <th style="width: 18px; text-align: center; font-size: 6.5pt; background-color: #1d4ed8; color: #ffffff; border: 1px solid #94a3b8;">S</th>
          <th style="width: 18px; text-align: center; font-size: 6.5pt; background-color: #b45309; color: #ffffff; border: 1px solid #94a3b8;">I</th>
          <th style="width: 18px; text-align: center; font-size: 6.5pt; background-color: #b91c1c; color: #ffffff; border: 1px solid #94a3b8;">A</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
      <tfoot>
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="3" style="text-align: right; font-size: 6.5pt; border: 1px solid #94a3b8; padding: 2px 4px;">Jumlah Hadir (H):</td>
          ${footerDailyH}
          <td style="text-align: center; font-size: 7pt; font-weight: bold; background-color: #bbf7d0; color: #14532d; border: 1px solid #94a3b8;">${grandTotalH}</td>
          <td colspan="3" style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
          <td rowspan="4" style="text-align: center; font-size: 8pt; font-weight: bold; background-color: #dcfce7; color: #166534; border: 1px solid #94a3b8;">${classAvgPercent}%</td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="3" style="text-align: right; font-size: 6.5pt; border: 1px solid #94a3b8; padding: 2px 4px;">Jumlah Sakit (S):</td>
          ${footerDailyS}
          <td style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
          <td style="text-align: center; font-size: 7pt; font-weight: bold; background-color: #bfdbfe; color: #1e3a8a; border: 1px solid #94a3b8;">${grandTotalS}</td>
          <td colspan="2" style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="3" style="text-align: right; font-size: 6.5pt; border: 1px solid #94a3b8; padding: 2px 4px;">Jumlah Izin (I):</td>
          ${footerDailyI}
          <td colspan="2" style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
          <td style="text-align: center; font-size: 7pt; font-weight: bold; background-color: #fef08a; color: #713f12; border: 1px solid #94a3b8;">${grandTotalI}</td>
          <td style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="3" style="text-align: right; font-size: 6.5pt; border: 1px solid #94a3b8; padding: 2px 4px;">Jumlah Alpa (A):</td>
          ${footerDailyA}
          <td colspan="3" style="background-color: #f1f5f9; border: 1px solid #94a3b8;"></td>
          <td style="text-align: center; font-size: 7pt; font-weight: bold; background-color: #fecaca; color: #7f1d1d; border: 1px solid #94a3b8;">${grandTotalA}</td>
        </tr>
      </tfoot>
    </table>

    <!-- KETERANGAN & STATISTIK REKAP -->
    <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 12pt; border: none;">
      <tr>
        <td style="border: none; width: 60%; vertical-align: top;">
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6pt; border-radius: 4px;">
            <strong>Keterangan Kode Kehadiran:</strong><br>
            <span style="display: inline-block; width: 85px;"><strong>H</strong> = Hadir</span>
            <span style="display: inline-block; width: 85px;"><strong>S</strong> = Sakit</span>
            <span style="display: inline-block; width: 85px;"><strong>I</strong> = Izin</span>
            <span style="display: inline-block; width: 140px;"><strong>A</strong> = Alpa (Tanpa Keterangan)</span>
            <span style="display: inline-block; width: 120px;"><strong>L</strong> = Libur / Akhir Pekan</span>
          </div>
        </td>
        <td style="border: none; width: 40%; vertical-align: top; padding-left: 10pt;">
          <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 6pt; border-radius: 4px;">
            <strong>Ringkasan Akumulasi Kelas:</strong><br>
            Total Hadir: <strong>${grandTotalH}</strong> &bull; Sakit: <strong>${grandTotalS}</strong> &bull; Izin: <strong>${grandTotalI}</strong> &bull; Alpa: <strong>${grandTotalA}</strong><br>
            Tingkat Partisipasi Kehadiran: <strong style="color: #166534; font-size: 9pt;">${classAvgPercent}%</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- LEMBAR PENGESAHAN DAN TANDA TANGAN RESMI -->
    <table style="width: 100%; border: none; font-size: 8pt; margin-top: 14pt; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
          <p style="margin: 0;">Mengetahui,</p>
          <p style="margin: 2pt 0 0 0; font-weight: bold;">Kepala Sekolah ${namaSekolah}</p>
          <br><br><br><br>
          <p style="margin: 0; font-weight: bold; text-decoration: underline;">${namaKepalaSekolah}</p>
          <p style="margin: 2pt 0 0 0; color: #475569; font-size: 7.5pt;">NIP. ${nipKepalaSekolah}</p>
        </td>
        <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
          <p style="margin: 0;">${kota}, ${dateStr}</p>
          <p style="margin: 2pt 0 0 0; font-weight: bold;">Guru Kelas / Wali Kelas / PJOK</p>
          <br><br><br><br>
          <p style="margin: 0; font-weight: bold; text-decoration: underline;">${namaGuru}</p>
          <p style="margin: 2pt 0 0 0; color: #475569; font-size: 7.5pt;">NIP. ${nipGuru}</p>
        </td>
      </tr>
    </table>
  `;

  return wrapWithLandscapeDocShell(`Rekap_Absensi_${activeClass.name.replace(/\s+/g, '_')}_${namaBulan}_${meta.tahun}`, content);
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
export function exportSoalToDoc(grade: string, materi: string, questions: any[], includeAnswers: boolean = true): string {
  const qList = questions.map((q, idx) => {
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const opts = rawOpts.map((opt: string) => `
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
        ${includeAnswers ? `
        <div style="margin-left: 20px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 9pt; color: #475569; font-style: italic;">
          <strong>Kunci Jawaban Guru:</strong> ${q.correctAnswer} <br>
          <strong>Penjelasan:</strong> ${q.explanation}
        </div>` : ''}
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
  const penyusun = rpm.identitas?.penyusun || '-';
  const sekolah = rpm.identitas?.sekolah || '-';
  const tahunAjaran = rpm.identitas?.tahunAjaran || '2025/2026';
  const semester = rpm.identitas?.semester || '1 (Ganjil)';
  const mataPelajaran = rpm.identitas?.mataPelajaran || '-';
  const kelasFase = rpm.identitas?.kelasFase || '-';
  const topikElemen = rpm.identitas?.topikElemen || `${rpm.identitas?.bab || ''} / ${rpm.identitas?.topik || ''}`;
  const alokasiWaktu = rpm.identitas?.alokasiWaktu || '2 × 35 Menit';

  // Format DPL checkboxes or list
  const dplList = [
    'DPL1 Keimanan dan Ketakwaan terhadap Tuhan YME',
    'DPL2 Kewargaan',
    'DPL3 Penalaran Kritis',
    'DPL4 Kreativitas',
    'DPL5 Kolaborasi',
    'DPL6 Kemandirian',
    'DPL7 Kesehatan',
    'DPL8 Komunikasi'
  ];

  const selectedDpl = Array.isArray(rpm.identifikasi?.dimensiProfilLulusan)
    ? rpm.identifikasi.dimensiProfilLulusan
    : (typeof rpm.identifikasi?.dimensiProfilLulusan === 'string'
        ? [rpm.identifikasi.dimensiProfilLulusan]
        : []);

  const dplHtml = dplList.map(item => {
    const isChecked = selectedDpl.some(d => item.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(item.slice(0, 4).toLowerCase()));
    return `<div style="margin-bottom: 4px; font-size: 10pt;">
      <span style="display: inline-block; width: 14px; height: 14px; border: 1.5px solid #334155; text-align: center; line-height: 12px; font-weight: bold; margin-right: 6px; font-size: 10pt;">${isChecked ? '&#10003;' : '&nbsp;'}</span>
      ${item}
    </div>`;
  }).join('');

  // Diagnostic questions
  const diagQuestions = rpm.lampiran?.asesmenDiagnostikNonKognitif?.pertanyaan || [
    { no: 1, teks: 'Apa kabar hari ini?' },
    { no: 2, teks: 'Apakah ada yang sakit hari ini?' },
    { no: 3, teks: 'Apakah kalian dalam keadaan sehat?' },
    { no: 4, teks: 'Apakah anak-anak merasa bersemangat hari ini?' }
  ];

  const diagRows = diagQuestions.map(q => `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #000000; text-align: center; font-size: 10pt;">${q.no}</td>
      <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${q.teks}</td>
      <td style="padding: 6px 10px; border: 1px solid #000000; text-align: center; font-size: 10pt;">Ya / Tidak</td>
    </tr>
  `).join('');

  // Rubrik Formatif
  const rubrikFormatif = rpm.lampiran?.asesmenFormatif?.rubrikPenilaian || [
    { skor: 5, deskripsi: 'Sangat aktif berkontribusi dalam diskusi dan presentasi, ide orisinal, komunikasi sangat jelas, keterampilan kerja sangat baik, dan konsisten.' },
    { skor: 4, deskripsi: 'Aktif berdiskusi dan presentasi, mampu menjelaskan ide dengan baik, keterampilan kerja terlihat dan berkembang.' },
    { skor: 3, deskripsi: 'Cukup aktif, sesekali berpartisipasi dalam diskusi/presentasi, menjawab jika ditanya, keterampilan dasar mulai terlihat.' },
    { skor: 2, deskripsi: 'Kurang aktif, jarang berbicara atau menyumbang ide, presentasi kurang jelas, keterampilan belum konsisten.' },
    { skor: 1, deskripsi: 'Tidak menunjukkan partisipasi, tidak memahami tugas, tidak menunjukkan keterampilan atau perkembangan kerja.' }
  ];

  const rubrikFormatifRows = rubrikFormatif.map(r => `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #000000; text-align: center; font-weight: bold; font-size: 10pt;">${r.skor}</td>
      <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${r.deskripsi}</td>
    </tr>
  `).join('');

  // Rubrik Pengetahuan
  const pedomanPengetahuan = rpm.lampiran?.penilaianPengetahuan?.pedomanSkor || [
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
      skor4: 'Data tersusun rapi, runtut, dan sesuai konteks',
      skor3: 'Data cukup sesuai, hanya sedikit kekurangan',
      skor2: 'Penyajian kurang rapi atau tidak lengkap',
      skor1: 'Tidak menyusun data / tidak tepat'
    },
    {
      aspek: 'Refleksi atau Pemahaman Aplikatif',
      skor4: 'Memberikan jawaban reflektif yang bermakna dan mendalam',
      skor3: 'Memberikan jawaban cukup jelas dan logis',
      skor2: 'Jawaban masih umum dan kurang mendalam',
      skor1: 'Tidak menjawab atau sangat tidak relevan'
    }
  ];

  const pengetahuanRows = pedomanPengetahuan.map(p => `
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">${p.aspek}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${p.skor4}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${p.skor3}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${p.skor2}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${p.skor1}</td>
    </tr>
  `).join('');

  // Rubrik Keterampilan
  const pedomanKeterampilan = rpm.lampiran?.penilaianKeterampilan?.pedomanSkor || [
    {
      aspek: 'Penguasaan & Penyusunan Materi / Gerak',
      skor4: 'Menyusun / mempraktikkan materi dengan data akurat dan terstruktur sangat baik',
      skor3: 'Ada 1–2 kekeliruan kecil dalam penyusunan / gerak',
      skor2: 'Materi / gerak kurang tepat atau tidak lengkap',
      skor1: 'Materi / gerak salah seluruhnya atau tidak disusun'
    },
    {
      aspek: 'Penjelasan Proses',
      skor4: 'Menjelaskan dengan sangat jelas, runtut, dan artikulatif',
      skor3: 'Penjelasan cukup baik, meski agak terbata-bata',
      skor2: 'Penjelasan kurang sistematis',
      skor1: 'Tidak bisa menjelaskan proses dengan benar'
    },
    {
      aspek: 'Kerja Sama Kelompok',
      skor4: 'Semua anggota kelompok sangat aktif dan berbagi tugas merata',
      skor3: 'Sebagian besar anggota aktif berkontribusi',
      skor2: 'Hanya sebagian kecil anggota yang aktif',
      skor1: 'Tidak tampak kerja sama kelompok yang baik'
    },
    {
      aspek: 'Kreativitas Penyajian',
      skor4: 'Sangat menarik, visual/peragaan mendukung, komunikatif, dan percaya diri',
      skor3: 'Cukup menarik, menggunakan media pendukung sederhana',
      skor2: 'Kurang menarik, presentasi kurang percaya diri',
      skor1: 'Tidak menarik dan tidak menunjukkan rasa percaya diri'
    }
  ];

  const keterampilanRows = pedomanKeterampilan.map(k => `
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">${k.aspek}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${k.skor4}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${k.skor3}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${k.skor2}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${k.skor1}</td>
    </tr>
  `).join('');

  // Refleksi Guru rows
  const refleksiGuruList = rpm.lampiran?.refleksi?.guru || [
    { no: 1, aspek: 'Penguasaan Materi', refleksiGuru: 'Apakah saya sudah memahami cukup baik materi dan aktifitas pembelajaran ini?', jawaban: '' },
    { no: 2, aspek: 'Penyampaian Materi', refleksiGuru: 'Apakah materi ini sudah tersampaikan dengan cukup baik kepada peserta didik?', jawaban: '' },
    { no: 3, aspek: 'Umpan balik', refleksiGuru: 'Apakah 100% peserta didik telah mencapai penguasaan tujuan pembelajaran yang ingin dicapai?', jawaban: '' }
  ];

  const refleksiGuruRows = refleksiGuruList.map(r => `
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 10pt;">${r.no}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-weight: bold; font-size: 10pt;">${r.aspek}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 10pt;">${r.refleksiGuru}</td>
      <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 10pt;">${r.jawaban || ''}</td>
    </tr>
  `).join('');

  // Remedial & Pengayaan
  const remedialStrategi = rpm.lampiran?.pengayaanDanRemedial?.remedial?.strategi || [
    { nama: 'Pendekatan Kontekstual', deskripsi: 'Gunakan kembali data sederhana dari kehidupan nyata untuk menjelaskan kembali konsep dasar.' },
    { nama: 'Bimbingan Terstruktur', deskripsi: 'Guru memberikan penjelasan ulang mengenai konsep materi, langkah penyelesaian, dan contoh kasus sederhana secara bertahap.' },
    { nama: 'Latihan Bertahap', deskripsi: 'Siswa diberi soal latihan tambahan terpandu dimulai dari tingkat dasar lalu dilanjutkan ke tingkat menengah.' },
    { nama: 'Bimbingan Sebaya', deskripsi: 'Pasangkan siswa yang kesulitan dengan teman sebaya yang telah menguasai materi untuk diskusi dua arah.' }
  ];

  const pengayaanStrategi = rpm.lampiran?.pengayaanDanRemedial?.pengayaan?.strategi || [
    { nama: 'Membuat Soal Mandiri', deskripsi: 'Siswa diminta membuat 3–5 soal / studi kasus baru berdasarkan data lingkungan sekitar.' },
    { nama: 'Diskusi Lintas Kelompok', deskripsi: 'Siswa dengan kemampuan tinggi saling bertukar soal kreasi sendiri dan memecahkan tantangan bersama.' },
    { nama: 'Kegiatan Tantangan Aplikatif', deskripsi: 'Guru memberikan tugas eksplorasi seperti mencari contoh penerapan materi dalam dunia nyata dan mempresentasikannya.' }
  ];

  // Langkah Pembelajaran Content
  const awalPrinsip = rpm.pengalamanBelajar?.langkahPembelajaran?.awalOps?.prinsip || 'Berkesadaran, bermakna, menggembirakan';
  const awalDeskripsi = rpm.pengalamanBelajar?.langkahPembelajaran?.awalOps?.deskripsi || 'Pembuka dari proses pembelajaran yang bertujuan untuk mempersiapkan peserta didik sebelum memasuki inti pembelajaran. Kegiatan dalam tahap ini meliputi orientasi yang bermakna, apersepsi yang kontekstual, dan motivasi yang menggembirakan.';
  
  const intiPrinsipUmum = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.prinsipUmum || 'Pada tahap ini, siswa aktif terlibat dalam pengalaman belajar memahami, mengaplikasikan, dan merefleksi. Guru menerapkan prinsip pembelajaran berkesadaran, bermakna, menyenangkan untuk mencapai tujuan pembelajaran. Pengalaman belajar tidak harus dilaksanakan dalam satu kali pertemuan.';
  const memahamiPrinsip = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.memahami?.prinsip || 'Berkesadaran, bermakna, menggembirakan';
  const memahamiKegiatan = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.memahami?.kegiatan?.join('<br>&bull; ') || 'Siswa mengamati tayangan stimulus kontekstual / demonstrasi interaktif mengenai materi pokok dengan penuh perhatian dan kesadaran diri.';
  const mengaplikasiPrinsip = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.mengaplikasi?.prinsip || 'Berkesadaran, bermakna, menggembirakan';
  const mengaplikasiKegiatan = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.mengaplikasi?.kegiatan?.join('<br>&bull; ') || 'Siswa berkolaborasi dalam kelompok kecil menyelesaikan tugas pemecahan masalah / LKPD aplikatif.';
  const merefleksiPrinsip = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.merefleksi?.prinsip || 'Berkesadaran, bermakna, menggembirakan';
  const merefleksiKegiatan = rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.merefleksi?.kegiatan?.join('<br>&bull; ') || 'Kelompok lain memberikan tanggapan dan apresiasi konstruktif atas hasil presentasi.';

  const penutupPrinsip = rpm.pengalamanBelajar?.langkahPembelajaran?.penutupOps?.prinsip || 'Berkesadaran, bermakna, dan menggembirakan';
  const penutupDeskripsi = rpm.pengalamanBelajar?.langkahPembelajaran?.penutupOps?.deskripsi || 'Tahap akhir dalam proses pembelajaran yang bertujuan memberikan umpan balik yang konstruktif kepada siswa atas pengalaman belajar yang telah dilakukan, menyimpulkan pembelajaran, dan siswa terlibat dalam perencanaan pembelajaran selanjutnya.';

  const content = `
    <div style="text-align: center; margin-bottom: 20pt;">
      <h2 style="font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase;">PERENCANAAN PEMBELAJARAN MENDALAM</h2>
    </div>

    <!-- TABEL UTAMA RPM -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25pt;">
      <tbody>
        <!-- IDENTITAS -->
        <tr style="background-color: #f1f5f9;">
          <td colspan="2" style="padding: 6px 10px; border: 1px solid #000000; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">
            Identitas
          </td>
        </tr>
        <tr>
          <td style="width: 32%; padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Penyusun</td>
          <td style="width: 68%; padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${penyusun}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Sekolah</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${sekolah}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Tahun Pelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${tahunAjaran}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Semester</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${semester}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Mata Pelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${mataPelajaran}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Kelas / Fase Capaian</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${kelasFase}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Topik / Elemen</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${topikElemen}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Jumlah Pertemuan</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${rpm.identitas?.jumlahPertemuan ? `${rpm.identitas.jumlahPertemuan} Pertemuan` : (rpm.lkpdList?.length ? `${rpm.lkpdList.length} Pertemuan` : '2 Pertemuan')}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">Alokasi Waktu</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt;">${alokasiWaktu}</td>
        </tr>

        <!-- IDENTIFIKASI -->
        <tr style="background-color: #f1f5f9;">
          <td colspan="2" style="padding: 6px 10px; border: 1px solid #000000; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">
            Identifikasi
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">
            Murid
          </td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; white-space: pre-wrap; line-height: 1.5;">${rpm.identifikasi?.muridOps || rpm.identifikasi?.identifikasiMurid || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">
            Materi Pelajaran
          </td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; white-space: pre-wrap; line-height: 1.5;">${rpm.identifikasi?.materiPelajaranOps || rpm.identifikasi?.materiPelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">
            Dimensi Profil Lulusan
          </td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.6;">
            ${dplHtml}
          </td>
        </tr>

        <!-- DESAIN PEMBELAJARAN -->
        <tr style="background-color: #f1f5f9;">
          <td colspan="2" style="padding: 6px 10px; border: 1px solid #000000; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">
            Desain Pembelajaran
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Capaian Pembelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.capaianPembelajaranOps || rpm.desainPembelajaran?.capaianPembelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Lintas Disiplin Ilmu</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.lintasDisiplinIlmuOps || rpm.desainPembelajaran?.lintasDisiplinIlmu || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Tujuan Pembelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; white-space: pre-wrap; line-height: 1.5;">${rpm.desainPembelajaran?.tujuanPembelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Topik Pembelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.topikPembelajaranOps || rpm.desainPembelajaran?.topikPembelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Praktik Pedagogis</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; white-space: pre-wrap; line-height: 1.5;">${rpm.desainPembelajaran?.praktikPedagogis || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Kemitraan Pembelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.kemitraanPembelajaranOps || rpm.desainPembelajaran?.kemitraanPembelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Lingkungan Pembelajaran</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.lingkunganPembelajaran || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Pemanfaatan Digital</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.desainPembelajaran?.pemanfaatanDigitalOps || rpm.desainPembelajaran?.pemanfaatanDigital || '-'}</td>
        </tr>

        <!-- PENGALAMAN BELAJAR -->
        <tr style="background-color: #f1f5f9;">
          <td colspan="2" style="padding: 6px 10px; border: 1px solid #000000; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">
            Pengalaman Belajar
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 8px 10px; border: 1px solid #000000; font-size: 10pt;">
            <p style="font-weight: bold; margin: 0 0 4px 0;">Langkah-langkah Pembelajaran:</p>
            
            <p style="font-weight: bold; margin: 8px 0 2px 0;">Awal (${awalPrinsip})</p>
            <p style="margin: 0 0 6px 0; line-height: 1.5; color: #1e293b;">${awalDeskripsi}</p>
            ${rpm.pengalamanBelajar?.kegiatanAwal ? `<p style="margin: 0 0 8px 0; font-style: italic; color: #475569;">${rpm.pengalamanBelajar.kegiatanAwal}</p>` : ''}

            <p style="font-weight: bold; margin: 10px 0 2px 0;">Inti</p>
            <p style="margin: 0 0 6px 0; line-height: 1.5; color: #1e293b;">${intiPrinsipUmum}</p>
            
            <div style="margin-left: 10px; margin-bottom: 8px;">
              <p style="font-weight: bold; margin: 4px 0 2px 0;">Memahami (${memahamiPrinsip})</p>
              <p style="margin: 0 0 6px 0; line-height: 1.5;">&bull; ${memahamiKegiatan}</p>
              
              <p style="font-weight: bold; margin: 6px 0 2px 0;">Mengaplikasi (${mengaplikasiPrinsip})</p>
              <p style="margin: 0 0 6px 0; line-height: 1.5;">&bull; ${mengaplikasiKegiatan}</p>
              
              <p style="font-weight: bold; margin: 6px 0 2px 0;">Merefleksi (${merefleksiPrinsip})</p>
              <p style="margin: 0 0 6px 0; line-height: 1.5;">&bull; ${merefleksiKegiatan}</p>
            </div>
            ${rpm.pengalamanBelajar?.kegiatanInti ? `<p style="margin: 0 0 8px 0; font-style: italic; color: #475569;">${rpm.pengalamanBelajar.kegiatanInti}</p>` : ''}

            <p style="font-weight: bold; margin: 10px 0 2px 0;">Penutup (${penutupPrinsip})</p>
            <p style="margin: 0 0 4px 0; line-height: 1.5; color: #1e293b;">${penutupDeskripsi}</p>
            ${rpm.pengalamanBelajar?.kegiatanPenutup ? `<p style="margin: 0 0 4px 0; font-style: italic; color: #475569;">${rpm.pengalamanBelajar.kegiatanPenutup}</p>` : ''}
          </td>
        </tr>

        <!-- ASESMEN PEMBELAJARAN -->
        <tr style="background-color: #f1f5f9;">
          <td colspan="2" style="padding: 6px 10px; border: 1px solid #000000; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">
            Asesmen Pembelajaran
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Awal</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.asesmenPembelajaran?.awal || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Proses</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.asesmenPembelajaran?.proses || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; vertical-align: top;">Akhir</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 10pt; line-height: 1.5;">${rpm.asesmenPembelajaran?.akhir || '-'}</td>
        </tr>
      </tbody>
    </table>

    <!-- TANDA TANGAN -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 25pt; margin-bottom: 25pt;">
      <tr>
        <td style="width: 50%; border: none; text-align: center; font-size: 10pt; vertical-align: top;">
          <p style="margin: 0 0 4px 0;">Mengetahui,</p>
          <p style="font-weight: bold; margin: 0 0 50pt 0;">Kepala Sekolah</p>
          <p style="font-weight: bold; text-decoration: underline; margin: 0 0 4px 0;">
            ${typeof rpm.tandaTangan?.kepalaSekolah === 'object' && rpm.tandaTangan?.kepalaSekolah !== null
              ? (rpm.tandaTangan.kepalaSekolah as { nama: string; nip: string }).nama
              : (typeof rpm.tandaTangan?.kepalaSekolah === 'string' ? rpm.tandaTangan.kepalaSekolah : '............................................')}
          </p>
          <p style="margin: 0;">
            NIP. ${typeof rpm.tandaTangan?.kepalaSekolah === 'object' && rpm.tandaTangan?.kepalaSekolah !== null
              ? (rpm.tandaTangan.kepalaSekolah as { nama: string; nip: string }).nip
              : '........................................'}
          </p>
        </td>
        <td style="width: 50%; border: none; text-align: center; font-size: 10pt; vertical-align: top;">
          <p style="margin: 0 0 4px 0;">${rpm.tandaTangan?.tempatTanggal || `Jember, 1 Juli 2025`}</p>
          <p style="font-weight: bold; margin: 0 0 50pt 0;">Guru Mata Pelajaran</p>
          <p style="font-weight: bold; text-decoration: underline; margin: 0 0 4px 0;">
            ${typeof rpm.tandaTangan?.guruMapel === 'object' && rpm.tandaTangan?.guruMapel !== null
              ? (rpm.tandaTangan.guruMapel as { nama: string; nip: string }).nama
              : (typeof rpm.tandaTangan?.guruMapel === 'string' ? rpm.tandaTangan.guruMapel : penyusun)}
          </p>
          <p style="margin: 0;">
            NIP. ${typeof rpm.tandaTangan?.guruMapel === 'object' && rpm.tandaTangan?.guruMapel !== null
              ? (rpm.tandaTangan.guruMapel as { nama: string; nip: string }).nip
              : '........................................'}
          </p>
        </td>
      </tr>
    </table>

    <!-- LAMPIRAN-LAMPIRAN LENGKAP DENGAN PAGE BREAK -->
    
    <!-- LAMPIRAN 1: ASESMEN DIAGNOSTIK NON KOGNITIF -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10pt 0; text-transform: uppercase;">
        Lampiran 1: Asesmen Diagnostik Non Kognitif
      </h3>
      <p style="font-size: 10pt; margin: 0 0 8pt 0;">
        <strong>Tujuan:</strong> ${rpm.lampiran?.asesmenDiagnostikNonKognitif?.tujuan || 'Mengetahui kondisi awal mental para peserta didik'}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 10%; padding: 6px 10px; border: 1px solid #000000; text-align: center; font-size: 10pt;">No</th>
            <th style="width: 70%; padding: 6px 10px; border: 1px solid #000000; text-align: left; font-size: 10pt;">Pertanyaan</th>
            <th style="width: 20%; padding: 6px 10px; border: 1px solid #000000; text-align: center; font-size: 10pt;">Respon Siswa</th>
          </tr>
        </thead>
        <tbody>
          ${diagRows}
        </tbody>
      </table>
    </div>

    <!-- LAMPIRAN 2: ASESMEN FORMATIF -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10pt 0; text-transform: uppercase;">
        Lampiran 2: Asesmen Formatif (Diskusi, Presentasi, dan Unjuk Kerja)
      </h3>
      <p style="font-size: 10pt; margin: 0 0 6pt 0;">
        <strong>Asesmen Diskusi:</strong> ${rpm.lampiran?.asesmenFormatif?.keterangan?.diskusi || 'Melatih kemampuan peserta didik dalam berkolaborasi dengan kelompoknya, melatih berbicara dan berani mengungkapkan pendapat, memunculkan ide-idenya, bekerja sama dalam tim.'}
      </p>
      <p style="font-size: 10pt; margin: 0 0 6pt 0;">
        <strong>Asesmen Presentasi:</strong> ${rpm.lampiran?.asesmenFormatif?.keterangan?.presentasi || 'Melatih kemampuan peserta didik dalam berbicara di depan umum, berani mengajukan pertanyaan terhadap pemaparan hasil kerja kelompok lain, memaksimalkan kerja kelompok.'}
      </p>
      <p style="font-size: 10pt; margin: 0 0 12pt 0;">
        <strong>Asesmen Unjuk Kerja:</strong> ${rpm.lampiran?.asesmenFormatif?.keterangan?.unjukKerja || 'Menilai keterampilan proses yang dimiliki setiap anak dan perkembangannya secara berkelanjutan.'}
      </p>

      <p style="font-size: 10pt; font-weight: bold; margin: 0 0 6pt 0;">Rubrik Penilaian Formatif:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 15%; padding: 6px 10px; border: 1px solid #000000; text-align: center; font-size: 10pt;">Skor</th>
            <th style="width: 85%; padding: 6px 10px; border: 1px solid #000000; text-align: left; font-size: 10pt;">Deskripsi Ketercapaian</th>
          </tr>
        </thead>
        <tbody>
          ${rubrikFormatifRows}
        </tbody>
      </table>
    </div>

    <!-- LAMPIRAN 3: PENILAIAN SIKAP SPIRITUAL & SOSIAL -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10pt 0; text-transform: uppercase;">
        Lampiran 3: Penilaian Sikap (Spiritual dan Sosial)
      </h3>
      
      <p style="font-size: 10pt; font-weight: bold; margin: 0 0 4pt 0;">1. Penilaian Sikap Spiritual (Penilaian Diri)</p>
      <p style="font-size: 9.5pt; margin: 0 0 6pt 0;">Teknik: ${rpm.lampiran?.penilaianSikap?.spiritual?.teknik || 'Penilaian Diri'} &bull; Instrumen: ${rpm.lampiran?.penilaianSikap?.spiritual?.instrumen || 'Rubrik'}</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">No</th>
            <th style="width: 60%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Indikator Sikap Spiritual</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">SL</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">SR</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">KD</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">TP</th>
          </tr>
        </thead>
        <tbody>
          ${(rpm.lampiran?.penilaianSikap?.spiritual?.indikator || [
            'Siswa berdoa sebelum dan sesudah memulai pembelajaran',
            'Siswa mempunyai rasa empati dan kasih sayang antar sesama',
            'Siswa saling membantu antar sesama',
            'Siswa mampu memahami diri sendiri dan nilai-nilai diri'
          ]).map((ind, idx) => `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">${idx + 1}</td>
              <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${ind}</td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 10pt; font-weight: bold; margin: 0 0 4pt 0;">2. Penilaian Sikap Sosial (Penilaian Antar Teman)</p>
      <p style="font-size: 9.5pt; margin: 0 0 6pt 0;">Teknik: ${rpm.lampiran?.penilaianSikap?.sosial?.teknik || 'Penilaian Antar Teman'} &bull; Instrumen: ${rpm.lampiran?.penilaianSikap?.sosial?.instrumen || 'Rubrik'}</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">No</th>
            <th style="width: 60%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Indikator Sikap Sosial</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">SL</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">SR</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">KD</th>
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">TP</th>
          </tr>
        </thead>
        <tbody>
          ${(rpm.lampiran?.penilaianSikap?.sosial?.indikator || [
            'Siswa mampu berkomunikasi dengan baik',
            'Siswa mampu bekerja sama dengan baik',
            'Siswa peduli terhadap lingkungan',
            'Siswa mampu menghargai setiap perbedaan pendapat'
          ]).map((ind, idx) => `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">${idx + 1}</td>
              <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${ind}</td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
              <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 9pt; color: #334155; margin: 0 0 4pt 0;">
        <strong>Keterangan:</strong> ${rpm.lampiran?.penilaianSikap?.keterangan || 'SL = Selalu : sangat baik (4), SR = Sering : baik (3), KD = Kadang-kadang : cukup (2), TP = Tidak Pernah : perlu bimbingan (1)'}
      </p>
      <p style="font-size: 9pt; color: #334155; margin: 0 0 20pt 0;">
        <strong>Rumus Penilaian:</strong> ${rpm.lampiran?.penilaianSikap?.rumusNilai || 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'}
      </p>
    </div>

    <!-- LAMPIRAN 4: PENILAIAN PENGETAHUAN LKPD -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 6pt 0; text-transform: uppercase;">
        Lampiran 4: ${rpm.lampiran?.penilaianPengetahuan?.judul || 'Penilaian Kelompok Pengerjaan LKPD (Pengetahuan)'}
      </h3>
      <p style="font-size: 9.5pt; margin: 0 0 10pt 0;">
        <strong>Aspek Penilaian:</strong> ${(rpm.lampiran?.penilaianPengetahuan?.aspekList || ['Kelengkapan Jawaban', 'Ketepatan Konsep', 'Penyajian Data / Analisis', 'Refleksi atau Pemahaman Aplikatif']).join(' &bull; ')}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Aspek</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 4 (Sangat Baik)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 3 (Baik)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 2 (Cukup)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 1 (Kurang)</th>
          </tr>
        </thead>
        <tbody>
          ${pengetahuanRows}
        </tbody>
      </table>

      <p style="font-size: 9pt; color: #334155; margin: 0 0 20pt 0;">
        <strong>Rumus Penilaian:</strong> ${rpm.lampiran?.penilaianPengetahuan?.rumusNilai || 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'}
      </p>
    </div>

    <!-- LAMPIRAN 5: PENILAIAN KETERAMPILAN UNJUK KERJA -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 6pt 0; text-transform: uppercase;">
        Lampiran 5: ${rpm.lampiran?.penilaianKeterampilan?.judul || 'Penilaian Hasil Unjuk Kerja Kelompok (Keterampilan)'}
      </h3>
      <p style="font-size: 9.5pt; margin: 0 0 10pt 0;">
        <strong>Aspek Penilaian:</strong> ${(rpm.lampiran?.penilaianKeterampilan?.aspekList || ['Penguasaan & Penyusunan Materi', 'Penjelasan Proses', 'Kerja Sama Kelompok', 'Kreativitas Penyajian']).join(' &bull; ')}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Aspek</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 4 (Sangat Baik)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 3 (Baik)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 2 (Cukup)</th>
            <th style="width: 20%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Skor 1 (Kurang)</th>
          </tr>
        </thead>
        <tbody>
          ${keterampilanRows}
        </tbody>
      </table>

      <p style="font-size: 9pt; color: #334155; margin: 0 0 20pt 0;">
        <strong>Rumus Penilaian:</strong> ${rpm.lampiran?.penilaianKeterampilan?.rumusNilai || 'Nilai Akhir : (Jumlah skor yang diperoleh / 16) × 100'}
      </p>
    </div>

    <!-- LAMPIRAN 6: PENGAYAAN DAN REMEDIAL -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10pt 0; text-transform: uppercase;">
        Lampiran 6: Kegiatan Pengayaan dan Remedial
      </h3>

      <!-- REMEDIAL -->
      <div style="margin-bottom: 16pt;">
        <p style="font-size: 10pt; font-weight: bold; margin: 0 0 4pt 0;">A. Pembelajaran Remedial</p>
        <p style="font-size: 9.5pt; margin: 0 0 6pt 0;"><strong>Tujuan:</strong> ${rpm.lampiran?.pengayaanDanRemedial?.remedial?.tujuan || 'Membantu peserta didik yang belum memahami konsep dasar agar dapat mencapai tujuan pembelajaran secara tuntas.'}</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">No</th>
              <th style="width: 32%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Strategi Remedial</th>
              <th style="width: 60%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Deskripsi Pelaksanaan</th>
            </tr>
          </thead>
          <tbody>
            ${remedialStrategi.map((s, idx) => `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">${idx + 1}</td>
                <td style="padding: 6px 8px; border: 1px solid #000000; font-weight: bold; font-size: 9.5pt;">${s.nama}</td>
                <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${s.deskripsi}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- PENGAYAAN -->
      <div>
        <p style="font-size: 10pt; font-weight: bold; margin: 0 0 4pt 0;">B. Pembelajaran Pengayaan</p>
        <p style="font-size: 9.5pt; margin: 0 0 6pt 0;"><strong>Tujuan:</strong> ${rpm.lampiran?.pengayaanDanRemedial?.pengayaan?.tujuan || 'Memberikan tantangan lebih bagi peserta didik yang cepat memahami materi untuk memperdalam dan memperluas pemahaman mereka.'}</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">No</th>
              <th style="width: 32%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Strategi Pengayaan</th>
              <th style="width: 60%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Deskripsi Pelaksanaan</th>
            </tr>
          </thead>
          <tbody>
            ${pengayaanStrategi.map((s, idx) => `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">${idx + 1}</td>
                <td style="padding: 6px 8px; border: 1px solid #000000; font-weight: bold; font-size: 9.5pt;">${s.nama}</td>
                <td style="padding: 6px 8px; border: 1px solid #000000; font-size: 9.5pt;">${s.deskripsi}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- LAMPIRAN 7: REFLEKSI GURU & PESERTA DIDIK -->
    <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
      <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 10pt 0; text-transform: uppercase;">
        Lampiran 7: Refleksi Guru dan Peserta Didik
      </h3>

      <p style="font-size: 10pt; font-weight: bold; margin: 0 0 6pt 0;">1. Refleksi Guru</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 8%; padding: 6px 8px; border: 1px solid #000000; text-align: center; font-size: 9.5pt;">No</th>
            <th style="width: 25%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Aspek</th>
            <th style="width: 42%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Refleksi Guru</th>
            <th style="width: 25%; padding: 6px 8px; border: 1px solid #000000; text-align: left; font-size: 9.5pt;">Jawaban</th>
          </tr>
        </thead>
        <tbody>
          ${refleksiGuruRows}
        </tbody>
      </table>

      <p style="font-size: 10pt; font-weight: bold; margin: 0 0 4pt 0;">2. Refleksi Peserta Didik</p>
      <div style="padding: 10px 12px; border: 1px solid #000000; font-size: 9.5pt; line-height: 1.5; background-color: #f8fafc;">
        ${rpm.lampiran?.refleksi?.pesertaDidik || 'Menutup pembelajaran dengan meminta siswa melakukan refleksi terhadap apa yang sudah mereka pelajari dengan menjawab pertanyaan refleksi berbantuan Platform Ahaslides / Lembar Jurnal Refleksi.'}
      </div>
    </div>

    <!-- BUNDEL LEMBAR KERJA PESERTA DIDIK (LKPD) 1 S/D 8 -->
    ${(rpm.lkpdList || []).map((lkpd, idx) => `
      <div style="page-break-before: always; margin-top: 30pt; padding-top: 10pt;">
        <div style="text-align: center; margin-bottom: 14pt; border-bottom: 2px solid #000000; padding-bottom: 8pt;">
          <h3 style="font-size: 13pt; font-weight: bold; margin: 0 0 4pt 0; text-transform: uppercase;">
            LEMBAR KERJA PESERTA DIDIK (LKPD) - PERTEMUAN ${idx + 1}
          </h3>
          <p style="font-size: 11pt; font-weight: bold; margin: 0 0 4pt 0; color: #1e293b;">
            ${lkpd.title || `Pertemuan ${idx + 1}`}
          </p>
          <span style="display: inline-block; font-size: 9pt; font-weight: bold; background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; border: 1px solid #c7d2fe;">
            SINTAKS INTEGRATIF PEMBELAJARAN MENDALAM
          </span>
        </div>

        <!-- Tabel Identitas Kelompok Siswa -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14pt; background-color: #f8fafc;">
          <tr>
            <td style="width: 25%; padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">Mata Pelajaran</td>
            <td style="width: 75%; padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt;">${mataPelajaran}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">Kelas / Fase</td>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt;">${kelasFase}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">Topik / Materi</td>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt;">${topikElemen}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt; font-weight: bold;">Kelompok / Nama Anggota</td>
            <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 9.5pt;">
              1. ..................................................... 2. .....................................................<br/>
              3. ..................................................... 4. .....................................................
            </td>
          </tr>
        </table>

        <!-- Konten / Soal / Aktivitas LKPD -->
        <div style="border: 1px solid #000000; padding: 14pt; font-size: 10pt; line-height: 1.6; background-color: #ffffff; white-space: pre-wrap;">
${lkpd.content}
        </div>
      </div>
    `).join('')}
  `;

  return wrapWithDocShell(rpm.title || 'PERENCANAAN_PEMBELAJARAN_MENDALAM', content);
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
    const pointsHtml = slide.points.map(p => `<li style="margin-bottom: 6px;">${p}</li>`).join('\n');
    return `
      <div class="slide-container" style="border: 2px solid #1e293b; border-radius: 8px; padding: 20px; background-color: #ffffff; margin-bottom: 25px; page-break-after: always; min-height: 400px; font-family: 'Arial', sans-serif;">
        <!-- Slide Header -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <tr>
            <td style="border: none; padding: 0; text-align: left;">
              <span style="font-size: 10.5pt; font-weight: bold; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">SLIDE ${slide.slideNo} dari ${data.identitas.jumlahSlide}</span>
              <span style="font-size: 9pt; color: #475569; margin-left: 10px; background-color: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                Topik / Materi: ${data.identitas.topikMateri}
              </span>
            </td>
            <td style="border: none; padding: 0; text-align: right;">
              <span style="font-size: 8.5pt; font-weight: bold; color: #475569; background-color: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">${slide.layoutType}</span>
            </td>
          </tr>
        </table>

        <!-- Slide Title -->
        <h2 style="font-size: 17pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">
          ${slide.title}
        </h2>

        <!-- Slide Content Area (2 Columns in Landscape) -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 15px;">
          <tr>
            <!-- Left Side: Content Points -->
            <td style="border: none; width: 60%; vertical-align: top; padding-right: 15px;">
              <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px; border-radius: 4px; min-height: 180px;">
                <p style="font-size: 9.5pt; font-weight: bold; color: #475569; margin-top: 0; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Teks Slide / Poin Inti:</p>
                <ul style="font-size: 10.5pt; color: #0f172a; line-height: 1.5; margin-top: 0; padding-left: 20px;">
                  ${pointsHtml}
                </ul>
              </div>
            </td>

            <!-- Right Side: Visual Recommendations -->
            <td style="border: none; width: 40%; vertical-align: top;">
              <div style="background-color: #fdf2f8; border: 1px dashed #db2777; padding: 14px; border-radius: 6px; min-height: 180px;">
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

      if (block.blockType === 'pjokVisual' || block.visualType || block.illustrationPrompt) {
        const vType = block.visualType || detectPjokVisualType(block.illustrationPrompt || block.exactText || data.identitas.topikMateri);
        return getPjokDiagramHtml(vType, block.visualCaption || block.illustrationPrompt, data.identitas.sekolah || 'SD Negeri Kalimantong');
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



