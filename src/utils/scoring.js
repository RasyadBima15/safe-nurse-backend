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

module.exports = { hitungSkor };