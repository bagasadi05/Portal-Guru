import React, { useMemo } from 'react';
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
            <div className="fixed top-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md z-10 no-print shadow-md">
                <div className="flex justify-between items-center mb-3">
                    <Link to={`/siswa/${studentId}`}><Button variant="ghost"><ArrowLeftIcon className="w-4 h-4 mr-2"/> Kembali ke Detail Siswa</Button></Link>
                    <h2 className="text-lg font-bold">Pratinjau Cetak Rapor</h2>
                    <Button onClick={handlePrint}><PrinterIcon className="w-4 h-4 mr-2"/> Cetak/Unduh PDF</Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Filter Mata Pelajaran:</span>
                    <button onClick={() => { setShowAllSubjects(true); setSelectedSubjects(new Set(allSubjects)); }} className={`px-3 py-1 rounded-full transition-colors ${showAllSubjects ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Semua</button>
                    <button onClick={() => setShowAllSubjects(false)} className={`px-3 py-1 rounded-full transition-colors ${!showAllSubjects ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Pilih ({selectedSubjects.size})</button>
                    {!showAllSubjects && (
                        <div className="flex gap-1 flex-wrap ml-2">
                            {allSubjects.map(subject => (
                                <button key={subject} onClick={() => toggleSubject(subject)} className={`px-2 py-0.5 text-xs rounded-full transition-colors ${selectedSubjects.has(subject) ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}>{subject}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <main className="pt-24 pb-12 px-4 md:px-8 lg:px-12 flex justify-center">
                <div id="printable-area" className="w-full max-w-[210mm] min-h-[297mm] p-[20mm] bg-white text-black shadow-2xl">
                    {/* --- HEADER --- */}
                    <header className="text-center border-b-2 border-black pb-2 mb-6">
                         <div className="flex justify-center items-center gap-4">
                            <GraduationCapIcon className="w-10 h-10"/>
                            <div>
                                <h1 className="text-xl font-bold">LAPORAN HASIL BELAJAR SISWA</h1>
                                <h2 className="text-sm">MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN</h2>
                            </div>
                         </div>
                    </header>

                    {/* --- STUDENT INFO --- */}
                    <table className="text-sm mb-6 w-full"><tbody>
                        <tr><td className="w-1/4 font-bold">Nama Siswa</td><td>: {data.student.name}</td></tr>
                        <tr><td className="font-bold">Kelas</td><td>: {data.student.classes?.name || 'N/A'}</td></tr>
                        <tr><td className="font-bold">Tahun Ajaran</td><td>: {new Date().getFullYear()} / {new Date().getFullYear() + 1}</td></tr>
                    </tbody></table>

                    {/* --- ACADEMICS --- */}
                    <section className="mb-6">
                        <h3 className="font-bold border-b border-black mb-2">A. Capaian Akademik</h3>
                        <table className="w-full text-xs border-collapse">
                            <thead><tr className="bg-gray-200 text-left"><th className="border p-2">Mata Pelajaran</th><th className="border p-2">Penilaian</th><th className="border p-2">Nilai</th><th className="border p-2">Deskripsi Capaian</th></tr></thead>
                            <tbody>
                                {Object.entries(academicRecordsBySubject).map(([subject, records]) => (
                                    <React.Fragment key={subject}>
                                        {(records as AcademicRecordRow[]).map((record, index) => (
                                            <tr key={record.id}><td className="border p-2">{index === 0 ? subject : ''}</td><td className="border p-2">{record.assessment_name || '-'}</td><td className="border p-2 text-center">{record.score}</td><td className="border p-2">{record.notes || 'Capaian sesuai dengan nilai yang diperoleh.'}</td></tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    
                    {/* --- BEHAVIOR & ATTENDANCE --- */}
                    <section className="mb-6">
                        <h3 className="font-bold border-b border-black mb-2">B. Absensi & Perilaku</h3>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div><h4 className="font-semibold mb-1">Ketidakhadiran</h4><ul><li>Sakit: {attendanceSummary.Sakit} hari</li><li>Izin: {attendanceSummary.Izin} hari</li><li>Tanpa Keterangan: {attendanceSummary.Alpha} hari</li></ul></div>
                            <div><h4 className="font-semibold mb-1">Catatan Perilaku</h4><ul>{(data.violations || []).length > 0 ? (data.violations || []).map(v => <li key={v.id}>- {v.description}</li>) : <li>Siswa menunjukkan sikap yang baik.</li>}</ul></div>
                        </div>
                    </section>
                    
                    {/* --- TEACHER NOTE --- */}
                    <section className="mb-8">
                        <h3 className="font-bold border-b border-black mb-2">C. Catatan Wali Kelas</h3>
                        <p className="text-sm italic p-2 border border-gray-200 rounded">{teacherNote}</p>
                    </section>
                    
                    {/* --- SIGNATURES --- */}
                    <div className="flex justify-between items-start text-sm mt-12">
                        <div className="text-center">Orang Tua/Wali<br/><br/><br/><br/>(___________________)</div>
                        <div className="text-center">
                            Madiun, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Wali Kelas<br/><br/><br/><br/>
                            <span className="font-bold underline">{user?.name}</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportPage;