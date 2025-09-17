import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, SparklesIcon, CalendarIcon, MessageSquareIcon, SendIcon, UsersIcon, GraduationCapIcon, PencilIcon, TrashIcon } from '../Icons';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';

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

const PortalHeader: React.FC<{ student: PortalData['student'], onLogout: () => void }> = ({ student, onLogout }) => (
    <header className="p-4 sm:p-6 sticky top-0 z-20 bg-gray-950/70 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <GraduationCapIcon className="w-6 h-6 text-purple-300" />
                </div>
                <h1 className="text-xl font-bold tracking-wider hidden sm:block">Portal Siswa</h1>
            </div>
            <div className="flex items-center gap-4">
                <div>
                    <p className="font-bold text-right">{student.name}</p>
                    <p className="text-sm text-gray-400 text-right">Kelas {student.classes.name}</p>
                </div>
                <img src={student.avatar_url} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/10"/>
                <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout">
                    <LogoutIcon className="w-5 h-5"/>
                </Button>
            </div>
        </div>
    </header>
);

const StatCard: React.FC<{ icon: React.ElementType, label: string, value: string | number, colorClass: string }> = ({ icon: Icon, label, value, colorClass }) => (
    <div className={`relative p-5 rounded-2xl overflow-hidden bg-white/5 border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${colorClass.replace('bg-gradient-to-br', 'hover:shadow-purple-500/30')}`}>
        <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 ${colorClass.replace('from-', 'bg-')}`}></div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${colorClass}`}>
                <Icon className="w-6 h-6 text-white"/>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-sm text-gray-300 mt-1">{label}</p>
        </div>
    </div>
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
            <div className="flex flex-col h-[60vh]">
                <div ref={messagesEndRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessage(newMessage); }} className="p-4 border-t border-white/10 flex items-center gap-2">
                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1" disabled={isSending}/>
                    <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}><SendIcon className="w-5 h-5" /></Button>
                </form>
            </div>

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
    
    const { student, academicRecords, violations, communications, teacher, quizPoints, attendanceRecords } = data;

    return (
        <div className="min-h-screen w-full cosmic-bg text-white font-sans">
            <PortalHeader student={student} onLogout={handleLogout} />

            <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
                {/* Summary Section */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard icon={BarChartIcon} label="Rata-rata Nilai" value={averageScore} colorClass="bg-gradient-to-br from-purple-500 to-indigo-500" />
                    <StatCard icon={CheckCircleIcon} label="Total Hadir" value={attendanceSummary.present} colorClass="bg-gradient-to-br from-green-500 to-emerald-500" />
                    <StatCard icon={CalendarIcon} label="Total Absen" value={attendanceSummary.absent} colorClass="bg-gradient-to-br from-yellow-500 to-orange-500" />
                    <StatCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} colorClass="bg-gradient-to-br from-red-500 to-rose-500" />
                </section>
                
                {/* Tabbed Content */}
                <GlassCard>
                    <Tabs defaultValue="akademik" className="w-full">
                        <div className="p-2 border-b border-white/10">
                            <TabsList className="bg-black/20">
                                <TabsTrigger value="akademik">Akademik</TabsTrigger>
                                <TabsTrigger value="perilaku">Perilaku & Kehadiran</TabsTrigger>
                                <TabsTrigger value="komunikasi">Komunikasi</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Academic Tab */}
                        <TabsContent value="akademik" className="p-6">
                            <h3 className="text-xl font-bold mb-4">Hasil Belajar</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {academicRecords.length > 0 ? academicRecords.map(r => {
                                    const scoreColor = r.score >= 75 ? 'text-green-400' : r.score >= 60 ? 'text-yellow-400' : 'text-red-400';
                                    const borderColor = r.score >= 75 ? 'border-green-500/30' : r.score >= 60 ? 'border-yellow-500/30' : 'border-red-500/30';
                                    return (
                                        <div key={r.id} className={`p-4 rounded-xl border ${borderColor} bg-white/5`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-lg">{r.subject}</p>
                                                    <p className="text-sm text-purple-300 -mt-1 font-semibold">{r.assessment_name || 'Penilaian Umum'}</p>
                                                    <p className="text-xs text-gray-400 mt-2">{r.notes}</p>
                                                </div>
                                                <p className={`font-black text-4xl ${scoreColor}`}>{r.score}</p>
                                            </div>
                                        </div>
                                    )
                                }) : <p className="text-gray-400 md:col-span-2">Belum ada data nilai akademik.</p>}
                            </div>
                            
                            <h3 className="text-xl font-bold mt-8 mb-4">Poin Keaktifan</h3>
                            <div className="space-y-2">
                               {quizPoints.length > 0 ? quizPoints.map(qp => (
                                   <div key={qp.id} className="p-3 rounded-lg bg-white/5 flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center"><SparklesIcon className="w-5 h-5 text-green-300"/></div>
                                       <div>
                                            <p className="font-semibold">{qp.quiz_name}</p>
                                            <p className="text-xs text-gray-400">{new Date(qp.quiz_date).toLocaleDateString('id-ID')}</p>
                                       </div>
                                   </div>
                               )) : <p className="text-gray-400">Belum ada poin keaktifan yang tercatat.</p>}
                            </div>
                        </TabsContent>

                        {/* Behavior & Attendance Tab */}
                        <TabsContent value="perilaku" className="p-6">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Catatan Pelanggaran</h3>
                                    <div className="space-y-3">
                                        {violations.length > 0 ? violations.map(v => (
                                            <div key={v.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                                <p className="font-semibold">{v.description}</p>
                                                <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')} - <span className="font-bold text-red-400">{v.points} poin</span></p>
                                            </div>
                                        )) : <p className="text-gray-400">Tidak ada catatan pelanggaran. Perilaku siswa sangat baik.</p>}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Riwayat Kehadiran</h3>
                                    <div className="space-y-2">
                                        {attendanceRecords.length > 0 ? [...attendanceRecords].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(att => { // Show last 10
                                            const statusInfo = {
                                                'Hadir': { color: 'text-green-400', bg: 'bg-green-500/10' },
                                                'Izin': { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                                                'Sakit': { color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                                'Alpha': { color: 'text-red-400', bg: 'bg-red-500/10' },
                                            }[att.status];
                                            return (
                                                <div key={att.id} className={`p-3 rounded-lg flex justify-between items-center ${statusInfo?.bg}`}>
                                                    <p className="font-medium">{new Date(att.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                    <p className={`font-bold text-sm px-2 py-0.5 rounded-full ${statusInfo?.color}`}>{att.status}</p>
                                                </div>
                                            )
                                        }) : <p className="text-gray-400">Belum ada data kehadiran.</p>}
                                         {attendanceRecords.length > 10 && <p className="text-xs text-center text-gray-500 mt-2">Menampilkan 10 catatan terakhir...</p>}
                                    </div>
                                </div>
                             </div>
                        </TabsContent>

                        {/* Communication Tab */}
                        <TabsContent value="komunikasi">
                            <CommunicationPanel communications={communications} student={student} teacher={teacher}/>
                        </TabsContent>
                    </Tabs>
                </GlassCard>
            </main>
        </div>
    );
};