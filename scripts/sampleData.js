// scripts/sampleData.js - sample centres, instructors, students, classes, invoices and grading.
// Called from scripts/seed.js. Inserts are idempotent so the seed can run more than once.

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = '+08:00';

const BISHAN = 'Shinjukai Bishan Centre';
const JURONG = 'Shinjukai Jurong Centre';

// Children's intermediate grades (Blue-Silver, Brown-Silver, Black-Silver) and Junior Dan are included.
// rank_order is unique, so the seed first moves existing orders out of the way before upserting.
const RANKS = [
  { name: '12th Kyu', order: 1, colour: 'Red' },
  { name: '11th Kyu', order: 2, colour: 'Red-Gold' },
  { name: '10th Kyu', order: 3, colour: 'Yellow' },
  { name: '9th Kyu', order: 4, colour: 'Orange' },
  { name: '8th Kyu', order: 5, colour: 'Green' },
  { name: '7th Kyu', order: 6, colour: 'Purple' },
  { name: '6th Kyu', order: 7, colour: 'Blue' },
  { name: 'Blue-Silver', order: 8, colour: 'Blue-Silver' },
  { name: '5th Kyu', order: 9, colour: 'Blue-Gold' },
  { name: '4th Kyu', order: 10, colour: 'Brown' },
  { name: 'Brown-Silver', order: 11, colour: 'Brown-Silver' },
  { name: '3rd Kyu', order: 12, colour: 'Brown-Gold' },
  { name: '2nd Kyu', order: 13, colour: 'Black' },
  { name: 'Black-Silver', order: 14, colour: 'Black-Silver' },
  { name: '1st Kyu', order: 15, colour: 'Black-Gold' },
  { name: 'Junior Dan', order: 16, colour: 'Black' },
  { name: '1st Dan', order: 17, colour: 'Black' },
  { name: '2nd Dan', order: 18, colour: 'Black' },
  { name: '3rd Dan', order: 19, colour: 'Black' },
  { name: '4th Dan', order: 20, colour: 'Black' },
  { name: '5th Dan', order: 21, colour: 'Black' },
  { name: '6th Dan', order: 22, colour: 'Black' },
  { name: '7th Dan', order: 23, colour: 'Black' },
];

const CENTRES = [
  { name: BISHAN, address: '1 Bishan Street 10, Singapore', email: 'bishan@aikidoshinjukai.com', phone: '+65 6000 1001' },
  { name: JURONG, address: '2 Jurong East Street 21, Singapore', email: 'jurong@aikidoshinjukai.com', phone: '+65 6000 1002' },
  { name: 'ASK Headquarters Dojo' },
  { name: 'Marine Parade Dojo' },
  { name: 'Rivervale Dojo' },
  { name: 'Tampines West Dojo' },
  { name: 'Thomson Dojo' },
  { name: 'Bukit Timah Dojo' },
  { name: 'SMU Dojo' },
  { name: 'Siglap South Dojo' },
];

const VENUES = {
  [BISHAN]: [
    { name: 'Main Dojo', capacity: 40 },
    { name: 'Studio 2', capacity: 20 },
  ],
  [JURONG]: [{ name: 'Main Dojo', capacity: 35 }],
  'ASK Headquarters Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Marine Parade Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Rivervale Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Tampines West Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Thomson Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Bukit Timah Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'SMU Dojo': [{ name: 'Main Dojo', capacity: 30 }],
  'Siglap South Dojo': [{ name: 'Main Dojo', capacity: 30 }],
};

// availability: [weekday, startMinute, endMinute]
// unavailable: [date, reason]
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

const TERM = { name: 'Term 4 2026', start: '2026-10-05', end: '2026-12-20' };

// minutes from midnight; weekday 0 = Sunday
const CLASSES = [
  { centre: BISHAN, venue: 'Main Dojo', name: 'Beginners Aikido', weekday: 2, start: 1140, end: 1200, level: '6th Kyu', instructors: ['Tan Wei Ming'] },
  { centre: BISHAN, venue: 'Main Dojo', name: 'Intermediate Aikido', weekday: 4, start: 1170, end: 1260, level: '4th Kyu', instructors: ['Tan Wei Ming'] },
  { centre: BISHAN, venue: 'Studio 2', name: 'Kids Aikido', weekday: 6, start: 540, end: 600, level: '6th Kyu', instructors: ['Aiko Yamada'] },
  { centre: JURONG, venue: 'Main Dojo', name: 'Beginners Aikido', weekday: 2, start: 1140, end: 1200, level: '6th Kyu', instructors: ['Rahim Abdullah'] },
  { centre: JURONG, venue: 'Main Dojo', name: 'Weekend Aikido', weekday: 6, start: 600, end: 690, level: '3rd Kyu', instructors: ['Rahim Abdullah'] },
];

