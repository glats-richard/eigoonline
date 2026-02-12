export const prerender = false;

import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function unauthorized() {
    return new Response('Unauthorized', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
}

function badRequest(message: string) {
    return new Response(message, {
        status: 400,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
}

function serverError(message: string) {
    return new Response(message, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
}

function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

/**
 * GET endpoint for N8N to fetch pending campaign changes
 * N8N will call this periodically to check for campaigns that need review
 */
export const GET: APIRoute = async ({ request }) => {
    // Verify webhook secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
        return unauthorized();
    }

    try {
        // Run the fetch-campaigns script
        const { stdout, stderr } = await execAsync('npm run fetch:campaigns', {
            cwd: process.cwd(),
            env: process.env,
        });

        if (stderr) {
            console.error('fetch-campaigns stderr:', stderr);
        }

        // Parse the JSON output from the script
        let result;
        try {
            result = JSON.parse(stdout);
        } catch (e) {
            return serverError(`Failed to parse script output: ${stdout}`);
        }

        return jsonResponse(result);
    } catch (error: any) {
        console.error('Error fetching pending campaigns:', error);
        return serverError(error.message ?? String(error));
    }
};
