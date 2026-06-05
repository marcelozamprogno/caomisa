const PRODUCTS_KEY = "caomisa_products_v3";
const CART_KEY = "caomisa_cart_v2";
const SESSION_KEY = "caomisa_admin_token";
const BANNERS_KEY = "caomisa_banners_v3";
const SITE_CONTENT_KEY = "caomisa_site_content_v1";
const COLLECTIONS_KEY = "caomisa_collections_v1";
const CATEGORIES_KEY = "caomisa_categories_v1";
const INTEGRATION_SYNC_KEY = "caomisa_last_integration_sync";
const PLACEHOLDER_IMAGE = "";
const BLANK_IMAGE_SRC = "data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

const defaultProducts = [];

const defaultBanners = [
  {
    id: "banner-brasil",
    eyebrow: "Coleção Brasil Pet",
    title: "Torça com Conforto",
    subtitle: "Camisas leves em verde e amarelo feitas sob medida para o seu cachorro vibrar junto com você.",
    linkUrl: "/produtos?categoria=Brasil",
    linkText: "Ver Coleção Brasil",
    desktopImage: PLACEHOLDER_IMAGE,
    mobileImage: PLACEHOLDER_IMAGE
  },
  {
    id: "banner-inverno",
    eyebrow: "Coleção Inverno",
    title: "Aqueça seu Melhor Amigo",
    subtitle: "Moletons quentinhos e macios para garantir proteção nos dias frios com total estilo.",
    linkUrl: "/produtos?categoria=Inverno",
    linkText: "Ver Moletons",
    desktopImage: PLACEHOLDER_IMAGE,
    mobileImage: PLACEHOLDER_IMAGE
  },
  {
    id: "banner-kits",
    eyebrow: "Kits Promocionais",
    title: "Leve Mais, Pague Menos",
    subtitle: "Kits especiais com duas ou mais roupinhas para renovar o guarda-roupa com frete grátis.",
    linkUrl: "/produtos?categoria=Kits",
    linkText: "Aproveitar Oferta",
    desktopImage: PLACEHOLDER_IMAGE,
    mobileImage: PLACEHOLDER_IMAGE
  }
];

const defaultSiteContent = {
  lowerBanner: {
    linkUrl: "/produtos?categoria=Inverno",
    desktopImage: PLACEHOLDER_IMAGE,
    mobileImage: PLACEHOLDER_IMAGE
  },
  aboutPhotos: {
    photoOne: PLACEHOLDER_IMAGE,
    photoTwo: PLACEHOLDER_IMAGE
  }
};

const defaultCollections = [
  {
    id: "camisas",
    name: "Camisas",
    image: PLACEHOLDER_IMAGE,
    sourceCategory: "Camisas",
    productIds: []
  },
  {
    id: "casacos",
    name: "Casacos",
    image: PLACEHOLDER_IMAGE,
    sourceCategory: "Casacos",
    productIds: []
  },
  {
    id: "brasil",
    name: "Brasil",
    image: PLACEHOLDER_IMAGE,
    sourceCategory: "Brasil",
    productIds: []
  },
  {
    id: "passeio",
    name: "Passeio",
    image: PLACEHOLDER_IMAGE,
    sourceCategory: "Passeio",
    productIds: []
  },
  {
    id: "kits",
    name: "Kits",
    image: PLACEHOLDER_IMAGE,
    sourceCategory: "Kits",
    productIds: []
  }
];

let products = loadProducts();
let banners = defaultBanners;
let siteContent = loadSiteContent();
let collections = loadCollections();
let categories = loadCategories();
let reviewModeration = [];
let personalizationRecords = [];
let pendingPersonalization = null;
let profitReport = null;
let profitCostOptions = [];
let profitSearchTimer = null;
let salesProcessingOrders = [];
let salesSearchTimer = null;
let activeSalesStatus = "new";
let packingPersonalizedMatches = [];
let packingPersonalizedTimer = null;
let packingStandardOrders = [];
let packingStandardTimer = null;
let melhorEnvioStatus = null;
let cart = loadCart();
const initialUrlParams = new URLSearchParams(window.location.search);
let activeCategory = initialUrlParams.get("categoria") || "Todos";
let activeCollectionId = initialUrlParams.get("colecao") || "";
let searchTerm = initialUrlParams.get("busca") || "";
let categoryRefreshPromise = null;
let adminProductReviews = [];
let adminReviewEditIndex = -1;
const PRODUCT_REVIEWS_PER_PAGE = 10;
const reviewPageByProduct = new Map();
let toastTimer;

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const isCatalogPath = () => ["/produtos", "/produtos.html"].includes(window.location.pathname);

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function categoryProductCount(category) {
  if (category === "Todos") return products.length;
  const normalized = normalizeSearch(category);
  return products.filter((product) => normalizeSearch(product.category) === normalized).length;
}

function collectionById(collectionId = activeCollectionId) {
  const normalizedId = String(collectionId || "");
  return collections.find((collection) => collection.id === normalizedId) || null;
}

function collectionMatchesProduct(collection, product) {
  if (!collection || !product) return false;
  if (collection.productIds?.length) {
    return collection.productIds.includes(product.id);
  }

  const productCategory = normalizeSearch(product.category);
  const fallbackCategories = [collection.sourceCategory, collection.name]
    .map(normalizeSearch)
    .filter(Boolean);
  return fallbackCategories.includes(productCategory);
}

function collectionProductCount(collection) {
  return products.filter((product) => collectionMatchesProduct(collection, product)).length;
}

function catalogUrl({ category = activeCategory, search = searchTerm, collectionId = activeCollectionId } = {}) {
  const params = new URLSearchParams();
  if (collectionId) {
    params.set("colecao", collectionId);
  } else if (category && category !== "Todos") {
    params.set("categoria", category);
  }
  if (String(search || "").trim()) params.set("busca", String(search).trim());
  const query = params.toString();
  return `/produtos${query ? `?${query}` : ""}`;
}

function updateCatalogUrl() {
  if (!isCatalogPath()) return;
  window.history.replaceState(null, "", catalogUrl());
}

function assetUrl(value) {
  if (!hasImageValue(value)) return BLANK_IMAGE_SRC;

  if (/^(https?:|data:|\/)/.test(value)) {
    return value;
  }

  return `/${String(value).replace(/^\.?\//, "")}`;
}

function hasImageValue(value) {
  const image = String(value || "").trim();
  return Boolean(image) && !/(^|\/)assets\/banner-placeholder\.svg(?:[?#].*)?$/i.test(image);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStars(stars = 5) {
  const value = Math.max(0, Math.min(5, Number(stars || 0)));
  return Array.from({ length: 5 }, (_, index) => `
    <i data-lucide="star" class="${index < Math.round(value) ? "is-filled" : ""}" aria-hidden="true"></i>
  `).join("");
}

function parseSpecs(specs = "") {
  return String(specs)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      return {
        label: (label || "Detalhe").trim(),
        value: rest.join(":").trim() || line
      };
    });
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `produto-${Date.now()}`;
}

function stableSlug(value, fallback = "produto") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;
}

