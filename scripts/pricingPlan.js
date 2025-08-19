require('dotenv').config();
const mongoose = require('mongoose');
const Service  = require('../model/plan');

const platforms = [
  {
    name: 'youtube',
    pricing: [
      {
        name: 'Starter',
        price: '$29.99',
        description: 'Perfect for new channels',
        features: [
          '1,000 High-Quality Views',
          '100 Subscribers',
          '200 Likes',
          '10 Comments',
          'Delivery within 2-3 days'
        ]
      },
      {
        name: 'Growth',
        price: '$79.99',
        description: 'Ideal for growing channels',
        features: [
          '5,000 High-Quality Views',
          '500 Subscribers',
          '1,000 Likes',
          '50 Comments',
          'Delivery within 3-5 days'
        ],
        isPopular: true
      },
      {
        name: 'Professional',
        price: '$199.99',
        description: 'For serious content creators',
        features: [
          '15,000 High-Quality Views',
          '1,500 Subscribers',
          '3,000 Likes',
          '150 Comments',
          'Delivery within 7-10 days'
        ]
      }
    ]
  },
  {
    name: 'instagram',
    pricing: [
      {
        name: 'Basic',
        price: '$24.99',
        description: 'Perfect for personal accounts',
        features: [
          '500 Followers',
          '1,000 Likes',
          '50 Comments',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Premium',
        price: '$69.99',
        description: 'Ideal for influencers',
        features: [
          '2,000 Followers',
          '5,000 Likes',
          '200 Comments',
          'Targeted followers option',
          'Faster delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Elite',
        price: '$149.99',
        description: 'For serious brand building',
        features: [
          '5,000 Followers',
          '10,000 Likes',
          '500 Comments',
          'Custom comment options',
          'Express delivery',
          'Account management'
        ]
      }
    ]
  },
  {
    name: 'x',
    pricing: [
      {
        name: 'Starter',
        price: '$19.99',
        description: 'Perfect for new accounts',
        features: [
          '500 Followers',
          '1,000 Likes',
          '100 Retweets',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Growth',
        price: '$59.99',
        description: 'Ideal for established profiles',
        features: [
          '2,000 Followers',
          '3,000 Likes',
          '500 Retweets',
          'Faster delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Influence',
        price: '$129.99',
        description: 'For serious thought leaders',
        features: [
          '5,000 Followers',
          '7,500 Likes',
          '1,000 Retweets',
          'Express delivery',
          'Account growth consultation'
        ]
      }
    ]
  },
  {
    name: 'threads',
    pricing: [
      {
        name: 'Early Adopter',
        price: '$24.99',
        description: 'Perfect for new Threads users',
        features: [
          '500 Followers',
          '1,000 Likes',
          '50 Replies',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Trendsetter',
        price: '$64.99',
        description: 'Ideal for content creators',
        features: [
          '2,000 Followers',
          '4,000 Likes',
          '200 Replies',
          'Faster delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Influencer',
        price: '$139.99',
        description: 'For serious Threads personalities',
        features: [
          '5,000 Followers',
          '10,000 Likes',
          '500 Replies',
          'Express delivery',
          'Growth strategy consultation'
        ]
      }
    ]
  },
  {
    name: 'telegram',
    pricing: [
      {
        name: 'Channel Starter',
        price: '$29.99',
        description: 'Perfect for new channels',
        features: [
          '500 Channel Members',
          '1,000 Post Views',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Community Builder',
        price: '$79.99',
        description: 'Ideal for growing communities',
        features: [
          '2,000 Channel Members',
          '5,000 Post Views',
          'Faster delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Influence Network',
        price: '$179.99',
        description: 'For major Telegram presence',
        features: [
          '5,000 Channel Members',
          '15,000 Post Views',
          'Express delivery',
          'Channel growth consultation'
        ]
      }
    ]
  },
  {
    name: 'linkedin',
    pricing: [
      {
        name: 'Professional',
        price: '$39.99',
        description: 'Perfect for individuals',
        features: [
          '200 Connections',
          '100 Skill Endorsements',
          '50 Post Engagements',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Executive',
        price: '$89.99',
        description: 'Ideal for managers & executives',
        features: [
          '500 Connections',
          '300 Skill Endorsements',
          '200 Post Engagements',
          'Industry-targeted connections',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Enterprise',
        price: '$199.99',
        description: 'For business leaders & companies',
        features: [
          '1,000 Connections',
          '500 Skill Endorsements',
          '500 Post Engagements',
          'Premium network targeting',
          'Profile optimization consultation'
        ]
      }
    ]
  },
  {
    name: 'tiktok',
    pricing: [
      {
        name: 'Starter Pack',
        price: '$19.99',
        description: 'Ideal for beginners',
        features: [
          '1,000 Followers',
          '5,000 Video Views',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Growth Pack',
        price: '$59.99',
        description: 'Perfect for growing influencers',
        features: [
          '5,000 Followers',
          '25,000 Video Views',
          'Priority delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Viral Pack',
        price: '$149.99',
        description: 'For serious creators looking to go viral',
        features: [
          '15,000 Followers',
          '75,000 Video Views',
          'Express delivery',
          'Content strategy consultation'
        ]
      }
    ]
  },
  {
    name: 'facebook',
    pricing: [
      {
        name: 'Starter',
        price: '$24.99',
        description: 'Perfect for new pages',
        features: [
          '500 Page Likes',
          '500 Followers',
          '100 Post Engagements',
          'Gradual delivery',
          '24/7 Support'
        ]
      },
      {
        name: 'Growth',
        price: '$69.99',
        description: 'Ideal for established pages',
        features: [
          '2,000 Page Likes',
          '2,000 Followers',
          '500 Post Engagements',
          'Faster delivery',
          '24/7 Priority Support'
        ],
        isPopular: true
      },
      {
        name: 'Business',
        price: '$149.99',
        description: 'For serious brands & businesses',
        features: [
          '5,000 Page Likes',
          '5,000 Followers',
          '1,500 Post Engagements',
          'Express delivery',
          'Page growth consultation'
        ]
      }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true
    });
    console.log('⚡️ Connected to MongoDB');

    // wipe and re-seed
    await Service.deleteMany({});
    console.log('🗑  Cleared Plan collection');

    const inserted = await Service.insertMany(platforms);
    console.log(`✅ Seeded ${inserted.length} Plan`);
    process.exit(0);
  } catch (err) {
    console.error('🔥 Seed error:', err);
    process.exit(1);
  }
}

seed();