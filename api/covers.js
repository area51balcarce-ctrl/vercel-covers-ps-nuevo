export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const titles = req.body.titles || [];
    const results = [];

    for (const rawTitle of titles) {

      // 🔥 LIMPIEZA PRO
      const limpio = rawTitle
        .replace(/PS4|PS5|PS4-PS5/gi, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\b(the|edition|remastered|collection)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      let cover = null;

      try {
        const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(limpio)}&page_size=10`;

        const r = await fetch(url);
        const data = await r.json();

        if (data.results && data.results.length > 0) {

          let best = null;
          let bestScore = 0;

          for (const game of data.results) {
            const name = game.name.toLowerCase();

            let score = 0;

            const words = limpio.split(" ");

            for (const w of words) {
              if (name.includes(w)) score += 10;
            }

            if (name === limpio) score += 50;
            if (name.includes(limpio)) score += 30;

            if (score > bestScore) {
              bestScore = score;
              best = game;
            }
          }

          if (best && best.background_image) {
            cover = best.background_image;
          }
        }

      } catch (e) {}

      results.push({
        title: rawTitle,
        coverUrl: cover || null // ❌ sin fallback trucho
      });
    }

    res.status(200).json({ results });

  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
}
