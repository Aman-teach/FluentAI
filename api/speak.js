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

    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text field is required' });
    }

    // aura-asteria-en is Deepgram's high-quality conversational English voice
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${key}`
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).end(errText);
    }

    // Forward the binary audio stream
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
