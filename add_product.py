import json

with open("api_products.json", "r", encoding="utf-8") as f:
    data = json.load(f)

new_product = {
    "id": "yampi-moletom-capuz",
    "yampiProductId": "moletom-capuz",
    "name": "Moletom Pet com Capuz",
    "category": "Inverno",
    "price": 19.90,
    "oldPrice": 39.90,
    "stock": 100,
    "image": "/assets/moletom-preto.jpg",
    "images": [
        "/assets/moletom-preto.jpg",
        "/assets/moletom-branco.jpg",
        "/assets/moletom-azul.jpg",
        "/assets/moletom-vermelho.jpg",
        "/assets/moletom-verde.jpg"
    ],
    "sizes": ["PP", "P", "M", "G", "GG"],
    "colors": ["Preto", "Branco", "Azul", "Vermelho", "Verde"],
    "description": "Moletom Pet com Capuz – Conforto e Estilo para Todas as Estações!<br><br>Mantenha seu pet aquecido e estiloso com este moletom com capuz, ideal para dias frios ou passeios cheios de charme! Confeccionado em uma combinação macia e resistente de poliéster e algodão, o tecido proporciona conforto térmico sem abrir mão da leveza.<br><br>Disponível nas cores verde, vermelho, azul, branco e preto, é uma peça versátil que combina com todos os estilos de pets — dos mais discretos aos mais fashionistas! O capuz dá um toque especial ao visual, além de ajudar a proteger do vento e do frio.<br><br>Praticidade garantida: pode ser lavado na máquina, facilitando o dia a dia sem comprometer a qualidade da peça.",
    "customization": {
        "enabled": false
    },
    "yampi": {
        "productId": "moletom-capuz",
        "url": "/produto/moletom-capuz",
        "skus": []
    },
    "premium": {
        "soldCount": "+150 vendidos",
        "rating": 5.0,
        "reviewCount": 12,
        "badgeText": "Novidade",
        "deliveryText": "",
        "descriptionTitle": "Moletom Pet com Capuz",
        "descriptionIntro": "Mantenha seu pet aquecido e estiloso",
        "descriptionBlocks": [],
        "specs": "",
        "reviews": []
    },
    "pageContentUpdatedAt": "2026-07-08T00:00:00.000Z",
    "homeSortOrder": 0
}

# Create basic SKUs for each size and color
sku_idx = 1
for size in new_product["sizes"]:
    for color in new_product["colors"]:
        new_product["yampi"]["skus"].append({
            "id": f"sku-moletom-{sku_idx}",
            "sku": f"MOL-CAPUZ-{size}-{color[:3].upper()}",
            "purchaseUrl": "https://wa.me/5511999999999?text=Ol%C3%A1%21+Gostaria+de+comprar+o+Moletom+com+Capuz",
            "size": size,
            "price": 19.90,
            "oldPrice": 39.90,
            "variations": [
                { "name": "Tamanho", "value": size },
                { "name": "Cor", "value": color }
            ]
        })
        sku_idx += 1

data["products"].insert(0, new_product)
data["count"] = len(data["products"])

with open("api_products.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=4, ensure_ascii=False)
