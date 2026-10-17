/**
 * Render cannot reach Supabase's direct host over IPv6.
 * Session pooler (port 5432) is IPv4 and supports prepared statements.
 */

const DEFAULT_POOLER_HOSTS = [
  "aws-0-ap-southeast-1.pooler.supabase.com",
  "aws-1-ap-southeast-1.pooler.supabase.com",
  "aws-0-ap-northeast-1.pooler.supabase.com",
  "aws-0-ap-southeast-2.pooler.supabase.com",
];

export function describeDbHost(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "(invalid database url)";
  }
}

export function supabaseProjectRef(hostname: string): string | null {
  const match = hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  return match ? match[1] : null;
}

export function isSupabasePoolerHost(hostname: string): boolean {
  return /\.pooler\.supabase\.com$/i.test(hostname);
}

export function withSslRequire(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("uselibpqcompat", "true");
  return parsed.toString();
}

export function toSessionPoolerUrl(rawUrl: string, poolerHost: string): string {
  const parsed = new URL(rawUrl);
  const ref = supabaseProjectRef(parsed.hostname);
  if (ref) {
    const user = decodeURIComponent(parsed.username || "postgres");
    parsed.username = user.includes(".") ? user : `${user}.${ref}`;
    parsed.hostname = poolerHost;
    parsed.port = "5432";
  }
  return withSslRequire(parsed.toString());
}

export function candidateDatabaseUrls(rawUrl: string): string[] {
  const parsed = new URL(rawUrl);
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (value: string) => {
    const next = withSslRequire(value);
    if (seen.has(next)) return;
    seen.add(next);
    urls.push(next);
  };

  const override = process.env.DATABASE_POOLER_URL?.trim();
  if (override) add(override);

  if (isSupabasePoolerHost(parsed.hostname)) {
    add(rawUrl);
    return urls;
  }

  const envHost = process.env.SUPABASE_POOLER_HOST?.trim();
  const region = process.env.SUPABASE_REGION?.trim();
  const hosts = [
    envHost,
    region ? `aws-0-${region}.pooler.supabase.com` : null,
    region ? `aws-1-${region}.pooler.supabase.com` : null,
    ...DEFAULT_POOLER_HOSTS,
  ].filter((host): host is string => Boolean(host));

  if (supabaseProjectRef(parsed.hostname)) {
    for (const host of hosts) add(toSessionPoolerUrl(rawUrl, host));
  }

  add(rawUrl);
  return urls;
}
