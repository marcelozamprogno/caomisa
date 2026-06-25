/* ==========================================================================
   CAOMISA SHOP - STOREFRONT CONTROLLER (SPA)
   ========================================================================== */

// Storage keys
const CART_KEY = "caomisa_cart_v2";

// State
let products = [];
let banners = [];
let siteContent = {};
let collections = [];
let cart = [];

// Hero slider state
let currentSlideIndex = 0;
let sliderInterval = null;

// Routing helpers
const isCatalogPath = () => ["/produtos", "/produtos.html"].includes(window.location.pathname);

// Load cart on startup
function loadCart() {
  try {
    const saved = localStorage.getItem(CART_KEY);
    cart = saved ? JSON.parse(saved) : [];
  } catch (e) {
    cart = [];
  }
}

// Save cart to local storage
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

// Format currency
const formatBRL = (val) =>
  Number(val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// Render Lucide icons
function iconRefresh() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Show global toast message
function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  
  clearTimeout(toast.dataset.timeoutId);
  const timeoutId = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
  toast.dataset.timeoutId = timeoutId;
}

// Match product SKU based on size/color
function findProductSku(product, size, color = "") {
  const skus = product.yampi?.skus || [];
  const wantedSize = String(size || "").trim().toUpperCase();
  const wantedColor = String(color || "").trim().toLowerCase();
  
  // Try exact match
  let matched = skus.find(s => {
    const sSize = String(s.size || "").trim().toUpperCase();
    const hasColorVar = s.variations?.some(v => v.name.toLowerCase() === "cor" && v.value.toLowerCase() === wantedColor);
    return sSize === wantedSize && (!color || hasColorVar);
  });
  
  // Fallback to size only if exact match fails
  if (!matched) {
    matched = skus.find(s => String(s.size || "").trim().toUpperCase() === wantedSize);
  }
  
  return matched || skus[0] || null;
}

// Generate direct Yampi checkout link with quantity and metadata
function generateCheckoutUrl(product, size, color, quantity, customization) {
  const sku = findProductSku(product, size, color);
  if (!sku || !sku.purchaseUrl) {
    return "";
  }
  
  try {
    const url = new URL(sku.purchaseUrl);
    
    // Yampi quantity syntax: /r/TOKEN:QTY
    if (Number(quantity || 1) > 1) {
      const parts = url.pathname.split("/");
      const token = parts.pop();
      if (token) {
        parts.push(`${token}:${Number(quantity)}`);
      }
      url.pathname = parts.join("/");
    }
    
    // Add customization metadata if present
    if (customization && customization.name && customization.number) {
      url.searchParams.set("metadata[Nome personalizado]", String(customization.name).slice(0, 16));
      url.searchParams.set("metadata[Número personalizado]", String(customization.number).slice(0, 2));
    }
    
    return url.toString();
  } catch (e) {
    return sku.purchaseUrl;
  }
}

// API Data Fetching
async function loadPageData() {
  try {
    const [prodRes, banRes, contentRes, collRes] = await Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/banners").then(r => r.json()),
      fetch("/api/site-content").then(r => r.json()),
      fetch("/api/collections").then(r => r.json())
    ]);
    
    products = prodRes.products || [];
    banners = banRes.banners || [];
    siteContent = contentRes.siteContent || {};
    collections = collRes.collections || [];
  } catch (err) {
    console.error("Erro ao carregar os dados da loja:", err);
  }
}

// Setup Header category menu link hover
function setupHeaderCategoryMenu() {
  const trigger = document.querySelector("[data-main-nav] a[href='/produtos']");
  const panel = document.querySelector("[data-category-panel]");
  const choicesGrid = document.querySelector("[data-category-choices]");
  
  if (!trigger || !panel || !choicesGrid) return;
  
  // Populate category panel options
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  choicesGrid.innerHTML = categories.map(cat => `
    <button class="category-choice" data-category="${cat}">
      <span>${cat}</span>
      <i data-lucide="chevron-right" aria-hidden="true"></i>
    </button>
  `).join("");
  iconRefresh();
  
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) {
      panel.hidden = true;
    }
  });
  
  choicesGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-category]");
    if (btn) {
      const cat = btn.dataset.category;
      panel.hidden = true;
      navigate(`/produtos?categoria=${encodeURIComponent(cat)}`);
    }
  });
}

