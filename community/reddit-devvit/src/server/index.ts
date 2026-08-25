/**
 * StrataMesh Laboratory — Devvit server (r/StrataMesh_DLT)
 * Complements classic Reddit script API + Cloudflare community worker.
 * Lab only — no mainnet claims.
 */

import { Devvit } from '@devvit/public-api';

const HYPE =
  /\b(guaranteed\s+returns?|next\s+ethereum|100x|moon\s*shot|mainnet\s+live|financial\s+advice)\b/i;

const LAB_LINKS = [
  'GitHub org: https://github.com/StrataMesh-Laboratory',
  'Why your expertise matters: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/WHY-YOUR-EXPERTISE-MATTERS.md',
  'Discussion: https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions/4',
  'Impact Fund: https://fund.calhegasmorais.pt/challenges',
  'Site: https://calhegasmorais.pt/',
].join('\n');

async function mirrorDiscord(webhook: string | undefined, content: string) {
  if (!webhook || !webhook.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 1800),
        username: 'StrataMesh Laboratory',
      }),
    });
  } catch {
    /* non-fatal */
  }
}

Devvit.configure({
  redditAPI: true,
  http: true,
  redis: true,
});

/** New post: optional hype/mainnet-claim report (does not auto-remove). */
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const post = event.post;
    if (!post || post.stickied) return;

    const settings = await context.settings.getAll();
    const flag = settings.flag_hype_language !== false;
    const text = `${post.title || ''}\n${post.body || ''}`;

    if (flag && HYPE.test(text)) {
      try {
        await context.reddit.report(post, {
          reason:
            'Lab honesty: possible hype / mainnet / returns language — please review (StrataMesh Laboratory is pre-testnet).',
        });
      } catch {
        /* scope may vary by install */
      }
      await mirrorDiscord(
        settings.discord_webhook as string | undefined,
        `⚠️ Flagged post in r/StrataMesh_DLT: ${post.title}\nhttps://reddit.com${post.permalink}`
      );
    }
  },
});

/** Weekly lab status template (Monday 10:00 UTC per devvit.json cron). */
Devvit.addSchedulerJob({
  name: 'lab-status-weekly',
  onRun: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const body =
      `**StrataMesh Laboratory — weekly lab pulse (automated)**\n\n` +
      `Status: pre-testnet laboratory · not mainnet.\n` +
      `Reference node: FOG-NODE-PT-CM-001 · operator AMCM ENI.\n\n` +
      `${LAB_LINKS}\n\n` +
      `_Posted by stratamesh-lab Devvit app · mods can unsticky/remove._`;

    try {
      const post = await context.reddit.submitPost({
        subredditName: subreddit.name,
        title: '[Lab] Weekly pulse — StrataMesh Laboratory (pre-testnet)',
        text: body,
      });
      const settings = await context.settings.getAll();
      await mirrorDiscord(
        settings.discord_webhook as string | undefined,
        `📣 Weekly lab pulse posted: https://reddit.com${post.permalink}`
      );
    } catch (e) {
      console.error('lab-status-weekly failed', e);
    }
  },
});

Devvit.addMenuItem({
  label: 'StrataMesh: lab links',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.submitPost({
      subredditName: subreddit.name,
      title: '[Official] StrataMesh Laboratory — contributor entry points',
      text:
        `**Pre-testnet laboratory** — open-source DLT + Fog/Edge substrate.\n\n` +
        `Humans and SCAs are **subjects**; STRATA/NFTs/resources are **objects**.\n\n` +
        `${LAB_LINKS}\n\n` +
        `Tracks: network · edge · economy · agents · worlds · identity — see GitHub issues \`track:*\`.`,
    });
    context.ui.showToast('Posted lab links');
  },
});

export default Devvit;