function cleanProductNameForUrl(product) {
  return String(product?.name || product?.title || product?.id || "produto")
    .replace(/\s*-\s*frete\s+gr[aá]tis\s*$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();
}

function productPublicBaseSlug(product) {
  const fromName = stableSlug(cleanProductNameForUrl(product), "");
  if (fromName) return fromName;
  return stableSlug(String(product?.id || "").replace(/^yampi-/i, "").replace(/-\d+$/g, ""), "produto");
}

function productPublicSlug(product) {
  const base = productPublicBaseSlug(product);
  const sameSlugProducts = products.filter((item) => productPublicBaseSlug(item) === base);
  if (sameSlugProducts.length <= 1) return base;
  return `${base}-${stableSlug(product?.yampiProductId || product?.id, "produto")}`;
}

function productUrl(product) {
  return `/produto/${encodeURIComponent(productPublicSlug(product))}`;
}

function resolveProductReference(reference) {
  if (!reference) return null;
  if (typeof reference === "object") return reference;
  const value = decodeURIComponent(String(reference)).trim();
  if (!value) return null;

  return products.find((product) => (
    product.id === value ||
    productPublicSlug(product) === value ||
    productPublicBaseSlug(product) === value ||
    String(product.yampiProductId || "") === value
  )) || null;
}

function loadProducts() {
  return [];
}

function saveProducts() {
  // Persistence handled via server endpoints
}

async function readApiJson(response, fallbackMessage = "Erro na comunicacao com o servidor.") {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

function defaultCategories() {
  return [];
}

function loadCategories() {
  return defaultCategories();
}

function saveCategories() {
  // Persistence handled via server endpoints
}

function mergeCatalogCategories(categoryItems = [], productItems = products) {
  return [
    ...new Set([
      ...(Array.isArray(categoryItems) ? categoryItems : []),
      ...(Array.isArray(productItems) ? productItems.map((product) => product.category) : [])
    ]
      .map((category) => String(category || "").trim())
      .filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getCategories() {
  return [
    ...new Set([
      ...categories,
      ...products.map((product) => product.category).filter(Boolean)
    ])
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function ensureCategory(category) {
  const value = String(category || "").trim();
  if (!value) return;
  if (!categories.some((item) => item.toLowerCase() === value.toLowerCase())) {
    categories.push(value);
    categories = getCategories();
    saveCategories();
  }
}

function defaultProductPremium(product = {}) {
  const name = product.name || "Produto Caomisa";
  return {
    soldCount: "+598 vendidos",
    rating: 4.9,
    reviewCount: 127,
    badgeText: "Mais vendido",
    deliveryText: "Frete gratis para todo o Brasil com envio acompanhado.",
    descriptionTitle: `${name} para pets com conforto`,
    descriptionIntro: product.description || "Peca pensada para deixar o pet confortavel, bonito e pronto para os momentos em familia.",
    sizeGuideDesktopImage: PLACEHOLDER_IMAGE,
    sizeGuideMobileImage: PLACEHOLDER_IMAGE,
    descriptionBlocks: [
      {
        title: "Conforto no dia a dia",
        text: "Modelagem leve, toque macio e caimento pensado para o pet se movimentar com liberdade.",
        image: product.images?.[0] || product.image || PLACEHOLDER_IMAGE
      },
      {
        title: "Acabamento caprichado",
        text: "Detalhes escolhidos para vestir bem no passeio, nas fotos e nos momentos especiais.",
        image: product.images?.[1] || product.image || PLACEHOLDER_IMAGE
      },
      {
        title: "Pronta para presentear",
        text: "Pedido separado com cuidado e atendimento exclusivo em cada etapa da compra.",
        image: product.images?.[2] || product.image || PLACEHOLDER_IMAGE
      }
    ],
    specs: "Material: tecido leve e confortavel\nIndicado para: passeios, fotos e uso diario\nEnvio: frete gratis para todo o Brasil\nCuidados: lavar com sabao neutro e secar a sombra",
    reviews: [
      {
        name: "Mariana S.",
        stars: 5,
        text: "Chegou muito bem embalado e a roupinha ficou linda. O tecido e leve e nao incomodou meu pet."
      },
      {
        name: "Carlos M.",
        stars: 5,
        text: "Gostei muito do acabamento. A tabela de tamanhos ajudou e serviu certinho."
      },
      {
        name: "Amanda T.",
        stars: 5,
        text: "Comprei para fotos em familia e ficou perfeito. Atendimento muito cuidadoso."
      }
    ]
  };
}

function normalizeDescriptionBlocks(product, blocks = []) {
  const defaults = defaultProductPremium(product).descriptionBlocks;
  return [0, 1, 2].map((idx) => ({
    ...defaults[idx],
    ...(blocks[idx] || {})
  }));
}

function normalizeReviews(reviews = []) {
  const normalized = Array.isArray(reviews) ? reviews : [];
  return normalized
    .map((review) => ({
      id: String(review.id || "").trim(),
      name: String(review.name || "").trim() || "Cliente Caomisa",
      city: String(review.city || "").trim(),
      stars: Math.max(1, Math.min(5, Number(review.stars || 5))),
      text: String(review.text || "").trim(),
      image: String(review.image || "").trim(),
      status: String(review.status || "approved").trim(),
      createdAt: String(review.createdAt || "").trim(),
      aiGenerated: false,
      aiDisclosure: "",
      source: String(review.source || "").trim()
    }))
    .filter((review) => review.text && review.status !== "pending" && review.status !== "rejected");
}

function productLooksCustomizable(product = {}) {
  const text = [
    product.name,
    product.title,
    product.description,
    product.category
  ].filter(Boolean).join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /personaliz|nome\s*e\s*numero|numero\s*e\s*nome/.test(text);
}

function normalizeCustomizationConfig(config = {}, product = {}) {
  const source = config && typeof config === "object" ? config : {};
  const hasEnabled = Object.prototype.hasOwnProperty.call(source, "enabled");
  return {
    enabled: hasEnabled ? Boolean(source.enabled) : productLooksCustomizable(product),
    nameMaxLength: Math.max(3, Math.min(24, Number(source.nameMaxLength || 16))),
    numberMaxLength: Math.max(1, Math.min(3, Number(source.numberMaxLength || 2)))
  };
}

function isCustomizableProduct(product = {}) {
  return Boolean(normalizeCustomizationConfig(product.customization, product).enabled);
}

function normalizeProduct(product) {
  const baseImage = product.image || PLACEHOLDER_IMAGE;
  const images = Array.isArray(product.images) && product.images.length ? product.images : [baseImage];
  const variantConfig = normalizeVariantConfig(product.variantConfig);
  const customization = normalizeCustomizationConfig(product.customization, product);
  const variantModel = productVariantModel({ ...product, image: baseImage, images, variantConfig });
  const sizes = variantModel.hasColor
    ? variantModel.sizes
    : (Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ["Unico"]);
  const premiumDefaults = defaultProductPremium({ ...product, image: baseImage, images });
  const premium = product.premium || {};
  const normalizedReviews = normalizeReviews(premium.reviews);
  const hasReviewList = Array.isArray(premium.reviews);
  const visibleReviews = hasReviewList ? normalizedReviews : premiumDefaults.reviews;
  const reviewRating = visibleReviews.length
    ? visibleReviews.reduce((sum, review) => sum + Number(review.stars || 0), 0) / visibleReviews.length
    : Number(premium.rating ?? premiumDefaults.rating);

  return {
    ...product,
    image: baseImage,
    images,
    sizes,
    variantConfig,
    customization,
    premium: {
      ...premiumDefaults,
      ...premium,
      rating: Math.max(0, Math.min(5, reviewRating)),
      reviewCount: visibleReviews.length,
      descriptionBlocks: normalizeDescriptionBlocks({ ...product, image: baseImage, images }, premium.descriptionBlocks),
      reviews: visibleReviews
    }
  };
}

function loadBanners() {
  return (banners && banners.length) ? banners : defaultBanners;
}

function saveBanners() {
  // Persistence handled via persistBanners
}

async function persistBanners() {
  const response = await fetch("/api/banners", {
    method: "PUT",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ banners })
  });
  const data = await readApiJson(response, "Erro ao salvar banners no servidor.");
  if (Array.isArray(data.banners)) {
    banners = data.banners;
  }
  return banners;
}

async function loadBannersFromApi() {
  try {
    const response = await fetch("/api/banners", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.ok && Array.isArray(data.banners)) {
      const previousHash = JSON.stringify(banners);
      const currentHash = JSON.stringify(data.banners);
      if (previousHash !== currentHash) {
        banners = data.banners;
        renderHomeBanners();
        renderAdminBanners();
      }
    }
  } catch (error) {
    console.error("Erro ao carregar banners do servidor:", error);
  }
}

function normalizeSiteContent(saved = {}) {
  return {
    lowerBanner: {
      ...defaultSiteContent.lowerBanner,
      ...(saved.lowerBanner || {})
    },
    aboutPhotos: {
      ...defaultSiteContent.aboutPhotos,
      ...(saved.aboutPhotos || {})
    }
  };
}

function loadSiteContent() {
  return normalizeSiteContent();
}

function saveSiteContent() {
  // Persistence handled via persistSiteContent
}

async function persistSiteContent() {
  const response = await fetch("/api/site-content", {
    method: "PUT",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ siteContent })
  });
  const data = await readApiJson(response, "Erro ao salvar conteudo do site no servidor.");
  if (data.siteContent) {
    siteContent = normalizeSiteContent(data.siteContent);
  }
  return siteContent;
}

async function loadSiteContentFromApi() {
  try {
    const response = await fetch("/api/site-content", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.ok && data.siteContent) {
      const newSiteContent = normalizeSiteContent(data.siteContent);
      const previousHash = JSON.stringify(siteContent);
      const currentHash = JSON.stringify(newSiteContent);
      if (previousHash !== currentHash) {
        siteContent = newSiteContent;
        renderSiteContent();
        renderAdminSiteContentForm();
      }
    }
  } catch (error) {
    console.error("Erro ao carregar conteudo do site do servidor:", error);
  }
}

function normalizeCollection(collection = {}, index = 0) {
  const rawName = String(collection.name || collection.title || `Coleção ${index + 1}`).trim();
  const name = rawName.toLowerCase() === "camisetas" ? "Camisas" : rawName;
  const sourceCategory = String(collection.sourceCategory || collection.category || name).trim();
  const id = String(collection.id || slugify(name)).trim() || `colecao-${index + 1}`;
  const productIds = Array.isArray(collection.productIds)
    ? collection.productIds.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    id,
    name,
    image: hasImageValue(collection.image || collection.photo) ? String(collection.image || collection.photo).trim() : PLACEHOLDER_IMAGE,
    sourceCategory: sourceCategory.toLowerCase() === "camisetas" ? "Camisas" : sourceCategory,
    productIds,
    sortOrder: Number.isFinite(Number(collection.sortOrder)) ? Number(collection.sortOrder) : index
  };
}

function normalizeCollections(source = defaultCollections) {
  const items = Array.isArray(source) ? source : defaultCollections;
  const usedIds = new Set();
  return items
    .map((collection, index) => {
      const normalized = normalizeCollection(collection, index);
      let id = normalized.id;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${normalized.id}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      return { ...normalized, id };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function loadCollections() {
  return normalizeCollections(defaultCollections);
}

function saveCollectionsLocal() {
  // Persistence handled via persistCollections
}

async function persistCollections() {
  const response = await fetch("/api/collections", {
    method: "PUT",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ collections })
  });
  const data = await readApiJson(response, "Erro ao salvar colecoes no servidor.");
  if (Array.isArray(data.collections)) {
    collections = normalizeCollections(data.collections);
  }
  return collections;
}

async function loadCollectionsFromApi({ silent = true } = {}) {
  try {
    const response = await fetch("/api/collections", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao carregar coleções.");
    }
    const previousHash = JSON.stringify(collections);
    const newCollections = normalizeCollections(data.collections);
    const currentHash = JSON.stringify(newCollections);

    if (previousHash !== currentHash) {
      collections = newCollections;
      renderHomeCollections();
      renderAdminCollections();
      renderProducts();
      startCollectionCarousel();
    }
  } catch (error) {
    if (!silent) showToast(error.message || "Erro ao carregar coleções.");
  }
}

let isPolling = false;
async function startAutoSync() {
  if (isPolling) return;
  isPolling = true;

  setInterval(async () => {
    if (document.hidden || document.body.classList.contains("admin-template")) return;
    try {
      await loadCollectionsFromApi({ silent: true });
      await loadBannersFromApi();
      await loadSiteContentFromApi();
      await loadCatalogProducts({ silent: true });
    } catch (err) {
      console.error("AutoSync error:", err);
    }
  }, 30000);
}

function convertToWebP(file, maxWidth, maxHeight, quality = 0.96) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (maxWidth && maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
        }

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/webp", quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function iconRefresh() {
  const lucideApi = window.lucide || globalThis.lucide;
  if (lucideApi?.createIcons) {
    lucideApi.createIcons();
  }
}

function discount(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) {
    return 0;
  }
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

function normalizeVariantText(value = "") {
  return String(value || "").trim();
}

function variationEntries(sku = {}) {
  return [
    ...(Array.isArray(sku.variations) ? sku.variations : []),
    ...(Array.isArray(sku.options) ? sku.options : []),
    ...(Array.isArray(sku.attributes) ? sku.attributes : [])
  ].filter(Boolean);
}

function skuVariationValue(sku = {}, matchers = []) {
  const entries = variationEntries(sku);
  const found = entries.find((variation) => {
    const label = normalizeVariantText(variation.name || variation.title || variation.label || variation.option);
    return matchers.some((matcher) => matcher.test(label));
  });
  return normalizeVariantText(found?.value || found?.option || found?.title || found?.name);
}

function skuSizeValue(sku = {}) {
  const explicit = skuVariationValue(sku, [/tamanho/i, /size/i, /tam\./i]);
  if (explicit) return explicit;
  const raw = normalizeVariantText(sku.size || sku.title || sku.name || "Unico");
  return normalizeVariantText(raw.split("/")[0]) || "Unico";
}

function skuColorValue(sku = {}) {
  return skuVariationValue(sku, [/^cor$/i, /color/i, /colour/i, /cor/i]);
}

function uniqueVariantValues(values = []) {
  return [...new Set(values.map(normalizeVariantText).filter(Boolean))];
}

function variantSort(a, b) {
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

function normalizeVariantConfig(config = {}) {
  const source = config && typeof config === "object" ? config : {};
  const colorImagesSource = source.colorImages || source.colorImageMap || {};
  const disabledSource = source.disabled || source.unavailable || {};
  const colorImages = {};
  const disabled = {};

  Object.entries(colorImagesSource).forEach(([color, image]) => {
    const key = normalizeVariantText(color);
    const value = normalizeVariantText(image);
    if (key && value) colorImages[key] = value;
  });

  Object.entries(disabledSource).forEach(([color, sizes]) => {
    const colorKey = normalizeVariantText(color);
    if (!colorKey || !sizes || typeof sizes !== "object") return;
    Object.entries(sizes).forEach(([size, unavailable]) => {
      const sizeKey = normalizeVariantText(size);
      if (!sizeKey || !unavailable) return;
      disabled[colorKey] = disabled[colorKey] || {};
      disabled[colorKey][sizeKey] = true;
    });
  });

  return { colorImages, disabled };
}

function isSkuDisabledByConfig(config = {}, sku = {}) {
  const normalized = normalizeVariantConfig(config);
  const color = skuColorValue(sku);
  const size = skuSizeValue(sku);
  return Boolean(color && size && normalized.disabled[color]?.[size]);
}

function productVariantModel(product = {}) {
  const config = normalizeVariantConfig(product.variantConfig);
  const skus = Array.isArray(product.yampi?.skus) ? product.yampi.skus : [];
  const rows = skus.map((sku) => {
    const size = skuSizeValue(sku);
    const color = skuColorValue(sku);
    return {
      sku,
      size,
      color,
      available: !isSkuDisabledByConfig(config, sku)
    };
  });
  const colors = uniqueVariantValues(rows.map((row) => row.color)).sort(variantSort);
  const sizesFromSkus = uniqueVariantValues(rows.map((row) => row.size)).sort(variantSort);
  const fallbackSizes = Array.isArray(product.sizes) ? uniqueVariantValues(product.sizes).sort(variantSort) : [];
  const sizes = colors.length ? sizesFromSkus : (fallbackSizes.length ? fallbackSizes : ["Unico"]);

  return {
    hasColor: colors.length > 0,
    colors,
    sizes,
    rows,
    config
  };
}

function findVariantSku(product = {}, { size = "", color = "", exact = false } = {}) {
  const skus = Array.isArray(product.yampi?.skus) ? product.yampi.skus : [];
  if (!skus.length) return null;
  const model = productVariantModel(product);
  const wantedSize = normalizeVariantText(size);
  const wantedColor = normalizeVariantText(color);
  const eligible = skus.filter((sku) => !isSkuDisabledByConfig(model.config, sku));

  if (model.hasColor) {
    const exactSku = eligible.find((sku) => skuColorValue(sku) === wantedColor && skuSizeValue(sku) === wantedSize);
    if (exact) return exactSku || null;
    return exactSku
      || eligible.find((sku) => skuColorValue(sku) === wantedColor)
      || eligible[0]
      || null;
  }

  const exactSku = eligible.find((sku) => sku.size === wantedSize || skuSizeValue(sku) === wantedSize);
  if (exact) return exactSku || null;
  return exactSku
    || eligible[0]
    || null;
}

function firstAvailableSizeForColor(product = {}, color = "") {
  const model = productVariantModel(product);
  const row = model.rows.find((item) => item.color === color && item.available);
  return row?.size || model.sizes[0] || "Unico";
}

function colorImageForVariant(product = {}, color = "") {
  const config = normalizeVariantConfig(product.variantConfig);
  const mapped = config.colorImages[normalizeVariantText(color)];
  return mapped || product.image || product.images?.[0] || PLACEHOLDER_IMAGE;
}

function swatchColorValue(color = "") {
  const key = normalizeVariantText(color)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const map = {
    amarelo: "#f5c400",
    azul: "#1565c0",
    verde: "#159447",
    preto: "#111827",
    branco: "#ffffff",
    vermelha: "#d72638",
    vermelho: "#d72638",
    rosa: "#f472b6",
    pink: "#ec4899",
    roxo: "#7c3aed",
    lilas: "#a78bfa",
    laranja: "#f97316",
    cinza: "#9ca3af",
    marrom: "#8b5e34",
    bege: "#d6b98c"
  };
  return map[key] || "#e5e7eb";
}

function swatchStyle(color = "") {
  const value = swatchColorValue(color);
  const border = value === "#ffffff" ? "#cbd5e1" : value;
  return `--swatch:${value};--swatch-border:${border};`;
}

function yampiSkuForSize(product, size, color = "") {
  return findVariantSku(product, { size, color, exact: Boolean(color) });
}

function yampiCheckoutItems(lines) {
  return lines.map((line) => {
    const sku = line.yampiToken
      ? {
          token: line.yampiToken,
          purchaseUrl: line.yampiPurchaseUrl || ""
        }
      : yampiSkuForSize(line.product, line.size, line.color);
    return {
      token: sku?.token || "",
      purchaseUrl: sku?.purchaseUrl || "",
      quantity: line.quantity
    };
  });
}

function appendCheckoutMetadata(urlString, metadata = {}) {
  const entries = Object.entries(metadata).filter(([, value]) => String(value || "").trim());
  if (!entries.length) return urlString;
  try {
    const url = new URL(urlString);
    entries.forEach(([key, value]) => {
      url.searchParams.set(`metadata[${key}]`, String(value).slice(0, 1200));
    });
    return url.toString();
  } catch {
    return urlString;
  }
}

function yampiDirectCheckoutUrl(item, metadata = {}) {
  if (!item?.purchaseUrl) return "";
  try {
    const url = new URL(item.purchaseUrl);
    if (Number(item.quantity || 1) > 1) {
      const parts = url.pathname.split("/");
      const token = parts.pop();
      if (token) parts.push(`${token}:${Number(item.quantity || 1)}`);
      url.pathname = parts.join("/");
    }
    return appendCheckoutMetadata(url.toString(), metadata);
  } catch {
    return "";
  }
}

function selectedVariantPricing(product = {}, size = "", color = "") {
  const sku = findVariantSku(product, { size, color, exact: Boolean(color || size) })
    || yampiSkuForSize(product, size, color);
  const price = Number(sku?.price || product.price || 0);
  const oldPrice = Number(sku?.oldPrice || product.oldPrice || 0);
  const validOldPrice = oldPrice > price ? oldPrice : 0;
  const discountValue = validOldPrice ? Math.round(((validOldPrice - price) / validOldPrice) * 100) : 0;
  return {
    price,
    oldPrice: validOldPrice,
    discount: discountValue,
    installment: price / 12
  };
}

function updateDetailPrice(shell, product) {
  if (!shell || !product) return;
  const activeSize = qs("[data-detail-sizes] .is-active", shell)?.dataset.size || "";
  const activeColor = qs("[data-detail-colors] .is-active", shell)?.dataset.color || "";
  const pricing = selectedVariantPricing(product, activeSize, activeColor);
  const compareLine = qs("[data-detail-compare-line]", shell);
  const priceEl = qs("[data-detail-price-current]", shell);
  const installmentEl = qs("[data-detail-installment]", shell);
  const stickyOld = qs("[data-sticky-price-old]", shell);
  const stickyCurrent = qs("[data-sticky-price-current]", shell);
  const stickyDiscount = qs("[data-sticky-discount]", shell);

  if (compareLine) {
    compareLine.innerHTML = `
      ${pricing.oldPrice ? `<span>De <s>${money(pricing.oldPrice)}</s></span>` : "<span>Oferta especial</span>"}
      ${pricing.discount ? `<em>${pricing.discount}% OFF</em>` : ""}
    `;
  }
  if (priceEl) priceEl.textContent = money(pricing.price);
  if (installmentEl) installmentEl.textContent = `em até 12x de ${money(pricing.installment)} sem juros`;
  if (stickyOld) {
    stickyOld.textContent = pricing.oldPrice ? money(pricing.oldPrice) : "";
    stickyOld.hidden = !pricing.oldPrice;
  }
  if (stickyCurrent) stickyCurrent.textContent = money(pricing.price);
  if (stickyDiscount) {
    stickyDiscount.textContent = pricing.discount ? `-${pricing.discount}%` : "";
    stickyDiscount.hidden = !pricing.discount;
  }
}

function productHomeSortValue(product, fallbackIndex = 0) {
  const order = Number(product?.homeSortOrder);
  return Number.isFinite(order) ? order : 10000 + fallbackIndex;
}

function homeOrderedProducts(items = products) {
  const originalIndexes = new Map(products.map((product, index) => [product.id, index]));
  return [...items].sort((left, right) => {
    const leftIndex = originalIndexes.get(left.id) ?? 0;
    const rightIndex = originalIndexes.get(right.id) ?? 0;
    return productHomeSortValue(left, leftIndex) - productHomeSortValue(right, rightIndex)
      || leftIndex - rightIndex;
  });
}

function productCardMarkup(product) {
  const off = discount(product);
  return `
    <article class="product-card">
      ${off ? `<span class="discount-badge"><i data-lucide="tag" aria-hidden="true"></i>-${off}%</span>` : ""}
      <a href="${productUrl(product)}" aria-label="Abrir ${escapeHtml(product.name)}">
        <img src="${assetUrl(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="price-line">
            ${product.oldPrice ? `<s>${money(product.oldPrice)}</s>` : ""}
            <strong>${money(product.price)}</strong>
          </div>
        </div>
      </a>
    </article>
  `;
}

function sanitizeCustomizationName(value = "", maxLength = 16) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeCustomizationNumber(value = "", maxLength = 2) {
  return String(value || "")
    .replace(/\D+/g, "")
    .slice(0, maxLength);
}

function customizationPreviewText(customization = {}) {
  const name = sanitizeCustomizationName(customization.name || "").toUpperCase() || "NOME";
  const number = sanitizeCustomizationNumber(customization.number || "") || "10";
  return `${name} ${number}`;
}

function updatePersonalizationPreview(shell) {
  if (!shell) return;
  const nameInput = qs("[data-custom-name]", shell);
  const numberInput = qs("[data-custom-number]", shell);
  const preview = qs("[data-custom-preview]", shell);
  const name = sanitizeCustomizationName(nameInput?.value || "", Number(nameInput?.maxLength || 16));
  const number = sanitizeCustomizationNumber(numberInput?.value || "", Number(numberInput?.maxLength || 2));
  if (numberInput && numberInput.value !== number) numberInput.value = number;
  if (preview) preview.textContent = customizationPreviewText({ name, number });
  const error = qs("[data-custom-error]", shell);
  if (error) error.hidden = true;
}

function setPersonalizationError(shell, message = "") {
  const error = qs("[data-custom-error]", shell);
  if (!error) return;
  error.textContent = message;
  error.hidden = !message;
}

function customizationFromContainer(container, product) {
  if (!isCustomizableProduct(product)) return null;
  const config = normalizeCustomizationConfig(product.customization, product);
  const nameInput = qs("[data-custom-name]", container);
  const numberInput = qs("[data-custom-number]", container);
  const name = sanitizeCustomizationName(nameInput?.value || "", config.nameMaxLength);
  const number = sanitizeCustomizationNumber(numberInput?.value || "", config.numberMaxLength);

  if (!name) {
    setPersonalizationError(container, "Digite o nome que vai na camiseta.");
    nameInput?.focus();
    return false;
  }

  if (!number) {
    setPersonalizationError(container, "Digite o número que vai na camiseta.");
    numberInput?.focus();
    return false;
  }

  setPersonalizationError(container, "");
  return { name, number };
}

function personalizationModalMarkup(product) {
  if (!isCustomizableProduct(product)) return "";
  const config = normalizeCustomizationConfig(product.customization, product);
  return `
    <div class="personalization-modal" data-personalization-modal hidden>
      <button class="personalization-backdrop" type="button" data-personalization-close aria-label="Fechar personalização"></button>
      <section class="personalization-dialog" role="dialog" aria-modal="true" aria-label="Personalizar camiseta">
        <button class="personalization-close" type="button" data-personalization-close aria-label="Fechar">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
        <div class="personalization-heading">
          <span>Personalização</span>
          <strong>Nome e número da camiseta</strong>
          <p data-personalization-summary></p>
        </div>
        <div class="personalization-fields">
          <label>
            <span>Nome do cachorro</span>
            <input data-custom-name type="text" maxlength="${config.nameMaxLength}" autocomplete="off" placeholder="Ex: Thor" />
          </label>
          <label>
            <span>Número</span>
            <input data-custom-number type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="${config.numberMaxLength}" autocomplete="off" placeholder="Ex: 10" />
          </label>
        </div>
        <div class="personalization-preview">
          <span>Prévia</span>
          <strong data-custom-preview>NOME 10</strong>
        </div>
        <p class="personalization-error" data-custom-error hidden></p>
        <div class="personalization-actions">
          <button class="secondary-button" type="button" data-personalization-close>Voltar</button>
          <button class="primary-button" type="button" data-personalization-submit>Adicionar ao carrinho</button>
        </div>
      </section>
    </div>
  `;
}

function openPersonalizationModal(shell, product, selection = {}) {
  const modal = qs("[data-personalization-modal]", shell);
  if (!modal || !product) return false;
  pendingPersonalization = {
    productId: product.id,
    size: selection.size || "",
    color: selection.color || "",
    quantity: selection.quantity || 1,
    image: selection.image || ""
  };

  const summary = qs("[data-personalization-summary]", modal);
  if (summary) {
    summary.textContent = `${selection.color ? `${selection.color} · ` : ""}Tamanho ${selection.size || "selecionado"}`;
  }

  const nameInput = qs("[data-custom-name]", modal);
  const numberInput = qs("[data-custom-number]", modal);
  if (nameInput) nameInput.value = "";
  if (numberInput) numberInput.value = "";
  setPersonalizationError(modal, "");
  updatePersonalizationPreview(modal);
  modal.hidden = false;
  document.body.classList.add("personalization-open");
  window.setTimeout(() => nameInput?.focus(), 60);
  return true;
}

function closePersonalizationModal() {
  const modal = qs("[data-personalization-modal]");
  if (modal) {
    modal.hidden = true;
    setPersonalizationError(modal, "");
    const nameInput = qs("[data-custom-name]", modal);
    const numberInput = qs("[data-custom-number]", modal);
    if (nameInput) nameInput.value = "";
    if (numberInput) numberInput.value = "";
    updatePersonalizationPreview(modal);
  }
  pendingPersonalization = null;
  document.body.classList.remove("personalization-open");
}

function submitPersonalizationModal() {
  const modal = qs("[data-personalization-modal]");
  if (!modal || !pendingPersonalization) return;
  const product = products.find((item) => item.id === pendingPersonalization.productId);
  const customization = customizationFromContainer(modal, product);
  if (customization === false) return;

  const pending = { ...pendingPersonalization };
  addToCart(pending.productId, pending.size, pending.quantity, pending.color, pending.image, customization);
  closePersonalizationModal();
  openCart();
}

function newPersonalizationCode() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CAO-${day}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function checkoutMetadataFromLines(lines = []) {
  const personalized = lines
    .filter((line) => line.customization?.name && line.customization?.number)
    .map((line, index) => ({
      item: index + 1,
      produto: line.product.name,
      tamanho: line.size,
      cor: line.color || "",
      nome: line.customization.name,
      numero: line.customization.number,
      quantidade: line.quantity
    }));

  if (!personalized.length) return {};

  const code = newPersonalizationCode();
  const summary = personalized
    .map((item) => `${item.quantidade}x ${item.produto} | Tam ${item.tamanho}${item.cor ? ` | Cor ${item.cor}` : ""} | Nome ${item.nome} | Numero ${item.numero}`)
    .join(" || ");

  const metadata = {
    caomisa_codigo: code,
    caomisa_personalizacao: summary,
    caomisa_total_personalizados: String(personalized.length),
    caomisa_itens_json: JSON.stringify(personalized)
  };

  personalized.forEach((item, index) => {
    const n = index + 1;
    metadata[`caomisa_item_${n}_produto`] = item.produto;
    metadata[`caomisa_item_${n}_tamanho`] = item.tamanho;
    metadata[`caomisa_item_${n}_cor`] = item.cor;
    metadata[`caomisa_item_${n}_nome`] = item.nome;
    metadata[`caomisa_item_${n}_numero`] = item.numero;
  });

  return metadata;
}

function filteredProducts() {
  const normalizedSearch = normalizeSearch(searchTerm);
  const normalizedCategory = normalizeSearch(activeCategory);
  const activeCollection = collectionById();
  return products.filter((product) => {
    const byCollection = !activeCollection || collectionMatchesProduct(activeCollection, product);
    const byCategory = activeCollection || activeCategory === "Todos" || normalizeSearch(product.category) === normalizedCategory;
    const text = normalizeSearch(`${product.name} ${product.category} ${product.description} ${(product.sizes || []).join(" ")}`);
    const bySearch = !normalizedSearch || text.includes(normalizedSearch);
    return byCollection && byCategory && bySearch;
  });
}

function renderCategories() {
  const tabs = qs("[data-category-tabs]");
  if (!tabs) return;

  const categoryItems = ["Todos", ...getCategories()];
  tabs.innerHTML = categoryItems
    .map(
      (category) => `
        <button type="button" class="${category === activeCategory ? "is-active" : ""}" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `
    )
    .join("");
}

function prepareCategoryNav() {
  qsa("[data-main-nav] a[href='/produtos']").forEach((anchor) => {
    anchor.dataset.categoryToggle = "";
    anchor.setAttribute("aria-haspopup", "menu");
    anchor.setAttribute("aria-expanded", "false");
  });
}

function ensureCategoryPanel() {
  const header = qs(".site-header");
  if (!header) return null;

  let panel = qs("[data-category-panel]", header);
  if (panel) return panel;

  panel = document.createElement("section");
  panel.className = "category-panel";
  panel.setAttribute("data-category-panel", "");
  panel.setAttribute("aria-label", "Escolher categoria");
  panel.hidden = true;
  panel.innerHTML = `
    <div class="category-panel-card">
      <div class="category-choice-grid" data-category-options></div>
    </div>
  `;
  header.appendChild(panel);
  return panel;
}

function setCategoryToggleState(isOpen) {
  qsa("[data-category-toggle]").forEach((anchor) => {
    anchor.setAttribute("aria-expanded", String(isOpen));
  });
}

function renderCategoryPanel() {
  const panel = ensureCategoryPanel();
  if (!panel) return;

  const options = qs("[data-category-options]", panel);
  const categoryItems = getCategories();

  if (options) {
    if (!categoryItems.length && !products.length) {
      options.innerHTML = `<p class="category-empty">Sincronizando categorias da Yampi...</p>`;
    } else if (!categoryItems.length) {
      options.innerHTML = `<p class="category-empty">Nenhuma categoria cadastrada.</p>`;
    } else {
      options.innerHTML = categoryItems
        .map(
          (category) => `
            <button type="button" class="category-choice ${category === activeCategory ? "is-active" : ""}" data-category-pick="${escapeHtml(category)}">
              <span>${escapeHtml(category)}</span>
            </button>
          `
        )
        .join("");
    }
  }

  iconRefresh();
  window.requestAnimationFrame(startCollectionCarousel);
}

function closeCategoryPanel() {
  const panel = qs("[data-category-panel]");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.body.classList.remove("category-panel-open");
  setCategoryToggleState(false);
}

function refreshCategoryPanelFromCatalog() {
  if (categoryRefreshPromise) return categoryRefreshPromise;
  categoryRefreshPromise = loadCatalogProducts({ silent: true })
    .finally(() => {
      categoryRefreshPromise = null;
      renderCategoryPanel();
    });
  return categoryRefreshPromise;
}

function openCategoryPanel() {
  const panel = ensureCategoryPanel();
  if (!panel) return;

  closeSearchPanel();
  qs("[data-main-nav]")?.classList.remove("is-open");
  document.body.classList.add("category-panel-open");
  setCategoryToggleState(true);
  renderCategoryPanel();
  panel.hidden = false;
  const focusFirstCategory = () => {
    if (!panel.hidden) qs("[data-category-pick]", panel)?.focus();
  };
  refreshCategoryPanelFromCatalog().finally(focusFirstCategory);
  window.requestAnimationFrame(focusFirstCategory);
}

function selectCategory(category, { navigate = true, clearSearch = false } = {}) {
  activeCategory = category || "Todos";
  activeCollectionId = "";
  if (clearSearch) searchTerm = "";
  closeCategoryPanel();
  updateCatalogUrl();
  renderProducts();

  if (navigate && !isCatalogPath()) {
    window.location.href = catalogUrl({ category: activeCategory, collectionId: "", search: "" });
  }
}

function searchPreviewItems() {
  const term = normalizeSearch(searchTerm);
  const items = filteredProducts();
  if (term) return items;
  return items.length ? items : products;
}

function syncSearchInputs() {
  qsa("[data-search-input]").forEach((input) => {
    if (document.activeElement !== input && input.value !== searchTerm) {
      input.value = searchTerm;
    }
  });
}

function ensureSearchResults(panel) {
  let results = qs("[data-search-results]", panel);
  if (results) return results;

  results = document.createElement("div");
  results.className = "search-results";
  results.setAttribute("data-search-results", "");
  panel.appendChild(results);
  return results;
}

function renderSearchPreviews() {
  syncSearchInputs();

  qsa("[data-search-panel]").forEach((panel) => {
    const results = ensureSearchResults(panel);
    const term = searchTerm.trim();
    const items = searchPreviewItems();
    const previewItems = items.slice(0, 5);
    const heading = term ? `${items.length} resultado${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}` : "Produtos em destaque";

    if (!term) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    results.hidden = false;

    if (!products.length) {
      results.innerHTML = `<p class="search-empty">Sincronizando produtos da Yampi...</p>`;
      return;
    }

    if (!previewItems.length) {
      results.innerHTML = `
        <div class="search-results-head">
          <span>Nenhum resultado para "${escapeHtml(term)}"</span>
          <a href="/produtos" data-search-clear>Limpar busca</a>
        </div>
        <p class="search-empty">Tente buscar por categoria, modelo ou tamanho.</p>
      `;
      return;
    }

    results.innerHTML = `
      <div class="search-results-head">
        <span>${heading}</span>
        <a href="${catalogUrl()}" data-search-submit>Ver tudo</a>
      </div>
      <div class="search-preview-list">
        ${previewItems
          .map((product) => `
            <a class="search-preview-item" href="${productUrl(product)}">
              <img src="${assetUrl(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
              <span>
                <strong>${escapeHtml(product.name)}</strong>
                <small>${escapeHtml(product.category)} · ${money(product.price)}</small>
              </span>
              <i data-lucide="chevron-right" aria-hidden="true"></i>
            </a>
          `)
          .join("")}
      </div>
    `;
  });

  iconRefresh();
}

function positionSearchPanel(panel = qs("[data-search-panel]")) {
  const toggle = qs("[data-search-toggle]");
  if (!panel || !toggle) return;

  const rect = toggle.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const panelWidth = Math.min(420, viewportWidth - 24);
  const left = viewportWidth <= 680
    ? 12
    : Math.max(12, Math.min(rect.left, viewportWidth - panelWidth - 12));

  panel.style.setProperty("--search-panel-top", `${Math.round(rect.bottom + 10)}px`);
  panel.style.setProperty("--search-panel-left", `${Math.round(left)}px`);
  panel.style.setProperty("--search-panel-width", `${Math.round(panelWidth)}px`);
}

function openSearchPanel() {
  const panel = qs("[data-search-panel]");
  const input = qs("[data-search-input]");
  if (!panel || !input) return;

  closeCategoryPanel();
  qs("[data-main-nav]")?.classList.remove("is-open");
  panel.hidden = false;
  positionSearchPanel(panel);
  input.value = searchTerm;
  renderSearchPreviews();
  refreshCategoryPanelFromCatalog();
  window.requestAnimationFrame(() => input.focus());
}

function closeSearchPanel() {
  const panel = qs("[data-search-panel]");
  if (panel) panel.hidden = true;
}

function goToSearchResults() {
  const url = catalogUrl();
  if (isCatalogPath()) {
    updateCatalogUrl();
    renderProducts();
    return;
  }
  window.location.href = url;
}

function renderProducts() {
  renderCategories();
  const grid = qs("[data-product-grid]");
  if (!grid) {
    renderSearchPreviews();
    renderCategoryPanel();
    return;
  }

  const routeProduct = window.location.pathname.match(/^\/produto\/([^/]+)\/?$/)
    ? resolveProductReference(decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || ""))
    : null;
  if (routeProduct && grid.closest(".related-section")) {
    renderRelatedProducts(routeProduct);
    return;
  }

  const filtered = filteredProducts();
  const items = isCatalogPath() ? filtered : homeOrderedProducts(filtered).slice(0, 12);
  if (!items.length) {
    grid.innerHTML = `<div class="cart-empty">Nenhum produto encontrado.</div>`;
    renderSearchPreviews();
    renderCategoryPanel();
    return;
  }

  grid.innerHTML = items.map(productCardMarkup).join("");
  renderSearchPreviews();
  renderCategoryPanel();
  iconRefresh();
}

function renderRelatedProducts(product) {
  const grid = qs(".related-section [data-product-grid]");
  if (!grid || !product) return;
  const category = normalizeSearch(product.category);
  const candidates = products.filter((item) => item.id !== product.id);
  const sameCategory = homeOrderedProducts(candidates.filter((item) => normalizeSearch(item.category) === category));
  const otherProducts = homeOrderedProducts(candidates.filter((item) => normalizeSearch(item.category) !== category));
  const related = [...sameCategory, ...otherProducts].slice(0, 4);

  grid.innerHTML = related.length
    ? related.map(productCardMarkup).join("")
    : `<div class="cart-empty">Nenhum produto relacionado encontrado.</div>`;
  iconRefresh();
}

let currentSlideIndex = 0;
let slideInterval;
let collectionInterval;
let collectionNormalizeFrame;

function showSlide(index, direction = 'forward') {
  const slides = qsa(".banner-slide");
  const dots = qsa(".slider-controls span");
  if (!slides.length) return;

  const previousSlideIndex = currentSlideIndex;
  currentSlideIndex = (index + slides.length) % slides.length;

  slides.forEach((slide, idx) => {
    slide.classList.remove("active", "prev", "next");
    if (idx === currentSlideIndex) {
      slide.classList.add("active");
    } else {
      if (direction === 'forward') {
        if (idx === previousSlideIndex) slide.classList.add("prev");
        else slide.classList.add("next");
      } else {
        if (idx === previousSlideIndex) slide.classList.add("next");
        else slide.classList.add("prev");
      }
    }
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle("is-active", idx === currentSlideIndex);
  });
}

function startSlideShow() {
  stopSlideShow();
  slideInterval = setInterval(() => {
    showSlide(currentSlideIndex + 1, 'forward');
  }, 6000);
}

function stopSlideShow() {
  if (slideInterval) clearInterval(slideInterval);
}

function initSliderEvents() {
  const prev = qs(".slider-controls button[aria-label='Banner anterior']");
  const next = qs(".slider-controls button[aria-label='Proximo banner']");
  const dots = qsa(".slider-controls span");

  if (prev) {
    prev.onclick = () => {
      showSlide(currentSlideIndex - 1, 'backward');
      startSlideShow();
    };
  }
  if (next) {
    next.onclick = () => {
      showSlide(currentSlideIndex + 1, 'forward');
      startSlideShow();
    };
  }
  dots.forEach((dot, idx) => {
    dot.onclick = () => {
      showSlide(idx);
      startSlideShow();
    };
  });

  startSlideShow();
}

function collectionScrollStep(direction = 1) {
  const track = qs("[data-collection-track]");
  if (!track) return;

  const card = track.querySelector("a");
  const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "14") || 14;
  const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  const target = track.scrollLeft + direction * step;
  const next = direction > 0 && target >= maxScroll - 4
    ? 0
    : direction < 0 && target <= 4
      ? maxScroll
      : target;

  track.scrollTo({ left: Math.max(0, Math.min(next, maxScroll)), behavior: "smooth" });
}

function startCollectionCarousel() {
  const track = qs("[data-collection-track]");
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  stopCollectionCarousel();
  if (!track) return;

  qsa("[data-collection-clone]", track).forEach((clone) => clone.remove());
  track.dataset.loopReady = "";
  track.dataset.loopWidth = "";

  if (!isMobile) {
    track.scrollLeft = 0;
    return;
  }

  collectionInterval = setInterval(() => {
    collectionScrollStep(1);
  }, 4000);
}

function stopCollectionCarousel() {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
  }
}

function renderHomeBanners() {
  const slider = qs(".banner-slider");
  const controls = qs(".slider-controls");
  if (!slider || !controls) return;

  const currentBanners = loadBanners();
  if (!currentBanners.length) {
    slider.innerHTML = "";
    controls.innerHTML = "";
    return;
  }

  slider.innerHTML = currentBanners.map((b, idx) => {
    const hasImage = hasImageValue(b.desktopImage);
    const image = hasImage ? `
      <picture class="banner-picture">
        <source media="(max-width: 768px)" srcset="${assetUrl(b.mobileImage || b.desktopImage || PLACEHOLDER_IMAGE)}">
        <img src="${assetUrl(b.desktopImage || PLACEHOLDER_IMAGE)}" alt="${b.title || "Banner promocional"}" loading="${idx === 0 ? "eager" : "lazy"}" fetchpriority="${idx === 0 ? "high" : "auto"}" />
      </picture>
    ` : "";
    const linkedImage = b.linkUrl ? `<a class="banner-image-link" href="${b.linkUrl}" aria-label="${b.title || "Abrir banner"}">${image}</a>` : image;
    return `
      <div class="banner-slide ${idx === 0 ? "active" : ""} ${hasImage ? "" : "is-empty"}">
        ${linkedImage}
      </div>
    `;
  }).join("");

  let controlsHtml = `<button type="button" aria-label="Banner anterior">‹</button>`;
  currentBanners.forEach((_, idx) => {
    controlsHtml += `<span class="${idx === 0 ? "is-active" : ""}"></span>`;
  });
  controlsHtml += `<button type="button" aria-label="Proximo banner">›</button>`;
  controls.innerHTML = controlsHtml;

  iconRefresh();
  initSliderEvents();
}

function setBackgroundImage(element, image) {
  if (!element) return;
  element.style.backgroundImage = hasImageValue(image) ? `url("${assetUrl(image)}")` : "none";
}

function currentLowerBannerImage() {
  const lowerBanner = siteContent.lowerBanner || defaultSiteContent.lowerBanner;
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  return isMobile
    ? lowerBanner.mobileImage || lowerBanner.desktopImage || PLACEHOLDER_IMAGE
    : lowerBanner.desktopImage || PLACEHOLDER_IMAGE;
}

function renderSiteContent() {
  const lowerBanner = siteContent.lowerBanner || defaultSiteContent.lowerBanner;
  const aboutPhotos = siteContent.aboutPhotos || defaultSiteContent.aboutPhotos;
  const promoLink = qs(".promo-banner-one");
  const promoVisual = qs(".promo-banner-one .visual-loading-slot");
  const aboutPhotoOne = qs(".about-photo-placeholder:not(.about-photo-placeholder-alt)");
  const aboutPhotoTwo = qs(".about-photo-placeholder-alt");

  if (promoLink) {
    promoLink.href = lowerBanner.linkUrl || "#";
  }

  setBackgroundImage(promoVisual, currentLowerBannerImage());
  setBackgroundImage(aboutPhotoOne, aboutPhotos.photoOne);
  setBackgroundImage(aboutPhotoTwo, aboutPhotos.photoTwo);
}

function renderHomeCollections() {
  const track = qs("[data-collection-track]");
  if (!track) return;

  qsa("[data-collection-clone]", track).forEach((clone) => clone.remove());
  track.dataset.loopReady = "";
  track.dataset.loopWidth = "";

  const visibleCollections = normalizeCollections(collections).filter((collection) => collection.name);
  if (!visibleCollections.length) {
    track.innerHTML = `
      <div class="cart-empty">Nenhuma coleção cadastrada.</div>
    `;
    return;
  }

  track.innerHTML = visibleCollections
    .map((collection) => {
      return `
        <a href="${catalogUrl({ collectionId: collection.id, search: "" })}" data-collection-link="${escapeHtml(collection.id)}">
          <img src="${assetUrl(collection.image)}" alt="${escapeHtml(collection.name)}" loading="lazy" />
          <strong>
            <span>${escapeHtml(collection.name)}</span>
            <span class="collection-card-arrow" aria-hidden="true">&rarr;</span>
          </strong>
        </a>
      `;
    })
    .join("");

  iconRefresh();
}


function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function getAvatarBgColor(name) {
  if (!name) return "hsl(200, 30%, 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 45%, 35%)`;
}

function getRelativeDate(review) {
  if (review?.createdAt) {
    const created = new Date(review.createdAt).getTime();
    if (Number.isFinite(created)) {
      const days = Math.max(0, Math.floor((Date.now() - created) / 86400000));
      if (days === 0) return "hoje";
      if (days === 1) return "ontem";
      if (days < 7) return `${days} dias`;
      if (days < 14) return "1 semana";
      if (days < 30) return `${Math.floor(days / 7)} semanas`;
      if (days < 60) return "1 mês";
      if (days < 150) return `${Math.floor(days / 30)} meses`;
      return "5 meses";
    }
  }
  const hash = ((review.name || "").length + (review.text || "").length) % 15;
  if (hash === 0) return "hoje";
  if (hash === 1) return "ontem";
  if (hash < 5) return `${hash} dias`;
  if (hash < 9) return "1 semana";
  if (hash < 12) return "2 semanas";
  return "1 mês";
}

