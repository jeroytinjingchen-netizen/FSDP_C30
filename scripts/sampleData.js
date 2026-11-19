// scripts/sampleData.js - sample centres, instructors, students, classes and grading.
// Called from scripts/seed.js. Inserts are idempotent so the seed can run more than once.
// Note: venues, terms, invoices and fee_items have been removed from the schema.

const BISHAN = 'Shinjukai Bishan Centre';
const JURONG = 'Shinjukai Jurong Centre';

// Children's intermediate grades (Blue-Silver, Brown-Silver, Black-Silver) and Junior Dan are included.
// rank_order is unique, so the seed first moves existing orders out of the way before upserting.
const RANKS = [
  { name: '12th Kyu',    order: 1,  colour: 'Red' },
  { name: '11th Kyu',    order: 2,  colour: 'Red-Gold' },
  { name: '10th Kyu',    order: 3,  colour: 'Yellow' },
  { name: '9th Kyu',     order: 4,  colour: 'Orange' },
  { name: '8th Kyu',     order: 5,  colour: 'Green' },
  { name: '7th Kyu',     order: 6,  colour: 'Purple' },
  { name: '6th Kyu',     order: 7,  colour: 'Blue' },
  { name: 'Blue-Silver', order: 8,  colour: 'Blue-Silver' },
  { name: '5th Kyu',     order: 9,  colour: 'Blue-Gold' },
  { name: '4th Kyu',     order: 10, colour: 'Brown' },
  { name: 'Brown-Silver',order: 11, colour: 'Brown-Silver' },
  { name: '3rd Kyu',     order: 12, colour: 'Brown-Gold' },
  { name: '2nd Kyu',     order: 13, colour: 'Black' },
  { name: 'Black-Silver',order: 14, colour: 'Black-Silver' },
  { name: '1st Kyu',     order: 15, colour: 'Black-Gold' },
  { name: 'Junior Dan',  order: 16, colour: 'Black' },
  { name: '1st Dan',     order: 17, colour: 'Black' },
  { name: '2nd Dan',     order: 18, colour: 'Black' },
  { name: '3rd Dan',     order: 19, colour: 'Black' },
  { name: '4th Dan',     order: 20, colour: 'Black' },
  { name: '5th Dan',     order: 21, colour: 'Black' },
  { name: '6th Dan',     order: 22, colour: 'Black' },
  { name: '7th Dan',     order: 23, colour: 'Black' },
];

const CENTRES = [
  { name: BISHAN,                  address: '1 Bishan Street 10, Singapore',                    email: 'bishan@aikidoshinjukai.com', phone: '+65 6000 1001' },
  { name: JURONG,                  address: '2 Jurong East Street 21, Singapore',                email: 'jurong@aikidoshinjukai.com', phone: '+65 6000 1002' },
  { name: 'ASK Headquarters Dojo', address: 'Thomson V One, 9 Sin Ming Road, #B1-02, Singapore 575630' },
  { name: 'Marine Parade Dojo',    address: '278 Marine Parade Road, Singapore 449282' },
  { name: 'Rivervale Dojo',        address: '2 Rivervale Close, Singapore 544583' },
  { name: 'Tampines West Dojo',    address: '5 Tampines Avenue 3, Singapore 529705' },
  { name: 'Thomson Dojo',          address: '194 Upper Thomson Road, Singapore 574339' },
  { name: 'Bukit Timah Dojo',      address: '20 Toh Yi Drive, Singapore 596569' },
  { name: 'SMU Dojo',              address: '81 Victoria Street, Singapore 188065' },
  { name: 'Siglap South Dojo',     address: '6 Palm Road, Singapore 456441' },
];

