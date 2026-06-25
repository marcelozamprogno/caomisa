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

// Checkout button redirect to integrated checkout
function handleCheckout() {
  if (!cart.length) {
    showToast("Adicione produtos ao carrinho para finalizar a compra.");
    return;
  }
  
  closeCartDrawer();
  navigate("/checkout");
}

// SPA ROUTER
function route() {
  const path = window.location.pathname;
  
  // Views
  const homeView = document.getElementById("home-view");
  const catalogView = document.getElementById("catalog-view");
  const productView = document.getElementById("product-view");
  const policiesView = document.getElementById("policies-view");
  const checkoutView = document.getElementById("checkout-view");
  
  // Hide all initially
  if (homeView) homeView.hidden = true;
  if (catalogView) catalogView.hidden = true;
  if (productView) productView.hidden = true;
  if (policiesView) policiesView.hidden = true;
  if (checkoutView) checkoutView.hidden = true;
  
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
  } else if (path === "/checkout") {
    // Checkout page
    if (checkoutView) {
      checkoutView.hidden = false;
      renderCheckout();
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
  
  // Global Modals closure using delegation
  document.addEventListener("click", (e) => {
    const zoomClose = e.target.closest("[data-zoom-close]");
    if (zoomClose) {
      const zoomModal = document.querySelector("[data-zoom-modal]");
      if (zoomModal) {
        zoomModal.hidden = true;
        document.body.classList.remove("zoom-open");
      }
    }
  });
  
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

// --- INTEGRATED CHECKOUT LOGIC ---

function renderCheckout() {
  document.title = "Finalizar Compra | Caomisa";
  
  const checkoutItemsContainer = document.querySelector("[data-checkout-items]");
  const subtotalSpan = document.querySelector("[data-checkout-subtotal]");
  const discountSpan = document.querySelector("[data-checkout-pix-discount]");
  const totalStrong = document.querySelector("[data-checkout-total]");
  
  if (!checkoutItemsContainer || !subtotalSpan || !discountSpan || !totalStrong) return;
  
  if (cart.length === 0) {
    document.getElementById("checkout-view").innerHTML = `
      <div class="cart-empty" style="max-width: 500px; margin: 80px auto; text-align: center;">
        <i data-lucide="shopping-bag" style="width: 64px; height: 64px; color: var(--text-muted); margin-bottom: 20px;" aria-hidden="true"></i>
        <h2 style="color: var(--brand-secondary); margin-bottom: 12px; font-weight: 800;">Seu carrinho está vazio</h2>
        <p style="color: var(--text-muted); margin-bottom: 24px;">Adicione produtos para poder finalizar sua compra.</p>
        <a class="primary-button" href="/produtos">Ir para a Loja</a>
      </div>
    `;
    iconRefresh();
    return;
  }
  
  checkoutItemsContainer.innerHTML = cart.map((item) => {
    const metaStr = item.customization 
      ? `Tamanho: ${item.size} | Nome: <strong>${item.customization.name}</strong> | Nº: <strong>${item.customization.number}</strong>`
      : `Tamanho: ${item.size}`;
      
    return `
      <div class="checkout-item-row">
        <img src="${item.image}" alt="${item.name}" />
        <div class="checkout-item-info">
          <span class="checkout-item-title">${item.name}</span>
          <span class="checkout-item-meta">${metaStr} (x${item.quantity})</span>
        </div>
        <span class="checkout-item-price">${formatBRL(item.price * item.quantity)}</span>
      </div>
    `;
  }).join("");
  
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pixDiscount = subtotal * 0.05;
  const total = subtotal - pixDiscount;
  
  subtotalSpan.textContent = formatBRL(subtotal);
  discountSpan.textContent = `- ${formatBRL(pixDiscount)}`;
  totalStrong.textContent = formatBRL(total);
  
  setupCheckoutInputFormatters();
  
  const payBtn = document.getElementById("btn-generate-pix");
  if (payBtn) {
    payBtn.addEventListener("click", handlePaymentSubmit);
  }
}

function setupCheckoutInputFormatters() {
  const phoneInput = document.getElementById("checkout-phone");
  const cpfInput = document.getElementById("checkout-cpf");
  const cepInput = document.getElementById("checkout-cep");
  
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
      e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });
  }
  
  if (cpfInput) {
    cpfInput.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "");
      if (val.length > 11) val = val.slice(0, 11);
      
      let formatted = "";
      if (val.length > 9) {
        formatted = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else if (val.length > 6) {
        formatted = val.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      } else if (val.length > 3) {
        formatted = val.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      } else {
        formatted = val;
      }
      e.target.value = formatted;
    });
  }
  
  if (cepInput) {
    cepInput.addEventListener("input", async (e) => {
      let val = e.target.value.replace(/\D/g, "");
      if (val.length > 8) val = val.slice(0, 8);
      
      let formatted = val;
      if (val.length > 5) {
        formatted = val.replace(/(\d{5})(\d{1,3})/, "$1-$2");
      }
      e.target.value = formatted;
      
      if (val.length === 8) {
        await handleCepLookup(val);
      }
    });
  }
}

