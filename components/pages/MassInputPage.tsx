

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
import { ClipboardPenIcon, GraduationCapIcon, PrinterIcon, ShieldAlertIcon, CheckSquareIcon, ArrowLeftIcon, ClipboardPasteIcon, SparklesIcon, AlertCircleIcon, PencilIcon, FileTextIcon } from '../Icons';
import { violationList } from '../../services/violations.data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceStatus } from '../../types';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { Modal } from '../ui/Modal';
import { generateStudentReport, ReportData as ReportDataType } from '../../services/pdfGenerator';


type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
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

type InputMode = 'quiz' | 'subject_grade' | 'violation' | 'bulk_report' | 'academic_print';
type Step = 1 | 2; // Step 1: Mode selection, Step 2: Configuration & Input

type ReviewDataItem = { studentId: string; studentName: string; score: string; originalLine: string; };

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const actionCards: { mode: InputMode; title: string; description: string; icon: React.FC<any> }[] = [
    { mode: 'subject_grade', title: 'Input Nilai Mapel', description: 'Masukkan nilai sumatif/akhir untuk satu kelas sekaligus.', icon: GraduationCapIcon },
    { mode: 'quiz', title: 'Input Poin Keaktifan', description: 'Beri poin untuk siswa yang aktif di kelas (bertanya, maju, dll).', icon: CheckSquareIcon },
    { mode: 'violation', title: 'Input Pelanggaran', description: 'Catat poin pelanggaran untuk beberapa siswa sekaligus.', icon: ShieldAlertIcon },
    { mode: 'bulk_report', title: 'Cetak Rapor Massal', description: 'Cetak beberapa rapor siswa dari satu kelas dalam satu file.', icon: PrinterIcon },
    { mode: 'academic_print', title: 'Cetak Nilai Akademik', description: 'Cetak rekap nilai per mata pelajaran untuk satu kelas.', icon: FileTextIcon },
];

// --- Sub-components extracted for stability ---

const Step1_ModeSelection: React.FC<{ handleModeSelect: (mode: InputMode) => void }> = ({ handleModeSelect }) => (
    <div className="animate-fade-in">
         <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white text-shadow-md">Pusat Input Cerdas</h1>
            <p className="mt-2 text-lg text-indigo-200">Pilih aksi massal yang ingin Anda lakukan.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {actionCards.map(card => (
                <div key={card.mode} onClick={() => handleModeSelect(card.mode)} className="relative overflow-hidden cursor-pointer group bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center transition-all duration-300 hover:bg-white/10 hover:border-purple-400 hover:-translate-y-2 holographic-shine-hover">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 border border-white/10">
                            <card.icon className="w-8 h-8 text-purple-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white">{card.title}</h3>
                    <p className="text-sm text-gray-300 mt-1">{card.description}</p>
                </div>
            ))}
        </div>
    </div>
);

interface Step2Props {
    mode: InputMode;
    handleBack: () => void;
    classes: ClassRow[] | undefined;
    selectedClass: string;
    setSelectedClass: (value: string) => void;
    isLoadingClasses: boolean;
    quizInfo: { name: string; subject: string; date: string; };
    setQuizInfo: React.Dispatch<React.SetStateAction<{ name: string; subject: string; date: string; }>>;
    subjectGradeInfo: { subject: string; notes: string; };
    setSubjectGradeInfo: React.Dispatch<React.SetStateAction<{ subject: string; notes: string; }>>;
    scores: Record<string, string>;
    setScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    pasteData: string;
    setPasteData: (value: string) => void;
    handleAiParse: () => Promise<void>;
    isParsing: boolean;
    selectedViolationCode: string;
    setSelectedViolationCode: (value: string) => void;
    violationDate: string;
    setViolationDate: (value: string) => void;
    selectedViolation: typeof violationList[number] | null;
    students: StudentRow[] | undefined;
    isLoadingStudents: boolean;
    selectedStudentIds: Set<string>;
    handleSelectAllStudents: (checked: boolean) => void;
    handleStudentSelect: (studentId: string) => void;
    isAllSelected: boolean;
    isExporting: boolean;
    exportProgress: string;
    handlePrintBulkReports: () => Promise<void>;
    handlePrintGrades: () => Promise<void>;
    handleSubmit: () => void;
    isSubmitting: boolean;
    isOnline: boolean;
    gradedCount: number;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    noteMethod: 'ai' | 'template';
    setNoteMethod: React.Dispatch<React.SetStateAction<'ai' | 'template'>>;
    templateNote: string;
    setTemplateNote: React.Dispatch<React.SetStateAction<string>>;
    uniqueSubjects: string[] | undefined;
}

