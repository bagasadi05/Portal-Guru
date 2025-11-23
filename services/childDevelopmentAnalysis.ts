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

function generateFallbackAnalysis(
  data: ChildDevelopmentData,
  averageScore: number,
  attendanceRate: number,
  totalViolations: number
): ComprehensiveChildAnalysis {
  const performanceLevel = averageScore >= 85 ? 'sangat baik' : averageScore >= 75 ? 'baik' : averageScore >= 65 ? 'cukup' : 'perlu peningkatan';
  const attendanceLevel = attendanceRate >= 95 ? 'sangat baik' : attendanceRate >= 85 ? 'baik' : attendanceRate >= 75 ? 'cukup' : 'perlu peningkatan';

  return {
    summary: {
      name: data.student.name,
      age: data.student.age || 7,
      class: data.student.class || 'SD',
      overallAssessment: `${data.student.name} menunjukkan perkembangan yang ${performanceLevel} dengan rata-rata nilai ${averageScore} dan tingkat kehadiran ${attendanceRate}%. ${totalViolations === 0 ? 'Tidak ada catatan pelanggaran yang menunjukkan kedisiplinan yang baik.' : 'Perlu perhatian pada aspek kedisiplinan.'} Terus dukung semangat belajar dan perkembangannya.`
    },
    cognitive: {
      strengths: [
        `Memiliki nilai rata-rata ${averageScore} yang menunjukkan pemahaman yang ${performanceLevel}`,
        averageScore >= 75 ? 'Menunjukkan konsistensi dalam mengikuti pembelajaran dengan baik' : 'Menunjukkan usaha dalam mengikuti pembelajaran',
        'Aktif dalam kegiatan kelas dan partisipasi pembelajaran',
        data.academicRecords.length > 5 ? 'Memiliki catatan penilaian yang lengkap dan konsisten' : 'Terus mengikuti penilaian dengan baik'
      ].slice(0, 4),
      areasForDevelopment: [
        averageScore < 75 ? 'Perlu peningkatan pemahaman konsep di beberapa mata pelajaran' : 'Pertahankan dan tingkatkan prestasi akademik',
        'Latihan soal secara rutin untuk memperkuat pemahaman materi',
        averageScore < 70 ? 'Konsultasi dengan guru untuk strategi belajar yang lebih efektif' : 'Eksplorasi materi tambahan untuk memperdalam pemahaman'
      ].slice(0, 3),
      learningStyle: 'Campuran',
      criticalThinking: averageScore >= 75 ? 'Menunjukkan kemampuan berpikir kritis yang baik dengan pemahaman konsep yang solid' : 'Sedang mengembangkan kemampuan berpikir kritis, perlu latihan lebih banyak',
      academicComparison: averageScore >= 75 ? 'Berada pada atau di atas standar perkembangan anak seusianya' : 'Sedang berupaya mencapai standar perkembangan sesuai usia'
    },
    affective: {
      positiveCharacters: [
        `Memiliki kedisiplinan yang ${attendanceLevel} dengan tingkat kehadiran ${attendanceRate}%`,
        'Menunjukkan tanggung jawab dalam mengikuti kegiatan sekolah',
        totalViolations === 0 ? 'Tidak ada catatan pelanggaran, menunjukkan perilaku yang baik' : 'Terus berusaha memperbaiki perilaku dan sikap',
        attendanceRate >= 90 ? 'Sangat konsisten dalam kehadiran menunjukkan komitmen belajar' : 'Menunjukkan usaha untuk hadir secara teratur'
      ].slice(0, 4),
      socialSkills: 'Menunjukkan kemampuan bersosialisasi yang baik dengan teman sebaya dan aktif dalam kegiatan kelompok',
      characterDevelopmentAreas: [
        totalViolations > 0 ? 'Perlu bimbingan lebih dalam memahami dan mematuhi tata tertib sekolah' : 'Terus kembangkan sikap empati dan kerja sama tim',
        'Latih kemampuan komunikasi dan leadership dalam kegiatan kelompok',
        attendanceRate < 85 ? 'Tingkatkan kedisiplinan dan konsistensi kehadiran' : 'Kembangkan inisiatif dan kemandirian dalam belajar'
      ].slice(0, 3),
      emotionalIntelligence: 'Mampu mengatur emosi dengan baik sesuai usia dan menunjukkan empati terhadap teman',
      discipline: attendanceRate >= 95 ? 'Sangat baik' : attendanceRate >= 85 ? 'Baik' : attendanceRate >= 75 ? 'Cukup' : 'Perlu peningkatan'
    },
    psychomotor: {
      motorSkills: 'Perkembangan motorik sesuai dengan usia dan tahap perkembangan anak',
      outstandingSkills: [
        'Aktif dalam kegiatan praktik dan pembelajaran hands-on',
        'Menunjukkan koordinasi mata-tangan yang baik',
        'Mampu mengikuti instruksi aktivitas fisik dengan baik'
      ],
      areasNeedingStimulation: [
        'Tingkatkan aktivitas fisik dan olahraga untuk pengembangan motorik kasar',
        'Latihan keterampilan motorik halus melalui aktivitas seni dan kerajinan'
      ],
      coordination: 'Koordinasi motorik berkembang dengan baik sesuai tahap perkembangan'
    },
    recommendations: {
      homeSupport: [
        'Dampingi anak belajar 30-45 menit setiap hari setelah pulang sekolah dengan suasana yang kondusif',
        'Baca buku cerita atau artikel bersama 15-20 menit sebelum tidur untuk meningkatkan literasi',
        'Diskusikan kegiatan sekolah hari ini dan apresiasi usaha serta pencapaiannya',
        'Buat jadwal belajar yang konsisten dan pastikan waktu istirahat yang cukup'
      ],
      neededStimulation: {
        cognitive: [
          'Berikan puzzle, permainan strategi, dan permainan edukatif sesuai usia',
          'Ajak anak berdiskusi tentang hal-hal di sekitar dan dorong rasa ingin tahunya',
          'Latihan soal matematika dan membaca 15-30 menit setiap hari',
          averageScore < 75 ? 'Fokus pada mata pelajaran yang masih perlu peningkatan dengan pendekatan yang menyenangkan' : 'Berikan tantangan baru untuk meningkatkan kemampuan berpikir kritis'
        ],
        affective: [
          'Ajarkan anak berbagi dan berempati melalui kegiatan bersama saudara/teman',
          'Libatkan dalam kegiatan sosial keluarga dan komunitas',
          'Berikan tanggung jawab kecil di rumah seperti merapikan mainan atau membantu pekerjaan ringan',
          'Diskusikan nilai-nilai moral melalui cerita dan pengalaman sehari-hari'
        ],
        psychomotor: [
          'Olahraga atau aktivitas fisik minimal 3-4 kali seminggu (bersepeda, berenang, bermain bola)',
          'Aktivitas seni seperti menggambar, mewarnai, atau membuat kerajinan tangan',
          'Bermain di luar rumah untuk melatih motorik kasar dan eksplorasi lingkungan',
          'Latihan keterampilan sehari-hari seperti mengikat tali sepatu, mengancingkan baju'
        ]
      },
      developmentPlan: {
        threeMonths: [
          averageScore < 75 ? 'Target peningkatan nilai rata-rata menjadi minimal 75' : 'Target mempertahankan nilai di atas 75 dan meningkatkan 5 poin',
          attendanceRate < 90 ? 'Konsistensi kehadiran minimal 90%' : 'Pertahankan kehadiran di atas 90%',
          'Rutinitas belajar teratur 30 menit setiap hari dengan pendampingan',
          'Mengurangi atau menghilangkan pelanggaran kedisiplinan'
        ],
        sixMonths: [
          'Pencapaian nilai minimal 75 di semua mata pelajaran dengan konsistensi',
          'Kemampuan belajar mandiri meningkat dengan pengawasan minimal',
          'Partisipasi aktif dalam minimal 1 kegiatan ekstrakurikuler',
          'Perkembangan sosial dan karakter yang positif terlihat dari interaksi sehari-hari'
        ]
      },
      warningsSigns: [
        'Penurunan motivasi belajar yang drastis atau menunjukkan keengganan pergi sekolah',
        'Perubahan perilaku atau mood yang signifikan dalam waktu singkat',
        'Kesulitan berkonsentrasi dalam waktu lama atau mudah terdistraksi',
        'Keluhan fisik berulang tanpa sebab medis jelas (sakit kepala, sakit perut)',
        'Masalah tidur atau perubahan pola makan yang signifikan',
        'Penurunan nilai akademik yang konsisten dalam beberapa minggu berturut-turut',
        'Konflik berulang dengan teman atau guru di sekolah'
      ]
    }
  };
}