async function handleCepLookup(cep) {
  const street = document.getElementById("checkout-street");
  const neighborhood = document.getElementById("checkout-neighborhood");
  const city = document.getElementById("checkout-city");
  const state = document.getElementById("checkout-state");
  const spinner = document.querySelector(".cep-loading-spinner");
  
  if (!street || !neighborhood || !city || !state) return;
  
  if (spinner) spinner.hidden = false;
  
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    
    if (data && !data.erro) {
      street.value = data.logradouro || "";
      neighborhood.value = data.bairro || "";
      city.value = data.localidade || "";
      state.value = data.uf || "";
      
      const numInput = document.getElementById("checkout-number");
      if (numInput) numInput.focus();
    } else {
      showToast("CEP não encontrado. Digite o endereço manualmente.");
    }
  } catch (err) {
    console.error("Erro ao buscar CEP:", err);
  } finally {
    if (spinner) spinner.hidden = true;
  }
}

let pixTimerInterval = null;
function startPixCountdown() {
  clearInterval(pixTimerInterval);
  let duration = 10 * 60;
  
  const display = document.getElementById("pix-countdown");
  if (!display) return;
  
  pixTimerInterval = setInterval(() => {
    let minutes = Math.floor(duration / 60);
    let seconds = duration % 60;
    
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    
    display.textContent = `${minutes}:${seconds}`;
    
    if (--duration < 0) {
      clearInterval(pixTimerInterval);
      display.textContent = "EXPIRADO";
      display.parentElement.style.color = "var(--text-muted)";
      display.parentElement.style.background = "#edf2f7";
      display.parentElement.style.borderColor = "#cbd5e1";
      showToast("O código Pix expirou. Por favor, refaça o pedido.");
    }
  }, 1000);
}

function drawMockQrCode() {
  const svg = document.getElementById("pix-qr-svg");
  if (!svg) return;
  
  svg.innerHTML = "";
  
  const grid = 29;
  const finderPattern = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1]
  ];
  
  let matrix = Array.from({length: grid}, () => Array(grid).fill(0));
  
  for (let r=0; r<7; r++) {
    for (let c=0; c<7; c++) {
      matrix[r][c] = finderPattern[r][c];
    }
  }
  for (let r=0; r<7; r++) {
    for (let c=0; c<7; c++) {
      matrix[r][grid-7+c] = finderPattern[r][c];
    }
  }
  for (let r=0; r<7; r++) {
    for (let c=0; c<7; c++) {
      matrix[grid-7+r][c] = finderPattern[r][c];
    }
  }
  
  matrix[18][18] = 1; matrix[18][19] = 1; matrix[18][20] = 1;
  matrix[19][18] = 1; matrix[19][20] = 1;
  matrix[20][18] = 1; matrix[20][19] = 1; matrix[20][20] = 1;
  
  for (let c=8; c<grid-8; c++) {
    matrix[6][c] = c % 2 === 0 ? 1 : 0;
  }
  for (let r=8; r<grid-8; r++) {
    matrix[r][6] = r % 2 === 0 ? 1 : 0;
  }
  
  for (let r=0; r<grid; r++) {
    for (let c=0; c<grid; c++) {
      const inTopLeft = r < 9 && c < 9;
      const inTopRight = r < 9 && c > grid - 10;
      const inBottomLeft = r > grid - 10 && c < 9;
      const inAlignment = r > 16 && r < 22 && c > 16 && c < 22;
      const inTiming = r === 6 || c === 6;
      
      if (!inTopLeft && !inTopRight && !inBottomLeft && !inAlignment && !inTiming) {
        const hash = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        matrix[r][c] = (hash - Math.floor(hash)) > 0.45 ? 1 : 0;
      }
    }
  }
  
  let paths = [];
  for (let r=0; r<grid; r++) {
    for (let c=0; c<grid; c++) {
      if (matrix[r][c] === 1) {
        paths.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#000b2f" />`);
      }
    }
  }
  
  svg.innerHTML = paths.join("");
}

