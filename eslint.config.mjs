import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'node_modules/**', 'src/features/retro-office/**', 'src/lib/avatars/**', 'src/lib/office/places.ts', 'vendor/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'])]);
