import React from "react";
import { GENERATED_228_JOBS } from "../../../lib/ats/master-jobs-pool";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function CorporateApplicationPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = GENERATED_228_JOBS.find(j => j.id === id);

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Requisition Closed</h1>
          <p className="text-slate-600 mb-6">The job you are looking for is no longer active in the ATS.</p>
          <Link href="/dashboard" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Simulated Corporate Header */}
      <header className="bg-slate-900 text-white px-8 py-5 flex justify-between items-center shadow-md">
        <div>
          <div className="font-black text-2xl tracking-tight">{job.company}</div>
          <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">Official Career Portal</div>
        </div>
        <Link href="/dashboard" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
          &larr; Back to Command Center
        </Link>
      </header>

      <main className="max-w-4xl mx-auto mt-12 mb-12 bg-white p-10 rounded-2xl shadow-xl border border-slate-200">
        <div className="border-b border-slate-200 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2">{job.title}</h1>
            <div className="text-slate-500 font-semibold flex items-center gap-4 text-sm">
              <span>📍 {job.location}</span>
              <span>💼 Req ID: {job.req_id}</span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold">{job.work_mode}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-emerald-600">{job.salary_range}</div>
            <div className="text-xs text-slate-400 mt-1">Est. Compensation</div>
          </div>
        </div>

        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-loose mb-10">
          {job.description}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8">
          <h2 className="text-xl font-black text-slate-900 mb-2">Submit Your Application</h2>
          <p className="text-sm text-slate-500 mb-6">Authenticating via CareerAI as <strong>Darshan Modi</strong>.</p>
          
          <div className="flex gap-4">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-black shadow-md transition-all">
              Apply Now with ATS Resume
            </button>
            <button className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-3 rounded-lg font-bold transition-all">
              Save for Later
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
