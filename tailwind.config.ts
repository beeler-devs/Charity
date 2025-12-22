import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Team color classes - ensure they're always included
    'bg-blue-50', 'bg-blue-500', 'border-l-blue-500', 'text-blue-500',
    'bg-green-50', 'bg-green-500', 'border-l-green-500', 'text-green-500',
    'bg-purple-50', 'bg-purple-500', 'border-l-purple-500', 'text-purple-500',
    'bg-orange-50', 'bg-orange-500', 'border-l-orange-500', 'text-orange-500',
    'bg-pink-50', 'bg-pink-500', 'border-l-pink-500', 'text-pink-500',
    'bg-teal-50', 'bg-teal-500', 'border-l-teal-500', 'text-teal-500',
    'bg-red-50', 'bg-red-500', 'border-l-red-500', 'text-red-500',
    'bg-yellow-50', 'bg-yellow-500', 'border-l-yellow-500', 'text-yellow-500',
    'bg-indigo-50', 'bg-indigo-500', 'border-l-indigo-500', 'text-indigo-500',
    'bg-cyan-50', 'bg-cyan-500', 'border-l-cyan-500', 'text-cyan-500',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        tennis: {
          green: '#4CAF50',
          yellow: '#FFC107',
          court: '#2E7D32',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
