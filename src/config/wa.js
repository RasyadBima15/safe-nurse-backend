import dotenv from 'dotenv'

dotenv.config()
const TOKEN_FONNTE = process.env.TOKEN_FONNTE

export async function sendWA(nomorTujuan, namaPengirim, isiPesan) {
  const pesanTerformat = `🔔 Notifikasi Baru!\n\nAnda mendapat pesan dari *${namaPengirim}*:\n\n\`${isiPesan}\``;
  const url = "https://api.fonnte.com/send";

  const payload = new URLSearchParams({
    'target': nomorTujuan,
    'message': pesanTerformat,
    'countryCode': '62',
  });

  const options = {
    method: 'POST',
    headers: {
      'Authorization': TOKEN_FONNTE,
    },
    body: payload,
  };

  try {
    const response = await fetch(url, options);

    // node-fetch tidak otomatis error untuk status 4xx/5xx, jadi kita cek manual
    if (!response.ok) {
      // Ambil detail error dari body response jika ada
      const errorBody = await response.json();
      throw new Error(`HTTP error! Status: ${response.status}, Detail: ${JSON.stringify(errorBody)}`);
    }

    // const responseData = await response.json(); // Uncomment untuk melihat detail response sukses
    // console.log("✅ Notifikasi berhasil dikirim!");
    // console.log(`   Ke: ${nomorTujuan}`);
    // console.log(`   Dari: ${namaPengirim}`);

  } catch (error) {
    console.error(`🔥 Gagal mengirim notifikasi:`, error.message);
  }
}
