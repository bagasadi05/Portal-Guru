import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GraduationCapIcon, UsersIcon } from '../Icons';

const RoleSelectionPage: React.FC = () => {
    const { session, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // If a teacher session exists, redirect directly to the dashboard
        if (!loading && session) {
            navigate('/dashboard', { replace: true });
        }
    }, [session, loading, navigate]);

    // Show a loader while checking auth state to prevent flashing the selection page
    if (loading || session) {
        return (
            <div className="flex items-center justify-center h-screen cosmic-bg">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
             <div className="w-full max-w-4xl text-center">
                <div className="holographic-orb-container mx-auto" style={{ position: 'relative', top: 0, marginBottom: '-40px' }}>
                     <div className="holographic-orb">
                        <div className="orb-glow"></div>
                        <div className="orb-core"></div>
                        <div className="orb-ring orb-ring-1"></div>
                        <div className="orb-ring orb-ring-2"></div>
                    </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 text-shadow-md animate-fade-in">
                    Selamat Datang di Guru Cerdas
                </h1>
                <p className="text-lg text-gray-600 dark:text-indigo-200 mb-8 md:mb-12 max-w-2xl mx-auto animate-fade-in animation-delay-200">
                    Platform digital untuk manajemen kelas yang efisien dan portal informasi siswa.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 animate-fade-in-up animation-delay-400">
                    {/* Teacher Card */}
                    <div className="group">
                        <div className="login-card mx-auto h-full p-6 sm:p-8 transition-all duration-300 group-hover:border-sky-500 dark:group-hover:border-purple-400 dark:group-hover:shadow-purple-500/30">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-sky-100 to-blue-200 dark:from-purple-500/20 dark:to-indigo-500/20 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10 transition-transform group-hover:scale-110">
                                    <GraduationCapIcon className="w-8 h-8 sm:w-10 sm:h-10 text-sky-600 dark:text-purple-300" />
                                </div>
                            </div>
                            <h2 className="form-title mb-2">Saya Seorang Guru</h2>
                            <p className="form-subtitle !mb-6">Akses dasbor untuk mengelola siswa, absensi, jadwal, dan laporan.</p>
                            <Link to="/guru-login" className="form-btn">
                                Masuk Dasbor Guru
                            </Link>
                        </div>
                    </div>

                    {/* Parent/Student Card */}
                     <div className="group">
                         <div className="login-card mx-auto h-full p-6 sm:p-8 transition-all duration-300 group-hover:border-sky-500 dark:group-hover:border-cyan-400 dark:group-hover:shadow-cyan-500/30">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-100 to-sky-200 dark:from-cyan-500/20 dark:to-sky-500/20 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10 transition-transform group-hover:scale-110">
                                    <UsersIcon className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-600 dark:text-cyan-300" />
                                </div>
                            </div>
                            <h2 className="form-title mb-2">Saya Orang Tua/Siswa</h2>
                            <p className="form-subtitle !mb-6">Lihat perkembangan akademik, kehadiran, dan catatan siswa.</p>
                            <Link to="/portal-login" className="form-btn">
                                Masuk Portal Siswa
                            </Link>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
};

export default RoleSelectionPage;