// Navigate client-side
function navigate(url) {
  window.history.pushState(null, "", url);
  route();
}

// RENDER 1: HOME VIEW
function renderHome() {
  // 1. Slider Banners
  const slider = document.querySelector("[data-banner-slider]");
  const controls = document.querySelector("[data-slider-controls]");
  
  if (slider && controls && banners.length) {
    slider.innerHTML = banners.map((ban, idx) => `
      <div class="banner-slide ${idx === 0 ? "active" : ""}" data-slide="${idx}">
        <a href="${ban.linkUrl || "/produtos"}">
          <picture>
            <source media="(max-width: 768px)" srcset="${ban.mobileImage || ban.desktopImage}" />
            <img src="${ban.desktopImage}" alt="${ban.title || "Banner Caomisa"}" />
          </picture>
        </a>
      </div>
    `).join("");
    
    controls.innerHTML = banners.map((_, idx) => `
      <span class="${idx === 0 ? "is-active" : ""}" data-indicator="${idx}"></span>
    `).join("");
    
    setupSliderInterval();
  }
  
  // 2. Best Sellers Product Grid
  const homeGrid = document.querySelector("[data-home-product-grid]");
  if (homeGrid) {
    // Show top 8 products on home page
    const bestSellers = products.slice(0, 8);
    homeGrid.innerHTML = bestSellers.map(renderProductCardHtml).join("");
  }
  
  // 3. Collections carousel
  const collTrack = document.querySelector("[data-collection-track]");
  if (collTrack && collections.length) {
    collTrack.innerHTML = collections.map(coll => `
      <a href="/produtos?categoria=${encodeURIComponent(coll.sourceCategory || coll.name)}">
        <img src="${coll.image}" alt="${coll.name}" />
        <strong><span>${coll.name}</span><i data-lucide="arrow-right" class="collection-card-arrow" aria-hidden="true"></i></strong>
      </a>
    `).join("");
    iconRefresh();
  }
  
  // 4. Promo Banners & About Photos
  const lowerLink = document.querySelector("[data-lower-banner-link]");
  if (lowerLink && siteContent.lowerBanner) {
    lowerLink.href = siteContent.lowerBanner.linkUrl || "/produtos?categoria=Inverno";
    lowerLink.innerHTML = `
      <picture>
        <source media="(max-width: 768px)" srcset="${siteContent.lowerBanner.mobileImage || siteContent.lowerBanner.desktopImage}" />
        <img src="${siteContent.lowerBanner.desktopImage}" alt="Banner Promocional Inverno" />
      </picture>
    `;
  }
  
  const aboutGrid = document.querySelector("[data-about-photos-grid]");
  if (aboutGrid && siteContent.aboutPhotos) {
    aboutGrid.innerHTML = `
      <div class="about-photo">
        <img src="${siteContent.aboutPhotos.photoOne}" alt="Fotos da loja Caomisa" />
      </div>
      <div class="about-photo">
        <img src="${siteContent.aboutPhotos.photoTwo}" alt="Nossos modelos de casaco pet" />
      </div>
    `;
  }
}

// Hero Slider Auto scrolling
function setupSliderInterval() {
  if (sliderInterval) clearInterval(sliderInterval);
  sliderInterval = setInterval(() => {
    changeSlide(1);
  }, 5000);
}

function changeSlide(direction) {
  const slides = document.querySelectorAll(".banner-slide");
  const indicators = document.querySelectorAll("[data-indicator]");
  if (!slides.length) return;
  
  slides[currentSlideIndex].classList.remove("active");
  indicators[currentSlideIndex].classList.remove("is-active");
  
  currentSlideIndex = (currentSlideIndex + direction + slides.length) % slides.length;
  
  slides[currentSlideIndex].classList.add("active");
  indicators[currentSlideIndex].classList.add("is-active");
}