function reviewPaginationMarkup(productId, totalReviews, currentPage) {
  const totalPages = Math.ceil(totalReviews / PRODUCT_REVIEWS_PER_PAGE);
  if (totalPages <= 1) return "";

  const pages = [];
  const pushPage = (page) => {
    if (page >= 1 && page <= totalPages && !pages.includes(page)) pages.push(page);
  };

  pushPage(1);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) pushPage(page);
  pushPage(totalPages);
  pages.sort((a, b) => a - b);

  const buttons = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) {
      buttons.push(`<span class="review-page-gap">...</span>`);
    }
    buttons.push(`
      <button class="${page === currentPage ? "is-active" : ""}" type="button" data-review-product="${escapeHtml(productId)}" data-review-page="${page}" aria-label="Página ${page} de depoimentos">
        ${page}
      </button>
    `);
  });

  return `
    <nav class="review-pagination" aria-label="Paginação de depoimentos">
      <button type="button" data-review-product="${escapeHtml(productId)}" data-review-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? "disabled" : ""} aria-label="Página anterior">
        <i data-lucide="chevron-left" aria-hidden="true"></i>
      </button>
      ${buttons.join("")}
      <button type="button" data-review-product="${escapeHtml(productId)}" data-review-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? "disabled" : ""} aria-label="Próxima página">
        <i data-lucide="chevron-right" aria-hidden="true"></i>
      </button>
    </nav>
  `;
}

