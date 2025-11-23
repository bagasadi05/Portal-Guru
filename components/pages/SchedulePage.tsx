import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrashIcon, PlusIcon, ClockIcon, PencilIcon, CalendarIcon, BookOpenIcon, GraduationCapIcon, BrainCircuitIcon, DownloadCloudIcon, BellIcon } from '../Icons';
import { Modal } from '../ui/Modal';
import { Type } from '@google/genai';
import { supabase, ai } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as ics from 'ics';

const daysOfWeek: Database['public']['Tables']['schedules']['Row']['day'][] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type ScheduleWithClassName = ScheduleRow & { className?: string };
type ScheduleMutationVars = 
    | { mode: 'add'; data: Database['public']['Tables']['schedules']['Insert'] }
    | { mode: 'edit'; data: Database['public']['Tables']['schedules']['Update']; id: string };

const FormInputWrapper: React.FC<{ children: React.ReactNode; label: string; icon: React.FC<any> }> = ({ children, label, icon: Icon }) => (
    <div>
        <label className="block text-sm font-bold text-gray-200 mb-2">{label}</label>
        <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Icon className="h-5 w-5 text-gray-400" />
            </div>
            {children}
        </div>
    </div>
);

const NotificationPrompt: React.FC<{
    onEnable: () => Promise<void>;
    isLoading: boolean;
}> = ({ onEnable, isLoading }) => {
    return (
        <div className="relative z-10 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <BellIcon className="w-6 h-6 text-purple-300"/>
                </div>
                <div>
                    <h4 className="font-bold text-white">Jangan Lewatkan Jadwal</h4>
                    <p className="text-sm text-gray-300">Aktifkan notifikasi untuk mendapatkan pengingat 5 menit sebelum kelas dimulai.</p>
                </div>
            </div>
            <Button onClick={onEnable} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0">
                {isLoading ? 'Mengaktifkan...' : 'Aktifkan Notifikasi'}
            </Button>
        </div>
    )
};

