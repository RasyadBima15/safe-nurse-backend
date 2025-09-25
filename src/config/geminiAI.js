import fetch from 'node-fetch';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function validateChronologyAPI(chronologyText) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY tidak ditemukan di environment variables.");
  }

  const systemPrompt = `
Anda adalah seorang auditor klinis dan ahli manajemen risiko di rumah sakit.
Tugas utama Anda adalah mengevaluasi kelengkapan sebuah kronologi insiden dengan logika yang sangat cermat.

Sebuah kronologi dianggap LENGKAP jika memenuhi semua kondisi berikut:
1. 5 Elemen Wajib Selalu Ada: 'Siapa', 'Apa', 'Kapan', 'Di mana', dan 'Bagaimana' HARUS selalu ada.
2. Logika Kondisional untuk 'Mengapa':
   - PENTING: Jika teks secara eksplisit menyatakan bahwa penyebabnya 'belum diketahui', 'sedang diinvestigasi', atau frasa sejenisnya, maka 'Mengapa' dianggap SUDAH TERPENUHI.
   - Jika teks mengandung petunjuk penyebab (misal: 'jatuh karena lantai licin'), penjelasan 'Mengapa' menjadi WAJIB.
   - Jika teks sama sekali tidak menyinggung soal penyebab, 'Mengapa' bersifat OPSIONAL.

Anda HARUS mengembalikan output dalam format JSON:
{
  "is_lengkap": boolean,
  "evaluasi": string,
  "poin_yang_hilang": string[]
}
`;

  const userPrompt = `Tolong validasi kronologi insiden berikut yang dilaporkan oleh seorang perawat:\n"${chronologyText}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // atau gpt-3.5-turbo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    });

    const replyText = completion.choices[0].message.content;

    // Parsing JSON hasil dari ChatGPT
    const processedData = JSON.parse(replyText);

    return { data: processedData, usage: completion.usage };
  } catch (error) {
    console.error("Error during OpenAI API call:", error);
    throw error;
  }
}

export async function callGeminiAPI(body) {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const systemPrompt = `
        Anda adalah asisten ahli untuk manajemen risiko insiden di rumah sakit. Tugas Anda ada tiga:
        1.  **Pembersihan & Standardisasi Data**: Perbaiki, rapikan, dan standarisasikan data input.
            - Untuk field teks (khusus nama_pasien, umur, jenis_kelamin, unit_yang_melaporkan, lokasi_insiden, judul_insiden, kronologi, tindakan_awal, tindakan_oleh):
                - Perbaiki kesalahan ejaan, tata bahasa, dan penggunaan kata yang kurang tepat.
                - Hilangkan spasi berlebih dan kata tidak baku.
                - Gunakan huruf kapital sesuai kaidah (misalnya huruf pertama nama, awal kalimat, nama unit, dsb).
                - Buat teks menjadi singkat, profesional, dan mudah dipahami.
                - Jangan mengubah arti atau informasi penting dari teks.
            - Untuk 'umur': konversi teks menjadi angka integer (contoh: 'enampuluh dua' menjadi 62).
            - Untuk 'jenis_kelamin': standarisasikan menjadi 'Laki-laki' atau 'Perempuan'.
            - Untuk 'nama_pasien': Ekstrak nama asli pasien dengan menghapus semua bentuk sapaan, panggilan, dan gelar (misalnya: 'Bapak', 'Ibu', 'Bp.', 'Tn.', 'Ny.', 'Sdr.', 'An.', 'Dr.', 'H.', 'Hj.', dll.). Setelah itu, format nama yang sudah bersih ke dalam "Title Case" (setiap kata diawali huruf kapital).
              - Contoh 1: Input 'bpk. budi setiawan' -> Output 'Budi Setiawan'
              - Contoh 2: Input 'IBU HJ. SITI AISYAH S.KED' -> Output 'Siti Aisyah'
              - Contoh 3: Input 'An. Michael' -> Output 'Michael'
        2.  **Penentuan Kategori**: Berdasarkan data yang diberikan, tentukan nilai untuk kolom 'kategori' menggunakan algoritma logika berikut:
            - JIKA insiden TIDAK mengenai pasien DAN insiden BELUM TERJADI (baru potensi) MAKA kategori = 'KPC'.
            - JIKA insiden TIDAK mengenai pasien DAN insiden SUDAH TERJADI tapi berhasil dicegah MAKA kategori = 'KNC'.
            - JIKA insiden MENGENAI pasien DAN pasien TIDAK MENGALAMI CEDERA MAKA kategori = 'KTC'.
            - JIKA insiden MENGENAI pasien DAN pasien mengalami CEDERA RINGAN atau SEDANG MAKA kategori = 'KTD'.
            - JIKA insiden MENGENAI pasien DAN pasien mengalami CEDERA BERAT atau KEMATIAN MAKA kategori = 'Sentinel'.
        3.  **Rekomendasi Tindakan**: Berikan rekomendasi tindakan rumah sakit selanjutnya ('rekomendasi_tindakan') yang paling sesuai. sesuaikan dengan tingkat risikonya.

        Anda HARUS mengembalikan output dalam format JSON yang valid sesuai skema yang diminta.
    `;

    const userPrompt = `
        Tolong proses data laporan insiden berikut:
        - nama_pasien: "${body.nama_pasien}"
        - umur: "${body.umur}"
        - jenis_kelamin: "${body.jenis_kelamin}"
        - unit_yang_melaporkan: "${body.unit_yang_melaporkan}"
        - lokasi_insiden: "${body.lokasi_insiden}"
        - judul_insiden: "${body.judul_insiden}"
        - kronologi: "${body.kronologi}"
        - tindakan_awal: "${body.tindakan_awal}"
        - tindakan_oleh: "${body.tindakan_oleh}"
        - dampak: "${body.dampak}"
    `;

    const jsonSchema = {
        type: "OBJECT",
        properties: {
            "nama_pasien": { "type": "STRING" },
            "umur": { "type": "INTEGER" },
            "jenis_kelamin": {
                "type": "STRING",
                "enum": ["Laki-laki", "Perempuan"]
            },
            "unit_yang_melaporkan": { "type": "STRING" },
            "lokasi_insiden": { "type": "STRING" },
            "judul_insiden": { "type": "STRING" },
            "kronologi": { "type": "STRING" },
            "tindakan_awal": { "type": "STRING" },
            "tindakan_oleh": { "type": "STRING" },
            "kategori": {
                "type": "STRING",
                "enum": ["KTD", "KPC", "KNC", "KTC", "Sentinel"]
            },
            "rekomendasi_tindakan": { "type": "STRING" }
        },
        required: [
            "nama_pasien",
            "umur",
            "jenis_kelamin",
            "unit_yang_melaporkan",
            "lokasi_insiden",
            "judul_insiden",
            "kronologi",
            "tindakan_awal",
            "tindakan_oleh",
            "kategori",
            "rekomendasi_tindakan"
        ]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API Error Response:", errorBody);
            throw new Error(`Gagal memanggil Gemini API. Status: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const jsonText = candidate.content.parts[0].text;
            const processedData = JSON.parse(jsonText);
            const usageMetadata = result.usageMetadata;
            
            return { data: processedData, usage: usageMetadata };
        } else {
            console.error("Invalid response structure from Gemini API:", JSON.stringify(result, null, 2));
            throw new Error("Struktur respons dari Gemini API tidak valid atau kosong.");
        }
    } catch (error) {
        console.error("Error during Gemini API call:", error);
        throw error; 
    }
}