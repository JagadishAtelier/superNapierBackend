const PageContent = require("../Model/PageContent");

// Default About Us Content
const defaultAboutContent = {
  hero: {
    story: "Our Story",
    title: "About Super Napier",
    description: "Empowering Indian farmers with world-class seeds and agri-knowledge, one harvest at a time.",
    imageSrc: {
      url: "/hero-slider4.jpg",
      publicId: "default-about-hero",
      alt: "About Background"
    }
  },
  story: {
    subtitle: "Who We Are",
    title: "Rooted In Purpose",
    description1: "Super Napier was founded with a single mission — to put the most productive, resilient seeds into the hands of every farmer in India. Over more than a decade we've grown from a small nursery to a trusted agri-brand serving tens of thousands of farmers across the country.",
    description2: "Our flagship crop, the Super Napier Grass, yields up to 200 tonnes per acre annually and thrives across diverse soil and climate conditions. Backed by continuous field research and farmer feedback, we improve with every season.",
    buttonText: "Explore Products",
    buttonLink: "/products",
    imageSrc: {
      url: "/napierStems.webp",
      publicId: "default-about-story",
      alt: "Super Napier Grass"
    },
    badgeTitle: "Germination Rate",
    badgeValue: "95%+"
  },
  stats: [
    { value: "10,000+", label: "Happy Farmers", iconName: "Users" },
    { value: "12+", label: "Years Experience", iconName: "Award" },
    { value: "200 Tons", label: "Per Acre Yield", iconName: "TrendingUp" },
    { value: "99%", label: "Satisfaction Rate", iconName: "ShieldCheck" }
  ],
  values: [
    {
      title: "Quality First",
      desc: "Every seed we provide is rigorously tested for germination rate, purity, and vigour — ensuring you only ever plant the best.",
      iconName: "ShieldCheck",
      bg: "bg-[#f2fae6]",
      accent: "text-[#16a34a]",
      iconBg: "bg-[#dcfce7]"
    },
    {
      title: "Farmer-Centric",
      desc: "Our decisions start with the farmer. We listen, learn, and build solutions that make a real difference in the field and at the market.",
      iconName: "Users",
      bg: "bg-[#fff4ed]",
      accent: "text-orange-500",
      iconBg: "bg-orange-100"
    },
    {
      title: "Sustainable Growth",
      desc: "We believe prosperous farming and a healthy planet go hand in hand. Our seeds are bred to reduce inputs and increase earth-friendly yields.",
      iconName: "Leaf",
      bg: "bg-[#eef8ed]",
      accent: "text-[#059669]",
      iconBg: "bg-[#d1fae5]"
    }
  ],
  cta: {
    subtitle: "Ready to grow?",
    title: "Join Our Growing Family",
    description: "Thousands of farmers trust Super Napier to power their farms. Start your journey with seeds built for success.",
    button1Text: "Get Started Today",
    button1Link: "/products",
    button2Text: "Contact Sales",
    button2Link: "tel:+91XXXXXXXXXX"
  }
};

const defaultAboutSeo = {
  title: "About Us",
  description: "Empowering Indian farmers with world-class seeds and agri-knowledge, one harvest at a time.",
  keywords: ["about", "super napier", "farming", "seeds", "fodder"],
  ogTitle: "About Us - Super Napier",
  ogDescription: "Empowering Indian farmers with world-class seeds and agri-knowledge, one harvest at a time.",
  ogImage: "/hero-slider4.jpg",
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Super Napier",
    "description": "Empowering Indian farmers with world-class seeds and agri-knowledge, one harvest at a time."
  }
};