// availability: [weekday, startMinute, endMinute]  (weekday 0=Monday … 6=Sunday)
// unavailable:  [date, reason]
const INSTRUCTORS = [
  {
    name: 'Tan Wei Ming',
    email: 'tan.weiming@aikidoshinjukai.com',
    phone: '+65 9100 2001',
    rank: '1st Dan',
    qualifications: 'Senior instructor, 20 years of practice',
    centres: [BISHAN, JURONG],
    availability: [[2, 1140, 1290], [4, 1140, 1290], [6, 540, 720]],
    unavailable: [['2026-11-17', 'Overseas seminar']],
  },
  {
    name: 'Aiko Yamada',
    email: 'aiko.yamada@aikidoshinjukai.com',
    phone: '+65 9100 2002',
    rank: '1st Dan',
    qualifications: 'Certified Aikido instructor, children and beginners',
    centres: [BISHAN],
    availability: [[6, 510, 660]],
    unavailable: [],
  },
  {
    name: 'Rahim Abdullah',
    email: 'rahim.abdullah@aikidoshinjukai.com',
    phone: '+65 9100 2003',
    rank: '1st Dan',
    qualifications: 'Assistant instructor',
    centres: [JURONG],
    availability: [[2, 1140, 1260], [6, 600, 720]],
    unavailable: [],
  },
  {
    name: 'Kenji Sato',
    email: 'kenji.sato@aikidoshinjukai.com',
    phone: '+65 9100 2004',
    rank: '1st Dan',
    qualifications: 'Head instructor, ASK Headquarters',
    centres: ['ASK Headquarters Dojo'],
    availability: [[1, 1140, 1260], [3, 1140, 1260]],
    unavailable: [],
  },
  {
    name: 'Siti Aminah',
    email: 'siti.aminah@aikidoshinjukai.com',
    phone: '+65 9100 2005',
    rank: '1st Dan',
    qualifications: 'Instructor, beginners and teens',
    centres: ['Marine Parade Dojo', 'Rivervale Dojo'],
    availability: [[2, 1080, 1200], [5, 1080, 1200]],
    unavailable: [],
  },
  {
    name: 'Lucas Wong',
    email: 'lucas.wong@aikidoshinjukai.com',
    phone: '+65 9100 2006',
    rank: '1st Dan',
    qualifications: 'Assistant instructor, weekend classes',
    centres: ['Tampines West Dojo'],
    availability: [[6, 600, 720]],
    unavailable: [],
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@aikidoshinjukai.com',
    phone: '+65 9100 2007',
    rank: '1st Dan',
    qualifications: 'Instructor, adult classes',
    centres: ['Thomson Dojo', 'Bukit Timah Dojo'],
    availability: [[3, 1140, 1260], [6, 540, 660]],
    unavailable: [],
  },
  {
    name: 'Marcus Chua',
    email: 'marcus.chua@aikidoshinjukai.com',
    phone: '+65 9100 2008',
    rank: '1st Dan',
    qualifications: 'Assistant instructor, university club',
    centres: ['SMU Dojo'],
    availability: [[4, 1140, 1230]],
    unavailable: [],
  },
  {
    name: 'Hannah Lee',
    email: 'hannah.lee@aikidoshinjukai.com',
    phone: '+65 9100 2009',
    rank: '1st Dan',
    qualifications: 'Instructor, children and beginners',
    centres: ['Siglap South Dojo'],
    availability: [[2, 1140, 1260]],
    unavailable: [],
  },
];

// All classes are 60 minutes. start and end are minutes from midnight.
// weekday: 0=Monday … 6=Sunday. centre_id is set via centreId lookup.
const CLASSES = [
  { centre: BISHAN,                  name: 'Beginners Aikido',   weekday: 2, start: 1140, end: 1200, instructor: 'Tan Wei Ming' },
  { centre: BISHAN,                  name: 'Intermediate Aikido',weekday: 4, start: 1170, end: 1230, instructor: 'Tan Wei Ming' },
  { centre: BISHAN,                  name: 'Kids Aikido',        weekday: 6, start:  540, end:  600, instructor: 'Aiko Yamada' },
  { centre: JURONG,                  name: 'Beginners Aikido',   weekday: 2, start: 1140, end: 1200, instructor: 'Rahim Abdullah' },
  { centre: JURONG,                  name: 'Weekend Aikido',     weekday: 6, start:  600, end:  660, instructor: 'Rahim Abdullah' },
  { centre: 'ASK Headquarters Dojo', name: 'Adult Aikido',       weekday: 5, start:  600, end:  660, instructor: 'Kenji Sato' },
  { centre: 'Marine Parade Dojo',    name: 'Beginners Aikido',   weekday: 5, start:  600, end:  660, instructor: 'Siti Aminah' },
  { centre: 'Rivervale Dojo',        name: 'Teens Aikido',       weekday: 3, start: 1080, end: 1140, instructor: 'Siti Aminah' },
  { centre: 'Tampines West Dojo',    name: 'Beginners Aikido',   weekday: 5, start:  840, end:  900, instructor: 'Lucas Wong' },
  { centre: 'Thomson Dojo',          name: 'Adult Aikido',       weekday: 4, start: 1170, end: 1230, instructor: 'Priya Nair' },
  { centre: 'Bukit Timah Dojo',      name: 'Adult Aikido',       weekday: 2, start: 1140, end: 1200, instructor: 'Priya Nair' },
  { centre: 'SMU Dojo',              name: 'University Aikido',  weekday: 1, start: 1140, end: 1200, instructor: 'Marcus Chua' },
  { centre: 'Siglap South Dojo',     name: 'Kids Aikido',        weekday: 6, start:  540, end:  600, instructor: 'Hannah Lee' },
];

