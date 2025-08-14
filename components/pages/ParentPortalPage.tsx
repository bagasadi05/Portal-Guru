import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, FileTextIcon, SparklesIcon, CalendarIcon, TrendingUpIcon } from '../Icons';

type PortalData = Database['public']['Functions']['get_student_portal_data']['Returns'];
type AcademicRecord = PortalData['academicRecords'][0];
type Violation = PortalData['violations'][0];
type Report = PortalData['reports'][0];
type QuizPoint = PortalData['quizPoints'][0];
type TimelineItem =
  | (Report & { type: 'report' })
  | (Violation & { type: 'violation' });


/**
 * Renders an interactive attendance donut chart.
 */
const AttendanceDonut: React.FC<{ attendanceSummary: Record<string, number>, totalDays: number }> = ({ attendanceSummary, totalDays }) => {
    const data = [
        { status: 'Hadir', value: attendanceSummary.Hadir, color: '#22c55e' }, // green-500
        { status: 'Sakit', value: attendanceSummary.Sakit, color: '#3b82f6' }, // blue-500
        { status: 'Izin', value: attendanceSummary.Izin, color: '#f59e0b' },  // amber-500
        { status: 'Alpha', value: attendanceSummary.Alpha, color: '#ef4444' }, // red-500
    ];

    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const presentPercentage = totalDays > 0 ? Math.round((attendanceSummary.Hadir / totalDays) * 100) : 0;
    
    return (
        <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r={radius} fill="transparent" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="20" />
                {data.map(item => {
                    if (item.value === 0) return null;
                    const dasharray = (item.value / totalDays) * circumference;
                    const strokeDashoffset = offset;
                    offset -= dasharray;
                    return (
                        <circle
                            key={item.status}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="20"
                            strokeDasharray={`${dasharray} ${circumference}`}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-bold text-white">{presentPercentage}%</span>
                <span className="text-sm font-semibold text-gray-300">Kehadiran</span>
            </div>
        </div>
    );
};


/**
 * Renders an interactive line chart for academic grades over time.
 */
const GradeTrendChart: React.FC<{ records: AcademicRecord[] }> = ({ records }) => {
    const [activePoint, setActivePoint] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const width = 500; const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 30 };

    const points = useMemo(() => {
        if (records.length < 2) return [];
        const sortedRecords = [...records].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const scores = sortedRecords.map(r => r.score);
        const minScore = 0; const maxScore = 100;

        return sortedRecords.map((record, i) => ({
            x: padding.left + (i / (sortedRecords.length - 1)) * (width - padding.left - padding.right),
            y: height - padding.bottom - ((record.score - minScore) / (maxScore - minScore)) * (height - padding.top - padding.bottom),
            ...record
        }));
    }, [records]);

    if (records.length < 2) {
        return <div className="flex items-center justify-center h-full text-gray-400">Data tidak cukup untuk menampilkan grafik tren.</div>;
    }

    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');

    return (
        <div className="relative h-full w-full" onMouseLeave={() => setActivePoint(null)}>
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    <linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                    <filter id="lineGlow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                {/* Y-Axis labels */}
                {[0, 25, 50, 75, 100].map(val => {
                    const y = height - padding.bottom - (val / 100) * (height - padding.top - padding.bottom);
                    return (
                        <g key={val}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255, 255, 255, 0.1)" />
                            <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255, 255, 255, 0.5)">{val}</text>
                        </g>
                    )
                })}
                {/* Gradient Area */}
                <path d={`${pathD} V ${height - padding.bottom} H ${padding.left} Z`} fill="url(#gradeGradient)" />
                {/* Line Path */}
                <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)"/>
                {/* Interaction points */}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="8" fill="transparent" onMouseEnter={() => setActivePoint(i)} />
                ))}
                {activePoint !== null && (
                    <circle cx={points[activePoint].x} cy={points[activePoint].y} r="5" fill="#a78bfa" stroke="white" strokeWidth="2" className="pointer-events-none"/>
                )}
            </svg>
            {activePoint !== null && (
                <div className="absolute p-2 text-xs text-center transform -translate-x-1/2 bg-gray-900 text-white rounded-md shadow-xl pointer-events-none" style={{ left: `${points[activePoint].x}px`, top: `${points[activePoint].y - 40}px` }}>
                    <p className="font-bold">{points[activePoint].score}</p>
                    <p>{points[activePoint].subject}</p>
                    <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
                </div>
            )}
        </div>
    );
};


