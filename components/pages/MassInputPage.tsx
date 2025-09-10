import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { ClipboardPenIcon, GraduationCapIcon, PrinterIcon, ShieldAlertIcon, CheckSquareIcon, ArrowLeftIcon, ClipboardPasteIcon, SparklesIcon, FileTextIcon, SearchIcon, XCircleIcon } from '../Icons';
import { violationList } from '../../services/violations.data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI, Type } from '@google/genai';
import { generateStudentReport, ReportData as ReportDataType } from '../../services/pdfGenerator';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];

type InputMode = 'quiz' | 'subject_grade' | 'violation' | 'bulk_report' | 'academic_print';
type Step = 1 | 2;
type ReviewDataItem = { studentName: string; score: string; };
type StudentFilter = 'all' | 'selected' | 'unselected' | 'graded' | 'ungraded';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const actionCards: { mode: InputMode; title: string; description: string; icon: React.FC<any> }[] = [
    { mode: 'subject_grade', title: 'Input Nilai Mapel', description: 'Masukkan nilai sumatif/akhir untuk satu kelas sekaligus.', icon: GraduationCapIcon },
    { mode: 'quiz', title: 'Input Poin Keaktifan', description: 'Beri poin untuk siswa yang aktif di kelas.', icon: CheckSquareIcon },
    { mode: 'violation', title: 'Input Pelanggaran', description: 'Catat poin pelanggaran untuk beberapa siswa.', icon: ShieldAlertIcon },
    { mode: 'bulk_report', title: 'Cetak Rapor Massal', description: 'Cetak beberapa rapor dari satu kelas dalam satu file.', icon: PrinterIcon },
    { mode: 'academic_print', title: 'Cetak Nilai Akademik', description: 'Cetak rekap nilai per mata pelajaran untuk satu kelas.', icon: FileTextIcon },
];

const Step1_ModeSelection: React.FC<{ handleModeSelect: (mode: InputMode) => void }> = ({ handleModeSelect }) => (
    <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-12">
            <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center border border-white/10">
                    <ClipboardPenIcon className="w-10 h-10 text-purple-300" />
                </div>
            </div>
            <h1 className="text-4xl font-bold text-white text-shadow-md">Pusat Input Cerdas</h1>
            <p className="mt-2 text-lg text-indigo-200">Pilih aksi massal yang ingin Anda lakukan untuk efisiensi maksimal.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {actionCards.map((card, index) => (
                <div key={card.mode} onClick={() => handleModeSelect(card.mode)} 
                    className="step-card group bg-white/5 backdrop-blur-lg rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-2 cursor-pointer"
                    style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 border border-white/10 group-hover:border-purple-400/50">
                            <card.icon className="w-8 h-8 text-purple-300 transition-colors group-hover:text-purple-200" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white">{card.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{card.description}</p>
                </div>
            ))}
        </div>
    </div>
);

