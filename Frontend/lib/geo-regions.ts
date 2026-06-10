/** Province → districts for countries with structured sub-regions. */
const HIERARCHICAL_REGIONS: Record<string, Record<string, readonly string[]>> = {
  "Sri Lanka": {
    Western: ["Colombo", "Gampaha", "Kalutara"],
    Central: ["Kandy", "Matale", "Nuwara Eliya"],
    Southern: ["Galle", "Matara", "Hambantota"],
    Northern: ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"],
    Eastern: ["Batticaloa", "Ampara", "Trincomalee"],
    "North Western": ["Kurunegala", "Puttalam"],
    "North Central": ["Anuradhapura", "Polonnaruwa"],
    Uva: ["Badulla", "Monaragala"],
    Sabaragamuwa: ["Ratnapura", "Kegalle"],
  },
};

/** States/provinces only (districts entered manually or not applicable). */
const STATES_BY_COUNTRY: Record<string, readonly string[]> = {
  India: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry",
  ],
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
    "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
    "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Australia: [
    "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland",
    "South Australia", "Tasmania", "Victoria", "Western Australia",
  ],
  Canada: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
    "Quebec", "Saskatchewan", "Yukon",
  ],
  Malaysia: [
    "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca", "Negeri Sembilan",
    "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor",
    "Terengganu",
  ],
  "United Arab Emirates": [
    "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain",
  ],
};

export function countryHasRegionHierarchy(country: string): boolean {
  return Boolean(HIERARCHICAL_REGIONS[country.trim()]);
}

export function getStatesForCountry(country: string): readonly string[] {
  const key = country.trim();
  if (!key) return [];
  const hierarchical = HIERARCHICAL_REGIONS[key];
  if (hierarchical) return Object.keys(hierarchical).sort((a, b) => a.localeCompare(b));
  return STATES_BY_COUNTRY[key] ?? [];
}

export function getDistrictsForState(country: string, state: string): readonly string[] {
  const countryKey = country.trim();
  const stateKey = state.trim();
  if (!countryKey || !stateKey) return [];
  const hierarchical = HIERARCHICAL_REGIONS[countryKey];
  if (!hierarchical) return [];
  const districts = hierarchical[stateKey];
  if (districts) return districts;
  const match = Object.entries(hierarchical).find(([name]) => name.toLowerCase() === stateKey.toLowerCase());
  return match?.[1] ?? [];
}

export function inferStateFromDistrict(country: string, district: string): string | null {
  const countryKey = country.trim();
  const districtKey = district.trim();
  if (!countryKey || !districtKey) return null;
  const hierarchical = HIERARCHICAL_REGIONS[countryKey];
  if (!hierarchical) return null;
  const lower = districtKey.toLowerCase();
  for (const [state, districts] of Object.entries(hierarchical)) {
    if (districts.some((d) => d.toLowerCase() === lower)) return state;
  }
  return null;
}
