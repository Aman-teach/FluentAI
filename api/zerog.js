export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    let authHeader = req.headers.authorization;
    
    // Fallback to server-side env variable if no user key is provided
    if (!authHeader || authHeader.trim() === 'Bearer' || authHeader.trim() === 'Bearer null') {
      const serverKey = process.env.ZEROG_API_KEY;
      if (serverKey) {
        authHeader = `Bearer ${serverKey}`;
      }
    }
    
    if (!authHeader || authHeader.trim() === 'Bearer' || authHeader.trim() === 'Bearer null') {
      return res.status(401).json({ error: 'Authorization key is required' });
    }

    const response = await fetch('https://router-api.0g.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
