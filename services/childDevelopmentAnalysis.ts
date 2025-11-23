import { ai } from './supabase';

export interface ChildDevelopmentData {
  student: {
    name: string;
    age?: number;
    class?: string;
  };
  academicRecords: Array<{
    subject: string;
    score: number;
    assessment_name?: string;
    notes?: string;
  }>;
  attendanceRecords: Array<{
    status: string;
    date: string;
  }>;
  violations: Array<{
    description: string;
    points: number;
    date: string;
  }>;
  quizPoints: Array<{
    activity: string;
    points: number;
    date: string;
  }>;
}

export interface CognitiveDevelopmentAnalysis {
  strengths: string[];
  areasForDevelopment: string[];
  learningStyle: 'Visual' | 'Auditori' | 'Kinestetik' | 'Campuran';
  criticalThinking: string;
  academicComparison: string;
}

export interface AffectiveDevelopmentAnalysis {
  positiveCharacters: string[];
  socialSkills: string;
  characterDevelopmentAreas: string[];
  emotionalIntelligence: string;
  discipline: string;
}

export interface PsychomotorDevelopmentAnalysis {
  motorSkills: string;
  outstandingSkills: string[];
  areasNeedingStimulation: string[];
  coordination: string;
}

export interface ParentRecommendations {
  homeSupport: string[];
  neededStimulation: {
    cognitive: string[];
    affective: string[];
    psychomotor: string[];
  };
  developmentPlan: {
    threeMonths: string[];
    sixMonths: string[];
  };
  warningsSigns: string[];
}

export interface ComprehensiveChildAnalysis {
  summary: {
    name: string;
    age: number;
    class: string;
    overallAssessment: string;
  };
  cognitive: CognitiveDevelopmentAnalysis;
  affective: AffectiveDevelopmentAnalysis;
  psychomotor: PsychomotorDevelopmentAnalysis;
  recommendations: ParentRecommendations;
}