// Default Partnership Content
const defaultPartnershipContent = {
  hero: {
    title: "Powering Your 5,000-Acre Bio-Industrial Vision",
    description: "Strategic feedstock partnership for Biofuel and Pulp Ventures. The Super Napier Team delivers excellence in biomass scalability.",
    button1Text: "Partner With Us",
    button1Link: "#contact",
    button2Text: "Download Proposal",
    button2Link: "#",
    imageSrc: {
      url: "/assets/partnership/hero.png",
      publicId: "default-partnership-hero",
      alt: "Super Napier Grass"
    }
  },
  pillarsSection: {
    title: "The Foundational Choice",
    subtitle: "Why industry leaders are switching to Super Napier for their bio-industrial feedstock.",
    pillars: [
      {
        title: "Unmatched Yield",
        description: "Achieve up to 200 tons per acre annually, ensuring a consistent supply for large-scale industrial needs.",
        iconName: "Zap"
      },
      {
        title: "Ironclad Reliability",
        description: "Engineered for resilience, our Super Napier slips guarantee rapid regrowth and year-round availability.",
        iconName: "ShieldCheck"
      },
      {
        title: "Maximum Profitability",
        description: "Lower input costs and high biomass density translate directly to superior ROI for biofuel and pulp ventures.",
        iconName: "TrendingUp"
      }
    ]
  },
  statsSection: {
    title: "The Super Napier Advantage",
    description: "Our specific cultivar is optimized for maximum biomass density and nutrient extraction efficiency. It's not just grass; it's a high-performance industrial asset.",
    highlights: [
      "High Biomass for Biofuel",
      "Optimal Fiber for Pulp (Kraft Paper)",
      "Rapid Scalability for 5,000+ Acres"
    ],
    stats: [
      { label: "Annual Yield", value: "200", suffix: "Tons/Acre", color: "text-earthy-gold", glow: "shadow-[0_0_20px_rgba(197,160,89,0.3)]" },
      { label: "Crude Protein", value: "18", suffix: "%", color: "text-accent-lime", glow: "shadow-[0_0_20px_rgba(163,230,53,0.2)]" },
      { label: "Regrowth Cycle", value: "45", suffix: "Days", color: "text-white", glow: "shadow-[0_0_20px_rgba(255,255,255,0.1)]" },
      { label: "Water Efficiency", value: "95", suffix: "%", color: "text-cyan-400", glow: "shadow-[0_0_20px_rgba(34,211,238,0.2)]" }
    ]
  },
  applicationsSection: {
    title: "Industrial Applications",
    imageSrc: {
      url: "/assets/partnership/industrial.png",
      publicId: "default-partnership-apps",
      alt: "Industrial Biomass Context"
    },
    badgeValue: "95%",
    badgeText: "Conversion Efficiency in Bio-Pulping",
    applications: [
      {
        number: "01",
        title: "Biofuel Generation",
        description: "With a high calorific value and low ash content, our Super Napier is the ideal feedstock for second-generation ethanol production and biomass power plants."
      },
      {
        number: "02",
        title: "Pulp & Paper (Kraft)",
        description: "The optimal fiber length and cellulose-to-lignin ratio make our cultivar a superior alternative for Kraft paper production, reducing chemical consumption in pulping."
      }
    ]
  },
  comparisonSection: {
    title: "The Data-Driven Choice",
    subtitle: "Why \"Slips\" are the industrial standard for 5,000-acre scalability.",
    columns: ["Parameters", "Slips (Our Choice)", "Tissue Culture", "Seeds"],
    rows: [
      { feature: "Cost Effectiveness", slips: "High", tissue: "Low", seeds: "Medium" },
      { feature: "Scalability", slips: "Excellent", tissue: "Moderate", seeds: "Low" },
      { feature: "Maturity Speed", slips: "Fast", tissue: "Slow", seeds: "Very Slow" },
      { feature: "Genetic Stability", slips: "100%", tissue: "99%", seeds: "Variable" },
      { feature: "Survival Rate", slips: "98%+", tissue: "90%", seeds: "60-70%" }
    ],
    footnote: "* Data based on multi-location trials for industrial biomass production.",
    buttonText: "Get Detailed Report"
  },
  timelineSection: {
    title: "Execution Roadmap",
    subtitle: "Strategic coordination for 5,000-acre biomass infrastructure.",
    steps: [
      { phase: "Phase 01", title: "On-Site Assessment", duration: "Week 1-2", details: "Soil testing, water source verification, and land preparation blueprints." },
      { phase: "Phase 02", title: "Pilot Block Setup", duration: "Week 3-6", details: "Initial 100-acre planting to calibrate growth parameters and local adaptation." },
      { phase: "Phase 03", title: "Mass Scale Deployment", duration: "Month 2-6", details: "Synchronized delivery of slips for the remaining 4,900 acres in manageable blocks." },
      { phase: "Phase 04", title: "Industrial Harvest", duration: "Month 6+", details: "First full-scale harvest and transition to a 45-day regrowth cycle." }
    ]
  },
  servicesSection: {
    title: "Agronomic Blueprint",
    subtitle: "We don't just supply slips; we provide the entire technical ecosystem required for 5,000-acre success.",
    buttonText: "View Technical Specs",
    services: [
      { title: "Soil Analysis", description: "Detailed nutrient mapping and pH adjustment strategies to optimize your soil for Super Napier vigor.", iconName: "Beaker" },
      { title: "Planting Tech", description: "Precision spacing and depth techniques ensuring 99% survival rate across massive acreages.", iconName: "Sprout" },
      { title: "Pest Management", description: "Eco-friendly, bio-industrial grade protection against local pests without compromising biomass quality.", iconName: "Bug" },
      { title: "Harvesting Systems", description: "Mechanized harvesting schedules designed to maximize regrowth speed and fiber quality.", iconName: "Scissors" }
    ]
  },
  footerSection: {
    title: "Let’s Build a Successful Future, Together",
    description: "Partner with Ponni Seeds to secure your biomass supply chain. Our team of experts is ready to assist you in multiple languages.",
    buttons: ["English Support", "தமிழ் service (Tamil)", "हिंदी assistance (Hindi)"],
    phone: "+91 76394 44670",
    email: "partnership@ponniseeds.com"
  }
};

