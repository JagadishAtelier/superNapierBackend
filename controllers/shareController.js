const mongoose = require("mongoose");
const Product = require("../Model/ProductModel");

/**
 * Escapes special characters for safe inclusion in HTML attributes and text nodes.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safely serializes JSON-LD by escaping `<` to prevent closing script injection.
 */
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/**
 * Strips HTML tags and normalizes whitespace.
 */
function stripHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates an optimized 1200x630 social preview image URL using Cloudinary transformations
 * without modifying the original product image.
 */
function getSocialImageUrl(rawUrl, clientUrl) {
  const defaultFallback = `${clientUrl}/placeholder.png`;
  if (!rawUrl) return defaultFallback;

  // Cloudinary dynamic transformation insertion
  if (rawUrl.includes("res.cloudinary.com") && rawUrl.includes("/upload/")) {
    // Avoid double transformation if already present
    if (!rawUrl.includes("c_fill,w_1200,h_630")) {
      return rawUrl.replace("/upload/", "/upload/c_fill,w_1200,h_630,g_auto,q_auto,f_auto/");
    }
    return rawUrl;
  }

  // If already absolute HTTP/HTTPS URL
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  // If relative path
  return `${clientUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

/**
 * Public Share Controller: GET /share/product/:id
 * Serves universal SEO metadata HTML for crawlers and executes instant JS redirect for browsers.
 */
exports.renderProductSharePage = async (req, res) => {
  try {
    const { id } = req.params;
    const clientUrl = (process.env.CLIENT_URL || "https://supernapier.in").replace(/\/$/, "");

    // Query product by MongoDB ObjectId or human-readable productId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { productId: id }] }
      : { productId: id };

    const product = await Product.findOne(query).lean();

    // 404 Handling: If product doesn't exist, gracefully redirect human to store catalog
    if (!product) {
      res.status(404).set("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Not Found | SuperNapier</title>
  <meta name="robots" content="noindex, follow">
  <script>window.location.replace("${clientUrl}/products");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${clientUrl}/products"></noscript>
</head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #FAFCF8; color: #1B5E20;">
  <h2>Product Not Found</h2>
  <p>Redirecting to store catalog... <a href="${clientUrl}/products" style="color: #1B5E20; font-weight: bold;">Click here</a></p>
</body>
</html>`);
    }

    // Extract product details
    const productName = product.name?.en || product.name || "Super Napier Product";
    const rawDesc = product.description?.en || product.description || "High-yield hybrid green fodder grass seeds and agricultural solutions from SuperNapier.";
    const cleanDesc = stripHtml(rawDesc);
    const shortDesc = cleanDesc.length > 160 ? `${cleanDesc.substring(0, 157)}...` : cleanDesc;

    // Price calculation: find lowest active price among weight options
    let currentPrice = 0;
    let inStock = false;

    if (product.weightOptions && product.weightOptions.length > 0) {
      const prices = product.weightOptions.map(opt => {
        const p1 = Number(opt.price || 0);
        const p2 = Number(opt.discountPrice || 0);
        return p2 > 0 ? Math.min(p1, p2) : p1;
      });
      currentPrice = Math.min(...prices);
      inStock = product.weightOptions.some(opt => (opt.stock || 0) > 0);
    } else {
      currentPrice = Number(product.price || 0);
      inStock = true;
    }

    // Image URL resolution
    const rawImage = product.images?.[0] || product.image || "";
    const socialImageUrl = getSocialImageUrl(rawImage, clientUrl);

    // Canonical & Storefront Target URL
    const canonicalUrl = `${clientUrl}/product/${product._id}`;
    const pageTitle = `${productName} - ₹${currentPrice} | SuperNapier`;

    // JSON-LD Product Schema
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productName,
      image: [socialImageUrl],
      description: cleanDesc,
      sku: product.SKU || product.productId || String(product._id),
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: currentPrice,
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      },
    };

    // Cache-Control: Cache for 5 minutes in client browser, 10 minutes in CDN/proxies
    // Relax CSP on share page so browsers can run the instant redirect script without Helmet blocking
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Content-Security-Policy": "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data: blob: https:; default-src 'self'",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>

  <!-- Canonical & Basic SEO -->
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="description" content="${escapeHtml(shortDesc)}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="SuperNapier">
  <meta property="og:locale" content="en_IN">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(shortDesc)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(socialImageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(socialImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(productName)}">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(shortDesc)}">
  <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}">
  <meta name="twitter:image:alt" content="${escapeHtml(productName)}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
    ${safeJsonLd(schemaData)}
  </script>

  <!-- Primary Fast Client Redirect -->
  <script>
    window.location.replace("${escapeHtml(canonicalUrl)}");
  </script>

  <!-- Fallback for JavaScript-disabled environments -->
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  </noscript>
</head>
<body style="margin:0; padding:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#FAFCF8; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1B5E20; text-align:center;">
  <div style="max-width:480px; padding:24px;">
    <div style="width:48px; height:48px; margin:0 auto 16px; border:4px solid #C8E6C9; border-top-color:#1B5E20; border-radius:50%; animation:spin 1s linear infinite;"></div>
    <h2 style="margin:0 0 8px; font-size:20px; font-weight:700;">Redirecting to SuperNapier...</h2>
    <p style="margin:0 0 16px; color:#5D4037; font-size:14px;">${escapeHtml(productName)}</p>
    <p style="margin:0; font-size:13px; color:#777;">
      If you are not redirected automatically, 
      <a href="${escapeHtml(canonicalUrl)}" style="color:#1B5E20; font-weight:700; text-decoration:underline;">click here to view product</a>.
    </p>
  </div>
  <style>
    @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
  </style>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    console.error("Error rendering product share page:", error);
    const clientUrl = (process.env.CLIENT_URL || "https://supernapier.in").replace(/\/$/, "");
    return res.redirect(`${clientUrl}/products`);
  }
};
