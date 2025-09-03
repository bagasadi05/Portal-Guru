import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AttendanceStatus } from '../../types';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, FileTextIcon, UserCircleIcon, BarChartIcon, PencilIcon, TrashIcon, BookOpenIcon, SparklesIcon, ClockIcon, TrendingUpIcon, PlusIcon, BrainCircuitIcon, CameraIcon, ShieldAlertIcon, KeyRoundIcon, CopyIcon, CopyCheckIcon, MessageSquareIcon, SendIcon, UsersIcon, PrinterIcon, Share2Icon } from '../Icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Modal } from '../ui/Modal';
import { Type } from '@google/genai';
import { supabase, ai } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Switch } from '../ui/Switch';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { optimizeImage } from '../utils/image';
import { violationList, ViolationItem } from '../../services/violations.data';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type CommunicationRow = Database['public']['Tables']['communications']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };
type StudentDetailsData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    quizPoints: QuizPointRow[],
    violations: ViolationRow[],
    classes: ClassRow[],
    communications: CommunicationRow[],
};

type ModalState = 
    | { type: 'closed' }
    | { type: 'editStudent', data: StudentWithClass }
    | { type: 'report', data: ReportRow | null }
    | { type: 'academic', data: AcademicRecordRow | null }
    | { type: 'quiz', data: QuizPointRow | null }
    | { type: 'violation', mode: 'add' | 'edit', data: ViolationRow | null }
    | { type: 'confirmDelete', title: string; message: string; onConfirm: () => void; isPending: boolean }
    | { type: 'applyPoints' }
    | { type: 'editCommunication', data: CommunicationRow };

type AiSummary = {
    general_evaluation: string;
    strengths: string[];
    development_focus: string[];
    recommendations: string[];
};

// Mutation variable types
type StudentMutationVars = Database['public']['Tables']['students']['Update'];
type ReportMutationVars = { operation: 'add', data: Database['public']['Tables']['reports']['Insert'] } | { operation: 'edit', data: Database['public']['Tables']['reports']['Update'], id: string };
type AcademicMutationVars = { operation: 'add', data: Database['public']['Tables']['academic_records']['Insert'] } | { operation: 'edit', data: Database['public']['Tables']['academic_records']['Update'], id: string };
type QuizMutationVars = { operation: 'add', data: Database['public']['Tables']['quiz_points']['Insert'] } | { operation: 'edit', data: Database['public']['Tables']['quiz_points']['Update'], id: number };
type ViolationMutationVars = { operation: 'add', data: Database['public']['Tables']['violations']['Insert'] } | { operation: 'edit', data: Database['public']['Tables']['violations']['Update'], id: string };
type CommunicationMutationVars = { operation: 'edit', data: { message: string }, id: string };


