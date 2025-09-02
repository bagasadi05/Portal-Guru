
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '../ui/Card';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarIcon, UsersIcon, BookOpenIcon, ClockIcon, SparklesIcon, BrainCircuitIcon, CheckSquareIcon, AlertTriangleIcon, CheckCircleIcon } from '../Icons';
import { Button } from '../ui/Button';
import { Type } from '@google/genai';
import { ai } from '../../services/supabase';
import { supabase } from '../../services/supabase';
import { Database } from '../../services/database.types';
import { useQuery } from '@tanstack/react-query';
import DashboardPageSkeleton from '../skeletons/DashboardPageSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type WeeklyAttendance = { day: string; present_percentage: number };

type DashboardQueryData = {
    students: Pick<StudentRow, 'id' | 'name'>[];
    tasks: TaskRow[];
    schedule: ScheduleRow[];
    classes: Pick<ClassRow, 'id' | 'name'>[];
    dailyAttendanceSummary: { present: number; total: number };
    weeklyAttendance: WeeklyAttendance[];
    academicRecords: Pick<Database['public']['Tables']['academic_records']['Row'], 'student_id' | 'subject' | 'score'>[];
    violations: Pick<Database['public']['Tables']['violations']['Row'], 'student_id' | 'points'>[];
};

type AiInsight = {
    positive_highlights: { student_name: string; reason: string; }[];
    areas_for_attention: { student_name: string; reason: string; }[];
    class_focus_suggestion: string;
};

const fetchDashboardData = async (userId: string): Promise<DashboardQueryData> => {
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = new Date().toLocaleDateString('id-ID', { weekday: 'long' });

    const [
        studentsRes, tasksRes, scheduleRes, classesRes, dailyAttendanceRes,
        weeklyAttendanceRes, academicRecordsRes, violationsRes
    ] = await Promise.all([
        supabase.from('students').select('id, name').eq('user_id', userId),
        supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done').order('due_date'),
        supabase.from('schedules').select('*').eq('user_id', userId).eq('day', todayDay as Database['public']['Tables']['schedules']['Row']['day']).order('start_time'),
        supabase.from('classes').select('id, name').eq('user_id', userId),
        supabase.from('attendance').select('status', { count: 'exact' }).eq('user_id', userId).eq('date', today),
        supabase.rpc('get_weekly_attendance_summary'),
        supabase.from('academic_records').select('student_id, subject, score').eq('user_id', userId),
        supabase.from('violations').select('student_id, points').eq('user_id', userId)
    ]);

    const errors = [studentsRes, tasksRes, scheduleRes, classesRes, dailyAttendanceRes, weeklyAttendanceRes, academicRecordsRes, violationsRes]
        .map(res => res.error).filter(Boolean);
    if (errors.length > 0) throw new Error(errors.map(e => e.message).join(', '));
    
    const presentCount = dailyAttendanceRes.data?.filter(a => a.status === 'Hadir').length || 0;

    return {
        students: studentsRes.data || [],
        tasks: tasksRes.data || [],
        schedule: scheduleRes.data || [],
        classes: classesRes.data || [],
        dailyAttendanceSummary: { present: presentCount, total: dailyAttendanceRes.count || 0 },
        weeklyAttendance: weeklyAttendanceRes.data as WeeklyAttendance[] || [],
        academicRecords: academicRecordsRes.data || [],
        violations: violationsRes.data || [],
    };
};

