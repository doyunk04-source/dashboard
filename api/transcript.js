// Vercel 서버리스 함수: YouTube 자막을 watch 페이지에서 정식 경로로 추출
// 1) watch 페이지 fetch → 2) ytInitialPlayerResponse에서 caption track URL 추출 → 3) 자막 fetch

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  try {
    // 1. watch 페이지 가져오기
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(watchUrl, { headers });
    if (!pageRes.ok) {
      return res.status(pageRes.status).json({ error: 'Failed to load watch page' });
    }
    const html = await pageRes.text();

    // 2. ytInitialPlayerResponse JSON 추출
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/);
    if (!match) {
      return res.status(404).json({ error: 'Could not parse player response' });
    }

    let playerResponse;
    try {
      playerResponse = JSON.parse(match[1]);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid player response JSON' });
    }

    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || !tracks.length) {
      return res.status(404).json({ error: 'No captions available for this video' });
    }

    // 3. 우선순위: ko > en > 그 외 첫 번째
    const track =
      tracks.find((t) => t.languageCode === 'ko') ||
      tracks.find((t) => t.languageCode === 'en') ||
      tracks[0];

    // baseUrl에 fmt=json3 추가
    const captionUrl = track.baseUrl + '&fmt=json3';
    const captionRes = await fetch(captionUrl, { headers });
    if (!captionRes.ok) {
      return res.status(captionRes.status).json({ error: 'Failed to fetch caption track' });
    }
    const captionData = await captionRes.json();

    // 4. 텍스트 추출
    const text = (captionData.events || [])
      .filter((e) => e.segs)
      .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text.length < 50) {
      return res.status(404).json({ error: 'Transcript too short or empty' });
    }

    return res.status(200).json({
      transcript: text,
      language: track.languageCode,
      length: text.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
