const WEBHOOK_URL = import.meta.env.VITE_N8N_OPEN_JOBS_WEBHOOK_URL as string | undefined;

export const hasOpenJobsCredentials = Boolean(WEBHOOK_URL);

interface JobAdderOwner {
  firstName: string;
  lastName: string;
}

interface JobAdderJob {
  owner: JobAdderOwner;
}

interface JobAdderResponse {
  items: JobAdderJob[];
}

export async function fetchOpenJobsByRecruiter(): Promise<Record<string, number>> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_OPEN_JOBS_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { method: 'POST', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Open jobs webhook HTTP ${res.status}`);
  const { items } = (await res.json()) as JobAdderResponse;

  const EXCLUDED_OWNERS = new Set(['Nihanga Liyanage']);

  const counts: Record<string, number> = {};
  for (const job of items ?? []) {
    const name = `${job.owner.firstName} ${job.owner.lastName}`.trim();
    if (EXCLUDED_OWNERS.has(name)) continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}
