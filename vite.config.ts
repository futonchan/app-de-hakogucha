import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const repositoryName = 'app-de-hakogucha';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? `/${repositoryName}/` : '/',
  plugins: [basicSsl()],
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  }
});
