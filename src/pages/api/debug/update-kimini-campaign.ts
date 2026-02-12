export const prerender = false;

import { dbEnvError, query } from "../../../lib/db";

export const GET = async () => {
    if (dbEnvError) {
        return new Response(JSON.stringify({ error: dbEnvError }), { status: 500 });
    }

    try {
        // 1. Fetch current data
        const res = await query("SELECT data FROM school_overrides WHERE school_id = 'kimini'");
        if (!res.rows.length) {
            return new Response(JSON.stringify({ message: 'No override data for kimini', exists: false }), { status: 404 });
        }

        const currentData = res.rows[0].data || {};

        // 2. Prepare new campaign data
        const newData = {
            ...currentData,
            officialUrl: "https://kimini.online/", // Ensure this is correct too
            campaignText: "【〜2/16】月額料金が3ヶ月半額キャンペーン　特典：月額料金が3ヶ月間半額（対象プランのみ）、さらに無料体験10日間",
            campaignEndsAt: "2026-02-16",
            campaignBullets: [
                "月額料金が3ヶ月間半額（対象プランのみ）",
                "さらに無料体験10日間付き",
                "キャンペーン期間：2026年2月10日（火）〜 2026年2月16日（月）"
            ]
        };

        // 3. Update DB
        await query(
            "UPDATE school_overrides SET data = $1, updated_at = NOW() WHERE school_id = 'kimini'",
            [newData]
        );

        return new Response(JSON.stringify({
            message: 'Updated kimini campaign',
            oldData: currentData,
            newData: newData
        }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