const STUDENTS = [
  { first: 'Alice',    last: 'Tan',    email: 'alice.tan@example.com',    centre: BISHAN, rank: '5th Kyu', phone: '+65 9123 4001', dob: '2012-04-18', guardian: 'Tan Mei Ling',  guardianPhone: '+65 9123 4100' },
  { first: 'Benjamin', last: 'Lim',    email: 'ben.lim@example.com',       centre: BISHAN, rank: '4th Kyu', phone: '+65 9123 4002', dob: '1995-07-02' },
  { first: 'Chloe',   last: 'Ng',     email: 'chloe.ng@example.com',      centre: BISHAN, rank: '6th Kyu', phone: '+65 9123 4003', dob: '2001-11-30' },
  { first: 'Daniel',  last: 'Ong',    email: 'daniel.ong@example.com',    centre: JURONG, rank: '3rd Kyu', phone: '+65 9123 4004', dob: '1988-03-14' },
  { first: 'Eliza',   last: 'Koh',    email: 'eliza.koh@example.com',     centre: JURONG, rank: '9th Kyu', phone: null,            dob: '2015-09-09', guardian: 'Koh Hwee Ling', guardianPhone: '+65 9123 4200' },
  { first: 'Farid',   last: 'Ismail', email: 'farid.ismail@example.com',  centre: JURONG, rank: '2nd Kyu', phone: '+65 9123 4005', dob: '1992-01-21' },
  { first: 'Grace',   last: 'Wong',   email: 'grace.wong@example.com',    centre: BISHAN, rank: '7th Kyu', phone: '+65 9123 4006', dob: '1999-05-12' },
  { first: 'Harris',  last: 'Lee',    email: 'harris.lee@example.com',    centre: BISHAN, rank: '8th Kyu', phone: '+65 9123 4007', dob: '2010-02-28', guardian: 'Lee Chin Ho',   guardianPhone: '+65 9123 4101' },
  { first: 'Iris',    last: 'Chan',   email: 'iris.chan@example.com',     centre: JURONG, rank: '10th Kyu', phone: '+65 9123 4008', dob: '2013-06-15', guardian: 'Chan Wing Seng', guardianPhone: '+65 9123 4201' },
  { first: 'Jared',   last: 'Tan',    email: 'jared.tan@example.com',     centre: BISHAN, rank: '3rd Kyu', phone: '+65 9123 4009', dob: '1993-09-20' },
  { first: 'Kelly',   last: 'Goh',    email: 'kelly.goh@example.com',     centre: 'Marine Parade Dojo', rank: '6th Kyu', phone: '+65 9123 4010', dob: '1998-12-03' },
  { first: 'Liam',    last: 'Sim',    email: 'liam.sim@example.com',      centre: 'Marine Parade Dojo', rank: '5th Kyu', phone: '+65 9123 4011', dob: '2005-08-17', guardian: 'Sim Kah Ming',  guardianPhone: '+65 9123 4102' },
  { first: 'Maya',    last: 'Rahman', email: 'maya.rahman@example.com',   centre: 'Rivervale Dojo',     rank: '7th Kyu', phone: '+65 9123 4012', dob: '1996-11-22' },
  { first: 'Noah',    last: 'Chia',   email: 'noah.chia@example.com',    centre: 'Rivervale Dojo',     rank: '4th Kyu', phone: '+65 9123 4013', dob: '2008-04-05', guardian: 'Chia Boon Keng', guardianPhone: '+65 9123 4103' },
  { first: 'Olivia',  last: 'Phua',   email: 'olivia.phua@example.com',   centre: 'Tampines West Dojo', rank: '8th Kyu', phone: '+65 9123 4014', dob: '2002-10-11' },
  { first: 'Prakash', last: 'Naidu',  email: 'prakash.naidu@example.com', centre: 'Tampines West Dojo', rank: '6th Kyu', phone: '+65 9123 4015', dob: '1994-03-19' },
  { first: 'Quinn',   last: 'Yeo',    email: 'quinn.yeo@example.com',     centre: 'Thomson Dojo',       rank: '5th Kyu', phone: '+65 9123 4016', dob: '2007-01-14', guardian: 'Yeo Lai Heng',  guardianPhone: '+65 9123 4104' },
  { first: 'Ryan',    last: 'Koh',    email: 'ryan.koh@example.com',      centre: 'Thomson Dojo',       rank: '2nd Kyu', phone: '+65 9123 4017', dob: '1990-07-08' },
  { first: 'Sara',    last: 'Lim',    email: 'sara.lim@example.com',      centre: 'Bukit Timah Dojo',   rank: '9th Kyu', phone: '+65 9123 4018', dob: '2011-05-23', guardian: 'Lim Swee Kim',  guardianPhone: '+65 9123 4105' },
  { first: 'Tariq',   last: 'Aziz',   email: 'tariq.aziz@example.com',    centre: 'Bukit Timah Dojo',   rank: '3rd Kyu', phone: '+65 9123 4019', dob: '1987-02-27' },
  { first: 'Uma',    last: 'Krish',  email: 'uma.krish@example.com',     centre: 'SMU Dojo',           rank: '7th Kyu', phone: '+65 9123 4020', dob: '2003-09-30' },
  { first: 'Victor',  last: 'Loke',   email: 'victor.loke@example.com',  centre: 'SMU Dojo',           rank: '1st Kyu', phone: '+65 9123 4021', dob: '1991-12-08' },
  { first: 'Wendy',   last: 'Chong',  email: 'wendy.chong@example.com',  centre: 'Siglap South Dojo', rank: '6th Kyu', phone: '+65 9123 4022', dob: '2004-06-19' },
  { first: 'Xavier',  last: 'Tan',    email: 'xavier.tan@example.com',   centre: 'Siglap South Dojo', rank: '4th Kyu', phone: '+65 9123 4023', dob: '1997-08-14' },
  { first: 'Yuki',    last: 'Tanaka', email: 'yuki.tanaka@example.com',   centre: 'ASK Headquarters Dojo', rank: '1st Dan', phone: '+65 9123 4024', dob: '1985-10-01' },
  { first: 'Zara',    last: 'Hussein', email: 'zara.hussein@example.com', centre: 'ASK Headquarters Dojo', rank: '2nd Dan', phone: '+65 9123 4025', dob: '1983-04-25' },
];