const AiDashboardInsight: React.FC<{ dashboardData: DashboardQueryData | null }> = ({ dashboardData }) => {
    const { data: insight, isLoading } = useQuery({
        queryKey: ['aiDashboardInsight', dashboardData],
        queryFn: async () => {
             if (!dashboardData) return null;
            try {
                const { students, academicRecords, violations, dailyAttendanceSummary } = dashboardData;
                const studentMap = new Map(dashboardData.students.map(s => [s.name, s.id]));

                const systemInstruction = `Anda adalah asisten guru AI yang cerdas dan proaktif. Analisis data yang diberikan dan hasilkan ringkasan dalam format JSON yang valid. Fokus pada menyoroti pencapaian positif, area yang memerlukan perhatian, dan saran umum. Gunakan Bahasa Indonesia.`;
                const studentDataForPrompt = students.map(s => {
                    const studentViolations = violations.filter(v => v.student_id === s.id).reduce((sum, v) => sum + v.points, 0);
                    const studentScores = academicRecords.filter(r => r.student_id === s.id);
                    const avgScore = studentScores.length > 0 ? studentScores.reduce((a, b) => a + b.score, 0) / studentScores.length : null;
                    return { name: s.name, total_violation_points: studentViolations, average_score: avgScore ? Math.round(avgScore) : 'N/A' };
                });
                const prompt = `Analisis data guru berikut untuk memberikan wawasan harian. Data Ringkasan: Total Siswa: ${students.length}, Absensi Hari Ini: ${dailyAttendanceSummary.present} dari ${students.length} hadir. Data Rinci Siswa (nilai & pelanggaran): ${JSON.stringify(studentDataForPrompt)} Tugas Anda: 1. Identifikasi 1-2 siswa berprestasi (nilai rata-rata tinggi, 0 poin pelanggaran). 2. Identifikasi 1-2 siswa yang memerlukan perhatian (nilai rata-rata rendah atau poin pelanggaran tinggi). 3. Berikan satu saran fokus untuk kelas secara umum.`;
                const responseSchema = { type: Type.OBJECT, properties: { positive_highlights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { student_name: { type: Type.STRING }, reason: { type: Type.STRING } } } }, areas_for_attention: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { student_name: { type: Type.STRING }, reason: { type: Type.STRING } } } }, class_focus_suggestion: { type: Type.STRING } } };

                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema } });
                const parsedInsight: AiInsight = JSON.parse(response.text);

                // Add student IDs to the insight object
                const enrichedInsight = {
                    ...parsedInsight,
                    positive_highlights: parsedInsight.positive_highlights.map(h => ({ ...h, student_id: studentMap.get(h.student_name) })),
                    areas_for_attention: parsedInsight.areas_for_attention.map(a => ({ ...a, student_id: studentMap.get(a.student_name) }))
                };
                return enrichedInsight;
            } catch (err) { console.error("AI Insight Error:", err); return null; }
        },
        enabled: !!dashboardData,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });

    if (isLoading) {
        return <div className="space-y-4"><div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-1/2"></div><div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-full"></div><div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-3/4"></div></div>;
    }

    if (!insight) {
        return <p className="text-sm text-gray-400">Wawasan AI tidak tersedia saat ini.</p>
    }

    return (
        <div className="space-y-4 text-sm">
            {insight.positive_highlights?.length > 0 && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircleIcon className="w-5 h-5 text-green-400"/></div>
                    <div><p className="font-bold text-gray-900 dark:text-gray-200">Siswa Berprestasi</p>
                        {insight.positive_highlights.map(item => (
                            <p key={item.student_name} className="text-gray-600 dark:text-gray-400">
                                <Link to={`/siswa/${item.student_id}`} className="font-semibold text-green-600 dark:text-green-400 hover:underline">{item.student_name}</Link>: {item.reason}
                            </p>
                        ))}
                    </div>
                </div>
            )}
             {insight.areas_for_attention?.length > 0 && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center"><AlertTriangleIcon className="w-5 h-5 text-yellow-400"/></div>
                    <div><p className="font-bold text-gray-900 dark:text-gray-200">Perlu Perhatian</p>
                         {insight.areas_for_attention.map(item => (
                            <p key={item.student_name} className="text-gray-600 dark:text-gray-400">
                                <Link to={`/siswa/${item.student_id}`} className="font-semibold text-yellow-600 dark:text-yellow-400 hover:underline">{item.student_name}</Link>: {item.reason}
                            </p>
                        ))}
                    </div>
                </div>
            )}
            {insight.class_focus_suggestion && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><SparklesIcon className="w-5 h-5 text-blue-400"/></div>
                    <div><p className="font-bold text-gray-900 dark:text-gray-200">Saran Hari Ini</p><p className="text-gray-600 dark:text-gray-400">{insight.class_focus_suggestion}</p></div>
                </div>
            )}
        </div>
    );
};

