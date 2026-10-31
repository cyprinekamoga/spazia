import type { Dictionary } from "./sv";

/** English copy – same shape as the Swedish dictionary. */
export const en: Dictionary = {
  meta: {
    homeTitle: "Spazia – storage with your neighbours in Luleå",
    homeDescription:
      "Store tyres, skis, snowmobiles and boxes in dry garages and storerooms with verified homeowners in Luleå. Cheaper, closer and no long-term commitment.",
    titleTemplate: "%s · Spazia",
    locale: "en_GB",
  },
  common: {
    skipToContent: "Skip to content",
    perMonth: "SEK/mo",
    from: "from about",
    currency: "SEK",
    readMore: "Read more",
    launchBadge: "Launching in Luleå, winter 2026/27",
    menu: "Menu",
    close: "Close",
    languageName: "English",
    switchLanguage: "Svenska",
    switchLanguageLabel: "Läs på svenska",
    other: "Other",
    yes: "Yes",
    no: "No",
  },
  actionBar: {
    find: "Find storage",
    host: "List your space",
    hostForm: "Register space",
    renterForm: "Register interest",
    estimate: "You get about",
  },
  nav: {
    find: "Find storage",
    host: "Become a host",
    trust: "Trust & safety",
    about: "About",
    hostCta: "List your space",
  },
  hero: {
    title: "There's room at your neighbour's.",
    lead: "Store tyres, skis, snowmobiles and boxes in dry garages owned by homeowners in Luleå. Cheaper than storage companies, and safe with BankID, an agreement and automatic payments.",
    ctaFind: "I need storage",
    ctaHost: "I have spare space",
    chipsLabel: "What do you want to store?",
    trustline: ["BankID verification", "Standard agreement", "Cancel any month"],
    illustrationAlt:
      "A lit garage on a snowy winter evening – Spazia, storage with your neighbours in Luleå.",
  },
  categoriesSection: {
    title: "What do you want to store?",
    lead: "Guide prices per month including the service fee. The host sets the final price.",
    per: "per",
  },
  how: {
    title: "How Spazia works",
    tabRenter: "Renting storage",
    tabHost: "Hosting",
    renterSteps: [
      {
        title: "Tell us what to store",
        text: "Tyres, skis, a snowmobile or a summer's worth of boxes. Choose an area and how long you need the space.",
      },
      {
        title: "Pick a verified host",
        text: "Every host is verified with BankID, and we have visited and photographed every space.",
      },
      {
        title: "Drop off and relax",
        text: "You both sign the standard agreement digitally and rent is charged automatically each month. Cancel whenever you like.",
      },
    ],
    hostSteps: [
      {
        title: "Register your space",
        text: "Garage, basement, outbuilding or attic. It takes two minutes.",
      },
      {
        title: "We come and visit",
        text: "We check that it is dry and lockable and take the photos for your listing. The visit is free.",
      },
      {
        title: "Get paid every month",
        text: "You approve your renters and we handle the agreement and payments. The money arrives automatically.",
      },
    ],
  },
  why: {
    title: "Why store with a neighbour?",
    items: [
      {
        title: "Closer",
        text: "Storage in residential areas like Gammelstad, Bergnäset and Sunderbyn rather than on an industrial estate out of town.",
      },
      {
        title: "Cheaper",
        text: "Pay for the space you need: one set of tyres, a pair of skis or a few square metres, not an entire unit.",
      },
      {
        title: "Flexible",
        text: "Monthly, with no long-term commitment. Ideal for seasonal gear and the summer break.",
      },
      {
        title: "Local",
        text: "The money goes to neighbours in Luleå instead of a storage company.",
      },
    ],
  },
  seasons: {
    title: "Storage that follows the seasons",
    lead: "In Norrbotten, your gear swaps places twice a year. We have room for both halves.",
    items: [
      {
        name: "Autumn",
        months: "Oct–Nov",
        text: "Summer tyres off, winter tyres on. Bikes, garden furniture and summer gear need a dry place for the winter.",
      },
      {
        name: "Spring",
        months: "Apr–May",
        text: "Winter tyres, skis and snowmobiles need putting away. The snow blower too.",
      },
      {
        name: "Summer",
        months: "Jun–Aug",
        text: "Students head home for the summer. Boxes and furniture can stay in Luleå instead of travelling back and forth.",
      },
    ],
  },
  hostTeaser: {
    eyebrow: "For homeowners",
    title: "Got an empty garage? Let it earn money this winter.",
    lead: "Half a double garage with ten sets of tyres, a few ski sets and a snowmobile could bring in around SEK {amount} a month. You decide what you accept and when renters can come by.",
    cta: "Calculate your garage",
  },
  trust: {
    title: "Safe for both sides",
    lead: "We have built in what makes it safe to leave your things with someone else, and to let someone into your garage.",
    items: [
      {
        icon: "id",
        title: "Verified with BankID",
        text: "Every host and renter identifies with BankID. No Swedish BankID? You can use Freja eID with your passport.",
      },
      {
        icon: "inspect",
        title: "Visited spaces",
        text: "We visit every space before it is listed and check that it is dry, lockable and as described.",
      },
      {
        icon: "contract",
        title: "Standard agreement",
        text: "A clear agreement, signed digitally, covering access, cancellation and responsibility.",
      },
      {
        icon: "camera",
        title: "Photo inventory",
        text: "You photograph your things at drop-off and collection, so there is never any doubt about what was left.",
      },
      {
        icon: "card",
        title: "Automatic payments",
        text: "Rent is charged to a card every month and paid out to the host. No cash and no payment reminders.",
      },
      {
        icon: "support",
        title: "Local support",
        text: "We are based in Luleå and will help if something goes wrong.",
      },
    ],
    link: "More about trust & safety",
  },
  areasSection: {
    title: "Starting in Luleå",
    lead: "First up are areas with lots of houses and garages, and areas where lots of people need space.",
    hostFocus: "Hosts wanted",
    renterFocus: "High demand",
  },
  faq: {
    title: "Frequently asked questions",
    general: [
      {
        q: "What is Spazia?",
        a: "A marketplace where people in Luleå rent out dry storage space in garages, basements and outbuildings to anyone who needs to store tyres, skis, boxes or vehicles. We handle verification, the agreement and payments.",
      },
      {
        q: "When do you launch?",
        a: "We are launching in Luleå during winter 2026/27. Right now we are building a network of visited, verified hosts. Register your interest and we will get in touch when there is space near you.",
      },
      {
        q: "What does it cost?",
        a: "The host sets the price. The guide price is about SEK 120 a month for a set of tyres and about SEK 150 per square metre for boxes. The 15% service fee is included in the price you see, and you can cancel any month.",
      },
      {
        q: "Is it safe?",
        a: "Everyone is verified with BankID or Freja eID, we visit every space before it is listed, you sign a standard agreement and photograph your things at drop-off. Payment goes through Spazia, so nobody handles cash.",
      },
      {
        q: "Are my things insured?",
        a: "Things stored away from home are often covered by your home insurance, but many policies have exclusions or limits for theft-prone items in garages and storerooms. Check your terms. We are working on storage insurance with an insurer.",
      },
      {
        q: "I don't have Swedish BankID. Can I still rent?",
        a: "Yes. International students and newcomers can verify with Freja eID, which works with a passport.",
      },
      {
        q: "How do I get to my things?",
        a: "The host sets when you can drop off and collect, and you book a time in advance. Most people storing seasonal gear only visit once or twice a year.",
      },
      {
        q: "Can I live or work in the space?",
        a: "No. Spaces are rented for storage only.",
      },
      {
        q: "How do I cancel?",
        a: "Rent is paid monthly with no long-term commitment. You cancel ahead of the next month.",
      },
    ],
    host: [
      {
        q: "What does it cost to be a host?",
        a: "Listing is free. Spazia takes 5% of each payout, so you only pay when you earn.",
      },
      {
        q: "Can I choose who rents from me?",
        a: "Yes. You see every request and approve it before anything is booked. You also decide what you accept.",
      },
      {
        q: "Do I need to be home when renters come?",
        a: "You agree on times together. Many hosts choose fixed times, such as weekends, and most renters only come to drop off and collect.",
      },
      {
        q: "Who is responsible if something is damaged?",
        a: "The standard agreement sets out responsibility. As a host you are responsible for the space being dry and locked as described. The renter is responsible for their things and should have home insurance.",
      },
      {
        q: "Do I pay tax on the rent?",
        a: "If you rent out part of your private home, such as the garage of your house, the rent is taxed as capital income. For a house you can deduct SEK 40,000 a year plus 20% of the rental income, so most hosts pay no tax at all. Always check with the Swedish Tax Agency (Skatteverket) what applies to you.",
      },
      {
        q: "What if the renter doesn't pay?",
        a: "Rent is charged automatically to the renter's card. If a payment fails we follow it up, and we help you if things are left behind when the agreement ends.",
      },
    ],
  },
  finalCta: {
    title: "Join from the start",
    lead: "We launch in Luleå during winter 2026/27. Register your interest now and get priority.",
  },
  footer: {
    tagline: "Storage with your neighbours, in Luleå.",
    storage: "Storage",
    areas: "Areas",
    company: "Spazia",
    contact: "Contact",
    privacy: "Privacy policy",
    cookies: "Cookie settings",
    credits: "Photo credits",
    rights: "All rights reserved.",
  },
  hostPage: {
    metaTitle: "Rent out your garage or storeroom in Luleå",
    metaDescription:
      "Earn money from your empty garage, basement or outbuilding. Free to list, BankID-verified renters, a standard agreement and automatic monthly payments.",
    eyebrow: "Become a host",
    title: "Make money from your empty garage.",
    lead: "Rent out dry space in your garage, basement or outbuilding to students and young professionals in Luleå. We handle verification, the agreement and payments. You unlock the door a few times a year.",
    ctaForm: "Register your space",
    ctaCalc: "Run the numbers",
    benefitsTitle: "What's included",
    benefits: [
      {
        title: "Free to list",
        text: "Listing your space costs nothing. We take 5% of payouts, only once you are earning.",
      },
      {
        title: "Automatic payments",
        text: "Rent is charged automatically to the renter's card and paid out to you every month. We follow up if anything goes wrong.",
      },
      {
        title: "Standard agreement",
        text: "The agreement covers access, cancellation, responsibility and what may not be stored. You don't have to write anything yourself.",
      },
      {
        title: "You're in control",
        text: "You choose what you accept, approve every renter and decide when they can drop off and collect.",
      },
      {
        title: "Verified renters",
        text: "Every renter identifies with BankID or Freja eID before they can book.",
      },
      {
        title: "Free visit and photos",
        text: "We visit your space, suggest how much room you could rent out and take the photos for your listing.",
      },
    ],
    stepsTitle: "How to become a host",
    steps: [
      { title: "Register your interest", text: "Fill in the form below. It takes two minutes." },
      { title: "We get in touch", text: "We call you and book a visit at a time that suits you." },
      {
        title: "Visit and listing",
        text: "We check the space, take photos and create the listing together with you.",
      },
      {
        title: "Your first renter",
        text: "You approve the request, you both sign the agreement and the first rent is paid out.",
      },
    ],
    requirementsTitle: "What does the space need?",
    requirements: [
      { title: "Dry", text: "No leaks and no damp that could damage things." },
      { title: "Lockable", text: "It must lock, and only you and the renter should have access to their things." },
      { title: "Accessible", text: "The renter must be able to drop off and collect at the times you agree." },
      { title: "Storage only", text: "Nobody may live, work or stay in the space." },
    ],
    taxTitle: "Tax on rental income",
    taxText:
      "If you rent out part of your private home, such as the garage of your house, the rent is taxed as capital income. For a house you can make a standard deduction of SEK 40,000 a year plus 20% of the rental income, which covers all of it for most hosts. As a digital platform, Spazia may be required to report rental income to the Swedish Tax Agency. The rules depend on your situation, so always check with Skatteverket.",
    taxLink: "Skatteverket on renting out a private home (in Swedish)",
    formTitle: "Register your space",
    formLead: "We will contact you within a few days to book a visit. It is free and non-binding.",
    faqTitle: "Questions from hosts",
  },
  findPage: {
    metaTitle: "Find storage in Luleå – tyres, skis, boxes",
    metaDescription:
      "Store tyres, skis, bikes, boxes or vehicles with a verified neighbour in Luleå. Cheaper than storage companies, and cancel any month. Register your interest.",
    eyebrow: "Find storage",
    title: "Storage near you, at a neighbour's.",
    lead: "Tell us what you need to store. When we launch we will match you with a verified host in your area, and everyone who registers now gets priority.",
    pricesTitle: "Guide prices",
    pricesLead: "Example monthly prices including the service fee. The host sets the final price.",
    heatedNote: "Heated space costs about 25% more for vehicles, furniture and boxes.",
    studentTitle: "Studying at LTU?",
    studentText:
      "Leave your boxes and furniture in Luleå over the summer instead of shipping them home. No Swedish BankID? You can verify with Freja eID and your passport.",
    formTitle: "Register your interest",
    formLead: "It is free and non-binding.",
    faqTitle: "Frequently asked questions",
  },
  trustPage: {
    metaTitle: "Trust & safety – how we protect hosts and renters",
    metaDescription:
      "BankID verification, a visit to every space, a standard agreement, a photo inventory and payments through the platform. This is how trust works on Spazia.",
    eyebrow: "Trust & safety",
    title: "Trust comes first.",
    lead: "Leaving your things with someone you don't know, or letting someone into your garage, takes trust. This is how we build it.",
    sections: [
      {
        title: "Verification with BankID and Freja eID",
        text: "Everyone who hosts or rents through Spazia identifies with Swedish BankID. International students and newcomers without BankID can use Freja eID, which works with a passport. So we always know who is who.",
        bullets: [],
      },
      {
        title: "We visit every space",
        text: "Before a space is listed, we visit it. We check that it is dry, lockable and matches the description, and we take the listing photos ourselves.",
        bullets: [],
      },
      {
        title: "One standard agreement for everyone",
        text: "Host and renter sign the same clear agreement digitally. It covers:",
        bullets: [
          "what is stored and where",
          "when you can drop off and collect, and how visits are booked",
          "cancellation: monthly, with no long-term commitment",
          "responsibility for the space and for the things stored",
          "what may not be stored",
        ],
      },
      {
        title: "Photo inventory",
        text: "At drop-off you photograph the items and confirm the list together. The same at collection. That way there is never any doubt about what was left.",
        bullets: [],
      },
      {
        title: "Payment through Spazia",
        text: "Rent is paid by card and charged automatically each month. The host receives their payout from us. Never pay outside the platform: the agreement does not apply and we cannot help if something goes wrong.",
        bullets: [],
      },
      {
        title: "Insurance",
        text: "Things stored away from home are often covered by home insurance, but many policies have exclusions or limits for theft-prone items in garages and storerooms. Check your terms before storing anything valuable. We are working on storage insurance with an insurer and will share more when it is ready.",
        bullets: [],
      },
      {
        title: "What may not be stored",
        text: "For everyone's safety, some things are not allowed:",
        bullets: [
          "anything flammable, such as petrol in cans, gas bottles, paint and solvents",
          "food and anything else that attracts pests",
          "animals and plants",
          "weapons, ammunition and anything illegal",
          "cash, jewellery and other valuables",
        ],
      },
      {
        title: "If something goes wrong",
        text: "Contact us and we will help. We follow up missed payments, help hosts if things are left behind when an agreement ends, and mediate if you cannot agree.",
        bullets: [],
      },
    ],
  },
  aboutPage: {
    metaTitle: "About Spazia",
    metaDescription:
      "Spazia is a marketplace for storage with your neighbours. We are starting in Luleå, where winter makes storage a bigger deal than almost anywhere else.",
    eyebrow: "About",
    title: "The space exists. It's just in the wrong place.",
    paragraphs: [
      "In Luleå, lots of us own things we only use half the year: studded tyres, skis, snowmobiles and summer furniture. Meanwhile the queue for extra storerooms in apartment buildings is long, student rooms barely fit a suitcase, and storage companies are often on industrial estates out of town.",
      "At the same time, residential areas like Gammelstad, Bergnäset and Sunderbyn are full of garages, basements and outbuildings with room to spare. Spazia connects the two, with BankID, a standard agreement and automatic payments. It should feel as safe as a storage company, but be closer and cheaper.",
      "Spazia is run by a small team in Luleå. We visit every space ourselves before it is listed, and we answer ourselves when you get in touch.",
    ],
    creditsTitle: "Photo credits",
    creditsText: "Photos are from Unsplash and used under the Unsplash License. Thanks to the photographers:",
    contactTitle: "Get in touch",
    contactText: "Questions, ideas, or want to work with us? Email us and we will reply as soon as we can.",
  },
  privacyPage: {
    metaTitle: "Privacy policy",
    metaDescription: "How Spazia handles your personal data and cookies.",
    title: "Privacy policy",
    updated: "Last updated: 31 October 2026",
    sections: [
      {
        title: "Data controller",
        text: "{legal} is the controller of your personal data. You can reach us at {email}.",
      },
      {
        title: "What we collect",
        text: "When you register your interest we store what you fill in: name, email, phone number if you provide it, area, and details about what you want to store or your space. We also store which ad or link you came from (UTM parameters) so we know which channels work.",
      },
      {
        title: "Why we process it",
        text: "We use the data to contact you about storage or your space, to book visits and to understand demand ahead of launch. The legal basis is your consent, which you can withdraw at any time.",
      },
      {
        title: "How long we keep it",
        text: "We delete the data no later than 12 months after you register, or sooner if you ask us to. If you become a host or renter, the terms of your agreement apply.",
      },
      {
        title: "Who has access",
        text: "We never sell your data. It is stored with our hosting and database providers (Netlify and Supabase), who process it on our behalf. If you accept marketing cookies, we share information about your visit with Meta to measure our ads. Some providers may process data outside the EU/EEA, in which case this is based on the European Commission's standard contractual clauses or the EU–US Data Privacy Framework.",
      },
      {
        title: "Cookies",
        text: "We only use necessary storage to make the site work and to remember your cookie choice. The Meta pixel, which measures our ads, only loads if you choose “Accept all”. You can change your choice at any time via the Cookie settings link at the bottom of the page.",
      },
      {
        title: "Your rights",
        text: "You have the right to know what data we hold about you, to have it corrected or deleted, to restrict processing and to withdraw your consent. Email {email}. You can also complain to the Swedish Authority for Privacy Protection (IMY) at imy.se.",
      },
    ],
  },
  categoryPage: {
    eyebrow: "Storage in Luleå",
    priceLabel: "Guide price",
    seasonLabel: "Season",
    ctaFind: "Register interest",
    hostTitle: "Got room for {name}?",
    hostText: "Homeowners in Luleå can earn money from space that would otherwise sit empty. See what your garage could bring in.",
    otherTitle: "Other storage",
    areasTitle: "Areas",
  },
  areaPage: {
    eyebrow: "Area",
    titleRenter: "Storage in {name}",
    hostTitle: "Live in {name} and have spare space?",
    renterTitle: "Need space in {name}?",
    categoriesTitle: "What you can store",
    otherAreas: "Other areas",
  },
  forms: {
    firstName: "First name",
    email: "Email",
    phone: "Phone",
    optional: "optional",
    phoneHintHost: "We call to book a visit.",
    area: "Area",
    areaPlaceholder: "Choose an area",
    otherArea: "Another area in Luleå",
    anyArea: "Doesn't matter",
    message: "Anything else we should know?",
    consentBefore: "I agree that Spazia may store my details to contact me, in line with the ",
    consentLink: "privacy policy",
    consentAfter: ".",
    sending: "Sending…",
    errorGeneric: "Something went wrong. Please try again or email us at {email}.",
    required: "Please fill in this field.",
    invalidEmail: "Please enter a valid email address.",
    pickOne: "Choose at least one option.",
    consentRequired: "We need your consent to be able to contact you.",
    host: {
      spaceType: "Type of space",
      spaceTypes: {
        garage: "Garage",
        basement: "Basement",
        outbuilding: "Outbuilding or shed",
        attic: "Attic",
        barn: "Barn",
        other: "Other",
      },
      heated: "Is the space heated?",
      heatedOptions: {
        yes: "Yes, heated",
        frostfree: "Frost-free",
        no: "No, but dry",
      },
      size: "Approximate size",
      sizes: {
        xs: "Under 5 m²",
        s: "5–15 m²",
        m: "15–30 m² (e.g. single garage)",
        l: "Over 30 m² (e.g. double garage)",
      },
      accepts: "What can you take?",
      messagePlaceholder: "E.g. when it suits you for renters to come, or whether the space is shared with your own car.",
      submit: "Send registration",
      successTitle: "Thanks! We'll be in touch soon.",
      successText:
        "We will contact you within a few days to book a visit. In the meantime, read more about how we approach trust and safety.",
    },
    renter: {
      items: "What do you want to store?",
      quantity: "Roughly how much?",
      quantityPlaceholder: "E.g. one set of tyres and two pairs of skis",
      start: "When do you need space?",
      starts: {
        asap: "As soon as possible",
        month: "Within a month",
        spring: "In spring (April–May)",
        summer: "In summer (June)",
        unsure: "Not sure yet",
      },
      duration: "For how long?",
      durations: {
        short: "1–3 months",
        season: "One season (about 6 months)",
        long: "Longer than 6 months",
        unsure: "Not sure yet",
      },
      heated: "Do you need heated space?",
      heatedOptions: {
        yes: "Yes",
        no: "No",
        any: "Doesn't matter",
      },
      occupation: "I am…",
      occupations: {
        student: "A student",
        working: "Working",
        other: "Other",
      },
      bankid: "Do you have Swedish BankID?",
      bankidOptions: {
        yes: "Yes",
        no: "No",
      },
      messagePlaceholder: "E.g. whether you need to access your things often.",
      submit: "Register interest",
      successTitle: "Thanks! You're on the list.",
      successText:
        "We will get in touch when there is a verified host near you. Everyone who registers now gets priority when we launch.",
    },
  },
  calculator: {
    title: "What could your space earn?",
    lead: "Choose what you have room for. The estimate uses our guide prices and shows what you receive after Spazia's fee.",
    presetsLabel: "Quick picks",
    presets: {
      corner: "A corner of the garage",
      halfDouble: "Half a double garage",
      carSpace: "Indoor car space",
      basement: "6 m² basement storeroom",
    },
    heatedLabel: "The space is heated",
    heatedHint: "Higher prices for vehicles and furniture.",
    resultLabel: "You receive about",
    perYear: "≈ SEK {amount} per year",
    renterPays: "Renters pay about SEK {amount}/month in total including the service fee.",
    feeNote:
      "Guide prices. You set your own price. Spazia takes 5% of the payout and the renter pays a 15% service fee.",
    decrease: "Fewer {unit}",
    increase: "More {unit}",
    cta: "Register your space",
    empty: "Add something to see an estimate.",
  },
  cookie: {
    text: "We use the Meta pixel to measure our ads, but only if you agree. Necessary storage is always used to make the site work.",
    accept: "Accept all",
    necessary: "Necessary only",
    readMore: "Read more",
  },
  notFound: {
    title: "Page not found",
    text: "The link may be wrong, or the page has moved.",
    home: "Go to the home page",
  },
};
