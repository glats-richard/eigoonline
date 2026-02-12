export const prerender = false;

import { dbEnvError, query } from "../../../lib/db";

export const GET = async () => {
    if (dbEnvError) {
        return new Response(JSON.stringify({ error: dbEnvError }), { status: 500 });
    }

    try {
        // 1. Fetch current override for kimini
        const res = await query("SELECT data FROM school_overrides WHERE school_id = 'kimini'");
        if (!res.rows.length) {
            return new Response(JSON.stringify({ message: 'No override data for kimini' }), { status: 404 });
        }

        const currentData = res.rows[0].data;
        const currentDataStr = JSON.stringify(currentData);

        // 2. Check for outdated URL
        if (!currentDataStr.includes('br.glats.online')) {
            return new Response(JSON.stringify({
                message: 'No outdated URL found in kimini override',
                currentData
            }), { status: 200 });
        }

        // 3. Replace URL
        const newDataStr = currentDataStr.replace(/br\.glats\.online/g, 'kimini.online');
        const newData = JSON.parse(newDataStr);

        // 4. Update DB
        await query(
            "UPDATE school_overrides SET data = $1, updated_at = NOW() WHERE school_id = 'kimini'",
            [newData]
        );

        return new Response(JSON.stringify({
            success: true,
            message: 'Updated kimini override data',
            oldData: currentData,
            newData
        }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
