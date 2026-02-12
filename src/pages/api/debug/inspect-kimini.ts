export const prerender = false;

import { dbEnvError, query } from "../../../lib/db";

export const GET = async () => {
    if (dbEnvError) {
        return new Response(JSON.stringify({ error: dbEnvError }), { status: 500 });
    }

    try {
        const res = await query("SELECT data, updated_at FROM school_overrides WHERE school_id = 'kimini'");
        if (!res.rows.length) {
            return new Response(JSON.stringify({ message: 'No override data for kimini', exists: false }), { status: 200 });
        }

        return new Response(JSON.stringify({
            exists: true,
            updated_at: res.rows[0].updated_at,
            data: res.rows[0].data
        }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
