export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const titles = Array.isArray(req.body?.titles) ? req.body.titles : [];
    const results = [];

    for (const rawTitle of titles) {
      const limpio = rawTitle
        .replace(/PS4|PS5|PS4-PS5/gi, "")
        .replace(/[^\w\s]/gi, "")
        .replace(/\b(the|edition|remastered|collection)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      let cover = null;

      // Si más adelante conseguís RAWG key, va acá.
      const rawgKey = process.env.RAWG_API_KEY;

      if (rawgKey) {
        try {
          const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(limpio)}&page_size=10&key=${rawgKey}`;
          const r = await fetch(url);
          const data = await r.json();

          if (Array.isArray(data?.results) && data.results.length > 0) {
            let best = null;
            let bestScore = -1;
            const limpioLower = limpio.toLowerCase();

            for (const game of data.results) {
              const name = String(game.name || "").toLowerCase();
              let score = 0;

              if (name === limpioLower) score += 100;
              if (name.includes(limpioLower)) score += 40;

              for (const word of limpioLower.split(" ")) {
                if (word && name.includes(word)) score += 10;
              }

              if (score > bestScore) {
                bestScore = score;
                best = game;
              }
            }

            if (best?.background_image) {
              cover = best.background_image;
            }
          }
        } catch (_) {}
      }

      // Sin tapa real: devolver búsqueda lista para abrir
      if (!cover) {
        cover = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(limpio + " ps4 ps5 portada")}`;
      }

      results.push({
        title: rawTitle,
        coverUrl: cover
      });
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: "Error interno" });
  }
}
