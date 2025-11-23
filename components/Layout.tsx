import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HomeIcon, UsersIcon, CalendarIcon, ClipboardIcon, LogoutIcon, SettingsIcon, GraduationCapIcon, SearchIcon, CheckSquareIcon, BrainCircuitIcon, ClipboardPenIcon } from './Icons';
import ThemeToggle from './ui/ThemeToggle';
import GlobalSearch from './ui/GlobalSearch';
import { Button } from './ui/Button';
import AiChatAssistant from './AiChatAssistant';
import { useSyncQueue } from '../hooks/useSyncQueue';
import GreetingRobot from './GreetingRobot';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/absensi', label: 'Absensi', icon: ClipboardIcon },
  { href: '/siswa', label: 'Siswa', icon: UsersIcon },
  { href: '/jadwal', label: 'Jadwal', icon: CalendarIcon },
  { href: '/tugas', label: 'Tugas', icon: CheckSquareIcon },
  { href: '/input-massal', label: 'Input Massal', icon: ClipboardPenIcon },
  { href: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon },
];

interface SidebarProps {
  onLinkClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLinkClick }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        if (onLinkClick) {
            onLinkClick();
        }
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <aside className="relative w-64 flex-shrink-0 bg-gradient-to-b from-sky-700 via-sky-800 to-slate-900 dark:from-indigo-700 dark:via-purple-800 dark:to-slate-900 text-white">
            <div className="sidebar-bg absolute inset-0"></div>
            <div className="relative z-10 flex flex-col p-4 h-full">
                <div className="flex items-center gap-3 px-2 mb-8">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <GraduationCapIcon className="w-6 h-6 text-sky-300 dark:text-purple-300" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-wider text-white">Guru Cerdas</h1>
                        <p className="text-xs text-sky-200 dark:text-purple-300 -mt-1">Asisten Digital Anda</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-8 p-3 rounded-xl bg-black/20 border border-white/10">
                    <img
                        className="h-11 w-11 rounded-full object-cover border-2 border-sky-400 dark:border-purple-400"
                        src={user?.avatarUrl}
                        alt="User avatar"
                    />
                    <div>
                        <p className="font-semibold text-base text-white">{user?.name}</p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            end={item.href === '/dashboard'}
                            onClick={onLinkClick}
                            className={({ isActive }) =>
                              `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300 transform hover:bg-white/10 hover:translate-x-1 text-gray-300 hover:text-white group ${
                                isActive ? 'bg-gradient-to-r from-sky-500 to-blue-500 dark:from-purple-600 dark:to-blue-500 shadow-lg shadow-blue-500/40 dark:shadow-purple-500/30 text-white font-semibold' : ''
                              }`
                            }
                        >
                            <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                <div className="mt-auto pt-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full gap-4 px-4 py-3 text-gray-300 rounded-lg hover:bg-red-500/80 hover:text-white transition-all duration-300"
                    >
                        <LogoutIcon className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};


const Header: React.FC<{ onSearchClick: () => void; }> = ({ onSearchClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const { pendingCount, isSyncing } = useSyncQueue();

    const handleLogout = async () => {
        setProfileMenuOpen(false);
        await logout();
        navigate('/', { replace: true });
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [profileMenuRef]);

    return (
        <header className="h-16 bg-white/80 dark:bg-gray-950/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
             <div className="flex items-center gap-3">
                {/* Desktop search button */}
                <Button variant="outline" onClick={onSearchClick} className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <SearchIcon className="w-4 h-4" />
                    Cari Siswa...
                </Button>
            </div>
            
            <div className="flex items-center gap-3">
                <ThemeToggle />

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                 {/* Sync Status */}
                <div title={isSyncing ? `Menyinkronkan ${pendingCount} data...` : (pendingCount > 0 ? `${pendingCount} data menunggu sinkronisasi` : 'Semua data tersinkronisasi')}
                     className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : (pendingCount > 0 ? 'bg-yellow-500' : 'bg-green-500')}`}></div>
                    <span className="hidden sm:inline">{pendingCount > 0 ? pendingCount : ''}</span>
                </div>

                {/* AI Chat Assistant Button */}
                <Button variant="ghost" size="icon" onClick={() => (window as any).toggleAiChat()} aria-label="Buka Asisten AI">
                    <BrainCircuitIcon className="h-5 w-5 text-purple-500" />
                </Button>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileMenuRef}>
                    <button onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}>
                        <img
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-offset-2 ring-offset-gray-100 dark:ring-offset-gray-900 ring-sky-500 dark:ring-purple-500"
                            src={user?.avatarUrl}
                            alt="User avatar"
                        />
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-30 animate-fade-in">
                            <Link to="/pengaturan" onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                Pengaturan
                            </Link>
                            <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [showGreeting, setShowGreeting] = useState(() => {
        if (typeof sessionStorage !== 'undefined') {
            return !sessionStorage.getItem('greeted');
        }
        return false;
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Expose AI chat toggle to window for header button
    useEffect(() => {
        (window as any).toggleAiChat = () => setIsAiChatOpen(prev => !prev);
        return () => { delete (window as any).toggleAiChat; };
    }, []);

    const handleGreetingEnd = () => {
        setShowGreeting(false);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('greeted', 'true');
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
            {showGreeting && user && (
                <GreetingRobot userName={user.name} onAnimationEnd={handleGreetingEnd} />
            )}

            {/* Desktop sidebar */}
            <div className="flex">
                <Sidebar />
            </div>

            <div className="flex flex-col flex-1 w-full overflow-hidden">
                <Header onSearchClick={() => setIsSearchOpen(true)} />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>

            <GlobalSearch isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
            <AiChatAssistant isOpen={isAiChatOpen} setIsOpen={setIsAiChatOpen} />
        </div>
    );
};

export default Layout;