const GRADINGS = [
  {
    centre: BISHAN,
    title: 'Mass Grading - Bishan (Dec 2026)',
    starts: '2026-12-06T10:00:00+08:00',
    ends:   '2026-12-06T13:00:00+08:00',
    ranksTested: ['6th Kyu', '5th Kyu', '4th Kyu', '3rd Kyu'],
    examiners: ['Tan Wei Ming', 'Aiko Yamada'],
    candidates: ['alice.tan@example.com', 'chloe.ng@example.com', 'ben.lim@example.com', 'grace.wong@example.com', 'harris.lee@example.com', 'jared.tan@example.com'],
  },
  {
    centre: JURONG,
    title: 'Mass Grading - Jurong (Dec 2026)',
    starts: '2026-12-13T10:00:00+08:00',
    ends:   '2026-12-13T13:00:00+08:00',
    ranksTested: ['2nd Kyu', '9th Kyu', '10th Kyu'],
    examiners: ['Rahim Abdullah'],
    candidates: ['farid.ismail@example.com', 'eliza.koh@example.com', 'daniel.ong@example.com', 'iris.chan@example.com'],
  },
  {
    centre: 'Marine Parade Dojo',
    title: 'Mass Grading - Marine Parade (Jan 2027)',
    starts: '2027-01-17T10:00:00+08:00',
    ends:   '2027-01-17T13:00:00+08:00',
    ranksTested: ['6th Kyu', '5th Kyu'],
    examiners: ['Siti Aminah'],
    candidates: ['kelly.goh@example.com', 'liam.sim@example.com'],
  },
  {
    centre: 'ASK Headquarters Dojo',
    title: 'Dan Grading - HQ (Jan 2027)',
    starts: '2027-01-24T09:00:00+08:00',
    ends:   '2027-01-24T12:00:00+08:00',
    ranksTested: ['1st Dan', '2nd Dan'],
    examiners: ['Kenji Sato'],
    candidates: ['yuki.tanaka@example.com', 'zara.hussein@example.com'],
  },
  {
    centre: 'Tampines West Dojo',
    title: 'Mass Grading - Tampines West (Feb 2027)',
    starts: '2027-02-07T10:00:00+08:00',
    ends:   '2027-02-07T13:00:00+08:00',
    ranksTested: ['8th Kyu', '6th Kyu'],
    examiners: ['Lucas Wong'],
    candidates: ['olivia.phua@example.com', 'prakash.naidu@example.com'],
  },
  {
    centre: 'Thomson Dojo',
    title: 'Mass Grading - Thomson (Feb 2027)',
    starts: '2027-02-14T10:00:00+08:00',
    ends:   '2027-02-14T13:00:00+08:00',
    ranksTested: ['5th Kyu', '2nd Kyu'],
    examiners: ['Priya Nair'],
    candidates: ['quinn.yeo@example.com', 'ryan.koh@example.com'],
  },
  {
    centre: 'Bukit Timah Dojo',
    title: 'Mass Grading - Bukit Timah (Feb 2027)',
    starts: '2027-02-21T10:00:00+08:00',
    ends:   '2027-02-21T13:00:00+08:00',
    ranksTested: ['9th Kyu', '3rd Kyu'],
    examiners: ['Priya Nair'],
    candidates: ['sara.lim@example.com', 'tariq.aziz@example.com'],
  },
  {
    centre: 'SMU Dojo',
    title: 'Mass Grading - SMU (Mar 2027)',
    starts: '2027-03-07T10:00:00+08:00',
    ends:   '2027-03-07T13:00:00+08:00',
    ranksTested: ['7th Kyu', '1st Kyu'],
    examiners: ['Marcus Chua'],
    candidates: ['uma.krish@example.com', 'victor.loke@example.com'],
  },
  {
    centre: 'Siglap South Dojo',
    title: 'Mass Grading - Siglap South (Mar 2027)',
    starts: '2027-03-14T10:00:00+08:00',
    ends:   '2027-03-14T13:00:00+08:00',
    ranksTested: ['6th Kyu', '4th Kyu'],
    examiners: ['Hannah Lee'],
    candidates: ['wendy.chong@example.com', 'xavier.tan@example.com'],
  },
];

