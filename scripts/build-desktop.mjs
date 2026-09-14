import { build } from 'esbuild';
await build({ entryPoints: { server: 'server.ts', companion: 'companion/server.ts' }, outdir: 'desktop-build', outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22', sourcemap: false });
