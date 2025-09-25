import fetch from 'node-fetch';

export async function validateChronologyAPI(chronologyText) {
    // Pastikan API Key Anda sudah di-set di environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY tidak ditemukan di environment variables.");
    }
    
    // KOREKSI: Menggunakan model yang valid dan tersedia. 'gemini-1.5-flash-latest' adalah pilihan terbaik.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    // System Prompt: Instruksi utama untuk AI
    const systemPrompt = `
        Anda adalah seorang auditor klinis dan ahli manajemen risiko di rumah sakit. 
        Tugas utama Anda adalah mengevaluasi kelengkapan sebuah kronologi insiden dengan logika yang sangat cermat.

        Sebuah kronologi dianggap LENGKAP jika memenuhi semua kondisi berikut:
        1.  **5 Elemen Wajib Selalu Ada:** 'Siapa', 'Apa', 'Kapan', 'Di mana', dan 'Bagaimana' HARUS selalu ada.
        2.  **Logika Kondisional untuk 'Mengapa':**
            - **PENTING:** Jika teks secara eksplisit menyatakan bahwa penyebabnya **'belum diketahui', 'sedang diinvestigasi',** atau frasa sejenisnya, maka 'Mengapa' dianggap **SUDAH TERPENUHI** dan laporan dianggap lengkap dari segi ini.
            - Jika teks **mengandung petunjuk penyebab** (misal: 'jatuh karena lantai licin'), MAKA penjelasan 'Mengapa' menjadi **WAJIB** dan harus jelas.
            - Jika teks **sama sekali tidak menyinggung** soal penyebab, MAKA 'Mengapa' bersifat **OPSIONAL**.

        Tugas Anda:
        - Analisis teks sesuai aturan di atas.
        - Jika ada kalimat seperti 'penyebab belum diketahui', langsung anggap poin 'Mengapa' sudah valid.
        - Set 'is_lengkap' ke 'true' jika semua aturan terpenuhi.

        Anda HARUS mengembalikan output dalam format JSON yang valid sesuai skema yang diminta.
    `;

    // User Prompt: Data input yang akan dianalisis
    const userPrompt = `
        Tolong validasi kelengkapan kronologi insiden berikut yang dilaporkan oleh seorang perawat:
        "${chronologyText}"
    `;

    // Skema JSON untuk memastikan output yang konsisten dan terstruktur
    const jsonSchema = {
        type: "OBJECT",
        properties: {
            "is_lengkap": {
                type: "BOOLEAN",
                description: "Bernilai 'true' jika 5 elemen wajib (Siapa, Apa, Kapan, Di Mana, Bagaimana) sudah terpenuhi, dan 'false' jika ada yang kurang."
            },
            "evaluasi": {
                type: "STRING",
                description: "Penjelasan singkat (satu kalimat) mengenai kesimpulan validasi Anda."
            },
            "poin_yang_hilang": {
                type: "ARRAY",
                description: "Daftar poin-poin informasi WAJIB yang tidak ditemukan. Array ini harus kosong jika 'is_lengkap' bernilai true.",
                items: {
                    type: "STRING"
                }
            },
        },
        required: [
            "is_lengkap",
            "evaluasi",
            "poin_yang_hilang"
        ]
    };

    // Payload yang akan dikirim ke Gemini API
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

    // Proses pemanggilan API menggunakan fetch
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text(); // Dapatkan teks error untuk debugging
            console.error("API Error Response:", errorBody);
            throw new Error(`Gagal memanggil Gemini API. Status: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const jsonText = candidate.content.parts[0].text;
            const processedData = JSON.parse(jsonText);
            const usageMetadata = result.usageMetadata;
            
            // Mengembalikan data yang sudah diproses dan info penggunaan token
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
export async function callGeminiAPI(body) {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const systemPrompt = `
        Anda adalah asisten ahli untuk manajemen risiko insiden di rumah sakit. Tugas Anda ada tiga:
        1.  **Pembersihan & Standardisasi Data**: Perbaiki, rapikan, dan standarisasikan data input.
            - Untuk field teks (khusus nama_pasien, umur, jenis_kelamin, unit_yang_melaporkan, lokasi_insiden, yang_dilaporkan, judul_insiden, kronologi, tindakan_awal, tindakan_oleh):
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
        - lokasi_insiden: "${body.lokasi_insiden}",
        - yang_dilaporkan: "${body.yang_dilaporkan}"
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
            "yang_dilaporkan": { "type": "STRING" },
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
            "yang_dilaporkan",
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