export async function generateComprehensiveChildAnalysis(
  data: ChildDevelopmentData
): Promise<ComprehensiveChildAnalysis> {
  try {
    // Validate data
    if (!data || !data.student?.name) {
      throw new Error('Data siswa tidak lengkap');
    }

    // Sanitize data
    const validAcademicRecords = (data.academicRecords || []).filter(r => r && typeof r.score === 'number');
    const validAttendanceRecords = (data.attendanceRecords || []).filter(r => r && r.status);
    const validViolations = (data.violations || []).filter(v => v && v.description);
    const validQuizPoints = (data.quizPoints || []).filter(q => q && q.activity);

    // Calculate statistics
    const averageScore = validAcademicRecords.length > 0
      ? Math.round(validAcademicRecords.reduce((sum, r) => sum + r.score, 0) / validAcademicRecords.length)
      : 0;

    const subjectScores = validAcademicRecords.reduce((acc, record) => {
      const subject = record.subject || 'Lainnya';
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(record.score);
      return acc;
    }, {} as Record<string, number[]>);

    const subjectAverages = Object.entries(subjectScores).map(([subject, scores]) => ({
      subject,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }));

    const attendanceSummary = {
      total: validAttendanceRecords.length,
      hadir: validAttendanceRecords.filter(r => r.status === 'Hadir').length,
      sakit: validAttendanceRecords.filter(r => r.status === 'Sakit').length,
      izin: validAttendanceRecords.filter(r => r.status === 'Izin').length,
      alpha: validAttendanceRecords.filter(r => r.status === 'Alpha').length
    };

    const attendanceRate = attendanceSummary.total > 0
      ? Math.round((attendanceSummary.hadir / attendanceSummary.total) * 100)
      : 100;

    const violationSummary = {
      total: validViolations.length,
      totalPoints: validViolations.reduce((sum, v) => sum + (v.points || 0), 0),
      recent: validViolations.slice(-3)
    };

    // Check if AI is available
    if (!ai) {
      console.warn('AI service not available, using fallback analysis');
      return generateFallbackAnalysis(data, averageScore, attendanceRate, violationSummary.total);
    }

    // Build prompt
    const systemInstruction = `Anda adalah seorang psikolog anak dan ahli perkembangan anak yang berpengalaman. Analisis data perkembangan anak secara holistik berdasarkan domain Kognitif, Afektif, dan Psikomotor. Berikan analisis yang mendalam, empati, dan actionable dalam Bahasa Indonesia yang mudah dipahami.`;

    const prompt = `Analisis perkembangan anak dengan data berikut:

SISWA: ${data.student.name}, Usia: ${data.student.age || 7} tahun, Kelas: ${data.student.class || 'SD'}

AKADEMIK:
- Jumlah penilaian: ${validAcademicRecords.length}
- Rata-rata nilai: ${averageScore}
- Nilai per mapel: ${subjectAverages.length > 0 ? subjectAverages.map(s => `${s.subject} (${s.average})`).join(', ') : 'Belum ada data'}
- Tertinggi: ${validAcademicRecords.length > 0 ? Math.max(...validAcademicRecords.map(r => r.score)) : 0}
- Terendah: ${validAcademicRecords.length > 0 ? Math.min(...validAcademicRecords.map(r => r.score)) : 0}

KEHADIRAN: ${attendanceRate}% (${attendanceSummary.hadir}/${attendanceSummary.total} hari)

PERILAKU: ${violationSummary.total} pelanggaran (${violationSummary.totalPoints} poin)

PARTISIPASI: ${validQuizPoints.length} kegiatan

Berikan analisis dalam format JSON dengan struktur:
{"summary":{"name":"","age":0,"class":"","overallAssessment":""},"cognitive":{"strengths":[],"areasForDevelopment":[],"learningStyle":"","criticalThinking":"","academicComparison":""},"affective":{"positiveCharacters":[],"socialSkills":"","characterDevelopmentAreas":[],"emotionalIntelligence":"","discipline":""},"psychomotor":{"motorSkills":"","outstandingSkills":[],"areasNeedingStimulation":[],"coordination":""},"recommendations":{"homeSupport":[],"neededStimulation":{"cognitive":[],"affective":[],"psychomotor":[]},"developmentPlan":{"threeMonths":[],"sixMonths":[]},"warningsSigns":[]}}`;

    // Call AI
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Parse response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const analysis = JSON.parse(text) as ComprehensiveChildAnalysis;

    return analysis;

  } catch (error: any) {
    console.error('Error generating child development analysis:', error);
    console.error('Error details:', error.message);

    // Use fallback analysis
    const validAcademicRecords = (data.academicRecords || []).filter(r => r && typeof r.score === 'number');
    const validAttendanceRecords = (data.attendanceRecords || []).filter(r => r && r.status);
    const validViolations = (data.violations || []).filter(v => v && v.description);

    const averageScore = validAcademicRecords.length > 0
      ? Math.round(validAcademicRecords.reduce((sum, r) => sum + r.score, 0) / validAcademicRecords.length)
      : 0;

    const attendanceRate = validAttendanceRecords.length > 0
      ? Math.round((validAttendanceRecords.filter(r => r.status === 'Hadir').length / validAttendanceRecords.length) * 100)
      : 100;

    return generateFallbackAnalysis(data, averageScore, attendanceRate, validViolations.length);
  }
}

export async function generateQuickInsights(
  data: ChildDevelopmentData
): Promise<{
  strengthSummary: string;
  concernSummary: string;
  quickTips: string[];
}> {
  try {
    const validAcademicRecords = (data.academicRecords || []).filter(r => r && typeof r.score === 'number');
    const validAttendanceRecords = (data.attendanceRecords || []).filter(r => r && r.status);
    const validViolations = (data.violations || []).filter(v => v && v.description);

    const averageScore = validAcademicRecords.length > 0
      ? Math.round(validAcademicRecords.reduce((sum, r) => sum + r.score, 0) / validAcademicRecords.length)
      : 0;

    const attendanceRate = validAttendanceRecords.length > 0
      ? Math.round((validAttendanceRecords.filter(r => r.status === 'Hadir').length / validAttendanceRecords.length) * 100)
      : 100;

    return {
      strengthSummary: averageScore >= 75 ? 'Siswa menunjukkan prestasi akademik yang baik' : 'Siswa menunjukkan usaha dalam belajar',
      concernSummary: validViolations.length > 3 ? 'Perlu perhatian pada aspek kedisiplinan' : 'Tidak ada concern khusus',
      quickTips: [
        'Pertahankan komunikasi terbuka dengan anak setiap hari',
        'Dukung kegiatan belajar di rumah dengan jadwal teratur',
        'Apresiasi setiap usaha dan kemajuan yang dicapai'
      ]
    };
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
