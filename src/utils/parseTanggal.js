export function parseTanggal(tglString) {
  const [tanggal, waktu] = tglString.split(" ");
  const [day, month, year] = tanggal.split("/");
  const [hour, minute] = waktu.split(".");

  const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
  return dateObj.toISOString();
}
function parseTanggalDateOnly(input) {
  const [day, month, year] = input.split("/");
  return `${year}-${month}-${day}`; // → 2025-09-20
}

// export default {parseTanggal, parseTanggalDateOnly}