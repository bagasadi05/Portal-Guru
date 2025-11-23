
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { SunIcon, MoonIcon } from '../Icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95"
    >
      {theme === 'light' ? (
        <SunIcon className="w-5 h-5 text-amber-500" />
      ) : (
        <MoonIcon className="w-5 h-5 text-indigo-400" />
      )}
    </Button>
  );
};

export default ThemeToggle;
