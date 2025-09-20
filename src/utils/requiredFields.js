const requiredFieldsForAI = [
  "nama_pasien",
  "no_rm",
  "umur",
  "jenis_kelamin",
  "tgl_msk_rs",
  "unit_yang_melaporkan",
  "lokasi_insiden",
  "tgl_insiden",
  "judul_insiden",
  "kronologi",
  "tindakan_awal",
  "tindakan_oleh",
  "dampak",
  "probabilitas",
];

const requiredFieldsForConfirmation = [
  "nama_pasien",
  "no_rm",
  "umur",
  "jenis_kelamin",
  "tgl_msk_rs",
  "unit_yang_melaporkan",
  "lokasi_insiden",
  "tgl_insiden",
  "judul_insiden",
  "kronologi",
  "tindakan_awal",
  "tindakan_oleh",
  "dampak",
  "probabilitas",
  "kategori"
];

module.exports = { requiredFieldsForConfirmation, requiredFieldsForAI };