import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const page = (name: string) => fileURLToPath(new URL(`./examples/${name}.html`, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: page('index'),
        greenHill: page('green-hill'),
        physicsSandbox: page('physics-sandbox'),
      },
    },
  },
});
