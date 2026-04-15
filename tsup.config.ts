import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/setup.ts',
    'src/http-wrapper.ts'
  ],
  format: ['cjs'], // 👈 CAMBIO CLAVE
  target: 'node20',
  clean: true
});