// RENDER 2: CATALOG VIEW
function renderCatalog(selectedCategory = "", searchQuery = "") {
  const grid = document.querySelector("[data-catalog-product-grid]");
  const pills = document.querySelector("[data-category-filters-pills]");
  const title = document.querySelector("[data-catalog-title]");
  
  if (!grid || !pills) return;
  
  // Categories list
  const categories = ["Todos", ...new Set(products.map(p => p.category).filter(Boolean))].sort();
  pills.innerHTML = categories.map(cat => `
    <button class="category-filter-pill ${(!selectedCategory && cat === "Todos") || selectedCategory === cat ? "active" : ""}" data-filter="${cat}">
      ${cat}
    </button>
  `).join("");
  
  // Filter products
  let filtered = [...products];
  if (selectedCategory && selectedCategory !== "Todos") {
    filtered = filtered.filter(p => p.category === selectedCategory);
    title.textContent = `Coleção ${selectedCategory}`;
  } else {
    title.textContent = "Todos os Produtos";
  }
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    );
    title.textContent = `Resultados para: "${searchQuery}"`;
  }
  
  if (filtered.length) {
    grid.innerHTML = filtered.map(renderProductCardHtml).join("");
  } else {
    grid.innerHTML = `<div class="cart-empty" style="grid-column: 1/-1;">Nenhum produto encontrado nesta categoria.</div>`;
  }
}

// Card HTML helper
function renderProductCardHtml(p) {
  const oldPriceHtml = p.oldPrice > p.price ? `<span class="old-price">${formatBRL(p.oldPrice)}</span>` : "";
  const discountPct = p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
  const badgeHtml = discountPct > 0 ? `<div class="product-card-badge">-${discountPct}%</div>` : "";
  
  const cleanSlug = p.id.replace(/^yampi-/i, "");
  
  return `
    <a href="/produto/${cleanSlug}" class="product-card">
      ${badgeHtml}
      <div class="product-card-image">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="product-card-info">
        <h3 class="product-card-title">${p.name}</h3>
        <div class="product-card-pricing">
          ${oldPriceHtml}
          <span class="new-price">${formatBRL(p.price)}</span>
        </div>
      </div>
    </a>
  `;
}

