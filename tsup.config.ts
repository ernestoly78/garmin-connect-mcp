import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/setup.ts',
    'src/http-wrapper.ts'
  ],
  format: ['cjs'],
  target: 'node20',
  clean: true
});
