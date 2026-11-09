// Builds the Discord message for a published Sysvia release, from the release notes on GitHub.
// The notes are written for the release page (a picture, headings, long bullets), so they are not posted as they are:
// the banner becomes the message's picture, each heading becomes a short block of its main points, and the download
// links go at the top. Run by .github/workflows/discord-release.yml, which pipes the JSON to the webhook.
//
// Environment: RELEASE_JSON (the release, as JSON).

const BOT_NAME = 'Sysvia Releases';
const AVATAR = 'https://raw.githubusercontent.com/DigitxlLink-LLC/sysvia-release/main/media/discord-bot-avatar.png';
const COLOR = 0x4fc3a1;

const MAX_FIELDS = 5;
const MAX_ITEMS = 4;
const ITEM_LIMIT = 170;
const SHORT_LEAD = 40;

// Cuts at a word, with an ellipsis, so a point never ends in the middle of one.
function cut(text, limit) {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:.\-]+$/, '')}…`;
}

const firstSentence = text => text.split(/(?<=[.!?])\s+/)[0] || text;
const plain = text => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

// Release notes as text: no HTML, no pictures, Windows line ends made plain.
function withoutMarkup(body) {
  return String(body || '')
    .replace(/\r\n?/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

// The banner at the top of the notes, if there is one.
function bannerOf(body) {
  const match = /<img\b[^>]*?\bsrc="([^"]+)"/i.exec(String(body || '')) || /!\[[^\]]*\]\(([^)\s]+)\)/.exec(String(body || ''));
  return match ? match[1] : null;
}

// One point of a section, short: a bold lead-in with the rest of its sentence, or the first sentence.
function pointOf(text) {
  const joined = text.replace(/\s+/g, ' ').trim();
  const lead = /^\*\*(.+?)\*\*\s*(.*)$/.exec(joined);
  if (!lead) return cut(plain(firstSentence(joined)), ITEM_LIMIT);
  const head = plain(lead[1]);
  // A lead-in that stops partway through its sentence ("..., so you still get it") is the start of the point.
  if (!/[.!?:]$/.test(head)) return cut(plain(firstSentence(`${head} ${lead[2]}`)), ITEM_LIMIT);
  // A short lead-in ("It is a choice.") is bold; one that is a whole sentence of its own is the point, plain.
  if (head.length > SHORT_LEAD) return cut(head, ITEM_LIMIT);
  const bold = `**${head}**`;
  const room = ITEM_LIMIT - bold.length - 1;
  const rest = lead[2] && room > 20 ? cut(plain(firstSentence(lead[2])), room) : '';
  return rest ? `${bold} ${rest}` : bold;
}

// The notes split at their "## " headings: the opening text, then [heading, points] for each.
function sectionsOf(body) {
  const text = withoutMarkup(body);
  const parts = text.split(/^##\s+(.+)$/m);
  const blocks = [];
  for (let index = 1; index < parts.length; index += 2) {
    const heading = plain(parts[index]);
    const lines = parts[index + 1].split('\n');
    const points = [];
    let paragraph = [];
    const flush = () => { if (paragraph.length) points.push(paragraph.join(' ')); paragraph = []; };
    for (const line of lines) {
      // A smaller heading, and the build's own Commit and Built line, are not points.
      if (/^\s*#{3,}\s/.test(line) || /^\s*(Commit|Built):/.test(line)) { flush(); continue; }
      if (/^\s*[-*]\s+/.test(line)) { flush(); points.push(line.replace(/^\s*[-*]\s+/, '')); }
      else if (/^\s+\S/.test(line) && points.length && !paragraph.length) points[points.length - 1] += ` ${line.trim()}`;
      else if (!line.trim()) flush();
      else paragraph.push(line.trim());
    }
    flush();
    if (heading && points.length) blocks.push([heading, points]);
  }
  return { intro: parts[0], blocks };
}

// The line under the title: the bold summary the notes open with.
function summaryOf(intro) {
  const lines = intro.split('\n').map(line => line.trim()).filter(line => line && !/^#\s/.test(line));
  return lines.length ? cut(lines[0].replace(/^\*\*(.+)\*\*$/, '$1'), 300) : '';
}

function downloadsOf(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const find = pattern => list.find(asset => pattern.test(asset.name))?.browser_download_url;
  const links = [
    ['Windows', find(/win-x64\.exe$/i)],
    ['Mac (Apple Silicon)', find(/mac-arm64\.dmg$/i)],
    ['Mac (Intel)', find(/mac-x64\.dmg$/i)]
  ].filter(([, link]) => link);
  return links.map(([label, link]) => `[${label}](${link})`).join('  ·  ');
}

function buildPayload({ name, url, body, assets, published }) {
  const title = `${/^sysvia\b/i.test(String(name).trim()) ? String(name).trim() : `Sysvia ${String(name).trim()}`} is out`;
  const { intro, blocks } = sectionsOf(body);
  const summary = summaryOf(intro);
  const downloads = downloadsOf(assets);

  const description = [summary, downloads ? `**Download:** ${downloads}` : '', `[Everything in this release](${url})`].filter(Boolean).join('\n\n');
  const fields = blocks.slice(0, MAX_FIELDS).map(([heading, points]) => {
    const shown = points.slice(0, MAX_ITEMS).map(point => `• ${pointOf(point)}`);
    const more = points.length - shown.length;
    if (more > 0) shown.push(`*…and ${more} more in the notes*`);
    return { name: cut(heading, 250), value: cut(shown.join('\n'), 1000), inline: false };
  });

  const embed = {
    author: { name: BOT_NAME, icon_url: AVATAR },
    title: cut(title, 250),
    url,
    description: cut(description, 2000),
    color: COLOR,
    fields,
    footer: { text: 'Sysvia' }
  };
  const image = bannerOf(body);
  if (image) embed.image = { url: image };
  if (published && !Number.isNaN(Date.parse(published))) embed.timestamp = new Date(published).toISOString();

  // `allowed_mentions` empty: nothing in the notes can ping anyone.
  return { username: BOT_NAME, avatar_url: AVATAR, allowed_mentions: { parse: [] }, embeds: [embed] };
}

// `RELEASE_JSON` is the release as GitHub's API gives it (the event's `release`, or `gh api .../releases/tags/<tag>`).
function main(env = process.env) {
  const release = JSON.parse(env.RELEASE_JSON || '{}');
  return buildPayload({
    name: release.name || release.tag_name || '',
    url: release.html_url || '',
    body: release.body || '',
    assets: release.assets || [],
    published: release.published_at || ''
  });
}

module.exports = { main, buildPayload, sectionsOf, pointOf, bannerOf, summaryOf, downloadsOf, cut, BOT_NAME, AVATAR };

if (require.main === module) process.stdout.write(JSON.stringify(main()));
