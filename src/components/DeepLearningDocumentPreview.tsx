import React from 'react';
import { DeepLearningRPM } from '../types';

interface DeepLearningDocumentPreviewProps {
  rpm: DeepLearningRPM;
  showAll?: boolean;
}

export function RPMTableSection({ rpm }: { rpm: DeepLearningRPM }) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-2.5 gap-1">
        <div>
          <h3 className="font-bold text-slate-900 text-base uppercase tracking-tight">Tabel Rencana Pelaksanaan Pembelajaran (RPM)</h3>
          <p className="text-xs text-slate-500 font-medium">Format Standar Pembelajaran Mendalam (Mindful, Meaningful, Joyful)</p>
        </div>
        <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded border border-indigo-200 self-start sm:self-auto">
          Deep Learning
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-xs">
        <table className="w-full border-collapse text-left bg-white text-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-xs uppercase font-bold tracking-wider">
              <th className="w-[32%] px-4 py-3 border border-slate-400">Komponen / Sub-komponen</th>
              <th className="w-[68%] px-4 py-3 border border-slate-400">Isi Perencanaan Pembelajaran</th>
            </tr>
          </thead>
          <tbody className="text-slate-800 divide-y divide-slate-300">
            {/* IDENTITAS CATEGORY */}
            <tr className="bg-indigo-50/80 font-bold text-indigo-950">
              <td colSpan={2} className="px-4 py-2.5 border border-slate-300 uppercase tracking-wide font-extrabold text-[11px] bg-indigo-100/70 text-indigo-900">
                IDENTITAS
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Penyusun</td>
              <td className="px-4 py-2.5 border border-slate-300 font-medium">{rpm.identitas?.penyusun || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Sekolah</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.sekolah || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Tahun Pelajaran</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.tahunAjaran || '2025/2026'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Semester</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.semester || '1 (Ganjil)'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Mata Pelajaran</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.mataPelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Kelas / Fase Capaian</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.kelasFase || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Topik / Elemen</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.topikElemen || `${rpm.identitas?.bab || ''} / ${rpm.identitas?.topik || ''}`}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Jumlah Pertemuan</td>
              <td className="px-4 py-2.5 border border-slate-300 font-medium">
                {rpm.identitas?.jumlahPertemuan ? `${rpm.identitas.jumlahPertemuan} Pertemuan` : (rpm.lkpdList?.length ? `${rpm.lkpdList.length} Pertemuan` : '2 Pertemuan')}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border border-slate-300 font-semibold bg-slate-50/70">Alokasi Waktu</td>
              <td className="px-4 py-2.5 border border-slate-300">{rpm.identitas?.alokasiWaktu || '2 × 35 Menit'}</td>
            </tr>

            {/* IDENTIFIKASI CATEGORY */}
            <tr className="bg-indigo-50/80 font-bold text-indigo-950">
              <td colSpan={2} className="px-4 py-2.5 border border-slate-300 uppercase tracking-wide font-extrabold text-[11px] bg-indigo-100/70 text-indigo-900">
                IDENTIFIKASI
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Murid</td>
              <td className="px-4 py-3 border border-slate-300 whitespace-pre-wrap leading-relaxed">
                {rpm.identifikasi?.muridOps || rpm.identifikasi?.identifikasiMurid || '-'}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Materi Pelajaran</td>
              <td className="px-4 py-3 border border-slate-300 whitespace-pre-wrap leading-relaxed">
                {rpm.identifikasi?.materiPelajaranOps || rpm.identifikasi?.materiPelajaran || '-'}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Dimensi Profil Lulusan</td>
              <td className="px-4 py-3 border border-slate-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 py-1">
                  {dplList.map((dpl, idx) => {
                    const isChecked = selectedDpl.some(d => dpl.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(dpl.slice(0, 4).toLowerCase()));
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold border ${isChecked ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-400 bg-white text-transparent'}`}>
                          ✓
                        </span>
                        <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}>{dpl}</span>
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>

            {/* DESAIN PEMBELAJARAN CATEGORY */}
            <tr className="bg-indigo-50/80 font-bold text-indigo-950">
              <td colSpan={2} className="px-4 py-2.5 border border-slate-300 uppercase tracking-wide font-extrabold text-[11px] bg-indigo-100/70 text-indigo-900">
                DESAIN PEMBELAJARAN
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Capaian Pembelajaran</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.capaianPembelajaranOps || rpm.desainPembelajaran?.capaianPembelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Lintas Disiplin Ilmu</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.lintasDisiplinIlmuOps || rpm.desainPembelajaran?.lintasDisiplinIlmu || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Tujuan Pembelajaran</td>
              <td className="px-4 py-3 border border-slate-300 whitespace-pre-wrap leading-relaxed">{rpm.desainPembelajaran?.tujuanPembelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Topik Pembelajaran</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.topikPembelajaranOps || rpm.desainPembelajaran?.topikPembelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Praktik Pedagogis</td>
              <td className="px-4 py-3 border border-slate-300 whitespace-pre-wrap leading-relaxed">{rpm.desainPembelajaran?.praktikPedagogis || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Kemitraan Pembelajaran</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.kemitraanPembelajaranOps || rpm.desainPembelajaran?.kemitraanPembelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Lingkungan Pembelajaran</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.lingkunganPembelajaran || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Pemanfaatan Digital</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.desainPembelajaran?.pemanfaatanDigitalOps || rpm.desainPembelajaran?.pemanfaatanDigital || '-'}</td>
            </tr>

            {/* PENGALAMAN BELAJAR CATEGORY */}
            <tr className="bg-indigo-50/80 font-bold text-indigo-950">
              <td colSpan={2} className="px-4 py-2.5 border border-slate-300 uppercase tracking-wide font-extrabold text-[11px] bg-indigo-100/70 text-indigo-900">
                PENGALAMAN BELAJAR
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="px-4 py-3.5 border border-slate-300 space-y-3 leading-relaxed">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">Langkah-langkah Pembelajaran:</div>
                
                {/* Awal */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-1">
                  <div className="font-bold text-indigo-900 text-xs">
                    Awal ({rpm.pengalamanBelajar?.langkahPembelajaran?.awalOps?.prinsip || 'Berkesadaran, bermakna, menggembirakan'})
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {rpm.pengalamanBelajar?.langkahPembelajaran?.awalOps?.deskripsi || 'Pembuka dari proses pembelajaran yang bertujuan untuk mempersiapkan peserta didik sebelum memasuki inti pembelajaran. Kegiatan meliputi orientasi bermakna, apersepsi kontekstual, dan motivasi menggembirakan.'}
                  </p>
                  {rpm.pengalamanBelajar?.kegiatanAwal && (
                    <p className="text-slate-600 text-xs italic pt-1 border-t border-slate-200 mt-1">{rpm.pengalamanBelajar.kegiatanAwal}</p>
                  )}
                </div>

                {/* Inti */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2">
                  <div className="font-bold text-indigo-900 text-xs">Inti</div>
                  <p className="text-slate-700 text-xs italic">
                    {rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.prinsipUmum || 'Pada tahap ini, siswa aktif terlibat dalam pengalaman belajar memahami, mengaplikasikan, dan merefleksi. Guru menerapkan prinsip pembelajaran berkesadaran, bermakna, menyenangkan.'}
                  </p>
                  
                  <div className="space-y-2 pl-2 border-l-2 border-indigo-400">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">Memahami ({rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.memahami?.prinsip || 'Berkesadaran, bermakna, menggembirakan'})</span>
                      <ul className="list-disc list-inside text-xs text-slate-700 pl-1 space-y-0.5">
                        {(rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.memahami?.kegiatan || ['Siswa mengamati tayangan stimulus kontekstual mengenai materi pokok.']).map((k, idx) => (
                          <li key={idx}>{k}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 text-xs block">Mengaplikasi ({rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.mengaplikasi?.prinsip || 'Berkesadaran, bermakna, menggembirakan'})</span>
                      <ul className="list-disc list-inside text-xs text-slate-700 pl-1 space-y-0.5">
                        {(rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.mengaplikasi?.kegiatan || ['Siswa berkolaborasi dalam kelompok kecil menyelesaikan tugas aplikatif.']).map((k, idx) => (
                          <li key={idx}>{k}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 text-xs block">Merefleksi ({rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.merefleksi?.prinsip || 'Berkesadaran, bermakna, menggembirakan'})</span>
                      <ul className="list-disc list-inside text-xs text-slate-700 pl-1 space-y-0.5">
                        {(rpm.pengalamanBelajar?.langkahPembelajaran?.inti?.merefleksi?.kegiatan || ['Kelompok lain memberikan tanggapan dan refleksi konstruktif atas presentasi.']).map((k, idx) => (
                          <li key={idx}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {rpm.pengalamanBelajar?.kegiatanInti && (
                    <p className="text-slate-600 text-xs italic pt-1 border-t border-slate-200 mt-1">{rpm.pengalamanBelajar.kegiatanInti}</p>
                  )}
                </div>

                {/* Penutup */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-1">
                  <div className="font-bold text-indigo-900 text-xs">
                    Penutup ({rpm.pengalamanBelajar?.langkahPembelajaran?.penutupOps?.prinsip || 'Berkesadaran, bermakna, dan menggembirakan'})
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {rpm.pengalamanBelajar?.langkahPembelajaran?.penutupOps?.deskripsi || 'Tahap akhir bertujuan memberikan umpan balik konstruktif, menyimpulkan pembelajaran, dan siswa terlibat dalam perencanaan pembelajaran selanjutnya.'}
                  </p>
                  {rpm.pengalamanBelajar?.kegiatanPenutup && (
                    <p className="text-slate-600 text-xs italic pt-1 border-t border-slate-200 mt-1">{rpm.pengalamanBelajar.kegiatanPenutup}</p>
                  )}
                </div>
              </td>
            </tr>

            {/* ASESMEN PEMBELAJARAN CATEGORY */}
            <tr className="bg-indigo-50/80 font-bold text-indigo-950">
              <td colSpan={2} className="px-4 py-2.5 border border-slate-300 uppercase tracking-wide font-extrabold text-[11px] bg-indigo-100/70 text-indigo-900">
                ASESMEN PEMBELAJARAN
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Awal</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.asesmenPembelajaran?.awal || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Proses</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.asesmenPembelajaran?.proses || '-'}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 border border-slate-300 font-semibold bg-slate-50/70 align-top">Akhir</td>
              <td className="px-4 py-3 border border-slate-300 leading-relaxed">{rpm.asesmenPembelajaran?.akhir || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatures block */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-300 mt-6 text-center text-xs page-break-avoid">
        <div className="space-y-12">
          <p className="text-slate-600">Mengetahui,</p>
          <p className="font-bold text-slate-900 text-sm">Kepala Sekolah</p>
          <div className="pt-8">
            <p className="font-bold text-slate-900 underline text-xs">
              {typeof rpm.tandaTangan?.kepalaSekolah === 'object' && rpm.tandaTangan?.kepalaSekolah !== null
                ? (rpm.tandaTangan.kepalaSekolah as { nama: string; nip: string }).nama
                : (typeof rpm.tandaTangan?.kepalaSekolah === 'string' ? rpm.tandaTangan.kepalaSekolah : '............................................')}
            </p>
            <p className="text-slate-500 text-[11px]">
              NIP. {typeof rpm.tandaTangan?.kepalaSekolah === 'object' && rpm.tandaTangan?.kepalaSekolah !== null
                ? (rpm.tandaTangan.kepalaSekolah as { nama: string; nip: string }).nip
                : '........................................'}
            </p>
          </div>
        </div>

        <div className="space-y-12">
          <p className="text-slate-600">{rpm.tandaTangan?.tempatTanggal || 'Jember, 1 Juli 2025'}</p>
          <p className="font-bold text-slate-900 text-sm">Guru Mata Pelajaran</p>
          <div className="pt-8">
            <p className="font-bold text-slate-900 underline text-xs">
              {typeof rpm.tandaTangan?.guruMapel === 'object' && rpm.tandaTangan?.guruMapel !== null
                ? (rpm.tandaTangan.guruMapel as { nama: string; nip: string }).nama
                : (typeof rpm.tandaTangan?.guruMapel === 'string' ? rpm.tandaTangan.guruMapel : rpm.identitas?.penyusun)}
            </p>
            <p className="text-slate-500 text-[11px]">
              NIP. {typeof rpm.tandaTangan?.guruMapel === 'object' && rpm.tandaTangan?.guruMapel !== null
                ? (rpm.tandaTangan.guruMapel as { nama: string; nip: string }).nip
                : '........................................'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RPMLampiranSection({ rpm }: { rpm: DeepLearningRPM }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300 pb-2.5">
        <h3 className="font-bold text-slate-900 text-base uppercase tracking-tight">Lampiran Berkas Lengkap RPM</h3>
        <p className="text-xs text-slate-500 font-medium">Lampiran 1 s/d 7 Sesuai Struktur Resmi Pembelajaran Mendalam</p>
      </div>

      {/* Lampiran 1 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 1: Asesmen Diagnostik Non Kognitif
        </h4>
        <p className="text-xs text-slate-700">
          <strong>Tujuan:</strong> {rpm.lampiran?.asesmenDiagnostikNonKognitif?.tujuan || 'Mengetahui kondisi awal mental para peserta didik'}
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 w-12 text-center">No</th>
                <th className="p-2 border border-slate-300 text-left">Pertanyaan</th>
                <th className="p-2 border border-slate-300 w-28 text-center">Respon Siswa</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.asesmenDiagnostikNonKognitif?.pertanyaan || [
                { no: 1, teks: 'Apa kabar hari ini?' },
                { no: 2, teks: 'Apakah ada yang sakit hari ini?' },
                { no: 3, teks: 'Apakah kalian dalam keadaan sehat?' },
                { no: 4, teks: 'Apakah anak-anak merasa bersemangat hari ini?' }
              ]).map((q, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 text-center">{q.no}</td>
                  <td className="p-2 border border-slate-300">{q.teks}</td>
                  <td className="p-2 border border-slate-300 text-center text-slate-500 font-medium">Ya / Tidak</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lampiran 2 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 2: Asesmen Formatif (Diskusi, Presentasi, Unjuk Kerja)
        </h4>
        <div className="space-y-1.5 text-xs text-slate-700">
          <p><strong>Asesmen Diskusi:</strong> {rpm.lampiran?.asesmenFormatif?.keterangan?.diskusi || 'Melatih kemampuan peserta didik dalam berkolaborasi dengan kelompoknya, melatih berbicara dan berani mengungkapkan pendapat.'}</p>
          <p><strong>Asesmen Presentasi:</strong> {rpm.lampiran?.asesmenFormatif?.keterangan?.presentasi || 'Melatih kemampuan berbicara di depan umum dan berani menanggapi.'}</p>
          <p><strong>Asesmen Unjuk Kerja:</strong> {rpm.lampiran?.asesmenFormatif?.keterangan?.unjukKerja || 'Menilai keterampilan proses yang dimiliki setiap peserta didik.'}</p>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 w-16 text-center">Skor</th>
                <th className="p-2 border border-slate-300 text-left">Deskripsi Ketercapaian Rubrik Formatif</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.asesmenFormatif?.rubrikPenilaian || [
                { skor: 5, deskripsi: 'Sangat aktif berkontribusi dalam diskusi dan presentasi, ide orisinal, komunikasi sangat jelas, keterampilan kerja sangat baik.' },
                { skor: 4, deskripsi: 'Aktif berdiskusi dan presentasi, mampu menjelaskan ide dengan baik, keterampilan kerja terlihat.' },
                { skor: 3, deskripsi: 'Cukup aktif, sesekali berpartisipasi, menjawab jika ditanya.' },
                { skor: 2, deskripsi: 'Kurang aktif, jarang berbicara atau menyumbang ide.' },
                { skor: 1, deskripsi: 'Tidak menunjukkan partisipasi, tidak memahami tugas.' }
              ]).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 text-center font-bold text-slate-900">{r.skor}</td>
                  <td className="p-2 border border-slate-300 leading-relaxed">{r.deskripsi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lampiran 3 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 3: Penilaian Sikap (Spiritual & Sosial)
        </h4>
        
        <p className="text-xs font-bold text-slate-900">1. Sikap Spiritual (Penilaian Diri)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 w-10 text-center">No</th>
                <th className="p-2 border border-slate-300 text-left">Indikator Sikap Spiritual</th>
                <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                <th className="p-2 border border-slate-300 w-12 text-center">SR</th>
                <th className="p-2 border border-slate-300 w-12 text-center">KD</th>
                <th className="p-2 border border-slate-300 w-12 text-center">TP</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.penilaianSikap?.spiritual?.indikator || [
                'Siswa berdoa sebelum dan sesudah memulai pembelajaran',
                'Siswa mempunyai rasa empati dan kasih sayang antar sesama',
                'Siswa saling membantu antar sesama',
                'Siswa mampu memahami diri sendiri dan nilai-nilai diri'
              ]).map((ind, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 text-center">{idx + 1}</td>
                  <td className="p-2 border border-slate-300">{ind}</td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs font-bold text-slate-900 pt-2">2. Sikap Sosial (Penilaian Antar Teman)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 w-10 text-center">No</th>
                <th className="p-2 border border-slate-300 text-left">Indikator Sikap Sosial</th>
                <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                <th className="p-2 border border-slate-300 w-12 text-center">SR</th>
                <th className="p-2 border border-slate-300 w-12 text-center">KD</th>
                <th className="p-2 border border-slate-300 w-12 text-center">TP</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.penilaianSikap?.sosial?.indikator || [
                'Siswa mampu berkomunikasi dengan baik',
                'Siswa mampu bekerja sama dengan baik',
                'Siswa peduli terhadap lingkungan',
                'Siswa mampu menghargai setiap perbedaan pendapat'
              ]).map((ind, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 text-center">{idx + 1}</td>
                  <td className="p-2 border border-slate-300">{ind}</td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                  <td className="p-2 border border-slate-300 text-center"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-600 italic">
          <strong>Keterangan:</strong> SL = Selalu (4), SR = Sering (3), KD = Kadang-kadang (2), TP = Tidak Pernah (1) &bull; {rpm.lampiran?.penilaianSikap?.rumusNilai || 'Nilai Akhir = (Jumlah skor diperoleh / 16) × 100'}
        </p>
      </div>

      {/* Lampiran 4 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 4: Penilaian Pengetahuan LKPD
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 text-left w-1/5">Aspek</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 4 (Sangat Baik)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 3 (Baik)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 2 (Cukup)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 1 (Kurang)</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.penilaianPengetahuan?.pedomanSkor || [
                { aspek: 'Kelengkapan Jawaban', skor4: 'Semua soal dijawab lengkap', skor3: 'Sebagian besar dijawab tepat', skor2: 'Sebagian kecil dijawab', skor1: 'Hampir seluruh soal kosong' },
                { aspek: 'Ketepatan Konsep', skor4: 'Semua konsep materi tepat', skor3: 'Ada 1-2 kekeliruan kecil', skor2: 'Beberapa konsep keliru', skor1: 'Banyak kesalahan konsep' }
              ]).map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 font-bold text-slate-900">{p.aspek}</td>
                  <td className="p-2 border border-slate-300">{p.skor4}</td>
                  <td className="p-2 border border-slate-300">{p.skor3}</td>
                  <td className="p-2 border border-slate-300">{p.skor2}</td>
                  <td className="p-2 border border-slate-300">{p.skor1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lampiran 5 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 5: Penilaian Keterampilan Unjuk Kerja Kelompok
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 text-left w-1/5">Aspek</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 4 (Sangat Baik)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 3 (Baik)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 2 (Cukup)</th>
                <th className="p-2 border border-slate-300 text-left w-1/5">Skor 1 (Kurang)</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.penilaianKeterampilan?.pedomanSkor || [
                { aspek: 'Penguasaan Materi', skor4: 'Sangat menguasai & akurat', skor3: 'Cukup menguasai', skor2: 'Kurang tepat', skor1: 'Tidak menguasai' },
                { aspek: 'Kerja Sama Kelompok', skor4: 'Semua anggota sangat aktif', skor3: 'Sebagian besar aktif', skor2: 'Hanya sedikit aktif', skor1: 'Tidak tampak kerja sama' }
              ]).map((k, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 font-bold text-slate-900">{k.aspek}</td>
                  <td className="p-2 border border-slate-300">{k.skor4}</td>
                  <td className="p-2 border border-slate-300">{k.skor3}</td>
                  <td className="p-2 border border-slate-300">{k.skor2}</td>
                  <td className="p-2 border border-slate-300">{k.skor1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lampiran 6 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 6: Pengayaan dan Remedial
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded-lg border border-slate-300 space-y-2">
            <h5 className="font-bold text-xs text-rose-900 uppercase">A. Pembelajaran Remedial</h5>
            <p className="text-[11px] text-slate-600"><strong>Tujuan:</strong> {rpm.lampiran?.pengayaanDanRemedial?.remedial?.tujuan || 'Membantu siswa yang belum tuntas mencapai pemahaman.'}</p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
              {(rpm.lampiran?.pengayaanDanRemedial?.remedial?.strategi || [
                { nama: 'Pendekatan Kontekstual', deskripsi: 'Gunakan data nyata untuk menjelaskan konsep.' },
                { nama: 'Bimbingan Terstruktur', deskripsi: 'Penjelasan bertahap secara intensif.' }
              ]).map((s, idx) => (
                <li key={idx}><strong>{s.nama}:</strong> {s.deskripsi}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-300 space-y-2">
            <h5 className="font-bold text-xs text-emerald-900 uppercase">B. Pembelajaran Pengayaan</h5>
            <p className="text-[11px] text-slate-600"><strong>Tujuan:</strong> {rpm.lampiran?.pengayaanDanRemedial?.pengayaan?.tujuan || 'Memberikan tantangan perluasan materi.'}</p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
              {(rpm.lampiran?.pengayaanDanRemedial?.pengayaan?.strategi || [
                { nama: 'Membuat Soal Mandiri', deskripsi: 'Kreasi studi kasus kontekstual.' },
                { nama: 'Diskusi Lintas Kelompok', deskripsi: 'Pemecahan tantangan mendalam.' }
              ]).map((s, idx) => (
                <li key={idx}><strong>{s.nama}:</strong> {s.deskripsi}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Lampiran 7 */}
      <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-300 space-y-3 page-break-avoid">
        <h4 className="font-bold text-indigo-950 text-sm border-b border-slate-200 pb-1.5 uppercase">
          Lampiran 7: Refleksi Guru & Peserta Didik
        </h4>
        
        <p className="text-xs font-bold text-slate-900">1. Refleksi Guru</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse bg-white border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="p-2 border border-slate-300 w-10 text-center">No</th>
                <th className="p-2 border border-slate-300 w-1/4 text-left">Aspek</th>
                <th className="p-2 border border-slate-300 text-left">Pertanyaan Refleksi Guru</th>
              </tr>
            </thead>
            <tbody>
              {(rpm.lampiran?.refleksi?.guru || [
                { no: 1, aspek: 'Penguasaan Materi', refleksiGuru: 'Apakah saya sudah memahami cukup baik materi dan aktifitas pembelajaran ini?' },
                { no: 2, aspek: 'Penyampaian Materi', refleksiGuru: 'Apakah materi ini sudah tersampaikan dengan cukup baik kepada peserta didik?' },
                { no: 3, aspek: 'Umpan balik', refleksiGuru: 'Apakah 100% peserta didik telah mencapai penguasaan tujuan pembelajaran?' }
              ]).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-300 text-center">{r.no}</td>
                  <td className="p-2 border border-slate-300 font-semibold">{r.aspek}</td>
                  <td className="p-2 border border-slate-300">{r.refleksiGuru}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-300 space-y-1">
          <p className="text-xs font-bold text-slate-900">2. Refleksi Peserta Didik</p>
          <p className="text-xs text-slate-700 leading-relaxed">
            {rpm.lampiran?.refleksi?.pesertaDidik || 'Menutup pembelajaran dengan meminta siswa melakukan refleksi terhadap apa yang sudah dipelajari dengan menjawab pertanyaan refleksi berbantuan Platform Ahaslides / Lembar Jurnal Refleksi.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RPMLkpdSection({ rpm, selectedIndex }: { rpm: DeepLearningRPM; selectedIndex?: number }) {
  const lkpds = selectedIndex !== undefined ? [rpm.lkpdList[selectedIndex]] : rpm.lkpdList;

  return (
    <div className="space-y-6">
      {lkpds.map((lkpd, idx) => {
        const actualIdx = selectedIndex !== undefined ? selectedIndex : idx;
        if (!lkpd) return null;
        return (
          <div key={actualIdx} className="bg-white p-6 rounded-xl border border-slate-300 shadow-xs space-y-4 page-break-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-3 gap-2">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  LEMBAR KERJA PESERTA DIDIK - PERTEMUAN {actualIdx + 1}
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-1">
                  {lkpd.title || `Pertemuan ${actualIdx + 1}`}
                </h4>
              </div>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-200 self-start sm:self-auto">
                SINTAKS INTEGRATIF
              </span>
            </div>

            {/* Student Group Header Table */}
            <div className="overflow-x-auto rounded border border-slate-300">
              <table className="w-full text-xs border-collapse bg-slate-50/60">
                <tbody>
                  <tr>
                    <td className="w-1/4 p-2 border-r border-b border-slate-300 font-bold text-slate-800">Mata Pelajaran</td>
                    <td className="p-2 border-b border-slate-300 font-medium">{rpm.identitas?.mataPelajaran || '-'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-b border-slate-300 font-bold text-slate-800">Kelas / Fase</td>
                    <td className="p-2 border-b border-slate-300 font-medium">{rpm.identitas?.kelasFase || '-'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-b border-slate-300 font-bold text-slate-800">Topik / Materi</td>
                    <td className="p-2 border-b border-slate-300 font-medium">{rpm.identitas?.topikElemen || `${rpm.identitas?.bab || ''} / ${rpm.identitas?.topik || ''}`}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-300 font-bold text-slate-800 align-top">Kelompok / Nama Anggota</td>
                    <td className="p-2 text-slate-600">
                      1. ..................................................... 2. .....................................................<br/>
                      3. ..................................................... 4. .....................................................
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Complete LKPD content text */}
            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/30 p-5 rounded-lg border border-slate-200 shadow-inner">
              {lkpd.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
