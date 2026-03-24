const TGDB_BASES = [
  'https://api.thegamesdb.net/v1.1',
  'https://api.thegamesdb.net/v1'
];

const PLATFORM_PS4 = 4919;
const PLATFORM_PS5 = 4980;

// ✅ overrides exactos para los títulos que YA sabés que existen
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

function limpiarTituloBase(texto) {
  return String(texto || '')
    .replace(/^[🔥🎮📱⭐💣\s]+/g, '')
    .replace(/\b(PS4-PS5|PS4\/PS5|PS5|PS4)\b/gi, '')
    .replace(/[™®©]/g, '')
    .replace(/[-–—|:]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function simplificarTitulo(texto) {
  return limpiarTituloBase(texto)
    .replace(/\b(THE COLLECTION|COLLECTION|LEGACY COLLECTION|REMASTERED|REMASTER|DEFINITIVE EDITION|DEFINITIVE|DELUXE EDITION|DELUXE|ULTIMATE EDITION|ULTIMATE|COMPLETE EDITION|COMPLETE|GOLD EDITION|GOLD|SPECIAL EDITION|SPECIAL|DIRECTORS CUT|DIRECTOR'S CUT|BUNDLE|PACK)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

function generateVariants(title) {
  const limpio = limpiarTituloBase(title);
  const simple = simplificarTitulo(title);

  const variants = new Set();
  if (limpio) variants.add(limpio);
  if (simple) variants.add(simple);

  const upper = normalize(limpio);

  const aliases = {
    'ALIEN INSOLATION THE COLLECTION': ['Alien Isolation', 'Alien: Isolation'],
    'ASSASSINS CREED ODYSSEY': ["Assassin's Creed Odyssey"],
    'ASSASSINS CREED ORIGINS': ["Assassin's Creed Origins"],
    'ASSASSINS CREED VALHALLA': ["Assassin's Creed Valhalla"],
    'ASSASSINS CREED ROGUE REMASTERED': ["Assassin's Creed Rogue Remastered", "Assassin's Creed Rogue"],
    'ASSASSINS CREED MIRAGE': ["Assassin's Creed Mirage"],
    'ASSASSINS CREED UNITY': ["Assassin's Creed Unity"],
    'ASTROBOT': ['Astro Bot', 'Astrobot'],
    'ABZU': ['ABZU']
  };

  Object.entries(aliases).forEach(([key, list]) => {
    if (upper === key || upper.includes(key)) {
      list.forEach(v => variants.add(v));
    }
  });

  [limpio, simple].forEach(v => {
    if (!v) return;
    const byColon = v.split(':')[0]?.trim();
    const byDash = v.split('-')[0]?.trim();
    const byParen = v.split('(')[0]?.trim();
    if (byColon) variants.add(byColon);
    if (byDash) variants.add(byDash);
    if (byParen) variants.add(byParen);
  });

  return Array.from(variants).filter(Boolean);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 AREA51 Covers'
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON: ${text.slice(0, 180)}`);
  }
}

async function tgdbFetch(path, apiKey) {
  for (const base of TGDB_BASES) {
    const url = `${base}${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(apiKey)}`;
    try {
      return await fetchJson(url);
    } catch (_) {
      // sigue con la otra base
    }
  }
  return null;
}

async function buscarJuegoPorNombre(nombre, apiKey) {
  const data = await tgdbFetch(`/Games/ByGameName?name=${encodeURIComponent(nombre)}`, apiKey);
  const games = Array.isArray(data?.data?.games) ? data.data.games : [];
  if (!games.length) return null;

  const filtrados = games.filter(g => {
    const p = Number(g.platform);
    return p === PLATFORM_PS4 || p === PLATFORM_PS5;
  });

  const candidatos = filtrados.length ? filtrados : games;

  const ordenados = candidatos
    .map(item => ({
      item,
      score: scoreMatch(nombre, item.game_title)
    }))
    .sort((a, b) => b.score - a.score);

  return ordenados[0]?.item || null;
}

async function buscarDetalleJuego(gameId, apiKey) {
  return tgdbFetch(`/Games/ByGameID?id=${encodeURIComponent(gameId)}&include=boxart,platform`, apiKey);
}

async function buscarImagenesJuego(gameId, apiKey) {
  return tgdbFetch(`/Games/Images?games_id=${encodeURIComponent(gameId)}`, apiKey);
}

function resolverUrlCoverDesdeDetalle(data, gameId) {
  const base =
    data?.include?.boxart?.base_url?.original ||
    data?.include?.boxart?.base_url?.medium ||
    data?.include?.boxart?.base_url?.small ||
    '';

  const gameImages = data?.include?.boxart?.data?.[String(gameId)] || [];
  if (!base || !Array.isArray(gameImages) || !gameImages.length) return null;

  const front =
    gameImages.find(img => String(img.side || '').toLowerCase() === 'front') ||
    gameImages.find(img => String(img.type || '').toLowerCase() === 'boxart') ||
    gameImages[0];

  if (!front) return null;

  const filename = front.filename || front.file_name || front.url || '';
  if (!filename) return null;

  if (/^https?:\/\//i.test(filename)) return filename;
  return base.replace(/\/+$/, '/') + String(filename).replace(/^\/+/, '');
}

function resolverUrlCoverDesdeImages(data, gameId) {
  const base =
    data?.data?.base_url?.original ||
    data?.data?.base_url?.medium ||
    data?.data?.base_url?.small ||
    '';

  if (!base) return null;

  const imagesRoot = data?.data?.images;
  if (!imagesRoot) return null;

  let candidates = null;

  if (Array.isArray(imagesRoot?.[String(gameId)])) {
    candidates = imagesRoot[String(gameId)];
  } else if (Array.isArray(imagesRoot?.boxart)) {
    candidates = imagesRoot.boxart;
  } else if (Array.isArray(imagesRoot?.boxart?.front)) {
    candidates = imagesRoot.boxart.front;
  }

  if (!Array.isArray(candidates) || !candidates.length) return null;

  const front =
    candidates.find(img => String(img.side || '').toLowerCase() === 'front') ||
    candidates.find(img => String(img.type || '').toLowerCase() === 'boxart') ||
    candidates[0];

  if (!front) return null;

  const filename = front.filename || front.file_name || front.url || '';
  if (!filename) return null;

  if (/^https?:\/\//i.test(filename)) return filename;
  return base.replace(/\/+$/, '/') + String(filename).replace(/^\/+/, '');
}

async function resolverCover(title, apiKey) {
  const limpio = normalize(limpiarTituloBase(title));

  // ✅ primero: override exacto
  if (EXACT_OVERRIDES[limpio]) {
    return { title, coverUrl: EXACT_OVERRIDES[limpio] };
  }

  // ✅ segundo: intentar TGDB normal
  const variants = generateVariants(title);

  for (const variant of variants) {
    const juego = await buscarJuegoPorNombre(variant, apiKey);
    if (!juego?.id) continue;

    let coverUrl = null;

    try {
      const detalle = await buscarDetalleJuego(juego.id, apiKey);
      coverUrl = resolverUrlCoverDesdeDetalle(detalle, juego.id);
    } catch (_) {}

    if (!coverUrl) {
      try {
        const images = await buscarImagenesJuego(juego.id, apiKey);
        coverUrl = resolverUrlCoverDesdeImages(images, juego.id);
      } catch (_) {}
    }

    if (coverUrl) {
      return { title, coverUrl };
    }
  }

  return { title, coverUrl: null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TGDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta TGDB_API_KEY en Vercel' });
  }

  try {
    const titles = Array.isArray(req.body?.titles) ? req.body.titles : [];
    const cleanTitles = titles.map(t => String(t || '').trim()).filter(Boolean);

    const results = [];
    for (const title of cleanTitles) {
      try {
        results.push(await resolverCover(title, apiKey));
      } catch (err) {
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
