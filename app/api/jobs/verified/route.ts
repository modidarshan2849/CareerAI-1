import { NextResponse } from 'next/server';
import {
  GENERATED_228_JOBS,
  evaluateJobAgainstMasterGate,
  DEFAULT_MASTER_PREFS
} from '../../../../lib/ats/master-jobs-pool';

export async function GET() {
  const verifiedJobs = GENERATED_228_JOBS
    .filter((job: any) => evaluateJobAgainstMasterGate(job, DEFAULT_MASTER_PREFS))
    .map((job: any, index: number) => ({
      ...job,
      rank: index + 1
    }));

  return NextResponse.json(verifiedJobs);
}
