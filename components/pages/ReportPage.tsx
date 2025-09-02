
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { PrinterIcon, ArrowLeftIcon, BrainCircuitIcon, PlusIcon, TrashIcon, SparklesIcon } from '../Icons';
import { AttendanceStatus } from '../../types';
import { Database } from '../../services/database.types';
import { GoogleGenAI, Type } from '@google/genai';
import jsPDF from 'jspdf';
import { generateStudentReport, ReportData as ReportDataType } from '../../services/pdfGenerator';


type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

type ReportData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    violations: ViolationRow[],
    quizPoints: QuizPointRow[],
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fetchReportData = async (studentId: string | undefined, userId: string): Promise<ReportData> => {
    if (!studentId) throw new Error("Student ID is required.");
    
    const studentRes = await supabase.from('students').select('*').eq('id', studentId).eq('user_id', userId).single();
    if (studentRes.error) throw new Error(studentRes.error.message);
    
    const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes, classRes] = await Promise.all([
        supabase.from('reports').select('*').eq('student_id', studentId),
        supabase.from('attendance').select('*').eq('student_id', studentId),
        supabase.from('academic_records').select('*').eq('student_id', studentId),
        supabase.from('violations').select('*').eq('student_id', studentId),
        supabase.from('quiz_points').select('*').eq('student_id', studentId),
        supabase.from('classes').select('id, name').eq('id', studentRes.data.class_id).single(),
    ]);

    if (reportsRes.error || attendanceRes.error || academicRes.error || violationsRes.error || quizPointsRes.error || classRes.error) {
        throw new Error('Failed to fetch one or more report data components.');
    }

    const studentWithClass: StudentWithClass = {
        ...studentRes.data,
        classes: classRes.data ? { id: classRes.data.id, name: classRes.data.name } : null
    };

    return {
        student: studentWithClass,
        reports: reportsRes.data || [],
        attendanceRecords: attendanceRes.data || [],
        academicRecords: academicRes.data || [],
        violations: violationsRes.data || [],
        quizPoints: quizPointsRes.data || [],
    };
};

const getPredicate = (score: number): { predikat: string; deskripsi: string; } => {
    if (score >= 86) return { predikat: 'A', deskripsi: 'Menunjukkan penguasaan materi yang sangat baik.' };
    if (score >= 76) return { predikat: 'B', deskripsi: 'Menunjukkan penguasaan materi yang baik.' };
    if (score >= 66) return { predikat: 'C', deskripsi: 'Menunjukkan penguasaan materi yang cukup.' };
    return { predikat: 'D', deskripsi: 'Memerlukan bimbingan lebih lanjut.' };
};

