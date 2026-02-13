#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

/**
 * Fetch and detect campaign changes from school JSON files
 * This script:
 * 1. Reads all school JSON files
 * 2. Checks for expired or soon-to-expire campaigns
 * 3. Logs changes to the database
 * 4. Returns pending changes for N8N to process
 */

const SCHOOLS_DIR = join(process.cwd(), 'src/content/schools');

async function main() {
  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const changes = [];

    // Read all school JSON files
    const files = await readdir(SCHOOLS_DIR);
    const schoolFiles = files.filter(f => f.endsWith('.json'));

    for (const file of schoolFiles) {
      const schoolId = file.replace('.json', '');
      const filePath = join(SCHOOLS_DIR, file);
      const content = await readFile(filePath, 'utf-8');
      const schoolData = JSON.parse(content);

      // Check if campaign exists and is expired or expiring soon
      if (schoolData.campaignEndsAt) {
        const endDate = new Date(schoolData.campaignEndsAt);
        const now = new Date();
        const daysUntilEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        // Detect campaigns that have already expired
        if (daysUntilEnd < 0) {
          const change = {
            schoolId,
            schoolName: schoolData.name,
            currentCampaign: {
              campaignText: schoolData.campaignText,
              campaignEndsAt: schoolData.campaignEndsAt,
              benefitText: schoolData.benefitText,
              campaignBullets: schoolData.campaignBullets || [],
            },
            status: 'expired',
            daysUntilEnd,
            officialUrl: schoolData.officialUrl,
          };

          changes.push(change);

          // Log to database
          await pool.query(
            `INSERT INTO campaign_logs 
             (school_id, action, old_campaign_data, source_url, notes) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              schoolId,
              'detected',
              change.currentCampaign,
              schoolData.officialUrl,
              `Campaign expired ${Math.abs(daysUntilEnd)} days ago`,
            ]
          );
        }
      } else {
        // No campaign information present
        const change = {
          schoolId,
          schoolName: schoolData.name,
          currentCampaign: null,
          status: 'missing_info',
          daysUntilEnd: null,
          officialUrl: schoolData.officialUrl,
        };

        changes.push(change);

        // Log to database
        await pool.query(
          `INSERT INTO campaign_logs 
           (school_id, action, old_campaign_data, source_url, notes) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            schoolId,
            'detected',
            null,
            schoolData.officialUrl,
            'No campaign information found',
          ]
        );
      }
    }

    // Output results as JSON for N8N to consume
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalSchools: schoolFiles.length,
      changesDetected: changes.length,
      changes,
    }, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
