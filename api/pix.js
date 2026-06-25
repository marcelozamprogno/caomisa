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
      amount: Math.round(total * 100), // Em centavos (ex: 59.90 -> 5990)
      offer_hash: "pycyfgyy0y", 
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
        product_hash: "", // Deixando vazio pois não foi fornecido um hash por produto
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
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INVICTUS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Invictus Pay Error:", data);
      return res.status(400).json({ error: "Failed to generate PIX", details: data });
    }

    // Mapeando a resposta de acordo com APIs padrão de Pix. Pode precisar de ajuste caso a Invictus retorne diferente.
    // Normalmente o response tem algo como data.transaction.qr_code_image ou data.pix.qrcode
    const transaction = data.transaction || data.data || data;
    
    const qrCodeImage = transaction.qr_code_image || transaction.qr_code_base64 || transaction.pix_qr_code || ""; 
    const qrCodeText = transaction.qr_code_text || transaction.pix_emv || transaction.pix_code || transaction.copia_e_cola || "";
    
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
