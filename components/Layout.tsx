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

const mobileNavItems = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/absensi', label: 'Absensi', icon: ClipboardIcon },
  { href: '/siswa', label: 'Siswa', icon: UsersIcon },
  { href: '/jadwal', label: 'Jadwal', icon: CalendarIcon },
  { href: '/tugas', label: 'Tugas', icon: CheckSquareIcon },
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { pendingCount, isSyncing } = useSyncQueue();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
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

    useEffect(() => {
        const ensureNavbarVisible = () => {
            const navbar = document.querySelector('nav[class*="bottom-0"]');
            if (navbar && window.innerWidth < 1024) {
                const style = 'position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 30 !important; display: flex !important; visibility: visible !important; opacity: 1 !important; transform: translateY(0) !important;';
                (navbar as HTMLElement).style.cssText = style;
            }
        };

        ensureNavbarVisible();

        const timer = setInterval(ensureNavbarVisible, 1000);

        window.addEventListener('resize', ensureNavbarVisible);
        window.addEventListener('orientationchange', ensureNavbarVisible);

        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', ensureNavbarVisible);
            window.removeEventListener('orientationchange', ensureNavbarVisible);
        };
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

            {/* Mobile sidebar overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
            )}

            {/* Desktop sidebar - hidden on mobile */}
            <div className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar onLinkClick={() => setIsMobileSidebarOpen(false)} />
            </div>

            <div className="flex flex-col flex-1 w-full overflow-hidden">
                {/* Mobile header with menu button */}
                <header className="h-14 lg:h-16 bg-white/80 dark:bg-gray-950/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20">
                    {/* Mobile menu button */}
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Search button - hidden on small mobile, shown on desktop */}
                    <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="hidden sm:flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <SearchIcon className="w-4 h-4" />
                        <span className="hidden md:inline">Cari Siswa...</span>
                    </Button>

                    {/* Mobile search icon */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <SearchIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <ThemeToggle />

                        {/* Sync Status - simplified on mobile */}
                        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : (pendingCount > 0 ? 'bg-yellow-500' : 'bg-green-500')}`}></div>
                            <span className="hidden md:inline">{pendingCount > 0 ? pendingCount : ''}</span>
                        </div>

                        {/* AI Chat Button */}
                        <Button variant="ghost" size="icon" onClick={() => setIsAiChatOpen(prev => !prev)} className="p-2">
                            <BrainCircuitIcon className="h-5 w-5 text-purple-500" />
                        </Button>

                        {/* Profile - simplified on mobile */}
                        <Link to="/pengaturan">
                            <img
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-offset-1 ring-sky-500 dark:ring-purple-500"
                                src={user?.avatarUrl}
                                alt="User avatar"
                            />
                        </Link>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
                    {children}
                </main>

                {/* Bottom Navigation for Mobile */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-800/50">
                    <div className="flex items-center justify-around h-16 px-2">
                        {mobileNavItems.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                end={item.href === '/dashboard'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                                        isActive
                                            ? 'text-sky-600 dark:text-purple-400'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                                        <span className="text-xs font-medium">{item.label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </nav>
            </div>

            <GlobalSearch isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
            <AiChatAssistant isOpen={isAiChatOpen} setIsOpen={setIsAiChatOpen} />
        </div>
    );
};

export default Layout;