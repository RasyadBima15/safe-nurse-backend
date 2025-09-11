function getMakassarTimestamp(makassarTime) {
  const year = makassarTime.getFullYear();
  const month = String(makassarTime.getMonth() + 1).padStart(2, "0");
  const day = String(makassarTime.getDate()).padStart(2, "0");

  const hours = String(makassarTime.getHours()).padStart(2, "0");
  const minutes = String(makassarTime.getMinutes()).padStart(2, "0");
  const seconds = String(makassarTime.getSeconds()).padStart(2, "0");
  const milliseconds = String(makassarTime.getMilliseconds()).padStart(6, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}+08`;
}

function generateKodeLaporan() {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `LAP-${ymd}-${sequence}`;
}

const requiredFieldsForAI = [
  "id_perawat",
  "id_ruangan",
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
  "id_perawat",
  "id_ruangan",
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
  "kategori", 
  "rekomendasi_tindakan",
];

const dampakScores = {
  "tidak ada cidera": 1,
  "cidera ringan": 2, 
  "cidera sedang": 3,
  "cidera berat": 4, 
  "kematian": 5,   
};

const probabilitasScores = {
  "5 tahun sekali": 1,      
  "2–5 tahun sekali": 2,    
  "1–2 tahun sekali": 3,      
  "Beberapa kali per tahun": 4,
  "Setiap bulan/minggu": 5,
};

function gradingClassification(skor) {
  if (skor >= 1 && skor <= 4) {
    return "biru";
  } else if (skor >= 5 && skor <= 9) {
    return "hijau";
  } else if (skor >= 10 && skor <= 14) {
    return "kuning";
  } else if (skor >= 15 && skor <= 25) {
    return "merah";
  } else {
    return null;
  }
}

function hitungSkor(dampak, probabilitas) {
  const skor_dampak = dampakScores[dampak];
  const skor_probabilitas = probabilitasScores[probabilitas];

  const skor_grading = skor_dampak * skor_probabilitas;
  const grading = gradingClassification(skor_grading);

  return { skor_dampak, skor_probabilitas, skor_grading, grading };
}

module.exports = { getMakassarTimestamp, generateKodeLaporan, hitungSkor, requiredFieldsForConfirmation, requiredFieldsForAI, dampakScores, probabilitasScores };