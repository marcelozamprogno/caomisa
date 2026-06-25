export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      name, 
      email, 
      cpf, 
      phone, 
      cep, 
      street, 
      number, 
      neighborhood, 
      city, 
      state, 
      cart, 
      total,
      shippingCost 
    } = req.body;

    const INVICTUS_API_URL = "https://api.invictuspay.app.br/api/public/v1/transactions";

    // O usuario mandou:
    // offer_hash: pycyfgyy0y
    // checkout_hash: mpljoroel6 (não usado explicitamente no json de api, mas vamos deixar documentado)

    const payload = {
      api_token: process.env.INVICTUS_TOKEN,
      amount: Math.round(total * 100), // Em centavos (ex: 59.90 -> 5990)
      offer_hash: "mpljoroel6", // Hash do checkout fornecido
      payment_method: "pix",
      customer: {
        name: name,
        email: email,
        phone_number: phone.replace(/\D/g, ""),
        document: cpf.replace(/\D/g, ""),
        street_name: street,
        number: number,
        complement: "N/A",
        neighborhood: neighborhood,
        city: city,
        state: state,
        zip_code: cep.replace(/\D/g, "")
      },
      cart: cart.map(item => ({
        product_hash: "pycyfgyy0y", // Hash do produto fornecido
        title: item.name,
        cover: item.image,
        price: Math.round(item.price * 100),
        quantity: item.quantity,
        operation_type: 1,
        tangible: true
      })),
      expire_in_days: 1,
      transaction_origin: "api",
      tracking: {
        src: "caomisa-store",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        utm_term: "",
        utm_content: ""
      }
    };

    // Make the request to Invictus Pay
    const response = await fetch(INVICTUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      console.error("Invictus Pay Error:", data);
      return res.status(400).json({ error: "Failed to generate PIX", details: data });
    }

    const transaction = data.transaction || data;
    
    // O texto do copia e cola está em data.pix.pix_qr_code
    const qrCodeText = data.pix?.pix_qr_code || "";
    // A Invictus não retorna a imagem base64, então geramos uma usando uma API pública
    const qrCodeImage = qrCodeText ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCodeText)}` : ""; 
    
    // We send back exactly what the frontend needs
    return res.status(200).json({
      success: true,
      order_id: transaction.id || transaction.transaction_id || Math.floor(10000 + Math.random() * 90000),
      qr_code_base64: qrCodeImage,
      qr_code_text: qrCodeText
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
