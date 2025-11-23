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
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen font-serif">
            <div className="fixed top-0 left-0 right-0 p-3 sm:p-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md z-10 no-print shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3">
                    <Link to={`/siswa/${studentId}`}><Button variant="ghost" size="sm"><ArrowLeftIcon className="w-4 h-4 mr-1 sm:mr-2"/> Kembali</Button></Link>
                    <h2 className="text-base sm:text-lg font-bold">Pratinjau Cetak Rapor</h2>
                    <Button onClick={handlePrint} size="sm"><PrinterIcon className="w-4 h-4 mr-1 sm:mr-2"/> Cetak PDF</Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm">
                    <span className="font-medium">Filter:</span>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { setShowAllSubjects(true); setSelectedSubjects(new Set(allSubjects)); }} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full transition-colors ${showAllSubjects ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Semua</button>
                        <button onClick={() => setShowAllSubjects(false)} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full transition-colors ${!showAllSubjects ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Pilih ({selectedSubjects.size})</button>
                    </div>
                    {!showAllSubjects && (
                        <div className="flex gap-1 flex-wrap">
                            {allSubjects.map(subject => (
                                <button key={subject} onClick={() => toggleSubject(subject)} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${selectedSubjects.has(subject) ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'}`}>{subject}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <main className="pt-32 sm:pt-28 pb-12 px-2 sm:px-4 md:px-8 lg:px-12 flex justify-center">
                <div id="printable-area" className="w-full max-w-[210mm] min-h-[297mm] p-4 sm:p-8 md:p-[20mm] bg-white text-black shadow-2xl">
                    {/* --- HEADER --- */}
                    <header className="text-center border-b-2 border-black pb-2 mb-4 sm:mb-6">
                         <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4">
                            <GraduationCapIcon className="w-8 h-8 sm:w-10 sm:h-10"/>
                            <div>
                                <h1 className="text-base sm:text-xl font-bold">LAPORAN HASIL BELAJAR SISWA</h1>
                                <h2 className="text-xs sm:text-sm">MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN</h2>
                            </div>
                         </div>
                    </header>

                    {/* --- STUDENT INFO --- */}
                    <table className="text-xs sm:text-sm mb-4 sm:mb-6 w-full"><tbody>
                        <tr><td className="w-1/3 sm:w-1/4 font-bold py-1">Nama Siswa</td><td className="py-1">: {data.student.name}</td></tr>
                        <tr><td className="font-bold py-1">Kelas</td><td className="py-1">: {data.student.classes?.name || 'N/A'}</td></tr>
                        <tr><td className="font-bold py-1">Tahun Ajaran</td><td className="py-1">: {new Date().getFullYear()} / {new Date().getFullYear() + 1}</td></tr>
                    </tbody></table>

                    {/* --- ACADEMICS --- */}
                    <section className="mb-4 sm:mb-6">
                        <h3 className="text-sm sm:text-base font-bold border-b border-black mb-2">A. Capaian Akademik</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px] sm:text-xs border-collapse">
                                <thead><tr className="bg-gray-200 text-left"><th className="border p-1 sm:p-2">Mata Pelajaran</th><th className="border p-1 sm:p-2">Penilaian</th><th className="border p-1 sm:p-2">Nilai</th><th className="border p-1 sm:p-2">Deskripsi</th></tr></thead>
                                <tbody>
                                    {Object.entries(academicRecordsBySubject).map(([subject, records]) => (
                                        <React.Fragment key={subject}>
                                            {(records as AcademicRecordRow[]).map((record, index) => (
                                                <tr key={record.id}><td className="border p-1 sm:p-2">{index === 0 ? subject : ''}</td><td className="border p-1 sm:p-2">{record.assessment_name || '-'}</td><td className="border p-1 sm:p-2 text-center">{record.score}</td><td className="border p-1 sm:p-2 text-[9px] sm:text-xs">{record.notes || 'Sesuai nilai'}</td></tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    
                    {/* --- BEHAVIOR & ATTENDANCE --- */}
                    <section className="mb-4 sm:mb-6">
                        <h3 className="text-sm sm:text-base font-bold border-b border-black mb-2">B. Absensi & Perilaku</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-[10px] sm:text-xs">
                            <div><h4 className="font-semibold mb-1">Ketidakhadiran</h4><ul className="space-y-0.5"><li>Sakit: {attendanceSummary.Sakit} hari</li><li>Izin: {attendanceSummary.Izin} hari</li><li>Tanpa Keterangan: {attendanceSummary.Alpha} hari</li></ul></div>
                            <div><h4 className="font-semibold mb-1">Catatan Perilaku</h4><ul className="space-y-0.5">{(data.violations || []).length > 0 ? (data.violations || []).map(v => <li key={v.id}>- {v.description}</li>) : <li>Siswa menunjukkan sikap yang baik.</li>}</ul></div>
                        </div>
                    </section>
                    
                    {/* --- TEACHER NOTE --- */}
                    <section className="mb-6 sm:mb-8">
                        <h3 className="text-sm sm:text-base font-bold border-b border-black mb-2">C. Catatan Wali Kelas</h3>
                        <p className="text-xs sm:text-sm italic p-2 border border-gray-200 rounded bg-gray-50">{teacherNote}</p>
                    </section>
                    
                    {/* --- SIGNATURES --- */}
                    <div className="flex justify-between items-start text-xs sm:text-sm mt-8 sm:mt-12">
                        <div className="text-center">
                            <p className="mb-1">Orang Tua/Wali</p>
                            <div className="h-12 sm:h-16"></div>
                            <p>(___________________)</p>
                        </div>
                        <div className="text-center">
                            <p className="mb-1">Madiun, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="mb-1">Wali Kelas</p>
                            <div className="h-12 sm:h-16"></div>
                            <p className="font-bold underline">{user?.name}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportPage;