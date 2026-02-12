export const prerender = false;

import type { APIRoute } from 'astro';

/**
 * Debug endpoint to check environment variables
 * REMOVE THIS IN PRODUCTION
 */
export const GET: APIRoute = async () => {
    const hasSecret = !!process.env.WEBHOOK_SECRET;
    const secretLength = process.env.WEBHOOK_SECRET?.length || 0;

    return new Response(JSON.stringify({
        hasWebhookSecret: hasSecret,
        secretLength: secretLength,
        // DO NOT expose the actual secret value
        nodeEnv: process.env.NODE_ENV,
    }, null, 2), {
        headers: { 'content-type': 'application/json' },
    });
};
