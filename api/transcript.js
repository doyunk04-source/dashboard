// Vercel 서버리스 함수: YouTube 자막 가져오기
// CORS 없이 서버에서 직접 YouTube timedtext API 호출

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { videoId, lang = 'ko' } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: `https://www.youtube.com/watch?v=${videoId}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'YouTube request failed',
        status: response.status,
      });
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
