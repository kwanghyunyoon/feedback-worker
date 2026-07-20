const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Apps that get a GitHub issue opened for their feedback, beyond the Discord ping.
// needs-triage: nothing gets implemented off an issue opened here until a human
// (or a /triage session) reviews it and moves it to ready-for-agent/ready-for-human.
const GITHUB_ISSUE_REPOS = {
  clarity: 'kwanghyunyoon/clarity-in-calm',
  dreami: 'kwanghyunyoon/dreami',
};

async function createGithubIssue(repo, token, issueType, description) {
  const labels = ['needs-triage'];
  if (issueType === 'Bug') labels.push('bug');
  if (issueType === 'Suggestion') labels.push('enhancement');

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'feedback-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[Feedback] ${description.trim().slice(0, 80)}`,
      body: `**Type:** ${issueType || 'Bug'}\n**Source:** In-app feedback form\n\n${description.trim()}\n\n---\n_This issue was created automatically from an in-app feedback submission and has not been verified. Needs triage before any implementation work begins._`,
      labels,
    }),
  });

  if (!res.ok) {
    console.error('GitHub issue creation failed', res.status, await res.text());
    return null;
  }
  const issue = await res.json();
  return issue.html_url;
}

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

    const title =
      source === 'clarity'           ? 'Clarity in Calm Feedback'   :
      source === 'classroom-toolkit' ? 'Classroom Toolkit Feedback'  :
                                       'Dreami Feedback';
    const color =
      source === 'clarity'           ? 0x7DB59A :
      source === 'classroom-toolkit' ? 0xF59E0B :
                                       0x5B57B8;

    let githubIssueUrl = null;
    const repo = GITHUB_ISSUE_REPOS[source];
    if (repo && env.GITHUB_TOKEN) {
      try {
        githubIssueUrl = await createGithubIssue(repo, env.GITHUB_TOKEN, issueType, description);
      } catch (err) {
        console.error('GitHub fetch failed:', err.message);
      }
    }

    let discordOk = false;
    try {
      const discordFields = [
        { name: 'Type',        value: String(issueType || 'Bug'), inline: true },
        { name: 'Description', value: description.trim().slice(0, 1024) },
      ];
      if (githubIssueUrl) {
        discordFields.push({ name: 'GitHub issue', value: githubIssueUrl });
      }

      const res = await fetch(env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ title, color, fields: discordFields }],
        }),
      });
      discordOk = res.ok;
      if (!res.ok) {
        console.error('Discord error', res.status, await res.text());
      }
    } catch (err) {
      console.error('Discord fetch failed:', err.message);
    }

    if (!discordOk && !githubIssueUrl) {
      return new Response('Delivery failed', { status: 502, headers: CORS });
    }

    return new Response(JSON.stringify({ githubIssueUrl }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
