const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function assertEnv() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const err = new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY environment variables');
        err.code = 'ENV_MISSING';
        throw err;
    }
}

async function supabaseRequest(method, endpoint, body = null, extraHeaders = {}) {
    assertEnv();
    const url = `${SUPABASE_URL}/rest/v1${endpoint}`;

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : '',
            ...extraHeaders
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch { /* body may be empty */ }
        const err = new Error(`Supabase ${method} ${endpoint} failed (HTTP ${response.status})`);
        err.code = 'SUPABASE_HTTP_ERROR';
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    const text = await response.text();
    if (!text) return null;

    return JSON.parse(text);
}

module.exports = { supabaseRequest };