/**
 * Renders a vertical timeline of reports and violations.
 */
const ActivityTimeline: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
    if (items.length === 0) {
        return <div className="text-center py-8 text-gray-400">Tidak ada aktivitas terbaru.</div>;
    }
    
    const sortedItems = [...items].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10); // show latest 10
    
    const itemConfig = {
        report: { icon: FileTextIcon, color: 'bg-blue-500' },
        violation: { icon: ShieldAlertIcon, color: 'bg-red-500' },
    };

    return (
        <div className="space-y-6">
            {sortedItems.map(item => {
                const config = itemConfig[item.type];
                const Icon = config.icon;
                return (
                    <div key={`${item.type}-${item.id}`} className="flex gap-4 relative">
                        <div className="absolute left-[18px] top-12 h-full border-l-2 border-dashed border-white/20"></div>
                        <div className="flex-shrink-0 z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${config.color}`}>
                                <Icon className="w-5 h-5"/>
                            </div>
                        </div>
                        <div className="flex-grow pb-4">
                            <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'})}</p>
                            <h4 className="font-bold text-white mb-1">
                                {item.type === 'report' ? item.title : item.description}
                            </h4>
                            {item.type === 'report' ? (
                                <p className="text-sm text-gray-300 italic">"{item.notes}"</p>
                            ) : (
                                <p className="text-sm font-semibold text-red-400">Poin Pelanggaran: {item.points}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <Card
      className={`bg-white/5 backdrop-blur-lg border border-white/10 ${className}`}
      {...props}
    />
);


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
        queryFn: async (): Promise<PortalData> => {
            if (!studentId || !accessCode) throw new Error("ID Siswa atau Kode Akses tidak ada.");
            const { data, error } = await supabase.rpc('get_student_portal_data', {
                student_id_param: studentId,
                access_code_param: accessCode,
            });
            if (error) throw error;
            return data;
        },
        enabled: !!studentId && !!accessCode,
        retry: 1,
    });
    
    const academicSummary = useMemo(() => {
        if (!data?.academicRecords || data.academicRecords.length === 0) {
            return { average: 'N/A', highest: null, lowest: null };
        }
        const scores = data.academicRecords.map(r => r.score);
        const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const highest = [...data.academicRecords].sort((a,b) => b.score - a.score)[0];
        const lowest = [...data.academicRecords].sort((a,b) => a.score - b.score)[0];
        return { average, highest, lowest };
    }, [data?.academicRecords]);
    
    const attendanceSummary = useMemo(() => {
        const summary: Record<string, number> = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
        data?.attendanceRecords.forEach(rec => { summary[rec.status] = (summary[rec.status] || 0) + 1; });
        return summary;
    }, [data?.attendanceRecords]);
    
    const timelineItems: TimelineItem[] = useMemo(() => {
        if (!data) return [];
        const violations: TimelineItem[] = data.violations.map(v => ({...v, type: 'violation'}));
        const reports: TimelineItem[] = data.reports.map(r => ({...r, type: 'report'}));
        return [...violations, ...reports];
    }, [data?.violations, data?.reports]);

    const handleLogout = () => {
        sessionStorage.removeItem('portal_access_code');
        navigate('/portal-login');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen cosmic-bg"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (isError) {
        console.error(error);
        sessionStorage.removeItem('portal_access_code');
        const errorMessage = "Kode akses tidak valid atau sesi telah berakhir. Silakan coba masuk lagi.";
        return (
            <div className="flex flex-col items-center justify-center min-h-screen cosmic-bg text-white p-4 text-center">
                <h1 className="text-2xl font-bold">Akses Ditolak</h1>
                <p className="mt-2">{errorMessage}</p>
                <Button onClick={() => navigate('/portal-login')} className="mt-6">Kembali ke Halaman Login</Button>
            </div>
        );
    }
    
    const { student, academicRecords, quizPoints, violations } = data!;
    const totalViolationPoints = violations.reduce((sum, v) => sum + v.points, 0);

    return (
        <div className="min-h-screen cosmic-bg text-white font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-6">
                        <img src={student.avatar_url} alt={student.name} className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-lg"/>
                        <div>
                            <h1 className="text-4xl font-bold text-shadow-md">{student.name}</h1>
                            <p className="text-xl text-indigo-200">Kelas {student.classes?.name || 'N/A'}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 hover:bg-white/20 self-start sm:self-center"><LogoutIcon className="w-4 h-4 mr-2"/>Logout</Button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                    <div className="lg:col-span-2 space-y-6">
                        <GlassCard>
                            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUpIcon className="w-5 h-5 text-purple-400"/>Performa Akademik</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-center">
                                    <div className="bg-black/20 p-3 rounded-lg"><p className="text-2xl font-bold">{academicSummary.average}</p><p className="text-xs text-gray-400">Rata-rata Nilai</p></div>
                                    <div className="bg-black/20 p-3 rounded-lg"><p className="text-2xl font-bold text-green-400">{academicSummary.highest?.score || 'N/A'}</p><p className="text-xs text-gray-400">Nilai Tertinggi ({academicSummary.highest?.subject || '-'})</p></div>
                                    <div className="bg-black/20 p-3 rounded-lg"><p className="text-2xl font-bold text-red-400">{academicSummary.lowest?.score || 'N/A'}</p><p className="text-xs text-gray-400">Nilai Terendah ({academicSummary.lowest?.subject || '-'})</p></div>
                                </div>
                                <div className="h-56"><GradeTrendChart records={academicRecords}/></div>
                            </CardContent>
                        </GlassCard>
                        <GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-yellow-400"/>Aktivitas Terbaru</CardTitle></CardHeader>
                            <CardContent><ActivityTimeline items={timelineItems}/></CardContent>
                        </GlassCard>
                    </div>
                    
                    <div className="lg:col-span-1 space-y-6">
                        <GlassCard>
                            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircleIcon className="w-5 h-5 text-green-400"/>Ringkasan Kehadiran</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <AttendanceDonut attendanceSummary={attendanceSummary} totalDays={data.attendanceRecords.length}/>
                                <div className="grid grid-cols-2 gap-3 text-sm pt-4">
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg"><span>Sakit</span><span className="font-bold">{attendanceSummary.Sakit}</span></div>
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg"><span>Izin</span><span className="font-bold">{attendanceSummary.Izin}</span></div>
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg"><span>Alpha</span><span className="font-bold">{attendanceSummary.Alpha}</span></div>
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg"><span>Total</span><span className="font-bold">{data.attendanceRecords.length}</span></div>
                                </div>
                            </CardContent>
                        </GlassCard>
                        
                        <GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlertIcon className="w-5 h-5 text-red-400"/>Ringkasan Pelanggaran</CardTitle></CardHeader>
                            <CardContent className="text-center">
                                <p className="text-5xl font-bold text-red-400">{totalViolationPoints}</p>
                                <p className="text-sm text-gray-400">Total Poin Pelanggaran</p>
                                <div className="text-left mt-4 space-y-2 text-sm max-h-40 overflow-y-auto">
                                    {[...violations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3).map(v => (
                                        <div key={v.id} className="p-2 bg-black/20 rounded-lg">
                                            <p className="font-semibold">{v.description} <span className="font-normal text-red-400">({v.points} poin)</span></p>
                                            <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')}</p>
                                        </div>
                                    ))}
                                </div>
                                {violations.length === 0 && <p className="text-center text-gray-400 py-4">Tidak ada catatan pelanggaran.</p>}
                            </CardContent>
                        </GlassCard>

                        <GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-blue-400"/>Poin Keaktifan ({quizPoints.length})</CardTitle></CardHeader>
                            <CardContent>
                                {quizPoints.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                                        {quizPoints.map(p => (
                                            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/20 text-sm font-semibold border border-white/10">
                                                <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0"/>
                                                <span>{p.quiz_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (<p className="text-center text-gray-400 py-4">Belum ada poin keaktifan.</p>)}
                            </CardContent>
                        </GlassCard>
                    </div>
                </main>
                 <footer className="text-center mt-12 text-xs text-gray-400">
                    <p>Portal Siswa Cerdas &copy; {new Date().getFullYear()}</p>
                </footer>
            </div>
        </div>
    );
};

export default ParentPortalPage;
