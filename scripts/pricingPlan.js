// scripts/seedPlans.js
require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("../model/plan"); // ✅ adjust path if needed

// ✅ NEW DATA (NO planId, NO pricingId, NO _id, NO dates)
// Your schema will auto-generate planId + pricingId via uuidv4 defaults.
const platforms = [
  {
    name: "threads",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$24.99",
        description: "Perfect for new Threads users",
        features: ["500 Followers", "1,000 Likes", "50 Replies", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$64.99",
        description: "Ideal for content creators",
        features: ["2,000 Followers", "4,000 Likes", "200 Replies", "Faster delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$139.99",
        description: "For serious Threads personalities",
        features: ["5,000 Followers", "10,000 Likes", "500 Replies", "Express delivery", "Growth strategy consultation"],
        isPopular: false,
      },
    ],
  },

  {
    name: "youtube",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$29",
        description: "Perfect for new channels",
        features: ["500 High-Quality Views", "100 Subscribers", "200 Likes", "Delivery within 2-3 days"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$101",
        description: "Ideal for growing channels",
        features: ["2,000 High-Quality Views", "300 Subscribers", "800 Likes", "50 Comments", "Delivery within 3-5 days"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$221",
        description: "For serious content creators",
        features: ["5,000 High-Quality Views", "500 Subscribers", "200 Likes", "200 Comments", "Delivery within 7-10 days"],
        isPopular: false,
      },
    ],
  },

  {
    name: "facebook",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$24.99",
        description: "Perfect for new pages",
        features: ["500 Page Likes", "500 Followers", "100 Post Engagements", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$69.99",
        description: "Ideal for established pages",
        features: ["2,000 Page Likes", "2,000 Followers", "500 Post Engagements", "Faster delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$149.99",
        description: "For serious brands & businesses",
        features: ["5,000 Page Likes", "5,000 Followers", "1,500 Post Engagements", "Express delivery", "Page growth consultation"],
        isPopular: false,
      },
    ],
  },

  {
    name: "x",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$25",
        description: "Perfect for new accounts",
        features: ["100 Followers", "1,000 Views", "500 Likes", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$79",
        description: "Ideal for established profiles",
        features: ["300 Followers", "3,000 Views", "1,500 Likes", "Faster delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$159",
        description: "For serious thought leaders",
        features: ["600 Followers", "10,000 Views", "3,000 Likes", "Express delivery", "Account growth consultation"],
        isPopular: false,
      },
    ],
  },

  {
    name: "instagram",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$29",
        description: "Perfect for personal accounts",
        features: ["300 Followers", "500 Likes", "1000 Views", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$99",
        description: "Ideal for influencers",
        features: ["500 Followers", "3,000 Likes", "1000 Views", "50 Comments", "Faster delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$199",
        description: "For serious brand building",
        features: ["600 Followers", "3,000 Views", "100 Comments", "2,500 Likes", "Express delivery", "Account management"],
        isPopular: false,
      },
    ],
  },

  {
    name: "telegram",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$29.99",
        description: "Perfect for new channels",
        features: ["500 Channel Members", "1,000 Post Views", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$79.99",
        description: "Ideal for growing communities",
        features: ["2,000 Channel Members", "5,000 Post Views", "Faster delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$179.99",
        description: "For major Telegram presence",
        features: ["5,000 Channel Members", "15,000 Post Views", "Express delivery", "Channel growth consultation"],
        isPopular: false,
      },
    ],
  },

  {
    name: "linkedin",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$39.99",
        description: "Perfect for individuals",
        features: ["200 Connections", "100 Skill Endorsements", "50 Post Engagements", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$89.99",
        description: "Ideal for managers & executives",
        features: ["500 Connections", "300 Skill Endorsements", "200 Post Engagements", "Industry-targeted connections", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$199.99",
        description: "For business leaders & companies",
        features: ["1,000 Connections", "500 Skill Endorsements", "500 Post Engagements", "Premium network targeting", "Profile optimization consultation"],
        isPopular: false,
      },
    ],
  },

  {
    name: "tiktok",
    status: "Active",
    pricing: [
      {
        name: "Basic",
        price: "$29",
        description: "Ideal for beginners",
        features: ["300 Followers", "1,000 Views", "500 Likes", "Gradual delivery", "24/7 Support"],
        isPopular: false,
      },
      {
        name: "Premium",
        price: "$99",
        description: "Perfect for growing influencers",
        features: ["500 Followers", "3,000 Views", "1000 Likes", "Priority delivery", "24/7 Priority Support"],
        isPopular: true,
      },
      {
        name: "Elite",
        price: "$199",
        description: "For serious creators looking to go viral",
        features: ["1,000 Followers", "8,000 Views", "3000 Likes", "200 Shares", "Express delivery", "Content strategy consultation"],
        isPopular: false,
      },
    ],
  },
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("⚡️ Connected to MongoDB");

    // ✅ wipe & seed
    await Plan.deleteMany({});
    console.log("🗑  Cleared Plan collection");

    // ✅ insert (planId/pricingId auto-generated by schema defaults)
    const inserted = await Plan.insertMany(platforms);
    console.log(`✅ Seeded ${inserted.length} plans`);

    process.exit(0);
  } catch (err) {
    console.error("🔥 Seed error:", err);
    process.exit(1);
  }
}

seed();
