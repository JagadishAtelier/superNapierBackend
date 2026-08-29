const Campaign = require('../Model/Campaign');
const Cart = require('../Model/Cart');
const Category = require('../Model/categoryModel');
const Order = require('../Model/Order');
const Product = require('../Model/ProductModel');
const ShiprocketToken = require('../Model/ShiprocketToken');
const User = require('../Model/User');
const Visitor = require('../Model/Visitor');
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const STATE_MAP = {
  "tn": "Tamil Nadu",
  "tamilnadu": "Tamil Nadu",
  "tamil nadu": "Tamil Nadu",
  "ka": "Karnataka",
  "karnataka": "Karnataka",
  "kl": "Kerala",
  "kerala": "Kerala",
  "ap": "Andhra Pradesh",
  "andhra pradesh": "Andhra Pradesh",
  "tg": "Telangana",
  "ts": "Telangana",
  "telangana": "Telangana",
  "mh": "Maharashtra",
  "maharashtra": "Maharashtra",
  "dl": "Delhi",
  "delhi": "Delhi",
  "py": "Puducherry",
  "puducherry": "Puducherry",
  "pondicherry": "Puducherry",
  "ga": "Goa",
  "goa": "Goa",
  "gj": "Gujarat",
  "gujarat": "Gujarat",
  "mp": "Madhya Pradesh",
  "madhya pradesh": "Madhya Pradesh",
  "up": "Uttar Pradesh",
  "uttar pradesh": "Uttar Pradesh",
  "rj": "Rajasthan",
  "rajasthan": "Rajasthan",
  "hr": "Haryana",
  "haryana": "Haryana",
  "pb": "Punjab",
  "punjab": "Punjab",
  "wb": "West Bengal",
  "west bengal": "West Bengal",
  "od": "Odisha",
  "odisha": "Odisha",
  "orissa": "Odisha"
};

function normalizeStateName(state) {
  if (!state) return "Unknown";
  const cleaned = state.trim().toLowerCase();
  if (STATE_MAP[cleaned]) {
    return STATE_MAP[cleaned];
  }
  return state
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Trend percentage helper
const calculateTrendPercentage = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? "+100%" : "—";
  }
  const pct = ((current - previous) / previous) * 100;
  return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
};

// Trend absolute helper
const calculateTrendAbsolute = (current, previous) => {
  const diff = current - previous;
  return diff >= 0 ? `+${diff}` : `${diff}`;
};

// Trend percentage point helper for conversion rate
const calculateTrendPP = (current, previous) => {
  const diff = current - previous;
  return diff >= 0 ? `+${diff.toFixed(2)} pp` : `${diff.toFixed(2)} pp`;
};

const getPeriodBoundaries = (range) => {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  
  let currentStartIST = new Date(nowIST);
  currentStartIST.setUTCHours(0, 0, 0, 0);

  let durationMs = 0;
  let isAllTime = false;

  if (range === '7') {
    durationMs = 7 * 24 * 60 * 60 * 1000;
    currentStartIST = new Date(currentStartIST.getTime() - (6 * 24 * 60 * 60 * 1000));
  } else if (range === '90') {
    durationMs = 90 * 24 * 60 * 60 * 1000;
    currentStartIST = new Date(currentStartIST.getTime() - (89 * 24 * 60 * 60 * 1000));
  } else if (range === 'this_month') {
    currentStartIST.setUTCDate(1); // 1st of current month
    const startMs = currentStartIST.getTime();
    const endMs = nowIST.getTime();
    durationMs = endMs - startMs;
  } else if (range === 'all') {
    isAllTime = true;
  } else {
    // Default to '30'
    durationMs = 30 * 24 * 60 * 60 * 1000;
    currentStartIST = new Date(currentStartIST.getTime() - (29 * 24 * 60 * 60 * 1000));
  }

  const currentStart = isAllTime ? new Date(0) : new Date(currentStartIST.getTime() - IST_OFFSET);
  const currentEnd = now;

  let previousStart = null;
  let previousEnd = null;

  if (!isAllTime) {
    if (range === 'this_month') {
      const prevMonthStartIST = new Date(currentStartIST);
      prevMonthStartIST.setUTCMonth(prevMonthStartIST.getUTCMonth() - 1);
      previousStart = new Date(prevMonthStartIST.getTime() - IST_OFFSET);
      previousEnd = new Date(currentStartIST.getTime() - IST_OFFSET);
    } else {
      previousStart = new Date(currentStart.getTime() - durationMs);
      previousEnd = currentStart;
    }
  }

  return {
    current: { start: currentStart, end: currentEnd },
    previous: isAllTime ? null : { start: previousStart, end: previousEnd }
  };
};