const AiStudentSummary: React.FC<{ studentDetails: StudentDetailsData }> = ({ studentDetails }) => {
    const [summary, setSummary] = useState<AiSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    const generateSummary = async () => {
        setIsLoading(true);
        try {
            const { student, academicRecords, attendanceRecords, violations } = studentDetails;
            const systemInstruction = `Anda adalah seorang konselor akademik AI yang ahli dalam merangkum performa siswa secara holistik. Berikan ringkasan yang seimbang, menyoroti hal positif sambil memberikan saran konstruktif. Gunakan Bahasa Indonesia yang formal namun memotivasi. Format output harus JSON sesuai skema.`;
            
            const academicSummary = academicRecords.length > 0
                ? `Memiliki ${academicRecords.length} catatan nilai dengan rata-rata ${Math.round(academicRecords.reduce((sum, r) => sum + r.score, 0) / academicRecords.length)}.`
                : 'Belum ada data nilai akademik.';

            const attendanceSummary = `Memiliki ${attendanceRecords.filter(r => r.status === 'Alpha').length} hari alpha, ${attendanceRecords.filter(r => r.status === 'Izin').length} hari izin, dan ${attendanceRecords.filter(r => r.status === 'Sakit').length} hari sakit.`;

            const behaviorSummary = violations.length > 0
                ? `Terdapat ${violations.length} catatan pelanggaran dengan total ${violations.reduce((sum, v) => sum + v.points, 0)} poin.`
                : 'Tidak ada catatan pelanggaran, menunjukkan perilaku yang baik.';
            
            const prompt = `
            Analisis data siswa berikut untuk membuat ringkasan performa holistik.
            Nama Siswa: ${student.name}
            Data Akademik: ${academicSummary}
            Data Kehadiran: ${attendanceSummary}
            Data Perilaku: ${behaviorSummary}

            Tugas:
            1.  **general_evaluation**: Berikan evaluasi umum 1-2 kalimat.
            2.  **strengths**: Identifikasi 1-2 kekuatan utama siswa (bisa dari akademik, kehadiran, atau perilaku).
            3.  **development_focus**: Identifikasi 1-2 area utama yang memerlukan perhatian atau pengembangan.
            4.  **recommendations**: Berikan 1-2 rekomendasi konkret dan positif untuk siswa atau guru.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    general_evaluation: { type: Type.STRING, description: 'Evaluasi umum 1-2 kalimat.' },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 kekuatan utama.' },
                    development_focus: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 area fokus pengembangan.' },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 rekomendasi konkret.' }
                },
                required: ["general_evaluation", "strengths", "development_focus", "recommendations"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { systemInstruction, responseMimeType: "application/json", responseSchema }
            });

            setSummary(JSON.parse(response.text) as AiSummary);

        } catch (error) {
            console.error("Failed to generate AI summary:", error);
            toast.error("Gagal membuat ringkasan AI.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <BrainCircuitIcon className="w-6 h-6 text-purple-400"/>
                    <span>Ringkasan Performa AI</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-3/4 animate-pulse"></div>
                    </div>
                ) : summary ? (
                    <div className="space-y-4 text-sm">
                        <p className="text-gray-300 italic">"{summary.general_evaluation}"</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                            <div><h5 className="font-bold text-green-400 mb-1">Kekuatan</h5><ul className="list-disc list-inside space-y-1 text-gray-400">{summary.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                            <div><h5 className="font-bold text-yellow-400 mb-1">Fokus Pengembangan</h5><ul className="list-disc list-inside space-y-1 text-gray-400">{summary.development_focus.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
                            <div><h5 className="font-bold text-blue-400 mb-1">Rekomendasi</h5><ul className="list-disc list-inside space-y-1 text-gray-400">{summary.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <Button onClick={generateSummary} disabled={isLoading}>
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            Buat Ringkasan Performa AI
                        </Button>
                        <p className="text-xs text-gray-400 mt-2">Dapatkan evaluasi holistik performa siswa.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const StatCard: React.FC<{ icon: React.FC<any>, label: string, value: string | number, color: string }> = ({ icon: Icon, label, value, color }) => (
    <Card className="p-4">
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${color}`}>
                 <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-400">{label}</p>
            </div>
        </div>
    </Card>
);

const GradesHistory: React.FC<{ records: AcademicRecordRow[], onEdit: (record: AcademicRecordRow) => void, onDelete: (recordId: string) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
    if (!records || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <BarChartIcon className="w-16 h-16 mb-4 text-gray-600" />
                <h4 className="text-lg font-semibold">Tidak Ada Data Nilai Mata Pelajaran</h4>
                <p className="text-sm">Nilai yang Anda tambahkan akan muncul di sini.</p>
            </div>
        );
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const getScoreColorClasses = (score: number) => {
        if (score >= 85) return { bg: 'bg-green-900/30', border: 'border-green-600', scoreBg: 'bg-green-500' };
        if (score >= 70) return { bg: 'bg-yellow-900/30', border: 'border-yellow-600', scoreBg: 'bg-yellow-500' };
        return { bg: 'bg-red-900/30', border: 'border-red-600', scoreBg: 'bg-red-500' };
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRecords.map((record) => {
                const colors = getScoreColorClasses(record.score);
                return (
                    <div key={record.id} className={`group relative p-4 rounded-xl border-2 ${colors.border} ${colors.bg} hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-1`}>
                        <div className="flex items-center gap-4">
                             <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-3xl text-white ${colors.scoreBg} shadow-inner`}>
                                {record.score}
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-extrabold text-lg text-white">{record.subject}</h4>
                                <p className="text-xs text-gray-400 font-medium">
                                    {new Date(record.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        {record.notes && <p className="text-sm text-gray-400 mt-3 pt-3 border-t-2 border-dashed border-white/10 italic">"{record.notes}"</p>}
                         <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/30 backdrop-blur-sm" onClick={() => onEdit(record)} aria-label="Edit Catatan Akademik" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 bg-black/30 backdrop-blur-sm" onClick={() => onDelete(record.id)} aria-label="Hapus Catatan Akademik" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ActivityPointsHistory: React.FC<{ records: QuizPointRow[], onEdit: (record: QuizPointRow) => void, onDelete: (recordId: number) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
    if (!records || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <CheckCircleIcon className="w-16 h-16 mb-4 text-gray-600" />
                <h4 className="text-lg font-semibold">Tidak Ada Poin Keaktifan</h4>
                <p className="text-sm">Poin yang Anda tambahkan akan muncul di sini.</p>
            </div>
        );
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.quiz_date).getTime() - new Date(a.quiz_date).getTime());

    return (
        <div className="space-y-3">
            {sortedRecords.map((record) => (
                <div key={record.id} className="group flex items-center gap-4 p-3 rounded-lg bg-black/20 hover:bg-black/30 transition-all">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl bg-green-900/40 text-green-200">
                        +1
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold text-white">{record.quiz_name}</p>
                        <p className="text-xs text-gray-400">
                            {record.subject} &middot; {new Date(record.quiz_date).toLocaleDateString('id-ID')}
                        </p>
                    </div>
                     <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(record)} aria-label="Edit Poin" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => onDelete(record.id)} aria-label="Hapus Poin" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const generateAccessCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const StudentDetailPage = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isOnline = useOfflineStatus();
    const toast = useToast();
    const queryClient = useQueryClient();
    const [modalState, setModalState] = useState<ModalState>({ type: 'closed' });
    const [activeTab, setActiveTab] = useState('grades');
    const [copied, setCopied] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [subjectToApply, setSubjectToApply] = useState('');
    
    useEffect(() => {
        if (location.state?.openTab) {
            setActiveTab(location.state.openTab);
        }
    }, [location.state]);

    const { data: studentDetails, isLoading, isError, error: queryError } = useQuery<StudentDetailsData>({
        queryKey: ['studentDetails', studentId],
        queryFn: async () => {
            if (!studentId || !user) throw new Error("User or Student ID not found");
            const studentRes = await supabase.from('students').select('*').eq('id', studentId).eq('user_id', user.id).single();
            if (studentRes.error) throw new Error(studentRes.error.message);
            
            const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes, classesRes, commsRes] = await Promise.all([
                supabase.from('reports').select('*').eq('student_id', studentId),
                supabase.from('attendance').select('*').eq('student_id', studentId),
                supabase.from('academic_records').select('*').eq('student_id', studentId),
                supabase.from('violations').select('*').eq('student_id', studentId),
                supabase.from('quiz_points').select('*').eq('student_id', studentId),
                supabase.from('classes').select('*').eq('user_id', user.id),
                supabase.from('communications').select('*').eq('student_id', studentId).order('created_at', { ascending: true }),
            ]);

            // Combine error handling
            const errors = [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes, classesRes, commsRes].map(r => r.error).filter(Boolean);
            if (errors.length > 0) throw new Error(errors.map(e => e!.message).join(', '));
            
            const studentData = studentRes.data;
            const classInfo = (classesRes.data || []).find(c => c.id === studentData.class_id);
            const studentWithClass = { ...studentData, classes: classInfo ? { id: classInfo.id, name: classInfo.name } : null };


            return {
                student: studentWithClass,
                reports: reportsRes.data || [],
                attendanceRecords: attendanceRes.data || [],
                academicRecords: academicRes.data || [],
                violations: violationsRes.data || [],
                quizPoints: quizPointsRes.data || [],
                classes: classesRes.data || [],
                communications: commsRes.data || [],
            };
        },
        enabled: !!studentId && !!user,
    });
    
    // Mutations setup
    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
            setModalState({ type: 'closed' });
            toast.success("Data berhasil disimpan!");
        },
        onError: (error: Error) => { toast.error(error.message); },
    };

    const studentMutation = useMutation({
        mutationFn: async (data: StudentMutationVars) => {
            const { error } = await supabase.from('students').update(data).eq('id', studentId!);
            if (error) throw error;
        },
        ...mutationOptions
    });

    const reportMutation = useMutation({
        mutationFn: async (vars: ReportMutationVars) => {
            if (vars.operation === 'add') {
                const { error } = await supabase.from('reports').insert(vars.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('reports').update(vars.data).eq('id', vars.id);
                if (error) throw error;
            }
        },
        ...mutationOptions
    });

    const academicMutation = useMutation({
        mutationFn: async (vars: AcademicMutationVars) => {
            if (vars.operation === 'add') {
                const { error } = await supabase.from('academic_records').insert(vars.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('academic_records').update(vars.data).eq('id', vars.id);
                if (error) throw error;
            }
        },
        ...mutationOptions
    });

    const quizMutation = useMutation({
        mutationFn: async (vars: QuizMutationVars) => {
            if (vars.operation === 'add') {
                const { error } = await supabase.from('quiz_points').insert(vars.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('quiz_points').update(vars.data).eq('id', vars.id);
                if (error) throw error;
            }
        },
        ...mutationOptions
    });

    const violationMutation = useMutation({
        mutationFn: async (vars: ViolationMutationVars) => {
            if (vars.operation === 'add') {
                const { error } = await supabase.from('violations').insert(vars.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('violations').update(vars.data).eq('id', vars.id);
                if (error) throw error;
            }
        },
        ...mutationOptions
    });
    
    const communicationMutation = useMutation({
        mutationFn: async (vars: CommunicationMutationVars) => {
            const { error } = await supabase.from('communications').update(vars.data).eq('id', vars.id);
            if (error) throw error;
        },
        ...mutationOptions
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ table, id }: { table: keyof Database['public']['Tables'], id: string | number }) => {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_d, v) => {
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
            toast.success(`Data dari tabel ${v.table} berhasil dihapus.`);
        },
        onError: (error: Error) => { toast.error(error.message); }
    });

    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            if (!user || !studentId) throw new Error("Data tidak lengkap");
            const { error } = await supabase.from('communications').insert({
                student_id: studentId,
                user_id: user.id,
                message: messageText,
                sender: 'teacher',
                is_read: false
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setNewMessage('');
        },
        onError: (error: Error) => toast.error(error.message)
    });
    
    const applyPointsMutation = useMutation({
        mutationFn: async (subject: string) => {
            if (!studentId || !user) throw new Error("Data tidak lengkap");
            const { error } = await supabase.rpc('apply_quiz_points_to_grade', {
                student_id_param: studentId,
                subject_param: subject,
                user_id_param: user.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
            toast.success("Poin berhasil diterapkan dan nilai diperbarui!");
        },
        onError: (err: Error) => toast.error(`Gagal menerapkan poin: ${err.message}`)
    });

    // Handlers
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user || !studentId) return;
        const formData = new FormData(e.currentTarget);
        const rawData = Object.fromEntries(formData.entries());
        
        switch (modalState.type) {
            case 'editStudent':
                const studentPayload: StudentMutationVars = {
                    name: rawData.name as string,
                    gender: rawData.gender as "Laki-laki" | "Perempuan",
                    class_id: rawData.class_id as string,
                };
                studentMutation.mutate(studentPayload);
                break;
            case 'report':
                const reportPayload = {
                    date: rawData.date as string,
                    title: rawData.title as string,
                    notes: rawData.notes as string,
                    student_id: studentId,
                    user_id: user.id,
                };
                if (modalState.data?.id) {
                    reportMutation.mutate({ operation: 'edit', data: reportPayload, id: modalState.data.id });
                } else {
                    reportMutation.mutate({ operation: 'add', data: reportPayload });
                }
                break;
            case 'academic':
                const academicPayload = {
                    subject: rawData.subject as string,
                    score: Number(rawData.score),
                    notes: rawData.notes as string,
                    student_id: studentId,
                    user_id: user.id,
                };
                 if (modalState.data?.id) {
                    academicMutation.mutate({ operation: 'edit', data: academicPayload, id: modalState.data.id });
                } else {
                    academicMutation.mutate({ operation: 'add', data: academicPayload });
                }
                break;
            case 'quiz':
                 const quizPayload = {
                    quiz_date: rawData.quiz_date as string,
                    subject: rawData.subject as string,
                    quiz_name: rawData.quiz_name as string,
                    points: 1,
                    max_points: 1,
                    student_id: studentId,
                    user_id: user.id,
                };
                if (modalState.data?.id) {
                    quizMutation.mutate({ operation: 'edit', data: quizPayload, id: modalState.data.id });
                } else {
                    quizMutation.mutate({ operation: 'add', data: quizPayload });
                }
                break;
            case 'violation':
                const selectedViolation = violationList.find(v => v.description === rawData.description);
                const violationPayload = {
                    date: rawData.date as string,
                    description: rawData.description as string,
                    points: selectedViolation?.points || 0,
                    student_id: studentId,
                    user_id: user.id,
                };
                 if (modalState.data?.id) {
                    violationMutation.mutate({ operation: 'edit', data: violationPayload, id: modalState.data.id });
                } else {
                    violationMutation.mutate({ operation: 'add', data: violationPayload });
                }
                break;
            case 'editCommunication':
                const commPayload = { message: rawData.message as string };
                communicationMutation.mutate({ operation: 'edit', data: commPayload, id: modalState.data.id });
                break;
        }
    };
    
    const handleDelete = (table: keyof Database['public']['Tables'], id: string | number) => {
        setModalState({ type: 'confirmDelete', title: 'Konfirmasi Hapus', message: 'Apakah Anda yakin ingin menghapus data ini secara permanen?', onConfirm: () => deleteMutation.mutate({ table, id }), isPending: deleteMutation.isPending });
    };
    
    const attendanceSummary = useMemo(() => {
        const summary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
        studentDetails?.attendanceRecords.forEach(rec => { summary[rec.status as AttendanceStatus]++; });
        return summary;
    }, [studentDetails?.attendanceRecords]);
    
    const totalViolationPoints = useMemo(() => studentDetails?.violations.reduce((sum, v) => sum + v.points, 0) || 0, [studentDetails?.violations]);
    const unreadMessagesCount = useMemo(() => studentDetails?.communications.filter(m => m.sender === 'parent' && !m.is_read).length || 0, [studentDetails?.communications]);

    const handleCopyAccessCode = () => {
        if (!studentDetails?.student.access_code) return;
        navigator.clipboard.writeText(studentDetails.student.access_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGenerateAccessCode = async () => {
        if (!studentId || studentMutation.isPending) return;
        const newCode = generateAccessCode();
        studentMutation.mutate({ access_code: newCode });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !studentId) return;
        setIsUploadingPhoto(true);
        const file = e.target.files[0];
        try {
            const optimizedBlob = await optimizeImage(file, { maxWidth: 300, quality: 0.8 });
            const filePath = `student_avatars/${studentId}-${new Date().getTime()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('student_assets').upload(filePath, optimizedBlob, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('student_assets').getPublicUrl(filePath);
            studentMutation.mutate({ avatar_url: publicUrlData.publicUrl });
        } catch (error: any) {
            toast.error(`Gagal unggah foto: ${error.message}`);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (activeTab === 'communication' && studentDetails?.communications) {
                const unreadIds = studentDetails.communications
                    .filter(m => m.sender === 'parent' && !m.is_read)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    const { error } = await supabase
                        .from('communications')
                        .update({ is_read: true })
                        .in('id', unreadIds);
                    
                    if (error) {
                        console.error("Failed to mark messages as read:", error);
                    } else {
                        // Invalidate to refetch and update UI
                        queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
                    }
                }
            }
        };
        markMessagesAsRead();
    }, [activeTab, studentDetails?.communications, studentId, queryClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [studentDetails?.communications]);

    const handleShare = () => {
        if (navigator.share && studentDetails?.student.access_code) {
            navigator.share({
                title: `Akses Portal Siswa - ${studentDetails.student.name}`,
                text: `Gunakan kode akses ${studentDetails.student.access_code} untuk melihat perkembangan ${studentDetails.student.name} di portal siswa.`,
                url: window.location.origin,
            })
            .then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error));
        } else {
            toast.info("Fitur berbagi tidak didukung di browser ini. Silakan salin kodenya secara manual.");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const { student, reports, academicRecords, quizPoints, violations, classes, communications } = studentDetails || {};
    
    const uniqueSubjectsForGrades = useMemo(() => {
        if (!academicRecords) return [];
        const subjects = academicRecords.map(r => r.subject);
        return [...new Set(subjects)];
    }, [academicRecords]);

    const currentRecordForSubject = useMemo(() => {
        if (!subjectToApply || !academicRecords) return null;
        return academicRecords
            .filter(r => r.subject === subjectToApply)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    }, [subjectToApply, academicRecords]);

    useEffect(() => {
        if (modalState.type === 'applyPoints') {
            setSubjectToApply(uniqueSubjectsForGrades.length > 0 ? uniqueSubjectsForGrades[0] : '');
        } else {
            setSubjectToApply('');
        }
    }, [modalState.type, uniqueSubjectsForGrades]);

    const handleApplyPointsSubmit = () => {
        if (!subjectToApply) {
            toast.error("Silakan pilih mata pelajaran.");
            return;
        }
        applyPointsMutation.mutate(subjectToApply);
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (isError) return <div className="flex items-center justify-center h-screen">Error: {(queryError as Error).message}</div>;
    if (!studentDetails || !student) return null;


    return (
        <div className="space-y-8 p-4 md:p-6 animate-fade-in-up bg-gray-950 min-h-full">
            <div className="no-print">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Kembali" className="bg-white/10 border-white/20 hover:bg-white/20 text-white"><ArrowLeftIcon className="w-5 h-5" /></Button>
                        <div className="relative">
                            <img src={student.avatar_url || `https://i.pravatar.cc/150?u=${student.id}`} alt={student.name} className="w-20 h-20 rounded-full object-cover border-4 border-white/10 shadow-lg" />
                            <input type="file" ref={photoInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" disabled={isUploadingPhoto || !isOnline} />
                            <button onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto || !isOnline} className="absolute -bottom-1 -right-1 p-1.5 bg-purple-600 text-white rounded-full shadow-md hover:scale-110 transition-transform"><CameraIcon className="w-4 h-4"/></button>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{student.name}</h1>
                            <p className="text-md text-gray-400">Kelas {student.classes?.name || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-center">
                        <Button variant="outline" onClick={() => setModalState({ type: 'editStudent', data: student })} disabled={!isOnline} className="bg-white/10 border-white/20 hover:bg-white/20 text-white"><UserCircleIcon className="w-4 h-4 mr-2" />Edit Profil</Button>
                        <Link to={`/cetak-rapot/${studentId}`}><Button><FileTextIcon className="w-4 h-4 mr-2" />Cetak Rapor</Button></Link>
                    </div>
                </header>
                
                <AiStudentSummary studentDetails={studentDetails} />
                
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={CheckCircleIcon} label="Total Kehadiran" value={`${attendanceSummary.Hadir} hari`} color="from-green-500 to-emerald-400" />
                    <StatCard icon={AlertCircleIcon} label="Total Izin/Sakit" value={`${attendanceSummary.Izin + attendanceSummary.Sakit} hari`} color="from-yellow-500 to-amber-400" />
                    <StatCard icon={XCircleIcon} label="Total Alpha" value={`${attendanceSummary.Alpha} hari`} color="from-orange-500 to-red-400" />
                    <StatCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} color="from-red-500 to-rose-400" />
                </section>

                <Card>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <div className="flex justify-center border-b border-white/10 px-6">
                          <TabsList className="bg-black/20">
                              <TabsTrigger value="grades">Nilai</TabsTrigger>
                              <TabsTrigger value="activity">Keaktifan</TabsTrigger>
                              <TabsTrigger value="violations">Pelanggaran</TabsTrigger>
                              <TabsTrigger value="reports">Catatan Guru</TabsTrigger>
                              <TabsTrigger value="communication">
                                <div className="relative">Komunikasi
                                {unreadMessagesCount > 0 && <span className="absolute -top-1 -right-3 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{unreadMessagesCount}</span>}
                                </div>
                              </TabsTrigger>
                              <TabsTrigger value="portal">Portal Ortu</TabsTrigger>
                          </TabsList>
                      </div>
                      <TabsContent value="grades" className="p-6">
                          <div className="flex justify-between items-center mb-4">
                            <div><CardTitle>Nilai Akademik</CardTitle><CardDescription>Daftar nilai sumatif atau formatif yang telah diinput.</CardDescription></div>
                            <Button onClick={() => setModalState({ type: 'academic', data: null })} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Nilai</Button>
                          </div>
                          <GradesHistory records={academicRecords} onEdit={(r) => setModalState({type: 'academic', data: r})} onDelete={(id) => handleDelete('academic_records', id)} isOnline={isOnline} />
                      </TabsContent>
                      <TabsContent value="activity" className="p-6">
                          <div className="flex justify-between items-center mb-4">
                            <div><CardTitle>Poin Keaktifan Kelas</CardTitle><CardDescription>Catatan poin untuk keaktifan siswa saat pelajaran.</CardDescription></div>
                            <Button onClick={() => setModalState({ type: 'quiz', data: null })} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Poin</Button>
                          </div>
                           {quizPoints.length > 0 && (
                                <div className="mb-4 p-4 bg-purple-900/20 rounded-xl flex items-center justify-between animate-fade-in">
                                    <div>
                                        <p className="font-bold text-white">Total {quizPoints.length} Poin Tersedia</p>
                                        <p className="text-sm text-purple-300">Gunakan poin ini untuk menambah nilai akhir mata pelajaran.</p>
                                    </div>
                                    <Button onClick={() => setModalState({ type: 'applyPoints' })} variant="outline" className="bg-white/10 border-purple-400/50 hover:bg-purple-500/20 text-purple-300 hover:text-white">
                                        <TrendingUpIcon className="w-4 h-4 mr-2"/> Gunakan Poin
                                    </Button>
                                </div>
                            )}
                          <ActivityPointsHistory records={quizPoints} onEdit={(r) => setModalState({type: 'quiz', data: r})} onDelete={(id) => handleDelete('quiz_points', id)} isOnline={isOnline} />
                      </TabsContent>
                      <TabsContent value="violations" className="p-6">
                          <div className="flex justify-between items-center mb-4">
                            <div><CardTitle>Riwayat Pelanggaran</CardTitle><CardDescription>Semua catatan pelanggaran tata tertib sekolah.</CardDescription></div>
                            <Button onClick={() => setModalState({ type: 'violation', mode: 'add', data: null })} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Pelanggaran</Button>
                          </div>
                          {violations.length > 0 ? (<div className="space-y-3">{[...violations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(v => (<div key={v.id} className="group flex items-center gap-4 p-3 rounded-lg bg-red-900/20"><div><p className="font-semibold text-white">{v.description}</p><p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')} - <span className="font-bold text-red-400">{v.points} poin</span></p></div><div className="ml-auto flex opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalState({ type: 'violation', mode: 'edit', data: v})} disabled={!isOnline}><PencilIcon className="h-4 h-4"/></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleDelete('violations', v.id)} disabled={!isOnline}><TrashIcon className="h-4 h-4"/></Button></div></div>))}</div>) : (<div className="text-center py-16 text-gray-400"><ShieldAlertIcon className="w-16 h-16 mx-auto mb-4 text-gray-600"/><h4 className="font-semibold">Tidak Ada Pelanggaran</h4><p>Siswa ini memiliki catatan perilaku yang bersih.</p></div>)}
                      </TabsContent>
                      <TabsContent value="reports" className="p-6">
                           <div className="flex justify-between items-center mb-4">
                            <div><CardTitle>Catatan Guru</CardTitle><CardDescription>Catatan perkembangan, laporan, atau insiden khusus.</CardDescription></div>
                            <Button onClick={() => setModalState({ type: 'report', data: null })} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Catatan</Button>
                           </div>
                           {reports.length > 0 ? (<div className="space-y-3">{[...reports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => (<div key={r.id} className="group relative p-4 rounded-lg bg-black/20"><div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalState({ type: 'report', data: r})} disabled={!isOnline}><PencilIcon className="h-4 h-4"/></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleDelete('reports', r.id)} disabled={!isOnline}><TrashIcon className="h-4 h-4"/></Button></div><h4 className="font-bold text-white">{r.title}</h4><p className="text-xs text-gray-400 mb-2">{new Date(r.date).toLocaleDateString('id-ID')}</p><p className="text-sm text-gray-300">{r.notes}</p></div>))}</div>) : (<div className="text-center py-16 text-gray-400"><BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-gray-600"/><h4 className="font-semibold">Tidak Ada Catatan</h4><p>Belum ada catatan guru untuk siswa ini.</p></div>)}
                      </TabsContent>
                      <TabsContent value="communication">
                          <div className="flex flex-col h-[70vh]">
                            <div className="p-6"><CardTitle className="flex items-center gap-2"><MessageSquareIcon className="w-5 h-5 text-blue-400"/>Komunikasi dengan Orang Tua</CardTitle></div>
                            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-black/20">
                                {communications.map(msg => (
                                    <div key={msg.id} className={`group flex items-start gap-3 ${msg.sender === 'teacher' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.sender === 'parent' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UsersIcon className="w-5 h-5 text-gray-300" /></div>}
                                        <div className={`relative max-w-md p-3 rounded-2xl text-sm ${msg.sender === 'teacher' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                            <div className={`flex items-center gap-1 text-xs mt-1 ${msg.sender === 'teacher' ? 'text-blue-200 justify-end' : 'text-gray-400 justify-end'}`}>
                                            <span>{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}</span>
                                            {msg.sender === 'teacher' && msg.is_read && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                            </div>
                                            {msg.sender === 'teacher' && isOnline && (
                                                <div className="absolute top-0 -left-20 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/30" onClick={() => setModalState({ type: 'editCommunication', data: msg })}><PencilIcon className="w-3.5 h-3.5"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/30 text-red-400" onClick={() => handleDelete('communications', msg.id)}><TrashIcon className="w-3.5 h-3.5"/></Button>
                                                </div>
                                            )}
                                        </div>
                                        {msg.sender === 'teacher' && <img src={user?.avatarUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Guru"/>}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessageMutation.mutate(newMessage); }} className="p-4 border-t border-white/10 flex items-center gap-2">
                                <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1" disabled={!isOnline || sendMessageMutation.isPending}/>
                                <Button type="submit" size="icon" disabled={!isOnline || !newMessage.trim() || sendMessageMutation.isPending}><SendIcon className="w-5 h-5" /></Button>
                            </form>
                          </div>
                      </TabsContent>
                      <TabsContent value="portal" className="p-6">
                          <CardTitle>Akses Portal Orang Tua</CardTitle>
                          <CardDescription>Bagikan kode akses ini kepada orang tua atau wali siswa.</CardDescription>
                          <div className="flex justify-center mt-6">
                              {student.access_code ? (
                                  <div className="w-full max-w-md p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-xl text-white text-center">
                                      <p className="font-semibold">Kode Akses untuk {student.name}</p>
                                      <div className="my-4 p-4 bg-black/20 rounded-lg border border-white/20">
                                          <p className="text-4xl font-mono font-bold tracking-[0.3em]">{student.access_code}</p>
                                      </div>
                                      <p className="text-xs text-indigo-200 mb-6">Kode ini unik dan bersifat rahasia. Gunakan untuk masuk ke portal siswa.</p>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          <Button onClick={handleCopyAccessCode} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-sm col-span-2 sm:col-span-1">{copied ? <CopyCheckIcon className="w-4 h-4 mr-2 text-green-400"/> : <CopyIcon className="w-4 h-4 mr-2"/>}{copied ? 'Disalin!' : 'Salin'}</Button>
                                          <Button onClick={handleShare} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-sm"><Share2Icon className="w-4 h-4 mr-2"/>Bagikan</Button>
                                          <Button onClick={handlePrint} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-sm"><PrinterIcon className="w-4 h-4 mr-2"/>Cetak Slip</Button>
                                          <Button onClick={handleGenerateAccessCode} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-sm" disabled={!isOnline || studentMutation.isPending}>Buat Baru</Button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="text-center space-y-4 py-8">
                                      <KeyRoundIcon className="w-16 h-16 mx-auto text-gray-400"/>
                                      <p>Siswa ini belum memiliki kode akses portal.</p>
                                      <Button onClick={handleGenerateAccessCode} disabled={!isOnline || studentMutation.isPending}>
                                          <SparklesIcon className="w-4 h-4 mr-2"/> Buat Kode Akses
                                      </Button>
                                  </div>
                              )}
                          </div>
                      </TabsContent>
                  </Tabs>
                </Card>
            </div>

            <div className="hidden print:block">
                <div id="printable-slip">
                    <div className="p-8 text-black" style={{ width: '12cm', fontFamily: 'sans-serif' }}>
                        <h3 className="text-lg font-bold">Informasi Akses Portal Siswa</h3>
                        <p className="text-sm mb-4">Harap simpan informasi ini dengan baik.</p>
                        <div className="border-t border-b border-gray-300 py-4 my-4">
                            <p className="text-xs">Nama Siswa:</p>
                            <p className="text-base font-semibold">{student.name}</p>
                            <p className="text-xs mt-2">Kelas:</p>
                            <p className="text-base font-semibold">{student.classes?.name || 'N/A'}</p>
                        </div>
                        <p className="text-center text-sm">Gunakan kode berikut untuk masuk:</p>
                        <div className="text-center my-2 p-3 bg-gray-100 rounded-md">
                            <p className="text-3xl font-mono font-bold tracking-widest">{student.access_code}</p>
                        </div>
                        <p className="text-center text-xs mt-4">
                            Masuk melalui: <span className="font-mono">{window.location.origin}</span>
                        </p>
                    </div>
                </div>
            </div>

            {modalState.type === 'applyPoints' ? (
                <Modal isOpen={true} onClose={() => setModalState({ type: 'closed' })} title="Gunakan Poin Keaktifan">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Anda akan menggunakan <strong>{quizPoints.length} poin</strong> keaktifan sebagai nilai tambahan. Poin ini akan dihapus setelah digunakan.
                        </p>
                        <div>
                            <label htmlFor="subject-select" className="block text-sm font-medium mb-1">Pilih Mata Pelajaran</label>
                            <Select id="subject-select" value={subjectToApply} onChange={e => setSubjectToApply(e.target.value)} required>
                                <option value="" disabled>-- Pilih --</option>
                                {uniqueSubjectsForGrades.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                        {currentRecordForSubject && (
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
                                <p>Nilai Saat Ini: <strong className="text-lg">{currentRecordForSubject.score}</strong></p>
                                <p>Nilai Baru: <strong className="text-lg text-green-500">{Math.min(100, currentRecordForSubject.score + quizPoints.length)}</strong></p>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button>
                            <Button type="button" onClick={handleApplyPointsSubmit} disabled={applyPointsMutation.isPending || !subjectToApply}>
                                {applyPointsMutation.isPending ? 'Menerapkan...' : 'Terapkan Poin'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            ) : modalState.type !== 'closed' && modalState.type !== 'confirmDelete' && (
                <Modal isOpen={true} onClose={() => setModalState({ type: 'closed' })} title={
                    modalState.type === 'editStudent' ? 'Edit Profil Siswa' : 
                    modalState.type === 'report' ? (modalState.data ? 'Edit Catatan' : 'Tambah Catatan Baru') :
                    modalState.type === 'academic' ? (modalState.data ? 'Edit Nilai' : 'Tambah Nilai Baru') :
                    modalState.type === 'quiz' ? (modalState.data ? 'Edit Poin' : 'Tambah Poin Keaktifan') :
                    modalState.type === 'editCommunication' ? 'Edit Pesan' :
                    'Tambah Pelanggaran'
                }>
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {modalState.type === 'editStudent' && <>
                            <div><label>Nama Lengkap</label><Input name="name" defaultValue={modalState.data.name} required/></div>
                            <div><label>Jenis Kelamin</label><div className="flex gap-4 mt-2"><label className="flex items-center"><input type="radio" name="gender" value="Laki-laki" defaultChecked={modalState.data.gender === 'Laki-laki'} className="form-radio"/><span className="ml-2">Laki-laki</span></label><label className="flex items-center"><input type="radio" name="gender" value="Perempuan" defaultChecked={modalState.data.gender === 'Perempuan'} className="form-radio"/><span className="ml-2">Perempuan</span></label></div></div>
                            <div><label>Kelas</label><Select name="class_id" defaultValue={modalState.data.class_id} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                        </>}
                        {modalState.type === 'report' && <>
                             <div><label>Tanggal</label><Input name="date" type="date" defaultValue={modalState.data?.date || new Date().toISOString().slice(0,10)} required/></div>
                             <div><label>Judul</label><Input name="title" defaultValue={modalState.data?.title || ''} placeholder="cth. Insiden di kelas" required/></div>
                             <div><label>Catatan</label><textarea name="notes" rows={4} defaultValue={modalState.data?.notes || ''} className="w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600" required></textarea></div>
                        </>}
                        {modalState.type === 'academic' && <>
                            <div><label>Mata Pelajaran</label><Input name="subject" defaultValue={modalState.data?.subject || ''} placeholder="cth. Matematika" required/></div>
                            <div><label>Nilai (0-100)</label><Input name="score" type="number" min="0" max="100" defaultValue={modalState.data?.score || 0} required/></div>
                            <div><label>Catatan (Opsional)</label><textarea name="notes" rows={3} defaultValue={modalState.data?.notes || ''} placeholder="cth. Sangat baik dalam materi aljabar." className="w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600"></textarea></div>
                        </>}
                         {modalState.type === 'quiz' && <>
                            <div><label>Tanggal</label><Input name="quiz_date" type="date" defaultValue={modalState.data?.quiz_date || new Date().toISOString().slice(0,10)} required/></div>
                            <div><label>Mata Pelajaran</label><Input name="subject" defaultValue={modalState.data?.subject || ''} placeholder="cth. IPA" required/></div>
                            <div><label>Aktivitas</label><Input name="quiz_name" defaultValue={modalState.data?.quiz_name || ''} placeholder="cth. Aktif bertanya di kelas" required/></div>
                        </>}
                        {modalState.type === 'violation' && <>
                             <div><label>Tanggal</label><Input name="date" type="date" defaultValue={modalState.data?.date || new Date().toISOString().slice(0,10)} required/></div>
                             <div><label>Jenis Pelanggaran</label><Select name="description" defaultValue={modalState.data?.description || ''} required>{violationList.map(v => <option key={v.code} value={v.description}>{v.description} ({v.points} poin)</option>)}</Select></div>
                        </>}
                        {modalState.type === 'editCommunication' && <>
                            <div><label>Pesan</label><textarea name="message" rows={5} defaultValue={modalState.data.message} className="w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600" required></textarea></div>
                        </>}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button>
                            <Button type="submit" disabled={!isOnline}>Simpan</Button>
                        </div>
                    </form>
                </Modal>
            )}
             {modalState.type === 'confirmDelete' && (
                <Modal isOpen={true} onClose={() => setModalState({ type: 'closed' })} title={modalState.title}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{modalState.message}</p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })} disabled={modalState.isPending}>Batal</Button>
                        <Button type="button" variant="destructive" onClick={modalState.onConfirm} disabled={modalState.isPending}>
                            {modalState.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default StudentDetailPage;