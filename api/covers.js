export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const titles = Array.isArray(req.body?.titles) ? req.body.titles : [];

    const results = [];

    for (const title of titles) {
      const limpio = title
        .replace(/PS4|PS5|PS4-PS5/gi, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim();

      let cover = null;

      try {
        const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(limpio)}&page_size=1&key=`;

        const r = await fetch(url);
        const data = await r.json();

        if (data.results && data.results.length > 0) {
          cover = data.results[0].background_image;
        }
      } catch (e) {}

      // fallback si RAWG falla
      if (!cover) {
        cover = `https://via.placeholder.com/300x400?text=${encodeURIComponent(limpio)}`;
      }

      results.push({
        title,
        coverUrl: cover
      });
    }

    return res.status(200).json({ results });

  } catch (err) {
    return res.status(500).json({
      error: 'Error interno'
    });
  }
}