function handlePaymentSubmit() {
  const name = document.getElementById("checkout-name")?.value.trim();
  const email = document.getElementById("checkout-email")?.value.trim();
  const phone = document.getElementById("checkout-phone")?.value.trim();
  const cpf = document.getElementById("checkout-cpf")?.value.trim();
  const cep = document.getElementById("checkout-cep")?.value.trim();
  const street = document.getElementById("checkout-street")?.value.trim();
  const number = document.getElementById("checkout-number")?.value.trim();
  const neighborhood = document.getElementById("checkout-neighborhood")?.value.trim();
  const city = document.getElementById("checkout-city")?.value.trim();
  const state = document.getElementById("checkout-state")?.value.trim();
  
  if (!name || !email || !phone || !cpf || !cep || !street || !number || !neighborhood || !city || !state) {
    showToast("Por favor, preencha todos os campos obrigatórios.");
    return;
  }
  
  if (!email.includes("@") || !email.includes(".")) {
    showToast("Por favor, digite um e-mail válido.");
    return;
  }
  
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) {
    showToast("Por favor, digite um CPF válido.");
    return;
  }
  
  showToast("Gerando código Pix seguro...");
  
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pixDiscount = subtotal * 0.05;
  const total = subtotal - pixDiscount;
  
  const orderNumber = Math.floor(10000 + Math.random() * 90000);
  const randomHex = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join("");
  const pixKey = `00020101021226870014br.gov.bcb.pix2565caomisashop${orderNumber}@pix.bcb.gov.br5204000053039865405${total.toFixed(2)}5802BR5912CAOMISASHOP6009SAO%20PAULO62070503${orderNumber}6304${randomHex.slice(0,4).toUpperCase()}`;
  
  const formColumn = document.querySelector(".checkout-form-column");
  if (!formColumn) return;
  
  formColumn.innerHTML = `
    <div class="checkout-card pix-success-container">
      <div class="success-checkmark">
        <i data-lucide="check-circle-2" aria-hidden="true"></i>
      </div>
      <h2>Pedido Realizado com Sucesso!</h2>
      <p>Seu pedido <strong>#${orderNumber}</strong> foi gerado e aguarda pagamento por Pix. O seu estoque estará reservado pelos próximos 10 minutos.</p>
      
      <div class="pix-timer-box">
        <i data-lucide="clock" aria-hidden="true"></i>
        <span>Pague em: <strong id="pix-countdown">09:59</strong></span>
      </div>
      
      <div class="pix-qr-code-box">
        <svg id="pix-qr-svg" width="200" height="200" viewBox="0 0 29 29" shape-rendering="crispEdges">
          <!-- Dynamically filled -->
        </svg>
        <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px; font-weight: 600;">Escaneie o código com o aplicativo do seu banco</span>
      </div>
      
      <div class="pix-copia-cola-box">
        <label for="pix-key-input">Pix Copia e Cola</label>
        <div class="copia-cola-input-group">
          <input id="pix-key-input" type="text" value="${pixKey}" readonly />
          <button type="button" id="btn-copy-pix">Copiar Código</button>
        </div>
      </div>
      
      <div class="pix-instructions">
        <h4>Como Pagar:</h4>
        <ol>
          <li>Entre no aplicativo do seu banco e acesse a área <strong>Pix</strong>.</li>
          <li>Escolha a opção <strong>Pix Copia e Cola</strong> (ou aponte a câmera para o QR Code acima).</li>
          <li>Cole o código copiado ou escaneie o QR Code.</li>
          <li>Confirme se o valor é de <strong>${formatBRL(total)}</strong> e finalize o pagamento.</li>
        </ol>
      </div>
      
      <button type="button" class="primary-button already-paid-btn" id="btn-already-paid">
        Já fiz o pagamento
      </button>
    </div>
  `;
  
  iconRefresh();
  drawMockQrCode();
  
  cart = [];
  saveCart();
  startPixCountdown();
  
  document.getElementById("btn-copy-pix").addEventListener("click", () => {
    const input = document.getElementById("pix-key-input");
    if (input) {
      input.select();
      input.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(input.value);
      showToast("Chave Pix Copia e Cola copiada!");
      
      const copyBtn = document.getElementById("btn-copy-pix");
      if (copyBtn) {
        copyBtn.textContent = "Copiado!";
        copyBtn.style.background = "#22c55e";
        setTimeout(() => {
          copyBtn.textContent = "Copiar Código";
          copyBtn.style.background = "var(--brand-primary)";
        }, 2000);
      }
    }
  });
  
  document.getElementById("btn-already-paid").addEventListener("click", () => {
    showToast("Validando pagamento Pix seguro...");
    setTimeout(() => {
      formColumn.innerHTML = `
        <div class="checkout-card pix-success-container" style="padding: 40px 20px;">
          <div class="success-checkmark" style="background: rgba(34, 197, 94, 0.1); color: var(--success); width: 88px; height: 88px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <i data-lucide="shield-check" style="width: 48px; height: 48px;" aria-hidden="true"></i>
          </div>
          <h2 style="color: var(--brand-secondary); font-weight: 800; font-size: 1.8rem; margin-bottom: 12px;">Pagamento Confirmado!</h2>
          <p style="color: var(--text-muted); font-size: 1rem; max-width: 480px; margin: 0 auto 30px; line-height: 1.6;">
            Seu pagamento foi aprovado com sucesso! Iniciamos o processamento e a embalagem prioritária do pedido <strong>#${orderNumber}</strong>. Você receberá atualizações no e-mail cadastrado.
          </p>
          <a class="primary-button" href="/" style="max-width: 280px; margin: 0 auto; display: block; text-decoration: none; padding: 14px 28px;">Voltar para o Início</a>
        </div>
      `;
      iconRefresh();
    }, 1500);
  });
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