const STUDENTS = [
  { first: 'Alice', last: 'Tan', email: 'alice.tan@example.com', centre: BISHAN, rank: '5th Kyu', phone: '+65 9123 4001', dob: '2012-04-18', guardian: 'Tan Mei Ling', guardianPhone: '+65 9123 4100' },
  { first: 'Benjamin', last: 'Lim', email: 'ben.lim@example.com', centre: BISHAN, rank: '4th Kyu', phone: '+65 9123 4002', dob: '1995-07-02' },
  { first: 'Chloe', last: 'Ng', email: 'chloe.ng@example.com', centre: BISHAN, rank: '6th Kyu', phone: '+65 9123 4003', dob: '2001-11-30' },
  { first: 'Daniel', last: 'Ong', email: 'daniel.ong@example.com', centre: JURONG, rank: '3rd Kyu', phone: '+65 9123 4004', dob: '1988-03-14' },
  { first: 'Eliza', last: 'Koh', email: 'eliza.koh@example.com', centre: JURONG, rank: '9th Kyu', phone: null, dob: '2015-09-09', guardian: 'Koh Hwee Ling', guardianPhone: '+65 9123 4200' },
  { first: 'Farid', last: 'Ismail', email: 'farid.ismail@example.com', centre: JURONG, rank: '2nd Kyu', phone: '+65 9123 4005', dob: '1992-01-21' },
];

const TUITION = {
  name: 'Term 4 2026 Tuition',
  description: 'Term fee, 12 weeks of classes',
  amountCents: 18000,
  dueDate: '2026-10-15',
};

// Demo payments. invoiceStatus mirrors the payment total against the invoice amount.
const PAYMENTS = [
  { email: 'alice.tan@example.com', amountCents: 18000, channel: 'BANK_TRANSFER', reference: 'FAST-88312', paidAt: '2026-10-03T09:15:00+08:00', invoiceStatus: 'PAID', invoicePaidAt: '2026-10-03T09:15:00+08:00' },
  { email: 'ben.lim@example.com', amountCents: 10000, channel: 'CASH', reference: null, paidAt: '2026-10-10T19:30:00+08:00', invoiceStatus: 'PARTIALLY_PAID', invoicePaidAt: null },
];

const GRADINGS = [
  {
    centre: BISHAN,
    title: 'Mass Grading - Bishan (Dec 2026)',
    venue: 'Main Dojo',
    starts: '2026-12-06T10:00:00+08:00',
    ends: '2026-12-06T13:00:00+08:00',
    ranksTested: ['6th Kyu', '5th Kyu'],
    examiners: ['Tan Wei Ming'],
    candidates: ['alice.tan@example.com', 'chloe.ng@example.com'],
  },
  {
    centre: JURONG,
    title: 'Mass Grading - Jurong (Dec 2026)',
    venue: 'Main Dojo',
    starts: '2026-12-13T10:00:00+08:00',
    ends: '2026-12-13T13:00:00+08:00',
    ranksTested: ['2nd Kyu'],
    examiners: ['Rahim Abdullah'],
    candidates: ['farid.ismail@example.com'],
  },
];

async function findOrInsert(client, selectSql, selectParams, insertSql, insertParams) {
  const found = await client.query(selectSql, selectParams);
  if (found.rows.length) return found.rows[0].id;
  const created = await client.query(insertSql, insertParams);
  return created.rows[0].id;
}

