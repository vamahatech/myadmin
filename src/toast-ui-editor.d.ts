// @toast-ui/editor ships its typings under `types/index.d.ts`, but its package.json
// "exports" map does not expose a "types" condition, so TypeScript (with `bundler`/
// `nodenext` module resolution) cannot resolve them for the dynamic `import('@toast-ui/editor')`
// used in markdown-editor.component.ts. Declare the module so the build doesn't fail with
// TS7016. (Loose ambient declaration — same as the fix TypeScript itself suggests.)
declare module '@toast-ui/editor';
