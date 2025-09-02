
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, FileTextIcon, SparklesIcon, CalendarIcon, TrendingUpIcon, MessageSquareIcon, SendIcon, UsersIcon, ChevronLeftIcon, ChevronRightIcon, GraduationCapIcon } from '../Icons';
import { Input } from '../ui/Input';

// FIX: Define local types based on the RPC function's return schema to resolve type mismatches.
type PortalRpcResult = Database['public']['Functions']['get_student_portal_data']['Returns'][number];
type PortalStudentInfo = PortalRpcResult['student'];
type PortalReport = PortalRpcResult['reports'][number];
type PortalAttendance = PortalRpcResult['attendanceRecords'][number];
type PortalAcademicRecord = PortalRpcResult['academicRecords'][number];
type PortalViolation = PortalRpcResult['violations'][number];
type PortalQuizPoint = PortalRpcResult['quizPoints'][number];
type PortalCommunication = PortalRpcResult['communications'][number];
type TeacherInfo = PortalRpcResult['teacher'];

// FIX: Update PortalData to use the new, accurate RPC-based types.
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
        throw error;
    }

    if (!data || data.length === 0) {
        throw new Error("Kode akses tidak valid atau data siswa tidak ditemukan.");
    }

    const portalResult = data[0];
    
    // FIX: Assemble the data structure, which now aligns with the `PortalData` type without causing errors.
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
    <GlassCard className="p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-purple-400/50">
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-white ${colorClass}`}>
                 <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-300">{label}</p>
            </div>
        </div>
    </GlassCard>
);

const getScoreColorClasses = (score: number) => {
    if (score >= 85) return { bg: 'bg-green-900/30', border: 'border-green-600', scoreBg: 'bg-green-500' };
    if (score >= 70) return { bg: 'bg-yellow-900/30', border: 'border-yellow-600', scoreBg: 'bg-yellow-500' };
    return { bg: 'bg-red-900/30', border: 'border-red-600', scoreBg: 'bg-red-500' };
};

// FIX: Update component props to use the correct RPC-based type.
const GradesList: React.FC<{ records: PortalAcademicRecord[] }> = ({ records }) => {
  if (!records || records.length === 0) return <div className="text-center py-16 text-gray-400"><GraduationCapIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" /><h4 className="font-semibold">Tidak Ada Data Nilai</h4><p>Belum ada nilai yang diinput oleh guru.</p></div>;
  const sortedRecords = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sortedRecords.map((record) => {
        const colors = getScoreColorClasses(record.score);
        return (
          <div key={record.id} className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bg}`}>
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-3xl text-white ${colors.scoreBg}`}>
                {record.score}
              </div>
              <div className="flex-grow">
                <h4 className="font-extrabold text-lg text-white">{record.subject}</h4>
                <p className="text-xs text-gray-400 font-medium">
                  {new Date(record.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {record.notes && <p className="text-sm text-gray-300 mt-3 pt-3 border-t-2 border-dashed border-white/10 italic">"{record.notes}"</p>}
          </div>
        );
      })}
    </div>
  );
};

// FIX: Update component props to use the correct RPC-based type.
const QuizzesList: React.FC<{ records: PortalQuizPoint[] }> = ({ records }) => {
  if (!records || records.length === 0) return <div className="text-center py-16 text-gray-400"><SparklesIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" /><h4 className="font-semibold">Tidak Ada Poin Keaktifan</h4><p>Belum ada poin keaktifan yang dicatat.</p></div>;
  const sortedRecords = [...records].sort((a, b) => new Date(b.quiz_date).getTime() - new Date(a.quiz_date).getTime());
  return (
    <div className="space-y-3">
      {sortedRecords.map((record) => (
        <div key={record.id} className="flex items-center gap-4 p-3 rounded-lg bg-black/20">
          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl bg-green-900/40 text-green-200">
            +1
          </div>
          <div className="flex-grow">
            <p className="font-semibold text-white">{record.quiz_name}</p>
            <p className="text-xs text-gray-400">{record.subject} &middot; {new Date(record.quiz_date).toLocaleDateString('id-ID')}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const ParentPortalPage: React.FC = () => {
    // --- HOOKS (All at top level) ---
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const queryClient = useQueryClient();
    const accessCode = sessionStorage.getItem('portal_access_code');
    const [activeSection, setActiveSection] = useState('summary');
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- DATA FETCHING ---
    const { data: portalData, isLoading, isError, error } = useQuery<PortalData>({
        queryKey: ['portalData', studentId, accessCode],
        queryFn: () => fetchPortalData(studentId!, accessCode!),
        enabled: !!studentId && !!accessCode, // This correctly handles the case where accessCode might be null initially
    });

    // --- SIDE EFFECTS ---
    useEffect(() => {
        // Conditional logic is now safely inside useEffect
        if (!accessCode) {
            toast.error("Kode akses tidak ditemukan. Silakan login kembali.");
            navigate('/portal-login', { replace: true });
        }
    }, [accessCode, navigate, toast]);

    useEffect(() => {
        if (portalData?.communications) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [portalData?.communications]);

    // --- MUTATIONS ---
    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            if (!studentId || !portalData?.teacher?.user_id) throw new Error("Data tidak lengkap");
            const { error } = await supabase.from('communications').insert({
                student_id: studentId,
                user_id: portalData.teacher.user_id,
                message: messageText,
                sender: 'parent',
                is_read: false
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalData', studentId, accessCode] });
            setNewMessage('');
        },
        onError: (err: Error) => toast.error(`Gagal mengirim pesan: ${err.message}`)
    });

    // --- MEMOIZED VALUES ---
    const attendanceSummary = useMemo(() => {
        const summary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
        portalData?.attendanceRecords.forEach(rec => { (summary as any)[rec.status]++; });
        return summary;
    }, [portalData?.attendanceRecords]);

    const totalViolationPoints = useMemo(() => portalData?.violations.reduce((sum, v) => sum + v.points, 0) || 0, [portalData?.violations]);
    
    // --- EVENT HANDLERS ---
    const handleLogout = () => {
        sessionStorage.removeItem('portal_access_code');
        navigate('/portal-login', { replace: true });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            sendMessageMutation.mutate(newMessage);
        }
    };
    
    // --- RENDER LOGIC ---
    if (!accessCode) {
        return (
            <div className="flex items-center justify-center h-screen cosmic-bg">
                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen cosmic-bg">
                <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="ml-4 text-lg text-white">Memuat data siswa...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen cosmic-bg p-4 text-center">
                <h2 className="text-2xl font-bold text-red-400">Gagal Memuat Data</h2>
                <p className="text-gray-300 mt-2">Terjadi kesalahan: {error.message}</p>
                <p className="text-gray-400 mt-1">Ini mungkin karena kode akses salah atau sudah tidak berlaku. Silakan coba login kembali.</p>
                <Button onClick={handleLogout} className="mt-6"><LogoutIcon className="w-4 h-4 mr-2" />Kembali ke Login</Button>
            </div>
        );
    }
    
    if (!portalData) return null;
    
    const { student, reports, attendanceRecords, academicRecords, violations, quizPoints, communications, teacher } = portalData;
    
    const navItems = [
        { id: 'summary', label: 'Ringkasan', icon: TrendingUpIcon },
        { id: 'grades', label: 'Nilai', icon: BarChartIcon },
        { id: 'attendance', label: 'Absensi', icon: CalendarIcon },
        { id: 'violations', label: 'Pelanggaran', icon: ShieldAlertIcon },
        { id: 'quizzes', label: 'Keaktifan', icon: SparklesIcon },
        { id: 'reports', label: 'Catatan', icon: FileTextIcon },
        { id: 'communication', label: 'Komunikasi', icon: MessageSquareIcon },
    ];
    const unreadMessages = communications.filter(m => m.sender === 'teacher' && !m.is_read).length;
    
    const renderContent = () => {
        switch (activeSection) {
            case 'summary':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SummaryCard icon={CheckCircleIcon} label="Total Kehadiran" value={`${attendanceSummary.Hadir} hari`} colorClass="bg-green-500" />
                            <SummaryCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} colorClass="bg-red-500" />
                            <SummaryCard icon={BarChartIcon} label="Nilai Rata-Rata" value={academicRecords.length > 0 ? Math.round(academicRecords.reduce((sum, r) => sum + r.score, 0) / academicRecords.length) : 'N/A'} colorClass="bg-blue-500" />
                            <SummaryCard icon={SparklesIcon} label="Poin Keaktifan" value={quizPoints.length} colorClass="bg-yellow-500" />
                        </div>
                        <GlassCard>
                            <CardHeader><CardTitle>Nilai Terbaru</CardTitle></CardHeader>
                            <CardContent><GradesList records={[...academicRecords].slice(-4)} /></CardContent>
                        </GlassCard>
                    </div>
                );
            case 'grades': return <GlassCard className="animate-fade-in"><CardHeader><CardTitle>Semua Nilai Akademik</CardTitle></CardHeader><CardContent><GradesList records={academicRecords} /></CardContent></GlassCard>;
            case 'attendance': return (
                <GlassCard className="animate-fade-in">
                    <CardHeader><CardTitle>Riwayat Absensi</CardTitle></CardHeader>
                    <CardContent className="max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                        {[...attendanceRecords].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(rec => (
                            <div key={rec.id} className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                                <p className="font-semibold text-white">{new Date(rec.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    rec.status === 'Hadir' ? 'bg-green-500/20 text-green-300' :
                                    rec.status === 'Izin' ? 'bg-yellow-500/20 text-yellow-300' :
                                    rec.status === 'Sakit' ? 'bg-blue-500/20 text-blue-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>{rec.status}</span>
                            </div>
                        ))}
                        </div>
                    </CardContent>
                </GlassCard>
            );
            case 'violations': return (
                <GlassCard className="animate-fade-in">
                    <CardHeader><CardTitle>Riwayat Pelanggaran</CardTitle></CardHeader>
                    <CardContent>
                        {violations.length > 0 ? (<div className="space-y-3">{[...violations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(v => (<div key={v.id} className="p-3 rounded-lg bg-red-900/20"><p className="font-semibold text-white">{v.description}</p><p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')} - <span className="font-bold text-red-400">{v.points} poin</span></p></div>))}</div>) : (<div className="text-center py-16 text-gray-400"><ShieldAlertIcon className="w-16 h-16 mx-auto mb-4 text-gray-500"/><h4 className="font-semibold">Tidak Ada Pelanggaran</h4><p>Siswa ini memiliki catatan perilaku yang bersih.</p></div>)}
                    </CardContent>
                </GlassCard>
            );
            case 'quizzes': return <GlassCard className="animate-fade-in"><CardHeader><CardTitle>Semua Poin Keaktifan</CardTitle></CardHeader><CardContent><QuizzesList records={quizPoints} /></CardContent></GlassCard>;
            case 'reports': return (
                <GlassCard className="animate-fade-in">
                    <CardHeader><CardTitle>Catatan dari Guru</CardTitle></CardHeader>
                    <CardContent>
                        {reports.length > 0 ? (<div className="space-y-3">{[...reports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => (<div key={r.id} className="p-4 rounded-lg bg-black/20"><h4 className="font-bold text-white">{r.title}</h4><p className="text-xs text-gray-400 mb-2">{new Date(r.date).toLocaleDateString('id-ID')}</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{r.notes}</p></div>))}</div>) : (<div className="text-center py-16 text-gray-400"><FileTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-500"/><h4 className="font-semibold">Tidak Ada Catatan</h4><p>Belum ada catatan khusus dari guru.</p></div>)}
                    </CardContent>
                </GlassCard>
            );
            case 'communication': return (
                 <GlassCard className="animate-fade-in flex flex-col h-[70vh]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <MessageSquareIcon className="w-5 h-5 text-blue-400"/> Komunikasi dengan Wali Kelas
                        </CardTitle>
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-black/20">
                        {communications.map(msg => (
                            <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'parent' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'teacher' && <img src={teacher?.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Guru"/>}
                                <div className={`max-w-md p-3 rounded-2xl text-sm ${msg.sender === 'parent' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                    <p className="whitespace-pre-wrap">{msg.message}</p>
                                    <div className={`text-xs mt-1 ${msg.sender === 'parent' ? 'text-blue-200 text-right' : 'text-gray-400 text-right'}`}>{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}</div>
                                </div>
                                {msg.sender === 'parent' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UsersIcon className="w-5 h-5 text-gray-300" /></div>}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 flex items-center gap-2">
                        <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1" disabled={sendMessageMutation.isPending}/>
                        <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMessageMutation.isPending}><SendIcon className="w-5 h-5" /></Button>
                    </form>
                </GlassCard>
            );
            default: return null;
        }
    };
    
    return (
        <div className="min-h-screen cosmic-bg text-white p-4 sm:p-6 md:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <img src={student.avatar_url || `https://i.pravatar.cc/150?u=${student.id}`} alt={student.name} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 border-white/10 shadow-lg" />
                        <div>
                            <p className="text-sm text-indigo-200">Portal Siswa</p>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{student.name}</h1>
                            <p className="text-md text-gray-300">Kelas {student.classes.name}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 hover:bg-white/20">
                        <LogoutIcon className="w-4 h-4 mr-2" /> Logout
                    </Button>
                </header>
                
                <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="lg:col-span-1">
                        <GlassCard className="p-3 sticky top-6">
                            <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                                {navItems.map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex-shrink-0 ${activeSection === item.id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold shadow-md' : 'text-gray-300 hover:bg-black/20 hover:text-purple-400'}`}
                                    >
                                        <item.icon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-sm font-medium">{item.label}</span>
                                        {item.id === 'communication' && unreadMessages > 0 && (
                                            <span className="ml-auto bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                                                {unreadMessages}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </GlassCard>
                    </aside>
                    <section className="lg:col-span-3">
                        {renderContent()}
                    </section>
                </main>
            </div>
        </div>
    );
};

// FIX: Add default export statement.
export default ParentPortalPage;