function datesOnWeekday(startStr, endStr, weekday) {
  const dates = [];
  const end = Date.parse(`${endStr}T00:00:00Z`);
  for (let t = Date.parse(`${startStr}T00:00:00Z`); t <= end; t += DAY_MS) {
    const d = new Date(t);
    if (d.getUTCDay() === weekday) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function sessionTimestamp(dateStr, minute) {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${dateStr}T${hh}:${mm}:00${TZ}`;
}

async function seedSampleData(client) {
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

  const centreId = {};
  for (const c of CENTRES) {
    const { rows } = await client.query(
      `INSERT INTO centres (name, address, email, phone) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET address = EXCLUDED.address, email = EXCLUDED.email, phone = EXCLUDED.phone
       RETURNING id`,
      [c.name, c.address, c.email, c.phone]
    );
    centreId[c.name] = rows[0].id;
  }

  const venueId = {};
  for (const [centreName, venues] of Object.entries(VENUES)) {
    for (const v of venues) {
      const { rows } = await client.query(
        `INSERT INTO venues (centre_id, name, capacity) VALUES ($1, $2, $3)
         ON CONFLICT (centre_id, name) DO UPDATE SET capacity = EXCLUDED.capacity
         RETURNING id`,
        [centreId[centreName], v.name, v.capacity]
      );
      venueId[`${centreName}|${v.name}`] = rows[0].id;
    }
  }

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
    const { rows: hasAvailability } = await client.query(
      'SELECT 1 FROM instructor_availability WHERE instructor_id = $1 LIMIT 1', [instructorId[i.name]]
    );
    if (!hasAvailability.length) {
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

  const termId = {};
  for (const c of CENTRES) {
    termId[c.name] = await findOrInsert(
      client,
      'SELECT id FROM terms WHERE centre_id = $1 AND name = $2', [centreId[c.name], TERM.name],
      `INSERT INTO terms (centre_id, name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id`,
      [centreId[c.name], TERM.name, TERM.start, TERM.end]
    );
  }

  const now = new Date();
  for (const cls of CLASSES) {
    const templateId = await findOrInsert(
      client,
      'SELECT id FROM class_templates WHERE term_id = $1 AND name = $2 AND weekday = $3',
      [termId[cls.centre], cls.name, cls.weekday],
      `INSERT INTO class_templates (term_id, venue_id, level_rank_id, name, weekday, start_minute, end_minute)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [termId[cls.centre], venueId[`${cls.centre}|${cls.venue}`], rankId[cls.level], cls.name, cls.weekday, cls.start, cls.end]
    );
    for (const name of cls.instructors) {
      await client.query(
        'INSERT INTO class_template_instructors (template_id, instructor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [templateId, instructorId[name]]
      );
    }

    for (const dateStr of datesOnWeekday(TERM.start, TERM.end, cls.weekday)) {
      const startsAt = sessionTimestamp(dateStr, cls.start);
      const endsAt = sessionTimestamp(dateStr, cls.end);
      const status = new Date(endsAt) < now ? 'COMPLETED' : 'SCHEDULED';
      await client.query(
        `INSERT INTO class_sessions (template_id, venue_id, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (template_id, starts_at) DO NOTHING`,
        [templateId, venueId[`${cls.centre}|${cls.venue}`], startsAt, endsAt, status]
      );
      const { rows } = await client.query(
        'SELECT id FROM class_sessions WHERE template_id = $1 AND starts_at = $2', [templateId, startsAt]
      );
      await client.query(
        `INSERT INTO class_session_instructors (session_id, instructor_id)
         SELECT $1::uuid, instructor_id FROM class_template_instructors WHERE template_id = $2::uuid
         ON CONFLICT DO NOTHING`,
        [rows[0].id, templateId]
      );
    }
  }

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
      [centreId[s.centre], rankId[s.rank], s.first, s.last, s.email, s.phone,
       s.dob, s.guardian || null, s.guardianPhone || null]
    );
    studentId[s.email] = rows[0].id;
  }

  const feeId = {};
  for (const c of CENTRES) {
    feeId[c.name] = await findOrInsert(
      client,
      'SELECT id FROM fee_items WHERE centre_id = $1 AND term_id = $2 AND name = $3',
      [centreId[c.name], termId[c.name], TUITION.name],
      `INSERT INTO fee_items (centre_id, term_id, name, description, amount_cents, due_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [centreId[c.name], termId[c.name], TUITION.name, TUITION.description, TUITION.amountCents, TUITION.dueDate]
    );
  }

  const invoiceId = {};
  for (const s of STUDENTS) {
    invoiceId[s.email] = await findOrInsert(
      client,
      'SELECT id FROM invoices WHERE student_id = $1 AND fee_item_id = $2',
      [studentId[s.email], feeId[s.centre]],
      `INSERT INTO invoices (student_id, fee_item_id, description, amount_cents, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [studentId[s.email], feeId[s.centre], TUITION.name, TUITION.amountCents, TUITION.dueDate]
    );
  }

  for (const p of PAYMENTS) {
    const invId = invoiceId[p.email];
    const { rows: existing } = await client.query('SELECT 1 FROM payments WHERE invoice_id = $1 LIMIT 1', [invId]);
    if (existing.length) continue;
    await client.query(
      `INSERT INTO payments (invoice_id, amount_cents, channel, status, paid_at, reference)
       VALUES ($1, $2, $3, 'COMPLETED', $4, $5)`,
      [invId, p.amountCents, p.channel, p.paidAt, p.reference]
    );
    await client.query(
      'UPDATE invoices SET status = $2, paid_at = $3 WHERE id = $1',
      [invId, p.invoiceStatus, p.invoicePaidAt]
    );
  }

  for (const g of GRADINGS) {
    const gradingId = await findOrInsert(
      client,
      'SELECT id FROM grading_sessions WHERE centre_id = $1 AND title = $2', [centreId[g.centre], g.title],
      `INSERT INTO grading_sessions (centre_id, venue_id, type, title, starts_at, ends_at)
       VALUES ($1, $2, 'MASS', $3, $4, $5) RETURNING id`,
      [centreId[g.centre], venueId[`${g.centre}|${g.venue}`], g.title, g.starts, g.ends]
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
