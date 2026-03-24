const EXACT_OVERRIDES = {
  'ABZU': 'https://cdn.thegamesdb.net/images/original/boxart/front/37561-1.jpg',
  'ALIEN INSOLATION THE COLLECTION': 'https://cdn.thegamesdb.net/images/original/boxart/front/78566-1.jpg',
  'ASSASSINS CREED ODYSSEY': 'https://cdn.thegamesdb.net/images/original/boxart/front/64193-1.jpg',
  'ASSASSINS CREED ORIGINS': 'https://cdn.thegamesdb.net/images/original/boxart/front/74195-1.jpg',
  'ASSASSINS CREED ROGUE REMASTERED': 'https://cdn.thegamesdb.net/images/original/boxart/front/100847-1.jpg',
  'ASSASSINS CREED VALHALLA': 'https://cdn.thegamesdb.net/images/original/boxart/front/79875-1.jpg',
  'ASTROBOT': 'https://cdn.thegamesdb.net/images/original/boxart/front/126795-1.jpg'
};

function normalize(str) {
  return String(str || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function limpiarTitulo(texto) {
  return String(texto || '')
    .replace(/^[🔥🎮📱⭐💣\s]+/g, '')
    .replace(/\b(PS4-PS5|PS4\/PS5|PS5|PS4)\b/gi, '')
    .replace(/[™®©]/g, '')
    .replace(/[-–—|:]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function generateVariants(title) {
  const limpio = limpiarTitulo(title);
  const simple = limpio
    .replace(/\b(THE COLLECTION|COLLECTION|LEGACY COLLECTION|REMASTERED|REMASTER|DEFINITIVE EDITION|DEFINITIVE|DELUXE EDITION|DELUXE|ULTIMATE EDITION|ULTIMATE|COMPLETE EDITION|COMPLETE|GOLD EDITION|GOLD|SPECIAL EDITION|SPECIAL|DIRECTORS CUT|DIRECTOR'S CUT|BUNDLE|PACK)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const variants = new Set();
  if (limpio) variants.add(limpio);
  if (simple) variants.add(simple);

  const n = normalize(limpio);

  const aliases = {
    'ALIEN INSOLATION THE COLLECTION': ['Alien Isolation', 'Alien: Isolation'],
    'ASSASSINS CREED ODYSSEY': ["Assassin's Creed Odyssey"],
    'ASSASSINS CREED ORIGINS': ["Assassin's Creed Origins"],
    'ASSASSINS CREED VALHALLA': ["Assassin's Creed Valhalla"],
    'ASSASSINS CREED ROGUE REMASTERED': ["Assassin's Creed Rogue Remastered", "Assassin's Creed Rogue"],
    'ASTROBOT': ['Astro Bot', 'Astrobot'],
    'ABZU': ['Abzû', 'Abzu']
  };

  Object.entries(aliases).forEach(([key, list]) => {
    if (n === key || n.includes(key)) {
      list.forEach(v => variants.add(v));
    }
  });

  return Array.from(variants).filter(Boolean);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 AREA51 Covers',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
  }
  return text;
}

function scoreMatch(input, candidate) {
  const a = normalize(input);
  const b = normalize(candidate);

  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.startsWith(a)) return 90;
  if (b.includes(a)) return 75;
  if (a.includes(b)) return 65;

  const words = a.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of words) {
    if (b.includes(word)) score += 8;
  }
  return score;
}

function extractSearchResults(html, variant) {
  const results = [];
  const regex = /href="(game\.php\?id=\d+)".*?>([^<]+)<\/a>[\s\S]{0,250}?(Sony Playstation 4|Sony Playstation 5|Playstation 4|Playstation 5)?/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const title = match[2];
    const platform = match[3] || '';

    results.push({
      url: `https://thegamesdb.net/${href}`,
      title,
      platform,
      score: scoreMatch(variant, title)
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function extractCoverUrl(html) {
  const patterns = [
    /https:\/\/cdn\.thegamesdb\.net\/images\/original\/boxart\/front\/[^"' <]+/i,
    /https:\/\/cdn\.thegamesdb\.net\/images\/medium\/boxart\/front\/[^"' <]+/i,
    /https:\/\/cdn\.thegamesdb\.net\/images\/small\/boxart\/front\/[^"' <]+/i,
    /src="(\/images\/original\/boxart\/front\/[^"]+)"/i,
    /src="(\/images\/medium\/boxart\/front\/[^"]+)"/i,
    /src="(\/images\/small\/boxart\/front\/[^"]+)"/i,
    /src="(https:\/\/[^"]+boxart\/front\/[^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const val = match[1];
      if (val.startsWith('http')) return val;
      return `https://cdn.thegamesdb.net${val}`;
    }
    if (match?.[0]?.startsWith('https://')) {
      return match[0];
    }
  }

  return null;
}

async function buscarEnTheGamesDB(title) {
  const variants = generateVariants(title);

  for (const variant of variants) {
    const searchUrl = `https://thegamesdb.net/search.php?name=${encodeURIComponent(variant)}`;
    const searchHtml = await fetchText(searchUrl);

    const results = extractSearchResults(searchHtml, variant);
    if (!results.length) continue;

    for (const result of results.slice(0, 5)) {
      try {
        const gameHtml = await fetchText(result.url);
        const cover = extractCoverUrl(gameHtml);
        if (cover) {
          return cover;
        }
      } catch (_) {
        // sigue con el próximo
      }
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const titles = Array.isArray(req.body?.titles) ? req.body.titles : [];
    const cleanTitles = titles.map(t => String(t || '').trim()).filter(Boolean);

    const results = [];

    for (const title of cleanTitles) {
      try {
        const key = normalize(limpiarTitulo(title));

        if (EXACT_OVERRIDES[key]) {
          results.push({ title, coverUrl: EXACT_OVERRIDES[key] });
          continue;
        }

        const coverUrl = await buscarEnTheGamesDB(title);
        results.push({ title, coverUrl: coverUrl || null });
      } catch (_) {
        results.push({ title, coverUrl: null });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Error interno'
    });
  }
}
