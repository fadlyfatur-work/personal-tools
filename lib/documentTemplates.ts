import type { TemplateConfig } from '../types/templateSurat'

// Templates shipped with the app; existing database templates remain available.
export const documentTemplates: Record<string, { code: string; name: string; file_path: string; fields: TemplateConfig }> = {
  surat_tugas: {
    code: 'surat_tugas',
    name: 'Surat Tugas',
    file_path: 'surat_tugas.docx',
    fields: {
      single: [
        { key: 'nomor_surat', label: 'Nomor surat', required: true },
        { key: 'menimbang_1', label: 'Menimbang (poin pertama)', type: 'textarea', required: true },
        { key: 'menimbang_2', label: 'Menimbang (poin kedua, jika diperlukan)', type: 'textarea' },
        { key: 'dasar', label: 'Dasar penugasan', type: 'textarea', required: true },
        { key: 'nama_acara', label: 'Nama acara', type: 'textarea', required: true },
        { key: 'tanggal_perjalanan_dinas', label: 'Periode perjalanan dinas', type: 'dateRange', required: true },
        { key: 'kota_tujuan', label: 'Kota tujuan', required: true },
        { key: 'provinsi_tujuan', label: 'Provinsi tujuan', required: true },
        { key: 'jenis_transportasi', label: 'Transportasi', type: 'select', options: ['Transportasi darat', 'Transportasi udara', 'Transportasi air'], required: true },
        { key: 'sumber_anggaran', label: 'Sumber anggaran', type: 'textarea', required: true },
        { key: 'tanggal', label: 'Tanggal penerbitan surat', type: 'date', required: true },
      ],
      groups: [{
        name: 'pegawai', label: 'Pegawai', minItems: 1, maxItems: 20, repeatRows: true,
        fields: [
          { key: 'nama_lengkap', label: 'Nama lengkap dan gelar', required: true },
          { key: 'golongan', label: 'Golongan (contoh: III)', required: true },
          { key: 'sub_golongan', label: 'Ruang (contoh: a)', required: true },
          { key: 'nip', label: 'NIP', required: true },
          { key: 'jabatan', label: 'Jabatan', required: true },
        ],
      }],
    },
  },
}
