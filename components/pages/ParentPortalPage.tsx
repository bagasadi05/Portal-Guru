import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, FileTextIcon, SparklesIcon, CalendarIcon, TrendingUpIcon, MessageSquareIcon, SendIcon, UsersIcon, ChevronLeftIcon, ChevronRightIcon, GraduationCapIcon, LayoutGridIcon, PencilIcon, TrashIcon } from '../Icons';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

type PortalRpcResult = Database['public']['Functions']['get_student_portal_data']['Returns'][number];
type PortalStudentInfo = PortalRpcResult['student'];
type PortalReport = PortalRpcResult['reports'][number];
type PortalAttendance = PortalRpcResult['attendanceRecords'][number];
type PortalAcademicRecord = PortalRpcResult['academicRecords'][number];
type PortalViolation = PortalRpcResult['violations'][number];
type PortalQuizPoint = PortalRpcResult['quizPoints'][number];
type PortalCommunication = PortalRpcResult['communications'][number];
type TeacherInfo = PortalRpcResult['teacher'];

type PortalData = {
    student: PortalStudentInfo & { classes: { name: string }, access_code: string | null },
    reports: PortalReport[],
    attendanceRecords: PortalAttendance[],
    academicRecords: PortalAcademicRecord[],
    violations: PortalViolation[],
    quizPoints: PortalQuizPoint[],
    communications: PortalCommunication[],
    teacher: TeacherInfo,
};


const fetchPortalData = async (studentId: string, accessCode: string): Promise<PortalData> => {
    const { data, error } = await supabase.rpc('get_student_portal_data', {
        student_id_param: studentId,
        access_code_param: accessCode,
    });

    if (error) {
        console.error("Portal access RPC failed:", error);
        // Provide a more descriptive error for debugging backend issues.
        throw new Error(`Gagal memuat data portal: ${error.message}. Pastikan fungsi RPC 'get_student_portal_data' di Supabase sudah dikonfigurasi dengan benar, termasuk hak akses (RLS/SECURITY DEFINER).`);
    }

    if (!data || data.length === 0) {
        // This case now specifically means the internal security check of the RPC failed.
        throw new Error("Akses ditolak. Kode akses mungkin tidak valid untuk siswa ini atau telah kedaluwarsa.");
    }

    const portalResult = data[0];
    
    return {
        student: { ...portalResult.student, access_code: accessCode },
        reports: portalResult.reports || [],
        attendanceRecords: portalResult.attendanceRecords || [],
        academicRecords: portalResult.academicRecords || [],
        violations: portalResult.violations || [],
        quizPoints: portalResult.quizPoints || [],
        communications: portalResult.communications || [],
        teacher: portalResult.teacher,
    };
};