// RENDER 3: PRODUCT DETAIL VIEW
function renderProductPage(slug) {
  const container = document.getElementById("product-view");
  if (!container) return;
  
  const product = products.find(p => p.id.replace(/^yampi-/i, "") === slug || p.id === slug);
  if (!product) {
    container.innerHTML = `
      <div class="cart-empty">
        <p>Produto não encontrado.</p>
        <a class="secondary-button" href="/produtos">Voltar para a loja</a>
      </div>
    `;
    return;
  }
  
  document.title = `${product.name} | Caomisa`;
  
  const isCustomizable = product.name.toLowerCase().includes("personaliz") || 
                        product.description.toLowerCase().includes("personaliz");
  
  const galleryImages = [product.image, ...(product.images || [])].filter((img, idx, arr) => arr.indexOf(img) === idx);
  
  const discountPct = product.oldPrice > product.price ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
  const oldPriceHtml = product.oldPrice > product.price ? `<span class="original-price">${formatBRL(product.oldPrice)}</span>` : "";
  const discountHtml = discountPct > 0 ? `<span class="discount-tag">-${discountPct}% OFF</span>` : "";
  
  const sizes = product.sizes && product.sizes.length ? product.sizes : ["PP", "P", "M", "G", "GG"];
  
  // Description Description sections
  const specsText = product.premium?.specs || "";
  const descriptionBlocks = product.premium?.descriptionBlocks || [];
  
  const reviewsList = product.premium?.reviews || [
    { name: "Juliana R.", city: "São Paulo, SP", stars: 5, text: "Excelente qualidade, serviu certinho no meu Shitzu! Muito feliz com a compra." },
    { name: "Roberto F.", city: "Rio de Janeiro, RJ", stars: 5, text: "Entrega super rápida e o tecido é super confortável. Meu pet adorou." }
  ];
  
  const rating = product.premium?.rating || 5.0;
  
  container.innerHTML = `
    <div class="product-page-container">
      <!-- Media Gallery Column -->
      <div class="product-media-gallery">
        <div class="main-image-container">
          <button class="zoom-badge" type="button" data-zoom-trigger aria-label="Zoom imagem">
            <i data-lucide="zoom-in" aria-hidden="true"></i>
          </button>
          <img id="main-gallery-image" src="${product.image}" alt="${product.name}" />
        </div>
        <div class="thumbnails-row">
          ${galleryImages.map((img, idx) => `
            <button class="thumb-btn ${idx === 0 ? "is-active" : ""}" type="button" data-index="${idx}">
              <img src="${img}" alt="Miniatura ${idx + 1}" />
            </button>
          `).join("")}
        </div>
      </div>
      
      <!-- Options and Purchasing Column -->
      <div class="product-info-stack">
        <div class="product-breadcrumbs">
          <a href="/">Início</a> / <a href="/produtos?categoria=${encodeURIComponent(product.category)}">${product.category}</a> / ${product.name}
        </div>
        
        <h1 class="product-info-title">${product.name}</h1>
        
        <div class="product-reviews-summary">
          <div class="stars-row">
            ${Array.from({ length: 5 }, (_, i) => `
              <i data-lucide="star" class="${i < Math.round(rating) ? "is-filled" : ""}" aria-hidden="true"></i>
            `).join("")}
          </div>
          <a href="#comentarios" class="review-count-link">(${reviewsList.length} avaliações de clientes)</a>
        </div>
        
        <div class="product-pricing-box">
          <div class="pricing-row">
            ${oldPriceHtml}
            <span class="current-price" id="dynamic-product-price">${formatBRL(product.price)}</span>
            ${discountHtml}
          </div>
          <div class="pricing-installments">
            Ou em até 12x de <strong id="dynamic-installments">${formatBRL(product.price / 12)}</strong> sem juros
          </div>
        </div>
        
        <!-- Size Selector -->
        <div class="option-selector-group">
          <div class="option-selector-label">Tamanho do Pet</div>
          <div class="size-options">
            ${sizes.map((sz, idx) => `
              <button type="button" class="size-pill ${idx === 0 ? "active" : ""}" data-size="${sz}">${sz}</button>
            `).join("")}
          </div>
          <button type="button" class="size-guide-trigger" data-size-guide-trigger>
            <i data-lucide="ruler" aria-hidden="true"></i> Tabela de Medidas
          </button>
        </div>
        
        <!-- Customization Fields -->
        ${isCustomizable ? `
          <div class="customization-box">
            <h4>Personalize a Roupinha do seu Pet</h4>
            <div class="custom-fields-row">
              <div class="custom-field">
                <label for="custom-name">Nome do Pet</label>
                <input id="custom-name" type="text" placeholder="Ex: THOR (max 16 letras)" maxlength="16" />
              </div>
              <div class="custom-field">
                <label for="custom-number">Número</label>
                <input id="custom-number" type="text" placeholder="Ex: 10" maxlength="2" />
              </div>
            </div>
          </div>
        ` : ""}
        
        <!-- Buy Elements -->
        <div class="quantity-and-buy">
          <div class="quantity-selector">
            <button type="button" data-qty-dec>-</button>
            <span id="buy-qty-value">1</span>
            <button type="button" data-qty-inc>+</button>
          </div>
          <button type="button" class="primary-button" data-buy-now-button>
            <i data-lucide="shopping-bag" aria-hidden="true"></i> Adicionar à Sacola
          </button>
        </div>
        
        <!-- Accordion details -->
        <div class="product-description-accordions">
          <div class="accordion-item active">
            <button class="accordion-header" type="button">
              Descrição do Produto
              <i data-lucide="chevron-down" aria-hidden="true"></i>
            </button>
            <div class="accordion-content">
              <div class="description-body">${product.description}</div>
            </div>
          </div>
          
          ${specsText ? `
            <div class="accordion-item">
              <button class="accordion-header" type="button">
                Especificações Técnicas
                <i data-lucide="chevron-down" aria-hidden="true"></i>
              </button>
              <div class="accordion-content">
                <div class="description-body">${specsText}</div>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
    
    <!-- Reviews Listing Section -->
    <section class="product-reviews-section" id="comentarios">
      <div class="section-heading">
        <h2>O que dizem os clientes</h2>
      </div>
      
      <div class="reviews-dashboard">
        <div class="reviews-summary-card">
          <h3>${rating.toFixed(1)}</h3>
          <div class="stars-row" style="font-size: 1.2rem;">
            <i data-lucide="star" class="is-filled" aria-hidden="true"></i>
            <i data-lucide="star" class="is-filled" aria-hidden="true"></i>
            <i data-lucide="star" class="is-filled" aria-hidden="true"></i>
            <i data-lucide="star" class="is-filled" aria-hidden="true"></i>
            <i data-lucide="star" class="is-filled" aria-hidden="true"></i>
          </div>
          <span>Com base em ${reviewsList.length} avaliações</span>
        </div>
        
        <div class="reviews-bars-list">
          <div class="reviews-bar-row">
            <span>5 estrelas</span>
            <div class="reviews-bar-track"><div class="reviews-bar-fill" style="width: 95%;"></div></div>
            <span>95%</span>
          </div>
          <div class="reviews-bar-row">
            <span>4 estrelas</span>
            <div class="reviews-bar-track"><div class="reviews-bar-fill" style="width: 5%;"></div></div>
            <span>5%</span>
          </div>
          <div class="reviews-bar-row">
            <span>3 estrelas</span>
            <div class="reviews-bar-track"><div class="reviews-bar-fill" style="width: 0%;"></div></div>
            <span>0%</span>
          </div>
        </div>
      </div>
      
      <div class="reviews-grid">
        ${reviewsList.map(rev => `
          <div class="review-card">
            <div class="review-card-head">
              <span class="reviewer-name">${rev.name}</span>
              <span class="reviewer-city">${rev.city || ""}</span>
            </div>
            <div class="stars-row" style="margin: 4px 0;">
              ${Array.from({ length: 5 }, (_, i) => `
                <i data-lucide="star" class="${i < (rev.stars || 5) ? "is-filled" : ""}" aria-hidden="true"></i>
              `).join("")}
            </div>
            <p class="review-card-body">${rev.text}</p>
            ${rev.image ? `
              <img src="/${rev.image.replace(/^\//, "")}" class="review-card-img" alt="Foto do cliente" />
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
  
  iconRefresh();
  
  // Bind product specific listeners
  // Gallery photo switcher
  const thumbs = container.querySelectorAll(".thumb-btn");
  const mainImage = container.querySelector("#main-gallery-image");
  thumbs.forEach(btn => {
    btn.addEventListener("click", () => {
      thumbs.forEach(t => t.classList.remove("is-active"));
      btn.classList.add("is-active");
      const idx = Number(btn.dataset.index);
      mainImage.src = galleryImages[idx];
    });
  });
  
  // Size selection toggles & pricing updates
  const sizePills = container.querySelectorAll(".size-pill");
  sizePills.forEach(pill => {
    pill.addEventListener("click", () => {
      sizePills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      
      // Update dynamic price if SKU price differs
      const selectedSize = pill.dataset.size;
      const sku = findProductSku(product, selectedSize);
      if (sku) {
        container.querySelector("#dynamic-product-price").textContent = formatBRL(sku.price);
        container.querySelector("#dynamic-installments").textContent = formatBRL(sku.price / 12);
      }
    });
  });
  
  // Zoom Modal
  const zoomBtn = container.querySelector("[data-zoom-trigger]");
  const zoomModal = document.querySelector("[data-zoom-modal]");
  const zoomImage = document.querySelector("[data-zoom-image]");
  if (zoomBtn && zoomModal && zoomImage) {
    zoomBtn.addEventListener("click", () => {
      zoomImage.src = mainImage.src;
      zoomModal.hidden = false;
      document.body.classList.add("zoom-open");
    });
  }
  
  // Size Guide Modal
  const sizeGuideBtn = container.querySelector("[data-size-guide-trigger]");
  const sizeGuideModal = document.querySelector("[data-size-guide-modal]");
  const dGuide = document.querySelector("[data-size-guide-desktop]");
  const mGuide = document.querySelector("[data-size-guide-mobile]");
  
  if (sizeGuideBtn && sizeGuideModal && dGuide && mGuide) {
    sizeGuideBtn.addEventListener("click", () => {
      dGuide.src = product.premium?.sizeGuideDesktopImage || "/assets/uploads/upload-1779908476553-05998592-31b1-400f-acac-a2887f9faaf1.webp";
      mGuide.src = product.premium?.sizeGuideMobileImage || product.premium?.sizeGuideDesktopImage || "/assets/uploads/upload-1779908483009-ce7cd904-2c9a-4d09-a626-a88cc9d008e3.webp";
      sizeGuideModal.hidden = false;
      document.body.classList.add("size-guide-open");
    });
  }
  
  // Accordion details toggle
  const accs = container.querySelectorAll(".accordion-item");
  accs.forEach(item => {
    const header = item.querySelector(".accordion-header");
    header.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      accs.forEach(i => i.classList.remove("active"));
      if (!isActive) item.classList.add("active");
    });
  });
  
  // Qty adjust
  const qtyVal = container.querySelector("#buy-qty-value");
  container.querySelector("[data-qty-dec]").addEventListener("click", () => {
    let q = Number(qtyVal.textContent);
    if (q > 1) qtyVal.textContent = q - 1;
  });
  
  container.querySelector("[data-qty-inc]").addEventListener("click", () => {
    let q = Number(qtyVal.textContent);
    qtyVal.textContent = q + 1;
  });
  
  // Add to Cart Action
  const buyBtn = container.querySelector("[data-buy-now-button]");
  buyBtn.addEventListener("click", () => {
    const activeSizePill = container.querySelector(".size-pill.active");
    const selectedSize = activeSizePill ? activeSizePill.dataset.size : sizes[0];
    const qty = Number(qtyVal.textContent);
    
    let customName = "";
    let customNumber = "";
    if (isCustomizable) {
      customName = container.querySelector("#custom-name").value.trim().toUpperCase();
      customNumber = container.querySelector("#custom-number").value.trim();
      
      if (!customName || !customNumber) {
        showToast("Por favor, digite o Nome e o Número da camiseta.");
        return;
      }
    }
    
    // Add to cart list
    const cartItem = {
      productId: product.id,
      name: product.name,
      image: product.image,
      size: selectedSize,
      color: "",
      price: product.price,
      quantity: qty,
      customization: isCustomizable ? { name: customName, number: customNumber } : null
    };
    
    // Check if item exists
    const matchIdx = cart.findIndex(item => 
      item.productId === cartItem.productId && 
      item.size === cartItem.size &&
      (!isCustomizable || (item.customization?.name === customName && item.customization?.number === customNumber))
    );
    
    if (matchIdx > -1) {
      cart[matchIdx].quantity += qty;
    } else {
      cart.push(cartItem);
    }
    
    saveCart();
    showToast("Produto adicionado à sacola!");
    openCartDrawer();
  });
}

