import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9f4',
          100: '#dbf0e3',
          500: '#2f9e5e',
          600: '#25824a',
          700: '#1e673c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