const EditableCell: React.FC<{ value: string | number, onChange: (value: string | number) => void, type?: 'text' | 'number' | 'textarea', className?: string, rows?: number }> = ({ value, onChange, type = 'text', className, rows }) => {
    if (type === 'textarea') {
        return (
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-2 bg-transparent focus:bg-yellow-100 dark:focus:bg-yellow-900/50 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm font-serif text-sm resize-none ${className}`}
                rows={rows || 3}
            />
        )
    }
    return (
        <input 
            type={type} 
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={`w-full p-2 bg-transparent focus:bg-yellow-100 dark:focus:bg-yellow-900/50 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm font-serif text-sm ${className}`}
        />
    );
};

const ReportPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();

    const [isGeneratingNote, setIsGeneratingNote] = useState(false);
    const [generatingSubjectNote, setGeneratingSubjectNote] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    const [reportHeader, setReportHeader] = useState({
        title: "LAPORAN HASIL BELAJAR SISWA",
        schoolName: "MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN",
        academicYear: "Tahun Ajaran 2025/2026 - Semester Ganjil"
    });
    const [studentInfo, setStudentInfo] = useState({ name: '', className: '' });
    const [editableAcademicRecords, setEditableAcademicRecords] = useState<any[]>([]);
    const [editableQuizPoints, setEditableQuizPoints] = useState<any[]>([]);
    const [editableViolations, setEditableViolations] = useState<any[]>([]);
    const [editableAttendanceSummary, setEditableAttendanceSummary] = useState({ Sakit: 0, Izin: 0, Alpha: 0 });
    const [behavioralNote, setBehavioralNote] = useState('Tidak ada catatan pelanggaran.');
    const [teacherNote, setTeacherNote] = useState('');

    const { data, isLoading, isError, error } = useQuery<ReportData>({
        queryKey: ['reportData', studentId],
        queryFn: () => fetchReportData(studentId, user!.id),
        enabled: !!studentId && !!user,
    });
    
    const handleGenerateAiNote = async (showToast = true, attendanceSummaryForNote?: typeof editableAttendanceSummary) => {
        const attendanceData = attendanceSummaryForNote || editableAttendanceSummary;
        if (!data) return;
        setIsGeneratingNote(true);
        if (showToast) {
            toast.info("AI sedang merangkum catatan guru...");
        }
        try {
            const systemInstruction = `Anda adalah seorang guru wali kelas yang bijaksana, suportif, dan profesional. Tugas Anda adalah menulis paragraf "Catatan Wali Kelas" untuk rapor siswa. Catatan ini harus komprehensif, merangkum performa siswa secara holistik, dan memberikan motivasi. Tulis dalam satu paragraf yang mengalir (3-5 kalimat). Hindari penggunaan daftar atau poin.`;
            
            const academicSummary = data.academicRecords.length > 0
                ? `Secara akademis, nilai rata-ratanya adalah ${Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)}. Mata pelajaran terkuatnya adalah ${[...data.academicRecords].sort((a, b) => b.score - a.score)[0]?.subject}.`
                : 'Belum ada data nilai akademik yang signifikan.';

            const behaviorSummary = data.violations.length > 0
                ? `Dari segi perilaku, terdapat ${data.violations.length} catatan pelanggaran dengan total ${data.violations.reduce((sum, v) => sum + v.points, 0)} poin.`
                : 'Siswa menunjukkan perilaku yang sangat baik tanpa catatan pelanggaran.';

            const prompt = `Buatkan draf "Catatan Wali Kelas" untuk siswa bernama ${data.student.name}.
            
            Berikut adalah data ringkas sebagai dasar analisis Anda:
            - **Analisis Akademik:** ${academicSummary}
            - **Analisis Perilaku:** ${behaviorSummary}
            - **Kehadiran:** Sakit ${attendanceData.Sakit} hari, Izin ${attendanceData.Izin} hari, Alpha ${attendanceData.Alpha} hari.
            
            Tugas Anda:
            Sintesis semua informasi di atas menjadi satu paragraf catatan wali kelas yang kohesif. Pastikan catatan tersebut mencakup evaluasi umum, menyoroti kekuatan atau area yang perlu ditingkatkan, dan diakhiri dengan kalimat rekomendasi atau motivasi yang positif.
            `;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction }});
            setTeacherNote(response.text.replace(/\\n/g, ' '));
            if (showToast) {
                toast.success("Catatan guru berhasil dibuat oleh AI!");
            }
        } catch (err) {
            toast.error("Gagal membuat catatan guru.");
            console.error(err);
        } finally {
            setIsGeneratingNote(false);
        }
    };
    
    useEffect(() => {
        if (data) {
            setStudentInfo({
                name: data.student.name,
                className: data.student.classes?.name || 'N/A',
            });

            const processedAcademicRecords = data.academicRecords.map(r => ({
                ...r,
                ...getPredicate(r.score),
                deskripsi: getPredicate(r.score).deskripsi // Pastikan deskripsi awal ada
            }));
            setEditableAcademicRecords(processedAcademicRecords);
            
            setEditableQuizPoints(data.quizPoints.sort((a,b) => new Date(a.quiz_date).getTime() - new Date(b.quiz_date).getTime()));

            setEditableViolations(data.violations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            
            const attendanceSum = data.attendanceRecords.reduce((acc, record) => {
                if (record.status !== 'Hadir') {
                    acc[record.status] = (acc[record.status] || 0) + 1;
                }
                return acc;
            }, { Sakit: 0, Izin: 0, Alpha: 0 } as Record<Exclude<AttendanceStatus, 'Hadir'>, number>);
            setEditableAttendanceSummary(attendanceSum);
            
            if (data.violations.length > 0) {
                setBehavioralNote(`Terdapat ${data.violations.length} catatan pelanggaran.`);
            } else {
                setBehavioralNote("Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik dan terpuji selama proses pembelajaran.");
            }
            
            if (teacherNote === '') {
                handleGenerateAiNote(false, attendanceSum);
            }
        }
    }, [data]);
    
    const handleListChange = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, field: string, value: any) => {
        setter(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            if (field === 'score') {
                const predicateInfo = getPredicate(Number(value));
                newList[index] = { ...newList[index], ...predicateInfo };
            }
            return newList;
        });
    };
    
    const handleAddAcademicRecordRow = () => {
        setEditableAcademicRecords(prev => [...prev, {
            id: `new-${Date.now()}`,
            subject: '',
            score: 0,
            predikat: 'D',
            deskripsi: 'Memerlukan bimbingan lebih lanjut.',
        }]);
    };

    const handleRemoveAcademicRecordRow = (index: number) => {
        setEditableAcademicRecords(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddQuizPointRow = () => {
        setEditableQuizPoints(prev => [...prev, {
            id: `new-${Date.now()}`,
            quiz_date: new Date().toISOString().slice(0, 10),
            quiz_name: '',
            subject: '',
        }]);
    };

    const handleRemoveQuizPointRow = (index: number) => {
        setEditableQuizPoints(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddViolationRow = () => {
        setEditableViolations(prev => [...prev, {
            id: `new-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            description: '',
            points: 0,
        }]);
    };

    const handleRemoveViolationRow = (index: number) => {
        setEditableViolations(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerateSubjectNote = async (index: number, subject: string, score: number) => {
        setGeneratingSubjectNote(index);
        try {
            const systemInstruction = `Anda adalah seorang guru yang memberikan deskripsi singkat dan konstruktif untuk rapor siswa berdasarkan nilai yang diperoleh. Deskripsi harus mencerminkan tingkat pemahaman siswa. Berikan dalam satu kalimat.`;
            const prompt = `Buat deskripsi rapor untuk mata pelajaran "${subject}" dengan nilai ${score}.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } });
            
            handleListChange(setEditableAcademicRecords, index, 'deskripsi', response.text);

        } catch (error) {
            toast.error("Gagal membuat deskripsi AI.");
            console.error(error);
        } finally {
            setGeneratingSubjectNote(null);
        }
    };

    const handleExportPdf = () => {
        if (!data || !user) return;
        setIsExporting(true);
        toast.info("Membuat PDF rapor...");
    
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            
            // Construct ReportData from current editable state
            const currentReportData: ReportDataType = {
                student: data.student,
                // Use the editable description as notes for the PDF
                academicRecords: editableAcademicRecords.map(r => ({ ...r, notes: r.deskripsi })),
                quizPoints: editableQuizPoints,
                violations: editableViolations,
                // Attendance is not editable on this page, use original data
                attendanceRecords: data.attendanceRecords,
                // Reports are not directly used in new PDF, but pass them anyway
                reports: data.reports,
            };
    
            generateStudentReport(doc, currentReportData, teacherNote, user);
    
            doc.save(`Rapor_${studentInfo.name.replace(/\s/g, '_')}.pdf`);
            toast.success("Rapor PDF berhasil dibuat!");
        } catch (error: any) {
            toast.error(`Gagal membuat PDF: ${error.message}`);
            console.error(error);
        } finally {
            setIsExporting(false);
        }
    };


    if (isLoading) {
        return <div className="flex items-center justify-center h-screen"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (isError) {
        return <div className="flex items-center justify-center h-screen">Error: {error.message}</div>;
    }

    if (!data) {
        return <div className="flex items-center justify-center h-screen">Tidak ada data untuk ditampilkan.</div>;
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-800 min-h-screen text-black dark:text-gray-200">
            {/* Toolbar */}
            <header className="sticky top-0 z-20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-sm p-4 print:hidden">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeftIcon className="w-4 h-4 mr-2" />Kembali</Button>
                    <div className="flex items-center gap-2">
                         <Button onClick={() => handleGenerateAiNote()} disabled={isGeneratingNote || !data}>
                            <BrainCircuitIcon className="w-4 h-4 mr-2" />
                            {isGeneratingNote ? "Membuat..." : "Buat Catatan AI"}
                        </Button>
                        <Button onClick={handleExportPdf} disabled={isExporting}>
                            <PrinterIcon className="w-4 h-4 mr-2" />
                            {isExporting ? "Mengekspor..." : "Cetak/PDF"}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Report Content */}
            <main className="p-4 md:p-8">
                <div id="report-content" className="max-w-4xl mx-auto bg-white dark:bg-gray-950 p-8 shadow-2xl rounded-lg">
                    {/* Header */}
                    <header className="text-center mb-8 border-b-2 border-black dark:border-gray-600 pb-4">
                        <EditableCell value={reportHeader.title} onChange={val => setReportHeader(p => ({ ...p, title: String(val) }))} className="text-xl font-bold text-center !p-1" />
                        <EditableCell value={reportHeader.schoolName} onChange={val => setReportHeader(p => ({ ...p, schoolName: String(val) }))} className="text-sm text-center !p-1" />
                        <EditableCell value={reportHeader.academicYear} onChange={val => setReportHeader(p => ({ ...p, academicYear: String(val) }))} className="text-sm text-center !p-1" />
                    </header>

                    {/* Student Info */}
                    <section className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8 text-sm">
                        <div className="flex"><strong className="w-24">Nama Siswa</strong>: <EditableCell value={studentInfo.name} onChange={val => setStudentInfo(p => ({ ...p, name: String(val) }))} /></div>
                        <div className="flex"><strong className="w-24">Kelas</strong>: <EditableCell value={studentInfo.className} onChange={val => setStudentInfo(p => ({ ...p, className: String(val) }))} /></div>
                    </section>

                    {/* Academic Records */}
                    <section className="mb-8">
                        <h2 className="text-lg font-bold mb-2">A. Hasil Belajar Akademik</h2>
                        <table className="w-full border-collapse border border-gray-400 dark:border-gray-600">
                           <thead><tr className="bg-gray-200 dark:bg-gray-800 font-bold"><td className="border p-2">No</td><td className="border p-2">Mata Pelajaran</td><td className="border p-2">Nilai Akhir</td><td className="border p-2">Predikat</td><td className="border p-2 w-[40%]">Deskripsi</td><td className="w-10 print:hidden"></td></tr></thead>
                            <tbody>
                                {editableAcademicRecords.map((record, index) => (
                                    <tr key={record.id}><td className="border p-2 text-center">{index + 1}</td>
                                    <td className="border"><EditableCell value={record.subject} onChange={val => handleListChange(setEditableAcademicRecords, index, 'subject', val)} /></td>
                                    <td className="border"><EditableCell type="number" value={record.score} onChange={val => handleListChange(setEditableAcademicRecords, index, 'score', val)} /></td>
                                    <td className="border p-2 text-center">{record.predikat}</td>
                                    <td className="border relative group">
                                        <EditableCell type="textarea" value={record.deskripsi} onChange={val => handleListChange(setEditableAcademicRecords, index, 'deskripsi', val)} rows={3}/>
                                        <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-7 w-7 print:hidden opacity-0 group-hover:opacity-100" onClick={() => handleGenerateSubjectNote(index, record.subject, record.score)} disabled={generatingSubjectNote === index}>{generatingSubjectNote === index ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <SparklesIcon className="w-4 h-4 text-purple-500"/>}</Button>
                                    </td>
                                    <td className="border p-1 text-center print:hidden"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveAcademicRecordRow(index)}><TrashIcon className="w-4 h-4"/></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Button size="sm" variant="outline" onClick={handleAddAcademicRecordRow} className="mt-2 print:hidden"><PlusIcon className="w-4 h-4 mr-2"/>Tambah Baris</Button>
                    </section>
                    
                    <div className="grid grid-cols-2 gap-8 mb-8">
                         <section>
                            <h2 className="text-lg font-bold mb-2">B. Ketidakhadiran</h2>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr><td className="py-1">Sakit</td><td className="py-1">: <EditableCell type="number" value={editableAttendanceSummary.Sakit} onChange={val => setEditableAttendanceSummary(p => ({...p, Sakit: Number(val)}))} className="inline-block w-16 ml-2 text-center"/> hari</td></tr>
                                    <tr><td className="py-1">Izin</td><td className="py-1">: <EditableCell type="number" value={editableAttendanceSummary.Izin} onChange={val => setEditableAttendanceSummary(p => ({...p, Izin: Number(val)}))} className="inline-block w-16 ml-2 text-center"/> hari</td></tr>
                                    <tr><td className="py-1">Tanpa Keterangan</td><td className="py-1">: <EditableCell type="number" value={editableAttendanceSummary.Alpha} onChange={val => setEditableAttendanceSummary(p => ({...p, Alpha: Number(val)}))} className="inline-block w-16 ml-2 text-center"/> hari</td></tr>
                                </tbody>
                            </table>
                        </section>
                        <section>
                            <h2 className="text-lg font-bold mb-2">C. Catatan Perilaku</h2>
                            <EditableCell type="textarea" value={behavioralNote} onChange={(val) => setBehavioralNote(String(val))} rows={4}/>
                        </section>
                    </div>

                    <section className="mb-8">
                        <h2 className="text-lg font-bold mb-2">D. Catatan Wali Kelas</h2>
                        <EditableCell type="textarea" value={teacherNote} onChange={(val) => setTeacherNote(String(val))} rows={5}/>
                    </section>
                    
                     <footer className="pt-16 flex justify-end">
                        <div className="text-center text-sm">
                            <p>Madiun, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p>Wali Kelas,</p>
                            <div className="h-20"></div>
                            <p className="font-bold underline">{user?.name || '___________________'}</p>
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
};

export default ReportPage;