// CART RENDER & EVENTS
function renderCart() {
  const countSpan = document.querySelector("[data-cart-count]");
  const itemsContainer = document.querySelector("[data-cart-items]");
  const totalStrong = document.querySelector("[data-cart-total]");
  
  if (!itemsContainer || !totalStrong || !countSpan) return;
  
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  countSpan.textContent = totalCount;
  
  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-empty">
        <i data-lucide="shopping-bag" style="width: 48px; height: 48px; color: var(--text-muted);" aria-hidden="true"></i>
        <p>Seu carrinho está vazio.</p>
        <button class="secondary-button" type="button" data-cart-close>Continuar Comprando</button>
      </div>
    `;
    totalStrong.textContent = formatBRL(0);
    iconRefresh();
    bindCartCloseButtons();
    return;
  }
  
  itemsContainer.innerHTML = cart.map((item, idx) => {
    const metaStr = item.customization 
      ? `Tamanho: ${item.size} | Nome: <strong>${item.customization.name}</strong> | Nº: <strong>${item.customization.number}</strong>`
      : `Tamanho: ${item.size}`;
      
    return `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" />
        <div class="cart-item-details">
          <span class="cart-item-title">${item.name}</span>
          <span class="cart-item-meta">${metaStr}</span>
          <div class="cart-item-row">
            <span class="cart-item-price">${formatBRL(item.price * item.quantity)}</span>
            <div class="cart-item-quantity">
              <button type="button" data-cart-dec="${idx}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-inc="${idx}">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalStrong.textContent = formatBRL(subtotal);
  
  // Bind qty adjustments
  itemsContainer.querySelectorAll("[data-cart-dec]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.cartDec);
      if (cart[idx].quantity > 1) {
        cart[idx].quantity--;
      } else {
        cart.splice(idx, 1);
      }
      saveCart();
    });
  });
  
  itemsContainer.querySelectorAll("[data-cart-inc]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.cartInc);
      cart[idx].quantity++;
      saveCart();
    });
  });
}

function openCartDrawer() {
  const drawer = document.querySelector("[data-cart-drawer]");
  if (drawer) {
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open");
  }
}

function closeCartDrawer() {
  const drawer = document.querySelector("[data-cart-drawer]");
  if (drawer) {
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-open");
  }
}

function bindCartCloseButtons() {
  document.querySelectorAll("[data-cart-close]").forEach(el => {
    el.addEventListener("click", closeCartDrawer);
  });
}

// Checkout button redirect to Yampi
function handleCheckout() {
  if (!cart.length) {
    showToast("Adicione produtos ao carrinho para finalizar a compra.");
    return;
  }
  
  // Load full product references to find SKUs
  const firstItem = cart[0];
  const fullProduct = products.find(p => p.id === firstItem.productId);
  
  if (!fullProduct) {
    showToast("Erro ao abrir checkout. Tente novamente.");
    return;
  }
  
  const checkoutUrl = generateCheckoutUrl(
    fullProduct, 
    firstItem.size, 
    firstItem.color, 
    firstItem.quantity, 
    firstItem.customization
  );
  
  if (checkoutUrl) {
    showToast("Redirecionando para o checkout seguro...");
    setTimeout(() => {
      window.location.href = checkoutUrl;
    }, 800);
  } else {
    showToast("Checkout indisponível para este produto/tamanho.");
  }
}

// SPA ROUTER
function route() {
  const path = window.location.pathname;
  
  // Views
  const homeView = document.getElementById("home-view");
  const catalogView = document.getElementById("catalog-view");
  const productView = document.getElementById("product-view");
  const policiesView = document.getElementById("policies-view");
  
  // Hide all initially
  if (homeView) homeView.hidden = true;
  if (catalogView) catalogView.hidden = true;
  if (productView) productView.hidden = true;
  if (policiesView) policiesView.hidden = true;
  
  // Set active link in header
  document.querySelectorAll("[data-main-nav] a").forEach(link => {
    link.classList.remove("active");
  });
  
  // Scroll to top
  window.scrollTo(0, 0);
  
  // Match path
  const productMatch = path.match(/^\/produto\/([^/]+)\/?$/);
  
  if (productMatch) {
    // Product Page
    if (productView) {
      productView.hidden = false;
      renderProductPage(productMatch[1]);
    }
  } else if (path === "/produtos") {
    // Catalog page
    if (catalogView) {
      catalogView.hidden = false;
      
      const navLink = document.querySelector("[data-main-nav] a[href='/produtos']");
      if (navLink) navLink.classList.add("active");
      
      const params = new URLSearchParams(window.location.search);
      const category = params.get("categoria") || "";
      const search = params.get("busca") || "";
      renderCatalog(category, search);
    }
  } else if (path === "/politicas") {
    // Policies
    if (policiesView) {
      policiesView.hidden = false;
      document.title = "Políticas | Caomisa";
    }
  } else if (path === "/ajuda") {
    // Help scrolls to helps element on home page
    if (homeView) {
      homeView.hidden = false;
      renderHome();
      
      const helpLink = document.querySelector("[data-main-nav] a[href='/ajuda']");
      if (helpLink) helpLink.classList.add("active");
      
      const el = document.getElementById("ajuda");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  } else {
    // Home Page default (including /)
    if (homeView) {
      homeView.hidden = false;
      document.title = "Caomisa | Roupas de Dog";
      
      const homeLink = document.querySelector("[data-main-nav] a[href='/']");
      if (homeLink) homeLink.classList.add("active");
      
      renderHome();
    }
  }
}

// BIND GENERAL EVENT LISTENERS
function bindEvents() {
  // Mobile menu drawer
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const mainNav = document.querySelector("[data-main-nav]");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("active");
    });
  }
  
  // Cart open/close triggers
  const cartBtn = document.querySelector("[data-cart-open]");
  if (cartBtn) {
    cartBtn.addEventListener("click", openCartDrawer);
  }
  bindCartCloseButtons();
  
  // Checkout trigger
  const checkoutBtn = document.querySelector("[data-checkout]");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", handleCheckout);
  }
  
  // Global Zoom closure
  const zoomModal = document.querySelector("[data-zoom-modal]");
  if (zoomModal) {
    zoomModal.querySelectorAll("[data-zoom-close]").forEach(el => {
      el.addEventListener("click", () => {
        zoomModal.hidden = true;
        document.body.classList.remove("zoom-open");
      });
    });
  }
  
  // Global Size Guide closure
  const sizeGuideModal = document.querySelector("[data-size-guide-modal]");
  if (sizeGuideModal) {
    sizeGuideModal.querySelectorAll("[data-size-guide-close]").forEach(el => {
      el.addEventListener("click", () => {
        sizeGuideModal.hidden = true;
        document.body.classList.remove("size-guide-open");
      });
    });
  }
  
  // Intercept click on anchors for SPA routing
  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;
    
    const href = anchor.getAttribute("href");
    if (!href) return;
    
    // Ignore external links or anchor hash links
    if (href.startsWith("http") || href.startsWith("//") || href.startsWith("mailto:") || href.startsWith("tel:") || anchor.target === "_blank") {
      return;
    }
    
    // If it's a sub-hash link within same pathname (e.g. #comentarios)
    if (href.startsWith("#") && !href.startsWith("#produto")) {
      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    
    e.preventDefault();
    navigate(href);
  });
  
  // Header Search Toggles
  const searchToggle = document.querySelector("[data-search-toggle]");
  const searchPanel = document.querySelector("[data-search-panel]");
  const searchInput = document.querySelector("[data-search-input]");
  const searchClose = document.querySelector("[data-search-close]");
  
  if (searchToggle && searchPanel && searchInput && searchClose) {
    searchToggle.addEventListener("click", () => {
      searchPanel.hidden = !searchPanel.hidden;
      if (!searchPanel.hidden) searchInput.focus();
    });
    
    searchClose.addEventListener("click", () => {
      searchPanel.hidden = true;
      searchInput.value = "";
    });
    
    // Handle typing search
    searchInput.addEventListener("input", () => {
      const val = searchInput.value.toLowerCase().trim();
      const resultsDiv = document.querySelector("[data-search-results]");
      if (!resultsDiv) return;
      
      if (!val) {
        resultsDiv.hidden = true;
        return;
      }
      
      const filtered = products.filter(p => p.name.toLowerCase().includes(val) || p.description.toLowerCase().includes(val)).slice(0, 5);
      
      if (filtered.length) {
        resultsDiv.innerHTML = filtered.map(p => `
          <a href="/produto/${p.id.replace(/^yampi-/i, "")}" class="search-preview-item">
            <img src="${p.image}" alt="" />
            <div>
              <strong>${p.name}</strong>
              <span>${formatBRL(p.price)}</span>
            </div>
          </a>
        `).join("");
      } else {
        resultsDiv.innerHTML = `<div class="search-empty">Nenhum resultado encontrado.</div>`;
      }
      resultsDiv.hidden = false;
    });
    
    // Close search panel on enter
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const val = searchInput.value.trim();
        if (val) {
          searchPanel.hidden = true;
          navigate(`/produtos?busca=${encodeURIComponent(val)}`);
        }
      }
    });
  }
  
  // Collections scrolling trigger
  document.querySelectorAll("[data-collection-scroll]").forEach(btn => {
    btn.addEventListener("click", () => {
      const track = document.querySelector("[data-collection-track]");
      if (track) {
        const dir = Number(btn.dataset.collectionScroll);
        track.scrollLeft += dir * 200;
      }
    });
  });
  
  // Catalog View category filter pill click hijacking
  const catalogPills = document.querySelector("[data-category-filters-pills]");
  if (catalogPills) {
    catalogPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (btn) {
        const cat = btn.dataset.filter;
        const params = new URLSearchParams(window.location.search);
        if (cat === "Todos") {
          params.delete("categoria");
        } else {
          params.set("categoria", cat);
        }
        // Retain search query if present
        const searchVal = params.get("busca");
        const queryStr = params.toString();
        
        window.history.pushState(null, "", `/produtos${queryStr ? `?${queryStr}` : ""}`);
        
        // Toggle pill visual active states
        catalogPills.querySelectorAll("[data-filter]").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        
        renderCatalog(cat === "Todos" ? "" : cat, searchVal);
      }
    });
  }
  
  // Popstate history listener for back/forward buttons
  window.addEventListener("popstate", route);
}

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", async () => {
  loadCart();
  renderCart();
  bindEvents();
  
  await loadPageData();
  setupHeaderCategoryMenu();
  route();
});
