import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import {
  BrainCircuitIcon,
  SparklesIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  UsersIcon,
  ShieldPlusIcon,
  CheckSquareIcon,
  CalendarIcon
} from '../Icons';
import { useToast } from '../../hooks/useToast';
import {
  generateComprehensiveChildAnalysis,
  ComprehensiveChildAnalysis,
  ChildDevelopmentData
} from '../../services/childDevelopmentAnalysis';

interface ChildDevelopmentAnalysisTabProps {
  studentData: ChildDevelopmentData;
}

export const ChildDevelopmentAnalysisTab: React.FC<ChildDevelopmentAnalysisTabProps> = ({
  studentData
}) => {
  const [analysis, setAnalysis] = useState<ComprehensiveChildAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleGenerateAnalysis = async () => {
    setIsLoading(true);
    try {
      const result = await generateComprehensiveChildAnalysis(studentData);
      setAnalysis(result);
      toast.success('Analisis perkembangan anak berhasil dibuat!');
    } catch (error) {
      toast.error('Gagal membuat analisis. Silakan coba lagi.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-full p-6 mb-6">
          <BrainCircuitIcon className="w-16 h-16 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Analisis Perkembangan Anak
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
          Dapatkan analisis komprehensif tentang perkembangan kognitif, afektif, dan psikomotor anak Anda dengan bantuan AI.
        </p>
        <Button
          onClick={handleGenerateAnalysis}
          disabled={isLoading}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Menganalisis...
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              Generate Analisis Lengkap
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Summary */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-full p-3">
                <BrainCircuitIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Ringkasan Perkembangan Anak</CardTitle>
                <CardDescription className="mt-1">
                  {analysis.summary.name} • {analysis.summary.age} Tahun • Kelas {analysis.summary.class}
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleGenerateAnalysis}
              disabled={isLoading}
              variant="ghost"
              size="sm"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            {analysis.summary.overallAssessment}
          </p>
        </CardContent>
      </Card>

      {/* A. Cognitive Development */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg p-2">
              <BookOpenIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>A. Analisis Perkembangan Kognitif (Pengetahuan)</CardTitle>
              <CardDescription>Kemampuan akademik dan berpikir</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Strengths */}
          <div>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              Kekuatan
            </h4>
            <ul className="space-y-2">
              {analysis.cognitive.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-green-500 mt-1">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Development */}
          <div>
            <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5" />
              Area yang Perlu Dikembangkan
            </h4>
            <ul className="space-y-2">
              {analysis.cognitive.areasForDevelopment.map((area, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Gaya Belajar Dominan</h5>
              <p className="text-gray-700 dark:text-gray-300">{analysis.cognitive.learningStyle}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <h5 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Kemampuan Berpikir Kritis</h5>
              <p className="text-gray-700 dark:text-gray-300">{analysis.cognitive.criticalThinking}</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Perbandingan dengan Standar Usia</h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.cognitive.academicComparison}</p>
          </div>
        </CardContent>
      </Card>

      {/* B. Affective Development */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg p-2">
              <UsersIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>B. Analisis Perkembangan Afektif (Sikap)</CardTitle>
              <CardDescription>Karakter, emosi, dan kemampuan sosial</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Positive Characters */}
          <div>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              Karakter Positif yang Menonjol
            </h4>
            <ul className="space-y-2">
              {analysis.affective.positiveCharacters.map((character, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>{character}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Skills */}
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
            <h5 className="font-semibold text-pink-900 dark:text-pink-300 mb-2 flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              Kemampuan Sosial
            </h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.affective.socialSkills}</p>
          </div>

          {/* Emotional Intelligence */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h5 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Kecerdasan Emosional</h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.affective.emotionalIntelligence}</p>
          </div>

          {/* Discipline */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Kedisiplinan</h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.affective.discipline}</p>
          </div>

          {/* Character Development Areas */}
          <div>
            <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5" />
              Area Pengembangan Karakter
            </h4>
            <ul className="space-y-2">
              {analysis.affective.characterDevelopmentAreas.map((area, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-amber-500 mt-1">→</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* C. Psychomotor Development */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-2">
              <CheckSquareIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>C. Analisis Perkembangan Psikomotor</CardTitle>
              <CardDescription>Kemampuan motorik dan keterampilan fisik</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Motor Skills */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h5 className="font-semibold text-green-900 dark:text-green-300 mb-2">Kemampuan Motorik</h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.psychomotor.motorSkills}</p>
          </div>

          {/* Coordination */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Koordinasi</h5>
            <p className="text-gray-700 dark:text-gray-300">{analysis.psychomotor.coordination}</p>
          </div>

          {/* Outstanding Skills */}
          <div>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              Keterampilan yang Menonjol
            </h4>
            <ul className="space-y-2">
              {analysis.psychomotor.outstandingSkills.map((skill, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-green-500 mt-1">★</span>
                  <span>{skill}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas Needing Stimulation */}
          <div>
            <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5" />
              Area yang Perlu Stimulasi
            </h4>
            <ul className="space-y-2">
              {analysis.psychomotor.areasNeedingStimulation.map((area, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="text-amber-500 mt-1">►</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* D. Recommendations for Parents */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-2">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>D. Rekomendasi untuk Orang Tua</CardTitle>
              <CardDescription>Panduan praktis untuk mendukung perkembangan anak</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Home Support */}
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              1. Dukungan di Rumah
            </h4>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <ul className="space-y-3">
                {analysis.recommendations.homeSupport.map((support, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <span className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-semibold mt-0.5">
                      {index + 1}
                    </span>
                    <span>{support}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Needed Stimulation */}
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              2. Stimulasi yang Dibutuhkan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cognitive */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <BookOpenIcon className="w-4 h-4" />
                  Kognitif
                </h5>
                <ul className="space-y-2 text-sm">
                  {analysis.recommendations.neededStimulation.cognitive.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-blue-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Affective */}
              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
                <h5 className="font-semibold text-pink-900 dark:text-pink-300 mb-3 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  Afektif
                </h5>
                <ul className="space-y-2 text-sm">
                  {analysis.recommendations.neededStimulation.affective.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-pink-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Psychomotor */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h5 className="font-semibold text-green-900 dark:text-green-300 mb-3 flex items-center gap-2">
                  <CheckSquareIcon className="w-4 h-4" />
                  Psikomotor
                </h5>
                <ul className="space-y-2 text-sm">
                  {analysis.recommendations.neededStimulation.psychomotor.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-green-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Development Plan */}
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              3. Rencana Pengembangan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 3 Months */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-amber-500">
                <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Target 3 Bulan</h5>
                <ul className="space-y-2 text-sm">
                  {analysis.recommendations.developmentPlan.threeMonths.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-amber-500">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6 Months */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
                <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Target 6 Bulan</h5>
                <ul className="space-y-2 text-sm">
                  {analysis.recommendations.developmentPlan.sixMonths.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-orange-500">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Warning Signs */}
          <div>
            <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
              <AlertCircleIcon className="w-5 h-5" />
              4. Tanda-tanda yang Perlu Diperhatikan
            </h4>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <ul className="space-y-2">
                {analysis.recommendations.warningsSigns.map((sign, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <AlertCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{sign}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-4">
          <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2 flex-shrink-0">
            <AlertCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Catatan Penting</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Analisis ini dibuat berdasarkan data akademik dan perilaku yang tersedia.
              Setiap anak berkembang dengan kecepatan yang berbeda. Jika Anda memiliki kekhawatiran khusus
              tentang perkembangan anak, konsultasikan dengan guru, psikolog anak, atau ahli perkembangan anak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
