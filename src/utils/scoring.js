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

function rekomendasiTindakan(grading) {
  switch (grading) {
    case "merah":
      return "Dilakukan RCA paling lama 45 hari, membutuhkan tindakan segera, perhatian sampai direktur.";
    case "kuning":
      return "Dilakukan RCA paling lama 45 hari, kaji dengan detail & perlu tindakan segera serta membutuhkan perhatian top manajer.";
    case "hijau":
      return "Dilakukan investigasi sederhana paling lama 2 minggu, manajer / pimpinan klinis sebaiknya menilai dampak terhadap biaya dan kelola risiko.";
    case "biru":
      return "Dilakukan investigasi sederhana paling lambat 1 minggu, diselesaikan dengan prosedur rutin.";
  }
}

function hitungSkor(dampak, probabilitas) {
  const skor_dampak = dampakScores[dampak];
  const skor_probabilitas = probabilitasScores[probabilitas];

  const skor_grading = skor_dampak * skor_probabilitas;
  const grading = gradingClassification(skor_grading);
  const rekomendasi_tindakan = rekomendasiTindakan(grading);

  return { skor_dampak, skor_probabilitas, skor_grading, grading, rekomendasi_tindakan };
}

export default { hitungSkor };