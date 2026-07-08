export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Configurações fornecidas pelo usuário
  const PIXEL_ID = '1425445482723910';
  const ACCESS_TOKEN = 'EAAPmwKtLZBdQBR07rhaHZAZBIaCmvDKdnva3pqlPvnlpfuuVH2VoONWxcsiAr2kX8PpPJkmMTST35rSrLLOMB0Teu1F1vBJTM7xGZA33U5d4Uqlm7qOFKA21JgI6oHNZC3ZCHo3ZCtArsL4M5sWiqtwtpR2tZA7UograZBowZAQhlk2WhUzJ1SBJM76g1sITnM8QZDZD';

  try {
    const eventData = req.body || {};
    
    // Construção do payload para a API de Conversões da Meta
    const payload = {
      data: [
        {
          event_name: eventData.event_name || 'PageView',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: {
            client_ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0',
            client_user_agent: req.headers['user-agent'] || '',
            ...eventData.user_data
          },
          custom_data: eventData.custom_data || {},
          event_source_url: eventData.event_source_url || req.headers.referer || 'https://caomisa.com'
        }
      ]
    };

    const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI Error Response:', result);
      return res.status(400).json({ success: false, error: result });
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('CAPI Internal Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