async function getDashboard(req, res) {
  try {
    const now = new Date();
    const { range = '30' } = req.query;
    const { current, previous } = getPeriodBoundaries(range);

    const rangeQuery = { createdAt: { $gte: current.start, $lt: current.end } };
    const prevRangeQuery = previous ? { createdAt: { $gte: previous.start, $lt: previous.end } } : null;

    // Run parallel queries
    const [
      totalUsers,
      totalOrders,
      prevTotalOrders,
      ordersByStatusAgg,
      currentSalesData,
      prevSalesData,
      recentOrders,
      topProductsAgg,
      lowStockProducts,
      activeCampaigns,
      currentVisitors,
      prevVisitors,
      cartsAbandoned,
      categoriesCount,
      productsCount,
      shiprocketToken,
      categoriesSales,
      rawRegionSales,
      salesTrendAgg
    ] = await Promise.all([
      // Users (all-time total)
      User.countDocuments(),

      // Orders (range and previous)
      Order.countDocuments(rangeQuery),
      prevRangeQuery ? Order.countDocuments(prevRangeQuery) : Promise.resolve(0),

      // Orders by status
      Order.aggregate([
        { $match: rangeQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // Current Revenue (paid Net Sales - paid minus refunded)
      Order.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'refunded'] }, createdAt: { $gte: current.start, $lt: current.end } } },
        { $group: {
          _id: null,
          gross: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$finalAmount', 0] } },
          refunds: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$finalAmount', 0] } }
        } }
      ]),

      // Previous Revenue
      prevRangeQuery ? Order.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'refunded'] }, createdAt: { $gte: previous.start, $lt: previous.end } } },
        { $group: {
          _id: null,
          gross: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$finalAmount', 0] } },
          refunds: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$finalAmount', 0] } }
        } }
      ]) : Promise.resolve([]),

      // Recent orders (always latest 10)
      Order.find().sort({ createdAt: -1 }).limit(10).populate('buyer', 'name email').lean(),

      // Top selling products (by quantity) filtered by range
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: current.start, $lt: current.end } } },
        { $unwind: '$products' },
        { $group: {
          _id: '$products.productId',
          quantitySold: { $sum: { $ifNull: ['$products.quantity', 1] } },
          revenue: { $sum: { $multiply: [ { $ifNull: ['$products.quantity', 1] }, { $ifNull: ['$products.price', 0] } ] } }
        } },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, productId: '$_id', name: '$product.name', productKey: '$product.productId', image: { $arrayElemAt: ['$product.images', 0] }, quantitySold: 1, revenue: 1 } }
      ]),

      // Low stock products
      Product.aggregate([
        { $addFields: { totalStock: { $sum: { $map: { input: '$weightOptions', as: 'wo', in: { $ifNull: ['$$wo.stock', 0] } } } } } },
        { $match: { totalStock: { $lte: 10 } } },
        { $project: { name: 1, productId: 1, totalStock: 1, image: { $arrayElemAt: ['$images', 0] } } },
        { $limit: 15 }
      ]),

      // Active campaigns
      Campaign.find({ status: 'Active' }).lean(),

      // Unique Visitors (current range)
      Visitor.aggregate([
        { $match: { visitedAt: { $gte: current.start, $lt: current.end } } },
        { $group: { _id: '$ipAddress' } },
        { $count: 'count' }
      ]),

      // Unique Visitors (previous range)
      previous ? Visitor.aggregate([
        { $match: { visitedAt: { $gte: previous.start, $lt: previous.end } } },
        { $group: { _id: '$ipAddress' } },
        { $count: 'count' }
      ]) : Promise.resolve([]),

      // Abandoned carts
      Cart.countDocuments({ items: { $exists: true, $ne: [] }, updatedAt: { $lte: new Date(now.getTime() - MILLIS_IN_DAY) } }),

      // Category and product counts
      Category.countDocuments(),
      Product.countDocuments(),

      // Shiprocket token
      ShiprocketToken.findOne().sort({ expiresAt: -1 }).lean(),

      // Category Sales (dynamic with order-time prices)
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: current.start, $lt: current.end } } },
        { $unwind: '$products' },
        { $lookup: { from: 'products', localField: 'products.productId', foreignField: '_id', as: 'prod' } },
        { $unwind: '$prod' },
        { $lookup: { from: 'categories', localField: 'prod.category', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        { $group: { _id: '$cat.name.en', value: { $sum: { $multiply: ['$products.price', '$products.quantity'] } } } },
        { $project: { label: '$_id', value: 1, _id: 0 } }
      ]),

      // Region Sales (state, orders, sales)
      Order.aggregate([
        { $match: { createdAt: { $gte: current.start, $lt: current.end } } },
        { $group: {
          _id: '$shippingAddress.state',
          orders: { $sum: 1 },
          sales: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$finalAmount', 0] } }
        } },
        { $project: { state: { $ifNull: ['$_id', 'Unknown'] }, orders: 1, sales: 1, _id: 0 } }
      ]),

      // Adaptive Sales Chart Trend
      (range === '90') ? Order.aggregate([
        { $match: { createdAt: { $gte: current.start, $lt: current.end } } },
        { $project: { week: { $isoWeek: '$createdAt' }, year: { $isoWeekYear: '$createdAt' }, amount: '$finalAmount', paymentStatus: 1 } },
        { $group: { _id: { year: '$year', week: '$week' }, total: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } }, orders: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.week': 1 } }
      ]) : (range === 'all') ? Order.aggregate([
        { $match: { createdAt: { $gte: current.start, $lt: current.end } } },
        { $project: { month: { $dateToString: { format: "%Y-%m", date: '$createdAt' } }, amount: '$finalAmount', paymentStatus: 1 } },
        { $group: { _id: '$month', total: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]) : Order.aggregate([
        // Daily for 7, 30, this_month
        { $match: { createdAt: { $gte: current.start, $lt: current.end } } },
        { $project: { day: { $dateToString: { format: "%Y-%m-%d", date: '$createdAt' } }, amount: '$finalAmount', paymentStatus: 1 } },
        { $group: { _id: '$day', total: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Format ordersByStatus map
    const ordersByStatus = ordersByStatusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    // Revenue calculations
    const revenue = currentSalesData[0] ? (currentSalesData[0].gross - currentSalesData[0].refunds) : 0;
    const prevRevenue = prevSalesData[0] ? (prevSalesData[0].gross - prevSalesData[0].refunds) : 0;

    // Unique visitor counts
    const visitors = (currentVisitors[0] && currentVisitors[0].count) || 0;
    const previousVisitors = (prevVisitors[0] && prevVisitors[0].count) || 0;

    // Conversion rate calculations
    const paidOrdersCount = await Order.countDocuments({ paymentStatus: 'paid', createdAt: { $gte: current.start, $lt: current.end } });
    const prevPaidOrdersCount = previous ? await Order.countDocuments({ paymentStatus: 'paid', createdAt: { $gte: previous.start, $lt: previous.end } }) : 0;

    const conversionRate = visitors > 0 ? (paidOrdersCount / visitors) * 100 : 0;
    const prevConversionRate = previousVisitors > 0 ? (prevPaidOrdersCount / previousVisitors) * 100 : 0;

    // AOV
    const averageOrderValue = paidOrdersCount > 0 ? revenue / paidOrdersCount : 0;

    // Format salesTrend mapping
    const salesTrend = salesTrendAgg.map((item) => {
      if (range === '90') {
        return { day: `W${item._id.week}, ${item._id.year}`, total: item.total, orders: item.orders };
      } else {
        return { day: item._id, total: item.total, orders: item.orders };
      }
    });

    // Format categorySales percentages
    const totalCategorySalesSum = categoriesSales.reduce((acc, item) => acc + item.value, 0);
    const formattedCategorySales = categoriesSales.map(item => ({
      label: item.label,
      value: item.value,
      percentage: totalCategorySalesSum > 0 ? Math.round((item.value / totalCategorySalesSum) * 100) : 0
    }));

    // Normalize and merge regionSales
    const regionSalesMap = {};
    for (const item of rawRegionSales) {
      const normalizedState = normalizeStateName(item.state);
      if (!regionSalesMap[normalizedState]) {
        regionSalesMap[normalizedState] = { state: normalizedState, orders: 0, sales: 0 };
      }
      regionSalesMap[normalizedState].orders += item.orders;
      regionSalesMap[normalizedState].sales += item.sales;
    }
    const regionSales = Object.values(regionSalesMap)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    // Campaign Performance
    const campaignPerformance = activeCampaigns.map((c) => ({
      _id: c._id,
      name: c.name,
      status: c.status,
      budget: c.budget,
      spent: c.spent,
      ctr: c.ctr || 0,
      conversions: c.conversions || 0,
      startDate: c.startDate,
      endDate: c.endDate,
      platforms: c.platforms,
      targetType: c.targetType,
      discount: { type: c.discountType, value: c.discountValue },
      audience: c.audience
    }));

    // Visitors by day (for details if needed, fallback to visitors structure)
    const last7Days = new Date(now.getTime() - 7 * MILLIS_IN_DAY);
    const visitorsByDay = await Visitor.aggregate([
      { $match: { visitedAt: { $gte: last7Days } } },
      { $project: { day: { $dateToString: { format: "%Y-%m-%d", date: '$visitedAt' } } } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Build payload
    const payload = {
      range,
      period: {
        start: current.start.toISOString(),
        end: current.end.toISOString()
      },
      summary: {
        orders: {
          value: totalOrders,
          previous: prevTotalOrders,
          trend: calculateTrendPercentage(totalOrders, prevTotalOrders)
        },
        sales: {
          value: revenue,
          previous: prevRevenue,
          trend: calculateTrendPercentage(revenue, prevRevenue)
        },
        visitors: {
          value: visitors,
          previous: previousVisitors,
          trend: calculateTrendAbsolute(visitors, previousVisitors)
        },
        conversionRate: {
          value: Number(conversionRate.toFixed(2)),
          previous: Number(prevConversionRate.toFixed(2)),
          trend: calculateTrendPP(conversionRate, prevConversionRate)
        },
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
        categoriesCount,
        productsCount,
        abandonedCarts: cartsAbandoned,
        ordersByStatus,
        visitorsDetails: {
          today: visitors, // fallback
          last7Days: previousVisitors, // fallback
          byDay: visitorsByDay
        }
      },
      categorySales: formattedCategorySales,
      regionSales,
      salesTrend,
      topSellingProducts: topProductsAgg,
      lowStockProducts,
      campaignPerformance,
      recentOrders,
      shiprocketToken
    };

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
}

async function getDistributionMapData(req, res) {
  try {
    const rawData = await Order.aggregate([
      {
        $group: {
          _id: {
            state: { $ifNull: ["$shippingAddress.state", "Unknown"] },
            city: { $ifNull: ["$shippingAddress.city", "Unknown"] }
          },
          orders: { $sum: 1 },
          sales: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$finalAmount", 0] } }
        }
      },
      {
        $project: {
          state: "$_id.state",
          city: "$_id.city",
          orders: 1,
          sales: 1,
          _id: 0
        }
      }
    ]);

    const stateMapData = {};
    for (const item of rawData) {
      const normalizedState = normalizeStateName(item.state);
      const city = item.city ? item.city.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "Unknown";

      if (!stateMapData[normalizedState]) {
        stateMapData[normalizedState] = {
          state: normalizedState,
          totalOrders: 0,
          totalSales: 0,
          citiesMap: {}
        };
      }

      stateMapData[normalizedState].totalOrders += item.orders;
      stateMapData[normalizedState].totalSales += item.sales;

      if (!stateMapData[normalizedState].citiesMap[city]) {
        stateMapData[normalizedState].citiesMap[city] = { city, orders: 0, sales: 0 };
      }
      stateMapData[normalizedState].citiesMap[city].orders += item.orders;
      stateMapData[normalizedState].citiesMap[city].sales += item.sales;
    }

    const data = Object.values(stateMapData).map(stateItem => ({
      state: stateItem.state,
      totalOrders: stateItem.totalOrders,
      totalSales: stateItem.totalSales,
      cities: Object.values(stateItem.citiesMap).sort((a, b) => b.sales - a.sales)
    })).sort((a, b) => b.totalSales - a.totalSales);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Distribution map error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
}

module.exports = {
  getDashboard,
  getDistributionMapData
};