function renderProductPage(productId) {
  const page = qs("[data-product-page]");
  const rawProduct = resolveProductReference(productId);

  if (!page) {
    return;
  }

  if (!rawProduct) {
    page.hidden = false;
    document.title = "Produto nao encontrado | Caomisa";
    page.innerHTML = `
      <div class="cart-empty">
        Produto nao encontrado.<br />
        <a class="secondary-button" href="/produtos">Voltar para produtos</a>
      </div>
    `;
    return;
  }

  const product = normalizeProduct(rawProduct);
  const variantModel = productVariantModel(product);
  const firstColor = variantModel.hasColor
    ? (variantModel.colors.find((color) => variantModel.rows.some((row) => row.color === color && row.available)) || variantModel.colors[0] || "")
    : "";
  const firstSize = variantModel.hasColor
    ? firstAvailableSizeForColor(product, firstColor)
    : (product.sizes[0] || "Unico");
  const premium = product.premium;
  const initialPricing = selectedVariantPricing(product, firstSize, firstColor);
  const discount = initialPricing.discount;
  const installment = initialPricing.installment;
  const galleryImages = [...new Set([product.image, ...product.images].filter(Boolean))];
  const stockLabel = "EM ESTOQUE";
  const mainImage = variantModel.hasColor ? colorImageForVariant(product, firstColor) : (galleryImages[0] || PLACEHOLDER_IMAGE);
  const featureBlock = premium.descriptionBlocks[0] || defaultProductPremium(product).descriptionBlocks[0];
  const sizeGuideDesktopImage = premium.sizeGuideDesktopImage || PLACEHOLDER_IMAGE;
  const sizeGuideMobileImage = premium.sizeGuideMobileImage || sizeGuideDesktopImage;

  // Review statistics calculation
  const totalReviews = premium.reviews.length;
  const starsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  premium.reviews.forEach(r => {
    const rounded = Math.round(Number(r.stars || 5));
    if (starsCount[rounded] !== undefined) {
      starsCount[rounded]++;
    }
  });
  const totalReviewPages = Math.max(1, Math.ceil(totalReviews / PRODUCT_REVIEWS_PER_PAGE));
  const requestedReviewPage = Number(reviewPageByProduct.get(product.id) || 1);
  const currentReviewPage = Math.max(1, Math.min(totalReviewPages, requestedReviewPage));
  reviewPageByProduct.set(product.id, currentReviewPage);
  const visibleReviews = premium.reviews.slice(
    (currentReviewPage - 1) * PRODUCT_REVIEWS_PER_PAGE,
    currentReviewPage * PRODUCT_REVIEWS_PER_PAGE
  );

  page.hidden = false;
  document.title = `${product.name} | Caomisa`;

  page.innerHTML = `
    <div class="dufins-product-shell" data-detail="${product.id}">
      <div class="dufins-product-media" aria-label="Galeria do produto">
        <figure class="dufins-main-media">
          <button class="dufins-zoom-button" type="button" data-product-zoom aria-label="Ampliar foto do produto">
            <i data-lucide="zoom-in" aria-hidden="true"></i>
          </button>
          <img id="main-product-image" src="${assetUrl(mainImage)}" alt="${escapeHtml(product.name)} - foto principal" loading="eager" />
        </figure>
        <div class="dufins-thumb-carousel">
          <button class="dufins-thumb-nav" type="button" data-thumb-scroll="-1" aria-label="Fotos anteriores">
            <i data-lucide="chevron-left" aria-hidden="true"></i>
          </button>
          <div class="dufins-thumb-row" data-thumb-row aria-label="Selecionar foto do produto">
            ${galleryImages.map((img, idx) => `
              <button class="dufins-thumb-btn thumb-btn ${idx === 0 ? "is-active" : ""}" type="button" data-thumb="${escapeHtml(img)}" aria-label="Ver foto ${idx + 1} de ${escapeHtml(product.name)}">
                <img src="${assetUrl(img)}" alt="" loading="${idx < 4 ? "eager" : "lazy"}" />
              </button>
            `).join("")}
          </div>
          <button class="dufins-thumb-nav" type="button" data-thumb-scroll="1" aria-label="Próximas fotos">
            <i data-lucide="chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="dufins-product-info-stack">
        <aside class="dufins-buy-panel" aria-label="Informacoes de compra">
          <div class="dufins-proof-row">
            <span>${escapeHtml(premium.soldCount)}</span>
            <span>ORIGINAL</span>
            <span>${stockLabel}</span>
          </div>

          <h1>${escapeHtml(product.name)}</h1>
          <span class="dufins-title-link">Coleção ${escapeHtml(product.category)}</span>

          <div class="product-rating-row dufins-rating-row">
            <span class="stars">${renderStars(premium.rating)}</span>
            <strong>${Number(premium.rating).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong>
            <a href="#avaliacoes">${Number(premium.reviewCount || premium.reviews.length)} avaliacoes</a>
          </div>

          <div class="dufins-price-box" data-detail-price>
            <div class="dufins-compare-line" data-detail-compare-line>
              ${initialPricing.oldPrice ? `<span>De <s>${money(initialPricing.oldPrice)}</s></span>` : "<span>Oferta especial</span>"}
              ${discount ? `<em>${discount}% OFF</em>` : ""}
            </div>
            <strong data-detail-price-current>${money(initialPricing.price)}</strong>
            <p data-detail-installment>em até 12x de ${money(installment)} sem juros</p>
          </div>

          ${variantModel.hasColor ? `
          <div class="dufins-option-group dufins-color-option-group">
            <div class="dufins-option-heading">
              <span>Cor - <strong data-selected-color-label>${escapeHtml(firstColor)}</strong></span>
            </div>
            <div class="dufins-color-options" data-detail-colors>
              ${variantModel.colors.map((color) => {
                const image = colorImageForVariant(product, color);
                const isAvailable = variantModel.rows.some((row) => row.color === color && row.available);
                return `
                  <button type="button" class="${color === firstColor ? "is-active" : ""}" data-color="${escapeHtml(color)}" data-color-image="${escapeHtml(image)}" style="${swatchStyle(color)}" ${isAvailable ? "" : "disabled"}>
                    <span class="dufins-color-swatch" aria-hidden="true"></span>
                    <span>${escapeHtml(color)}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
          ` : ""}

          <div class="dufins-option-group">
            <div class="dufins-option-heading">
              <span>Tamanho - <strong data-selected-size-label>${escapeHtml(firstSize)}</strong></span>
            </div>
            <div class="size-options dufins-size-options" data-detail-sizes>
              ${variantModel.sizes.map((size, index) => {
                const isAvailable = !variantModel.hasColor || Boolean(findVariantSku(product, { color: firstColor, size, exact: true }));
                const isActive = variantModel.hasColor ? size === firstSize : index === 0;
                return `
                <button type="button" class="${isActive ? "is-active" : ""}" data-size="${escapeHtml(size)}" ${isAvailable ? "" : "disabled"}>${escapeHtml(size)}</button>
              `;
              }).join("")}
            </div>
            <button class="dufins-size-guide" type="button" data-size-guide-open>
              <span>
                <i data-lucide="ruler" aria-hidden="true"></i>
                Guia de tamanhos
              </span>
              <i data-lucide="chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="dufins-correios-box">
            <img src="/assets/correios-logo.svg" alt="Correios" loading="lazy" />
            <div>
              <strong>Frete Grátis</strong>
              <span>para a sua região</span>
            </div>
          </div>
          <input value="1" hidden data-detail-qty aria-label="Quantidade" />

          <div class="detail-actions dufins-detail-actions">
            <button class="primary-button dufins-buy-button" type="button" data-detail-add="${product.id}">
              COMPRAR AGORA
            </button>
          </div>

          <div class="dufins-benefit-list">
            <div>
              <i data-lucide="shield-check" aria-hidden="true"></i>
              <span>Garantia inclusa</span>
            </div>
            <div>
              <i data-lucide="refresh-cw" aria-hidden="true"></i>
              <span>Troca facilitada</span>
            </div>
            <div>
              <i data-lucide="heart" aria-hidden="true"></i>
              <span>Confortável para pets</span>
            </div>
          </div>

          <div class="dufins-payment-stack" aria-label="Formas de pagamento">
            <span class="dufins-mercado-badge">
              <img class="dufins-mercado-pago" src="/assets/mercado-pago.webp" alt="Mercado Pago" loading="lazy" />
            </span>
            <img class="dufins-payment-methods" src="/assets/payment-methods-new.webp" alt="Visa, Mastercard, American Express, Discover, Pix, Diners Club e Elo" loading="lazy" />
          </div>
        </aside>

        <figure class="dufins-product-detail-image">
          <img src="${assetUrl(featureBlock.image)}" alt="${escapeHtml(featureBlock.title)}" loading="lazy" />
        </figure>
      </div>

      <div class="dufins-mobile-sticky-buy" data-sticky-buy aria-hidden="true">
        <div class="dufins-sticky-product-summary">
          <img src="${assetUrl(mainImage)}" alt="" loading="lazy" />
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span class="dufins-sticky-price-row">
              <s data-sticky-price-old ${initialPricing.oldPrice ? "" : "hidden"}>${initialPricing.oldPrice ? money(initialPricing.oldPrice) : ""}</s>
              <b data-sticky-price-current>${money(initialPricing.price)}</b>
              <em data-sticky-discount ${discount ? "" : "hidden"}>${discount ? `-${discount}%` : ""}</em>
            </span>
          </div>
        </div>
        <button type="button" data-detail-add="${product.id}">COMPRAR AGORA</button>
      </div>

      <div class="product-zoom-modal" data-product-zoom-modal hidden>
        <button class="product-zoom-backdrop" type="button" data-zoom-close aria-label="Fechar zoom"></button>
        <figure class="product-zoom-frame">
          <button class="product-zoom-close" type="button" data-zoom-close aria-label="Fechar zoom">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
          <img data-product-zoom-image src="${assetUrl(mainImage)}" alt="${escapeHtml(product.name)} ampliado" />
        </figure>
      </div>

      ${personalizationModalMarkup(product)}

      <div class="size-guide-modal" data-size-guide-modal hidden>
        <button class="size-guide-backdrop" type="button" data-size-guide-close aria-label="Fechar guia de tamanhos"></button>
        <section class="size-guide-dialog" role="dialog" aria-modal="true" aria-label="Guia de tamanhos">
          <button class="size-guide-close" type="button" data-size-guide-close aria-label="Fechar guia de tamanhos">
            <i data-lucide="x" aria-hidden="true"></i>
            Fechar
          </button>
          <picture>
            <source media="(max-width: 760px)" srcset="${assetUrl(sizeGuideMobileImage)}" />
            <img src="${assetUrl(sizeGuideDesktopImage)}" alt="Tabela de tamanhos Caomisa para cachorro" />
          </picture>
        </section>
      </div>
    </div>

    <section class="product-reviews-section dufins-reviews-section" id="avaliacoes">
      <div class="dufins-reviews-header">
        <h2>Avaliações de Clientes</h2>
      </div>

      <div class="dufins-review-layout">
        <div class="dufins-review-summary">
          <strong>${Number(premium.rating).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<small>/5</small></strong>
          <span class="stars">${renderStars(premium.rating)}</span>
          <p>A partir de ${totalReviews} avaliaç${totalReviews === 1 ? "ão" : "ões"}</p>
        </div>

        <div class="dufins-review-bars" aria-label="Distribuição das avaliações">
          ${[5, 4, 3, 2, 1].map(starsNum => {
            const count = starsCount[starsNum];
            const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return `
              <div class="review-bar-row">
                <span class="bar-label">${starsNum} <i data-lucide="star" aria-hidden="true"></i></span>
                <div class="bar-track">
                  <div class="bar-fill" style="width: ${percent}%"></div>
                </div>
                <span class="bar-percent">${count}</span>
              </div>
            `;
          }).join("")}
        </div>

        <div class="dufins-review-action">
          <button class="dufins-review-toggle" type="button" data-review-toggle aria-controls="review-form-${escapeHtml(product.id)}" aria-expanded="false">
            Escreva uma avaliação
          </button>
        </div>

        <form class="review-submit-card-new dufins-review-inline-form" id="review-form-${escapeHtml(product.id)}" data-review-form data-review-form-panel data-product-id="${product.id}" hidden>
            <div class="review-submit-fields">
              <label class="form-group full-field">
                <span class="field-label">Seu nome</span>
                <input name="reviewerName" placeholder="Seu nome" required />
              </label>

              <label class="form-group full-field">
                <span class="field-label">Email</span>
                <input name="reviewerEmail" type="email" placeholder="Seu email" required />
              </label>

              <div class="rating-select-container full-field">
                <span class="rating-label">Sua avaliação</span>
                <input type="hidden" name="reviewStars" value="0" />
                <div class="star-rating-buttons" data-rating-buttons>
                  <button type="button" class="star-select-btn" data-star-value="1" aria-label="1 estrela"><i data-lucide="star"></i></button>
                  <button type="button" class="star-select-btn" data-star-value="2" aria-label="2 estrelas"><i data-lucide="star"></i></button>
                  <button type="button" class="star-select-btn" data-star-value="3" aria-label="3 estrelas"><i data-lucide="star"></i></button>
                  <button type="button" class="star-select-btn" data-star-value="4" aria-label="4 estrelas"><i data-lucide="star"></i></button>
                  <button type="button" class="star-select-btn" data-star-value="5" aria-label="5 estrelas"><i data-lucide="star"></i></button>
                </div>
                <span class="review-rating-value" data-review-rating-value>0/5</span>
              </div>

              <label class="review-photo-field full-field">
                <input name="reviewPhotoFile" type="file" accept="image/*" data-review-photo-input />
                <input name="reviewImage" type="hidden" />
                <span>
                  <i data-lucide="upload" aria-hidden="true"></i>
                  Escolher imagens
                </span>
                <img data-review-photo-preview alt="Prévia da foto do depoimento" hidden />
              </label>

              <label class="form-group full-field">
                <textarea name="reviewText" rows="5" placeholder="Digite seu comentário" required></textarea>
              </label>

              <button class="primary-button submit-review-btn" type="submit">
                Enviar revisão
              </button>
            </div>
        </form>

        <div class="dufins-review-feed">
          <div class="product-review-grid">
            ${visibleReviews.map((review) => `
              <article class="product-review-card ${review.image ? "has-photo" : ""}">
                <div class="review-card-header">
                  <div>
                    <strong>${escapeHtml(review.name)}</strong>
                    <span>Compra verificada <i data-lucide="badge-check" aria-hidden="true"></i></span>
                  </div>
                  <small>Há ${getRelativeDate(review)}</small>
                </div>
                <div class="review-meta-row">
                  <span class="stars">${renderStars(review.stars)}</span>
                </div>
                <p class="review-card-text">${escapeHtml(review.text)}</p>
                ${review.image ? `
                  <figure class="review-photo">
                    <img src="${assetUrl(review.image)}" alt="Foto enviada por ${escapeHtml(review.name)}" loading="lazy" />
                  </figure>
                ` : ""}
              </article>
            `).join("")}
          </div>
          ${reviewPaginationMarkup(product.id, totalReviews, currentReviewPage)}
        </div>
      </div>
    </section>
  `;
  renderRelatedProducts(product);
  iconRefresh();
  setupStickyBuyObserver();
  updateDetailVariantState(qs("[data-detail]"), product);
}

let stickyBuyObserver = null;
let stickyBuyCleanup = null;

function setupStickyBuyObserver() {
  if (stickyBuyObserver) {
    stickyBuyObserver.disconnect();
    stickyBuyObserver = null;
  }
  if (stickyBuyCleanup) {
    stickyBuyCleanup();
    stickyBuyCleanup = null;
  }

  const stickyBuy = qs("[data-sticky-buy]");
  const mainBuyButton = qs(".dufins-detail-actions .dufins-buy-button");
  if (!stickyBuy || !mainBuyButton) return;

  const setVisible = (visible) => {
    stickyBuy.classList.toggle("is-visible", visible);
    stickyBuy.setAttribute("aria-hidden", String(!visible));
  };

  setVisible(false);

  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = mainBuyButton.getBoundingClientRect();
    setVisible(rect.bottom <= 0);
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  document.addEventListener("visibilitychange", scheduleUpdate);

  stickyBuyCleanup = () => {
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    document.removeEventListener("visibilitychange", scheduleUpdate);
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  update();
}

function route() {
  const page = qs("[data-product-page]");
  const pathMatch = window.location.pathname.match(/^\/produto\/([^/]+)\/?$/);

  if (pathMatch && page) {
    const routeParam = decodeURIComponent(pathMatch[1]);
    const product = resolveProductReference(routeParam);
    if (product) {
      const cleanUrl = productUrl(product);
      if (window.location.pathname !== cleanUrl) {
        window.history.replaceState(null, "", `${cleanUrl}${window.location.hash || ""}`);
      }
      renderProductPage(product.id);
    } else {
      renderProductPage(routeParam);
    }
    return;
  }

  const hash = window.location.hash || "#inicio";
  const productMatch = hash.match(/^#produto\/(.+)$/);

  if (productMatch && page) {
    const product = resolveProductReference(productMatch[1]);
    const cleanUrl = product ? productUrl(product) : `/produto/${productMatch[1]}`;
    window.history.replaceState(null, "", cleanUrl);
    renderProductPage(product ? product.id : productMatch[1]);
    return;
  }

  if (page) {
    page.hidden = true;
  }
}

function addToCart(productId, size, quantity = 1, color = "", image = "", customization = null) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const selectedSize = size || product.sizes[0] || "Unico";
  const selectedColor = normalizeVariantText(color);
  const yampiSku = yampiSkuForSize(product, selectedSize, selectedColor);
  if (product.yampi?.skus?.length && !yampiSku?.token) {
    showToast("Essa combinação ainda nao tem checkout configurado.");
    return;
  }
  const variantImage = image || (selectedColor ? colorImageForVariant(product, selectedColor) : product.image);
  const customName = sanitizeCustomizationName(customization?.name || "");
  const customNumber = sanitizeCustomizationNumber(customization?.number || "");
  const normalizedCustomization = customName && customNumber ? { name: customName, number: customNumber } : null;
  const customKey = normalizedCustomization ? `${customName.toLowerCase()}:${customNumber}` : "sem-personalizacao";
  const key = `${product.id}:${selectedColor || "sem-cor"}:${selectedSize}:${customKey}`;
  const existing = cart.find((item) => item.key === key);

  if (existing) {
    existing.quantity += quantity;
    existing.image = variantImage || existing.image || product.image;
    existing.customization = normalizedCustomization || existing.customization || null;
  } else {
    cart.push({
      key,
      productId: product.id,
      size: selectedSize,
      color: selectedColor,
      image: variantImage || product.image,
      customization: normalizedCustomization,
      quantity,
      price: yampiSku?.price || product.price,
      yampiSkuId: yampiSku?.id || "",
      yampiToken: yampiSku?.token || "",
      yampiPurchaseUrl: yampiSku?.purchaseUrl || ""
    });
  }

  saveCart();
  renderCart();
}

function cartLines() {
  return cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      const sku = yampiSkuForSize(product, item.size, item.color);
      const image = item.image || (item.color ? colorImageForVariant(product, item.color) : product?.image);
      const customization = item.customization?.name && item.customization?.number
        ? {
            name: sanitizeCustomizationName(item.customization.name),
            number: sanitizeCustomizationNumber(item.customization.number)
          }
        : null;
      return product ? { ...item, product, sku, image, customization, unitPrice: item.price || sku?.price || product.price } : null;
    })
    .filter(Boolean);
}

function cartTotal() {
  return cartLines().reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

function renderCart() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const countEl = qs("[data-cart-count]");
  const totalEl = qs("[data-cart-total]");
  const itemsEl = qs("[data-cart-items]");

  if (countEl) countEl.textContent = String(count);
  if (totalEl) totalEl.textContent = money(cartTotal());
  if (!itemsEl) return;

  const lines = cartLines();
  if (!lines.length) {
    itemsEl.innerHTML = `<div class="cart-empty">O carrinho esta vazio.<br />Adicione uma roupinha para continuar.</div>`;
    return;
  }

  itemsEl.innerHTML = lines
    .map(
      (item) => `
        <article class="cart-item">
          <img src="${assetUrl(item.image || item.product.image)}" alt="${item.product.name}" />
          <div>
            <h3>${item.product.name}</h3>
            <p>${item.color ? `Cor ${escapeHtml(item.color)} - ` : ""}Tamanho ${escapeHtml(item.size)} - ${money(item.unitPrice)}</p>
            ${item.customization ? `
              <div class="cart-personalization">
                <span>Nome: <strong>${escapeHtml(item.customization.name)}</strong></span>
                <span>Número: <strong>${escapeHtml(item.customization.number)}</strong></span>
              </div>
            ` : ""}
            <div class="cart-row">
              <div class="mini-stepper">
                <button type="button" data-cart-minus="${item.key}" aria-label="Diminuir">-</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-plus="${item.key}" aria-label="Aumentar">+</button>
              </div>
              <button class="remove-item" type="button" data-cart-remove="${item.key}">Remover</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function openCart() {
  const drawer = qs("[data-cart-drawer]");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function closeCart() {
  const drawer = qs("[data-cart-drawer]");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function changeCartQty(key, delta) {
  const item = cart.find((entry) => entry.key === key);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((entry) => entry.key !== key);
  }

  saveCart();
  renderCart();
}

function removeCartItem(key) {
  cart = cart.filter((entry) => entry.key !== key);
  saveCart();
  renderCart();
}

function addProductReview(productId, review) {
  const index = products.findIndex((item) => item.id === productId);
  if (index < 0) return;

  const product = normalizeProduct(products[index]);
  const reviews = normalizeReviews([review, ...product.premium.reviews]);
  product.premium.reviews = reviews;
  product.premium.reviewCount = reviews.length;
  product.premium.rating = reviews.reduce((sum, item) => sum + Number(item.stars || 0), 0) / reviews.length;
  products[index] = product;
  saveProducts();
  renderProductPage(productId);
  showToast("Depoimento enviado. Obrigado!");
}

async function submitProductReview(productId, review) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Nao foi possivel enviar o depoimento.");
  }
  return data;
}

function setCheckoutLoading(button, loading) {
  const checkoutButton = button || qs("[data-checkout]");
  if (!checkoutButton) return;

  if (loading) {
    checkoutButton.dataset.originalHtml = checkoutButton.innerHTML;
    checkoutButton.disabled = true;
    checkoutButton.classList.add("is-loading");
    checkoutButton.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>Redirecionando</span>`;
    return;
  }

  checkoutButton.disabled = false;
  checkoutButton.classList.remove("is-loading");
  if (checkoutButton.dataset.originalHtml) {
    checkoutButton.innerHTML = checkoutButton.dataset.originalHtml;
    delete checkoutButton.dataset.originalHtml;
    iconRefresh();
  }
}

async function checkout(button) {
  const lines = cartLines();
  if (!lines.length) {
    showToast("Adicione um produto antes de finalizar.");
    return;
  }

  const yampiItems = yampiCheckoutItems(lines);
  const checkoutMetadata = checkoutMetadataFromLines(lines);
  const hasYampiProducts = yampiItems.some((item) => item.token);
  const missingYampiToken = lines.some((line, index) => line.product.yampi?.skus?.length && !yampiItems[index]?.token);

  if (missingYampiToken) {
    showToast("Tem produto sem checkout configurado nesse tamanho.");
    return;
  }

  if (hasYampiProducts) {
    setCheckoutLoading(button, true);
    try {
      const hasMetadata = Object.keys(checkoutMetadata).length > 0;
      const directUrl = !hasMetadata && yampiItems.length === 1 ? yampiDirectCheckoutUrl(yampiItems[0]) : "";
      if (directUrl) {
        window.location.assign(directUrl);
        return;
      }

      const response = await fetch("/api/yampi/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: yampiItems, metadata: checkoutMetadata })
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || "Erro ao criar checkout.");
      }
      window.location.assign(data.url);
      return;
    } catch (error) {
      console.error(error);
      setCheckoutLoading(button, false);
      showToast(error.message || "Erro ao abrir checkout.");
      return;
    }
  }

  setCheckoutLoading(button, true);
  const summary = lines
    .map((item) => {
      const custom = item.customization ? ` | Nome ${item.customization.name} | Numero ${item.customization.number}` : "";
      return `${item.quantity}x ${item.product.name} (${item.color ? `${item.color} / ` : ""}${item.size}${custom}) - ${money(item.unitPrice * item.quantity)}`;
    })
    .join("%0A");
  const text = `Ola, quero finalizar meu pedido Caomisa:%0A${summary}%0ATotal: ${money(cartTotal())}`;
  window.location.assign(`https://wa.me/5534998703201?text=${text}`);
}

function showToast(message) {
  const toast = qs("[data-toast]");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function showSyncStatus(status, text) {
  const indicator = document.getElementById("admin-sync-indicator");
  const textEl = document.getElementById("admin-sync-text");
  if (!indicator || !textEl) return;

  indicator.classList.add("visible");
  indicator.classList.remove("saving", "saved", "error");
  indicator.classList.add(status);
  textEl.textContent = text;

  if (status === "saved") {
    if (indicator._hideTimeout) clearTimeout(indicator._hideTimeout);
    indicator._hideTimeout = setTimeout(() => {
      if (indicator.classList.contains("saved")) {
        indicator.classList.remove("visible");
      }
    }, 3000);
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function setProductMainMedia(image) {
  if (!image) return;
  const mainImg = document.getElementById("main-product-image");
  if (mainImg) mainImg.src = assetUrl(image);
  const stickyImg = qs(".dufins-sticky-product-summary img");
  if (stickyImg) stickyImg.src = assetUrl(image);
  const zoomImage = qs("[data-product-zoom-image]");
  if (zoomImage) zoomImage.src = assetUrl(image);
  qsa(".thumb-btn").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.thumb === image));
}

function updateDetailVariantState(shell, product, options = {}) {
  if (!shell || !product) return;
  const { notifyUnavailable = false } = options;
  const colorButton = qs("[data-detail-colors] .is-active", shell);
  const selectedColor = colorButton?.dataset.color || "";
  const model = productVariantModel(product);
  const sizeButtons = qsa("[data-detail-sizes] button", shell);
  let activeSizeButton = qs("[data-detail-sizes] .is-active", shell);
  let invalidatedSize = "";

  sizeButtons.forEach((button) => {
    const available = !model.hasColor || Boolean(findVariantSku(product, {
      color: selectedColor,
      size: button.dataset.size,
      exact: true
    }));
    button.disabled = !available;
    button.classList.toggle("is-disabled", !available);
    if (!available && button.classList.contains("is-active")) {
      invalidatedSize = button.dataset.size || button.textContent || "";
      button.classList.remove("is-active");
      activeSizeButton = null;
    }
  });

  const sizeLabel = qs("[data-selected-size-label]", shell);
  if (sizeLabel) {
    sizeLabel.textContent = activeSizeButton && !activeSizeButton.disabled
      ? activeSizeButton.dataset.size || activeSizeButton.textContent
      : "selecione";
  }

  const colorLabel = qs("[data-selected-color-label]", shell);
  if (colorLabel && selectedColor) colorLabel.textContent = selectedColor;

  if (notifyUnavailable && invalidatedSize) {
    showToast(`A cor ${selectedColor} nao tem tamanho ${invalidatedSize}. Selecione outro tamanho.`);
  }

  updateDetailPrice(shell, product);

  const buyButtons = qsa("[data-detail-add]", shell);
  const hasSelectedSize = Boolean(activeSizeButton && !activeSizeButton.disabled);
  const hasSku = hasSelectedSize && (!product.yampi?.skus?.length || (model.hasColor
    ? Boolean(findVariantSku(product, { color: selectedColor, size: activeSizeButton?.dataset.size, exact: true }))
    : Boolean(findVariantSku(product, { size: activeSizeButton?.dataset.size, exact: true }))));
  buyButtons.forEach((button) => {
    button.disabled = !hasSku;
    button.textContent = hasSku ? "COMPRAR AGORA" : "SELECIONE UM TAMANHO";
  });
}

let selectedMainImage = PLACEHOLDER_IMAGE;
let selectedGalleryImages = [PLACEHOLDER_IMAGE];
let productMediaDirty = false;
let adminVariantProduct = null;
let adminVariantConfig = normalizeVariantConfig();

function getAvailablePhotos() {
  return [...new Set([selectedMainImage, ...selectedGalleryImages].filter(Boolean))];
}

function renderVariantImagePicker(color, photos = []) {
  const currentImage = adminVariantConfig.colorImages[color] || "";
  const mainImage = selectedMainImage || photos[0] || PLACEHOLDER_IMAGE;
  const choices = [
    {
      value: "",
      image: mainImage,
      label: "Principal",
      title: `Usar foto principal para ${color}`
    },
    ...photos.map((photo, index) => ({
      value: photo,
      image: photo,
      label: String(index + 1),
      title: `Usar foto ${index + 1} para ${color}`
    }))
  ];

  return `
    <div class="variant-image-picker" role="group" aria-label="Foto ao clicar na cor ${escapeHtml(color)}">
      ${choices.map((choice) => {
        const isSelected = currentImage === choice.value;
        return `
          <button
            type="button"
            class="variant-image-choice ${isSelected ? "is-active" : ""}"
            data-variant-image-pick="${escapeHtml(color)}"
            data-variant-image-value="${escapeHtml(choice.value)}"
            aria-pressed="${isSelected ? "true" : "false"}"
            title="${escapeHtml(choice.title)}"
          >
            <span class="variant-image-choice-thumb">
              <img src="${assetUrl(choice.image)}" alt="" loading="lazy" />
            </span>
            <span>${escapeHtml(choice.label)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function parseVariantConfigJson(value = "") {
  try {
    return normalizeVariantConfig(JSON.parse(String(value || "{}")));
  } catch {
    return normalizeVariantConfig();
  }
}

function syncVariantConfigInput(form = qs("[data-product-form]")) {
  const input = form?.elements.variantConfig;
  if (!input) return;
  input.value = JSON.stringify(normalizeVariantConfig(adminVariantConfig));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderVariantMatrixEditor(product = adminVariantProduct, form = qs("[data-product-form]")) {
  const section = qs("[data-variant-editor]");
  const matrix = qs("[data-variant-matrix]");
  if (!section || !matrix || !form) return;

  const normalizedProduct = product ? normalizeProduct({
    ...product,
    image: selectedMainImage || product.image,
    images: selectedGalleryImages.length ? selectedGalleryImages : product.images,
    variantConfig: adminVariantConfig
  }) : null;
  adminVariantProduct = normalizedProduct;
  const model = normalizedProduct ? productVariantModel(normalizedProduct) : { hasColor: false, colors: [], sizes: [], rows: [] };
  syncVariantConfigInput(form);

  if (!normalizedProduct || !model.hasColor) {
    section.hidden = true;
    matrix.innerHTML = "";
    return;
  }

  section.hidden = false;
  const photos = getAvailablePhotos();
  Object.keys(adminVariantConfig.colorImages).forEach((color) => {
    if (!photos.includes(adminVariantConfig.colorImages[color])) delete adminVariantConfig.colorImages[color];
  });
  syncVariantConfigInput(form);
  matrix.innerHTML = `
    <table class="variant-matrix-table">
      <thead>
        <tr>
          <th>Cor</th>
          <th>Foto ao clicar</th>
          ${model.sizes.map((size) => `<th>${escapeHtml(size)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${model.colors.map((color) => `
          <tr>
            <th>
              <span class="variant-color-label">
                <span class="dufins-color-swatch" style="${swatchStyle(color)}" aria-hidden="true"></span>
                ${escapeHtml(color)}
              </span>
            </th>
            <td>
              ${renderVariantImagePicker(color, photos)}
            </td>
            ${model.sizes.map((size) => {
              const hasSku = model.rows.some((row) => row.color === color && row.size === size);
              const checked = hasSku && !adminVariantConfig.disabled[color]?.[size];
              return `
                <td>
                  <label class="variant-availability-check ${hasSku ? "" : "is-missing"}" title="${hasSku ? "Disponível no site" : "Não existe na Yampi"}">
                    <input type="checkbox" data-variant-availability data-variant-color="${escapeHtml(color)}" data-variant-size="${escapeHtml(size)}" ${checked ? "checked" : ""} ${hasSku ? "" : "disabled"} />
                    <span></span>
                  </label>
                </td>
              `;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  iconRefresh();
}

function renderPhotoSelector() {
  const grid = document.getElementById("admin-photo-selector-grid");
  if (!grid) return;

  selectedGalleryImages = [...new Set(selectedGalleryImages.filter(Boolean))];
  if (!selectedMainImage && selectedGalleryImages.length) {
    selectedMainImage = selectedGalleryImages[0];
  }
  if (selectedMainImage && !selectedGalleryImages.includes(selectedMainImage)) {
    selectedGalleryImages.unshift(selectedMainImage);
  }

  const photos = getAvailablePhotos();
  if (!photos.length) {
    grid.innerHTML = `<div class="photo-selector-empty">Nenhuma foto adicionada neste produto ainda.</div>`;
  } else {
    grid.innerHTML = photos.map(photo => {
    const isSelected = selectedGalleryImages.includes(photo);
    const isMain = selectedMainImage === photo;
    return `
      <div class="photo-card ${isSelected ? 'is-selected' : ''} ${isMain ? 'is-main' : ''}" data-photo-url="${photo}">
        <div class="photo-card-main-badge">Principal</div>
        <div class="photo-card-actions">
          <button type="button" class="photo-card-star" aria-label="Definir como principal" data-star-url="${photo}" title="Definir como principal">
            <i data-lucide="star" aria-hidden="true"></i>
          </button>
          <button type="button" class="photo-card-remove" aria-label="Remover foto" data-photo-remove="${photo}" title="Remover foto">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <img src="${assetUrl(photo)}" alt="Foto do Produto" />
      </div>
    `;
    }).join("");
  }

  iconRefresh();

  // Update inputs
  const mainInput = document.getElementById("product-main-image-input");
  const galleryInput = document.getElementById("product-images-input");
  if (mainInput) {
    mainInput.value = selectedMainImage || "";
    mainInput.dispatchEvent(new Event("input", { bubbles: true }));
    mainInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (galleryInput) {
    galleryInput.value = selectedGalleryImages.join(", ");
    galleryInput.dispatchEvent(new Event("input", { bubbles: true }));
    galleryInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const preview = document.getElementById("edit-main-image-preview");
  if (preview) preview.src = assetUrl(selectedMainImage || PLACEHOLDER_IMAGE);
  renderVariantMatrixEditor();
}

function clearProductPhotos({ dirty = true } = {}) {
  selectedMainImage = PLACEHOLDER_IMAGE;
  selectedGalleryImages = [PLACEHOLDER_IMAGE];
  productMediaDirty = dirty;
  renderPhotoSelector();
}

function updateAdminMetrics() {
  const totalProductsEl = document.getElementById("metric-total-products");
  const totalCategoriesEl = document.getElementById("metric-total-categories");
  const totalStockEl = document.getElementById("metric-total-stock");
  const pendingReviewsEl = document.getElementById("metric-pending-reviews");

  if (totalProductsEl) totalProductsEl.textContent = String(products.length);

  if (totalCategoriesEl) {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    totalCategoriesEl.textContent = String(categories.size);
  }

  if (totalStockEl) {
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    totalStockEl.textContent = String(totalStock);
  }

  if (pendingReviewsEl) {
    pendingReviewsEl.textContent = String(reviewModeration.filter((review) => review.status === "pending").length);
  }
}

function renderAdminCategories() {
  const list = document.getElementById("admin-category-list");
  const dataList = document.getElementById("category-options");
  const categoryItems = getCategories();

  if (dataList) {
    dataList.innerHTML = categoryItems.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("");
  }

  if (list) {
    list.innerHTML = categoryItems.map((category) => `
      <button type="button" class="admin-category-chip" data-pick-category="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>
    `).join("");
  }
}

function selectedCollectionProductIds(form = document.getElementById("admin-collection-form")) {
  if (!form) return [];
  return qsa("[data-collection-product]:checked", form)
    .map((input) => input.dataset.collectionProduct)
    .filter(Boolean);
}

function renderCollectionProductChoices(selectedIds = []) {
  const grid = document.querySelector("[data-collection-products]");
  if (!grid) return;
  const selected = new Set(selectedIds);

  if (!products.length) {
    grid.innerHTML = `
      <div class="admin-empty-state compact">
        <strong>Nenhum produto sincronizado</strong>
        <p>Sincronize a Yampi antes de montar suas coleções.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products
    .map((product) => `
      <label class="collection-product-choice">
        <input type="checkbox" data-collection-product="${escapeHtml(product.id)}" ${selected.has(product.id) ? "checked" : ""} />
        <img src="${assetUrl(product.image)}" alt="${escapeHtml(product.name)}" />
        <span>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(product.category)} - ${money(product.price)}</small>
        </span>
      </label>
    `)
    .join("");
}

function collectionFromForm(form) {
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const existingId = String(formData.get("id") || "").trim();
  return normalizeCollection({
    id: existingId || slugify(name),
    name,
    image: String(formData.get("image") || "").trim() || PLACEHOLDER_IMAGE,
    sourceCategory: String(formData.get("sourceCategory") || "").trim() || name,
    productIds: selectedCollectionProductIds(form),
    sortOrder: Number(formData.get("sortOrder") || collections.length)
  });
}

function resetCollectionForm() {
  const form = document.getElementById("admin-collection-form");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.image.value = PLACEHOLDER_IMAGE;
  form.elements.sourceCategory.value = "";
  form.elements.sortOrder.value = String(collections.length);
  const fileInput = document.getElementById("collection-image-file");
  if (fileInput) fileInput.value = "";
  const preview = document.getElementById("collection-image-preview");
  if (preview) preview.src = assetUrl(PLACEHOLDER_IMAGE);
  const alertEl = document.getElementById("collection-edit-mode-alert");
  if (alertEl) alertEl.style.display = "none";
  renderCollectionProductChoices([]);
}

function fillCollectionForm(collection) {
  const form = document.getElementById("admin-collection-form");
  if (!form) return;
  const normalized = normalizeCollection(collection);
  const fileInput = document.getElementById("collection-image-file");
  if (fileInput) fileInput.value = "";
  form.elements.id.value = normalized.id;
  form.elements.name.value = normalized.name;
  form.elements.image.value = normalized.image;
  form.elements.sourceCategory.value = normalized.sourceCategory || "";
  form.elements.sortOrder.value = String(normalized.sortOrder || 0);
  const preview = document.getElementById("collection-image-preview");
  if (preview) preview.src = assetUrl(normalized.image);
  const alertEl = document.getElementById("collection-edit-mode-alert");
  const nameEl = document.getElementById("admin-editing-collection-name");
  if (alertEl) alertEl.style.display = "flex";
  if (nameEl) nameEl.textContent = normalized.name;
  renderCollectionProductChoices(normalized.productIds);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function saveCollection(collection, { reset = true } = {}) {
  if (!collection.name) {
    if (reset) showToast("Digite o nome da coleção.");
    return;
  }

  const previousCollections = collections.slice();
  try {
    const existingIndex = collections.findIndex((item) => item.id === collection.id);
    if (existingIndex >= 0) {
      collections[existingIndex] = collection;
    } else {
      let id = collection.id;
      let suffix = 2;
      while (collections.some((item) => item.id === id)) {
        id = `${collection.id}-${suffix}`;
        suffix += 1;
      }
      collections.push({ ...collection, id });
    }

    collections = normalizeCollections(collections);
    await persistCollections();
  } catch (error) {
    collections = previousCollections;
    throw error;
  }

  renderHomeCollections();
  renderAdminCollections();
  renderProducts();
  if (reset) {
    resetCollectionForm();
    showToast("Coleção salva.");
  }
}

async function deleteCollection(collectionId) {
  const collection = collectionById(collectionId);
  if (!collection) return;
  const confirmed = window.confirm(`Excluir a coleção "${collection.name}"?`);
  if (!confirmed) return;

  const previousCollections = collections.slice();
  const previousActiveCollectionId = activeCollectionId;
  try {
    collections = collections.filter((item) => item.id !== collection.id);
    if (activeCollectionId === collection.id) activeCollectionId = "";
    await persistCollections();
  } catch (error) {
    collections = previousCollections;
    activeCollectionId = previousActiveCollectionId;
    throw error;
  }

  renderHomeCollections();
  renderAdminCollections();
  renderProducts();
  resetCollectionForm();
  showToast("Coleção excluída.");
}

function renderAdminCollections() {
  const list = document.getElementById("admin-collection-list");
  const categoryList = document.getElementById("collection-category-options");
  if (!isLoggedIn()) return;

  if (categoryList) {
    categoryList.innerHTML = getCategories()
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join("");
  }

  renderCollectionProductChoices(selectedCollectionProductIds());

  if (!list) return;
  if (!collections.length) {
    list.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhuma coleção criada</strong>
        <p>Crie coleções para controlar os cards da home e os produtos de cada uma.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = collections
    .map((collection) => {
      const count = collectionProductCount(collection);
      return `
        <article class="admin-item admin-collection-row">
          <img src="${assetUrl(collection.image)}" alt="${escapeHtml(collection.name)}" />
          <div>
            <h3>${escapeHtml(collection.name)}</h3>
            <p>${count} produto${count === 1 ? "" : "s"} - Link: /produtos?colecao=${escapeHtml(collection.id)}</p>
          </div>
          <div class="admin-actions">
            <a class="secondary-button compact-action" href="${catalogUrl({ collectionId: collection.id, search: "" })}" target="_blank" rel="noopener noreferrer">
              <i data-lucide="external-link" aria-hidden="true"></i>
              Ver
            </a>
            <button class="primary-button compact-action" type="button" data-edit-collection="${escapeHtml(collection.id)}">
              <i data-lucide="file-pen-line" aria-hidden="true"></i>
              Editar
            </button>
            <button class="danger-button compact-action" type="button" data-delete-collection="${escapeHtml(collection.id)}">
              <i data-lucide="trash-2" aria-hidden="true"></i>
              Excluir
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  iconRefresh();
}

function shouldAutoSyncProducts() {
  const hasIntegratedProducts = products.some((product) => product.yampiProductId);
  const lastSync = Number(localStorage.getItem(INTEGRATION_SYNC_KEY) || 0);
  const tenMinutes = 10 * 60 * 1000;
  return !hasIntegratedProducts || Date.now() - lastSync > tenMinutes;
}

function applyCatalogData(data) {
  const previousProductsHash = JSON.stringify(products);
  const previousCategoriesHash = JSON.stringify(categories);

  products = (data.products || []).map(normalizeProduct);
  cart = cart.filter((item) => products.some((product) => product.id === item.productId));
  categories = mergeCatalogCategories(data.categories, products);
  saveProducts();
  saveCart();
  saveCategories();

  const currentProductsHash = JSON.stringify(products);
  const currentCategoriesHash = JSON.stringify(categories);

  if (previousProductsHash !== currentProductsHash || previousCategoriesHash !== currentCategoriesHash) {
    renderHomeCollections();
    renderProducts();
    renderCart();
    renderAdminList();
    renderAdminCategories();
    renderAdminCollections();
    updateAdminMetrics();
    renderPhotoSelector();
    route();
  }
  
  if (data.syncedAt) {
    localStorage.setItem(INTEGRATION_SYNC_KEY, String(new Date(data.syncedAt).getTime() || Date.now()));
  }
}

async function loadCatalogProducts({ silent = true } = {}) {
  try {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao carregar produtos.");
    }

    applyCatalogData(data);
  } catch (error) {
    console.error(error);
    if (!silent) showToast(error.message || "Erro ao carregar produtos.");
  }
}

async function syncYampiProducts({ silent = false } = {}) {
  const button = document.querySelector("[data-yampi-sync]");
  const status = document.querySelector("[data-yampi-status]");
  const previousText = button?.textContent;

  if (button && !silent) {
    button.disabled = true;
    button.innerHTML = `<i data-lucide="refresh-cw" aria-hidden="true"></i> Sincronizando...`;
    iconRefresh();
  }
  if (status && !silent) status.textContent = "Conectando com a integração...";

  try {
    const response = await fetch("/api/yampi/sync", {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao sincronizar produtos.");
    }

    applyCatalogData(data);
    localStorage.setItem(INTEGRATION_SYNC_KEY, String(Date.now()));
    const removedCount = Number(data.removedCount || 0);
    const categoryCount = getCategories().length;
    if (status) {
      status.textContent = `${data.count || 0} produtos e ${categoryCount} categoria${categoryCount === 1 ? "" : "s"} sincronizados${removedCount ? `, ${removedCount} removido${removedCount === 1 ? "" : "s"} do site` : ""}.`;
    }
    if (!silent) {
      showToast(removedCount ? `Produtos sincronizados. ${removedCount} removido${removedCount === 1 ? "" : "s"}.` : "Produtos sincronizados.");
    }
  } catch (error) {
    console.error(error);
    if (status && !silent) status.textContent = error.message || "Erro ao sincronizar.";
    if (!silent) showToast(error.message || "Erro ao sincronizar produtos.");
  } finally {
    if (button && !silent) {
      button.disabled = false;
      button.innerHTML = previousText || `<i data-lucide="refresh-cw" aria-hidden="true"></i> Sincronizar produtos`;
      iconRefresh();
    }
  }
}

async function installYampiWebhook() {
  const button = document.querySelector("[data-yampi-webhook]");
  const status = document.querySelector("[data-yampi-status]");
  const previousText = button?.innerHTML;

  if (button) {
    button.disabled = true;
    button.innerHTML = `<i data-lucide="webhook" aria-hidden="true"></i> Ativando...`;
    iconRefresh();
  }
  if (status) status.textContent = "Registrando webhook de produtos e pedidos na Yampi...";

  try {
    const response = await fetch("/api/yampi/webhook/install", {
      method: "POST",
      headers: adminAuthHeaders({ "Content-Type": "application/json" })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao ativar webhook.");
    }

    if (status) status.textContent = `Webhook ativo: ${data.events.length} eventos de produtos e pedidos.`;
    showToast(data.created ? "Webhook criado na Yampi." : "Webhook atualizado na Yampi.");
  } catch (error) {
    console.error(error);
    if (status) status.textContent = error.message || "Erro ao ativar webhook.";
    showToast(error.message || "Erro ao ativar webhook.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previousText || `<i data-lucide="webhook" aria-hidden="true"></i> Ativar webhook`;
      iconRefresh();
    }
  }
}

function autoSyncProducts() {
  if (!shouldAutoSyncProducts()) return;
  syncYampiProducts({ silent: true });
}

function cancelEditMode() {
  const form = qs("[data-product-form]");
  if (form) {
    form.reset();
    form.elements.id.value = "";
    if (form.elements.productReviews) form.elements.productReviews.value = "";
    form.hidden = true;
  }
  adminProductReviews = [];
  resetProductReviewEditor(form);
  renderProductReviewManager(form);
  selectedMainImage = PLACEHOLDER_IMAGE;
  selectedGalleryImages = [PLACEHOLDER_IMAGE];
  productMediaDirty = false;
  adminVariantProduct = null;
  adminVariantConfig = normalizeVariantConfig();
  renderPhotoSelector();
  renderPremiumEditorDefaults();

  const alertEl = document.getElementById("admin-edit-mode-alert");
  if (alertEl) alertEl.style.display = "none";
}

function renderPremiumEditorDefaults() {
  const form = qs("[data-product-form]");
  if (!form) return;

  const productDraft = normalizeProduct({
    name: form.elements.name?.value || "Produto Caomisa",
    image: selectedMainImage,
    images: selectedGalleryImages,
    description: form.elements.description?.value || ""
  });
  const premium = productDraft.premium;

  const fields = {
    soldCount: premium.soldCount,
    rating: premium.rating,
    reviewCount: premium.reviewCount,
    badgeText: premium.badgeText,
    deliveryText: premium.deliveryText,
    descriptionTitle: premium.descriptionTitle,
    descriptionIntro: premium.descriptionIntro,
    sizeGuideDesktopImage: premium.sizeGuideDesktopImage,
    sizeGuideMobileImage: premium.sizeGuideMobileImage,
    specs: premium.specs
  };

  Object.entries(fields).forEach(([name, value]) => {
    if (form.elements[name] && !form.elements[name].value) {
      form.elements[name].value = value ?? "";
    }
  });

  updateProductSizeGuidePreviews(form);

  premium.descriptionBlocks.forEach((block, idx) => {
    const index = idx + 1;
    if (form.elements[`descBlock${index}Title`] && !form.elements[`descBlock${index}Title`].value) form.elements[`descBlock${index}Title`].value = block.title || "";
    if (form.elements[`descBlock${index}Text`] && !form.elements[`descBlock${index}Text`].value) form.elements[`descBlock${index}Text`].value = block.text || "";
    if (form.elements[`descBlock${index}Image`] && !form.elements[`descBlock${index}Image`].value) form.elements[`descBlock${index}Image`].value = block.image || PLACEHOLDER_IMAGE;
    const preview = document.getElementById(`desc-block-${index}-preview`);
    if (preview && form.elements[`descBlock${index}Image`]) preview.src = assetUrl(form.elements[`descBlock${index}Image`].value || PLACEHOLDER_IMAGE);
  });

  premium.reviews.slice(0, 3).forEach((review, idx) => {
    const index = idx + 1;
    if (form.elements[`review${index}Name`] && !form.elements[`review${index}Name`].value) form.elements[`review${index}Name`].value = review.name || "";
    if (form.elements[`review${index}Stars`] && !form.elements[`review${index}Stars`].value) form.elements[`review${index}Stars`].value = review.stars || 5;
    if (form.elements[`review${index}Text`] && !form.elements[`review${index}Text`].value) form.elements[`review${index}Text`].value = review.text || "";
  });
}

function updateProductSizeGuidePreviews(form = qs("[data-product-form]")) {
  if (!form) return;
  const previews = {
    "product-size-guide-desktop-preview": form.elements.sizeGuideDesktopImage?.value || PLACEHOLDER_IMAGE,
    "product-size-guide-mobile-preview": form.elements.sizeGuideMobileImage?.value || PLACEHOLDER_IMAGE
  };

  Object.entries(previews).forEach(([id, value]) => {
    const img = document.getElementById(id);
    if (img) img.src = assetUrl(value);
  });
}

function parseReviewJson(value = "") {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? normalizeReviews(parsed) : [];
  } catch {
    return [];
  }
}

function syncProductReviewsInput(form = qs("[data-product-form]")) {
  if (!form?.elements.productReviews) return;
  form.elements.productReviews.value = JSON.stringify(adminProductReviews);
  form.elements.productReviews.dispatchEvent(new Event("change", { bubbles: true }));
}

function resetProductReviewEditor(form = qs("[data-product-form]")) {
  if (!form) return;
  adminReviewEditIndex = -1;
  ["productReviewName", "productReviewCity", "productReviewText", "productReviewImage"].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = "";
  });
  if (form.elements.productReviewStars) form.elements.productReviewStars.value = "5";
  if (form.elements.productReviewEditIndex) form.elements.productReviewEditIndex.value = "-1";

  const preview = qs("[data-product-review-photo-preview]", form);
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }
  const label = qs("[data-product-review-save-label]", form);
  if (label) label.textContent = "Adicionar depoimento";
}

function reviewFromManagerForm(form = qs("[data-product-form]")) {
  if (!form) return null;
  const existing = adminProductReviews[adminReviewEditIndex] || {};
  const name = String(form.elements.productReviewName?.value || "").trim();
  const city = String(form.elements.productReviewCity?.value || "").trim();
  const text = String(form.elements.productReviewText?.value || "").trim();
  if (!text) return null;

  return {
    id: existing.id || `manual-${form.elements.id?.value || "produto"}-${Date.now()}`,
    name: name || "Cliente Caomisa",
    city,
    stars: Math.max(1, Math.min(5, Number(form.elements.productReviewStars?.value || 5))),
    text,
    image: String(form.elements.productReviewImage?.value || "").trim(),
    status: "approved",
    createdAt: existing.createdAt || new Date().toISOString(),
    aiGenerated: false,
    aiDisclosure: "",
    source: existing.source === "gemini" ? "" : (existing.source || "")
  };
}

function renderProductReviewManager(form = qs("[data-product-form]")) {
  const list = qs("[data-product-reviews-editor-list]");
  const count = qs("[data-product-review-count]");
  if (!list || !form) return;

  syncProductReviewsInput(form);
  if (count) {
    count.textContent = `${adminProductReviews.length} depoimento${adminProductReviews.length === 1 ? "" : "s"}`;
  }

  if (!adminProductReviews.length) {
    list.innerHTML = `
      <div class="admin-empty-state compact-empty">
        <strong>Nenhum depoimento cadastrado neste produto</strong>
        <p>Adicione depoimentos reais acima e salve o conteúdo.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = adminProductReviews
    .map((review, index) => `
      <article class="product-review-editor-card">
        ${review.image ? `<img src="${assetUrl(review.image)}" alt="Foto do depoimento de ${escapeHtml(review.name)}" />` : `<div class="review-editor-no-photo">Sem foto</div>`}
        <div>
          <div class="review-editor-card-head">
            <strong>${escapeHtml(review.name)}</strong>
            <span class="stars">${renderStars(review.stars || 5)}</span>
          </div>
          ${review.city ? `<small>${escapeHtml(review.city)}</small>` : ""}
          <p>${escapeHtml(review.text || "")}</p>
        </div>
        <div class="review-editor-card-actions">
          <button class="secondary-button compact-action" type="button" data-product-review-edit="${index}">
            <i data-lucide="file-pen-line" aria-hidden="true"></i>
            Editar
          </button>
          <button class="danger-button compact-action" type="button" data-product-review-delete="${index}">
            <i data-lucide="trash-2" aria-hidden="true"></i>
            Excluir
          </button>
        </div>
      </article>
    `)
    .join("");
  iconRefresh();
}

function loadProductReviewManager(reviews = [], form = qs("[data-product-form]")) {
  adminProductReviews = normalizeReviews(reviews);
  adminReviewEditIndex = -1;
  resetProductReviewEditor(form);
  renderProductReviewManager(form);
}

function startProductReviewEdit(index, form = qs("[data-product-form]")) {
  if (!form) return;
  const review = adminProductReviews[index];
  if (!review) return;

  adminReviewEditIndex = index;
  if (form.elements.productReviewEditIndex) form.elements.productReviewEditIndex.value = String(index);
  if (form.elements.productReviewName) form.elements.productReviewName.value = review.name || "";
  if (form.elements.productReviewCity) form.elements.productReviewCity.value = review.city || "";
  if (form.elements.productReviewStars) form.elements.productReviewStars.value = String(review.stars || 5);
  if (form.elements.productReviewText) form.elements.productReviewText.value = review.text || "";
  if (form.elements.productReviewImage) form.elements.productReviewImage.value = review.image || "";

  const preview = qs("[data-product-review-photo-preview]", form);
  if (preview) {
    if (review.image) {
      preview.src = assetUrl(review.image);
      preview.hidden = false;
    } else {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
  }
  const label = qs("[data-product-review-save-label]", form);
  if (label) label.textContent = "Salvar edição";
  qs("[data-product-review-manager]", form)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function saveProductReviewFromEditor(form = qs("[data-product-form]")) {
  const review = reviewFromManagerForm(form);
  if (!review) {
    showToast("Digite o texto do depoimento.");
    return;
  }

  if (adminReviewEditIndex >= 0) {
    adminProductReviews[adminReviewEditIndex] = review;
    showToast("Depoimento atualizado.");
  } else {
    adminProductReviews.unshift(review);
    showToast("Depoimento adicionado.");
  }

  adminProductReviews = normalizeReviews(adminProductReviews);
  resetProductReviewEditor(form);
  renderProductReviewManager(form);
}

function isLoggedIn() {
  return Boolean(sessionStorage.getItem(SESSION_KEY));
}

function adminAuthHeaders(extra = {}) {
  const token = sessionStorage.getItem(SESSION_KEY);
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function clearAdminSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function setAdminVisible() {
  const login = qs("[data-login-form]");
  const panel = qs("[data-admin-panel]");
  if (!login || !panel) return;

  const loggedIn = isLoggedIn();
  login.hidden = loggedIn;
  panel.hidden = !loggedIn;

  if (loggedIn) {
    renderAdminList();
    updateAdminMetrics();
    renderPhotoSelector();
    renderAdminCategories();
    renderAdminCollections();
    renderAdminBanners();
    renderAdminSiteContentForm();
    loadAdminReviews();
    renderAdminPersonalizations();
  }
}

function productFromForm(form) {
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const id = String(formData.get("id") || "").trim() || slugify(name);
  const existingProduct = products.find((item) => item.id === id);

  const imagesStr = String(formData.get("images") || "");
  const images = imagesStr
    .split(",")
    .map(img => img.trim())
    .filter(Boolean);
  const baseProduct = {
    id,
    name,
    image: String(formData.get("image") || "").trim() || PLACEHOLDER_IMAGE,
    images: images.length ? images : [String(formData.get("image") || "").trim() || PLACEHOLDER_IMAGE],
    description: String(formData.get("description") || "").trim()
  };
  const currentPremium = normalizeProduct(existingProduct || baseProduct).premium;
  const editedReviews = form.elements.productReviews
    ? parseReviewJson(formData.get("productReviews"))
    : currentPremium.reviews;
  const descriptionBlocks = [1, 2, 3].map((index) => {
    const currentBlock = currentPremium.descriptionBlocks[index - 1] || {};
    if (!form.elements[`descBlock${index}Title`]) return currentBlock;
    return {
      title: String(formData.get(`descBlock${index}Title`) || "").trim(),
      text: String(formData.get(`descBlock${index}Text`) || "").trim(),
      image: String(formData.get(`descBlock${index}Image`) || "").trim() || currentBlock.image || PLACEHOLDER_IMAGE
    };
  });

  return normalizeProduct({
    id,
    name,
    category: String(formData.get("category") || "").trim(),
    price: Number(formData.get("price") || 0),
    oldPrice: Number(formData.get("oldPrice") || 0),
    stock: Number(formData.get("stock") || 0),
    image: baseProduct.image,
    images: baseProduct.images,
    sizes: String(formData.get("sizes") || "")
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean),
    description: baseProduct.description,
    variantConfig: form.elements.variantConfig
      ? parseVariantConfigJson(formData.get("variantConfig"))
      : currentPremium.variantConfig,
    customization: {
      enabled: Boolean(form.elements.customizationEnabled?.checked),
      nameMaxLength: 16,
      numberMaxLength: 2
    },
    premium: {
      soldCount: String(formData.get("soldCount") || "").trim(),
      rating: currentPremium.rating,
      reviewCount: currentPremium.reviewCount,
      badgeText: String(formData.get("badgeText") || "").trim(),
      deliveryText: String(formData.get("deliveryText") || "").trim(),
      descriptionTitle: String(formData.get("descriptionTitle") || "").trim(),
      descriptionIntro: String(formData.get("descriptionIntro") || "").trim(),
      sizeGuideDesktopImage: String(formData.get("sizeGuideDesktopImage") || "").trim() || currentPremium.sizeGuideDesktopImage || PLACEHOLDER_IMAGE,
      sizeGuideMobileImage: String(formData.get("sizeGuideMobileImage") || "").trim() || currentPremium.sizeGuideMobileImage || PLACEHOLDER_IMAGE,
      descriptionBlocks,
      specs: String(formData.get("specs") || "").trim(),
      reviews: editedReviews
    },
    mediaUpdated: productMediaDirty
  });
}

function renderProductEditSummary(product) {
  const summary = document.querySelector("[data-product-edit-summary]");
  if (!summary) return;

  summary.innerHTML = `
    <img src="${assetUrl(product.image)}" alt="${escapeHtml(product.name)}" />
    <div>
      <span>Produto sincronizado pela Yampi</span>
      <strong>${escapeHtml(product.name)}</strong>
      <p>${escapeHtml(product.category)} - ${money(product.price)} - Estoque: ${Number(product.stock || 0)} - ${product.sizes?.length || 1} tamanho(s)</p>
    </div>
  `;
}

function fillProductForm(product) {
  const form = qs("[data-product-form]");
  if (!form) return;
  const normalized = normalizeProduct(product);
  const premium = normalized.premium;
  form.hidden = false;
  loadProductReviewManager(premium.reviews, form);

  form.elements.id.value = normalized.id;
  form.elements.name.value = normalized.name;
  form.elements.category.value = normalized.category;
  form.elements.price.value = normalized.price;
  form.elements.oldPrice.value = normalized.oldPrice || "";
  form.elements.stock.value = normalized.stock;
  form.elements.image.value = normalized.image;
  form.elements.sizes.value = normalized.sizes.join(", ");
  form.elements.description.value = normalized.description;

  const optionalFields = {
    soldCount: premium.soldCount,
    rating: premium.rating,
    reviewCount: premium.reviewCount,
    badgeText: premium.badgeText,
    deliveryText: premium.deliveryText,
    descriptionTitle: premium.descriptionTitle,
    descriptionIntro: premium.descriptionIntro,
    sizeGuideDesktopImage: premium.sizeGuideDesktopImage,
    sizeGuideMobileImage: premium.sizeGuideMobileImage,
    specs: premium.specs
  };

  Object.entries(optionalFields).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value ?? "";
  });
  if (form.elements.customizationEnabled) {
    form.elements.customizationEnabled.checked = Boolean(normalized.customization?.enabled);
  }
  updateProductSizeGuidePreviews(form);

  premium.descriptionBlocks.forEach((block, idx) => {
    const index = idx + 1;
    if (form.elements[`descBlock${index}Title`]) form.elements[`descBlock${index}Title`].value = block.title || "";
    if (form.elements[`descBlock${index}Text`]) form.elements[`descBlock${index}Text`].value = block.text || "";
    if (form.elements[`descBlock${index}Image`]) form.elements[`descBlock${index}Image`].value = block.image || PLACEHOLDER_IMAGE;
    const preview = document.getElementById(`desc-block-${index}-preview`);
    if (preview) preview.src = assetUrl(block.image || PLACEHOLDER_IMAGE);
  });

  selectedMainImage = normalized.image;
  selectedGalleryImages = [...(normalized.images || [normalized.image])];
  adminVariantConfig = normalizeVariantConfig(normalized.variantConfig);
  adminVariantProduct = normalized;
  renderPhotoSelector();
  renderVariantMatrixEditor(normalized, form);
  productMediaDirty = false;

  const alertEl = document.getElementById("admin-edit-mode-alert");
  const nameEl = document.getElementById("admin-editing-product-name");
  if (alertEl) alertEl.style.display = "flex";
  if (nameEl) nameEl.textContent = normalized.name;
  renderProductEditSummary(normalized);

  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderAdminList() {
  const list = qs("[data-admin-list]");
  if (!list || !isLoggedIn()) return;
  const bulkActions = qs(".admin-product-actions");

  if (!products.length) {
    if (bulkActions) bulkActions.hidden = true;
    list.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhum produto sincronizado</strong>
        <p>Use a sincronização da Yampi para trazer produtos, categorias, tamanhos e checkout.</p>
      </div>
    `;
    updateSelectedProductsState();
    return;
  }

  if (bulkActions) bulkActions.hidden = false;
  const displayProducts = homeOrderedProducts(products);
  list.innerHTML = displayProducts
    .map(
      (product, index) => {
        const homeOrder = Number.isFinite(Number(product.homeSortOrder))
          ? Number(product.homeSortOrder)
          : index + 1;
        return `
        <article class="admin-item admin-product-row">
          <label class="admin-product-select" aria-label="Selecionar ${escapeHtml(product.name)}">
            <input type="checkbox" data-product-select="${escapeHtml(product.id)}" />
          </label>
          <img src="${assetUrl(product.image)}" alt="${escapeHtml(product.name)}" />
          <div class="admin-product-main">
            <span class="admin-source-pill">Yampi</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.category)}</p>
            <div class="admin-product-stats">
              <span>${money(product.price)}</span>
              <span>Estoque: ${Number(product.stock || 0)}</span>
              <span>${product.sizes?.length || 1} tamanho(s)</span>
              <span>${escapeHtml(product.premium?.soldCount || "+0 vendidos")}</span>
            </div>
            <label class="admin-home-order-field">
              <span>Ordem home</span>
              <input type="number" min="1" step="1" value="${homeOrder}" data-home-order-input="${escapeHtml(product.id)}" aria-label="Ordem de ${escapeHtml(product.name)} na página principal" />
            </label>
          </div>
          <div class="admin-actions">
            <a class="secondary-button compact-action" href="${productUrl(product)}" target="_blank" rel="noopener noreferrer">
              <i data-lucide="external-link" aria-hidden="true"></i>
              Ver
            </a>
            <button class="primary-button compact-action" type="button" data-edit-product="${product.id}">
              <i data-lucide="file-pen-line" aria-hidden="true"></i>
              Editar página
            </button>
            <button class="secondary-button compact-action ai-review-action" type="button" data-generate-ai-reviews="${escapeHtml(product.id)}">
              <i data-lucide="sparkles" aria-hidden="true"></i>
              Gerar IA
            </button>
            <button class="danger-button compact-action" type="button" data-delete-product="${product.id}">
              <i data-lucide="trash-2" aria-hidden="true"></i>
              Excluir do site
            </button>
          </div>
        </article>
      `;
      }
    )
    .join("");

  iconRefresh();
  updateSelectedProductsState();
}

function reviewStatusLabel(status) {
  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Reprovado";
  return "Pendente";
}

function renderAdminReviews() {
  const list = document.querySelector("[data-admin-reviews-list]");
  if (!list || !isLoggedIn()) return;

  const pendingFirst = [...reviewModeration].sort((a, b) => {
    const order = { pending: 0, approved: 1, rejected: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
      || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  if (!pendingFirst.length) {
    list.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhum depoimento enviado ainda</strong>
        <p>Quando um cliente mandar avaliação pela página do produto, ela aparece aqui para aprovação.</p>
      </div>
    `;
    updateAdminMetrics();
    return;
  }

  list.innerHTML = pendingFirst.map((review) => `
    <article class="admin-review-card is-${escapeHtml(review.status || "pending")}">
      <div class="admin-review-product">
        ${review.productImage ? `<img src="${assetUrl(review.productImage)}" alt="${escapeHtml(review.productName || "Produto")}" />` : ""}
        <div>
          <span class="admin-source-pill">${reviewStatusLabel(review.status)}</span>
          <strong>${escapeHtml(review.productName || "Produto")}</strong>
          <small>${review.createdAt ? new Date(review.createdAt).toLocaleDateString("pt-BR") : ""}</small>
        </div>
      </div>
      <div class="admin-review-body">
        <div class="admin-review-author">
          <strong>${escapeHtml(review.name || "Cliente Caomisa")}</strong>
          <span class="stars">${renderStars(review.stars || 5)}</span>
        </div>
        <p>${escapeHtml(review.text || "")}</p>
        ${review.image ? `<img class="admin-review-photo" src="${assetUrl(review.image)}" alt="Foto enviada no depoimento" />` : ""}
      </div>
      <div class="admin-review-actions">
        ${review.status !== "approved" ? `
          <button class="primary-button compact-action" type="button" data-review-approve="${escapeHtml(review.id)}">
            <i data-lucide="check" aria-hidden="true"></i>
            Aprovar
          </button>
        ` : ""}
        ${review.status !== "rejected" ? `
          <button class="secondary-button compact-action" type="button" data-review-reject="${escapeHtml(review.id)}">
            <i data-lucide="x" aria-hidden="true"></i>
            Reprovar
          </button>
        ` : ""}
        <button class="danger-button compact-action" type="button" data-review-delete="${escapeHtml(review.id)}">
          <i data-lucide="trash-2" aria-hidden="true"></i>
          Excluir
        </button>
      </div>
    </article>
  `).join("");

  iconRefresh();
  updateAdminMetrics();
}

function personalizationStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("paid") || normalized.includes("pago") || normalized.includes("aprov")) return "Pagamento aprovado";
  if (normalized.includes("order")) return "Pedido na Yampi";
  return "Checkout iniciado";
}

function renderAdminPersonalizations() {
  const list = document.querySelector("[data-admin-personalizations-list]");
  if (!list || !isLoggedIn()) return;

  if (!personalizationRecords.length) {
    list.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhuma personalização registrada ainda</strong>
        <p>Quando alguém comprar produto personalizado, o nome e número aparecem aqui e também seguem no metadata da Yampi.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = personalizationRecords.map((record) => {
    const items = Array.isArray(record.items) && record.items.length
      ? record.items
      : [{ produto: record.summary || "Produto personalizado" }];
    return `
      <article class="admin-personalization-card">
        <div class="admin-personalization-head">
          <span class="admin-source-pill">${escapeHtml(personalizationStatusLabel(record.status || record.event))}</span>
          <strong>${escapeHtml(record.code || record.id || "Personalização")}</strong>
          <small>${record.updatedAt ? new Date(record.updatedAt).toLocaleString("pt-BR") : ""}</small>
        </div>
        <div class="admin-personalization-items">
          ${items.map((item) => `
            <div>
              <strong>${escapeHtml(item.produto || "Produto")}</strong>
              <span>${item.nome ? `Nome: ${escapeHtml(item.nome)} · ` : ""}${item.numero ? `Número: ${escapeHtml(item.numero)} · ` : ""}${item.tamanho ? `Tam ${escapeHtml(item.tamanho)}` : ""}${item.cor ? ` · Cor ${escapeHtml(item.cor)}` : ""}</span>
            </div>
          `).join("")}
        </div>
        ${record.orderNumber || record.orderId ? `
          <p class="admin-personalization-order">Pedido Yampi: ${escapeHtml(record.orderNumber || record.orderId)}</p>
        ` : ""}
      </article>
    `;
  }).join("");
}

async function loadAdminPersonalizations() {
  if (!isLoggedIn()) return;
  try {
    const response = await fetch("/api/personalizations", {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Erro ao carregar personalizações.");
    personalizationRecords = Array.isArray(data.records) ? data.records : [];
    renderAdminPersonalizations();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao carregar personalizações.");
  }
}

function salesDefaultFromDate() {
  return profitTodayInputDate();
}

function ensureSalesFilterDefaults() {
  const fromInput = qs("[data-sales-filter='from']");
  const toInput = qs("[data-sales-filter='to']");
  if (fromInput && !fromInput.value) fromInput.value = salesDefaultFromDate();
  if (toInput && !toInput.value) toInput.value = profitTodayInputDate();
}

function salesQueryFromAdmin() {
  ensureSalesFilterDefaults();
  const params = new URLSearchParams();
  params.set("from", qs("[data-sales-filter='from']")?.value || salesDefaultFromDate());
  params.set("to", qs("[data-sales-filter='to']")?.value || profitTodayInputDate());
  const search = qs("[data-sales-search]")?.value.trim() || "";
  if (search) params.set("search", search);
  return params;
}

function downloadNameFromResponse(response, fallback) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match ? match[1] : fallback;
}

async function downloadPersonalizationSpreadsheet(scope = "all", button = null) {
  const params = scope === "sales" ? salesQueryFromAdmin() : new URLSearchParams();
  const query = params.toString();
  const previousHtml = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = `<i data-lucide="loader-2" aria-hidden="true"></i> Gerando...`;
    iconRefresh();
  }

  try {
    const response = await fetch(`/api/personalizations/export${query ? `?${query}` : ""}`, {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao gerar planilha.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = downloadNameFromResponse(response, `caomisa-personalizados-${profitTodayInputDate()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    showToast("Planilha baixada.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao gerar planilha.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previousHtml;
      iconRefresh();
    }
  }
}

function salesStatusLabel(status = "new") {
  const labels = {
    new: "Novo",
    buy: "Comprar",
    ordered: "Comprado",
    shipped: "Enviado",
    done: "Finalizado"
  };
  return labels[status] || labels.new;
}

function salesNextStatus(status = "new") {
  const order = ["new", "buy", "ordered", "shipped", "done"];
  return order[Math.min(order.indexOf(status) + 1, order.length - 1)] || "new";
}

function salesPrevStatus(status = "new") {
  const order = ["new", "buy", "ordered", "shipped", "done"];
  return order[Math.max(order.indexOf(status) - 1, 0)] || "new";
}

function salesItemSummary(order = {}) {
  const personalized = Array.isArray(order.personalizations) ? order.personalizations : [];
  const source = personalized.length ? personalized : (order.items || []);
  return source.map((item) => {
    const product = item.produto || item.productName || "Produto";
    const quantity = item.quantidade || item.quantity || 1;
    const details = [
      item.tamanho || item.size ? `Tam ${item.tamanho || item.size}` : "",
      item.cor || item.color ? `Cor ${item.cor || item.color}` : "",
      item.nome ? `Nome ${item.nome}` : "",
      item.numero ? `Nº ${item.numero}` : ""
    ].filter(Boolean).join(" · ");
    return `${quantity}x ${product}${details ? ` (${details})` : ""}`;
  }).join(" + ");
}

function salesOrderById(orderId) {
  return salesProcessingOrders.find((order) => String(order.id) === String(orderId));
}

function compactSalesProductName(value = "") {
  return String(value || "Produto")
    .replace(/\s*-\s*frete\s+gr[aá]tis\s*$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();
}

function salesDisplayItems(order = {}) {
  const personalized = Array.isArray(order.personalizations) && order.personalizations.length
    ? order.personalizations
    : [];
  if (personalized.length) {
    return personalized.map((item, index) => ({
      key: `${order.id}-p-${index}`,
      model: compactSalesProductName(item.produto || order.items?.[index]?.productName || "Produto"),
      quantity: item.quantidade || 1,
      size: item.tamanho || order.items?.[index]?.size || "",
      color: item.cor || order.items?.[index]?.color || "",
      customName: item.nome || "",
      customNumber: item.numero || "",
      buyLink: item.buyLink || order.items?.[index]?.buyLink || order.items?.[0]?.buyLink || ""
    }));
  }
  return (order.items || []).map((item, index) => ({
    key: `${order.id}-i-${index}`,
    model: compactSalesProductName(item.productName || "Produto"),
    quantity: item.quantity || 1,
    size: item.size || "",
    color: item.color || "",
    customName: "",
    customNumber: "",
    buyLink: item.buyLink || ""
  }));
}

function salesFieldButton(label, value, extraClass = "") {
  const text = String(value || "").trim();
  return `
    <button class="admin-sales-field ${extraClass}" type="button" data-sales-copy-value="${escapeHtml(text)}" ${text ? "" : "disabled"}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(text || "-")}</strong>
    </button>
  `;
}

function melhorEnvioPanelHtml() {
  const status = melhorEnvioStatus || {};
  const configured = Boolean(status.configured);
  const connected = Boolean(status.connected);
  const environment = status.environment === "production" ? "Produção" : "Sandbox";
  const statusText = !configured
    ? "Configuração pendente"
    : (connected ? `Conectado (${environment})` : `Aguardando autorização (${environment})`);
  const pendingValue = Number(status.pendingValue || 0);
  const preparedText = status.pending
    ? ` · ${status.pending} frete(s) · ${money(pendingValue)}`
    : "";
  const modeText = status.autoCheckout ? "compra automática" : "preparar para pagar";
  const detail = !configured
    ? "Preencha as credenciais do Melhor Envio na VPS."
    : (connected
      ? `Automático ${status.autoLabels ? "ativo" : "desligado"} · modo ${modeText}${preparedText}`
      : "Clique para abrir a autorização OAuth do Melhor Envio.");

  return `
    <section class="admin-melhor-envio-panel ${connected ? "is-connected" : "is-pending"}">
      <div>
        <span>Melhor Envio</span>
        <strong>${escapeHtml(statusText)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
      <div class="admin-melhor-envio-actions">
        ${connected ? `
          <button class="secondary-button compact-action" type="button" data-melhor-envio-process>
            Processar todos
          </button>
          ${status.cartUrl ? `
            <a class="primary-button compact-action" href="${escapeHtml(status.cartUrl)}" target="_blank" rel="noopener noreferrer">
              Abrir carrinho
            </a>
          ` : ""}
        ` : `
          <button class="primary-button compact-action" type="button" data-melhor-envio-connect ${configured ? "" : "disabled"}>
            Autorizar app
          </button>
        `}
      </div>
    </section>
  `;
}

function melhorEnvioLabelStatusText(label = {}) {
  const labels = {
    not_configured: "Configuração pendente",
    auth_required: "Precisa autorizar",
    pending: "Pendente",
    processing: "Processando",
    quoted: "Frete escolhido",
    cart: "No carrinho",
    awaiting_payment: "Pronto para pagar",
    checkout: "Comprado",
    generated: "Gerado",
    printed: "Impressão solicitada",
    ready: "Etiqueta pronta",
    balance_required: "Saldo insuficiente",
    retry: "Vai tentar de novo",
    error: "Erro"
  };
  return labels[label.status] || "Pendente";
}

function melhorEnvioOrderCardHtml(order = {}) {
  const label = order.melhorEnvio || {};
  const isPersonalized = Array.isArray(order.personalizations) && order.personalizations.length;
  if (!isPersonalized) return "";
  const connected = Boolean(melhorEnvioStatus?.connected);
  const service = [label.companyName, label.serviceName].filter(Boolean).join(" · ");
  const details = [
    service,
    label.price ? money(label.price) : "",
    label.deliveryTime ? `${label.deliveryTime} dia${Number(label.deliveryTime) === 1 ? "" : "s"}` : "",
    label.orderId ? `ID ${label.orderId}` : ""
  ].filter(Boolean).join(" · ");
  const message = label.message || (connected ? "O frete será preparado no carrinho do Melhor Envio para pagamento." : "Autorize o Melhor Envio para gerar automaticamente.");
  return `
    <section class="admin-sales-shipping ${label.status ? `is-${escapeHtml(label.status)}` : "is-empty"}">
      <div>
        <span>Etiqueta Melhor Envio</span>
        <strong>${escapeHtml(melhorEnvioLabelStatusText(label))}</strong>
        ${details ? `<small>${escapeHtml(details)}</small>` : ""}
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="admin-sales-shipping-actions">
        ${label.printUrl ? `
          <a class="primary-button compact-action" href="${escapeHtml(label.printUrl)}" target="_blank" rel="noopener noreferrer">
            Abrir etiqueta
          </a>
        ` : ""}
        <button class="secondary-button compact-action" type="button" data-melhor-envio-label="${escapeHtml(order.id)}" ${connected ? "" : "disabled"}>
          ${label.orderId ? "Atualizar frete" : "Gerar para pagar"}
        </button>
      </div>
    </section>
  `;
}

async function loadMelhorEnvioStatus() {
  if (!isLoggedIn()) return null;
  try {
    const response = await fetch("/api/melhor-envio/status", {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    melhorEnvioStatus = await readApiJson(response, "Erro ao carregar Melhor Envio.");
    return melhorEnvioStatus;
  } catch (error) {
    console.error(error);
    melhorEnvioStatus = { ok: false, configured: false, connected: false, message: error.message };
    return melhorEnvioStatus;
  }
}

async function connectMelhorEnvio(button = null) {
  const previousHtml = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = "Abrindo...";
  }
  try {
    const response = await fetch("/api/melhor-envio/connect", {
      method: "POST",
      headers: adminAuthHeaders()
    });
    const data = await readApiJson(response, "Erro ao iniciar autorização.");
    if (!data.url) throw new Error("Melhor Envio não retornou URL de autorização.");
    window.open(data.url, "_blank", "noopener,noreferrer");
    showToast("Autorize o app na aba do Melhor Envio.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao conectar Melhor Envio.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previousHtml;
      iconRefresh();
    }
  }
}

async function processMelhorEnvioPending(button = null) {
  const previousHtml = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = "Processando...";
  }
  try {
    const response = await fetch("/api/melhor-envio/process-pending", {
      method: "POST",
      headers: adminAuthHeaders()
    });
    const data = await readApiJson(response, "Erro ao processar pendentes.");
    const total = Number(data.total || 0);
    showToast(`${data.processed || 0} frete(s) no carrinho · total ${money(total)}.`);
    if (data.cartUrl) window.open(data.cartUrl, "_blank", "noopener,noreferrer");
    await loadAdminSalesProcessing({ silent: true });
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao processar pendentes.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previousHtml;
      iconRefresh();
    }
  }
}

async function generateMelhorEnvioLabel(orderId, button = null) {
  const previousHtml = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = "Gerando...";
  }
  try {
    const response = await fetch(`/api/melhor-envio/orders/${encodeURIComponent(orderId)}/label`, {
      method: "POST",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ force: true })
    });
    await readApiJson(response, "Erro ao gerar etiqueta.");
    showToast("Frete preparado no Melhor Envio.");
    await loadAdminSalesProcessing({ silent: true });
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao gerar etiqueta.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previousHtml;
      iconRefresh();
    }
  }
}

function renderAdminSalesProcessing() {
  const board = qs("[data-sales-board]");
  const statusEl = qs("[data-sales-status]");
  if (!board || !isLoggedIn()) return;

  const lanes = [
    { id: "new", label: "Novo" },
    { id: "buy", label: "Comprar" },
    { id: "ordered", label: "Comprado" },
    { id: "shipped", label: "Enviado" },
    { id: "done", label: "Finalizado" }
  ];
  const orders = Array.isArray(salesProcessingOrders) ? salesProcessingOrders : [];
  if (statusEl) {
    const activeCount = orders.filter((order) => order.processingStatus !== "done").length;
    statusEl.textContent = `${orders.length} pedido${orders.length === 1 ? "" : "s"} · ${activeCount} em aberto`;
  }

  const counts = Object.fromEntries(lanes.map((lane) => [
    lane.id,
    orders.filter((order) => order.processingStatus === lane.id).length
  ]));
  const visibleOrders = orders.filter((order) => order.processingStatus === activeSalesStatus);

  board.innerHTML = `
    ${melhorEnvioPanelHtml()}
    <div class="admin-sales-stage-tabs">
      ${lanes.map((lane) => `
        <button type="button" class="${activeSalesStatus === lane.id ? "is-active" : ""}" data-sales-stage="${escapeHtml(lane.id)}">
          <span>${lane.label}</span>
          <strong>${counts[lane.id] || 0}</strong>
        </button>
      `).join("")}
    </div>
    <div class="admin-sales-list">
      ${visibleOrders.length ? visibleOrders.map((order) => {
        const address = order.address || {};
        const customer = order.customer || {};
        const items = salesDisplayItems(order);
        return `
          <article class="admin-sales-order-card" data-sales-card="${escapeHtml(order.id)}">
            <div class="admin-sales-order-head">
              <div>
                <strong>#${escapeHtml(order.number || order.id)}</strong>
                <span>${escapeHtml(order.createdAtLabel || "")}</span>
              </div>
              <div class="admin-sales-card-actions">
                <button class="secondary-button compact-action" type="button" data-sales-move="${escapeHtml(order.id)}" data-sales-status="${escapeHtml(salesPrevStatus(order.processingStatus))}" ${order.processingStatus === "new" ? "disabled" : ""}>Voltar</button>
                <button class="primary-button compact-action" type="button" data-sales-move="${escapeHtml(order.id)}" data-sales-status="${escapeHtml(salesNextStatus(order.processingStatus))}" ${order.processingStatus === "done" ? "disabled" : ""}>${order.processingStatus === "done" ? "OK" : "Próximo"}</button>
              </div>
            </div>

            <div class="admin-sales-simple-grid">
              <section class="admin-sales-block">
                <span>Cliente</span>
                <div class="admin-sales-field-grid two">
                  ${salesFieldButton("Nome", address.receiver || customer.name, "wide")}
                  ${salesFieldButton("Telefone", customer.phone)}
                </div>
              </section>

              <section class="admin-sales-block">
                <span>Endereço</span>
                <div class="admin-sales-field-grid address">
                  ${salesFieldButton("Rua", address.street, "wide")}
                  ${salesFieldButton("Nº", address.number)}
                  ${salesFieldButton("Bairro", address.neighborhood)}
                  ${salesFieldButton("Cidade", address.city)}
                  ${salesFieldButton("UF", address.state)}
                  ${salesFieldButton("CEP", address.zip)}
                  ${address.complement ? salesFieldButton("Compl.", address.complement, "wide") : ""}
                </div>
              </section>
            </div>

            <section class="admin-sales-block">
              <span>Produto</span>
              <div class="admin-sales-products">
                ${items.map((item) => {
                  const hasCustom = Boolean(item.customName || item.customNumber);
                  return `
                  <div class="admin-sales-product-line ${hasCustom ? "has-custom" : "no-custom"}">
                    <div class="admin-sales-product-main">
                      <strong>${escapeHtml(item.model)}</strong>
                      <small>${item.quantity > 1 ? `${item.quantity}x · ` : ""}${item.size ? `Tam ${escapeHtml(item.size)}` : ""}${item.color ? ` · Cor ${escapeHtml(item.color)}` : ""}</small>
                    </div>
                    ${hasCustom ? `
                      <div class="admin-sales-custom-fields">
                        ${salesFieldButton("Nome camisa", item.customName)}
                        ${salesFieldButton("Número", item.customNumber)}
                      </div>
                    ` : ""}
                    ${item.buyLink ? `
                      <a class="primary-button compact-action admin-sales-buy-link" href="${escapeHtml(item.buyLink)}" target="_blank" rel="noopener noreferrer">
                        Comprar
                      </a>
                    ` : `<span class="admin-sales-no-link">Sem link</span>`}
                  </div>
                `;
                }).join("")}
              </div>
            </section>

            ${melhorEnvioOrderCardHtml(order)}

            <div class="admin-sales-footer">
              <input value="${escapeHtml(order.shopeeOrder || "")}" data-sales-shopee="${escapeHtml(order.id)}" placeholder="Pedido Shopee" />
              <button class="secondary-button compact-action" type="button" data-sales-save="${escapeHtml(order.id)}">
                <i data-lucide="save" aria-hidden="true"></i>
                Salvar
              </button>
            </div>
          </article>
        `;
      }).join("") : `
        <div class="admin-sales-empty wide">Nenhum pedido nesta etapa.</div>
      `}
    </div>
  `;

  iconRefresh();
}

async function loadAdminSalesProcessing({ silent = true } = {}) {
  if (!isLoggedIn()) return;
  ensureSalesFilterDefaults();
  const statusEl = qs("[data-sales-status]");
  if (statusEl && !silent) statusEl.textContent = "Buscando vendas...";

  try {
    const [, response] = await Promise.all([
      loadMelhorEnvioStatus(),
      fetch(`/api/sales-processing?${salesQueryFromAdmin().toString()}`, {
        cache: "no-store",
        headers: adminAuthHeaders()
      })
    ]);
    const data = await readApiJson(response, "Erro ao carregar vendas.");
    salesProcessingOrders = Array.isArray(data.orders) ? data.orders : [];
    renderAdminSalesProcessing();
  } catch (error) {
    console.error(error);
    if (statusEl) statusEl.textContent = error.message || "Erro ao carregar vendas.";
    showToast(error.message || "Erro ao carregar vendas.");
  }
}

async function saveSalesProcessingState(orderId, patch = {}) {
  const order = salesOrderById(orderId);
  if (!order) return;
  const shopeeInput = qsa("[data-sales-shopee]").find((input) => String(input.dataset.salesShopee) === String(orderId));
  const payload = {
    status: patch.status || order.processingStatus,
    shopeeOrder: patch.shopeeOrder != null ? patch.shopeeOrder : (shopeeInput?.value || order.shopeeOrder || ""),
    notes: patch.notes != null ? patch.notes : (order.notes || "")
  };

  const response = await fetch(`/api/sales-processing/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });
  const data = await readApiJson(response, "Erro ao salvar venda.");
  order.processingStatus = data.record?.status || payload.status;
  order.processingStatusLabel = salesStatusLabel(order.processingStatus);
  order.shopeeOrder = data.record?.shopeeOrder || payload.shopeeOrder || "";
  order.notes = data.record?.notes || payload.notes || "";
  renderAdminSalesProcessing();
}

async function copySalesInfo(orderId, kind = "all") {
  const order = salesOrderById(orderId);
  const text = order?.copy?.[kind] || "";
  if (!text) {
    showToast("Nada para copiar.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copiado.");
  } catch {
    showToast("Não consegui copiar automaticamente.");
  }
}

function packingOrderById(orderId) {
  const id = String(orderId || "");
  const personalizedOrder = packingPersonalizedMatches
    .map((result) => result.order)
    .find((order) => String(order.id) === id);
  return personalizedOrder || packingStandardOrders.find((order) => String(order.id) === id);
}

function packingStandardOrderById(orderId) {
  return packingStandardOrders.find((order) => String(order.id) === String(orderId));
}

function packingQuantityLabel(value) {
  const quantity = Number(value || 1);
  return quantity > 1 ? `${quantity}x` : "1x";
}

function packingProductName(item = {}) {
  return compactSalesProductName(item.produto || item.productName || item.model || "Produto");
}

function packingItemMeta(item = {}) {
  return [
    packingQuantityLabel(item.quantidade || item.quantity),
    item.tamanho || item.size ? `Tam ${item.tamanho || item.size}` : "",
    item.cor || item.color ? `Cor ${item.cor || item.color}` : "",
    item.nome ? `Nome ${item.nome}` : "",
    item.numero ? `Número ${item.numero}` : ""
  ].filter(Boolean).join(" · ");
}

function packingCopyAction(orderId, kind, label, icon) {
  return `
    <button class="secondary-button compact-action" type="button" data-packing-copy="${escapeHtml(kind)}" data-packing-order="${escapeHtml(orderId)}">
      <i data-lucide="${escapeHtml(icon)}" aria-hidden="true"></i>
      ${escapeHtml(label)}
    </button>
  `;
}

function packingInfoGrid(order = {}) {
  const address = order.address || {};
  const customer = order.customer || {};
  return `
    <div class="admin-packing-info-grid">
      <section class="admin-sales-block">
        <span>Cliente</span>
        <div class="admin-packing-field-grid customer">
          ${salesFieldButton("Nome", address.receiver || customer.name, "wide")}
          ${salesFieldButton("Telefone", customer.phone)}
          ${salesFieldButton("E-mail", customer.email, "wide")}
          ${customer.document ? salesFieldButton("Documento", customer.document) : ""}
        </div>
      </section>

      <section class="admin-sales-block">
        <span>Endereço</span>
        <div class="admin-packing-field-grid address">
          ${salesFieldButton("Rua", address.street, "wide")}
          ${salesFieldButton("Nº", address.number)}
          ${salesFieldButton("Bairro", address.neighborhood)}
          ${salesFieldButton("Cidade", address.city)}
          ${salesFieldButton("UF", address.state)}
          ${salesFieldButton("CEP", address.zip)}
          ${address.complement ? salesFieldButton("Compl.", address.complement, "wide") : ""}
        </div>
      </section>
    </div>
  `;
}

function packingLineList(items = [], { activeIndex = -1, empty = "Nenhum item." } = {}) {
  if (!items.length) {
    return `<div class="admin-packing-empty">${escapeHtml(empty)}</div>`;
  }
  return `
    <div class="admin-packing-line-list">
      ${items.map((item, index) => `
        <div class="admin-packing-line ${Number(item.index ?? index) === Number(activeIndex) ? "is-active" : ""}">
          <div>
            <strong>${escapeHtml(packingProductName(item))}</strong>
            <small>${escapeHtml(packingItemMeta(item))}</small>
          </div>
          ${item.buyLink ? `
            <a class="secondary-button compact-action" href="${escapeHtml(item.buyLink)}" target="_blank" rel="noopener noreferrer">
              <i data-lucide="external-link" aria-hidden="true"></i>
              Link
            </a>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function packingPersonalizedCard(result = {}) {
  const order = result.order || {};
  const match = result.match || {};
  const customer = order.customer || {};
  const address = order.address || {};
  const orderId = order.id || order.number || "";
  const matchedTitle = [
    match.nome ? `Nome ${match.nome}` : "",
    match.numero ? `Número ${match.numero}` : ""
  ].filter(Boolean).join(" · ");
  return `
    <article class="admin-packing-order-card is-personalized">
      <div class="admin-packing-card-head">
        <div>
          <span class="admin-packing-pill">#${escapeHtml(order.number || order.id)}</span>
          <strong>${escapeHtml(address.receiver || customer.name || "Cliente")}</strong>
          <small>${escapeHtml([order.createdAtLabel, order.yampiStatus?.name].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="admin-packing-card-actions">
          ${packingCopyAction(orderId, "address", "Endereço", "map-pin")}
          ${packingCopyAction(orderId, "customer", "Contato", "phone")}
          ${packingCopyAction(orderId, "all", "Tudo", "copy")}
        </div>
      </div>

      <div class="admin-packing-focus-card">
        <div class="admin-packing-focus-icon">
          <i data-lucide="shirt" aria-hidden="true"></i>
        </div>
        <div>
          <span>Camisa encontrada</span>
          <strong>${escapeHtml(matchedTitle || "Personalização")}</strong>
          <small>${escapeHtml(packingItemMeta(match))}</small>
        </div>
      </div>

      ${packingInfoGrid(order)}

      <div class="admin-packing-section-grid">
        <section class="admin-sales-block">
          <span>Camisas do pedido</span>
          ${packingLineList(order.personalizations || [], { activeIndex: match.index })}
        </section>
        <section class="admin-sales-block">
          <span>Outros itens</span>
          ${packingLineList(order.otherItems || [], { empty: "Sem item extra." })}
        </section>
      </div>
    </article>
  `;
}

function renderPackingPersonalizedResults(data = {}) {
  const list = qs("[data-packing-personalized-results]");
  const status = qs("[data-packing-personalized-status]");
  if (!list || !status || !isLoggedIn()) return;

  const matches = Array.isArray(data.matches) ? data.matches : packingPersonalizedMatches;
  packingPersonalizedMatches = matches;
  if (!matches.length) {
    status.textContent = data.filters?.name ? "Nenhuma camiseta encontrada com esses dados." : "Digite um nome para localizar.";
    list.innerHTML = "";
    iconRefresh();
    return;
  }

  status.textContent = `${matches.length} resultado${matches.length === 1 ? "" : "s"} encontrado${matches.length === 1 ? "" : "s"}.`;
  list.innerHTML = matches.map(packingPersonalizedCard).join("");
  iconRefresh();
}

async function loadPackingPersonalized({ silent = false } = {}) {
  if (!isLoggedIn()) return;
  const nameInput = qs("[data-packing-personalized-name]");
  const numberInput = qs("[data-packing-personalized-number]");
  const status = qs("[data-packing-personalized-status]");
  const name = nameInput?.value.trim() || "";
  const number = numberInput?.value.trim() || "";
  if (!name) {
    packingPersonalizedMatches = [];
    if (status) status.textContent = number ? "Digite o nome da camiseta para buscar." : "Digite um nome para localizar.";
    renderPackingPersonalizedResults({ matches: [] });
    return;
  }

  const params = new URLSearchParams({ name });
  if (number) params.set("number", number);
  if (status && !silent) status.textContent = "Buscando camiseta...";

  try {
    const response = await fetch(`/api/packing/personalized?${params.toString()}`, {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await readApiJson(response, "Erro ao buscar camiseta.");
    renderPackingPersonalizedResults(data);
  } catch (error) {
    console.error(error);
    if (status) status.textContent = error.message || "Erro ao buscar camiseta.";
    showToast(error.message || "Erro ao buscar camiseta.");
  }
}

function ensurePackingStandardFilterDefaults() {
  const today = profitTodayInputDate();
  const fromInput = qs("[data-packing-standard-filter='from']");
  const toInput = qs("[data-packing-standard-filter='to']");
  if (fromInput && !fromInput.value) fromInput.value = today;
  if (toInput && !toInput.value) toInput.value = today;
}

function packingStandardQueryFromAdmin() {
  ensurePackingStandardFilterDefaults();
  const params = new URLSearchParams();
  params.set("from", qs("[data-packing-standard-filter='from']")?.value || profitTodayInputDate());
  params.set("to", qs("[data-packing-standard-filter='to']")?.value || profitTodayInputDate());
  const search = qs("[data-packing-standard-search]")?.value.trim() || "";
  if (search) params.set("search", search);
  return params;
}

function renderPackingStandardOrders(data = {}) {
  const list = qs("[data-packing-standard-list]");
  const status = qs("[data-packing-standard-status]");
  if (!list || !status || !isLoggedIn()) return;

  const orders = Array.isArray(data.orders) ? data.orders : packingStandardOrders;
  packingStandardOrders = orders;
  status.textContent = `${orders.length} pedido${orders.length === 1 ? "" : "s"} sem personalizada.`;

  if (!orders.length) {
    list.innerHTML = `<div class="admin-packing-empty wide">Nenhum pedido normal neste período.</div>`;
    iconRefresh();
    return;
  }

  list.innerHTML = orders.map((order) => {
    const customer = order.customer || {};
    const address = order.address || {};
    const orderId = order.id || order.number || "";
    return `
      <article class="admin-packing-order-card is-standard">
        <div class="admin-packing-card-head">
          <div>
            <span class="admin-packing-pill">#${escapeHtml(order.number || order.id)}</span>
            <strong>${escapeHtml(address.receiver || customer.name || "Cliente")}</strong>
            <small>${escapeHtml([order.createdAtLabel, order.yampiStatus?.name].filter(Boolean).join(" · "))}</small>
          </div>
          <div class="admin-packing-card-actions">
            ${packingCopyAction(orderId, "address", "Endereço", "map-pin")}
            ${packingCopyAction(orderId, "items", "Itens", "package")}
            ${packingCopyAction(orderId, "all", "Tudo", "copy")}
          </div>
        </div>

        ${packingInfoGrid(order)}

        <section class="admin-sales-block">
          <span>Itens Shopee</span>
          ${packingLineList(order.items || [])}
        </section>

        <div class="admin-packing-footer">
          <input value="${escapeHtml(order.shopeeOrder || "")}" data-packing-shopee="${escapeHtml(order.id)}" placeholder="Pedido Shopee" />
          <button class="secondary-button compact-action" type="button" data-packing-standard-save="${escapeHtml(order.id)}">
            <i data-lucide="save" aria-hidden="true"></i>
            Salvar
          </button>
        </div>
      </article>
    `;
  }).join("");

  iconRefresh();
}

async function loadPackingStandard({ silent = true } = {}) {
  if (!isLoggedIn()) return;
  ensurePackingStandardFilterDefaults();
  const status = qs("[data-packing-standard-status]");
  if (status && !silent) status.textContent = "Buscando fila...";

  try {
    const response = await fetch(`/api/packing/standard?${packingStandardQueryFromAdmin().toString()}`, {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await readApiJson(response, "Erro ao carregar fila.");
    renderPackingStandardOrders(data);
  } catch (error) {
    console.error(error);
    if (status) status.textContent = error.message || "Erro ao carregar fila.";
    showToast(error.message || "Erro ao carregar fila.");
  }
}

async function savePackingStandardState(orderId) {
  const order = packingStandardOrderById(orderId);
  if (!order) return;
  const shopeeInput = qsa("[data-packing-shopee]").find((input) => String(input.dataset.packingShopee) === String(orderId));
  const payload = {
    status: order.processingStatus || "new",
    shopeeOrder: shopeeInput?.value || order.shopeeOrder || "",
    notes: order.notes || ""
  };

  const response = await fetch(`/api/sales-processing/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });
  const data = await readApiJson(response, "Erro ao salvar pedido.");
  order.shopeeOrder = data.record?.shopeeOrder || payload.shopeeOrder || "";
  order.processingStatus = data.record?.status || payload.status;
  renderPackingStandardOrders({ orders: packingStandardOrders });
}

async function copyPackingInfo(orderId, kind = "all") {
  const order = packingOrderById(orderId);
  const text = order?.copy?.[kind] || "";
  if (!text) {
    showToast("Nada para copiar.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copiado.");
  } catch {
    showToast("Não consegui copiar automaticamente.");
  }
}


function profitTodayInputDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function profitNumberInput(value) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function ensureProfitFilterDefaults() {
  const today = profitTodayInputDate();
  const fromInput = qs("[data-profit-filter='from']");
  const toInput = qs("[data-profit-filter='to']");
  const statusInput = qs("[data-profit-filter='status']");
  if (fromInput && !fromInput.value) fromInput.value = today;
  if (toInput && !toInput.value) toInput.value = today;
  if (statusInput && !statusInput.value) statusInput.value = "paid";
}

function profitQueryFromAdmin() {
  ensureProfitFilterDefaults();
  const params = new URLSearchParams();
  const from = qs("[data-profit-filter='from']")?.value || profitTodayInputDate();
  const to = qs("[data-profit-filter='to']")?.value || from;
  const status = qs("[data-profit-filter='status']")?.value || "paid";
  const search = qs("[data-profit-search]")?.value.trim() || "";
  params.set("from", from);
  params.set("to", to);
  params.set("status", status);
  if (search) params.set("search", search);
  return params;
}

function setProfitMetric(name, value, { currency = true } = {}) {
  const el = qs(`[data-profit-metric="${name}"]`);
  if (!el) return;
  el.textContent = currency ? money(value) : String(value || 0);
  if (name === "profit") {
    el.classList.toggle("is-negative", Number(value || 0) < 0);
  }
}

function profitStatusLabel(status = {}) {
  const label = status.name || status.alias || "Sem status";
  return String(label).trim() || "Sem status";
}

function profitCostSourceLabel(source = "") {
  if (source === "supplier") return "Fornecedor";
  if (source === "manual") return "Cadastrado";
  if (source === "yampi") return "Yampi";
  return "Sem custo";
}

function renderAdminProfitReport() {
  const ordersEl = qs("[data-profit-orders]");
  const statusEl = qs("[data-profit-status]");
  if (!ordersEl || !isLoggedIn()) return;

  const summary = profitReport?.summary || {};
  setProfitMetric("profit", summary.profit || 0);
  setProfitMetric("gross", summary.grossRevenue || 0);
  setProfitMetric("cost", summary.totalCost || summary.productCost || 0);
  setProfitMetric("orders", summary.orderCount || 0, { currency: false });
  setProfitMetric("missing", summary.missingCostItems || 0, { currency: false });
  setProfitMetric("ticket", summary.averageTicket || 0);

  const orders = Array.isArray(profitReport?.orders) ? profitReport.orders : [];
  if (statusEl) {
    const filters = profitReport?.filters;
    const missing = Number(summary.missingCostItems || 0);
    statusEl.textContent = filters
      ? `${orders.length} pedido${orders.length === 1 ? "" : "s"}${missing ? ` · ${missing} sem custo` : ""}`
      : "Selecione o período.";
  }

  if (!orders.length) {
    ordersEl.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhum pedido encontrado</strong>
      </div>
    `;
    iconRefresh();
    return;
  }

  ordersEl.innerHTML = `
    <div class="admin-profit-table">
      <div class="admin-profit-row is-head">
        <span>Pedido</span>
        <span>Itens</span>
        <span>Venda</span>
        <span>Custo + frete</span>
        <span>Lucro</span>
      </div>
      ${orders.map((order) => {
        const itemsLabel = order.items.map((item) => {
          const variation = [item.color, item.size ? `Tam ${item.size}` : ""].filter(Boolean).join(" · ");
          return `${item.productName || "Produto"}${variation ? ` (${variation})` : ""}`;
        }).join(" + ");
        const missing = Number(order.missingCostItems || 0);
        return `
          <div class="admin-profit-row">
            <div class="admin-profit-order-cell">
              ${order.publicUrl ? `
                <a href="${escapeHtml(order.publicUrl)}" target="_blank" rel="noopener noreferrer">#${escapeHtml(order.number || order.id)}</a>
              ` : `<strong>#${escapeHtml(order.number || order.id)}</strong>`}
              <small>${escapeHtml(order.createdAtLabel || "")}</small>
            </div>
            <div class="admin-profit-items-cell">
              <strong>${escapeHtml(itemsLabel)}</strong>
              ${missing ? `<em>${missing} sem custo</em>` : ""}
            </div>
            <strong>${money(order.grossRevenue)}</strong>
            <strong>${money(order.totalCost || order.productCost)}</strong>
            <strong class="${Number(order.profit || 0) < 0 ? "is-negative" : "is-positive"}">${money(order.profit)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;

  iconRefresh();
}

function renderProfitCostEditor() {
  const list = qs("[data-profit-cost-list]");
  if (!list || !isLoggedIn()) return;

  const term = normalizeSearch(qs("[data-profit-cost-search]")?.value || "");
  const visibleOptions = profitCostOptions.filter((option) => {
    const haystack = normalizeSearch([
      option.productName,
      option.sku,
      option.size,
      option.color
    ].filter(Boolean).join(" "));
    return !term || haystack.includes(term);
  });

  const count = qs("[data-profit-cost-count]");
  if (count) {
    count.textContent = `${profitCostOptions.length} variação${profitCostOptions.length === 1 ? "" : "ões"}`;
  }

  if (!visibleOptions.length) {
    list.innerHTML = `
      <div class="admin-empty-state compact-empty">
        <strong>Nenhuma variação encontrada</strong>
        <p>Sincronize os produtos da Yampi ou limpe a busca de custos.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="admin-profit-cost-table">
      <div class="admin-profit-cost-row is-head">
        <span>Produto</span>
        <span>Variação</span>
        <span>Venda</span>
        <span>Custo real</span>
        <span>Link compra</span>
        <span>Obs.</span>
      </div>
      ${visibleOptions.map((option) => `
        <div class="admin-profit-cost-row">
          <div class="admin-profit-cost-product">
            <strong>${escapeHtml(option.productName || "Produto")}</strong>
            <small>${option.sku ? `SKU ${escapeHtml(option.sku)}` : (option.skuId ? `SKU ID ${escapeHtml(option.skuId)}` : "Sem SKU")}</small>
          </div>
          <span>${option.color ? `Cor ${escapeHtml(option.color)} · ` : ""}Tam ${escapeHtml(option.size || "Único")}</span>
          <span>${option.salePrice ? money(option.salePrice) : "-"}</span>
          <label class="admin-profit-cost-input">
            <span>Custo</span>
            <input type="number" inputmode="decimal" min="0" step="0.01" value="${option.cost ? Number(option.cost).toFixed(2) : ""}" data-profit-cost-input="${escapeHtml(option.id)}" placeholder="0,00" />
          </label>
          <input class="admin-profit-notes-input" value="${escapeHtml(option.buyLink || "")}" data-profit-cost-link="${escapeHtml(option.id)}" placeholder="link do fornecedor" />
          <input class="admin-profit-notes-input" value="${escapeHtml(option.notes || "")}" data-profit-cost-notes="${escapeHtml(option.id)}" placeholder="fornecedor, lote..." />
        </div>
      `).join("")}
    </div>
  `;
}

function syncProfitCostOptionFromInput(input) {
  const id = input?.dataset?.profitCostInput || input?.dataset?.profitCostLink || input?.dataset?.profitCostNotes;
  if (!id) return;
  const option = profitCostOptions.find((item) => item.id === id);
  if (!option) return;
  if (input.dataset.profitCostInput) {
    option.cost = profitNumberInput(input.value);
  } else if (input.dataset.profitCostLink) {
    option.buyLink = input.value.trim();
  } else {
    option.notes = input.value.trim();
  }
}

function syncVisibleProfitCostInputs() {
  qsa("[data-profit-cost-input], [data-profit-cost-link], [data-profit-cost-notes]").forEach(syncProfitCostOptionFromInput);
}

function profitCostEntriesFromAdmin() {
  syncVisibleProfitCostInputs();
  return profitCostOptions
    .filter((option) => Number(option.cost || 0) > 0)
    .map((option) => ({
      id: option.id,
      productId: option.productId,
      productName: option.productName,
      skuId: option.skuId,
      sku: option.sku,
      size: option.size || "Unico",
      color: option.color || "",
      cost: Number(option.cost || 0),
      buyLink: option.buyLink || "",
      notes: option.notes || ""
    }));
}

async function loadProfitCosts({ silent = true } = {}) {
  if (!isLoggedIn()) return;
  const list = qs("[data-profit-cost-list]");
  if (list && !silent) {
    list.innerHTML = `<div class="admin-empty-state compact-empty"><strong>Carregando custos...</strong></div>`;
  }

  try {
    const response = await fetch("/api/profit/costs", {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await readApiJson(response, "Erro ao carregar custos reais.");
    profitCostOptions = Array.isArray(data.options) ? data.options : [];
    renderProfitCostEditor();
  } catch (error) {
    console.error(error);
    if (!silent) showToast(error.message || "Erro ao carregar custos reais.");
  }
}

async function saveProfitCostsFromAdmin() {
  if (!isLoggedIn()) return;
  const button = qs("[data-profit-cost-save]");
  const previous = button?.innerHTML;

  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = `<i data-lucide="loader-circle" aria-hidden="true"></i> Salvando...`;
      iconRefresh();
    }
    const response = await fetch("/api/profit/costs", {
      method: "PUT",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ costs: profitCostEntriesFromAdmin() })
    });
    const data = await readApiJson(response, "Erro ao salvar custos reais.");
    profitCostOptions = Array.isArray(data.options) ? data.options : [];
    renderProfitCostEditor();
    await loadAdminProfit({ silent: true });
    showToast("Custos reais salvos.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao salvar custos reais.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previous || `<i data-lucide="save" aria-hidden="true"></i> Salvar custos`;
      iconRefresh();
    }
  }
}

async function loadAdminProfit({ silent = true } = {}) {
  if (!isLoggedIn()) return;
  ensureProfitFilterDefaults();
  const statusEl = qs("[data-profit-status]");
  if (statusEl && !silent) statusEl.textContent = "Buscando pedidos na Yampi...";

  try {
    const response = await fetch(`/api/profit?${profitQueryFromAdmin().toString()}`, {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    profitReport = await readApiJson(response, "Erro ao carregar lucro.");
    renderAdminProfitReport();
  } catch (error) {
    console.error(error);
    if (statusEl) statusEl.textContent = error.message || "Erro ao carregar lucro.";
    showToast(error.message || "Erro ao carregar lucro.");
  }
}

async function loadAdminReviews() {
  if (!isLoggedIn()) return;
  try {
    const response = await fetch("/api/reviews", {
      cache: "no-store",
      headers: adminAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Erro ao carregar depoimentos.");
    reviewModeration = Array.isArray(data.reviews) ? data.reviews : [];
    renderAdminReviews();
    updateAdminMetrics();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao carregar depoimentos.");
  }
}

async function updateReviewStatus(reviewId, status) {
  const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || "Erro ao atualizar depoimento.");
  reviewModeration = Array.isArray(data.reviews) ? data.reviews : [];
  renderAdminReviews();
  await loadCatalogProducts({ silent: true });
}

async function deleteAdminReview(reviewId) {
  const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
    headers: adminAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || "Erro ao excluir depoimento.");
  reviewModeration = Array.isArray(data.reviews) ? data.reviews : [];
  renderAdminReviews();
  await loadCatalogProducts({ silent: true });
}

function selectedProductIds() {
  return qsa("[data-product-select]:checked").map((input) => input.dataset.productSelect);
}

function updateSelectedProductsState() {
  const selected = selectedProductIds();
  const countEl = document.querySelector("[data-selected-products-count]");
  const selectAll = document.querySelector("[data-select-all-products]");
  const deleteButton = document.querySelector("[data-delete-selected-products]");
  const checkboxes = qsa("[data-product-select]");

  if (countEl) countEl.textContent = `${selected.length} selecionado${selected.length === 1 ? "" : "s"}`;
  if (deleteButton) deleteButton.disabled = selected.length === 0;
  if (selectAll) {
    selectAll.checked = Boolean(checkboxes.length && selected.length === checkboxes.length);
    selectAll.indeterminate = Boolean(selected.length && selected.length < checkboxes.length);
  }
}

async function deleteProductsByIds(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) {
    showToast("Selecione pelo menos um produto.");
    return;
  }

  try {
    let lastPayload = null;
    for (const id of uniqueIds) {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: adminAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Erro ao excluir produto.");
      }
      lastPayload = data;
    }

    if (lastPayload?.products) {
      applyCatalogData(lastPayload);
    } else {
      products = products.filter((item) => !uniqueIds.includes(item.id));
      cart = cart.filter((item) => !uniqueIds.includes(item.productId));
      saveProducts();
      saveCart();
      renderProducts();
      renderCart();
      renderAdminList();
      updateAdminMetrics();
      renderAdminCategories();
    }

    showToast(`${uniqueIds.length} produto${uniqueIds.length === 1 ? "" : "s"} excluído${uniqueIds.length === 1 ? "" : "s"} do site.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao excluir produto.");
  }
}

async function saveProduct(product) {
  product = normalizeProduct(product);
  const existingIndex = products.findIndex((item) => item.id === product.id);

  if (existingIndex < 0) {
    throw new Error("Produto não encontrado no catálogo Yampi.");
  }

  const metadataPayload = {
    premium: product.premium,
    variantConfig: product.variantConfig,
    customization: product.customization
  };
  if (product.mediaUpdated) {
    metadataPayload.media = {
      image: product.image,
      images: product.images
    };
  }

  const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/metadata`, {
    method: "PUT",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(metadataPayload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Erro ao salvar conteúdo da página.");
  }

  if (data.products) {
    products = data.products.map(normalizeProduct);
  } else if (data.product) {
    products[existingIndex] = normalizeProduct(data.product);
  }

  categories = mergeCatalogCategories(data.categories, products);
  saveProducts();
  saveCategories();
  renderProducts();
  renderAdminList();
  updateAdminMetrics();
  renderAdminCategories();
  route();
  productMediaDirty = false;
}

async function generateAiReviewsForProduct(productId, button = null) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const originalHtml = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<i data-lucide="loader-circle" aria-hidden="true"></i> Gerando...`;
    iconRefresh();
  }

  try {
    showToast(`Gerando 10 depoimentos IA para ${product.name}...`);
    const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/ai-reviews`, {
      method: "POST",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ count: 10 })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao gerar depoimentos IA.");
    }

    if (data.products) {
      applyCatalogData(data);
    } else if (data.product) {
      const index = products.findIndex((item) => item.id === product.id);
      if (index >= 0) products[index] = normalizeProduct(data.product);
      saveProducts();
      renderProducts();
      renderAdminList();
      updateAdminMetrics();
      route();
    }

    const updatedProduct = products.find((item) => item.id === product.id);
    const openForm = qs("[data-product-form]");
    if (updatedProduct && openForm?.elements?.id?.value === product.id) {
      fillProductForm(updatedProduct);
    }

    showToast(data.message || "10 depoimentos IA gerados com selo.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao gerar depoimentos IA.");
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      if (originalHtml) button.innerHTML = originalHtml;
      iconRefresh();
    }
  }
}

function homeOrderEntriesFromAdmin() {
  return qsa("[data-home-order-input]")
    .map((input, index) => ({
      productId: input.dataset.homeOrderInput,
      homeSortOrder: Math.max(1, Number(input.value || index + 1))
    }))
    .filter((item) => item.productId && Number.isFinite(item.homeSortOrder));
}

async function saveHomeProductOrderFromAdmin() {
  const order = homeOrderEntriesFromAdmin();
  if (!order.length) return;

  try {
    const response = await fetch("/api/products/home-order", {
      method: "PUT",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ order })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao salvar ordem da home.");
    }
    applyCatalogData(data);
    showToast(data.message || "Ordem da página principal salva.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao salvar ordem da home.");
  }
}

function renderAdminBanners() {
  const list = document.getElementById("admin-banner-list");
  if (!list || !isLoggedIn()) return;

  list.innerHTML = banners
    .map(
      (b) => `
        <article class="admin-item">
          <img src="${assetUrl(b.desktopImage)}" alt="${b.title}" />
          <div>
            <h3>${b.title}</h3>
            <p>${b.eyebrow || "Coleção"} - ${b.subtitle.substring(0, 50)}...</p>
          </div>
          <div class="admin-actions">
            <button class="secondary-button" type="button" data-edit-banner="${b.id}">Editar</button>
            <button class="danger-button" type="button" data-delete-banner="${b.id}">Excluir</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function saveBanner(banner) {
  const previousBanners = banners.slice();
  const existingIndex = banners.findIndex((b) => b.id === banner.id);
  let savedId = banner.id;

  try {
    if (existingIndex >= 0) {
      banners[existingIndex] = banner;
    } else {
      let id = banner.id;
      let suffix = 2;
      while (banners.some((b) => b.id === id)) {
        id = `${banner.id}-${suffix}`;
        suffix += 1;
      }
      savedId = id;
      banners.push({ ...banner, id });
    }

    await persistBanners();
  } catch (error) {
    banners = previousBanners;
    throw error;
  }

  renderHomeBanners();
  renderAdminBanners();
  return savedId;
}

function fillBannerForm(banner) {
  const form = document.getElementById("admin-banner-form");
  if (!form) return;

  form.elements.id.value = banner.id;
  if (form.elements.eyebrow) form.elements.eyebrow.value = banner.eyebrow || "";
  if (form.elements.title) form.elements.title.value = banner.title || "";
  if (form.elements.subtitle) form.elements.subtitle.value = banner.subtitle || "";
  if (form.elements.linkUrl) form.elements.linkUrl.value = banner.linkUrl || "";
  if (form.elements.linkText) form.elements.linkText.value = banner.linkText || "";
  form.elements.desktopImage.value = banner.desktopImage;
  form.elements.mobileImage.value = banner.mobileImage;

  // Previews
  const deskPreview = document.getElementById("banner-desktop-preview");
  const mobPreview = document.getElementById("banner-mobile-preview");
  if (deskPreview) deskPreview.src = assetUrl(banner.desktopImage);
  if (mobPreview) mobPreview.src = assetUrl(banner.mobileImage);

  const alertEl = document.getElementById("banner-edit-mode-alert");
  const nameEl = document.getElementById("admin-editing-banner-title");
  if (alertEl) alertEl.style.display = "flex";
  if (nameEl) nameEl.textContent = banner.title;

  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelBannerEdit() {
  const form = document.getElementById("admin-banner-form");
  if (form) {
    form.reset();
    form.elements.id.value = "";
  }

  const deskPreview = document.getElementById("banner-desktop-preview");
  const mobPreview = document.getElementById("banner-mobile-preview");
  if (deskPreview) deskPreview.src = assetUrl(PLACEHOLDER_IMAGE);
  if (mobPreview) mobPreview.src = assetUrl(PLACEHOLDER_IMAGE);

  const alertEl = document.getElementById("banner-edit-mode-alert");
  if (alertEl) alertEl.style.display = "none";
}

function renderAdminSiteContentForm() {
  const form = document.getElementById("admin-site-content-form");
  if (!form || !isLoggedIn()) return;

  const lowerBanner = siteContent.lowerBanner || defaultSiteContent.lowerBanner;
  const aboutPhotos = siteContent.aboutPhotos || defaultSiteContent.aboutPhotos;
  const fields = {
    lowerBannerLinkUrl: lowerBanner.linkUrl || "",
    lowerBannerDesktopImage: lowerBanner.desktopImage || PLACEHOLDER_IMAGE,
    lowerBannerMobileImage: lowerBanner.mobileImage || PLACEHOLDER_IMAGE,
    aboutPhotoOne: aboutPhotos.photoOne || PLACEHOLDER_IMAGE,
    aboutPhotoTwo: aboutPhotos.photoTwo || PLACEHOLDER_IMAGE
  };

  Object.entries(fields).forEach(([name, value]) => {
    if (form.elements[name]) {
      form.elements[name].value = value;
    }
  });

  const previews = {
    "lower-banner-desktop-preview": fields.lowerBannerDesktopImage,
    "lower-banner-mobile-preview": fields.lowerBannerMobileImage,
    "about-photo-one-preview": fields.aboutPhotoOne,
    "about-photo-two-preview": fields.aboutPhotoTwo
  };

  Object.entries(previews).forEach(([id, value]) => {
    const img = document.getElementById(id);
    if (img) img.src = assetUrl(value);
  });
}

function bindAdminImageUpload({ fileId, inputId, previewId, maxWidth, maxHeight, label, onUploaded }) {
  const fileInput = document.getElementById(fileId);
  if (!fileInput) return;

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      showToast(`Processando ${label}...`);
      const webpDataUrl = await convertToWebP(file, maxWidth, maxHeight, 0.82);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: adminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ image: webpDataUrl })
      });
      
      const data = await readApiJson(response, "Erro no upload");

      const input = document.getElementById(inputId);
      const preview = document.getElementById(previewId);
      if (input) {
        input.value = data.url;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (preview) preview.src = data.url;
      if (typeof onUploaded === "function") {
        onUploaded(data.url, { input, preview, fileInput });
      }
      showToast(`${label} salva e enviada.`);
    } catch (err) {
      console.error(err);
      showToast("Erro ao processar imagem.");
    } finally {
      fileInput.value = "";
    }
  });
}


function bindEvents() {
  document.addEventListener("click", (event) => {
    // Star rating buttons selection
    const starSelectBtn = event.target.closest(".star-select-btn");
    if (starSelectBtn) {
      event.preventDefault();
      const value = Number(starSelectBtn.dataset.starValue || 5);
      const container = starSelectBtn.closest("[data-rating-buttons]");
      const form = starSelectBtn.closest("form");

      if (container && form) {
        const input = form.querySelector('input[name="reviewStars"]');
      if (input) {
        input.value = String(value);
      }
      const ratingValue = form.querySelector("[data-review-rating-value]");
      if (ratingValue) {
        ratingValue.textContent = `${value}/5`;
      }

        container.querySelectorAll(".star-select-btn").forEach((btn) => {
          const btnVal = Number(btn.dataset.starValue || 0);
          btn.classList.toggle("is-active", btnVal <= value);
        });
      }
      return;
    }

    const target = event.target.closest("button, a");

    // Photo selector star button click
    const starBtn = event.target.closest(".photo-card-star");
    if (starBtn) {
      event.preventDefault();
      event.stopPropagation();
      const url = starBtn.dataset.starUrl;
      selectedMainImage = url;
      if (!selectedGalleryImages.includes(url)) {
        selectedGalleryImages.push(url);
      }
      productMediaDirty = true;
      renderPhotoSelector();
      return;
    }

    const removePhotoBtn = event.target.closest("[data-photo-remove]");
    if (removePhotoBtn) {
      event.preventDefault();
      event.stopPropagation();
      const url = removePhotoBtn.dataset.photoRemove;
      selectedGalleryImages = selectedGalleryImages.filter((image) => image !== url);
      if (selectedMainImage === url) {
        selectedMainImage = selectedGalleryImages[0] || "";
      }
      productMediaDirty = true;
      renderPhotoSelector();
      return;
    }

    // Photo selector card click
    const photoCard = event.target.closest(".photo-card");
    if (photoCard) {
      const url = photoCard.dataset.photoUrl;
      selectedMainImage = url;
      if (!selectedGalleryImages.includes(url)) {
        selectedGalleryImages.push(url);
      }
      productMediaDirty = true;
      renderPhotoSelector();
      return;
    }

    const variantImageChoice = event.target.closest("[data-variant-image-pick]");
    if (variantImageChoice) {
      event.preventDefault();
      const color = normalizeVariantText(variantImageChoice.dataset.variantImagePick);
      const image = normalizeVariantText(variantImageChoice.dataset.variantImageValue);
      if (color) {
        if (image) {
          adminVariantConfig.colorImages[color] = image;
        } else {
          delete adminVariantConfig.colorImages[color];
        }
        syncVariantConfigInput();
        renderVariantMatrixEditor();
      }
      return;
    }

    // Thumbnail click on product page
    const thumbBtn = event.target.closest("[data-thumb]");
    if (thumbBtn) {
      setProductMainMedia(thumbBtn.dataset.thumb);

      const row = thumbBtn.closest("[data-thumb-row]");
      if (row && row.scrollWidth > row.clientWidth + 2) {
        const rowRect = row.getBoundingClientRect();
        const thumbRect = thumbBtn.getBoundingClientRect();
        const rowGap = Number.parseFloat(getComputedStyle(row).gap || "0");
        const step = thumbRect.width + rowGap;

        if (thumbRect.right >= rowRect.right - 12) {
          row.scrollBy({ left: step, behavior: "smooth" });
        } else if (thumbRect.left <= rowRect.left + 12) {
          row.scrollBy({ left: -step, behavior: "smooth" });
        }
      }
      return;
    }

    const thumbScrollBtn = event.target.closest("[data-thumb-scroll]");
    if (thumbScrollBtn) {
      const row = qs("[data-thumb-row]");
      if (row) {
        const firstThumb = row.querySelector(".dufins-thumb-btn");
        const rowGap = Number.parseFloat(getComputedStyle(row).gap || "0");
        const step = firstThumb ? firstThumb.getBoundingClientRect().width + rowGap : 96;
        row.scrollBy({
          left: Number(thumbScrollBtn.dataset.thumbScroll || 1) * step,
          behavior: "smooth"
        });
      }
      return;
    }

    const reviewToggle = event.target.closest("[data-review-toggle]");
    if (reviewToggle) {
      const form = document.getElementById(reviewToggle.getAttribute("aria-controls"));
      if (form) {
        form.hidden = !form.hidden;
        reviewToggle.setAttribute("aria-expanded", String(!form.hidden));
      }
      return;
    }

    const reviewPageButton = event.target.closest("[data-review-page]");
    if (reviewPageButton && !reviewPageButton.disabled) {
      const productId = reviewPageButton.dataset.reviewProduct;
      const page = Math.max(1, Number(reviewPageButton.dataset.reviewPage || 1));
      if (productId) {
        reviewPageByProduct.set(productId, page);
        renderProductPage(productId);
        qs("#avaliacoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    const productZoomTrigger = event.target.closest("[data-product-zoom], .dufins-main-media img");
    if (productZoomTrigger) {
      const modal = qs("[data-product-zoom-modal]");
      const mainImg = document.getElementById("main-product-image");
      const zoomImage = qs("[data-product-zoom-image]");
      if (modal && mainImg && zoomImage) {
        zoomImage.src = mainImg.src;
        modal.hidden = false;
        document.body.classList.add("zoom-open");
      }
      return;
    }

    if (event.target.closest("[data-zoom-close]")) {
      const modal = qs("[data-product-zoom-modal]");
      if (modal) {
        modal.hidden = true;
        document.body.classList.remove("zoom-open");
      }
      return;
    }

    if (event.target.closest("[data-size-guide-open]")) {
      const modal = qs("[data-size-guide-modal]");
      if (modal) {
        modal.hidden = false;
        document.body.classList.add("size-guide-open");
      }
      return;
    }

    if (event.target.closest("[data-size-guide-close]")) {
      const modal = qs("[data-size-guide-modal]");
      if (modal) {
        modal.hidden = true;
        document.body.classList.remove("size-guide-open");
      }
      return;
    }

    // Cancel edit mode button
    if (target && target.matches("#btn-cancel-edit-mode")) {
      cancelEditMode();
      return;
    }

    const clickedCategoryPanel = event.target.closest("[data-category-panel]");
    const clickedCategoryToggle = event.target.closest("[data-category-toggle]");
    if (!clickedCategoryPanel && !clickedCategoryToggle) {
      closeCategoryPanel();
    }

    const clickedSearchPanel = event.target.closest("[data-search-panel]");
    const clickedSearchToggle = event.target.closest("[data-search-toggle]");
    if (!clickedSearchPanel && !clickedSearchToggle) {
      closeSearchPanel();
    }

    if (!target) return;

    const categoryToggle = target.closest("[data-category-toggle]");
    if (categoryToggle) {
      event.preventDefault();
      if (qs("[data-category-panel]")?.hidden === false) {
        closeCategoryPanel();
      } else {
        openCategoryPanel();
      }
      return;
    }

    const categoryPick = target.closest("[data-category-pick]");
    if (categoryPick) {
      event.preventDefault();
      selectCategory(categoryPick.dataset.categoryPick || "Todos", { clearSearch: true });
      return;
    }

    if (target.matches("[data-category-close]")) {
      event.preventDefault();
      closeCategoryPanel();
      return;
    }

    if (target.matches("[data-search-clear]")) {
      event.preventDefault();
      searchTerm = "";
      syncSearchInputs();
      updateCatalogUrl();
      renderProducts();
      return;
    }

    const collectionButton = target.closest("[data-collection-scroll]");
    if (collectionButton) {
      collectionScrollStep(Number(collectionButton.dataset.collectionScroll || 1));
      startCollectionCarousel();
      return;
    }

    if (target.matches("[data-menu-toggle]")) {
      qs("[data-main-nav]").classList.toggle("is-open");
    }

    if (target.matches("[data-search-toggle]")) {
      openSearchPanel();
      return;
    }

    if (target.matches("[data-search-close]")) {
      closeSearchPanel();
      return;
    }

    if (target.matches("[data-category]")) {
      event.preventDefault();
      activeCategory = target.dataset.category;
      activeCollectionId = "";
      if (isCatalogPath()) {
        updateCatalogUrl();
      }
      renderProducts();
    }

    if (target.matches("[data-filter-link]")) {
      activeCategory = target.dataset.filterLink;
      activeCollectionId = "";
      if (isCatalogPath()) {
        event.preventDefault();
        updateCatalogUrl();
        renderProducts();
      }
    }

    if (target.matches("[data-add]")) {
      addToCart(target.dataset.add);
      openCart();
    }

    if (target.matches("[data-cart-open]")) {
      openCart();
    }

    if (target.matches("[data-cart-close]")) {
      closeCart();
    }

    if (target.matches("[data-cart-minus]")) {
      changeCartQty(target.dataset.cartMinus, -1);
    }

    if (target.matches("[data-cart-plus]")) {
      changeCartQty(target.dataset.cartPlus, 1);
    }

    if (target.matches("[data-cart-remove]")) {
      removeCartItem(target.dataset.cartRemove);
    }

    if (target.matches("[data-checkout]")) {
      checkout(target);
    }

    if (target.matches("[data-detail-colors] button") && !target.disabled) {
      const shell = target.closest("[data-detail]");
      const product = products.find((item) => item.id === shell?.dataset.detail);
      qsa("[data-detail-colors] button", shell).forEach((button) => button.classList.remove("is-active"));
      target.classList.add("is-active");
      const label = qs("[data-selected-color-label]", shell);
      if (label) label.textContent = target.dataset.color || target.textContent;
      setProductMainMedia(target.dataset.colorImage || colorImageForVariant(product, target.dataset.color));
      updateDetailVariantState(shell, product, { notifyUnavailable: true });
    }

    if (target.matches("[data-detail-sizes] button") && !target.disabled) {
      const shell = target.closest("[data-detail]");
      const product = products.find((item) => item.id === shell?.dataset.detail);
      qsa("[data-detail-sizes] button", shell).forEach((button) => button.classList.remove("is-active"));
      target.classList.add("is-active");
      const label = qs("[data-selected-size-label]", shell);
      if (label) label.textContent = target.dataset.size || target.textContent;
      updateDetailVariantState(shell, product);
    }

    if (target.matches("[data-detail-minus], [data-detail-plus]")) {
      const input = qs("[data-detail-qty]");
      const next = Math.max(1, Math.min(12, Number(input.value) + (target.matches("[data-detail-plus]") ? 1 : -1)));
      input.value = String(next);
    }

    if (target.matches("[data-detail-add]")) {
      const shell = target.closest("[data-detail]");
      const sizeButton = qs("[data-detail-sizes] .is-active", shell);
      const colorButton = qs("[data-detail-colors] .is-active", shell);
      const qty = Number(qs("[data-detail-qty]", shell)?.value || 1);
      if (!sizeButton || sizeButton.disabled) {
        showToast("Selecione um tamanho disponivel para essa cor.");
        return;
      }
      const product = products.find((item) => item.id === target.dataset.detailAdd);
      const selectedImage = qs("#main-product-image", shell)?.getAttribute("src") || "";
      if (isCustomizableProduct(product)) {
        openPersonalizationModal(shell, product, {
          size: sizeButton?.dataset.size,
          color: colorButton?.dataset.color || "",
          quantity: qty,
          image: selectedImage
        });
        return;
      }
      addToCart(target.dataset.detailAdd, sizeButton?.dataset.size, qty, colorButton?.dataset.color || "", selectedImage);
      openCart();
    }

    if (target.matches("[data-personalization-close]")) {
      closePersonalizationModal();
      return;
    }

    if (target.matches("[data-personalization-submit]")) {
      submitPersonalizationModal();
      return;
    }

    if (target.matches("[data-logout]")) {
      clearAdminSession();
      setAdminVisible();
      showToast("Voce saiu do painel.");
    }

    if (target.matches("[data-edit-product]")) {
      const product = products.find((item) => item.id === target.dataset.editProduct);
      if (product) fillProductForm(product);
    }

    const aiReviewsButton = target.closest("[data-generate-ai-reviews]");
    if (aiReviewsButton) {
      event.preventDefault();
      generateAiReviewsForProduct(aiReviewsButton.dataset.generateAiReviews, aiReviewsButton);
      return;
    }

    if (target.matches("[data-admin-refresh-personalizations]")) {
      loadAdminPersonalizations();
      return;
    }

    const exportPersonalizationsButton = target.closest("[data-export-personalizations]");
    if (exportPersonalizationsButton) {
      downloadPersonalizationSpreadsheet(exportPersonalizationsButton.dataset.exportPersonalizations || "all", exportPersonalizationsButton);
      return;
    }

    if (target.matches("[data-sales-refresh]")) {
      loadAdminSalesProcessing({ silent: false });
      return;
    }

    if (target.matches("[data-sales-today]")) {
      const today = profitTodayInputDate();
      const fromInput = qs("[data-sales-filter='from']");
      const toInput = qs("[data-sales-filter='to']");
      if (fromInput) fromInput.value = today;
      if (toInput) toInput.value = today;
      loadAdminSalesProcessing({ silent: false });
      return;
    }

    const salesCopy = target.closest("[data-sales-copy]");
    if (salesCopy) {
      copySalesInfo(salesCopy.dataset.salesOrder, salesCopy.dataset.salesCopy);
      return;
    }

    const salesCopyValue = target.closest("[data-sales-copy-value]");
    if (salesCopyValue && !salesCopyValue.disabled) {
      const text = salesCopyValue.dataset.salesCopyValue || "";
      if (text) {
        navigator.clipboard.writeText(text)
          .then(() => showToast("Campo copiado."))
          .catch(() => showToast("Não consegui copiar automaticamente."));
      }
      return;
    }

    const salesStage = target.closest("[data-sales-stage]");
    if (salesStage) {
      activeSalesStatus = salesStage.dataset.salesStage || "new";
      renderAdminSalesProcessing();
      return;
    }

    const salesMove = target.closest("[data-sales-move]");
    if (salesMove && !salesMove.disabled) {
      saveSalesProcessingState(salesMove.dataset.salesMove, { status: salesMove.dataset.salesStatus })
        .then(() => showToast("Venda atualizada."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao atualizar venda.");
        });
      return;
    }

    const salesSave = target.closest("[data-sales-save]");
    if (salesSave) {
      saveSalesProcessingState(salesSave.dataset.salesSave)
        .then(() => showToast("Pedido Shopee salvo."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao salvar venda.");
        });
      return;
    }

    const melhorEnvioConnect = target.closest("[data-melhor-envio-connect]");
    if (melhorEnvioConnect && !melhorEnvioConnect.disabled) {
      connectMelhorEnvio(melhorEnvioConnect);
      return;
    }

    const melhorEnvioProcess = target.closest("[data-melhor-envio-process]");
    if (melhorEnvioProcess && !melhorEnvioProcess.disabled) {
      processMelhorEnvioPending(melhorEnvioProcess);
      return;
    }

    const melhorEnvioLabel = target.closest("[data-melhor-envio-label]");
    if (melhorEnvioLabel && !melhorEnvioLabel.disabled) {
      generateMelhorEnvioLabel(melhorEnvioLabel.dataset.melhorEnvioLabel, melhorEnvioLabel);
      return;
    }


    const packingPersonalizedSearch = target.closest("[data-packing-personalized-search]");
    if (packingPersonalizedSearch) {
      loadPackingPersonalized({ silent: false });
      return;
    }

    const packingStandardRefresh = target.closest("[data-packing-standard-refresh]");
    if (packingStandardRefresh) {
      loadPackingStandard({ silent: false });
      return;
    }

    const packingStandardToday = target.closest("[data-packing-standard-today]");
    if (packingStandardToday) {
      const today = profitTodayInputDate();
      const fromInput = qs("[data-packing-standard-filter='from']");
      const toInput = qs("[data-packing-standard-filter='to']");
      if (fromInput) fromInput.value = today;
      if (toInput) toInput.value = today;
      loadPackingStandard({ silent: false });
      return;
    }

    const packingCopy = target.closest("[data-packing-copy]");
    if (packingCopy) {
      copyPackingInfo(packingCopy.dataset.packingOrder, packingCopy.dataset.packingCopy);
      return;
    }

    const packingSave = target.closest("[data-packing-standard-save]");
    if (packingSave) {
      savePackingStandardState(packingSave.dataset.packingStandardSave)
        .then(() => showToast("Pedido Shopee salvo."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao salvar pedido.");
        });
      return;
    }

    if (target.matches("[data-profit-refresh]")) {
      loadAdminProfit({ silent: false });
      return;
    }

    if (target.matches("[data-profit-today]")) {
      const today = profitTodayInputDate();
      const fromInput = qs("[data-profit-filter='from']");
      const toInput = qs("[data-profit-filter='to']");
      if (fromInput) fromInput.value = today;
      if (toInput) toInput.value = today;
      loadAdminProfit({ silent: false });
      return;
    }

    if (target.matches("[data-profit-cost-save]")) {
      saveProfitCostsFromAdmin();
      return;
    }

    if (target.matches("[data-delete-product]")) {
      const product = products.find((item) => item.id === target.dataset.deleteProduct);
      if (!product) return;
      const confirmed = window.confirm(`Excluir ${product.name}?`);
      if (!confirmed) return;
      deleteProductsByIds([product.id]);
    }

    if (target.matches("[data-delete-selected-products]")) {
      const ids = selectedProductIds();
      if (!ids.length) {
        showToast("Selecione pelo menos um produto.");
        return;
      }
      const confirmed = window.confirm(`Excluir ${ids.length} produto(s) selecionado(s)?`);
      if (!confirmed) return;
      deleteProductsByIds(ids);
    }

    if (target.matches("[data-select-all-products]")) {
      qsa("[data-product-select]").forEach((input) => {
        input.checked = target.checked;
      });
      updateSelectedProductsState();
    }

    if (target.matches("[data-product-select]")) {
      updateSelectedProductsState();
    }

    const productReviewPhotoPick = target.closest("[data-product-review-photo-pick]");
    if (productReviewPhotoPick) {
      event.preventDefault();
      document.getElementById("product-review-photo-file")?.click();
      return;
    }

    const productReviewPhotoClear = target.closest("[data-product-review-photo-clear]");
    if (productReviewPhotoClear) {
      event.preventDefault();
      const form = qs("[data-product-form]");
      if (form?.elements.productReviewImage) form.elements.productReviewImage.value = "";
      const preview = qs("[data-product-review-photo-preview]", form);
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute("src");
      }
      return;
    }

    const productReviewSave = target.closest("[data-product-review-save]");
    if (productReviewSave) {
      event.preventDefault();
      saveProductReviewFromEditor();
      return;
    }

    const productReviewReset = target.closest("[data-product-review-reset]");
    if (productReviewReset) {
      event.preventDefault();
      resetProductReviewEditor();
      return;
    }

    const productReviewEdit = target.closest("[data-product-review-edit]");
    if (productReviewEdit) {
      event.preventDefault();
      startProductReviewEdit(Number(productReviewEdit.dataset.productReviewEdit));
      return;
    }

    const productReviewDelete = target.closest("[data-product-review-delete]");
    if (productReviewDelete) {
      event.preventDefault();
      const index = Number(productReviewDelete.dataset.productReviewDelete);
      if (Number.isInteger(index) && adminProductReviews[index]) {
        adminProductReviews.splice(index, 1);
        resetProductReviewEditor();
        renderProductReviewManager();
        showToast("Depoimento removido.");
      }
      return;
    }

    if (target.matches("[data-yampi-sync]")) {
      syncYampiProducts({ silent: false });
    }

    if (target.matches("[data-yampi-webhook]")) {
      installYampiWebhook();
    }

    if (target.matches("[data-admin-refresh-reviews]")) {
      loadAdminReviews();
      return;
    }

    const approveReview = target.closest("[data-review-approve]");
    if (approveReview) {
      updateReviewStatus(approveReview.dataset.reviewApprove, "approved")
        .then(() => showToast("Depoimento aprovado."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao aprovar depoimento.");
        });
      return;
    }

    const rejectReview = target.closest("[data-review-reject]");
    if (rejectReview) {
      updateReviewStatus(rejectReview.dataset.reviewReject, "rejected")
        .then(() => showToast("Depoimento reprovado."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao reprovar depoimento.");
        });
      return;
    }

    const deleteReview = target.closest("[data-review-delete]");
    if (deleteReview) {
      deleteAdminReview(deleteReview.dataset.reviewDelete)
        .then(() => showToast("Depoimento excluído."))
        .catch((error) => {
          console.error(error);
          showToast(error.message || "Erro ao excluir depoimento.");
        });
      return;
    }

    if (target.matches("[data-create-category]")) {
      const input = document.getElementById("admin-new-category");
      const value = input?.value.trim();
      if (!value) {
        showToast("Digite o nome da categoria.");
        return;
      }
      ensureCategory(value);
      renderAdminCategories();
      if (input) input.value = "";
      showToast("Categoria criada.");
    }

    if (target.matches("[data-pick-category]")) {
      const form = qs("[data-product-form]");
      if (form?.elements.category) {
        form.elements.category.value = target.dataset.pickCategory;
        showToast("Categoria aplicada no produto.");
      }
    }

    if (target.matches("[data-clear-product-photos]")) {
      clearProductPhotos();
      showToast("Fotos do produto limpas.");
    }

    if (target.matches("[data-edit-collection]")) {
      const collection = collectionById(target.dataset.editCollection);
      if (collection) fillCollectionForm(collection);
    }

    if (target.matches("[data-delete-collection]")) {
      deleteCollection(target.dataset.deleteCollection).catch((error) => {
        console.error(error);
        showToast(error.message || "Erro ao excluir coleção.");
      });
    }

    if (target.matches("#btn-cancel-collection-edit")) {
      resetCollectionForm();
    }

    if (target.matches("[data-edit-banner]")) {
      const banner = banners.find((b) => b.id === target.dataset.editBanner);
      if (banner) fillBannerForm(banner);
    }

    if (target.matches("[data-delete-banner]")) {
      const banner = banners.find((b) => b.id === target.dataset.deleteBanner);
      if (!banner) return;
      const confirmed = window.confirm(`Excluir banner "${banner.title}"?`);
      if (!confirmed) return;
      const previousBanners = banners.slice();
      banners = banners.filter((b) => b.id !== banner.id);
      persistBanners().then(() => {
        renderHomeBanners();
        renderAdminBanners();
        showToast("Banner excluído.");
      }).catch((error) => {
        banners = previousBanners;
        renderHomeBanners();
        renderAdminBanners();
        console.error(error);
        showToast(error.message || "Erro ao excluir banner.");
      });
    }

    if (target.matches("[data-admin-tab]")) {
      const activeTab = target.dataset.adminTab;
      qsa("[data-admin-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.adminTab === activeTab));
      qsa(".admin-tab-content").forEach((panel) => {
        panel.style.display = panel.id === `tab-${activeTab}` ? "block" : "none";
      });
      if (activeTab === "depoimentos") loadAdminReviews();
      if (activeTab === "personalizacoes") loadAdminPersonalizations();
      if (activeTab === "vendas") loadAdminSalesProcessing({ silent: false });
      if (activeTab === "embalagem") loadPackingStandard({ silent: false });
      if (activeTab === "lucro") {
        loadAdminProfit({ silent: false });
        loadProfitCosts({ silent: false });
      }
      if (activeTab === "colecoes") renderAdminCollections();
    }

    if (target.matches("#btn-cancel-banner-edit")) {
      cancelBannerEdit();
    }
  });

  document.addEventListener("submit", async (event) => {
    const reviewForm = event.target.closest("[data-review-form]");
    if (!reviewForm) return;

    event.preventDefault();
    const button = reviewForm.querySelector(".submit-review-btn");
    const previous = button?.innerHTML;
    const selectedStars = Number(reviewForm.elements.reviewStars.value || 0);
    if (!selectedStars) {
      showToast("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    try {
      if (button) {
        button.disabled = true;
        button.innerHTML = `<i data-lucide="loader-circle" aria-hidden="true"></i> Enviando...`;
        iconRefresh();
      }
      await submitProductReview(reviewForm.dataset.productId, {
        name: reviewForm.elements.reviewerName.value.trim(),
        email: reviewForm.elements.reviewerEmail?.value.trim() || "",
        stars: selectedStars,
        text: reviewForm.elements.reviewText.value.trim(),
        image: reviewForm.elements.reviewImage?.value || ""
      });
      reviewForm.reset();
      const hiddenStars = reviewForm.querySelector('input[name="reviewStars"]');
      if (hiddenStars) hiddenStars.value = "0";
      const ratingValue = reviewForm.querySelector("[data-review-rating-value]");
      if (ratingValue) ratingValue.textContent = "0/5";
      reviewForm.querySelectorAll(".star-select-btn").forEach((btn) => btn.classList.remove("is-active"));
      const preview = reviewForm.querySelector("[data-review-photo-preview]");
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute("src");
      }
      reviewForm.classList.remove("has-review-photo");
      const formPanel = reviewForm.closest("[data-review-form-panel]");
      if (formPanel) formPanel.hidden = true;
      const toggle = document.querySelector(`[data-review-toggle][aria-controls="${reviewForm.id}"]`);
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      showToast("Avaliação recebida. Obrigado!");
      if (isLoggedIn()) loadAdminReviews();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Erro ao enviar depoimento.");
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = previous || `<i data-lucide="send" aria-hidden="true"></i> Enviar avaliação`;
        iconRefresh();
      }
    }
  });

  document.addEventListener("change", async (event) => {
    const homeOrderInput = event.target.closest("[data-home-order-input]");
    if (homeOrderInput) {
      await saveHomeProductOrderFromAdmin();
      return;
    }

    const salesFilter = event.target.closest("[data-sales-filter]");
    if (salesFilter) {
      await loadAdminSalesProcessing({ silent: true });
      return;
    }

    const profitFilter = event.target.closest("[data-profit-filter]");
    if (profitFilter) {
      await loadAdminProfit({ silent: true });
      return;
    }

    const variantAvailability = event.target.closest("[data-variant-availability]");
    if (variantAvailability) {
      const color = normalizeVariantText(variantAvailability.dataset.variantColor);
      const size = normalizeVariantText(variantAvailability.dataset.variantSize);
      if (color && size) {
        adminVariantConfig.disabled[color] = adminVariantConfig.disabled[color] || {};
        if (variantAvailability.checked) {
          delete adminVariantConfig.disabled[color][size];
          if (!Object.keys(adminVariantConfig.disabled[color]).length) delete adminVariantConfig.disabled[color];
        } else {
          adminVariantConfig.disabled[color][size] = true;
        }
        syncVariantConfigInput();
      }
      return;
    }

    const variantImage = event.target.closest("[data-variant-image]");
    if (variantImage) {
      const color = normalizeVariantText(variantImage.dataset.variantImage);
      if (color) {
        if (variantImage.value) {
          adminVariantConfig.colorImages[color] = variantImage.value;
        } else {
          delete adminVariantConfig.colorImages[color];
        }
        syncVariantConfigInput();
      }
      return;
    }

    const productReviewPhotoInput = event.target.closest("[data-product-review-photo-file]");
    if (productReviewPhotoInput) {
      const file = productReviewPhotoInput.files?.[0];
      if (!file) return;

      try {
        showToast("Processando e enviando foto...");
        const webpDataUrl = await convertToWebP(file, 900, 900, 0.9);
        
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: adminAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ image: webpDataUrl })
        });
        const data = await readApiJson(response, "Erro no upload");

        const uploadedUrl = data.url;
        const form = qs("[data-product-form]");
        if (form?.elements.productReviewImage) form.elements.productReviewImage.value = uploadedUrl;
        const preview = qs("[data-product-review-photo-preview]", form);
        if (preview) {
          preview.src = uploadedUrl;
          preview.hidden = false;
        }
        productReviewPhotoInput.value = "";
        showToast("Foto do depoimento enviada.");
      } catch (error) {
        console.error(error);
        showToast("Erro ao processar/enviar foto do depoimento.");
      }
      return;
    }

    const photoInput = event.target.closest("[data-review-photo-input]");
    if (!photoInput) return;
    const form = photoInput.closest("[data-review-form]");
    const file = photoInput.files?.[0];
    if (!form || !file) return;

    try {
      showToast("Processando foto do depoimento...");
      const webpDataUrl = await convertToWebP(file, 900, 900, 0.9);
      const hiddenInput = form.elements.reviewImage;
      const preview = form.querySelector("[data-review-photo-preview]");
      if (hiddenInput) hiddenInput.value = webpDataUrl;
      if (preview) {
        preview.src = webpDataUrl;
        preview.hidden = false;
      }
      form.classList.add("has-review-photo");
      showToast("Foto adicionada.");
    } catch (error) {
      console.error(error);
      showToast("Erro ao processar foto.");
    }
  });

  document.addEventListener("input", (event) => {
    const customInput = event.target.closest("[data-custom-name], [data-custom-number]");
    if (customInput) {
      updatePersonalizationPreview(customInput.closest("[data-detail]"));
      return;
    }

    const profitSearch = event.target.closest("[data-profit-search]");
    if (profitSearch) {
      window.clearTimeout(profitSearchTimer);
      profitSearchTimer = window.setTimeout(() => loadAdminProfit({ silent: true }), 320);
      return;
    }

    const salesSearch = event.target.closest("[data-sales-search]");
    if (salesSearch) {
      window.clearTimeout(salesSearchTimer);
      salesSearchTimer = window.setTimeout(() => loadAdminSalesProcessing({ silent: true }), 320);
      return;
    }


    const packingPersonalizedSearchInput = event.target.closest("[data-packing-personalized-name], [data-packing-personalized-number]");
    if (packingPersonalizedSearchInput) {
      window.clearTimeout(packingPersonalizedTimer);
      packingPersonalizedTimer = window.setTimeout(() => loadPackingPersonalized({ silent: true }), 360);
      return;
    }

    const packingStandardSearch = event.target.closest("[data-packing-standard-search]");
    if (packingStandardSearch) {
      window.clearTimeout(packingStandardTimer);
      packingStandardTimer = window.setTimeout(() => loadPackingStandard({ silent: true }), 320);
      return;
    }

    const profitCostSearch = event.target.closest("[data-profit-cost-search]");
    if (profitCostSearch) {
      renderProfitCostEditor();
      return;
    }

    const profitCostInput = event.target.closest("[data-profit-cost-input], [data-profit-cost-link], [data-profit-cost-notes]");
    if (profitCostInput) {
      syncProfitCostOptionFromInput(profitCostInput);
      return;
    }

    const searchInput = event.target.closest("[data-search-input]");
    if (searchInput) {
      searchTerm = searchInput.value;
      updateCatalogUrl();
      renderProducts();
    }
  });

  document.addEventListener("keydown", (event) => {
    const packingPersonalizedInput = event.target.closest("[data-packing-personalized-name], [data-packing-personalized-number]");
    if (packingPersonalizedInput && event.key === "Enter") {
      event.preventDefault();
      loadPackingPersonalized({ silent: false });
      return;
    }


    const searchInput = event.target.closest("[data-search-input]");
    if (searchInput && event.key === "Enter") {
      event.preventDefault();
      searchTerm = searchInput.value;
      goToSearchResults();
    }
  });

  qs("[data-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = qs("[data-login-error]");
    const username = form.elements.username.value;
    const password = form.elements.password.value;
    const button = form.querySelector("button[type='submit']");
    const previous = button?.innerHTML;

    try {
      if (button) {
        button.disabled = true;
        button.innerHTML = "Entrando...";
      }
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.token) {
        throw new Error(data.message || "Usuario ou senha incorretos.");
      }
      sessionStorage.setItem(SESSION_KEY, data.token);
      form.reset();
      error.textContent = "";
      setAdminVisible();
      showToast("Painel liberado.");
    } catch (loginError) {
      clearAdminSession();
      error.textContent = loginError.message || "Usuario ou senha incorretos.";
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = previous || "Entrar no painel";
      }
    }
  });

  qs("[data-product-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const product = productFromForm(form);
      await saveProduct(product);
      cancelEditMode();
      showToast("Conteúdo da página salvo.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Erro ao salvar produto.");
    }
  });

  qs("[data-product-form]")?.addEventListener("reset", (event) => {
    setTimeout(() => {
      cancelEditMode();
    }, 0);
  });

  const collectionForm = document.getElementById("admin-collection-form");
  if (collectionForm) {
    collectionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveCollection(collectionFromForm(event.currentTarget));
      } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao salvar coleção.");
      }
    });

    collectionForm.addEventListener("reset", () => {
      setTimeout(() => {
        resetCollectionForm();
      }, 0);
    });
  }

  const bannerForm = document.getElementById("admin-banner-form");
  if (bannerForm) {
    bannerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const form = event.currentTarget;
        const title = form.elements.title?.value.trim() || `Banner ${banners.length + 1}`;
        const id = form.elements.id.value.trim() || slugify(title);

        const banner = {
          id,
          eyebrow: form.elements.eyebrow?.value.trim() || "",
          title,
          subtitle: form.elements.subtitle?.value.trim() || "",
          linkUrl: form.elements.linkUrl?.value.trim() || "",
          linkText: form.elements.linkText?.value.trim() || "",
          desktopImage: form.elements.desktopImage.value.trim() || PLACEHOLDER_IMAGE,
          mobileImage: form.elements.mobileImage.value.trim() || PLACEHOLDER_IMAGE
        };

        await saveBanner(banner);
        cancelBannerEdit();
        showToast("Banner salvo com sucesso.");
      } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao salvar banner.");
      }
    });

    bannerForm.addEventListener("reset", () => {
      setTimeout(() => {
        cancelBannerEdit();
      }, 0);
    });
  }

  const siteContentForm = document.getElementById("admin-site-content-form");
  if (siteContentForm) {
    siteContentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const previousSiteContent = siteContent;
      try {
        const form = event.currentTarget;
        siteContent = normalizeSiteContent({
          lowerBanner: {
            linkUrl: form.elements.lowerBannerLinkUrl.value.trim(),
            desktopImage: form.elements.lowerBannerDesktopImage.value.trim() || PLACEHOLDER_IMAGE,
            mobileImage: form.elements.lowerBannerMobileImage.value.trim() || PLACEHOLDER_IMAGE
          },
          aboutPhotos: {
            photoOne: form.elements.aboutPhotoOne.value.trim() || PLACEHOLDER_IMAGE,
            photoTwo: form.elements.aboutPhotoTwo.value.trim() || PLACEHOLDER_IMAGE
          }
        });
        await persistSiteContent();
        renderSiteContent();
        renderAdminSiteContentForm();
        showToast("Banner inferior e fotos salvos.");
      } catch (error) {
        siteContent = previousSiteContent;
        console.error(error);
        showToast(error.message || "Erro ao salvar conteudo do site.");
      }
    });
  }

  const prodFile = document.getElementById("product-upload-file");
  if (prodFile) {
    prodFile.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        showToast("Processando e enviando imagem...");
        const webpDataUrl = await convertToWebP(file, 1000, 1000, 0.94);
        
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: adminAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ image: webpDataUrl })
        });
        const data = await readApiJson(response, "Erro no upload");

        const uploadedUrl = data.url;
        if (!selectedGalleryImages.includes(uploadedUrl)) {
          selectedGalleryImages.push(uploadedUrl);
        }
        selectedMainImage = uploadedUrl;
        productMediaDirty = true;
        renderPhotoSelector();
        showToast("Imagem adicionada e enviada.");
      } catch (err) {
        console.error(err);
        showToast("Erro ao processar/enviar imagem.");
      }
    });
  }

  bindAdminImageUpload({
    fileId: "banner-desktop-file",
    inputId: "banner-desktop-url",
    previewId: "banner-desktop-preview",
    maxWidth: 1920,
    maxHeight: 600,
    label: "imagem desktop"
  });

  bindAdminImageUpload({
    fileId: "banner-mobile-file",
    inputId: "banner-mobile-url",
    previewId: "banner-mobile-preview",
    maxWidth: 800,
    maxHeight: 800,
    label: "imagem mobile"
  });

  const deskUrlInput = document.getElementById("banner-desktop-url");
  if (deskUrlInput) {
    deskUrlInput.addEventListener("input", (e) => {
      const img = document.getElementById("banner-desktop-preview");
      if (img) img.src = assetUrl(e.target.value);
    });
  }

  const mobUrlInput = document.getElementById("banner-mobile-url");
  if (mobUrlInput) {
    mobUrlInput.addEventListener("input", (e) => {
      const img = document.getElementById("banner-mobile-preview");
      if (img) img.src = assetUrl(e.target.value);
    });
  }

  bindAdminImageUpload({
    fileId: "collection-image-file",
    inputId: "collection-image-url",
    previewId: "collection-image-preview",
    maxWidth: 600,
    maxHeight: 600,
    label: "foto da coleção",
    onUploaded: (url) => {
      const form = document.getElementById("admin-collection-form");
      if (!form) return;
      if (form.elements.image) form.elements.image.value = url;
      const preview = document.getElementById("collection-image-preview");
      if (preview) preview.src = assetUrl(url);
    }
  });

  bindAdminImageUpload({
    fileId: "lower-banner-desktop-file",
    inputId: "lower-banner-desktop-url",
    previewId: "lower-banner-desktop-preview",
    maxWidth: 1920,
    maxHeight: 600,
    label: "banner inferior desktop"
  });

  bindAdminImageUpload({
    fileId: "lower-banner-mobile-file",
    inputId: "lower-banner-mobile-url",
    previewId: "lower-banner-mobile-preview",
    maxWidth: 800,
    maxHeight: 800,
    label: "banner inferior mobile"
  });

  bindAdminImageUpload({
    fileId: "about-photo-one-file",
    inputId: "about-photo-one-url",
    previewId: "about-photo-one-preview",
    maxWidth: 1200,
    maxHeight: 900,
    label: "foto sobre nos 1"
  });

  bindAdminImageUpload({
    fileId: "about-photo-two-file",
    inputId: "about-photo-two-url",
    previewId: "about-photo-two-preview",
    maxWidth: 1200,
    maxHeight: 900,
    label: "foto sobre nos 2"
  });

  [1].forEach((index) => {
    bindAdminImageUpload({
      fileId: `desc-block-${index}-file`,
      inputId: `desc-block-${index}-image`,
      previewId: `desc-block-${index}-preview`,
      maxWidth: 1400,
      maxHeight: 1400,
      label: `foto da descricao ${index}`
    });
  });

  bindAdminImageUpload({
    fileId: "product-size-guide-desktop-file",
    inputId: "product-size-guide-desktop-image",
    previewId: "product-size-guide-desktop-preview",
    maxWidth: 1800,
    maxHeight: 1800,
    label: "guia de tamanhos desktop"
  });

  bindAdminImageUpload({
    fileId: "product-size-guide-mobile-file",
    inputId: "product-size-guide-mobile-image",
    previewId: "product-size-guide-mobile-preview",
    maxWidth: 1200,
    maxHeight: 1800,
    label: "guia de tamanhos mobile"
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => {
    startCollectionCarousel();
    renderSiteContent();
    const searchPanel = qs("[data-search-panel]");
    if (searchPanel && !searchPanel.hidden) positionSearchPanel(searchPanel);
  });
}

async function initializePageData() {
  await Promise.allSettled([
    loadCatalogProducts({ silent: true }),
    loadCollectionsFromApi({ silent: true }),
    loadBannersFromApi(),
    loadSiteContentFromApi()
  ]);

  renderHomeBanners();
  renderSiteContent();
  renderHomeCollections();
  renderProducts();
  setAdminVisible();
  route();
  startCollectionCarousel();
  iconRefresh();
}

document.addEventListener("DOMContentLoaded", () => {
  prepareCategoryNav();
  ensureCategoryPanel();
  syncSearchInputs();
  renderCart();
  bindEvents();
  initializePageData().finally(() => {
    startAutoSync();
    iconRefresh();
  });
});

document.addEventListener("dragstart", (event) => {
  if (event.target?.closest?.("img, .payment-methods-img")) {
    event.preventDefault();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeCategoryPanel();
  closeSearchPanel();
  const modal = qs("[data-product-zoom-modal]");
  if (modal && !modal.hidden) {
    modal.hidden = true;
    document.body.classList.remove("zoom-open");
  }
  const sizeGuideModal = qs("[data-size-guide-modal]");
  if (sizeGuideModal && !sizeGuideModal.hidden) {
    sizeGuideModal.hidden = true;
    document.body.classList.remove("size-guide-open");
  }
  const personalizationModal = qs("[data-personalization-modal]");
  if (personalizationModal && !personalizationModal.hidden) {
    closePersonalizationModal();
  }
});

window.addEventListener("load", iconRefresh);