const Step2_ConfigurationAndInput: React.FC<Step2Props> = ({
    mode, handleBack, classes, selectedClass, setSelectedClass, isLoadingClasses,
    quizInfo, setQuizInfo, subjectGradeInfo, setSubjectGradeInfo, scores, setScores,
    pasteData, setPasteData, handleAiParse, isParsing, selectedViolationCode,
    setSelectedViolationCode, violationDate, setViolationDate, selectedViolation,
    students, isLoadingStudents, selectedStudentIds, handleSelectAllStudents,
    handleStudentSelect, isAllSelected, isExporting, exportProgress,
    handlePrintBulkReports, handlePrintGrades, handleSubmit, isSubmitting, isOnline, gradedCount,
    searchTerm, setSearchTerm, noteMethod, setNoteMethod, templateNote, setTemplateNote,
    uniqueSubjects
}) => {
    const currentAction = actionCards.find(c => c.mode === mode)!;

    const handleInfoChange = (setter: React.Dispatch<React.SetStateAction<any>>, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setter(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({ ...prev, [studentId]: value }));
    };
    
    const inputStyles = "bg-white/10 border-white/20 placeholder:text-gray-400 focus:bg-white/20 focus:border-purple-400";

    const commonStudentListUI = (
      <>
        <div className="mb-4 relative">
          <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <Input type="text" placeholder="Cari nama siswa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 ${inputStyles}`} />
        </div>
        {isLoadingStudents && <div className="text-center p-8">Memuat siswa...</div>}
        {!selectedClass && <div className="text-center p-8 text-gray-400">Pilih kelas untuk menampilkan daftar siswa.</div>}
        {students && students.length > 0 && (
          <div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-200 uppercase bg-white/10"><tr>
              <th scope="col" className="p-4"><Checkbox checked={isAllSelected} onChange={e => handleSelectAllStudents(e.target.checked)} /></th>
              <th scope="col" className="px-6 py-3">Nama Siswa</th>
              <th scope="col" className="px-6 py-3">Pilih</th>
            </tr></thead>
            <tbody>{students.map(s => (<tr key={s.id} className="border-b border-white/10 hover:bg-white/5">
              <td className="w-4 p-4"><Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} /></td>
              <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap text-white">{s.name}</th>
              <td className="px-6 py-4"><Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} /></td>
            </tr>))}</tbody>
          </table></div>
        )}
        {students && students.length === 0 && selectedClass && (
          <div className="text-center p-8 text-gray-400">
            {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian Anda.' : 'Tidak ada siswa di kelas ini.'}
          </div>
        )}
      </>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handleBack} className="bg-white/10 border-white/20 hover:bg-white/20 text-white"><ArrowLeftIcon className="w-4 h-4" /></Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">{currentAction.title}</h1>
                    <p className="mt-1 text-gray-300">{currentAction.description}</p>
                </div>
            </header>

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg text-white">Tahap 1: Konfigurasi</h3></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3">
                        <label htmlFor="class-select" className="block text-sm font-medium mb-1 text-gray-200">Pilih Kelas</label>
                        <Select id="class-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isLoadingClasses} className={inputStyles}>
                            <option value="" disabled>-- Pilih Kelas --</option>{classes?.map(c => <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.name}</option>)}
                        </Select>
                    </div>
                    {mode === 'quiz' && <>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Nama Aktivitas</label><Input name="name" value={quizInfo.name} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Menjawab Pertanyaan" className={inputStyles}/></div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Mata Pelajaran</label><Input name="subject" value={quizInfo.subject} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Matematika" className={inputStyles}/></div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Tanggal</label><Input name="date" type="date" value={quizInfo.date} onChange={e => handleInfoChange(setQuizInfo, e)} className={inputStyles}/></div>
                    </>}
                    {mode === 'subject_grade' && <>
                        <div className="lg:col-span-1"><label className="block text-sm font-medium mb-1 text-gray-200">Mata Pelajaran</label><Input name="subject" value={subjectGradeInfo.subject} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Bahasa Indonesia" className={inputStyles}/></div>
                        <div className="lg:col-span-2"><label className="block text-sm font-medium mb-1 text-gray-200">Catatan (Opsional)</label><Input name="notes" value={subjectGradeInfo.notes} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Penilaian Akhir Semester" className={inputStyles}/></div>
                    </>}
                     {mode === 'academic_print' && <>
                        <div className="lg:col-span-3">
                            <label className="block text-sm font-medium mb-1 text-gray-200">Mata Pelajaran</label>
                            <Select
                                name="subject"
                                value={subjectGradeInfo.subject}
                                onChange={e => handleInfoChange(setSubjectGradeInfo, e)}
                                className={inputStyles}
                            >
                                <option value="" disabled>-- Pilih Mata Pelajaran --</option>
                                {uniqueSubjects?.map(subj => (
                                    <option key={subj} value={subj} className="bg-gray-800 text-white">{subj}</option>
                                ))}
                            </Select>
                        </div>
                    </>}
                    {mode === 'violation' && <>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-200">Jenis Pelanggaran</label>
                            <Select value={selectedViolationCode} onChange={(e) => setSelectedViolationCode(e.target.value)} className={inputStyles}>
                                <option value="" disabled>-- Pilih Pelanggaran --</option>
                                {['Ringan', 'Sedang', 'Berat'].map(cat => (<optgroup key={cat} label={`Pelanggaran ${cat}`} className="bg-gray-800 text-white">{violationList.filter(v => v.category === cat).map(v => (<option key={v.code} value={v.code} className="bg-gray-800 text-white">{v.description}</option>))}</optgroup>))}
                            </Select>
                            {selectedViolation && <p className="text-xs text-red-400 mt-1">Poin: {selectedViolation.points}</p>}
                        </div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Tanggal</label><Input type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)} className={inputStyles}/></div>
                    </>}
                     {mode === 'bulk_report' && (
                        <>
                            <div className="lg:col-span-3">
                                <label className="block text-sm font-medium mb-2 text-gray-200">Metode Catatan Wali Kelas</label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border-2 border-transparent has-[:checked]:border-purple-500 has-[:checked]:bg-purple-900/20 cursor-pointer transition-all flex-1">
                                        <input type="radio" name="noteMethod" value="ai" checked={noteMethod === 'ai'} onChange={() => setNoteMethod('ai')} className="form-radio" />
                                        <div>
                                            <p className="font-semibold text-white">Buat Catatan AI Otomatis</p>
                                            <p className="text-xs text-gray-400">AI akan menganalisis data setiap siswa.</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border-2 border-transparent has-[:checked]:border-purple-500 has-[:checked]:bg-purple-900/20 cursor-pointer transition-all flex-1">
                                        <input type="radio" name="noteMethod" value="template" checked={noteMethod === 'template'} onChange={() => setNoteMethod('template')} className="form-radio" />
                                        <div>
                                            <p className="font-semibold text-white">Gunakan Catatan Template</p>
                                            <p className="text-xs text-gray-400">Gunakan satu catatan untuk semua siswa.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            {noteMethod === 'template' && (
                                <div className="lg:col-span-3 animate-fade-in">
                                    <label htmlFor="template-note" className="block text-sm font-medium mb-1 text-gray-200">Template Catatan</label>
                                    <textarea
                                        id="template-note"
                                        value={templateNote}
                                        onChange={(e) => setTemplateNote(e.target.value)}
                                        rows={4}
                                        className={`w-full p-2 border rounded-md text-white ${inputStyles}`}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Gunakan `[Nama Siswa]` untuk menyisipkan nama siswa secara otomatis.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {mode === 'subject_grade' && (
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                    <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg flex items-center gap-2 text-white"><SparklesIcon className="w-5 h-5 text-purple-400"/>Tempel Data Nilai (AI Powered)</h3><p className="text-sm text-gray-300 mt-1">Salin data dari spreadsheet (cth. kolom nama dan nilai) dan tempel di sini untuk pengisian otomatis.</p></div>
                    <div className="p-6">
                        <textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Contoh:&#10;Budi Santoso   95&#10;Ani Wijaya      88&#10;Cici Paramida   76" rows={4} className={`w-full p-2 border rounded-md text-white ${inputStyles}`}></textarea>
                        <Button onClick={handleAiParse} disabled={isParsing || !isOnline} className="mt-2 bg-white/10 border-white/20 hover:bg-white/20 text-white"><ClipboardPasteIcon className="w-4 h-4 mr-2"/>{isParsing ? 'Memproses...' : 'Proses dengan AI'}</Button>
                    </div>
                </div>
            )}

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg text-white">Tahap 2: Input Data Siswa</h3></div>
                <div className="p-6">
                   {(mode === 'quiz' || mode === 'violation') && commonStudentListUI}
                   {mode === 'bulk_report' && commonStudentListUI}
                   {mode === 'academic_print' && commonStudentListUI}
                   {mode === 'subject_grade' && <>
                        <div className="mb-4 relative">
                            <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <Input type="text" placeholder="Cari nama siswa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 ${inputStyles}`}/>
                        </div>
                        {isLoadingStudents && <div className="text-center p-8">Memuat siswa...</div>}
                        {!selectedClass && <div className="text-center p-8 text-gray-400">Pilih kelas untuk menampilkan daftar siswa.</div>}
                        {students && students.length > 0 && (
                             <div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-xs text-gray-200 uppercase bg-white/10"><tr>
                                    <th scope="col" className="px-6 py-3">Nama Siswa</th>
                                    <th scope="col" className="px-6 py-3">Nilai (0-100)</th>
                                </tr></thead>
                                <tbody>{students.map(s => (<tr key={s.id} className="border-b border-white/10 hover:bg-white/5">
                                    <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap text-white">{s.name}</th>
                                    <td className="px-6 py-4"><Input type="number" min="0" max="100" value={scores[s.id] || ''} onChange={e => handleScoreChange(s.id, e.target.value)} className={`w-24 h-8 ${inputStyles}`}/></td>
                                </tr>))}</tbody>
                            </table></div>
                        )}
                        {students && students.length === 0 && selectedClass && (
                            <div className="text-center p-8 text-gray-400">
                                {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian Anda.' : 'Tidak ada siswa di kelas ini.'}
                            </div>
                        )}
                   </>}
                </div>
                {students && students.length > 0 && <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/20 p-4 border-t border-white/10 rounded-b-2xl">
                    <p className="text-sm text-gray-300">
                        {mode === 'subject_grade' ? `${gradedCount} dari ${students.length} siswa telah dinilai.` : `${selectedStudentIds.size} dari ${students.length} siswa dipilih.`}
                    </p>
                    {isExporting ? (
                        <div className="w-full sm:w-auto text-center">
                            <div className="relative pt-1">
                                <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-purple-200/20">
                                    <div style={{ width: exportProgress }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"></div>
                                </div>
                                <p className="text-xs text-purple-200">{exportProgress}</p>
                            </div>
                        </div>
                    ) : (
                         <Button
                            onClick={mode === 'bulk_report' ? handlePrintBulkReports : (mode === 'academic_print' ? handlePrintGrades : handleSubmit)}
                            disabled={isSubmitting || !isOnline}
                            className="w-full sm:w-auto"
                        >
                            {isSubmitting ? 'Memproses...' : (mode.includes('report') || mode.includes('print')) ? 'Cetak Laporan' : 'Simpan Data'}
                        </Button>
                    )}
                </div>}
            </div>
        </div>
    );
};

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
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState("0%");
    const [noteMethod, setNoteMethod] = useState<'ai' | 'template'>('ai');
    const [templateNote, setTemplateNote] = useState(
        'Ananda [Nama Siswa] menunjukkan perkembangan yang baik semester ini. Terus tingkatkan semangat belajar dan jangan ragu bertanya jika ada kesulitan.'
    );

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async (): Promise<ClassRow[]> => {
            const { data, error } = await supabase.from('classes').select('*').eq('user_id', user!.id).order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });
    
    const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsForMassInput', selectedClass],
        queryFn: async (): Promise<StudentRow[]> => {
            if (!selectedClass) return [];
            const { data, error } = await supabase.from('students').select('*').eq('class_id', selectedClass).order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedClass
    });
    
    const { data: uniqueSubjects } = useQuery({
        queryKey: ['distinctSubjects', user?.id],
        queryFn: async (): Promise<string[]> => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('academic_records')
                .select('subject')
                .eq('user_id', user.id);

            if (error) {
                console.error("Error fetching distinct subjects:", error);
                return [];
            }
            
            const subjects = (data as { subject: string }[])?.map(item => item.subject) || [];
            return [...new Set(subjects)].sort();
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });

    const { data: academicRecords } = useQuery({
        queryKey: ['academicRecordsForPrint', selectedClass, subjectGradeInfo.subject],
        queryFn: async (): Promise<AcademicRecordRow[]> => {
            if (!selectedClass || !subjectGradeInfo.subject || !studentsData || studentsData.length === 0) return [];
            const { data, error } = await supabase
                .from('academic_records')
                .select('*')
                .in('student_id', studentsData.map(s => s.id))
                .eq('subject', subjectGradeInfo.subject);

            if (error) throw error;
            return data || [];
        },
        enabled: mode === 'academic_print' && !!selectedClass && !!subjectGradeInfo.subject && !!studentsData,
    });

    const students = useMemo(() => {
        if (!studentsData) return [];
        if (!searchTerm) return studentsData;
        return studentsData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [studentsData, searchTerm]);

    const handleModeSelect = (selectedMode: InputMode) => { setMode(selectedMode); setStep(2); };
    const handleBack = () => { setStep(1); setMode(null); /* Reset states */ };
    
    useEffect(() => { // Reset dependent states on class change
        setSelectedStudentIds(new Set());
        setScores({});
        setSearchTerm('');
    }, [selectedClass]);
    
    const gradedCount = useMemo(() => Object.values(scores).filter(s => s.trim() !== '').length, [scores]);
    const isAllSelected = useMemo(() => students && students.length > 0 && selectedStudentIds.size === students.length, [selectedStudentIds, students]);
    const selectedViolation = useMemo(() => violationList.find(v => v.code === selectedViolationCode) || null, [selectedViolationCode]);

    const handleSelectAllStudents = (checked: boolean) => {
        if (checked) {
            setSelectedStudentIds(new Set(students?.map(s => s.id)));
        } else {
            setSelectedStudentIds(new Set());
        }
    };

    const handleStudentSelect = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };
    
    const { mutate: submitData, isPending: isSubmitting } = useMutation({
        mutationFn: async () => {
            if (!mode || !user) throw new Error("Mode or user not set");
            
            switch (mode) {
                case 'quiz': {
                    if (!quizInfo.name || !quizInfo.subject || selectedStudentIds.size === 0) throw new Error("Informasi aktivitas dan siswa harus diisi.");
                    const records: Database['public']['Tables']['quiz_points']['Insert'][] = Array.from(selectedStudentIds).map(student_id => ({
                        ...quizInfo, quiz_date: quizInfo.date, quiz_name: quizInfo.name, student_id, user_id: user.id, points: 1, max_points: 1
                    }));
                    const { error } = await supabase.from('quiz_points').insert(records);
                    if (error) throw error;
                    break;
                }
                case 'subject_grade': {
                    if (!subjectGradeInfo.subject || gradedCount === 0) throw new Error("Mata pelajaran dan setidaknya satu nilai harus diisi.");
                    const records: Database['public']['Tables']['academic_records']['Insert'][] = Object.entries(scores)
                        .filter(([_, score]) => score.trim() !== '')
                        .map(([student_id, score]) => ({ ...subjectGradeInfo, score: Number(score), student_id, user_id: user.id }));
                    const { error } = await supabase.from('academic_records').insert(records);
                    if (error) throw error;
                    break;
                }
                case 'violation': {
                    if (!selectedViolation || selectedStudentIds.size === 0) throw new Error("Jenis pelanggaran dan siswa harus dipilih.");
                    const records: Database['public']['Tables']['violations']['Insert'][] = Array.from(selectedStudentIds).map(student_id => ({
                        date: violationDate, description: selectedViolation.description, points: selectedViolation.points, student_id, user_id: user.id
                    }));
                    const { error } = await supabase.from('violations').insert(records);
                    if (error) throw error;
                    break;
                }
            }
        },
        onSuccess: () => { toast.success("Data berhasil disimpan!"); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
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
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { systemInstruction, responseMimeType: "application/json", responseSchema }
            });

            const parsedResults = JSON.parse(response.text.trim()) as ReviewDataItem[];
            
            const newScores: Record<string, string> = {};
            let matchedCount = 0;
            parsedResults.forEach(item => {
                const student = students.find(s => s.name.toLowerCase() === item.studentName.toLowerCase());
                if (student) {
                    newScores[student.id] = String(item.score);
                    matchedCount++;
                }
            });
            setScores(prev => ({...prev, ...newScores}));
            toast.success(`${matchedCount} dari ${parsedResults.length} nilai berhasil dicocokkan dan diisi.`);
        } catch (error) {
            console.error("AI Parsing Error:", error);
            toast.error("Gagal memproses data. Pastikan format teks benar.");
        } finally {
            setIsParsing(false);
        }
    };
    
    const fetchReportDataForStudent = async (studentId: string, userId: string): Promise<ReportDataType> => {
        const studentRes = await supabase.from('students').select('*').eq('id', studentId).eq('user_id', userId).single();
        if (studentRes.error) throw new Error(studentRes.error.message);
        
        const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes, classRes] = await Promise.all([
            supabase.from('reports').select('*').eq('student_id', studentId),
            supabase.from('attendance').select('*').eq('student_id', studentId),
            supabase.from('academic_records').select('*').eq('student_id', studentId),
            supabase.from('violations').select('*').eq('student_id', studentId),
            supabase.from('quiz_points').select('*').eq('student_id', studentId),
            supabase.from('classes').select('id, name').eq('id', studentRes.data.class_id).single()
        ]);
        const errors = [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes, classRes].map(r => r.error).filter(Boolean);
        if (errors.length > 0) throw new Error(errors.map(e => e!.message).join(', '));
        
        const studentWithClass = { ...studentRes.data, classes: classRes.data ? { id: classRes.data.id, name: classRes.data.name } : null };
        
        return { student: studentWithClass, reports: reportsRes.data || [], attendanceRecords: attendanceRes.data || [], academicRecords: academicRes.data || [], violations: violationsRes.data || [], quizPoints: quizPointsRes.data || [] };
    };

    const handlePrintBulkReports = async () => {
        if (selectedStudentIds.size === 0) {
            toast.warning("Pilih setidaknya satu siswa untuk mencetak rapor.");
            return;
        }
        setIsExporting(true);
        setExportProgress("0%");
        toast.info(`Mulai proses cetak ${selectedStudentIds.size} rapor...`);
    
        const studentsToPrint = (students || []).filter(s => selectedStudentIds.has(s.id));
    
        try {
            // 1. Fetch all data in parallel
            setExportProgress("10%");
            toast.info("Mengambil data siswa...");
            const allReportData = await Promise.all(
                studentsToPrint.map(student => fetchReportDataForStudent(student.id, user!.id))
            );
    
            setExportProgress("40%");
            toast.info("Membuat catatan guru...");
    
            let teacherNotesMap: Map<string, string>;
    
            if (noteMethod === 'template') {
                teacherNotesMap = new Map(
                    allReportData.map(data => [
                        data.student.id,
                        templateNote.replace(/\[Nama Siswa\]/g, data.student.name)
                    ])
                );
            } else {
                // Batch AI Note Generation
                const studentDataForPrompt = allReportData.map(data => {
                    const academicSummary = data.academicRecords.length > 0
                        ? `Nilai rata-rata: ${Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)}. Pelajaran terbaik: ${[...data.academicRecords].sort((a, b) => b.score - a.score)[0]?.subject || 'N/A'}.`
                        : 'Belum ada data nilai.';
    
                    const behaviorSummary = data.violations.length > 0
                        ? `${data.violations.length} pelanggaran dengan total ${data.violations.reduce((sum, v) => sum + v.points, 0)} poin.`
                        : 'Perilaku baik, tidak ada pelanggaran.';
                    
                    const attendanceSummary = `Sakit: ${data.attendanceRecords.filter(r=>r.status === 'Sakit').length}, Izin: ${data.attendanceRecords.filter(r=>r.status === 'Izin').length}, Alpha: ${data.attendanceRecords.filter(r=>r.status === 'Alpha').length}.`;
    
                    return { studentId: data.student.id, studentName: data.student.name, academicSummary, behaviorSummary, attendanceSummary };
                });
    
                const systemInstruction = `Anda adalah seorang guru wali kelas yang bijaksana dan suportif. Tugas Anda adalah menulis paragraf "Catatan Wali Kelas" untuk setiap siswa berdasarkan data yang diberikan. Catatan harus holistik, memotivasi, dan dalam satu paragraf (3-5 kalimat). Jawab dalam format JSON array yang diminta.`;
                const prompt = `Buatkan "Catatan Wali Kelas" untuk setiap siswa dalam daftar JSON berikut. Data Siswa: ${JSON.stringify(studentDataForPrompt)}`;
                const responseSchema = { type: Type.OBJECT, properties: { notes: { type: Type.ARRAY, description: "Array of teacher notes for each student.", items: { type: Type.OBJECT, properties: { studentId: { type: Type.STRING, description: "The student's unique ID." }, teacherNote: { type: Type.STRING, description: "The generated teacher's note for the student's report card." } }, required: ["studentId", "teacherNote"] } } }, required: ["notes"] };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', contents: prompt,
                    config: { systemInstruction, responseMimeType: "application/json", responseSchema }
                });
    
                const parsedResponse = JSON.parse(response.text);
                const parsedNotes = parsedResponse.notes as { studentId: string; teacherNote: string }[];
                teacherNotesMap = new Map(parsedNotes.map(item => [item.studentId, item.teacherNote.replace(/\\n/g, ' ')]));
            }
    
            setExportProgress("70%");
            toast.info("Menyusun file PDF...");
    
            // 3. Generate PDF
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            let isFirstPage = true;
    
            for (let i = 0; i < allReportData.length; i++) {
                const reportData = allReportData[i];
                const teacherNote = teacherNotesMap.get(reportData.student.id) || "Catatan tidak dapat dibuat.";
                
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;
                
                generateStudentReport(doc, reportData, teacherNote, user);
    
                const progress = `${Math.round(70 + ((i + 1) / studentsToPrint.length) * 30)}%`;
                setExportProgress(progress);
            }
    
            doc.save(`Rapor_Massal_${classes?.find(c => c.id === selectedClass)?.name || 'Kelas'}.pdf`);
            toast.success("Semua rapor terpilih berhasil digabung dalam satu PDF!");
    
        } catch (err) {
            console.error("Gagal membuat rapor massal:", err);
            toast.error(`Gagal membuat rapor massal: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsExporting(false);
        }
    };
    

    const handlePrintGrades = async () => {
        if (!selectedClass || !subjectGradeInfo.subject) { toast.warning("Pilih kelas dan mata pelajaran."); return; }
        if (selectedStudentIds.size === 0) { toast.warning("Pilih setidaknya satu siswa untuk mencetak."); return; }
        setIsExporting(true);
        toast.info("Membuat rekap nilai...");
    
        const doc = new jsPDF();
        const className = classes?.find(c => c.id === selectedClass)?.name;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Kelas: ${className}`, 14, 22);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'numeric', year: 'numeric'})}`, 14, 30);
        
        const tableData = (students || [])
            .filter(s => selectedStudentIds.has(s.id))
            .map((s, index) => {
                const record = academicRecords?.find(r => r.student_id === s.id);
                return [
                    index + 1,
                    s.name,
                    record ? record.score : 'N/A'
                ];
            });
        
        autoTable(doc, {
            startY: 40,
            head: [['No', 'Nama Siswa', 'Nilai']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [81, 91, 212] },
            styles: {
                font: 'helvetica',
                lineColor: '#dee2e6',
                lineWidth: 0.1
            },
        });

        doc.save(`Nilai_${subjectGradeInfo.subject.replace(/\s/g, '_')}_${className}.pdf`);
        toast.success("Rekap nilai berhasil diunduh.");
        setIsExporting(false);
    };


    if (step === 1) {
        return (
            <div className="w-full min-h-full p-4 sm:p-6 md:p-8 flex items-center justify-center">
                <Step1_ModeSelection handleModeSelect={handleModeSelect} />
            </div>
        );
    }
    
    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8">
            {mode && (
                <Step2_ConfigurationAndInput
                    mode={mode}
                    handleBack={handleBack}
                    classes={classes}
                    selectedClass={selectedClass}
                    setSelectedClass={setSelectedClass}
                    isLoadingClasses={isLoadingClasses}
                    quizInfo={quizInfo}
                    setQuizInfo={setQuizInfo}
                    subjectGradeInfo={subjectGradeInfo}
                    setSubjectGradeInfo={setSubjectGradeInfo}
                    scores={scores}
                    setScores={setScores}
                    pasteData={pasteData}
                    setPasteData={setPasteData}
                    handleAiParse={handleAiParse}
                    isParsing={isParsing}
                    selectedViolationCode={selectedViolationCode}
                    setSelectedViolationCode={setSelectedViolationCode}
                    violationDate={violationDate}
                    setViolationDate={setViolationDate}
                    selectedViolation={selectedViolation}
                    students={students}
                    isLoadingStudents={isLoadingStudents}
                    selectedStudentIds={selectedStudentIds}
                    handleSelectAllStudents={handleSelectAllStudents}
                    handleStudentSelect={handleStudentSelect}
                    isAllSelected={isAllSelected}
                    isExporting={isExporting}
                    exportProgress={exportProgress}
                    handlePrintBulkReports={handlePrintBulkReports}
                    handlePrintGrades={handlePrintGrades}
                    handleSubmit={submitData}
                    isSubmitting={isSubmitting}
                    isOnline={isOnline}
                    gradedCount={gradedCount}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    noteMethod={noteMethod}
                    setNoteMethod={setNoteMethod}
                    templateNote={templateNote}
                    setTemplateNote={setTemplateNote}
                    uniqueSubjects={uniqueSubjects}
                />
            )}
        </div>
    );
};

export default MassInputPage;