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
    Anda adalah auditor klinis sekaligus ahli manajemen risiko insiden di rumah sakit. 

    Fokus utama Anda: menilai apakah kronologi insiden yang ditulis staf sudah lengkap sesuai standar pelaporan.

    Aturan kelengkapan:
    1. Informasi wajib: "Siapa", "Apa", "Kapan", "Di mana", "Bagaimana".
    2. Informasi Opsional: "Mengapa" (jika tidak ada, tetap dianggap lengkap).

    Output HARUS format JSON:
    {
    "is_lengkap": boolean,
    "evaluasi": string,
    "poin_yang_hilang": string[]
    }

    Instruksi evaluasi:
    - "poin_yang_hilang": tuliskan poin apa saja yang hilang/tidak jelas.
    - "evaluasi": jelaskan informasi yang hilang + alasannya.
    - Jika semua lengkap → evaluasi: "Kronologi insiden lengkap."
    - Informasi opsional "Mengapa" hanya disebutkan bila tersedia, tidak mempengaruhi kelengkapan.
    - Gunakan bahasa yang jelas, profesional, dan tidak menghakimi.
    `;


  const userPrompt = `Tolong validasi kronologi insiden berikut yang dilaporkan oleh seorang perawat:\n"${chronologyText}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    });

    const replyText = completion.choices[0].message.content;

    // Ambil bagian JSON saja
    const jsonMatch = replyText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    // Parsing JSON hasil dari ChatGPT
    const processedData = JSON.parse(jsonMatch[0]);

    // --- Logging penggunaan token ---
    console.log("=== Token Usage ===");
    console.log("Prompt tokens:", completion.usage.prompt_tokens);
    console.log("Completion tokens:", completion.usage.completion_tokens);
    console.log("Total tokens:", completion.usage.total_tokens);

    return { data: processedData, usage: completion.usage };
  } catch (error) {
    console.error("Error during OpenAI API call:", error);
    throw error;
  }
}

export async function callOpenAIAPI(body) {
  const systemPrompt = `
Anda adalah asisten manajemen risiko insiden RS.

Tugas:
1. Rapikan data input:
   - Hilangkan sapaan (contoh: Bapak, Ibu, Kakak, Adik, Saudara, Ny., Tn., dan sejenisnya) serta gelar (contoh: Dr., Prof., Ir., S.Ked., S.T., M.Kes., dan sejenisnya) untuk field (nama_pasien, yang_dilaporkan), lalu format Title Case.
   - Umur → integer.
   - Jenis kelamin → "Laki-laki" / "Perempuan".
   - Rapikan teks lain: kapitalisasi, spasi, ejaan.
2. Tentukan kategori insiden sesuai aturan:
   - Jika insiden **tidak mengenai pasien**:
       • Belum terjadi (hanya potensi) → "KPC"
       • Sudah terjadi tapi berhasil dicegah → "KNC"
   - Jika insiden **mengenai pasien**:
       • Pasien tidak cedera → "KTC"
       • Pasien cedera ringan atau sedang → "KTD"
       • Pasien cedera berat atau meninggal → "Sentinel"

3. Kembalikan JSON:
{
  "nama_pasien": string,
  "umur": integer,
  "jenis_kelamin": "Laki-laki"|"Perempuan",
  "unit_yang_melaporkan": string,
  "lokasi_insiden": string,
  "yang_dilaporkan": string,
  "judul_insiden": string,
  "kronologi": string,
  "tindakan_awal": string,
  "tindakan_oleh": string,
  "kategori": "KTD"|"KPC"|"KNC"|"KTC"|"Sentinel"
}
  `;

  const userPrompt = JSON.stringify(body);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    });

    const replyText = completion.choices[0].message.content;
    // Ambil bagian JSON saja
    const jsonMatch = replyText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const processedData = JSON.parse(jsonMatch[0]);

    console.log("=== Token Usage ===");
    // console.log(completion)
    console.log("Input tokens:", completion.usage.prompt_tokens);
    console.log("Cached Input Tokens:", completion.usage.prompt_tokens_details.cached_tokens || 0);
    console.log("Output tokens:", completion.usage.completion_tokens);
    console.log("Total tokens:", completion.usage.total_tokens);

    return { data: processedData, usage: completion.usage };
  } catch (error) {
    console.error("Error during OpenAI API call:", error);
    throw error;
  }
}
