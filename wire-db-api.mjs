import fs from "fs";

const isSrc = fs.existsSync("./src/app");
const apiPath = isSrc ? "./src/app/api/jobs/verified/route.ts" : "./app/api/jobs/verified/route.ts";

const dbRouteCode = `import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GENERATED_228_JOBS, evaluateJobAgainstMasterGate, DEFAULT_MASTER_PREFS } from '../../../../lib/ats/master-jobs-pool';

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('verified_jobs')
      .select('*')
      .eq('is_active', true)
      .gte('score', 80)
      .order('score', { ascending: false })
      .order('first_seen_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const now = Date.now();
      const enriched = data.map((job, idx) => {
        const seenMs = job.first_seen_at ? Date.parse(job.first_seen_at) : now;
        const hoursOld = Math.max(1, Math.round((now - seenMs) / 3600000));
        return {
          ...job,
          rank: idx + 1,
          hours_old: hoursOld,
          is_under_24h: hoursOld <= 24,
          is_under_48h: hoursOld <= 48,
          is_expiring_soon: Boolean(job.last_date && /closes in [0-7]d|closing soon/i.test(job.last_date))
        };
      });
      return NextResponse.json(enriched);
    }
  }

  // Fallback to local verified pool
  const fallback = GENERATED_228_JOBS
    .filter((j: any) => evaluateJobAgainstMasterGate(j, DEFAULT_MASTER_PREFS))
    .map((j: any, idx: number) => ({ ...j, rank: idx + 1 }));

  return NextResponse.json(fallback);
}
`;

fs.mkdirSync(apiPath.replace("/route.ts", ""), { recursive: true });
fs.writeFileSync(apiPath, dbRouteCode, "utf8");
console.log(`✅ Wired ${apiPath} to central Supabase Postgres DB.`);
