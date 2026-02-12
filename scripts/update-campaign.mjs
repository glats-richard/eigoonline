#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

/**
 * Update campaign data for a specific school
 * Usage: node scripts/update-campaign.mjs <schoolId> '<campaignDataJSON>'
 * 
 * Example:
 * node scripts/update-campaign.mjs kimini '{"campaignText":"【〜2月28日】初月50%OFF","campaignEndsAt":"2026-02-28","benefitText":"初月50%OFF"}'
 */

const SCHOOLS_DIR = join(process.cwd(), 'src/content/schools');

async function main() {
    const [schoolId, campaignDataStr, approvedBy, slackMessageTs] = process.argv.slice(2);

    if (!schoolId || !campaignDataStr) {
        console.error('Usage: node scripts/update-campaign.mjs <schoolId> \'<campaignDataJSON>\' [approvedBy] [slackMessageTs]');
        console.error('Example: node scripts/update-campaign.mjs kimini \'{"campaignText":"..."}\'');
        process.exit(1);
    }

    let campaignData;
    try {
        campaignData = JSON.parse(campaignDataStr);
    } catch (error) {
        console.error('Invalid JSON for campaign data:', error.message);
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const filePath = join(SCHOOLS_DIR, `${schoolId}.json`);

        // Read current school data
        const content = await readFile(filePath, 'utf-8');
        const schoolData = JSON.parse(content);

        // Store old campaign data for logging
        const oldCampaignData = {
            campaignText: schoolData.campaignText,
            campaignEndsAt: schoolData.campaignEndsAt,
            benefitText: schoolData.benefitText,
            campaignBullets: schoolData.campaignBullets || [],
        };

        // Update campaign fields
        if (campaignData.campaignText !== undefined) {
            schoolData.campaignText = campaignData.campaignText;
        }
        if (campaignData.campaignEndsAt !== undefined) {
            schoolData.campaignEndsAt = campaignData.campaignEndsAt;
        }
        if (campaignData.benefitText !== undefined) {
            schoolData.benefitText = campaignData.benefitText;
        }
        if (campaignData.campaignBullets !== undefined) {
            schoolData.campaignBullets = campaignData.campaignBullets;
        }

        // Write updated data back to file
        await writeFile(filePath, JSON.stringify(schoolData, null, 2) + '\n', 'utf-8');

        // Log to database
        await pool.query(
            `INSERT INTO campaign_logs 
       (school_id, action, old_campaign_data, new_campaign_data, approved_by, approved_at, slack_message_ts, source_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                schoolId,
                approvedBy ? 'approved' : 'updated',
                oldCampaignData,
                campaignData,
                approvedBy || null,
                approvedBy ? new Date() : null,
                slackMessageTs || null,
                schoolData.officialUrl,
            ]
        );

        console.log(JSON.stringify({
            success: true,
            schoolId,
            schoolName: schoolData.name,
            oldCampaign: oldCampaignData,
            newCampaign: campaignData,
            updatedAt: new Date().toISOString(),
        }, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error updating campaign:', error);
        console.log(JSON.stringify({
            success: false,
            error: error.message,
            schoolId,
        }, null, 2));
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
