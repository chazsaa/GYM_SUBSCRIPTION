// One shared list of gym plans.
// Both the Home screen and the Details screen use this same array,
// so the information is always consistent.
// Photos live in assets/image/plans/. Replace a file with your own photo
// (same file name) to change the picture everywhere.
export const planImages = {
  1: require('../assets/image/plans/plan-1.png'),
  2: require('../assets/image/plans/plan-2.png'),
  3: require('../assets/image/plans/plan-3.png'),
  4: require('../assets/image/plans/plan-4.png'),
  5: require('../assets/image/plans/plan-5.png'),
};
export const bannerImage = require('../assets/image/plans/banner.png');

export const subscriptionPlans = [
  {
    id: 1,
    days: 1, // used to compute the expiry date
    amount: 100, // number version of the price
    icon: 'lightning-bolt',
    bestFor: 'First-time visitors',
    name: 'Daily Pass',
    price: '₱100',
    duration: '1 day',
    description: 'One day of gym access. Good for trying out the gym.',
    benefits: [
      'Full access to the gym floor',
      'Use of cardio and weight machines',
      'Free locker for the day',
      'Free drinking water',
    ],
    access:
      'Valid for 1 day. Your access starts on the day you subscribe and ends after that day.',
  },
  {
    id: 2,
    days: 30, // used to compute the expiry date
    amount: 1000, // number version of the price
    icon: 'calendar-month',
    bestFor: 'Regular gym-goers',
    name: 'Monthly Membership',
    price: '₱1,000',
    duration: '30 days',
    description:
      'Thirty days of gym access. Our most popular plan for regular gym-goers.',
    benefits: [
      'Unlimited gym visits for 30 days',
      'Use of all gym equipment',
      'Free locker and shower access',
      'One free fitness assessment',
    ],
    access:
      'Valid for 30 days. Visit as often as you like while your membership is active.',
  },
  {
    id: 3,
    days: 90, // used to compute the expiry date
    amount: 2700, // number version of the price
    icon: 'calendar-range',
    bestFor: 'Building consistency',
    name: '3-Month Membership',
    price: '₱2,700',
    duration: '3 months',
    description: 'Three months of gym access at a lower monthly cost.',
    benefits: [
      'Unlimited gym visits for 3 months',
      'Use of all gym equipment',
      'Free locker and shower access',
      'Two free fitness assessments',
      'One free personal training session',
    ],
    access:
      'Valid for 3 months. Visit as often as you like while your membership is active.',
  },
  {
    id: 4,
    days: 180, // used to compute the expiry date
    amount: 5000, // number version of the price
    icon: 'calendar-star',
    bestFor: 'Long-term goals',
    name: '6-Month Membership',
    price: '₱5,000',
    duration: '6 months',
    description: 'Six months of gym access for members who want to build a habit.',
    benefits: [
      'Unlimited gym visits for 6 months',
      'Use of all gym equipment',
      'Free locker and shower access',
      'Three free fitness assessments',
      'Two free personal training sessions',
    ],
    access:
      'Valid for 6 months. Visit as often as you like while your membership is active.',
  },
  {
    id: 5,
    days: 365, // used to compute the expiry date
    amount: 9000, // number version of the price
    icon: 'trophy',
    bestFor: 'Committed members',
    name: 'Annual Membership',
    price: '₱9,000',
    duration: '12 months',
    description: 'A full year of gym access. The best value for committed members.',
    benefits: [
      'Unlimited gym visits for 12 months',
      'Use of all gym equipment',
      'Free locker and shower access',
      'Four free fitness assessments',
      'Three free personal training sessions',
      'Bring a friend for free once a month',
    ],
    access:
      'Valid for 12 months. Visit as often as you like while your membership is active.',
  },
];

// Find one plan by its id.
// The id from the URL is a string ("3"), but the id in our data is a number (3),
// so we change both to strings before comparing them.
// Returns undefined when the id is missing or does not match any plan.
export const getPlanById = (id) => {
  return subscriptionPlans.find((plan) => String(plan.id) === String(id));
};

// Format a number as pesos, e.g. 2700 -> "₱2,700".
export const formatPeso = (amount) =>
  '₱' + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
