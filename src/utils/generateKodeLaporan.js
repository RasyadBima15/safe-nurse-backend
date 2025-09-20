function generateKodeLaporan() {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `LAP-${ymd}-${sequence}`;
}

export default { generateKodeLaporan };