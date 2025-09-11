import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'
import { generateKodeLaporan, requiredFieldsForConfirmation, requiredFieldsForAI, hitungSkor} from '../../utils/util.js';
import fetch from 'node-fetch';

async function callGeminiAPI(body) {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `
        Anda adalah asisten ahli untuk manajemen risiko insiden di rumah sakit. Tugas Anda ada tiga:
        1.  **Pembersihan & Standardisasi Data**: Perbaiki, rapikan, dan standarisasikan data input.
            - Untuk semua field teks (seperti nama_pasien, unit_yang_melaporkan, lokasi_insiden, judul_insiden, kronologi, tindakan_awal, tindakan_oleh): perbaiki kesalahan ejaan, tata bahasa, spasi berlebih, dan gunakan huruf kapital yang sesuai untuk menghasilkan teks yang profesional dan jelas.
            - Untuk 'umur': konversi teks menjadi angka integer (contoh: 'enampuluh dua' menjadi 62).
            - Untuk 'jenis_kelamin': standarisasikan menjadi 'Laki-laki' atau 'Perempuan'.
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


export async function cleanLaporanUsingLLM(req, res) {
    try {
        const body = req.body;
        const missingFields = requiredFieldsForAI.filter((field) => !body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Field berikut wajib diisi: ${missingFields.join(", ")}`,
            });
        }

        const { data: cleanedData, usage } = await callGeminiAPI(body);

        console.log("Data berhasil diolah oleh AI:", cleanedData);

        if (usage && usage.promptTokenCount) {
            console.log(`Monitoring Penggunaan Token: ${usage.promptTokenCount} token digunakan untuk input.`);
        }

        const finalReport = {
            ...body,
            ...cleanedData,
        };

        res.status(200).json({
            message: "Laporan berhasil dianalisis dan diformat oleh AI.",
            data: finalReport,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


export async function generateLaporan(req, res) {
    try {
        const body = req.body;
        // logger.info("▶️ generateLaporan called with body");

        const missingFields = requiredFieldsForConfirmation.filter((field) => !body[field]);
        if (missingFields.length > 0) {
            // logger.info("❌ Missing fields detected:", missingFields);
            return res.status(400).json({
                error: `Field berikut wajib diisi: ${missingFields.join(", ")}`,
            });
        }
        // logger.info("✅ Semua field terisi semua");

        const { data: userExists, error: userError } = await supabase
            .from("perawat")
            .select("id_perawat")
            .eq("id_perawat", body.id_perawat)
            .maybeSingle();

        if (userError || !userExists) {
            // logger.info("❌ id_perawat tidak valid:", { userError, userExists });
            return res.status(400).json({ error: "id_perawat tidak valid / tidak ditemukan" });
        }
        // logger.info("✅ id_perawat valid");

        const { data: ruanganExists, error: ruanganError } = await supabase
            .from("ruangan")
            .select("id_ruangan")
            .eq("id_ruangan", body.id_ruangan)
            .maybeSingle();

        if (ruanganError || !ruanganExists) {
            // logger.info("❌ id_ruangan tidak valid:", { ruanganError, ruanganExists });
            return res.status(400).json({ error: "id_ruangan tidak valid / tidak ditemukan" });
        }
        // logger.info("✅ id ruangan valid");

        const kode_laporan = generateKodeLaporan();
        // logger.info("📄 Berhasil generate kode_laporan");

        const { skor_dampak, skor_probabilitas, skor_grading, grading } = hitungSkor(
            body.dampak,
            body.probabilitas
        );
        // logger.info("📊 Berhasil menghitung skor");

        // const { data, error } = await supabase.from("laporan").insert([
        //     {
        //         kode_laporan,
        //         ...body,
        //         skor_dampak,
        //         skor_probabilitas,
        //         skor_grading,
        //         grading,
        //         status: "diteruskan ke validator",
        //     },
        // ]);

        const { data, error } = await supabase
        .from("laporan")
        .insert([
            {
            kode_laporan,
            ...body,
            skor_dampak,
            skor_probabilitas,
            skor_grading,
            grading,
            status: "diteruskan ke validator",
            },
        ])
        .select();

        if (error) {
            // logger.info("❌ Error saat insert laporan:", error);
            return res.status(500).json({ error: error.message });
        }

        // logger.info("✅ Laporan berhasil dibuat");
        res.status(200).json({ message: "Laporan generated successfully", data: data[0] });
    } catch (error) {
        // logger.info("🔥 Unexpected error in generateLaporan:", error);
        res.status(500).json({ error: error.message });
    }
}
