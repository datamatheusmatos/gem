import { handleApi } from './src/api/router.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx, url);
      } catch (err) {
        console.error('Erro não tratado na API:', err.message);
        return new Response(
          JSON.stringify({ error: 'Não foi possível processar sua solicitação.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // qualquer outra rota: serve o site estático (SPA fallback tratado no ASSETS)
    return env.ASSETS.fetch(request);
  }
};
