export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'Deepgram API key not configured on server.' });
    }

    const contentType = req.headers['content-type'] || 'audio/webm';
    
    // Read raw body stream
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&filler_words=true', {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Token ${key}`
      },
      body: audioBuffer
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