export async function generateComprehensiveChildAnalysis(
  data: ChildDevelopmentData
): Promise<ComprehensiveChildAnalysis> {
  const systemInstruction = `
Anda adalah seorang psikolog anak dan ahli perkembangan anak yang berpengalaman selama 15 tahun.
Tugas Anda adalah menganalisis data perkembangan anak secara holistik berdasarkan tiga domain:
1. Kognitif (Pengetahuan) - kemampuan akademik dan berpikir
2. Afektif (Sikap) - karakter, emosi, dan sosial
3. Psikomotor - kemampuan motorik dan keterampilan fisik

Berikan analisis yang mendalam, empati, dan actionable untuk orang tua.
Gunakan bahasa Indonesia yang mudah dipahami, hindari jargon berlebihan.
Fokus pada solusi praktis dan konkret.
Selalu berikan perspektif positif sambil jujur tentang area yang perlu dikembangkan.
`;

  const averageScore = data.academicRecords.length > 0
    ? Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)
    : 0;

  const subjectScores = data.academicRecords.reduce((acc, record) => {
    if (!acc[record.subject]) {
      acc[record.subject] = [];
    }
    acc[record.subject].push(record.score);
    return acc;
  }, {} as Record<string, number[]>);

  const subjectAverages = Object.entries(subjectScores).map(([subject, scores]) => ({
    subject,
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }));

  const attendanceSummary = {
    total: data.attendanceRecords.length,
    hadir: data.attendanceRecords.filter(r => r.status === 'Hadir').length,
    sakit: data.attendanceRecords.filter(r => r.status === 'Sakit').length,
    izin: data.attendanceRecords.filter(r => r.status === 'Izin').length,
    alpha: data.attendanceRecords.filter(r => r.status === 'Alpha').length
  };

  const attendanceRate = attendanceSummary.total > 0
    ? Math.round((attendanceSummary.hadir / attendanceSummary.total) * 100)
    : 0;

  const violationSummary = {
    total: data.violations.length,
    totalPoints: data.violations.reduce((sum, v) => sum + v.points, 0),
    recent: data.violations.slice(-3)
  };

  const quizSummary = {
    total: data.quizPoints.length,
    totalPoints: data.quizPoints.reduce((sum, q) => sum + q.points, 0),
    averagePerActivity: data.quizPoints.length > 0
      ? Math.round(data.quizPoints.reduce((sum, q) => sum + q.points, 0) / data.quizPoints.length)
      : 0
  };

  const prompt = `
Analisis perkembangan anak dengan data berikut:

**DATA SISWA:**
- Nama: ${data.student.name}
- Usia: ${data.student.age || 'Tidak diketahui'} tahun
- Kelas: ${data.student.class || 'Tidak diketahui'}

**DATA AKADEMIK (KOGNITIF):**
- Jumlah penilaian: ${data.academicRecords.length}
- Rata-rata nilai keseluruhan: ${averageScore}
- Nilai per mata pelajaran:
${subjectAverages.map(s => `  * ${s.subject}: ${s.average}`).join('\n')}
- Detail nilai tertinggi: ${Math.max(...data.academicRecords.map(r => r.score))}
- Detail nilai terendah: ${Math.min(...data.academicRecords.map(r => r.score))}

**DATA KEHADIRAN (AFEKTIF - Disiplin):**
- Total hari sekolah: ${attendanceSummary.total}
- Tingkat kehadiran: ${attendanceRate}%
- Hadir: ${attendanceSummary.hadir} hari
- Sakit: ${attendanceSummary.sakit} hari
- Izin: ${attendanceSummary.izin} hari
- Alpha (tanpa keterangan): ${attendanceSummary.alpha} hari

**DATA PERILAKU (AFEKTIF - Karakter):**
- Jumlah pelanggaran: ${violationSummary.total}
- Total poin pelanggaran: ${violationSummary.totalPoints}
${violationSummary.recent.length > 0 ? `- Pelanggaran terbaru:\n${violationSummary.recent.map(v => `  * ${v.description} (${v.points} poin)`).join('\n')}` : '- Tidak ada pelanggaran tercatat'}

**DATA PARTISIPASI (PSIKOMOTOR & AFEKTIF):**
- Jumlah kegiatan quiz/praktik: ${quizSummary.total}
- Total poin partisipasi: ${quizSummary.totalPoints}
- Rata-rata poin per kegiatan: ${quizSummary.averagePerActivity}

**TUGAS ANALISIS:**

Berikan analisis komprehensif dalam format JSON dengan struktur berikut:

{
  "summary": {
    "name": "${data.student.name}",
    "age": ${data.student.age || 7},
    "class": "${data.student.class || 'SD'}",
    "overallAssessment": "Ringkasan 2-3 kalimat tentang kondisi perkembangan anak secara keseluruhan"
  },
  "cognitive": {
    "strengths": ["3-4 kekuatan kognitif spesifik dengan contoh konkret"],
    "areasForDevelopment": ["2-3 area yang perlu dikembangkan dengan penjelasan"],
    "learningStyle": "Visual/Auditori/Kinestetik/Campuran (pilih yang paling sesuai berdasarkan pola nilai)",
    "criticalThinking": "Evaluasi kemampuan berpikir kritis berdasarkan variasi nilai dan performa",
    "academicComparison": "Perbandingan dengan standar usia dan kelas yang sesuai"
  },
  "affective": {
    "positiveCharacters": ["3-4 karakter positif yang menonjol"],
    "socialSkills": "Deskripsi kemampuan sosial berdasarkan kehadiran dan partisipasi",
    "characterDevelopmentAreas": ["2-3 aspek karakter yang perlu dikembangkan"],
    "emotionalIntelligence": "Evaluasi kecerdasan emosional dari pola perilaku",
    "discipline": "Penilaian kedisiplinan dari data kehadiran dan pelanggaran"
  },
  "psychomotor": {
    "motorSkills": "Deskripsi kondisi kemampuan motorik saat ini (inferensi dari partisipasi praktik)",
    "outstandingSkills": ["2-3 keterampilan psikomotor yang menonjol"],
    "areasNeedingStimulation": ["1-2 area yang perlu stimulasi lebih"],
    "coordination": "Evaluasi koordinasi dari data partisipasi kegiatan"
  },
  "recommendations": {
    "homeSupport": [
      "3-4 aktivitas KONKRET yang bisa dilakukan orang tua di rumah",
      "Contoh: 'Baca bersama 15 menit setiap malam sebelum tidur'",
      "Berikan aktivitas spesifik, bukan saran umum"
    ],
    "neededStimulation": {
      "cognitive": ["Kegiatan spesifik untuk stimulasi kognitif"],
      "affective": ["Kegiatan spesifik untuk pengembangan karakter & sosial"],
      "psychomotor": ["Kegiatan spesifik untuk pengembangan motorik"]
    },
    "developmentPlan": {
      "threeMonths": ["Target dan langkah konkret untuk 3 bulan ke depan"],
      "sixMonths": ["Target dan langkah konkret untuk 6 bulan ke depan"]
    },
    "warningsSigns": [
      "Indikator-indikator yang perlu diperhatikan orang tua",
      "Tanda-tanda yang memerlukan konsultasi lebih lanjut"
    ]
  }
}

**PANDUAN PENULISAN:**
1. Gunakan bahasa yang hangat dan supportif
2. Berikan contoh konkret dan spesifik
3. Hindari label negatif, gunakan bahasa konstruktif
4. Semua rekomendasi harus actionable dan realistis
5. Pertimbangkan konteks usia dan tahap perkembangan
6. Berikan timeline yang jelas untuk setiap rekomendasi
7. Fokus pada potensi dan growth mindset
`;

  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-pro',
      systemInstruction
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const analysis = JSON.parse(text) as ComprehensiveChildAnalysis;

    return analysis;
  } catch (error) {
    console.error('Error generating child development analysis:', error);
    throw new Error('Gagal menghasilkan analisis perkembangan anak. Silakan coba lagi.');
  }
}