async function findOrInsert(client, selectSql, selectParams, insertSql, insertParams) {
  const found = await client.query(selectSql, selectParams);
  if (found.rows.length) return found.rows[0].id;
  const created = await client.query(insertSql, insertParams);
  return created.rows[0].id;
}

async function seedSampleData(client) {
  // Ranks
  await client.query('UPDATE ranks SET rank_order = -1000 - rank_order');
  const rankId = {};
  for (const r of RANKS) {
    const { rows } = await client.query(
      `INSERT INTO ranks (name, rank_order, colour) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET rank_order = EXCLUDED.rank_order, colour = EXCLUDED.colour
       RETURNING id`,
      [r.name, r.order, r.colour]
    );
    rankId[r.name] = rows[0].id;
  }

  // Centres
  const centreId = {};
  for (const c of CENTRES) {
    const { rows } = await client.query(
      `INSERT INTO centres (name, address, email, phone) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET address = EXCLUDED.address, email = EXCLUDED.email, phone = EXCLUDED.phone
       RETURNING id`,
      [c.name, c.address, c.email || null, c.phone || null]
    );
    centreId[c.name] = rows[0].id;
  }

  // Instructors
  const instructorId = {};
  for (const i of INSTRUCTORS) {
    instructorId[i.name] = await findOrInsert(
      client,
      'SELECT id FROM instructors WHERE name = $1', [i.name],
      `INSERT INTO instructors (name, email, phone, rank_id, qualifications)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [i.name, i.email, i.phone, rankId[i.rank], i.qualifications]
    );
    await client.query('UPDATE instructors SET rank_id = $1 WHERE id = $2', [rankId[i.rank], instructorId[i.name]]);
    for (const c of i.centres) {
      await client.query(
        'INSERT INTO instructor_centres (instructor_id, centre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [instructorId[i.name], centreId[c]]
      );
    }
    const { rows: hasAvail } = await client.query(
      'SELECT 1 FROM instructor_availability WHERE instructor_id = $1 LIMIT 1', [instructorId[i.name]]
    );
    if (!hasAvail.length) {
      for (const [weekday, start, end] of i.availability) {
        await client.query(
          `INSERT INTO instructor_availability (instructor_id, weekday, start_minute, end_minute)
           VALUES ($1, $2, $3, $4)`,
          [instructorId[i.name], weekday, start, end]
        );
      }
    }
    for (const [date, reason] of i.unavailable) {
      await client.query(
        `INSERT INTO instructor_unavailable_dates (instructor_id, date, reason) VALUES ($1, $2, $3)
         ON CONFLICT (instructor_id, date) DO NOTHING`,
        [instructorId[i.name], date, reason]
      );
    }
  }

  // Classes (60-minute class templates)
  for (const cls of CLASSES) {
    const { rows } = await client.query(
      `INSERT INTO class_templates (centre_id, instructor_id, name, weekday, start_minute, end_minute)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (centre_id, name, weekday) DO UPDATE
         SET instructor_id = EXCLUDED.instructor_id, start_minute = EXCLUDED.start_minute, end_minute = EXCLUDED.end_minute
       RETURNING id`,
      [centreId[cls.centre], instructorId[cls.instructor], cls.name, cls.weekday, cls.start, cls.end]
    );
    await client.query(
      `INSERT INTO class_template_instructors (template_id, instructor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [rows[0].id, instructorId[cls.instructor]]
    );
  }

  // Students
  const studentId = {};
  for (const s of STUDENTS) {
    const { rows } = await client.query(
      `INSERT INTO students (centre_id, current_rank_id, first_name, last_name, email, phone,
                             date_of_birth, guardian_name, guardian_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO UPDATE SET
         centre_id = EXCLUDED.centre_id, current_rank_id = EXCLUDED.current_rank_id,
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone,
         date_of_birth = EXCLUDED.date_of_birth, guardian_name = EXCLUDED.guardian_name,
         guardian_phone = EXCLUDED.guardian_phone
       RETURNING id`,
      [centreId[s.centre], rankId[s.rank], s.first, s.last, s.email, s.phone || null,
       s.dob, s.guardian || null, s.guardianPhone || null]
    );
    studentId[s.email] = rows[0].id;
  }

  // Grading sessions
  for (const g of GRADINGS) {
    const gradingId = await findOrInsert(
      client,
      'SELECT id FROM grading_sessions WHERE centre_id = $1 AND title = $2', [centreId[g.centre], g.title],
      `INSERT INTO grading_sessions (centre_id, type, title, starts_at, ends_at)
       VALUES ($1, 'MASS', $2, $3, $4) RETURNING id`,
      [centreId[g.centre], g.title, g.starts, g.ends]
    );
    for (const r of g.ranksTested) {
      await client.query(
        'INSERT INTO grading_ranks_tested (grading_session_id, rank_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [gradingId, rankId[r]]
      );
    }
    for (const name of g.examiners) {
      await client.query(
        'INSERT INTO grading_examiners (grading_session_id, instructor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [gradingId, instructorId[name]]
      );
    }
    for (const email of g.candidates) {
      const student = STUDENTS.find((s) => s.email === email);
      await client.query(
        `INSERT INTO grading_candidates (grading_session_id, student_id, from_rank_id)
         VALUES ($1, $2, $3) ON CONFLICT (grading_session_id, student_id) DO NOTHING`,
        [gradingId, studentId[email], rankId[student.rank]]
      );
    }
  }

  await client.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2), ($3, $4)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['reminderDaysBefore', JSON.stringify(3), 'overdueIntervalsDays', JSON.stringify([1, 7, 14])]
  );
}

module.exports = { seedSampleData };
