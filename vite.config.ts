import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