const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div
      className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-lg shadow-black/20 ${className}`}
      {...props}
    />
);

const SummaryCard: React.FC<{ icon: React.ElementType, label: string, value: string | number, colorClass: string }> = ({ icon: Icon, label, value, colorClass }) => (
    <GlassCard className="p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-purple-400/50 cursor-pointer h-full">
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                 <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-400">{label}</p>
            </div>
        </div>
    </GlassCard>
);

const CommunicationPanel: React.FC<{
    communications: PortalCommunication[];
    student: PortalData['student'];
    teacher: TeacherInfo;
}> = ({ communications, student, teacher }) => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    const [modalState, setModalState] = useState<{ type: 'closed' | 'edit' | 'delete', data: PortalCommunication | null }>({ type: 'closed', data: null });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { mutate: sendMessage, isPending: isSending } = useMutation({
        mutationFn: async (messageText: string) => {
            if (!student.access_code || !teacher) throw new Error("Informasi tidak lengkap untuk mengirim pesan.");
            const { error } = await supabase.rpc('send_parent_message', {
                student_id_param: student.id,
                access_code_param: student.access_code,
                message_param: messageText,
                teacher_user_id_param: teacher.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalData', student.id] });
            setNewMessage('');
        },
        onError: (err: Error) => toast.error(`Gagal mengirim pesan: ${err.message}`),
    });
    
    const { mutate: updateMessage, isPending: isUpdating } = useMutation({
        mutationFn: async ({ messageId, newMessageText }: { messageId: string, newMessageText: string }) => {
            if (!student.access_code) throw new Error("Kode akses tidak valid.");
            const { error } = await supabase.rpc('update_parent_message', {
                student_id_param: student.id,
                access_code_param: student.access_code,
                message_id_param: messageId,
                new_message_param: newMessageText
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalData', student.id] });
            toast.success("Pesan berhasil diperbarui.");
            setModalState({ type: 'closed', data: null });
        },
        onError: (err: Error) => toast.error(`Gagal memperbarui pesan: ${err.message}`),
    });

    const { mutate: deleteMessage, isPending: isDeleting } = useMutation({
        mutationFn: async (messageId: string) => {
            if (!student.access_code) throw new Error("Kode akses tidak valid.");
            const { error } = await supabase.rpc('delete_parent_message', {
                student_id_param: student.id,
                access_code_param: student.access_code,
                message_id_param: messageId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalData', student.id] });
            toast.success("Pesan berhasil dihapus.");
            setModalState({ type: 'closed', data: null });
        },
        onError: (err: Error) => toast.error(`Gagal menghapus pesan: ${err.message}`),
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [communications]);

    return (
        <>
            <GlassCard className="lg:col-span-2 flex flex-col h-[60vh]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <MessageSquareIcon className="w-6 h-6 text-blue-300" />
                        Komunikasi dengan Guru
                    </CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {communications.map(msg => (
                        <div key={msg.id} className={`group flex items-start gap-3 ${msg.sender === 'parent' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'teacher' && <img src={teacher?.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Guru"/>}
                            <div className={`relative max-w-md p-3 rounded-2xl text-sm ${msg.sender === 'parent' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                <div className={`flex items-center gap-1 text-xs mt-1 ${msg.sender === 'parent' ? 'text-blue-200 justify-end' : 'text-gray-400 justify-end'}`}>
                                    <span>{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}</span>
                                    {msg.sender === 'parent' && msg.is_read && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                </div>
                                {msg.sender === 'parent' && (
                                    <div className="absolute top-0 -left-20 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/30" onClick={() => setModalState({ type: 'edit', data: msg })}><PencilIcon className="w-3.5 h-3.5"/></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/30 text-red-400" onClick={() => setModalState({ type: 'delete', data: msg })}><TrashIcon className="w-3.5 h-3.5"/></Button>
                                    </div>
                                )}
                            </div>
                            {msg.sender === 'parent' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UsersIcon className="w-5 h-5 text-gray-300" /></div>}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessage(newMessage); }} className="p-4 border-t border-white/10 flex items-center gap-2">
                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1" disabled={isSending}/>
                    <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}><SendIcon className="w-5 h-5" /></Button>
                </form>
            </GlassCard>

            {modalState.type === 'edit' && modalState.data && (
                <Modal title="Edit Pesan" isOpen={true} onClose={() => setModalState({ type: 'closed', data: null })}>
                    <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); const message = formData.get('message') as string; updateMessage({ messageId: modalState.data!.id, newMessageText: message }); }}>
                        <textarea name="message" defaultValue={modalState.data.message} rows={5} className="w-full mt-1 p-2 border rounded-md bg-white/10 border-white/20 text-white placeholder:text-gray-400"></textarea>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed', data: null })}>Batal</Button>
                            <Button type="submit" disabled={isUpdating}>{isUpdating ? "Menyimpan..." : "Simpan"}</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {modalState.type === 'delete' && modalState.data && (
                <Modal title="Hapus Pesan" isOpen={true} onClose={() => setModalState({ type: 'closed', data: null })}>
                    <p>Apakah Anda yakin ingin menghapus pesan ini?</p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed', data: null })}>Batal</Button>
                        <Button variant="destructive" onClick={() => deleteMessage(modalState.data!.id)} disabled={isDeleting}>{isDeleting ? "Menghapus..." : "Hapus"}</Button>
                    </div>
                </Modal>
            )}
        </>
    );
};


export const ParentPortalPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const accessCode = sessionStorage.getItem('portal_access_code');
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['portalData', studentId],
        queryFn: () => fetchPortalData(studentId!, accessCode!),
        enabled: !!studentId && !!accessCode,
        retry: false,
    });
    
    useEffect(() => {
        if (!accessCode) {
            navigate('/portal-login', { replace: true });
        }
        if (isError) {
            console.error("Portal Data Fetch Error:", error);
            sessionStorage.removeItem('portal_access_code');
            navigate('/portal-login', { replace: true });
        }
    }, [accessCode, isError, error, navigate]);

    const handleLogout = () => {
        sessionStorage.removeItem('portal_access_code');
        navigate('/', { replace: true });
    };

    const attendanceSummary = useMemo(() => {
        if (!data) return { present: 0, absent: 0 };
        return {
            present: data.attendanceRecords.filter(r => r.status === 'Hadir').length,
            absent: data.attendanceRecords.filter(r => r.status !== 'Hadir').length
        }
    }, [data]);
    
    const totalViolationPoints = useMemo(() => data?.violations.reduce((sum, v) => sum + v.points, 0) || 0, [data]);
    const averageScore = useMemo(() => {
        if (!data || data.academicRecords.length === 0) return 'N/A';
        const total = data.academicRecords.reduce((sum, r) => sum + r.score, 0);
        return Math.round(total / data.academicRecords.length);
    }, [data]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen cosmic-bg"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (!data) return null;
    
    const { student, academicRecords, violations, communications, teacher } = data;

    return (
        <div className="min-h-screen w-full cosmic-bg text-white font-sans flex">
            {/* Sidebar */}
            <aside id="portal-sidebar" className={`fixed lg:relative top-0 left-0 w-64 h-full bg-black/20 backdrop-blur-xl border-r border-white/10 z-30 transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center"><LayoutGridIcon className="w-6 h-6 text-purple-300" /></div>
                        <div><h1 className="text-xl font-bold tracking-wider">Portal Siswa</h1></div>
                    </div>
                    <div className="text-center mb-8">
                        <img src={student.avatar_url} alt={student.name} className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-white/10 shadow-lg"/>
                        <h2 className="mt-4 text-xl font-bold">{student.name}</h2>
                        <p className="text-sm text-gray-400">Kelas {student.classes.name}</p>
                    </div>
                    <div className="mt-auto">
                        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3 text-red-400 hover:bg-red-500/20 hover:text-red-300"><LogoutIcon className="w-5 h-5"/> Logout</Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between mb-6">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}><LayoutGridIcon className="w-6 h-6"/></Button>
                    <h1 className="text-xl font-bold">Portal Siswa</h1>
                    <div className="w-10"></div> {/* Spacer */}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <GlassCard className="p-6 text-center">
                            <h3 className="font-bold text-lg mb-4">Informasi Guru</h3>
                            <img src={teacher?.avatar_url} alt={teacher?.name} className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-white/10"/>
                            <p className="mt-3 font-semibold">{teacher?.name}</p>
                            <p className="text-xs text-gray-400">Wali Kelas</p>
                        </GlassCard>
                        <SummaryCard icon={BarChartIcon} label="Rata-rata Nilai" value={averageScore} colorClass="bg-gradient-to-br from-purple-500 to-indigo-500" />
                        <SummaryCard icon={CheckCircleIcon} label="Kehadiran / Absen" value={`${attendanceSummary.present} / ${attendanceSummary.absent}`} colorClass="bg-gradient-to-br from-green-500 to-emerald-500" />
                        <SummaryCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} colorClass="bg-gradient-to-br from-red-500 to-orange-500" />
                    </div>

                    <CommunicationPanel communications={communications} student={student} teacher={teacher}/>
                    
                    <GlassCard className="lg:col-span-3">
                        <CardHeader><CardTitle className="flex items-center gap-3"><GraduationCapIcon className="w-6 h-6 text-purple-300"/>Rincian Nilai Akademik</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full min-w-[400px]">
                                <thead><tr className="border-b border-white/10"><th className="p-3 text-left font-semibold">Mata Pelajaran</th><th className="p-3 text-center font-semibold">Nilai</th><th className="p-3 text-center font-semibold">Predikat</th></tr></thead>
                                <tbody>
                                    {academicRecords.map(r => {
                                        const getScoreColor = (score: number) => score >= 75 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
                                        return (<tr key={r.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5"><td className="p-3 font-medium">{r.subject}</td><td className={`p-3 text-center font-bold text-lg ${getScoreColor(r.score)}`}>{r.score}</td><td className="p-3 text-center">{r.score >= 86 ? 'A' : r.score >= 76 ? 'B' : r.score >= 66 ? 'C' : 'D'}</td></tr>)
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </GlassCard>
                </div>
            </main>
        </div>
    );
};
