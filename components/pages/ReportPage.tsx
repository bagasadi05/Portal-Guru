import React, { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { generateStudentReport, ReportData } from '../../services/pdfGenerator';
import { Button } from '../ui/Button';
import { PrinterIcon, ArrowLeftIcon, FileTextIcon, GraduationCapIcon } from '../Icons';
import jsPDF from 'jspdf';
import { useToast } from '../../hooks/useToast';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

const fetchReportData = async (studentId: string, userId: string): Promise<ReportData> => {
    const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', userId).single();
    if (studentRes.error) throw new Error(studentRes.error.message);
    const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes] = await Promise.all([
        supabase.from('reports').select('*').eq('student_id', studentId),
        supabase.from('attendance').select('*').eq('student_id', studentId),
        supabase.from('academic_records').select('*').eq('student_id', studentId),
        supabase.from('violations').select('*').eq('student_id', studentId),
        supabase.from('quiz_points').select('*').eq('student_id', studentId)
    ]);
    const errors = [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes].map(r => r.error).filter(Boolean);
    if (errors.length > 0) throw new Error(errors.map(e => e!.message).join(', '));
    return {
        student: studentRes.data as any, reports: reportsRes.data || [], attendanceRecords: attendanceRes.data || [],
        academicRecords: academicRes.data || [], violations: violationsRes.data || [], quizPoints: quizPointsRes.data || []
    };
};

const ReportPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const { user } = useAuth();
    const toast = useToast();
    const [showAllSubjects, setShowAllSubjects] = useState(true);
    const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());

    // FIX: Add generic type to useQuery to ensure 'data' is correctly typed.
    const { data, isLoading, isError, error } = useQuery<ReportData>({
        queryKey: ['reportData', studentId, user?.id],
        queryFn: () => fetchReportData(studentId!, user!.id),
        enabled: !!studentId && !!user,
    });

    const teacherNote = useMemo(() => {
        if (!data) return '';
        return `Ananda ${data.student.name} menunjukkan perkembangan yang baik semester ini. Sikap di kelas sangat positif dan aktif dalam diskusi. Terus tingkatkan semangat belajar dan jangan ragu bertanya jika ada kesulitan.`;
    }, [data]);

    const allSubjects = useMemo(() => {
        if (!data) return [];
        return [...new Set(data.academicRecords.map(r => r.subject || 'Lainnya'))];
    }, [data]);

    useEffect(() => {
        if (allSubjects.length > 0 && selectedSubjects.size === 0) {
            setSelectedSubjects(new Set(allSubjects));
        }
    }, [allSubjects]);

    const toggleSubject = (subject: string) => {
        setSelectedSubjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(subject)) {
                newSet.delete(subject);
            } else {
                newSet.add(subject);
            }
            return newSet;
        });
    };

    const handlePrint = () => {
        if (!data) {
            toast.error("Data laporan tidak tersedia untuk dicetak.");
            return;
        }
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            generateStudentReport(doc, data, teacherNote, user);
            doc.save(`Rapor_${data.student.name}.pdf`);
            toast.success("Rapor berhasil diunduh sebagai PDF!");
        } catch (e: any) {
            toast.error(`Gagal membuat PDF: ${e.message}`);
        }
    };
    
    // FIX: Explicitly typing the accumulator in the reduce function ensures that TypeScript correctly infers the return type, resolving the 'unknown' type error in the map function that consumes this data.
    const academicRecordsBySubject = useMemo((): Record<string, AcademicRecordRow[]> => {
        if (!data) return {};
        const filtered = showAllSubjects
            ? data.academicRecords
            : data.academicRecords.filter(r => selectedSubjects.has(r.subject || 'Lainnya'));

        return filtered.reduce((acc: Record<string, AcademicRecordRow[]>, record: AcademicRecordRow) => {
            const subject = record.subject || 'Lainnya';
            if (!acc[subject]) acc[subject] = [];
            acc[subject].push(record);
            return acc;
        }, {} as Record<string, AcademicRecordRow[]>);
    }, [data, showAllSubjects, selectedSubjects]);
    
    const attendanceSummary = useMemo(() => {
        if (!data) return { Sakit: 0, Izin: 0, Alpha: 0 };
        return data.attendanceRecords.reduce((acc, record) => {
            if (record.status !== 'Hadir') { (acc as any)[record.status] = ((acc as any)[record.status] || 0) + 1; }
            return acc;
        }, { Sakit: 0, Izin: 0, Alpha: 0 });
    }, [data]);


    if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (isError) return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-red-500">Error: {error.message}</div>;
    if (!data) return null;

    return (
        <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 font-serif overflow-hidden">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-3 sm:p-4 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md no-print shadow-lg border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3">
                    <Link to={`/siswa/${studentId}`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeftIcon className="w-4 h-4 mr-1 sm:mr-2"/> Kembali
                        </Button>
                    </Link>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Pratinjau Cetak Rapor</h2>
                    <Button onClick={handlePrint} size="sm" className="bg-purple-600 hover:bg-purple-700">
                        <PrinterIcon className="w-4 h-4 mr-1 sm:mr-2"/> Cetak PDF
                    </Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Filter:</span>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => { setShowAllSubjects(true); setSelectedSubjects(new Set(allSubjects)); }}
                            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full transition-all duration-200 ${showAllSubjects ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Semua
                        </button>
                        <button
                            onClick={() => setShowAllSubjects(false)}
                            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full transition-all duration-200 ${!showAllSubjects ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Pilih ({selectedSubjects.size})
                        </button>
                    </div>
                    {!showAllSubjects && (
                        <div className="flex gap-1 flex-wrap">
                            {allSubjects.map(subject => (
                                <button
                                    key={subject}
                                    onClick={() => toggleSubject(subject)}
                                    className={`px-2 py-0.5 text-xs rounded-full transition-all duration-200 ${selectedSubjects.has(subject) ? 'bg-green-500 text-white shadow-md' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'}`}
                                >
                                    {subject}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 md:px-8 lg:px-12 py-8">
                <div className="flex justify-center">
                    <div id="printable-area" className="w-full max-w-[210mm] p-4 sm:p-8 md:p-[20mm] bg-white dark:bg-gray-800 text-black dark:text-white shadow-2xl rounded-lg mb-8">
                        {/* --- HEADER --- */}
                        <header className="text-center border-b-2 border-black dark:border-gray-600 pb-4 mb-6">
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <GraduationCapIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white"/>
                                </div>
                                <div>
                                    <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">LAPORAN HASIL BELAJAR SISWA</h1>
                                    <h2 className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-1">MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN</h2>
                                </div>
                            </div>
                        </header>

                        {/* --- STUDENT INFO --- */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-750 rounded-lg p-4 mb-6">
                            <table className="text-sm sm:text-base w-full">
                                <tbody>
                                    <tr className="border-b border-gray-200 dark:border-gray-600">
                                        <td className="w-1/3 sm:w-1/4 font-bold py-2 text-gray-700 dark:text-gray-300">Nama Siswa</td>
                                        <td className="py-2 text-gray-900 dark:text-white">: {data.student.name}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-600">
                                        <td className="font-bold py-2 text-gray-700 dark:text-gray-300">Kelas</td>
                                        <td className="py-2 text-gray-900 dark:text-white">: {data.student.classes?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold py-2 text-gray-700 dark:text-gray-300">Tahun Ajaran</td>
                                        <td className="py-2 text-gray-900 dark:text-white">: {new Date().getFullYear()} / {new Date().getFullYear() + 1}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* --- ACADEMICS --- */}
                        <section className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded"></div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">A. Capaian Akademik</h3>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                                <table className="w-full text-xs sm:text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-gray-700 dark:to-gray-750">
                                            <th className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-left font-semibold text-gray-700 dark:text-gray-200">Mata Pelajaran</th>
                                            <th className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-left font-semibold text-gray-700 dark:text-gray-200">Penilaian</th>
                                            <th className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-center font-semibold text-gray-700 dark:text-gray-200">Nilai</th>
                                            <th className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-left font-semibold text-gray-700 dark:text-gray-200">Deskripsi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(academicRecordsBySubject).map(([subject, records]) => (
                                            <React.Fragment key={subject}>
                                                {(records as AcademicRecordRow[]).map((record, index) => {
                                                    const scoreColor = record.score >= 75 ? 'text-green-600 dark:text-green-400' : record.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                                                    return (
                                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                            <td className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 font-medium text-gray-900 dark:text-white">{index === 0 ? subject : ''}</td>
                                                            <td className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-700 dark:text-gray-300">{record.assessment_name || '-'}</td>
                                                            <td className={`border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-center font-bold text-lg ${scoreColor}`}>{record.score}</td>
                                                            <td className="border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{record.notes || 'Sesuai nilai'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    
                        {/* --- BEHAVIOR & ATTENDANCE --- */}
                        <section className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-blue-600 rounded"></div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">B. Absensi & Perilaku</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-gray-700 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
                                    <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-300 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        Ketidakhadiran
                                    </h4>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex justify-between">
                                            <span>Sakit:</span>
                                            <span className="font-semibold">{attendanceSummary.Sakit} hari</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>Izin:</span>
                                            <span className="font-semibold">{attendanceSummary.Izin} hari</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>Tanpa Keterangan:</span>
                                            <span className="font-semibold">{attendanceSummary.Alpha} hari</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-purple-50 dark:bg-gray-700 rounded-lg p-4 border border-purple-200 dark:border-gray-600">
                                    <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-300 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                        Catatan Perilaku
                                    </h4>
                                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                        {(data.violations || []).length > 0
                                            ? (data.violations || []).map(v => <li key={v.id} className="flex items-start gap-2"><span className="text-red-500">•</span><span>{v.description}</span></li>)
                                            : <li className="text-green-600 dark:text-green-400 flex items-center gap-2"><span>✓</span><span>Siswa menunjukkan sikap yang baik.</span></li>
                                        }
                                    </ul>
                                </div>
                            </div>
                        </section>
                    
                        {/* --- TEACHER NOTE --- */}
                        <section className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded"></div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">C. Catatan Wali Kelas</h3>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-700 dark:to-gray-750 rounded-lg p-5 border-l-4 border-amber-500">
                                <p className="text-sm sm:text-base italic text-gray-700 dark:text-gray-300 leading-relaxed">{teacherNote}</p>
                            </div>
                        </section>
                    
                        {/* --- SIGNATURES --- */}
                        <div className="flex justify-between items-start text-sm sm:text-base mt-12 pt-8 border-t border-gray-300 dark:border-gray-600">
                            <div className="text-center">
                                <p className="mb-2 text-gray-700 dark:text-gray-300">Orang Tua/Wali</p>
                                <div className="h-16 sm:h-20"></div>
                                <div className="border-t-2 border-gray-400 dark:border-gray-500 pt-1 px-8">
                                    <p className="text-gray-600 dark:text-gray-400">(___________________)</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="mb-2 text-gray-700 dark:text-gray-300">Madiun, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                <p className="mb-2 text-gray-700 dark:text-gray-300">Wali Kelas</p>
                                <div className="h-16 sm:h-20"></div>
                                <div className="border-t-2 border-gray-400 dark:border-gray-500 pt-1 px-8">
                                    <p className="font-bold text-gray-900 dark:text-white">{user?.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportPage;