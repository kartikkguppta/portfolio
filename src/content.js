// ─────────────────────────────────────────────────────────────
//  YOUR CONTENT — edit this file only. Everything in the world
//  (signs, panels, the résumé view) is generated from it.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'KARTIK', // big knock-over letters at the start (keep it short)
  fullName: 'Kartik Gupta',
  title: 'IIT Delhi · Co-Founder, Gatician',
  groundText: 'IIT Delhi · 1x Founder', // painted on the ground under your name
  tagline: 'IIT Delhi engineer and founder, working where operations, supply chains, technology and business meet.',
  location: 'Jaipur, Rajasthan, India',
  email: 'kartikgupta1401@gmail.com',
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/kartikkguppta' },
    { label: 'Gatician', url: 'https://gatician-website.vercel.app/' },
  ],
}

// Each zone is an area on the island. Drive into it to open its panel.
// `type` decides how the panel is rendered: about | experience | projects | list | skills | contact
// `position` is [x, z] on the island (the island radius is 40; the car starts at the centre).
export const zones = [
  {
    id: 'about',
    type: 'about',
    title: 'About Me',
    icon: '👋',
    color: '#f2a65a',
    position: [24, 6.5],
    paragraphs: [
      'Hi, I am Kartik — a B.Tech graduate in Production & Industrial Engineering from IIT Delhi, and a 1x founder.',
      'I like solving complex problems and creating impact through technology, strategy and innovation. My work sits at the intersection of business, AI, operations and entrepreneurship: product development, logistics, process improvement and data-driven decisions.',
      'I have a builder’s mindset, I love fast-paced teams, and I am always up for meaningful ventures that shape the future.',
    ],
  },
  {
    id: 'experience',
    type: 'experience',
    title: 'Experience',
    icon: '💼',
    color: '#7fb069',
    position: [10.2, 22.8],
    items: [
      {
        role: 'Mechanical Operations Intern — Process Optimisation & Dust Control',
        company: 'Inito Health Tech · Bengaluru',
        period: 'Dec ’24 & May ’25 — Jul ’25',
        points: [
          'Optimised the assembly workflow and removed production-line bottlenecks, cutting cycle time by 17.8%.',
          'Implemented ISO-grade dust mitigation and pneumatic ionising guns: QC pass rate 15% → 55%, output +276%.',
          'Designed a new line-assembly layout to streamline flow and reduce dust ingress; rollout began before the internship ended.',
          'Secured the sole Pre-Placement Offer (PPO) among 12 interns.',
        ],
      },
      {
        role: 'Trainee, Supply Chain Operations',
        company: 'Aranax Medical · Delhi',
        period: 'May ’24 — Jun ’24',
        points: [
          'Raised operational efficiency 30% by optimising inventory and logistics processes.',
          'Managed procurement for Prolyte and electrolyte analysers, cutting lead times by 25%.',
          'Built a supplier management strategy and strengthened vendor relationships.',
          'Awarded a Letter of Recommendation by Director Alok Sharma.',
        ],
      },
      {
        role: 'B.Tech, Production & Industrial Engineering',
        company: 'Indian Institute of Technology Delhi',
        period: '2022 — 2026',
        points: ['Minor in Entrepreneurship, Department of Management Studies.', 'JEE Advanced All-India Rank 714 — top 0.5% of 10,00,000+ candidates.'],
      },
    ],
  },
  {
    id: 'ventures',
    type: 'projects',
    title: 'Gatician',
    icon: '🚀',
    color: '#6c9bd2',
    position: [-11.7, 22.1],
    intro: 'What I have built: my startup and research work in logistics.',
    items: [
      {
        name: 'Gatician Solutions — Co-Founder & Director',
        meta: 'Sept ’24 — Present',
        description: 'Founded and directed Gatician Solutions from concept to deployment, leading product strategy, technology development and business operations.',
        sections: [
          {
            heading: 'Key Achievements',
            points: [
              'Felicitated by Prime Minister Narendra Modi and Chief Minister N. Chandrababu Naidu at the Limitless Hackathon organised by Republic Bharat.',
              'Secured the prestigious TIDE 2.0 Grant from the Ministry of Electronics and Information Technology (MeitY), Government of India.',
              'Ranked in the top 0.2% of 44,000+ participating teams at the SBI Hackathon.',
              'Drove product innovation to address critical challenges in digital commerce logistics and fleet security, improving overall safety and operational efficiency.',
            ],
          },
          {
            heading: 'Our Work',
            points: [
              'Designed an intelligent matching and optimisation algorithm for ONDC to help retailers seamlessly connect with delivery partners and improve last-mile fulfilment.',
              'Pivoted to the commercial transportation sector to build a smart fleet security platform, enabling real-time tracking, remote monitoring and preventive asset protection for local truck owners.',
            ],
          },
        ],
        tags: ['Founder', 'ONDC', 'Fleet security', 'Logistics', 'MeitY TIDE 2.0'],
        url: 'https://gatician-website.vercel.app/',
      },
      {
        name: 'Hyperlocal Logistics Optimisation',
        meta: 'Jul ’25 — Nov ’25 · with Prof. Gourav Dwivedi & Prof. Prashant Palkar',
        description:
          'Built an iterative multi-vehicle routing (MVRP) optimiser on a 200-stop Delhi-NCR dataset: ~20% fewer vehicles than greedy at 100% demand served. APIs and a dashboard auto-select the minimum fleet: 13% fewer km and ~14% lower cost via clustering, multi-drop and backhauls, with ≥96% on-time and 80–85% utilisation.',
        tags: ['Python', 'Optimisation', 'Routing', 'Research'],
      },
    ],
  },
  {
    id: 'achievements',
    type: 'list',
    title: 'Achievements',
    icon: '🏆',
    color: '#e8b730',
    position: [-24.6, 4.3],
    items: [
      { title: 'Felicitated by PM Narendra Modi', text: 'Honoured by Hon’ble Prime Minister Narendra Modi and CM N. Chandrababu Naidu at the Limitless Hackathon organised by Republic Bharat, for Gatician.', highlight: true },
      { title: 'SBI Hackathon — top 0.2%', text: 'Gatician ranked in the top 0.2% of 44,000+ participating teams.' },
      { title: 'MeitY Startup Hub Innovation Award', text: 'Recognised for innovation and impact; hosted by FITT, IIT Delhi.', year: '2025', highlight: true },
      { title: '₹4 lakh non-dilutive funding', text: 'For Gatician, through MeitY’s TIDE 2.0 scheme.', year: '2025' },
      { title: 'JEE Advanced AIR 714', text: 'Top 0.5% of 10,00,000+ applicants in JEE Mains & Advanced.', year: '2022' },
      { title: 'Global Security Defence Summit', text: 'One of 6 IIT Delhi students selected for a conference of world leaders from 5+ countries.', year: '2024' },
      { title: 'Letters of Recommendation', text: 'From Prof. Gourav Dwivedi (supply chain project) and Alok Sharma, Director at Aranax Medical.', year: '2024' },
      { title: 'NextGen Leaders Case Competition', text: '3rd runner-up (PwC × Atlas University) with a data-driven strategy pitch.', year: '2025' },
      { title: 'French Olympiad', text: 'Ranked 2nd in Rajasthan; Excellence Certificate and Silver medal.', year: '2017' },
    ],
  },
  {
    id: 'skills',
    type: 'skills',
    title: 'Skills',
    icon: '⚡',
    color: '#c97bb2',
    position: [-18.9, -16.4],
    groups: [
      { label: 'Operations & Strategy', items: ['Process optimisation', 'Supply chain', 'Procurement', 'Vendor management', 'Logistics & routing', 'Quality control', 'Line layout design'] },
      { label: 'Programming', items: ['Python', 'C++', 'MATLAB', 'JavaScript', 'React', 'Node.js', 'Express.js', 'HTML/CSS'] },
      { label: 'Engineering tools', items: ['Autodesk Inventor', 'SolidWorks', 'Ansys', 'FluidSIM', 'Arduino', 'Raspberry Pi'] },
      { label: 'Design & productivity', items: ['Figma', 'Canva', 'MS Office'] },
    ],
  },
  {
    id: 'campus',
    type: 'experience',
    title: 'Campus Life',
    icon: '🎭',
    color: '#4fb3a9',
    position: [0.9, -25],
    items: [
      {
        role: 'Core Team, Admin & Finance — Rendezvous',
        company: 'IIT Delhi’s annual cultural festival',
        period: 'Jul ’25 — Present',
        points: [
          'Ran 200+ events with a footfall of 1.5 lakh+ through a security and administration framework.',
          'Sponsorship finance strategy cut losses and unchecked tax claims by ₹50 lakh.',
          'A digital vendor-onboarding system cut expenses 25% and enabled barter deals.',
        ],
      },
      {
        role: 'Coordinator roles',
        company: 'BRCA · CAIC · eDC',
        period: '2022 — 2025',
        points: [
          'Admin & Finance Coordinator for Rendezvous ’24 and TRYST ’25; Creative Coordinator, BRCA.',
          'BECON Coordinator at eDC; Head of Creative Affairs, IITD MUN; Activity Head for TRYST ’24 and RendezvousX.',
        ],
      },
      {
        role: 'Class Representative & Hostel',
        company: 'Shivalik House',
        period: '2023 — 2025',
        points: ['Elected by 80+ students as Class Representative.', 'Football captain; House Working Committee and Culture Committee member.'],
      },
      {
        role: 'On stage & on the field',
        company: 'Dramatics, film and sports',
        period: '2022 — 2025',
        points: [
          'Runner-up, BRCA Trophy; 2nd runner-up, Sports General Championship.',
          'Runner-up in inter-hostel Stage Play and Mime; 2nd runner-up in Street Play and Short Film.',
        ],
      },
    ],
  },
  {
    id: 'contact',
    type: 'contact',
    title: 'Contact',
    icon: '✉️',
    color: '#e05d5d',
    position: [20, -15],
    text: 'Want to talk operations, supply chains, startups — or just say hi? Drop me an email at kartikgupta1401@gmail.com or reach out on LinkedIn.',
  },
]
