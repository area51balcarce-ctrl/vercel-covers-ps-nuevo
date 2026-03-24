export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const titles = req.body.titles || [];

    const results = [];

    for (const rawTitle of titles) {

      const limpio = rawTitle
        .replace(/PS4|PS5|PS4-PS5/gi, "")
        .replace(/[^\w\s]/gi, "")
        .trim();

      let cover = null;

      try {
        const searchUrl = `https://api.rawg.io/api/games?search=${encodeURIComponent(limpio)}&page_size=1`;

        const r = await fetch(searchUrl);
        const data = await r.json();

        if (data.results && data.results.length > 0) {
          cover = data.results[0].background_image;
        }
      } catch (e) {}

      // fallback REAL (no placeholder feo)
      if (!cover) {
        cover = `https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg`;
      }

      results.push({
        title: rawTitle,
        coverUrl: cover
      });
    }

    res.status(200).json({ results });

  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
}
