const TGDB_BASE = 'https://api.thegamesdb.net/v1';
const PLATFORM_PS4 = 4919;
const PLATFORM_PS5 = 4980;

function scoreMatch(input, candidate) {
  const a = String(input || '').toLowerCase().trim();
  const b = String(candidate || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.startsWith(a)) return 85;
  if (b.includes(a)) return 70;
  return a.split(/\s+/).filter(Boolean).reduce((acc, word) => acc + (b.includes(word) ? 10 : 0), 0);
}

async function tgdbFetch(path, apiKey) {
  const res = await fetch(`${TGDB_BASE}${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TGDB ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
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
    .map(item => ({ item, score: scoreMatch(nombre, item.game_title) }))
    .sort((a, b) => b.score - a.score);

  return ordenados[0]?.item || null;
}

async function buscarDetalleJuego(gameId, apiKey) {
  return tgdbFetch(`/Games/ByGameID?id=${encodeURIComponent(gameId)}&include=boxart,platform`, apiKey);
}

function resolverUrlCoverDesdeDetalle(data, gameId) {
  const base =
    data?.include?.boxart?.base_url?.original ||
    data?.include?.boxart?.base_url?.medium ||
    data?.include?.boxart?.base_url?.small ||
    '';

  const gameImages = data?.include?.boxart?.data?.[String(gameId)] || [];
  if (!base || !Array.isArray(gameImages) || !gameImages.length) return null;

  const front = gameImages.find(img => String(img.side).toLowerCase() === 'front') || gameImages[0];
  if (!front?.filename) return null;

  return base.replace(/\/+$/, '/') + String(front.filename).replace(/^\/+/, '');
}

async function resolverCover(title, apiKey) {
  const juego = await buscarJuegoPorNombre(title, apiKey);
  if (!juego?.id) return { title, coverUrl: null };

  const detalle = await buscarDetalleJuego(juego.id, apiKey);
  const coverUrl = resolverUrlCoverDesdeDetalle(detalle, juego.id);
  return { title, coverUrl: coverUrl || null };
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
        results.push({ title, coverUrl: null, error: err.message });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