const FilterPills: React.FC<{
    options: { value: StudentFilter; label: string }[];
    currentValue: StudentFilter;
    onFilterChange: (value: StudentFilter) => void;
}> = ({ options, currentValue, onFilterChange }) => (
    <div className="flex items-center gap-2">
        {options.map(({ value, label }) => (
            <button
                key={value}
                onClick={() => onFilterChange(value)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    currentValue === value
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
                {label}
            </button>
        ))}
    </div>
);

const MassInputPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isOnline = useOfflineStatus();
    
    const [step, setStep] = useState<Step>(1);
    const [mode, setMode] = useState<InputMode | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [quizInfo, setQuizInfo] = useState({ name: '', subject: '', date: new Date().toISOString().slice(0,10) });
    const [subjectGradeInfo, setSubjectGradeInfo] = useState({ subject: '', notes: '' });
    const [scores, setScores] = useState<Record<string, string>>({});
    const [pasteData, setPasteData] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [selectedViolationCode, setSelectedViolationCode] = useState('');
    const [violationDate, setViolationDate] = useState(new Date().toISOString().slice(0,10));
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set<string>());
    const [searchTerm, setSearchTerm] = useState('');
    const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState("0%");
    const [noteMethod, setNoteMethod] = useState<'ai' | 'template'>('ai');
    const [templateNote, setTemplateNote] = useState('Ananda [Nama Siswa] menunjukkan perkembangan yang baik semester ini. Terus tingkatkan semangat belajar dan jangan ragu bertanya jika ada kesulitan.');

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async (): Promise<ClassRow[]> => {
            const { data, error } = await supabase.from('classes').select('*').eq('user_id', user!.id).order('name');
            if (error) throw error; return data || [];
        },
        enabled: !!user,
    });
    
    const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsForMassInput', selectedClass],
        queryFn: async (): Promise<StudentRow[]> => {
            if (!selectedClass) return [];
            const { data, error } = await supabase.from('students').select('*').eq('class_id', selectedClass).order('name');
            if (error) throw error; return data || [];
        },
        enabled: !!selectedClass
    });
    
    const { data: uniqueSubjects } = useQuery({
        queryKey: ['distinctSubjects', user?.id],
        queryFn: async (): Promise<string[]> => {
            if (!user) return [];
            const { data, error } = await supabase.from('academic_records').select('subject').eq('user_id', user.id);
            if (error) { console.error("Error fetching distinct subjects:", error); return []; }
            const subjects = (data as { subject: string }[])?.map(item => item.subject) || [];
            return [...new Set(subjects)].sort();
        },
        enabled: !!user, staleTime: 1000 * 60 * 15,
    });

    const { data: academicRecords } = useQuery({
        queryKey: ['academicRecordsForPrint', selectedClass, subjectGradeInfo.subject],
        queryFn: async (): Promise<AcademicRecordRow[]> => {
            if (!selectedClass || !subjectGradeInfo.subject || !studentsData || studentsData.length === 0) return [];
            const { data, error } = await supabase.from('academic_records').select('*').in('student_id', studentsData.map(s => s.id)).eq('subject', subjectGradeInfo.subject);
            if (error) throw error; return data || [];
        },
        enabled: mode === 'academic_print' && !!selectedClass && !!subjectGradeInfo.subject && !!studentsData,
    });

    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClass) {
            setSelectedClass(classes[0].id);
        }
    }, [classes, selectedClass]);

    const students = useMemo(() => {
        if (!studentsData) return [];
        let filtered = studentsData;
        if (mode === 'subject_grade') {
            if (studentFilter === 'graded') filtered = filtered.filter(s => scores[s.id]?.trim());
            else if (studentFilter === 'ungraded') filtered = filtered.filter(s => !scores[s.id]?.trim());
        } else if (mode) {
            if (studentFilter === 'selected') filtered = filtered.filter(s => selectedStudentIds.has(s.id));
            else if (studentFilter === 'unselected') filtered = filtered.filter(s => !selectedStudentIds.has(s.id));
        }
        if (searchTerm) {
            filtered = filtered.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return filtered;
    }, [studentsData, searchTerm, studentFilter, scores, selectedStudentIds, mode]);

    const handleModeSelect = (selectedMode: InputMode) => { setMode(selectedMode); setStep(2); };
    
    const handleBack = () => {
        setStep(1); setMode(null); setSelectedClass(''); setQuizInfo({ name: '', subject: '', date: new Date().toISOString().slice(0,10) });
        setSubjectGradeInfo({ subject: '', notes: '' }); setScores({}); setPasteData(''); setSelectedViolationCode('');
        setViolationDate(new Date().toISOString().slice(0,10)); setSelectedStudentIds(new Set()); setSearchTerm(''); setStudentFilter('all');
    };
    
    useEffect(() => { setSelectedStudentIds(new Set()); setScores({}); setSearchTerm(''); setStudentFilter('all'); }, [selectedClass]);
    useEffect(() => { setStudentFilter('all'); }, [mode]);
    
    const gradedCount = useMemo(() => Object.values(scores).filter(s => s.trim() !== '').length, [scores]);
    const isAllSelected = useMemo(() => students && students.length > 0 && selectedStudentIds.size === students.length, [selectedStudentIds, students]);
    const selectedViolation = useMemo(() => violationList.find(v => v.code === selectedViolationCode) || null, [selectedViolationCode]);

    const handleSelectAllStudents = (checked: boolean) => setSelectedStudentIds(checked ? new Set(students?.map(s => s.id)) : new Set());

    const handleStudentSelect = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            newSet.has(studentId) ? newSet.delete(studentId) : newSet.add(studentId);
            return newSet;
        });
    };
    
    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({...prev, [studentId]: value}));
    };
    
    const { mutate: submitData, isPending: isSubmitting } = useMutation({
        mutationFn: async () => {
            if (!mode || !user) throw new Error("Mode atau pengguna tidak diatur");
            switch (mode) {
                case 'quiz': {
                    if (!quizInfo.name || !quizInfo.subject || selectedStudentIds.size === 0) throw new Error("Informasi aktivitas dan siswa harus diisi.");
                    const records: Database['public']['Tables']['quiz_points']['Insert'][] = Array.from(selectedStudentIds).map(student_id => ({
                        ...quizInfo, quiz_date: quizInfo.date, quiz_name: quizInfo.name, student_id, user_id: user.id, points: 1, max_points: 1
                    }));
                    const { error } = await supabase.from('quiz_points').insert(records); if (error) throw error; return `Poin keaktifan untuk ${records.length} siswa berhasil disimpan.`;
                }
                case 'subject_grade': {
                    if (!subjectGradeInfo.subject || gradedCount === 0) throw new Error("Mata pelajaran dan setidaknya satu nilai harus diisi.");
                    const records: Database['public']['Tables']['academic_records']['Insert'][] = Object.entries(scores)
                        .filter(([_, score]) => score.trim() !== '')
                        .map(([student_id, score]) => ({ ...subjectGradeInfo, score: Number(score), student_id, user_id: user.id }));
                    const { error } = await supabase.from('academic_records').insert(records); if (error) throw error; return `Nilai untuk ${records.length} siswa berhasil disimpan.`;
                }
                case 'violation': {
                    if (!selectedViolation || selectedStudentIds.size === 0) throw new Error("Jenis pelanggaran dan siswa harus dipilih.");
                    const records: Database['public']['Tables']['violations']['Insert'][] = Array.from(selectedStudentIds).map(student_id => ({
                        date: violationDate, description: selectedViolation.description, points: selectedViolation.points, student_id, user_id: user.id
                    }));
                    const { error } = await supabase.from('violations').insert(records); if (error) throw error; return `Pelanggaran untuk ${records.length} siswa berhasil dicatat.`;
                }
            }
        },
        onSuccess: (message) => { toast.success(message || "Data berhasil disimpan!"); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (err: Error) => toast.error(`Gagal menyimpan: ${err.message}`),
    });

    const handleAiParse = async () => {
        if (!students || students.length === 0) { toast.warning("Pilih kelas dengan siswa terlebih dahulu."); return; }
        if (!pasteData.trim()) { toast.warning("Tempelkan data nilai terlebih dahulu."); return; }
        setIsParsing(true);
        try {
            const studentNames = students.map(s => s.name);
            const systemInstruction = `Anda adalah asisten entri data. Tugas Anda adalah mencocokkan nama dari teks yang diberikan dengan daftar nama siswa yang ada dan mengekstrak nilainya. Hanya cocokkan nama yang ada di daftar. Abaikan nama yang tidak ada di daftar. Format output harus JSON yang valid sesuai skema.`;
            const prompt = `Daftar Siswa: ${JSON.stringify(studentNames)}\n\nTeks Nilai untuk Diproses:\n${pasteData}`;
            const responseSchema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { studentName: { type: Type.STRING }, score: { type: Type.STRING } } } };
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema } });
            const parsedResults = JSON.parse(response.text.trim()) as ReviewDataItem[];
            const newScores: Record<string, string> = {}; let matchedCount = 0;
            parsedResults.forEach(item => {
                const student = students.find(s => s.name.toLowerCase() === item.studentName.toLowerCase());
                if (student) { newScores[student.id] = String(item.score); matchedCount++; }
            });
            setScores(prev => ({...prev, ...newScores}));
            toast.success(`${matchedCount} dari ${parsedResults.length} nilai berhasil dicocokkan dan diisi.`);
        } catch (error) { console.error("AI Parsing Error:", error); toast.error("Gagal memproses data. Pastikan format teks benar.");
        } finally { setIsParsing(false); }
    };
    
    const fetchReportDataForStudent = async (studentId: string, userId: string): Promise<ReportDataType> => {
        const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', userId).single();
        if (studentRes.error) throw new Error(studentRes.error.message);
        const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes] = await Promise.all([
            supabase.from('reports').select('*').eq('student_id', studentId), supabase.from('attendance').select('*').eq('student_id', studentId),
            supabase.from('academic_records').select('*').eq('student_id', studentId), supabase.from('violations').select('*').eq('student_id', studentId),
            supabase.from('quiz_points').select('*').eq('student_id', studentId)
        ]);
        const errors = [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes].map(r => r.error).filter(Boolean);
        if (errors.length > 0) throw new Error(errors.map(e => e!.message).join(', '));
        return { student: studentRes.data as any, reports: reportsRes.data || [], attendanceRecords: attendanceRes.data || [], academicRecords: academicRes.data || [], violations: violationsRes.data || [], quizPoints: quizPointsRes.data || [] };
    };

    const handlePrintBulkReports = async () => {
        if (selectedStudentIds.size === 0) { toast.warning("Pilih setidaknya satu siswa."); return; }
        setIsExporting(true); setExportProgress("0%"); toast.info(`Mulai proses cetak ${selectedStudentIds.size} rapor...`);
        const studentsToPrint = (studentsData || []).filter(s => selectedStudentIds.has(s.id));
        try {
            setExportProgress("10%"); toast.info("Mengambil data siswa...");
            const allReportData = await Promise.all(studentsToPrint.map(student => fetchReportDataForStudent(student.id, user!.id)));
            setExportProgress("40%"); toast.info("Membuat catatan guru...");
            let teacherNotesMap: Map<string, string>;
            if (noteMethod === 'template') {
                teacherNotesMap = new Map(allReportData.map(data => [data.student.id, templateNote.replace(/\[Nama Siswa\]/g, data.student.name)]));
            } else {
                const studentDataForPrompt = allReportData.map(data => {
                    const academicSummary = data.academicRecords.length > 0 ? `Nilai rata-rata: ${Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)}. Pelajaran terbaik: ${[...data.academicRecords].sort((a, b) => b.score - a.score)[0]?.subject || 'N/A'}.` : 'Belum ada data nilai.';
                    const behaviorSummary = data.violations.length > 0 ? `${data.violations.length} pelanggaran dengan total ${data.violations.reduce((sum, v) => sum + v.points, 0)} poin.` : 'Perilaku baik, tidak ada pelanggaran.';
                    const attendanceSummary = `Sakit: ${data.attendanceRecords.filter(r=>r.status === 'Sakit').length}, Izin: ${data.attendanceRecords.filter(r=>r.status === 'Izin').length}, Alpha: ${data.attendanceRecords.filter(r=>r.status === 'Alpha').length}.`;
                    return { studentId: data.student.id, studentName: data.student.name, academicSummary, behaviorSummary, attendanceSummary };
                });
                const systemInstruction = `Anda adalah seorang guru wali kelas yang bijaksana dan suportif. Tugas Anda adalah menulis paragraf "Catatan Wali Kelas" untuk setiap siswa berdasarkan data yang diberikan. Catatan harus holistik, memotivasi, dan dalam satu paragraf (3-5 kalimat). Jawab dalam format JSON array yang diminta.`;
                const prompt = `Buatkan "Catatan Wali Kelas" untuk setiap siswa dalam daftar JSON berikut. Data Siswa: ${JSON.stringify(studentDataForPrompt)}`;
                const responseSchema = { type: Type.OBJECT, properties: { notes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { studentId: { type: Type.STRING }, teacherNote: { type: Type.STRING } }, required: ["studentId", "teacherNote"] } } }, required: ["notes"] };
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema } });
                const parsedResponse = JSON.parse(response.text);
                const parsedNotes = parsedResponse.notes as { studentId: string; teacherNote: string }[];
                teacherNotesMap = new Map(parsedNotes.map(item => [item.studentId, item.teacherNote.replace(/\\n/g, ' ')]));
            }
            setExportProgress("70%"); toast.info("Menyusun file PDF...");
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); let isFirstPage = true;
            for (let i = 0; i < allReportData.length; i++) {
                const reportData = allReportData[i];
                const teacherNote = teacherNotesMap.get(reportData.student.id) || "Catatan tidak dapat dibuat.";
                if (!isFirstPage) doc.addPage(); isFirstPage = false;
                generateStudentReport(doc, reportData, teacherNote, user);
                setExportProgress(`${Math.round(70 + ((i + 1) / studentsToPrint.length) * 30)}%`);
            }
            doc.save(`Rapor_Massal_${classes?.find(c => c.id === selectedClass)?.name || 'Kelas'}.pdf`);
            toast.success("Semua rapor terpilih berhasil digabung dalam satu PDF!");
        } catch (err) { console.error("Gagal membuat rapor massal:", err); toast.error(`Gagal membuat rapor massal: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally { setIsExporting(false); }
    };
    
    const handlePrintGrades = async () => {
        if (!selectedClass || !subjectGradeInfo.subject) { toast.warning("Pilih kelas dan mata pelajaran."); return; }
        if (selectedStudentIds.size === 0) { toast.warning("Pilih setidaknya satu siswa untuk mencetak."); return; }
        setIsExporting(true); toast.info("Membuat rekap nilai...");
        const doc = new jsPDF(); const className = classes?.find(c => c.id === selectedClass)?.name;
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(`Rekap Nilai: ${subjectGradeInfo.subject}`, 14, 22);
        doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(`Kelas: ${className}`, 14, 30);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 38);
        const tableData = (studentsData || []).filter(s => selectedStudentIds.has(s.id)).map((s, index) => {
            const record = academicRecords?.find(r => r.student_id === s.id);
            return [index + 1, s.name, record ? record.score : 'N/A'];
        });
        autoTable(doc, { startY: 45, head: [['No', 'Nama Siswa', 'Nilai']], body: tableData, theme: 'grid', headStyles: { fillColor: '#0284c7' } });
        doc.save(`Nilai_${subjectGradeInfo.subject.replace(/\s/g, '_')}_${className}.pdf`);
        toast.success("Rekap nilai berhasil diunduh."); setIsExporting(false);
    };
    
    const summaryText = useMemo(() => {
        const totalStudents = studentsData?.length || 0;
        if (mode === 'subject_grade') { return `${gradedCount} dari ${totalStudents} siswa telah dinilai.`; }
        return `${selectedStudentIds.size} dari ${totalStudents} siswa dipilih.`;
    }, [mode, gradedCount, selectedStudentIds.size, studentsData]);

    const submitButtonTooltip = useMemo(() => {
        if (!isOnline) return "Fitur ini memerlukan koneksi internet.";
        if (isSubmitting || isExporting) return "Sedang memproses...";
        if (!selectedClass) return "Pilih kelas terlebih dahulu.";
        switch(mode) {
            case 'subject_grade':
                if (!subjectGradeInfo.subject) return "Masukkan nama mata pelajaran.";
                if (gradedCount === 0) return "Masukkan setidaknya satu nilai siswa."; break;
            case 'quiz':
                if (!quizInfo.name || !quizInfo.subject) return "Lengkapi nama dan mata pelajaran aktivitas.";
                if (selectedStudentIds.size === 0) return "Pilih setidaknya satu siswa."; break;
            case 'violation':
                if (!selectedViolationCode) return "Pilih jenis pelanggaran.";
                if (selectedStudentIds.size === 0) return "Pilih setidaknya satu siswa."; break;
            case 'bulk_report':
            case 'academic_print':
                if (selectedStudentIds.size === 0) return "Pilih setidaknya satu siswa.";
                if (mode === 'academic_print' && !subjectGradeInfo.subject) return "Pilih mata pelajaran untuk dicetak."; break;
        }
        return '';
    }, [isOnline, isSubmitting, isExporting, selectedClass, mode, subjectGradeInfo, gradedCount, quizInfo, selectedStudentIds, selectedViolationCode]);

    const isSubmitDisabled = !!submitButtonTooltip;

    // FIX: Explicitly set the return type for useMemo to satisfy TypeScript's strict checking for the `FilterPills` component props.
    const filterOptions = useMemo((): { value: StudentFilter; label: string }[] => {
        if (mode === 'subject_grade') return [ { value: 'all', label: 'Semua' }, { value: 'graded', label: 'Sudah Dinilai' }, { value: 'ungraded', label: 'Belum Dinilai' } ];
        if (['quiz', 'violation', 'bulk_report', 'academic_print'].includes(mode || '')) return [ { value: 'all', label: 'Semua' }, { value: 'selected', label: 'Terpilih' }, { value: 'unselected', label: 'Belum Dipilih' } ];
        return [];
    }, [mode]);

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 flex flex-col cosmic-bg text-white">
            {step === 1 ? <Step1_ModeSelection handleModeSelect={handleModeSelect} /> : (
                <div className="w-full max-w-7xl mx-auto flex flex-col flex-grow">
                    <header className="flex items-center gap-4 mb-6"><Button variant="outline" size="icon" onClick={handleBack} className="bg-white/10 border-white/20 hover:bg-white/20 flex-shrink-0"><ArrowLeftIcon className="w-4 h-4" /></Button><div><h1 className="text-3xl font-bold tracking-tight">{actionCards.find(c => c.mode === mode)?.title}</h1><p className="mt-1 text-gray-300">{actionCards.find(c => c.mode === mode)?.description}</p></div></header>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow"><div className="lg:col-span-1 space-y-6"><div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6"><h3 className="font-bold text-lg mb-4 border-b border-white/10 pb-3">Konfigurasi</h3><div className="space-y-4"><div><label className="text-sm font-medium text-gray-300">Kelas</label><Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isLoadingClasses}>{classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>{mode === 'quiz' && <><div><label className="text-sm font-medium text-gray-300">Nama Aktivitas</label><Input value={quizInfo.name} onChange={e => setQuizInfo(p => ({...p, name: e.target.value}))} placeholder="cth. Aktif Bertanya"/></div><div><label className="text-sm font-medium text-gray-300">Mata Pelajaran</label><Input value={quizInfo.subject} onChange={e => setQuizInfo(p => ({...p, subject: e.target.value}))} placeholder="cth. Matematika"/></div><div><label className="text-sm font-medium text-gray-300">Tanggal</label><Input type="date" value={quizInfo.date} onChange={e => setQuizInfo(p => ({...p, date: e.target.value}))}/></div></>}{mode === 'subject_grade' && <><div><label className="text-sm font-medium text-gray-300">Mata Pelajaran</label><Input list="subjects-datalist" value={subjectGradeInfo.subject} onChange={e => setSubjectGradeInfo(p => ({...p, subject: e.target.value}))} placeholder="cth. IPA Terpadu"/><datalist id="subjects-datalist">{uniqueSubjects?.map(s => <option key={s} value={s}/>)}</datalist></div><div><label className="text-sm font-medium text-gray-300">Catatan (Opsional)</label><Input value={subjectGradeInfo.notes} onChange={e => setSubjectGradeInfo(p => ({...p, notes: e.target.value}))} placeholder="cth. Ujian Akhir Semester"/></div></>}{mode === 'violation' && <><div><label className="text-sm font-medium text-gray-300">Jenis Pelanggaran</label><Select value={selectedViolationCode} onChange={e => setSelectedViolationCode(e.target.value)}><option value="">-- Pilih Pelanggaran --</option>{violationList.map(v => <option key={v.code} value={v.code}>{v.description} ({v.points} poin)</option>)}</Select></div><div><label className="text-sm font-medium text-gray-300">Tanggal</label><Input type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)}/></div></>}{mode === 'bulk_report' && <><div><label className="text-sm font-medium text-gray-300">Metode Catatan Guru</label><Select value={noteMethod} onChange={e => setNoteMethod(e.target.value as any)}><option value="ai">Generate dengan AI</option><option value="template">Gunakan Template</option></Select></div>{noteMethod === 'template' && <div><label className="text-sm font-medium text-gray-300">Template Catatan</label><textarea value={templateNote} onChange={e => setTemplateNote(e.target.value)} rows={4} className="w-full mt-1 p-2 border rounded-md bg-white/10 border-white/20 text-white placeholder:text-gray-400"></textarea><p className="text-xs text-gray-400 mt-1">Gunakan [Nama Siswa] untuk personalisasi.</p></div>}</>}{mode === 'academic_print' && <div><label className="text-sm font-medium text-gray-300">Mata Pelajaran</label><Input list="subjects-datalist" value={subjectGradeInfo.subject} onChange={e => setSubjectGradeInfo(p => ({...p, subject: e.target.value}))} placeholder="Pilih atau ketik mapel"/><datalist id="subjects-datalist">{uniqueSubjects?.map(s => <option key={s} value={s}/>)}</datalist></div>}</div></div>{mode === 'subject_grade' && isOnline && (<div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6"><h3 className="font-bold text-lg mb-4 border-b border-white/10 pb-3 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-400"/>Tempel Data Nilai</h3><textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Contoh:&#10;Budi Santoso   95&#10;Ani Wijaya      88" rows={4} className="w-full p-2 border rounded-md bg-white/10 border-white/20 text-white placeholder:text-gray-400"></textarea><Button onClick={handleAiParse} disabled={isParsing} className="mt-2"><ClipboardPasteIcon className="w-4 h-4 mr-2"/>{isParsing ? 'Memproses...' : 'Proses dengan AI'}</Button></div>)}</div><div className="lg:col-span-2 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 flex flex-col"><div className="p-4 sm:p-6 border-b border-white/10 flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between"><div className="relative flex-grow w-full sm:w-auto"><SearchIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2"/><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari nama siswa..." className="pl-10 w-full"/></div><FilterPills options={filterOptions} currentValue={studentFilter} onFilterChange={setStudentFilter} /></div><div className="flex-grow overflow-y-auto">{isLoadingStudents ? <p className="p-6 text-center">Memuat siswa...</p> : students && students.length > 0 ? (<div className="overflow-x-auto"><table className="w-full text-sm striped-table sticky-header min-w-[500px]"><thead><tr><th className="p-4 text-left w-10">{mode !== 'subject_grade' && <Checkbox checked={isAllSelected} onChange={e => handleSelectAllStudents(e.target.checked)}/>}</th><th className="p-4 text-left font-semibold">Nama Siswa</th><th className="p-4 text-left font-semibold">{mode === 'subject_grade' ? 'Input Nilai' : mode === 'academic_print' ? 'Nilai Saat Ini' : 'Status'}</th></tr></thead><tbody>{students.map(s => { const isSelected = selectedStudentIds.has(s.id); const record = mode === 'academic_print' ? academicRecords?.find(r => r.student_id === s.id) : null; return(<tr key={s.id} onClick={mode !== 'subject_grade' ? () => handleStudentSelect(s.id) : undefined} className={`border-b border-white/10 transition-colors ${(isSelected || (mode === 'subject_grade' && scores[s.id]?.trim())) ? 'bg-purple-500/10' : 'hover:bg-white/5'} ${mode !== 'subject_grade' ? 'cursor-pointer' : ''}`}><td className="p-4">{mode !== 'subject_grade' && <Checkbox checked={isSelected} onChange={() => handleStudentSelect(s.id)}/>}</td><td className="p-4 flex items-center gap-3"><img src={s.avatar_url} alt={s.name} className="w-9 h-9 rounded-full object-cover"/><span className="font-medium">{s.name}</span></td><td className="p-4">{mode === 'subject_grade' ? <Input type="number" min="0" max="100" value={scores[s.id] || ''} onChange={e => handleScoreChange(s.id, e.target.value)} className="w-24"/> : mode === 'academic_print' ? <span className={`font-bold px-2 py-1 rounded-md ${record ? 'bg-purple-500/20 text-purple-200' : 'bg-white/10 text-gray-500'}`}>{record ? record.score : 'N/A'}</span> : isSelected ? <span className="text-green-400 font-semibold">Terpilih</span> : <span className="text-gray-500">Belum dipilih</span>}</td></tr>)})}</tbody></table></div>) : <p className="p-6 text-center">Tidak ada siswa di kelas ini atau tidak ada hasil pencarian.</p>}</div></div></div>
                </div>
            )}
            
            {step === 2 && (
                <footer className="sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 md:-mx-8 md:-mb-8 mt-6 z-20">
                    <div className="bg-gray-950/70 backdrop-blur-lg border-t border-white/10 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <p className="text-sm text-gray-300">{summaryText}</p>
                            {(mode !== 'subject_grade' && selectedStudentIds.size > 0) || (mode === 'subject_grade' && gradedCount > 0) ? (
                                <Button variant="ghost" size="sm" onClick={() => mode === 'subject_grade' ? setScores({}) : setSelectedStudentIds(new Set())}>
                                    <XCircleIcon className="w-4 h-4 mr-1"/> Bersihkan
                                </Button>
                            ) : null}
                        </div>
                         {isExporting ? (
                             <div className="w-full sm:w-64 text-center">
                                <div className="relative pt-1"><div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-purple-200/20"><div style={{ width: exportProgress }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"></div></div><p className="text-xs text-purple-200">{exportProgress}</p></div>
                            </div>
                        ) : (
                            <Button onClick={mode === 'bulk_report' ? handlePrintBulkReports : (mode === 'academic_print' ? handlePrintGrades : () => submitData())} disabled={isSubmitDisabled} title={submitButtonTooltip} className="w-full sm:w-auto">
                                {isSubmitting ? 'Memproses...' : (mode?.includes('print') || mode?.includes('report')) ? 'Cetak Laporan' : 'Simpan Data'}
                            </Button>
                        )}
                    </div>
                </footer>
            )}
        </div>
    );
};

export default MassInputPage;