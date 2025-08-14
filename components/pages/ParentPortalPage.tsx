import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { AttendanceStatus } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, FileTextIcon, UserCircleIcon } from '../Icons';

// Re-using types from StudentDetailPage
type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

type PortalData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    violations: ViolationRow[],
};

const fetchPortalData = async (studentId: string, accessCode: string): Promise<PortalData> => {
    // Security check: ensure the student ID matches the access code
    const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('access_code', accessCode).single();
    if (studentRes.error || !studentRes.data) throw new Error("Akses ditolak atau data tidak ditemukan.");
    
    const [reportsRes, attendanceRes, academicRes, violationsRes] = await Promise.all([
        supabase.from('reports').select('*').eq('student_id', studentId),
        supabase.from('attendance').select('*').eq('student_id', studentId),
        supabase.from('academic_records').select('*').eq('student_id', studentId),
        supabase.from('violations').select('*').eq('student_id', studentId),
    ]);
    
    if (reportsRes.error || attendanceRes.error || academicRes.error || violationsRes.error) {
        throw new Error('Gagal memuat data portal.');
    }

    return {
        student: studentRes.data as StudentWithClass,
        reports: reportsRes.data || [],
        attendanceRecords: attendanceRes.data || [],
        academicRecords: academicRes.data || [],
        violations: violationsRes.data || [],
    };
};

const ParentPortalPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const accessCode = sessionStorage.getItem('portal_access_code');

    useEffect(() => {
        if (!accessCode) {
            toast.error("Sesi tidak valid. Silakan masuk kembali.");
            navigate('/portal-login');
        }
    }, [accessCode, navigate, toast]);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['portalData', studentId, accessCode],
        queryFn: () => fetchPortalData(studentId!, accessCode!),
        enabled: !!studentId && !!accessCode,
        retry: 1, // Don't retry endlessly on auth errors
    });

    const attendanceSummary = useMemo(() => {
        const initialSummary: Record<AttendanceStatus, number> = {
            [AttendanceStatus.Hadir]: 0,
            [AttendanceStatus.Izin]: 0,
            [AttendanceStatus.Sakit]: 0,
            [AttendanceStatus.Alpha]: 0,
        };
        if (!data) return initialSummary;
        return data.attendanceRecords.reduce((acc, record) => {
            const status: AttendanceStatus = record.status as AttendanceStatus;
            if (status in acc) {
                acc[status] = (acc[status] || 0) + 1;
            }
            return acc;
        }, initialSummary);
    }, [data]);
    
    const sortedAcademicRecords = useMemo(() => data?.academicRecords.sort((a,b) => b.score - a.score), [data]);
    const sortedViolations = useMemo(() => data?.violations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [data]);
    const sortedReports = useMemo(() => data?.reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [data]);

    const handleLogout = () => {
        sessionStorage.removeItem('portal_access_code');
        navigate('/portal-login');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen cosmic-bg"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (isError) {
        console.error(error);
        sessionStorage.removeItem('portal_access_code'); // Clear bad code
        const errorMessage = error instanceof Error ? error.message : "Kode akses tidak valid atau sesi telah berakhir.";
        return (
            <div className="flex flex-col items-center justify-center min-h-screen cosmic-bg text-white p-4">
                <h1 className="text-2xl font-bold">Gagal Memuat Data</h1>
                <p className="mt-2 text-center">{errorMessage}</p>
                <Button onClick={() => navigate('/portal-login')} className="mt-6">Kembali ke Halaman Login</Button>
            </div>
        );
    }
    
    const { student } = data;

    return (
        <div className="min-h-screen cosmic-bg text-white font-sans p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <img src={student.avatar_url} alt={student.name} className="w-20 h-20 rounded-full object-cover border-4 border-white/20 shadow-lg"/>
                        <div>
                            <h1 className="text-3xl font-bold text-shadow-md">{student.name}</h1>
                            <p className="text-lg text-indigo-200">Kelas {student.classes?.name || 'N/A'}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 hover:bg-white/20 self-start sm:self-center"><LogoutIcon className="w-4 h-4 mr-2"/>Logout</Button>
                </header>

                <main className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
                    <Card className="md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><BarChartIcon className="w-5 h-5 text-blue-400"/>Nilai Akademik</CardTitle></CardHeader>
                        <CardContent>
                           {sortedAcademicRecords && sortedAcademicRecords.length > 0 ? (
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead className="border-b-2 border-white/20"><tr><th className="py-2 px-4 text-left">Mata Pelajaran</th><th className="py-2 px-4 text-center">Nilai</th><th className="py-2 px-4 text-left">Catatan</th></tr></thead>
                                <tbody>{sortedAcademicRecords.map(r => (<tr key={r.id} className="border-b border-white/10"><td className="py-3 px-4 font-semibold">{r.subject}</td><td className="py-3 px-4 text-center text-lg font-bold">{r.score}</td><td className="py-3 px-4 text-gray-300 italic">"{r.notes}"</td></tr>))}</tbody>
                            </table></div>
                           ) : (<p className="text-center text-gray-400 py-4">Belum ada nilai yang diinput.</p>)}
                        </CardContent>
                    </Card>

                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircleIcon className="w-5 h-5 text-green-400"/>Ringkasan Kehadiran</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {Object.entries(attendanceSummary).map(([status, count]) => (
                                <div key={status} className="flex justify-between items-center text-sm bg-black/20 p-3 rounded-lg"><span className="font-medium text-gray-300">{status}</span><span className="font-bold text-lg">{count} hari</span></div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlertIcon className="w-5 h-5 text-red-400"/>Catatan Pelanggaran</CardTitle></CardHeader>
                        <CardContent>
                            {sortedViolations && sortedViolations.length > 0 ? (
                                <ul className="space-y-3">{sortedViolations.map(v => (<li key={v.id} className="p-3 rounded-lg bg-black/20"><p className="font-semibold">{v.description}</p><p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')} - <span className="text-red-400 font-bold">{v.points} poin</span></p></li>))}</ul>
                            ) : (<p className="text-center text-gray-400 py-4">Tidak ada catatan pelanggaran. Hebat!</p>)}
                        </CardContent>
                    </Card>
                    
                     <Card className="md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><FileTextIcon className="w-5 h-5 text-yellow-400"/>Catatan dari Guru</CardTitle></CardHeader>
                        <CardContent>
                           {sortedReports && sortedReports.length > 0 ? (
                            <div className="space-y-4">{sortedReports.map(r => (<div key={r.id} className="p-4 rounded-lg bg-black/20"><div className="flex justify-between items-baseline"><h4 className="font-bold text-base">{r.title}</h4><span className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString('id-ID')}</span></div><p className="text-sm mt-1 text-gray-300">{r.notes}</p></div>))}</div>
                           ) : (<p className="text-center text-gray-400 py-4">Belum ada catatan dari guru.</p>)}
                        </CardContent>
                    </Card>
                </main>
                 <footer className="text-center mt-12 text-xs text-gray-400">
                    <p>Portal Siswa Cerdas &copy; {new Date().getFullYear()}</p>
                </footer>
            </div>
        </div>
    );
};

export default ParentPortalPage;