export async function generateQuickInsights(
  data: ChildDevelopmentData
): Promise<{
  strengthSummary: string;
  concernSummary: string;
  quickTips: string[];
}> {
  const systemInstruction = `
Anda adalah asisten AI yang memberikan insight cepat tentang perkembangan anak.
Berikan poin-poin singkat dan actionable dalam Bahasa Indonesia.
`;

  const averageScore = data.academicRecords.length > 0
    ? Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)
    : 0;

  const prompt = `
Berikan insight cepat untuk siswa ${data.student.name}:
- Rata-rata nilai: ${averageScore}
- Tingkat kehadiran: ${Math.round((data.attendanceRecords.filter(r => r.status === 'Hadir').length / Math.max(data.attendanceRecords.length, 1)) * 100)}%
- Pelanggaran: ${data.violations.length}

Berikan dalam format JSON:
{
  "strengthSummary": "1 kalimat tentang kekuatan utama",
  "concernSummary": "1 kalimat tentang concern utama (jika ada, atau 'Tidak ada concern khusus')",
  "quickTips": ["3 tips singkat dan actionable untuk orang tua"]
}
`;

  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-pro',
      systemInstruction
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(text);
  } catch (error) {
    console.error('Error generating quick insights:', error);
    return {
      strengthSummary: 'Siswa menunjukkan potensi yang baik',
      concernSummary: 'Tidak ada concern khusus',
      quickTips: [
        'Pertahankan komunikasi terbuka dengan anak',
        'Dukung kegiatan belajar di rumah',
        'Apresiasi setiap kemajuan yang dicapai'
      ]
    };
  }
}
