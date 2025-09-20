export function timeAgo(dateString) {
  const now = new Date();
  const created = new Date(dateString);
  const diff = Math.floor((now - created) / 1000); // selisih dalam detik

  if (diff < 60) {
    return `${diff} detik yang lalu`;
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} menit yang lalu`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} jam yang lalu`;
  } else if (diff < 2592000) { // < 30 hari
    const days = Math.floor(diff / 86400);
    return `${days} hari yang lalu`;
  } else if (diff < 31536000) { // < 12 bulan
    const months = Math.floor(diff / 2592000);
    return `${months} bulan yang lalu`;
  } else {
    const years = Math.floor(diff / 31536000);
    return `${years} tahun yang lalu`;
  }
}

// export default { timeAgo }