const defaultPartnershipSeo = {
  title: "Strategic Partnerships",
  description: "Strategic feedstock partnership for Biofuel and Pulp Ventures. The Super Napier Team delivers excellence in biomass scalability.",
  keywords: ["partnership", "biofuel", "biomass", "industrial scale"],
  ogTitle: "Partnership - Super Napier",
  ogDescription: "Strategic feedstock partnership for Biofuel and Pulp Ventures.",
  ogImage: "/assets/partnership/hero.png",
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Strategic Partnerships",
    "description": "Strategic feedstock partnership for Biofuel and Pulp Ventures."
  }
};

// GET /api/pages/:pageId
exports.getPageContent = async (req, res) => {
  try {
    const { pageId } = req.params;

    if (!["about", "partnership"].includes(pageId)) {
      return res.status(400).json({ success: false, message: "Invalid page ID. Allowed pages: 'about', 'partnership'." });
    }

    let page = await PageContent.findOne({ pageId });

    if (!page) {
      // Seed defaults if not found
      const defaultContent = pageId === "about" ? defaultAboutContent : defaultPartnershipContent;
      const defaultSeo = pageId === "about" ? defaultAboutSeo : defaultPartnershipSeo;

      page = await PageContent.create({
        pageId,
        content: defaultContent,
        seo: defaultSeo,
        updatedBy: "system"
      });
    }

    return res.status(200).json({ success: true, page });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/pages/:pageId
exports.updatePageContent = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { content, seo } = req.body;

    if (!["about", "partnership"].includes(pageId)) {
      return res.status(400).json({ success: false, message: "Invalid page ID. Allowed pages: 'about', 'partnership'." });
    }

    if (!content) {
      return res.status(400).json({ success: false, message: "Page content is required." });
    }

    // Validate SEO structure if present
    if (seo) {
      // Validate JSON-LD
      if (seo.jsonLd !== undefined && seo.jsonLd !== null) {
        let jsonLdObj = seo.jsonLd;
        if (typeof jsonLdObj === "string") {
          try {
            jsonLdObj = JSON.parse(jsonLdObj);
          } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid JSON-LD string format." });
          }
        }
        
        if (typeof jsonLdObj !== "object" || jsonLdObj === null) {
          return res.status(400).json({ success: false, message: "JSON-LD must be an object or array." });
        }

        const hasContext = Array.isArray(jsonLdObj)
          ? jsonLdObj.some(item => item && item["@context"])
          : (jsonLdObj["@context"] !== undefined);

        const hasType = Array.isArray(jsonLdObj)
          ? jsonLdObj.some(item => item && item["@type"])
          : (jsonLdObj["@type"] !== undefined);

        if (!hasContext || !hasType) {
          return res.status(400).json({
            success: false,
            message: "JSON-LD structured data is missing required standard fields '@context' or '@type'."
          });
        }
        
        seo.jsonLd = jsonLdObj; // Normalize as object
      }
    }

    let page = await PageContent.findOne({ pageId });

    if (!page) {
      // Create if it doesn't exist
      page = new PageContent({ pageId });
    }

    page.content = content;
    if (seo) {
      page.seo = {
        title: seo.title || "",
        description: seo.description || "",
        keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
        ogTitle: seo.ogTitle || "",
        ogDescription: seo.ogDescription || "",
        ogImage: seo.ogImage || "",
        jsonLd: seo.jsonLd
      };
    }
    
    page.updatedBy = req.user ? req.user.email || req.user.id || "admin" : "admin";

    await page.save();

    return res.status(200).json({ success: true, message: "Page content updated successfully.", page });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
