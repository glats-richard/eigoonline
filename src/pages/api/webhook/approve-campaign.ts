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
 * POST endpoint to approve and update campaign data
 * Called by N8N after Slack approval
 * 
 * Expected payload (flat format from N8N):
 * {
 *   "schoolId": "berlitz",
 *   "schoolName": "Berlitz",
 *   "status": "active",
 *   "campaignText": "入学金無料キャンペーン",
 *   "benefit": "入学金33,000円が0円",
 *   "deadline": "2026-04-30",
 *   "officialUrl": "https://www.berlitz.com/ja-jp",
 *   "campaignBullets": ["条件1", "条件2"],
 *   "approvedBy": "user_slack_id",
 *   "slackMessageTs": "1234567890.123456"
 * }
 */
export const POST: APIRoute = async ({ request }) => {
    // Verify webhook secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
        return unauthorized();
    }

    let payload: any;
    try {
        payload = await request.json();
    } catch (e) {
        return badRequest('Invalid JSON body');
    }

    // Support both flat format (from N8N) and nested format
    const schoolId = payload.schoolId;

    if (!schoolId || typeof schoolId !== 'string') {
        return badRequest('schoolId is required and must be a string');
    }

    // Build campaignData from flat or nested format
    let campaignData: any;
    if (payload.campaignData) {
        // Nested format (legacy)
        campaignData = payload.campaignData;
    } else {
        // Flat format (from N8N)
        campaignData = {
            campaignText: payload.campaignText || null,
            campaignEndsAt: payload.deadline || null,
            benefitText: payload.benefit || null,
            campaignBullets: payload.campaignBullets || [],
        };
    }

    if (!campaignData.campaignText) {
        return badRequest('campaignText is required');
    }

    const approvedBy = payload.approvedBy || null;
    const slackMessageTs = payload.slackMessageTs || null;

    try {
        // Build command arguments
        const campaignDataJson = JSON.stringify(campaignData);
        const args = [
            'run',
            'update:campaign',
            '--',
            schoolId,
            campaignDataJson,
        ];

        if (approvedBy) {
            args.push(approvedBy);
        }

        if (slackMessageTs) {
            args.push(slackMessageTs);
        }

        // Run the update-campaign script
        const { stdout, stderr } = await execAsync(`npm ${args.map(a => JSON.stringify(a)).join(' ')}`, {
            cwd: process.cwd(),
            env: process.env,
        });

        if (stderr) {
            console.error('update-campaign stderr:', stderr);
        }

        // Parse the JSON output from the script
        // npm prefixes stdout with log lines like "> script-name", so extract only the JSON object
        let result;
        try {
            const jsonStart = stdout.indexOf('{');
            const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
            result = JSON.parse(jsonStr);
        } catch (e) {
            return serverError(`Failed to parse script output: ${stdout}`);
        }

        if (result.success) {
            return jsonResponse(result);
        } else {
            return jsonResponse(result, 500);
        }
    } catch (error: any) {
        console.error('Error approving campaign:', error);
        return serverError(error.message ?? String(error));
    }
};
