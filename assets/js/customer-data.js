/* Veridian Life Sciences: the made-up customer behind the demos.
 *
 * customer.html and network.html both read this file, so a number changed
 * here changes on both pages.
 *
 * Three kinds of number live here, and the pages say which is which:
 *   - the company profile (employees, revenue, 31 sites) is the story I wrote;
 *   - the split of people by region and business unit is made up to fit it;
 *   - everything under `estate` is what the ServiceNow instance holds for the
 *     customer company. Do not round these to the design.
 *
 * The instance came with five sites: DC1, LON, NCL, PNQ and the Paris sales
 * office (755 devices, counted on 15 November 2026). On 16 November the
 * console's load built the other 26 by copying a loaded site of the same kind,
 * device for device: 3,084 more, none failed. The counts below were read
 * from the instance after the load, on 16 November 2026, by the console's
 * readiness check. `original` marks the first five.
 */
(function () {
  'use strict';

  /* A coarse picture of the land, one character per 3 degrees. Row 0 starts
     at 72 degrees north, column 0 at 168 degrees west. */
  var LAND = [
    '...##............#####..#.#######.....#########.#...............##............##.############################.......',
    '.############################.####....#########...#.........###.####################################################',
    '.############################.####.....###......###.........###.####################################################',
    '.########################.....##........##................####.###############################################.###..',
    '....#.....###############.....###.#.......................#.##..#######################################......#......',
    '..#.........###############...######..................#.....#..#######################################......##......',
    '.............################.#######................###################################################....#.......',
    '...............###################......................################################################............',
    '...............###################.....................###########.#.####.############################.#............',
    '...............##################....................#.###.#.####....###.############################..#............',
    '...............#################.....................###.....###..######..######################.##.................',
    '...............################......................###....#..#.#######..######################..#...#.............',
    '................##############........................#####.........############################..#.##..............',
    '.................############........................########..#...##############################..#................',
    '...................#####....#.......................###############.####.########################...................',
    '....................####...........................################.#####..#####################....................',
    '.....................##............................#################.#######...###############......................',
    '.....................###..#.....#..................#################..#####.....####...####.#.......................',
    '.......................####.......................###################.####......###....#####....#...................',
    '..........................##......................######################.........##......###........................',
    '...........................#...##..#...............######################........##.......##........................',
    '..............................######................#####################........................#..................',
    '..............................#########..............#....##############................##....#.....................',
    '..............................#########....................############..................##.###...#.................',
    '.............................############..................###########...................##..##.#...#...............',
    '.............................##############.................#########.....................#.....#....###..#.........',
    '.............................###############................#########......................###........###...........',
    '..............................##############................#########...............................................',
    '...............................############.................#########...#..........................##..#............',
    '...............................############.................#########..##........................#####.#............',
    '.................................##########.................########...#........................#########...........',
    '.................................#########...................#######..##......................############..........',
    '................................########.....................######...........................#############.........',
    '................................########.....................######...........................#############.........',
    '................................#######.......................####............................#############.........',
    '................................####.#........................#...............................##......####..........',
    '...............................######..................................................................###........#.',
    '...............................####...............................................................................#.',
    '................................##...............................................................................#..',
    '...............................##...............................................................................#...'
  ];

  var TIERS = [
    {
      key: 'T0', name: 'Data centres', one: 'Data centre', count: 3, tone: 'ink',
      users: 'No staff on site', level: 'Gold', target: '99.95%',
      why: 'Everything else connects through these. A fault here is felt at every site.'
    },
    {
      key: 'T1', name: 'Head office and campuses', one: 'Campus', count: 4, tone: 'green',
      users: '2,000 to 5,000 people each', level: 'Gold', target: '99.95%',
      why: 'Thousands of people on Wi-Fi in one building. Running out of capacity is the usual problem.'
    },
    {
      key: 'T2', name: 'Manufacturing plants', one: 'Manufacturing plant', count: 8, tone: 'amber',
      users: '300 to 1,500 people each', level: 'Gold', target: '99.95%',
      why: 'Regulated. Changes are only allowed in an approved window, from Saturday night to Sunday morning.'
    },
    {
      key: 'T3', name: 'Research labs', one: 'Research lab', count: 3, tone: 'blue',
      users: '500 to 1,500 people each', level: 'Silver', target: '99.9%',
      why: 'Lab equipment on Wi-Fi, moving a lot of data.'
    },
    {
      key: 'T4', name: 'Sales offices', one: 'Sales office', count: 13, tone: 'grey',
      users: '20 to 200 people each', level: 'Bronze', target: '99.5%',
      why: 'Small, with a single device connecting each one to the rest. When it fails, the whole office is offline.'
    }
  ];

  /* lat and lon place the dot. `original` marks the five sites the instance
     came with; the other 26 were copied from them. */
  var SITES = [
    { name: 'London DC1', place: 'Slough, UK', region: 'EMEA', tier: 'T0', lat: 51.51, lon: -0.59, original: true },
    { name: 'Ashburn DC2', place: 'Virginia, US', region: 'AMER', tier: 'T0', lat: 39.04, lon: -77.49 },
    { name: 'Singapore DC3', place: 'Singapore', region: 'APAC', tier: 'T0', lat: 1.42, lon: 103.9 },

    { name: 'London HQ', place: 'Canary Wharf, UK', region: 'EMEA', tier: 'T1', lat: 51.5, lon: -0.02, original: true },
    { name: 'Boston', place: 'Massachusetts, US', region: 'AMER', tier: 'T1', lat: 42.36, lon: -71.06 },
    { name: 'Zurich', place: 'Switzerland', region: 'EMEA', tier: 'T1', lat: 47.38, lon: 8.54 },
    { name: 'Singapore Hub', place: 'Singapore', region: 'APAC', tier: 'T1', lat: 1.29, lon: 103.85 },

    { name: 'Newcastle', place: 'UK', region: 'EMEA', tier: 'T2', lat: 54.98, lon: -1.62, original: true },
    { name: 'Leeds', place: 'UK', region: 'EMEA', tier: 'T2', lat: 53.8, lon: -1.55 },
    { name: 'Cork', place: 'Ireland', region: 'EMEA', tier: 'T2', lat: 51.9, lon: -8.47 },
    { name: 'Ghent', place: 'Belgium', region: 'EMEA', tier: 'T2', lat: 51.05, lon: 3.72 },
    { name: 'Raleigh', place: 'North Carolina, US', region: 'AMER', tier: 'T2', lat: 35.78, lon: -78.64 },
    { name: 'Indianapolis', place: 'Indiana, US', region: 'AMER', tier: 'T2', lat: 39.77, lon: -86.16 },
    { name: 'Pune', place: 'India', region: 'APAC', tier: 'T2', lat: 18.52, lon: 73.86, original: true },
    { name: 'Jurong', place: 'Singapore', region: 'APAC', tier: 'T2', lat: 1.33, lon: 103.72 },

    { name: 'Oxford', place: 'UK', region: 'EMEA', tier: 'T3', lat: 51.75, lon: -1.26 },
    { name: 'San Diego', place: 'California, US', region: 'AMER', tier: 'T3', lat: 32.72, lon: -117.16 },
    { name: 'Shanghai', place: 'China', region: 'APAC', tier: 'T3', lat: 31.23, lon: 121.47 },

    { name: 'Paris', place: 'France', region: 'EMEA', tier: 'T4', lat: 48.86, lon: 2.35, original: true },
    { name: 'Madrid', place: 'Spain', region: 'EMEA', tier: 'T4', lat: 40.42, lon: -3.7 },
    { name: 'Milan', place: 'Italy', region: 'EMEA', tier: 'T4', lat: 45.46, lon: 9.19 },
    { name: 'Munich', place: 'Germany', region: 'EMEA', tier: 'T4', lat: 48.14, lon: 11.58 },
    { name: 'Warsaw', place: 'Poland', region: 'EMEA', tier: 'T4', lat: 52.23, lon: 21.01 },
    { name: 'Dubai', place: 'UAE', region: 'EMEA', tier: 'T4', lat: 25.2, lon: 55.27 },
    { name: 'Johannesburg', place: 'South Africa', region: 'EMEA', tier: 'T4', lat: -26.2, lon: 28.05 },
    { name: 'Toronto', place: 'Canada', region: 'AMER', tier: 'T4', lat: 43.65, lon: -79.38 },
    { name: 'Mexico City', place: 'Mexico', region: 'AMER', tier: 'T4', lat: 19.43, lon: -99.13 },
    { name: 'São Paulo', place: 'Brazil', region: 'AMER', tier: 'T4', lat: -23.55, lon: -46.63 },
    { name: 'Mumbai', place: 'India', region: 'APAC', tier: 'T4', lat: 19.08, lon: 72.88 },
    { name: 'Tokyo', place: 'Japan', region: 'APAC', tier: 'T4', lat: 35.68, lon: 139.69 },
    { name: 'Sydney', place: 'Australia', region: 'APAC', tier: 'T4', lat: -33.87, lon: 151.21 }
  ];

  /* Made up to fit the story. Each list adds up to 42,000. */
  var REGIONS = [
    { key: 'EMEA', name: 'Europe, Middle East and Africa', people: 19500 },
    { key: 'AMER', name: 'The Americas', people: 13000 },
    { key: 'APAC', name: 'Asia Pacific', people: 9500 }
  ];
  var UNITS = [
    { name: 'Pharmaceuticals', people: 14500 },
    { name: 'Global Supply Chain', people: 8000 },
    { name: 'Consumer Health', people: 7500 },
    { name: 'Vaccines', people: 6500 },
    { name: 'Research and Development', people: 5500 }
  ];

  var WHO = [
    {
      side: 'Veridian', role: 'The customer', tone: 'ink',
      line: 'Buys the network as a service and owns the business risk.',
      people: [
        'Chief Information Officer',
        'Chief Technology Officer: the only one who can accept a risk',
        'Security operations',
        'Quality team: approves any change at a regulated plant',
        'Service desk: takes the first call',
        'IT staff at each site: hands and eyes'
      ]
    },
    {
      side: 'Netwik', role: 'Runs the network', tone: 'green',
      line: 'In the story, Netwik is the outside firm that operates the network day to day. The agents work here.',
      people: [
        'Client executive: owns the contract and the relationship',
        'Service delivery manager',
        'Operations centre, staffed day and night',
        'Engineers for switches, WAN, Wi-Fi and firewalls',
        'Change, problem, capacity and release managers'
      ]
    },
    {
      side: 'Suppliers', role: 'Make the kit and carry the traffic', tone: 'grey',
      line: 'Called when a fault is in their equipment or on their line.',
      people: [
        'Equipment makers, for example Cisco and Palo Alto Networks',
        'Carriers, for example BT, Verizon and Singtel'
      ]
    }
  ];

  var PROMISES = [
    { level: 'P1', name: 'Critical', respond: '15 minutes', fix: '2 hours', hours: 'Day and night' },
    { level: 'P2', name: 'High', respond: '30 minutes', fix: '8 hours', hours: 'Day and night' },
    { level: 'P3', name: 'Moderate', respond: '4 hours', fix: '3 working days', hours: 'Working hours' },
    { level: 'P4', name: 'Low', respond: '8 hours', fix: '5 working days', hours: 'Working hours' }
  ];

  /* What the instance holds for the customer company. */
  var ESTATE = {
    checked: '16 November 2026',
    total: 3807,
    kinds: [
      { key: 'ap', name: 'Wi-Fi access points', count: 3290, tone: 'green', does: 'The boxes on the ceiling that laptops and phones connect to.' },
      { key: 'switch', name: 'Switches', count: 426, tone: 'ink', does: 'Connect everything inside a building.' },
      { key: 'firewall', name: 'Firewalls', count: 42, tone: 'amber', does: 'Decide what traffic is allowed in and out.' },
      { key: 'edge', name: 'WAN edge routers', count: 49, tone: 'blue', does: 'Connect each site to the others.' }
    ],
    controllers: 36,
    makers: [
      { name: 'Cisco', count: 3765, tone: 'ink' },
      { name: 'Palo Alto Networks', count: 42, tone: 'amber' }
    ],
    internetFacing: 91,
    models: 22,
    links: 12,
    sites: 31,
    /* Whole-table counts. The instance also holds a few sample records of its
       own, so the pages show these rounded and say so. */
    history: [
      { name: 'Incidents', shown: 'About 1,000', what: 'Something broke or slowed down' },
      { name: 'Changes', shown: 'About 400', what: 'Planned work on the network' },
      { name: 'Outages', shown: 'About 500', what: 'Recorded periods of downtime' },
      { name: 'Problems', shown: 'About 30', what: 'Root causes being chased' },
      { name: 'Knowledge articles', shown: 'About 75', what: 'How-to notes for engineers' },
      { name: 'Capacity readings', shown: 'About 35,000', what: 'Daily measurements of how full things are' }
    ]
  };

  /* The standard design for one site of each tier. `n` is how many of that
     thing one site has. */
  var DESIGNS = {
    T0: [
      { name: 'Lines to the outside', n: 4, kind: 'link', note: 'Two private lines and two internet lines' },
      { name: 'WAN edge routers', n: 2, kind: 'edge', note: 'The hubs every other site connects to' },
      { name: 'Firewalls', n: 4, kind: 'firewall', note: 'Two at the perimeter, two inside' },
      { name: 'Core switches', n: 2, kind: 'switch', note: '' },
      { name: 'Wi-Fi controllers', n: 2, kind: 'controller', note: 'Also run the Wi-Fi in the sales offices' },
      { name: 'Wi-Fi access points', n: 0, kind: 'ap', note: 'None. Nobody works here' }
    ],
    T1: [
      { name: 'Lines to the outside', n: 2, kind: 'link', note: 'One private line and one internet line' },
      { name: 'WAN edge routers', n: 2, kind: 'edge', note: 'A pair, so one can fail' },
      { name: 'Firewalls', n: 2, kind: 'firewall', note: 'A pair' },
      { name: 'Switches', n: 48, kind: 'switch', note: '2 core, 6 distribution, 40 on the floors' },
      { name: 'Wi-Fi controllers', n: 2, kind: 'controller', note: '' },
      { name: 'Wi-Fi access points', n: 400, kind: 'ap', note: '' }
    ],
    T2: [
      { name: 'Lines to the outside', n: 2, kind: 'link', note: 'One private line and one internet line' },
      { name: 'WAN edge routers', n: 2, kind: 'edge', note: 'A pair, so one can fail' },
      { name: 'Firewalls', n: 2, kind: 'firewall', note: 'Between the office network and the factory floor' },
      { name: 'Switches', n: 17, kind: 'switch', note: '2 core, 12 in the offices, 3 rugged ones on the factory floor' },
      { name: 'Wi-Fi controllers', n: 2, kind: 'controller', note: '' },
      { name: 'Wi-Fi access points', n: 120, kind: 'ap', note: '' }
    ],
    T3: [
      { name: 'Lines to the outside', n: 2, kind: 'link', note: 'One private line and one internet line' },
      { name: 'WAN edge routers', n: 2, kind: 'edge', note: 'A pair, so one can fail' },
      { name: 'Firewalls', n: 2, kind: 'firewall', note: 'A pair' },
      { name: 'Switches', n: 22, kind: 'switch', note: '2 core, 20 in the labs' },
      { name: 'Wi-Fi controllers', n: 2, kind: 'controller', note: '' },
      { name: 'Wi-Fi access points', n: 200, kind: 'ap', note: '' }
    ],
    T4: [
      { name: 'Lines to the outside', n: 2, kind: 'link', note: 'Broadband, with mobile data as the spare' },
      { name: 'WAN edge router', n: 1, kind: 'edge', note: 'Only one. It also does the firewall job' },
      { name: 'Firewalls', n: 0, kind: 'firewall', note: 'None of its own' },
      { name: 'Switches', n: 2, kind: 'switch', note: '' },
      { name: 'Wi-Fi controllers', n: 0, kind: 'controller', note: 'Run from a data centre' },
      { name: 'Wi-Fi access points', n: 10, kind: 'ap', note: '' }
    ]
  };

  var LINKS = [
    { name: 'Private lines', what: 'A dedicated line from a carrier. Steady and expensive.', where: 'Data centres, campuses, plants and labs' },
    { name: 'Business internet', what: 'A second way out, so one line can fail.', where: 'Data centres, campuses, plants and labs' },
    { name: 'Broadband', what: 'Ordinary office internet.', where: 'Sales offices' },
    { name: 'Mobile data', what: 'The spare for when broadband drops.', where: 'Sales offices' }
  ];

  var TOOLS = [
    { name: 'ServiceNow', what: 'The record of every device, ticket and change', today: true },
    { name: 'Cisco Catalyst Center', what: 'Switches and Wi-Fi', today: false },
    { name: 'Cisco SD-WAN Manager', what: 'The links between sites', today: false },
    { name: 'Palo Alto Panorama', what: 'Firewalls', today: false },
    { name: 'SolarWinds Orion', what: 'Alarms and how busy each line is', today: false }
  ];

  window.NetwikCustomer = {
    land: { rows: LAND, lon0: -168, lat0: 72, step: 3 },
    profile: {
      name: 'Veridian Life Sciences', employees: 42000, revenue: '£28bn',
      hq: 'London', sites: SITES.length, regions: 3, regulated: 8
    },
    tiers: TIERS, sites: SITES, regions: REGIONS, units: UNITS,
    who: WHO, promises: PROMISES,
    estate: ESTATE, designs: DESIGNS, links: LINKS, tools: TOOLS
  };
})();