const WeeklyAttendanceChart: React.FC<{ data: WeeklyAttendance[] }> = ({ data }) => {
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
    const chartHeight = 150;
    const barWidth = 30;
    const gap = 20;

    return (
        <div className="w-full h-full flex justify-center items-end">
            <svg width="100%" height={chartHeight} aria-label="Grafik absensi mingguan">
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="text-sky-500 dark:text-purple-500" stopColor="currentColor" />
                        <stop offset="100%" className="text-sky-700 dark:text-blue-500" stopColor="currentColor" />
                    </linearGradient>
                </defs>
                {data.map((day, index) => {
                    const barHeight = day.present_percentage > 0 ? (day.present_percentage / 100) * (chartHeight - 50) : 5; // Reserve 50px for labels and tooltip
                    const x = index * (barWidth + gap) + (gap * 2);
                    const y = chartHeight - barHeight - 20;

                    return (
                        <g key={day.day} 
                           onMouseEnter={() => setHoveredIndex(index)} 
                           onMouseLeave={() => setHoveredIndex(null)}
                           className="cursor-pointer">
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                fill="url(#barGradient)"
                                rx="4"
                                className="transition-all duration-300"
                                style={{ transform: hoveredIndex === index ? 'scaleY(1.05)' : 'scaleY(1)', transformOrigin: `bottom` }}
                            />
                            <text
                                x={x + barWidth / 2}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                fontSize="12"
                                className="font-semibold fill-gray-500 dark:fill-gray-400"
                            >
                                {day.day.slice(0, 3)}
                            </text>
                            {hoveredIndex === index && (
                                <g className="transition-opacity duration-300 animate-fade-in" style={{ opacity: 1 }}>
                                    <rect x={x - 10} y={y - 28} width={barWidth + 20} height={22} rx="5" className="fill-gray-800 dark:fill-gray-900 stroke-gray-500 dark:stroke-purple-400/50" />
                                    <text
                                        x={x + barWidth / 2}
                                        y={y - 14}
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="bold"
                                        fill="#fff"
                                    >
                                        {Math.round(day.present_percentage)}%
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timerId);
    }, []);

    const { data, isLoading } = useQuery({
        queryKey: ['dashboardData', user?.id],
        queryFn: () => fetchDashboardData(user!.id),
        enabled: !!user,
    });
    
    if (isLoading) return <DashboardPageSkeleton />;

    const { students = [], tasks = [], schedule = [], classes = [], dailyAttendanceSummary, weeklyAttendance = [] } = data || {};
    const todaySchedule = schedule.map(item => ({ ...item, className: classes.find(c => c.id === item.class_id)?.name || item.class_id }));

    const stats = [
      { label: 'Total Siswa', value: students.length, icon: UsersIcon, link: '/siswa', color: 'from-sky-500 to-blue-500', darkColor: 'dark:from-sky-500 dark:to-blue-500' },
      { label: 'Kehadiran Hari Ini', value: `${dailyAttendanceSummary?.present || 0}/${students.length}`, icon: CheckSquareIcon, link: '/absensi', color: 'from-emerald-500 to-green-500', darkColor: 'dark:from-emerald-500 dark:to-green-500' },
      { label: 'Tugas Aktif', value: tasks.length, icon: BookOpenIcon, link: '/tugas', color: 'from-amber-500 to-yellow-500', darkColor: 'dark:from-amber-500 dark:to-yellow-500' },
      { label: 'Jadwal Hari Ini', value: schedule.length, icon: CalendarIcon, link: '/jadwal', color: 'from-violet-500 to-purple-500', darkColor: 'dark:from-violet-500 dark:to-purple-500' }
    ];

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 flex flex-col space-y-8 animate-fade-in">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-shadow-md">Selamat datang kembali, {user?.name}!</h2>
                <p className="mt-1 text-lg text-gray-600 dark:text-indigo-200">Berikut adalah ringkasan aktivitas kelas Anda hari ini.</p>
            </header>
            
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                {/* Left Column */}
                <div className="xl:col-span-3 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {stats.map(stat => (
                            <Link to={stat.link} key={stat.label} className="group block">
                                <Card className="p-5 flex items-center gap-5 bg-white dark:bg-gradient-to-br dark:from-gray-900/80 dark:to-gray-800/70 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/90 group-hover:border-gray-300 dark:group-hover:border-purple-400/50 group-hover:-translate-y-1 dark:holographic-shine-hover overflow-hidden relative">
                                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${stat.color} ${stat.darkColor} shadow-lg text-white transition-transform group-hover:scale-110`}>
                                        <stat.icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</p>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                    
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-3"><BrainCircuitIcon className="w-6 h-6 text-sky-500 dark:text-purple-400"/>Wawasan Harian AI</CardTitle></CardHeader>
                        <CardContent><AiDashboardInsight dashboardData={data} /></CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Absensi Mingguan</CardTitle><CardDescription>Persentase kehadiran selama 5 hari terakhir.</CardDescription></CardHeader>
                        <CardContent className="h-[180px] p-2">
                           <WeeklyAttendanceChart data={weeklyAttendance} />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="xl:col-span-2 space-y-8">
                     <Card className="h-full max-h-[700px] flex flex-col">
                        <Tabs defaultValue="schedule" className="w-full flex flex-col h-full">
                            <TabsList className="m-4 self-center">
                                <TabsTrigger value="schedule">Jadwal Hari Ini</TabsTrigger>
                                <TabsTrigger value="tasks">Tugas Mendatang</TabsTrigger>
                            </TabsList>
                            <TabsContent value="schedule" className="flex-1 overflow-y-auto px-6 pb-6">
                                <div className="space-y-3">
                                    {todaySchedule.length > 0 ? todaySchedule.map(item => {
                                        const now = currentTime;
                                        const [startH, startM] = item.start_time.split(':').map(Number);
                                        const [endH, endM] = item.end_time.split(':').map(Number);
                                        const startTime = new Date(now); startTime.setHours(startH, startM, 0, 0);
                                        const endTime = new Date(now); endTime.setHours(endH, endM, 0, 0);
                                        const isPast = now > endTime;
                                        const isCurrent = now >= startTime && now <= endTime;
                                        
                                        let progressPercent = 0;
                                        if (isCurrent) {
                                            const totalDuration = endTime.getTime() - startTime.getTime();
                                            const elapsed = now.getTime() - startTime.getTime();
                                            progressPercent = Math.min(100, (elapsed / totalDuration) * 100);
                                        }

                                        const containerClasses = `relative flex items-center gap-3 p-3 bg-gray-100 dark:bg-black/20 rounded-lg transition-all duration-300 overflow-hidden ${isPast ? 'opacity-50' : ''} ${isCurrent ? 'border-2 border-sky-500 dark:border-purple-500 shadow-lg shadow-sky-500/20 dark:shadow-purple-500/20' : ''}`;

                                        return (
                                            <div key={item.id} className={containerClasses}>
                                                <div className="flex-shrink-0 w-14 text-center bg-gray-200 dark:bg-white/5 p-2 rounded-md"><p className="text-sm font-bold text-gray-800 dark:text-white">{item.start_time.slice(0,5)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{item.end_time.slice(0,5)}</p></div>
                                                <div><p className="font-semibold text-gray-900 dark:text-white">{item.subject}</p><p className="text-xs text-gray-500 dark:text-gray-400">Kelas {item.className}</p></div>
                                                {isCurrent && (
                                                    <div className="absolute bottom-0 left-0 h-1 bg-sky-500 dark:bg-purple-500" style={{ width: `${progressPercent}%`, transition: 'width 1s linear' }}></div>
                                                )}
                                            </div>
                                        );
                                    }) : <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Tidak ada jadwal hari ini.</p>}
                                </div>
                            </TabsContent>
                            <TabsContent value="tasks" className="flex-1 overflow-y-auto px-6 pb-6">
                                <div className="space-y-3">
                                    {tasks.length > 0 ? tasks.slice(0, 10).map(task => (
                                        <div key={task.id} className="p-3 bg-gray-100 dark:bg-black/20 rounded-lg">
                                            <p className="font-semibold text-gray-900 dark:text-white">{task.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Jatuh tempo: {task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID') : 'Tidak ada'}</p>
                                        </div>
                                    )) : <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Tidak ada tugas aktif.</p>}
                                </div>
                                <div className="mt-4"><Button variant="outline" size="sm" onClick={() => navigate('/tugas')} className="w-full">Lihat Semua Tugas</Button></div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;