export default async function handler(req, res) {
  const { nombres } = req.body;
  const API_KEY = process.env.TGDB_API_KEY;

  if (!nombres || !Array.isArray(nombres)) {
    return res.status(400).json({ error: "Faltan nombres" });
  }

  try {
    const resultados = [];

    for (const nombre of nombres) {
      // 1. Buscar juego
      const searchRes = await fetch(
        `https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${API_KEY}&name=${encodeURIComponent(nombre)}`
      );
      const searchData = await searchRes.json();

      const game = searchData?.data?.games?.[0];

      if (!game) {
        resultados.push({ nombre, cover: null });
        continue;
      }

      const gameId = game.id;

      // 2. Buscar imágenes
      const imgRes = await fetch(
        `https://api.thegamesdb.net/v1/Games/Images?apikey=${API_KEY}&games_id=${gameId}`
      );
      const imgData = await imgRes.json();

      const base = imgData?.data?.base_url?.original;
      const boxart = imgData?.data?.images?.[gameId]?.boxart?.[0]?.filename;

      const cover = base && boxart ? base + boxart : null;

      resultados.push({ nombre, cover });
    }

    res.status(200).json(resultados);
  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
}
