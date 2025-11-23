import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { useToast } from '../../hooks/useToast';
import { GraduationCapIcon, UsersIcon, PlusIcon, PencilIcon, TrashIcon, AlertCircleIcon, LayoutGridIcon, ListIcon, KeyRoundIcon, SearchIcon } from '../Icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StudentsPageSkeleton from '../skeletons/StudentsPageSkeleton';
import { Card } from '../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';


type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];

// Simplified data type for this page to improve performance
type StudentsPageData = {
    classes: ClassRow[];
    students: StudentRow[];
};

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'default' | 'destructive';
    isLoading?: boolean;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'destructive', isLoading = false }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={<AlertCircleIcon className="w-5 h-5"/>}>
        <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400"><p>{message}</p></div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                    Batal
                </Button>
                <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isLoading}>
                    {isLoading ? 'Memproses...' : confirmText}
                </Button>
            </div>
        </div>
    </Modal>
);

const generateAccessCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const StudentsPage: React.FC = () => {
    const toast = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeClassId, setActiveClassId] = useState<string>('');
    const [sortBy, setSortBy] = useState<'name' | 'gender'>('name');
    const [genderFilter, setGenderFilter] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');
    
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
    const [currentStudent, setCurrentStudent] = useState<StudentRow | null>(null);

    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [classModalMode, setClassModalMode] = useState<'add' | 'edit'>('add');
    const [currentClass, setCurrentClass] = useState<ClassRow | null>(null);
    const [classNameInput, setClassNameInput] = useState('');
    const [isClassManageModalOpen, setIsClassManageModalOpen] = useState(false);

    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; confirmVariant?: 'default' | 'destructive', confirmText?: string }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmVariant: 'destructive' });

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['studentsPageData', user?.id],
        queryFn: async (): Promise<StudentsPageData | null> => {
            if (!user) return null;
            const [classesRes, studentsRes] = await Promise.all([
                supabase.from('classes').select('*').eq('user_id', user.id).order('name'),
                supabase.from('students').select('*').eq('user_id', user.id),
            ]);
            if (classesRes.error) throw new Error(classesRes.error.message);
            if (studentsRes.error) throw new Error(studentsRes.error.message);
            return { classes: classesRes.data || [], students: studentsRes.data || [] };
        },
        enabled: !!user,
    });

    useEffect(() => { if (isError) { toast.error(`Gagal memuat data: ${(queryError as Error).message}`); } }, [isError, queryError, toast]);

    const { students = [], classes = [] } = data || {};

    useEffect(() => {
        if (classes && classes.length > 0 && !activeClassId) {
            setActiveClassId(classes[0].id);
        }
    }, [classes, activeClassId]);

    const mutationOptions = {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); },
        onError: (error: Error) => toast.error(`Error: ${error.message}`),
    };

    const { mutate: addStudent, isPending: isAddingStudent } = useMutation({
        mutationFn: async (newStudent: Database['public']['Tables']['students']['Insert']) => { const { error } = await supabase.from('students').insert([newStudent]); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Siswa berhasil ditambahkan."); setIsStudentModalOpen(false); },
    });

    const { mutate: updateStudent, isPending: isUpdatingStudent } = useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string } & Database['public']['Tables']['students']['Update']) => { const { error } = await supabase.from('students').update(updateData).eq('id', id); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Siswa berhasil diperbarui."); setIsStudentModalOpen(false); },
    });
    
    const { mutate: deleteStudent, isPending: isDeletingStudent } = useMutation({
        mutationFn: async (studentId: string) => { const { error } = await supabase.from('students').delete().eq('id', studentId); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Siswa berhasil dihapus."); setConfirmModalState(prev => ({ ...prev, isOpen: false })); },
    });

    const { mutate: addClass, isPending: isAddingClass } = useMutation({
        mutationFn: async (newClass: Database['public']['Tables']['classes']['Insert']) => { const { error } = await supabase.from('classes').insert([newClass]); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Kelas berhasil ditambahkan."); setIsClassModalOpen(false); },
    });

    const { mutate: updateClass, isPending: isUpdatingClass } = useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string } & Database['public']['Tables']['classes']['Update']) => { const { error } = await supabase.from('classes').update(updateData).eq('id', id); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Kelas berhasil diperbarui."); setIsClassModalOpen(false); },
    });

    const { mutate: deleteClass, isPending: isDeletingClass } = useMutation({
        mutationFn: async (classId: string) => { const { error } = await supabase.from('classes').delete().eq('id', classId); if (error) throw error; },
        ...mutationOptions,
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Kelas berhasil dihapus."); setConfirmModalState(prev => ({ ...prev, isOpen: false })); },
    });
    
    const { mutate: generateBulkCodes, isPending: isGeneratingBulkCodes } = useMutation({
        mutationFn: async (classId: string) => {
            const studentsInClass = students.filter(s => s.class_id === classId);
            const studentsToUpdate = studentsInClass.filter(s => !s.access_code).map(s => ({
                id: s.id,
                name: s.name,
                class_id: s.class_id,
                avatar_url: s.avatar_url,
                user_id: s.user_id,
                gender: s.gender,
                access_code: generateAccessCode(),
            }));
            if (studentsToUpdate.length === 0) return { message: "Semua siswa di kelas ini sudah memiliki kode akses." };
            const { error } = await supabase.from('students').upsert(studentsToUpdate);
            if (error) throw error;
            return { count: studentsToUpdate.length };
        },
        ...mutationOptions,
        onSuccess: (result) => {
            mutationOptions.onSuccess();
            if (result.message) { toast.info(result.message); }
            else { toast.success(`${result.count} kode akses baru berhasil dibuat.`); }
            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        },
    });

    const studentsForActiveClass = useMemo(() => {
        let filtered = students.filter(student => student.class_id === activeClassId);

        if (searchTerm) {
            filtered = filtered.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (genderFilter !== 'all') {
            filtered = filtered.filter(student => student.gender === genderFilter);
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name, 'id-ID');
            } else {
                return a.gender.localeCompare(b.gender);
            }
        });
    }, [searchTerm, students, activeClassId, sortBy, genderFilter]);

    const studentStats = useMemo(() => {
        const allInClass = students.filter(s => s.class_id === activeClassId);
        const maleCount = allInClass.filter(s => s.gender === 'Laki-laki').length;
        const femaleCount = allInClass.filter(s => s.gender === 'Perempuan').length;
        return { total: allInClass.length, male: maleCount, female: femaleCount };
    }, [students, activeClassId]);

    const handleOpenStudentModal = (mode: 'add' | 'edit', student: StudentRow | null = null) => {
        if (classes.length === 0) { toast.warning("Silakan tambah data kelas terlebih dahulu sebelum menambah siswa."); return; }
        setStudentModalMode(mode); setCurrentStudent(student); setIsStudentModalOpen(true);
    };

    const handleStudentFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!user) return;
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string; const class_id = formData.get('class_id') as string; const gender = formData.get('gender') as 'Laki-laki' | 'Perempuan';
        const avatarGender = gender === 'Laki-laki' ? 'boy' : 'girl'; const avatar_url = `https://avatar.iran.liara.run/public/${avatarGender}?username=${encodeURIComponent(name || Date.now())}`;
        
        if (studentModalMode === 'add') {
            const newStudentData: Database['public']['Tables']['students']['Insert'] = { name, class_id, user_id: user.id, gender, avatar_url };
            addStudent(newStudentData);
        } else if (currentStudent) {
            const newAvatarUrl = (currentStudent.gender !== gender || currentStudent.avatar_url.includes('pravatar')) ? avatar_url : currentStudent.avatar_url;
            const updateData: Database['public']['Tables']['students']['Update'] = { name, class_id, gender, avatar_url: newAvatarUrl };
            updateStudent({ id: currentStudent.id, ...updateData });
        }
    };
    
    const handleDeleteStudentClick = (student: StudentRow) => {
        setConfirmModalState({
            isOpen: true, title: 'Hapus Siswa', message: `Apakah Anda yakin ingin menghapus data siswa "${student.name}" secara permanen?`,
            onConfirm: () => deleteStudent(student.id), confirmVariant: 'destructive', confirmText: 'Ya, Hapus Siswa'
        });
    };

    const handleOpenClassModal = (mode: 'add' | 'edit', classData: ClassRow | null = null) => {
        setClassModalMode(mode); setCurrentClass(classData); setClassNameInput(classData?.name || ''); setIsClassModalOpen(true);
    };
    
    const handleClassFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!user || !classNameInput) return;
        if (classModalMode === 'add') {
            addClass({ name: classNameInput, user_id: user.id });
        } else if (currentClass) {
            updateClass({ id: currentClass.id, name: classNameInput });
        }
    };

    const handleDeleteClassClick = (classData: ClassRow) => {
        const studentCount = students.filter(s => s.class_id === classData.id).length;
        if (studentCount > 0) {
            toast.error(`Tidak dapat menghapus kelas "${classData.name}" karena masih ada ${studentCount} siswa di dalamnya.`); return;
        }
        setConfirmModalState({
            isOpen: true, title: 'Hapus Kelas', message: `Apakah Anda yakin ingin menghapus kelas "${classData.name}"?`,
            onConfirm: () => deleteClass(classData.id), confirmVariant: 'destructive', confirmText: 'Ya, Hapus Kelas'
        });
    };
    
    const handleGenerateCodesClick = (classData: ClassRow) => {
        setConfirmModalState({
            isOpen: true, title: 'Buat Kode Akses Massal', message: `Ini akan membuat kode akses untuk semua siswa di kelas "${classData.name}" yang belum memilikinya. Lanjutkan?`,
            onConfirm: () => generateBulkCodes(classData.id), confirmVariant: 'default', confirmText: 'Ya, Buat Kode'
        });
    };

    if (isLoading) return <StudentsPageSkeleton />;

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 flex flex-col space-y-6 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Manajemen Siswa</h1>
                <p className="mt-1 text-gray-600 dark:text-indigo-200">Kelola data siswa dan kelas Anda.</p>
            </header>
            
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative flex-grow w-full md:w-auto">
                        <SearchIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
                        <Input type="text" placeholder="Cari siswa di kelas ini..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full" />
                    </div>
                    <div className="flex w-full md:w-auto items-center gap-2">
                        <Button onClick={() => handleOpenStudentModal('add')} className="flex-grow md:flex-grow-0"><PlusIcon className="w-4 h-4 mr-2" />Siswa</Button>
                        <div className="p-1 rounded-lg bg-gray-100 dark:bg-black/20 flex items-center">
                            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'shadow-md' : 'text-gray-500 dark:text-gray-400'}><LayoutGridIcon className="h-5 w-5"/></Button>
                            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'shadow-md' : 'text-gray-500 dark:text-gray-400'}><ListIcon className="h-5 w-5"/></Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Filter:</span>
                    <button onClick={() => setGenderFilter('all')} className={`px-3 py-1 rounded-full transition-colors ${genderFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Semua ({studentStats.total})</button>
                    <button onClick={() => setGenderFilter('Laki-laki')} className={`px-3 py-1 rounded-full transition-colors ${genderFilter === 'Laki-laki' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Laki-laki ({studentStats.male})</button>
                    <button onClick={() => setGenderFilter('Perempuan')} className={`px-3 py-1 rounded-full transition-colors ${genderFilter === 'Perempuan' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Perempuan ({studentStats.female})</button>

                    <span className="text-gray-600 dark:text-gray-400 ml-4">Urutkan:</span>
                    <button onClick={() => setSortBy('name')} className={`px-3 py-1 rounded-full transition-colors ${sortBy === 'name' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Nama</button>
                    <button onClick={() => setSortBy('gender')} className={`px-3 py-1 rounded-full transition-colors ${sortBy === 'gender' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Gender</button>

                    {(searchTerm || genderFilter !== 'all' || sortBy !== 'name') && (
                        <button onClick={() => { setSearchTerm(''); setGenderFilter('all'); setSortBy('name'); }} className="ml-2 text-xs text-red-500 hover:text-red-600 underline">Reset Filter</button>
                    )}
                </div>
            </div>

            <main className="flex-grow">
                 <Tabs value={activeClassId} onValueChange={setActiveClassId} className="w-full">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <TabsList>
                            {classes.map(c => (
                                <TabsTrigger key={c.id} value={c.id}>
                                    <span>{c.name}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Button size="sm" variant="outline" onClick={() => setIsClassManageModalOpen(true)} className="rounded-full"><PencilIcon className="w-4 h-4 mr-2" /> Kelola Kelas</Button>
                    </div>

                    {classes.map(c => (
                        <TabsContent key={c.id} value={c.id}>
                            {studentsForActiveClass.length === 0 ? (
                                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                                    <UsersIcon className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500"/>
                                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Tidak Ada Siswa</h3>
                                    <p>Belum ada siswa di kelas ini atau tidak ada yang cocok dengan filter Anda.</p>
                                </div>
                            ) : (
                                <div className={viewMode === 'grid' 
                                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                                    : "space-y-4"}>
                                    {studentsForActiveClass.map(student => (
                                        viewMode === 'grid' ? (
                                            <Card key={student.id} className="text-center p-4 group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/20 flex flex-col">
                                                <Link to={`/siswa/${student.id}`} className="block flex-grow">
                                                    <img src={student.avatar_url} alt={student.name} className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-gray-200 dark:border-gray-700 group-hover:border-purple-400 transition-colors"/>
                                                    <h4 className="mt-4 font-bold text-lg text-gray-800 dark:text-gray-200">{student.name}</h4>
                                                </Link>
                                                <div className="mt-4 flex justify-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenStudentModal('edit', student)}><PencilIcon className="w-4 h-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteStudentClick(student)}><TrashIcon className="w-4 h-4"/></Button>
                                                </div>
                                            </Card>
                                        ) : (
                                            <Card key={student.id} className="p-4 flex items-center justify-between transition-all duration-300 hover:bg-gray-50 dark:hover:bg-white/5">
                                                <Link to={`/siswa/${student.id}`} className="flex items-center gap-4 flex-grow">
                                                    <img src={student.avatar_url} alt={student.name} className="w-12 h-12 rounded-full object-cover"/>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800 dark:text-gray-200">{student.name}</h4>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{student.gender}</p>
                                                    </div>
                                                </Link>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenStudentModal('edit', student)}><PencilIcon className="w-4 h-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteStudentClick(student)}><TrashIcon className="w-4 h-4"/></Button>
                                                </div>
                                            </Card>
                                        )
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    ))}
                 </Tabs>
            </main>
            
            {/* Student Modal */}
            <Modal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} title={studentModalMode === 'add' ? 'Tambah Siswa Baru' : 'Edit Siswa'}>
                <form onSubmit={handleStudentFormSubmit} className="space-y-4">
                    <div><label htmlFor="student-name">Nama Lengkap</label><Input id="student-name" name="name" defaultValue={currentStudent?.name || ''} required/></div>
                    <div><label htmlFor="student-class">Kelas</label><Select id="student-class" name="class_id" defaultValue={currentStudent?.class_id || activeClassId} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                    <div><label>Jenis Kelamin</label><div className="flex gap-4 mt-2"><label className="flex items-center"><input type="radio" name="gender" value="Laki-laki" defaultChecked={currentStudent?.gender !== 'Perempuan'} className="form-radio"/><span className="ml-2">Laki-laki</span></label><label className="flex items-center"><input type="radio" name="gender" value="Perempuan" defaultChecked={currentStudent?.gender === 'Perempuan'} className="form-radio"/><span className="ml-2">Perempuan</span></label></div></div>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingStudent || isUpdatingStudent}>{isAddingStudent || isUpdatingStudent ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>
            
            {/* Class Management Modals */}
             <Modal isOpen={isClassManageModalOpen} onClose={() => setIsClassManageModalOpen(false)} title="Kelola Kelas">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {classes.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-black/20">
                            <span className="font-semibold">{c.name}</span>
                            <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setIsClassManageModalOpen(false); handleGenerateCodesClick(c); }} title="Buat kode akses massal"><KeyRoundIcon className="h-4 w-4 text-green-500" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setIsClassManageModalOpen(false); handleOpenClassModal('edit', c); }}><PencilIcon className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDeleteClassClick(c)}><TrashIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                    <Button onClick={() => { setIsClassManageModalOpen(false); handleOpenClassModal('add'); }} className="w-full"><PlusIcon className="w-4 h-4 mr-2" /> Tambah Kelas Baru</Button>
                </div>
             </Modal>
            <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={classModalMode === 'add' ? 'Tambah Kelas Baru' : 'Edit Kelas'}>
                <form onSubmit={handleClassFormSubmit} className="space-y-4">
                    <div><label htmlFor="class-name">Nama Kelas</label><Input id="class-name" value={classNameInput} onChange={e => setClassNameInput(e.target.value)} required placeholder="cth. 7A"/></div>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsClassModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingClass || isUpdatingClass}>{isAddingClass || isUpdatingClass ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>
            
            <ConfirmActionModal 
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModalState.onConfirm}
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText={confirmModalState.confirmText}
                confirmVariant={confirmModalState.confirmVariant}
                isLoading={isDeletingStudent || isDeletingClass || isGeneratingBulkCodes}
            />
        </div>
    );
};

export default StudentsPage;