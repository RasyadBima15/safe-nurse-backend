import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'
import { generateKodeLaporan } from '../../utils/generateKodeLaporan.js';
import { hitungSkor } from '../../utils/scoring.js';
import { requiredFieldsForConfirmation, requiredFieldsForAI } from '../../utils/requiredFields.js';
import { callGeminiAPI } from '../../config/callGeminiAPI.js';
import { nanoid } from 'nanoid';

export async function getAllLaporan(req, res) {
    try {
        const { data, error } = await supabase
            .from("laporan")
            .select("*")
            .order("tgl_waktu_pelaporan", { ascending: false });
        if (error) {
            throw new Error(`Gagal mengambil data laporan: ${error.message}`);
        }

        const laporanWithNames = await Promise.all(data.map(async (laporan) => {
            const { data: perawatData, error: perawatError } = await supabase
                .from("perawat")
                .select("nama_perawat")
                .eq("id_perawat", laporan.id_perawat)
                .maybeSingle();
            if (perawatError) {
                throw new Error(`Gagal cek perawat: ${perawatError.message}`);
            }
            if (!perawatData) {
                return res.status(404).json({ message: "Perawat dengan ID tersebut tidak ditemukan" });
            }
            const { data: ruanganData, error: ruanganError } = await supabase
                .from("ruangan")
                .select("nama_ruangan")
                .eq("id_ruangan", laporan.id_ruangan)
                .maybeSingle();
            if (ruanganError) {
                throw new Error(`Gagal cek ruangan: ${ruanganError.message}`);
            }
            if (!ruanganData) {
                return res.status(404).json({ message: "Ruangan dengan ID tersebut tidak ditemukan" });
            }
            return {
                ...laporan,
                nama_perawat: perawatData ? perawatData.nama_perawat : null,
                nama_ruangan: ruanganData ? ruanganData.nama_ruangan : null
            };
        }));

        return res.status(200).json({
            message: "Data laporan berhasil diambil.",
            data: laporanWithNames
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getLaporanByIdPerawat(req, res) {
    try {
        const { id_perawat } = req.query;

        if (!id_perawat) {
            return res.status(400).json({ message: "ID Perawat wajib diisi" });
        }

        const { data: perawatExists, error: perawatError } = await supabase
            .from("perawat")
            .select("id_perawat, nama_perawat, id_ruangan")
            .eq("id_perawat", id_perawat)
            .maybeSingle();
        if (perawatError) {
            throw new Error(`Gagal cek perawat: ${perawatError.message}`);
        }
        if (!perawatExists) {
            return res.status(404).json({ message: "Perawat dengan ID tersebut tidak ditemukan" });
        }

        const { data, error } = await supabase
            .from("laporan")
            .select("*")
            .eq("id_perawat", id_perawat)
            .order("tgl_waktu_pelaporan", { ascending: false });

        if (error) {
            throw new Error(`Gagal mengambil data laporan: ${error.message}`);
        }

        const { data: ruanganData, error: ruanganError } = await supabase
            .from("ruangan")
            .select("nama_ruangan")
            .eq("id_ruangan", perawatExists.id_ruangan)
            .maybeSingle();
        if (ruanganError) {
            throw new Error(`Gagal cek ruangan: ${ruanganError.message}`);
        }  
        if (!ruanganData) {
            return res.status(404).json({ message: "Ruangan dengan ID tersebut tidak ditemukan" });
        }

        const laporanWithNames = data.map(laporan => ({
            ...laporan,
            nama_perawat: perawatExists.nama_perawat,
            nama_ruangan: ruanganData.nama_ruangan
        }));

        return res.status(200).json({
            message: "Data laporan berhasil diambil.",
            data: laporanWithNames
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getLaporanByIdRuangan(req, res) {
    try {
        const { id_ruangan } = req.query;
        if (!id_ruangan) {
            return res.status(400).json({ message: "ID Ruangan wajib diisi" });
        }
        const { data: ruanganExists, error: ruanganError } = await supabase
            .from("ruangan")
            .select("id_ruangan, nama_ruangan")
            .eq("id_ruangan", id_ruangan)
            .maybeSingle();
        if (ruanganError) {
            throw new Error(`Gagal cek ruangan: ${ruanganError.message}`);
        }
        if (!ruanganExists) {
            return res.status(404).json({ message: "Ruangan dengan ID tersebut tidak ditemukan" });
        }
        const { data, error } = await supabase
            .from("laporan")
            .select("*")
            .eq("id_ruangan", id_ruangan)
            .order("tgl_waktu_pelaporan", { ascending: false });
        if (error) {
            throw new Error(`Gagal mengambil data laporan: ${error.message}`);
        }
        const laporanWithNames = await Promise.all(data.map(async (laporan) => {
            const { data: perawatData, error: perawatError } = await supabase
                .from("perawat")
                .select("nama_perawat")
                .eq("id_perawat", laporan.id_perawat)
                .maybeSingle();
            if (perawatError) {
                throw new Error(`Gagal cek perawat: ${perawatError.message}`);
            }
            if (!perawatData) {
                return res.status(404).json({ message: "Perawat dengan ID tersebut tidak ditemukan" });
            }
            return {
                ...laporan,
                nama_perawat: perawatData.nama_perawat,
                nama_ruangan: ruanganExists.nama_ruangan
            };
        }));
        return res.status(200).json({
            message: "Data laporan berhasil diambil.",
            data: laporanWithNames
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

        // console.log("Data berhasil diolah oleh AI:", cleanedData);

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
            .select("id_perawat, id_user")
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
            },
        ])
        .select();

        if (error) {
            // logger.info("❌ Error saat insert laporan:", error);
            return res.status(500).json({ error: error.message });
        }

        const id_notifikasi = nanoid();
        const message = `Laporan dengan kode laporan ${kode_laporan} sudah diterima dan sedang ditindak lanjuti oleh validator`;

        const { error: notifError } = await supabase.from("notifikasi").insert([
        {
            id_notifikasi,
            id_user: userExists.id_user,
            message
        },
        ]);

        if (notifError) {
        return res.status(500).json({ error: notifError.message });
        }

        // logger.info("✅ Laporan berhasil dibuat");
        res.status(200).json({ message: "Laporan generated successfully", data: data[0] });
    } catch (error) {
        // logger.info("🔥 Unexpected error in generateLaporan:", error);
        res.status(500).json({ error: error.message });
    }
}
