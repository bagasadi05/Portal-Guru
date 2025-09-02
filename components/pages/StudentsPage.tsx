
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Use named imports for react-router-dom components
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
    
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
    const [currentStudent, setCurrentStudent] = useState<StudentRow | null>(null);

    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [classModalMode, setClassModalMode] = useState<'add' | 'edit'>('add');
    const [currentClass, setCurrentClass] = useState<ClassRow | null>(null);
    const [classNameInput, setClassNameInput] = useState('');

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
            // FIX: Ensure the payload for upsert includes all required fields to satisfy the `Insert` type, even for an update operation.
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
        const filtered = students.filter(student => student.class_id === activeClassId);
        if (!searchTerm) return filtered.sort((a,b) => a.name.localeCompare(b.name, 'id-ID'));
        return filtered.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name, 'id-ID'));
    }, [searchTerm, students, activeClassId]);

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
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 flex flex-col space-y-6">
            <header>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Manajemen Siswa</h1>
                <p className="mt-1 text-gray-600 dark:text-indigo-200">Kelola data siswa dan kelas Anda.</p>
            </header>
            
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

            <main className="flex-grow">
                 <Tabs value={activeClassId} onValueChange={setActiveClassId} className="w-full">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <TabsList>
                            {classes.map(c => (
                                <TabsTrigger key={c.id} value={c.id}>
                                    <div className="group relative flex items-center gap-2">
                                        <span>{c.name}</span>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => {e.stopPropagation(); handleOpenClassModal('edit', c)}}><PencilIcon className="h-3 w-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-5 w-5 text-red-500" onClick={(e) => {e.stopPropagation(); handleDeleteClassClick(c)}}><TrashIcon className="h-3 w-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-5 w-5 text-green-500" onClick={(e) => {e.stopPropagation(); handleGenerateCodesClick(c)}} title="Buat kode akses massal"><KeyRoundIcon className="h-3 w-3" /></Button>
                                        </div>
                                    </div>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Button size="sm" variant="outline" onClick={() => handleOpenClassModal('add')} className="rounded-full"><PlusIcon className="w-4 h-4 mr-1" /> Tambah Kelas</Button>
                    </div>

                    {classes.map(c => (
                        <TabsContent key={c.id} value={c.id}>
                            {studentsForActiveClass.length === 0 ? (
                                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                                    <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold">Tidak Ada Siswa</h3>
                                    <p>{searchTerm ? "Tidak ada siswa yang cocok dengan pencarian Anda." : "Anda bisa menambahkan siswa ke kelas ini."}</p>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {studentsForActiveClass.map(student => (
                                        <Card key={student.id} className="group relative p-6 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-sky-500/50 dark:hover:border-purple-500/50">
                                            <div className="flex flex-col items-center text-center">
                                                {/* FIX: Use Link component directly */}
                                                <Link to={`/siswa/${student.id}`} className="block">
                                                    <img src={student.avatar_url} alt={student.name} className="w-28 h-28 rounded-full mb-4 object-cover border-4 border-gray-200 dark:border-white/10 group-hover:border-purple-400 transition-colors mx-auto" />
                                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-purple-300">{student.name}</h3>
                                                </Link>
                                            </div>
                                            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenStudentModal('edit', student)}><PencilIcon className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteStudentClick(student)}><TrashIcon className="h-4 w-4" /></Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card className="overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                                            <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-50 dark:bg-white/5">
                                                <tr><th scope="col" className="px-6 py-3">Nama</th><th scope="col" className="px-6 py-3">Jenis Kelamin</th><th scope="col" className="px-6 py-3 text-right">Aksi</th></tr>
                                            </thead>
                                            <tbody>
                                                {studentsForActiveClass.map(student => (
                                                    <tr key={student.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5">
                                                        <th scope="row" className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                            {/* FIX: Use Link component directly */}
                                                            <Link to={`/siswa/${student.id}`} className="flex items-center gap-3 group">
                                                                <img src={student.avatar_url} alt={student.name} className="w-9 h-9 rounded-full object-cover" />
                                                                <span className="group-hover:text-sky-600 dark:group-hover:text-purple-300">{student.name}</span>
                                                            </Link>
                                                        </th>
                                                        <td className="px-6 py-4">{student.gender}</td>
                                                        <td className="px-6 py-4"><div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenStudentModal('edit', student)}><PencilIcon className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteStudentClick(student)}><TrashIcon className="h-4 w-4" /></Button>
                                                        </div></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}
                        </TabsContent>
                    ))}
                 </Tabs>
            </main>
            
            <ConfirmActionModal 
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState(prev => ({...prev, isOpen: false}))}
                onConfirm={confirmModalState.onConfirm}
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText={confirmModalState.confirmText}
                confirmVariant={confirmModalState.confirmVariant}
                isLoading={isDeletingStudent || isDeletingClass || isGeneratingBulkCodes}
            />

            {isStudentModalOpen && (
                <Modal title={studentModalMode === 'add' ? 'Tambah Siswa Baru' : 'Edit Siswa'} isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)}>
                    <form onSubmit={handleStudentFormSubmit} className="space-y-4">
                        <div><label htmlFor="name" className="block text-sm font-medium">Nama Lengkap</label><Input id="name" name="name" defaultValue={currentStudent?.name || ''} required /></div>
                        <div><label htmlFor="gender" className="block text-sm font-medium">Jenis Kelamin</label><div className="flex gap-4 mt-2"><label className="flex items-center"><input type="radio" name="gender" value="Laki-laki" defaultChecked={!currentStudent || currentStudent.gender === 'Laki-laki'} className="form-radio"/><span className="ml-2">Laki-laki</span></label><label className="flex items-center"><input type="radio" name="gender" value="Perempuan" defaultChecked={currentStudent?.gender === 'Perempuan'} className="form-radio"/><span className="ml-2">Perempuan</span></label></div></div>
                        <div><label htmlFor="class_id" className="block text-sm font-medium">Kelas</label><Select id="class_id" name="class_id" defaultValue={currentStudent?.class_id || activeClassId || classes[0]?.id} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                        <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingStudent || isUpdatingStudent}>{isAddingStudent || isUpdatingStudent ? 'Menyimpan...' : 'Simpan'}</Button></div>
                    </form>
                </Modal>
            )}
            {isClassModalOpen && (
                 <Modal title={classModalMode === 'add' ? 'Tambah Kelas Baru' : 'Edit Nama Kelas'} isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)}>
                    <form onSubmit={handleClassFormSubmit} className="space-y-4">
                        <div><label htmlFor="className" className="block text-sm font-medium">Nama Kelas</label><Input id="className" value={classNameInput} onChange={e => setClassNameInput(e.target.value)} placeholder="Contoh: Kelas 7A" required /></div>
                        <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsClassModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingClass || isUpdatingClass}>{isAddingClass || isUpdatingClass ? 'Menyimpan...' : 'Simpan'}</Button></div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default StudentsPage;