const SchedulePage: React.FC = () => {
    const { user, isNotificationsEnabled, enableScheduleNotifications } = useAuth();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();
    
    const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; data: ScheduleRow | null }>({ isOpen: false, mode: 'add', data: null });
    const [formData, setFormData] = useState<Omit<Database['public']['Tables']['schedules']['Insert'], 'id' | 'created_at' | 'user_id'>>({ day: 'Senin', start_time: '08:00', end_time: '09:30', subject: '', class_id: '' });
    
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [isAnalysisLoading, setAnalysisLoading] = useState(false);

    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [draggedOverColumn, setDraggedOverColumn] = useState<ScheduleRow['day'] | null>(null);

    const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
    const [conflictWarnings, setConflictWarnings] = useState<{ day: string; time: string; subjects: string[] }[]>([]);

    const [currentTime, setCurrentTime] = useState(new Date());
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; data: ScheduleRow | null }>({ isOpen: false, data: null });


    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timerId);
    }, []);
    const todayName = new Date().toLocaleDateString('id-ID', { weekday: 'long' });

    const { data: schedule = [], isLoading: pageLoading, isError, error: queryError } = useQuery({
        queryKey: ['schedule', user?.id],
        queryFn: async (): Promise<ScheduleRow[]> => {
            const { data, error } = await supabase.from('schedules').select('*').eq('user_id', user!.id).order('day').order('start_time');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });
    
    useEffect(() => {
        if (isError) {
            toast.error(`Gagal memuat jadwal: ${(queryError as Error).message}`);
        }
    }, [isError, queryError, toast]);

    useEffect(() => {
        const conflicts: { day: string; time: string; subjects: string[] }[] = [];
        daysOfWeek.forEach(day => {
            const daySchedule = schedule.filter(s => s.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
            for (let i = 0; i < daySchedule.length - 1; i++) {
                const current = daySchedule[i];
                const next = daySchedule[i + 1];
                const currentEnd = current.end_time;
                const nextStart = next.start_time;
                if (currentEnd > nextStart) {
                    const existingConflict = conflicts.find(c => c.day === day && c.time === `${nextStart}-${currentEnd}`);
                    if (existingConflict) {
                        if (!existingConflict.subjects.includes(next.subject)) {
                            existingConflict.subjects.push(next.subject);
                        }
                    } else {
                        conflicts.push({ day, time: `${nextStart}-${currentEnd}`, subjects: [current.subject, next.subject] });
                    }
                }
            }
        });
        setConflictWarnings(conflicts);
    }, [schedule]);

    const scheduleMutation = useMutation({
        mutationFn: async (scheduleData: ScheduleMutationVars) => {
            if (scheduleData.mode === 'add') {
                const { error } = await supabase.from('schedules').insert(scheduleData.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('schedules').update(scheduleData.data).eq('id', scheduleData.id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule', user?.id] });
            toast.success("Jadwal berhasil disimpan!");
            handleCloseModal();
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const deleteScheduleMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('schedules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule', user?.id] });
            toast.success("Jadwal berhasil dihapus.");
        },
        onError: (error: Error) => toast.error(error.message)
    });

    const handleOpenAddModal = (day?: ScheduleRow['day']) => { 
        setFormData({ day: day || 'Senin', start_time: '08:00', end_time: '09:30', subject: '', class_id: '' }); 
        setModalState({ isOpen: true, mode: 'add', data: null }); 
    };
    const handleOpenEditModal = (item: ScheduleRow) => { setFormData({ day: item.day, start_time: item.start_time, end_time: item.end_time, subject: item.subject, class_id: item.class_id }); setModalState({ isOpen: true, mode: 'edit', data: item }); };
    const handleCloseModal = () => { if (scheduleMutation.isPending) return; setModalState({ isOpen: false, mode: 'add', data: null }); };
    
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        
        if (modalState.mode === 'add') {
            scheduleMutation.mutate({ mode: 'add', data: { ...formData, user_id: user.id } });
        } else if (modalState.data) {
            scheduleMutation.mutate({ mode: 'edit', data: formData, id: modalState.data.id });
        }
    };

    const handleDeleteClick = (item: ScheduleRow) => {
        setConfirmModalState({ isOpen: true, data: item });
    };

    const handleConfirmDelete = () => {
        if (confirmModalState.data) {
            deleteScheduleMutation.mutate(confirmModalState.data.id);
        }
        setConfirmModalState({ isOpen: false, data: null });
    };
    
    const handleAnalyzeSchedule = async () => {
        setAnalysisModalOpen(true); setAnalysisLoading(true); setAnalysisResult(null);
        const systemInstruction = `Anda adalah seorang analis efisiensi jadwal. Tugas Anda adalah menemukan potensi masalah dan peluang optimasi dalam jadwal guru. Jawaban Anda harus dalam format JSON yang sesuai dengan skema yang diberikan. Format teks di dalam JSON harus menggunakan markdown (e.g., '**Teks Tebal**').`;
        const prompt = `Analisis data jadwal JSON berikut dan berikan wawasan. Fokus pada: 1. Konflik Jadwal: Identifikasi jika ada jadwal yang tumpang tindih. Jika tidak ada, sebutkan itu. 2. Hari Terpadat: Tentukan hari mana yang memiliki sesi pelajaran terbanyak dan paling sedikit. 3. Saran Optimasi: Berikan saran untuk mendistribusikan beban kerja secara lebih merata jika perlu. Judul saran (seperti 'Perataan Beban Kerja') harus ditebalkan. Data Jadwal: ${JSON.stringify(schedule)}`;
        const responseSchema = { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, description: "Array berisi bagian-bagian analisis: Konflik Jadwal, Hari Terpadat, dan Saran Optimasi.", items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Judul bagian, diformat dengan markdown untuk bold." }, points: { type: Type.ARRAY, description: "Daftar poin-poin untuk bagian ini.", items: { type: Type.STRING } } } } } } };

        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema, } });
            setAnalysisResult(JSON.parse(response.text));
        } catch (error) {
            console.error("Schedule Analysis Error:", error);
            setAnalysisResult({ error: "Gagal menganalisis jadwal. Silakan coba lagi." });
        } finally {
            setAnalysisLoading(false);
        }
    };

    const handleExportPdf = () => {
        if (!schedule || schedule.length === 0) {
            toast.warning("Tidak ada jadwal untuk diekspor.");
            return;
        }
    
        const doc = new jsPDF();
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;
    
        const dayHexColors: { [key in typeof daysOfWeek[number]]: string } = {
            Senin: '#3b82f6',  // blue-500
            Selasa: '#10b981', // emerald-500
            Rabu: '#f59e0b',   // amber-500
            Kamis: '#8b5cf6', // violet-500
            Jumat: '#f43f5e',   // rose-500
        };
    
        // PDF Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor('#111827'); 
        doc.text("Jadwal Mengajar Mingguan", pageW / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor('#6b7280');
        doc.text(`Laporan untuk: ${user?.name || 'Guru'}`, pageW / 2, y, { align: 'center' });
        y += 15;
    
        // PDF Body
        daysOfWeek.forEach(day => {
            const itemsForDay = schedule.filter(item => item.day === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
            if (itemsForDay.length === 0) return;
    
            const mainColor = dayHexColors[day] || '#6b7280';
            
            if (y + 15 > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }
    
            // Day Header
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(mainColor);
            doc.text(day, margin, y);
            y += 2;
            doc.setDrawColor(mainColor);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageW - margin, y);
            y += 8;
    
            // Schedule Items
            itemsForDay.forEach(item => {
                const cardHeight = 25;
                if (y + cardHeight > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }
    
                // Card background
                doc.setFillColor(248, 250, 252); // slate-50
                doc.setDrawColor(226, 232, 240); // slate-200
                doc.setLineWidth(0.2);
                doc.roundedRect(margin, y, pageW - (margin * 2), cardHeight, 3, 3, 'FD');
                
                const cardContentX = margin + 5;
                let currentY = y + 8;
    
                // Subject
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59); // slate-800
                doc.text(item.subject, cardContentX, currentY);
    
                // Class and Time on the same line
                currentY += 8;
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139); // slate-500
                doc.text(`Kelas ${item.class_id}`, cardContentX, currentY);
                
                const timeText = `${item.start_time} - ${item.end_time}`;
                const timeTextWidth = doc.getTextWidth(timeText);
                doc.text(timeText, pageW - margin - 5 - timeTextWidth, currentY);
                
                y += cardHeight + 4;
            });
            y += 8;
        });
    
        // PDF Footer
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // gray-400
        doc.text(`Dibuat pada ${new Date().toLocaleString('id-ID')}`, margin, doc.internal.pageSize.getHeight() - 10);
        
        doc.save('Jadwal_Mengajar.pdf');
        toast.success("Jadwal PDF berhasil diunduh!");
    };

    const handleExportToIcs = () => {
        if (!schedule || schedule.length === 0) {
            toast.warning("Tidak ada jadwal untuk diekspor.");
            return;
        }

        const dayToICalDay: Record<string, 'MO' | 'TU' | 'WE' | 'TH' | 'FR'> = {
            'Senin': 'MO',
            'Selasa': 'TU',
            'Rabu': 'WE',
            'Kamis': 'TH',
            'Jumat': 'FR',
        };
        const dayNameToIndex: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };

        const events: ics.EventAttributes[] = schedule.map(item => {
            const [startHour, startMinute] = item.start_time.split(':').map(Number);
            const [endHour, endMinute] = item.end_time.split(':').map(Number);

            const now = new Date();
            const targetDayIndex = dayNameToIndex[item.day];
            const currentDayIndex = now.getDay();
            
            let dayDifference = targetDayIndex - currentDayIndex;
            if (dayDifference < 0 || (dayDifference === 0 && (now.getHours() > startHour || (now.getHours() === startHour && now.getMinutes() > startMinute)))) {
                dayDifference += 7;
            }

            const eventDate = new Date();
            eventDate.setDate(now.getDate() + dayDifference);

            const year = eventDate.getFullYear();
            const month = eventDate.getMonth() + 1;
            const day = eventDate.getDate();
            
            return {
                uid: `guru-pwa-${item.id}@myapp.com`,
                title: `${item.subject} (Kelas ${item.class_id})`,
                start: [year, month, day, startHour, startMinute],
                end: [year, month, day, endHour, endMinute],
                recurrenceRule: `FREQ=WEEKLY;BYDAY=${dayToICalDay[item.day]}`,
                description: `Jadwal mengajar untuk kelas ${item.class_id}`,
                location: 'Sekolah',
                startOutputType: 'local',
                endOutputType: 'local',
                alarms: [
                    {
                        action: 'display',
                        description: 'Pengingat Kelas',
                        trigger: { minutes: 10, before: true },
                    }
                ]
            };
        });

        ics.createEvents(events, (error, value) => {
            if (error) {
                toast.error("Gagal membuat file kalender.");
                console.error(error);
                return;
            }
            const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'jadwal_mengajar.ics';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("File kalender (.ics) berhasil diunduh!");
        });
    };
    
    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: ScheduleRow) => {
        if (!isOnline) return;
        setDraggedItemId(item.id);
        e.dataTransfer.setData('text/plain', item.id);
        e.currentTarget.classList.add('opacity-50', 'rotate-3', 'scale-105');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('opacity-50', 'rotate-3', 'scale-105');
        setDraggedItemId(null);
        setDraggedOverColumn(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, day: ScheduleRow['day']) => {
        e.preventDefault();
        if (day !== draggedOverColumn) {
            setDraggedOverColumn(day);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newDay: ScheduleRow['day']) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;

        const currentItem = schedule.find(item => item.id === id);
        if (currentItem && currentItem.day !== newDay) {
            scheduleMutation.mutate({ mode: 'edit', data: { day: newDay }, id });
        }
        setDraggedItemId(null);
        setDraggedOverColumn(null);
    };

    const handleEnableNotifications = async () => {
        setIsEnablingNotifications(true);
        if (!schedule || schedule.length === 0) {
            toast.warning("Tidak ada data jadwal untuk notifikasi.");
            setIsEnablingNotifications(false);
            return;
        }

        const { data: classes, error } = await supabase.from('classes').select('id, name').eq('user_id', user!.id);
        if (error) {
            toast.error("Gagal mengambil data kelas untuk notifikasi.");
            setIsEnablingNotifications(false);
            return;
        }

        const classMap = new Map<string, string>((classes || []).map(c => [c.id, c.name]));
        const scheduleWithClassNames: ScheduleWithClassName[] = schedule.map(item => ({
            ...item,
            className: classMap.get(item.class_id) || item.class_id
        }));

        const success = await enableScheduleNotifications(scheduleWithClassNames);
        if (success) {
            toast.success("Notifikasi jadwal berhasil diaktifkan!");
        }
        setIsEnablingNotifications(false);
    };

    if (pageLoading) return <div className="flex items-center justify-center h-full bg-gray-950"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const inputStyles = "pl-10 bg-white/10 border-white/20 placeholder:text-gray-400 text-white focus:bg-white/20 focus:border-purple-400";
    const dayIndexMap = { 'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4 };
    const todayIndex = dayIndexMap[todayName as keyof typeof dayIndexMap] ?? -1;
    
    const dayColorMap: Record<string, string> = {
        Senin: 'schedule-card-senin',
        Selasa: 'schedule-card-selasa',
        Rabu: 'schedule-card-rabu',
        Kamis: 'schedule-card-kamis',
        Jumat: 'schedule-card-jumat'
    };

    return (
        <div className="w-full h-full p-4 sm:p-6 md:p-8 relative text-white flex flex-col bg-gray-950">
            <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Jadwal Pelajaran</h1>
                    <p className="mt-1 text-indigo-200">Atur jadwal mengajar mingguan Anda dengan mudah.</p>
                </div>
                <div className="flex gap-2 self-end md:self-center">
                    <Button onClick={handleAnalyzeSchedule} variant="outline" disabled={!isOnline || schedule.length === 0}><BrainCircuitIcon className="w-4 h-4 mr-2 text-sky-500 dark:text-purple-400"/>Analisis AI</Button>
                    <Button onClick={handleExportPdf} variant="outline"><DownloadCloudIcon className="w-4 h-4 mr-2"/>PDF</Button>
                    <Button onClick={handleExportToIcs} variant="outline"><CalendarIcon className="w-4 h-4 mr-2"/>ICS</Button>
                    <Button onClick={() => handleOpenAddModal()} disabled={!isOnline}><PlusIcon className="w-5 h-5 mr-2" /> Jadwal</Button>
                </div>
            </header>

            {!isNotificationsEnabled && <NotificationPrompt onEnable={handleEnableNotifications} isLoading={isEnablingNotifications} />}

            {conflictWarnings.length > 0 && (
                <div className="relative z-10 bg-red-500/10 backdrop-blur-lg rounded-2xl border border-red-500/30 p-4 mb-6 animate-fade-in">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <AlertCircleIcon className="w-6 h-6 text-red-300"/>
                        </div>
                        <div className="flex-grow">
                            <h4 className="font-bold text-white mb-2">Konflik Jadwal Terdeteksi!</h4>
                            <div className="space-y-2">
                                {conflictWarnings.map((conflict, idx) => (
                                    <div key={idx} className="text-sm text-gray-200">
                                        <span className="font-semibold">{conflict.day}</span> jam <span className="font-semibold">{conflict.time}</span>: {conflict.subjects.join(' & ')}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-300 mt-2">Harap sesuaikan jadwal untuk menghindari bentrok.</p>
                        </div>
                    </div>
                </div>
            )}

            <main className="relative z-10 flex-grow flex flex-col md:flex-row gap-6 md:overflow-x-auto p-2 -mx-2 md:mx-0">
                {daysOfWeek.map((day, dayIdx) => {
                    const itemsForDay = schedule.filter(item => item.day === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
                    return (
                        <div
                            key={day}
                            onDragOver={(e) => isOnline && handleDragOver(e, day)}
                            onDrop={(e) => isOnline && handleDrop(e, day)}
                            className={`bg-gradient-to-b from-white/10 to-transparent backdrop-blur-lg rounded-2xl border p-4 w-full md:flex-1 md:min-w-[300px] flex flex-col transition-all duration-300 ${draggedOverColumn === day ? 'border-2 border-purple-500 scale-105' : 'border-white/10'} ${todayIndex === dayIdx ? 'border-2 border-sky-400/50' : ''}`}
                        >
                            <div className={`font-bold text-lg pb-3 mb-4 border-b-2 flex justify-between items-center ${dayColorMap[day].replace('schedule-card-','border-')}`}>
                                <span className="text-white">{day}</span>
                                <span className="text-sm font-semibold text-gray-300 bg-black/20 rounded-full px-2.5 py-0.5">{itemsForDay.length}</span>
                            </div>
                            <div className="space-y-4 flex-grow overflow-y-auto pr-2 -mr-2">
                                {itemsForDay.map(item => (
                                    <div
                                        key={item.id}
                                        draggable={isOnline}
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        onDragEnd={handleDragEnd}
                                        className={`group relative bg-black/20 backdrop-blur-sm border-l-4 p-4 rounded-xl transition-all hover:shadow-lg hover:-translate-y-1 hover:border-purple-400 ${dayColorMap[item.day]} ${draggedItemId === item.id ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
                                    >
                                        <p className="font-bold text-lg text-white break-words">{item.subject}</p>
                                        <div className="text-sm text-gray-300 mt-2 space-y-1">
                                            <p className="flex items-center gap-2"><GraduationCapIcon className="w-4 h-4 text-gray-400"/> Kelas {item.class_id}</p>
                                            <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4 text-gray-400"/> {item.start_time} - {item.end_time}</p>
                                        </div>
                                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/10 text-white hover:bg-white/20" onClick={() => handleOpenEditModal(item)} disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 bg-white/10 hover:bg-red-500/50 hover:text-white" onClick={() => handleDeleteClick(item)} disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                                {draggedOverColumn === day && <div className="h-24 rounded-lg border-2 border-dashed border-purple-500 bg-purple-500/10 animate-pulse"></div>}
                            </div>
                            <Button onClick={() => handleOpenAddModal(day)} variant="ghost" className="mt-4 w-full text-gray-400 hover:bg-white/10 hover:text-white" disabled={!isOnline}>
                                <PlusIcon className="w-4 h-4 mr-2"/> Tambah Jadwal
                            </Button>
                        </div>
                    );
                })}
            </main>
            
            <Modal isOpen={modalState.isOpen} onClose={handleCloseModal} title={modalState.mode === 'add' ? 'Tambah Jadwal Baru' : 'Edit Jadwal'} icon={<CalendarIcon className="h-5 w-5"/>}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <FormInputWrapper label="Hari" icon={CalendarIcon}>
                        <select value={formData.day} onChange={e => setFormData({ ...formData, day: e.target.value as ScheduleRow['day'] })} className={`w-full ${inputStyles}`}>{daysOfWeek.map(d => <option key={d} value={d} className="bg-gray-800">{d}</option>)}</select>
                    </FormInputWrapper>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInputWrapper label="Waktu Mulai" icon={ClockIcon}><Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className={inputStyles} required /></FormInputWrapper>
                        <FormInputWrapper label="Waktu Selesai" icon={ClockIcon}><Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className={inputStyles} required /></FormInputWrapper>
                    </div>
                    <FormInputWrapper label="Mata Pelajaran" icon={BookOpenIcon}><Input value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className={inputStyles} required placeholder="cth. Matematika" /></FormInputWrapper>
                    <FormInputWrapper label="ID Kelas" icon={GraduationCapIcon}><Input value={formData.class_id} onChange={e => setFormData({ ...formData, class_id: e.target.value })} className={inputStyles} required placeholder="cth. 7A" /></FormInputWrapper>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={handleCloseModal} disabled={scheduleMutation.isPending}>Batal</Button><Button type="submit" disabled={scheduleMutation.isPending}>{scheduleMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>
             <Modal isOpen={isAnalysisModalOpen} onClose={() => setAnalysisModalOpen(false)} title="Analisis Jadwal AI" icon={<BrainCircuitIcon className="h-5 w-5"/>}>
                {isAnalysisLoading ? <div className="text-center py-8">Menganalisis jadwal...</div> : analysisResult ? (
                    analysisResult.error ? <p className="text-red-400">{analysisResult.error}</p> : (
                        <div className="space-y-4">
                            {analysisResult.sections?.map((section: any, index: number) => (
                                <div key={index}>
                                    <h4 className="font-bold text-lg text-purple-300" dangerouslySetInnerHTML={{ __html: section.title }}></h4>
                                    <ul className="list-disc list-inside space-y-1 mt-2 text-gray-300">
                                        {section.points?.map((point: string, pIndex: number) => <li key={pIndex}>{point}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )
                ) : <div className="text-center py-8">Tidak ada hasil analisis.</div>}
            </Modal>
             <Modal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState({ isOpen: false, data: null })} title="Konfirmasi Hapus">
                <p>Anda yakin ingin menghapus jadwal <strong className="text-white">"{confirmModalState.data?.subject}"</strong> pada hari <strong className="text-white">{confirmModalState.data?.day}</strong>?</p>
                <div className="flex justify-end gap-2 pt-4 mt-4">
                    <Button variant="ghost" onClick={() => setConfirmModalState({ isOpen: false, data: null })} disabled={deleteScheduleMutation.isPending}>Batal</Button>
                    <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteScheduleMutation.isPending}>{deleteScheduleMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}</Button>
                </div>
            </Modal>
        </div>
    );
};

export default SchedulePage;