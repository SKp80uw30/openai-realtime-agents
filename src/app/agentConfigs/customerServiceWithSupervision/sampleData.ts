export const exampleAccountInfo = {
  accountId: "NT-123456",
  name: "Alex Johnson",
  phone: "+1-206-135-1246",
  email: "alex.johnson@email.com",
  plan: "Unlimited Plus",
  balanceDue: "$42.17",
  lastBillDate: "2024-05-15",
  lastPaymentDate: "2024-05-20",
  lastPaymentAmount: "$42.17",
  status: "Active",
  address: {
    street: "1234 Pine St",
    city: "Seattle",
    state: "WA",
    zip: "98101"
  },
  lastBillDetails: {
    basePlan: "$30.00",
    internationalCalls: "$8.00",
    dataOverage: "$4.00",
    taxesAndFees: "$0.17",
    notes: "Higher than usual due to international calls and data overage."
  }
};

export const examplePolicyDocs = [
  {
    id: "ID-010",
    name: "Family Plan Policy",
    topic: "family plan options",
    content:
      "The family plan allows up to 5 lines per account. All lines share a single data pool. Each additional line after the first receives a 10% discount. All lines must be on the same account.",
  },
  {
    id: "ID-020",
    name: "Promotions and Discounts Policy",
    topic: "promotions and discounts",
    content:
      "The Summer Unlimited Data Sale provides a 20% discount on the Unlimited Plus plan for the first 6 months for new activations completed by July 31, 2024. The Refer-a-Friend Bonus provides a $50 bill credit to both the referring customer and the new customer after 60 days of active service, for activations by August 31, 2024. A maximum of 5 referral credits may be earned per account. Discounts cannot be combined with other offers.",
  },
  {
    id: "ID-030",
    name: "International Plans Policy",
    topic: "international plans",
    content:
      "International plans are available and include discounted calling, texting, and data usage in over 100 countries.",
  },
  {
    id: "ID-040",
    name: "Handset Offers Policy",
    topic: "new handsets",
    content:
      "Handsets from brands such as iPhone, Samsung, and Google are available. Special pricing may be available for new activations or upgrades. For current offers, refer to the website or a retail location.",
  },
];
