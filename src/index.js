const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { issueType, description, source } = body;
    if (!description?.trim()) {
      return new Response('Missing description', { status: 400, headers: CORS });
    }

    const title = source === 'clarity' ? 'Clarity in Calm Feedback' : 'Dreami Feedback';
    const color = source === 'clarity' ? 0x7DB59A : 0x5B57B8;

    const res = await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          color,
          fields: [
            { name: 'Type',        value: String(issueType || 'Bug'), inline: true },
            { name: 'Description', value: description.trim().slice(0, 1024) },
          ],
        }],
      }),
    });

    return new Response(null, { status: res.ok ? 204 : 502, headers: CORS });
  },
};
