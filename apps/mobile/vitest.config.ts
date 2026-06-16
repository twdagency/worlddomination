import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const reactNativeMock = path.resolve(__dirname, 'src/test/reactNativeMock.ts');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': reactNativeMock,
      sim: path.resolve(__dirname, '../../packages/sim/src/index.ts'),
      'sim/*': path.resolve(__dirname, '../../packages/sim/src'),
      shared: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      'shared/*': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  test: {
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'forks',
  },
});
