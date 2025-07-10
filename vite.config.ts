import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        proxy: {
          '/api/replicate': {
            target: 'https://api.replicate.com/v1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
            headers: {
              // IMPORTANT: keep the secret token on the server – never expose it in client bundles
              'Authorization': `Bearer ${env.REPLICATE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        }
      }
    };
});
