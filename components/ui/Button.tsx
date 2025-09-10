import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', children, onClick, ...props }, ref) => {
    const baseClasses = "relative overflow-hidden inline-flex items-center justify-center rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-950 focus:ring-sky-500 disabled:opacity-50 disabled:pointer-events-none transform-gpu active:scale-95";

    const variantClasses = {
      default: 'bg-gradient-to-r from-sky-500 via-sky-600 to-sky-500 text-white bg-[length:200%_auto] transition-all duration-500 ease-out hover:bg-[position:100%_0] hover:shadow-lg hover:shadow-sky-500/40 dark:from-purple-600 dark:via-blue-500 dark:to-purple-600 dark:hover:shadow-purple-500/40 hover:-translate-y-1',
      destructive: 'bg-red-500 text-white hover:bg-red-600 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/40 hover:-translate-y-0.5',
      outline: 'ripple-dark bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:-translate-y-0.5',
      ghost: 'ripple-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105',
    };

    const sizeClasses = {
      default: 'h-10 py-2 px-4',
      sm: 'h-9 px-3 rounded-md',
      lg: 'h-11 px-8 rounded-md',
      icon: 'h-10 w-10',
    };

    const handleRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        onClick(event);
      }

      const button = event.currentTarget;
      // Hapus ripple yang ada
      const existingRipple = button.getElementsByClassName("ripple")[0];
      if (existingRipple) {
        existingRipple.remove();
      }

      const circle = document.createElement("span");
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const radius = diameter / 2;
      
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
      circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
      circle.classList.add("ripple");
      
      button.appendChild(circle);

      // Hapus ripple setelah animasi selesai
      setTimeout(() => {
        if(circle.parentElement) {
          circle.remove();
        }
      }, 600);
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        onClick={handleRipple}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';