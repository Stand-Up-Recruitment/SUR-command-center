/** Company name normalised for matching across Airtable, Xero and JobAdder ("Keystone Urban Pty Ltd" = "keystone urban"). */
export const companyKey = (name: string | undefined, fallback: string) =>
  (name ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(pty|ltd|limited|proprietary)\b/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
