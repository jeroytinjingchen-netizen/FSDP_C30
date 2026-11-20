// scripts/seed.js - demo data for a freshly reset database. Run: npm run seed
// Every insert is idempotent, so the seed can run more than once without duplicating rows.
// It expects the schema from FullStackDatabase.sql (or `npm run migrate`) to exist.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../dbConfig');

const ADMIN = { email: 'admin@as.com', password: 'Admin@12345' };
const SECOND_ADMIN = { email: 'sensei@as.com', password: 'Admin@12345' };
const STUDENT_PASSWORD = 'Student@12345';
const DEMO_STUDENT = { email: 'student@gmail.com', password: 'Student@12345' };

const BISHAN = 'Shinjukai Bishan Centre';
const JURONG = 'Shinjukai Jurong Centre';
const HQ = 'ASK Headquarters Dojo';

// Children's grades (Blue-Silver, Brown-Silver, Black-Silver) and Junior Dan are included.
// rank_order is unique, so the seed moves the current orders out of the way before upserting.
const RANKS = [
  { name: '12th Kyu',     order: 1,  colour: 'Red' },
  { name: '11th Kyu',     order: 2,  colour: 'Red-Gold' },
  { name: '10th Kyu',     order: 3,  colour: 'Yellow' },
  { name: '9th Kyu',      order: 4,  colour: 'Orange' },
  { name: '8th Kyu',      order: 5,  colour: 'Green' },
  { name: '7th Kyu',      order: 6,  colour: 'Purple' },
  { name: '6th Kyu',      order: 7,  colour: 'Blue' },
  { name: 'Blue-Silver',  order: 8,  colour: 'Blue-Silver' },
  { name: '5th Kyu',      order: 9,  colour: 'Blue-Gold' },
  { name: '4th Kyu',      order: 10, colour: 'Brown' },
  { name: 'Brown-Silver', order: 11, colour: 'Brown-Silver' },
  { name: '3rd Kyu',      order: 12, colour: 'Brown-Gold' },
  { name: '2nd Kyu',      order: 13, colour: 'Black' },
  { name: 'Black-Silver', order: 14, colour: 'Black-Silver' },
  { name: '1st Kyu',      order: 15, colour: 'Black-Gold' },
  { name: 'Junior Dan',   order: 16, colour: 'Black' },
  { name: '1st Dan',      order: 17, colour: 'Black' },
  { name: '2nd Dan',      order: 18, colour: 'Black' },
  { name: '3rd Dan',      order: 19, colour: 'Black' },
  { name: '4th Dan',      order: 20, colour: 'Black' },
  { name: '5th Dan',      order: 21, colour: 'Black' },
  { name: '6th Dan',      order: 22, colour: 'Black' },
  { name: '7th Dan',      order: 23, colour: 'Black' },
];

const CENTRES = [
  { name: BISHAN,          address: '1 Bishan Street 10, Singapore',                              email: 'bishan@aikidoshinjukai.com',   phone: '+65 6000 1001' },
  { name: JURONG,          address: '2 Jurong East Street 21, Singapore',                          email: 'jurong@aikidoshinjukai.com',   phone: '+65 6000 1002' },
  { name: HQ,              address: 'Thomson V One, 9 Sin Ming Road, #B1-02, Singapore 575630',    email: 'hq@aikidoshinjukai.com',       phone: '+65 6000 1003' },
  { name: 'Marine Parade Dojo',  address: '278 Marine Parade Road, Singapore 449282',             email: 'marineparade@aikidoshinjukai.com', phone: '+65 6000 1004' },
  { name: 'Rivervale Dojo',      address: '2 Rivervale Close, Singapore 544583',                  email: 'rivervale@aikidoshinjukai.com',    phone: '+65 6000 1005' },
  { name: 'Tampines West Dojo',  address: '5 Tampines Avenue 3, Singapore 529705',                email: 'tampines@aikidoshinjukai.com',     phone: '+65 6000 1006' },
  { name: 'Thomson Dojo',        address: '194 Upper Thomson Road, Singapore 574339',             email: 'thomson@aikidoshinjukai.com',      phone: '+65 6000 1007' },
  { name: 'Bukit Timah Dojo',    address: '20 Toh Yi Drive, Singapore 596569',                    email: 'bukittimah@aikidoshinjukai.com',   phone: '+65 6000 1008' },
  { name: 'SMU Dojo',            address: '81 Victoria Street, Singapore 188065',                 email: 'smu@aikidoshinjukai.com',          phone: '+65 6000 1009' },
  { name: 'Siglap South Dojo',   address: '6 Palm Road, Singapore 456441',                        email: 'siglap@aikidoshinjukai.com',       phone: '+65 6000 1010' },
  { name: 'Bedok Dojo',          address: '11 Bedok North Avenue 2, Singapore 469662',             email: 'bedok@aikidoshinjukai.com',        phone: '+65 6000 1011' },
  { name: 'Clementi Dojo',       address: '321 Clementi Avenue 3, Singapore 129905',              email: 'clementi@aikidoshinjukai.com',     phone: '+65 6000 1012' },
];

// availability: [weekday, startMinute, endMinute]   weekday 0 = Monday ... 6 = Sunday
// unavailable:  [date, reason]
const INSTRUCTORS = [
  {
    name: 'Tan Wei Ming', email: 'tan.weiming@aikidoshinjukai.com', phone: '+65 9100 2001',
    rank: '3rd Dan', qualifications: 'Senior instructor, 20 years of practice',
    centres: [BISHAN, JURONG],
    availability: [[0, 1140, 1290], [2, 1140, 1290], [4, 1140, 1290], [6, 540, 720]],
    unavailable: [['2026-12-08', 'Overseas seminar']],
  },
  {
    name: 'Aiko Yamada', email: 'aiko.yamada@aikidoshinjukai.com', phone: '+65 9100 2002',
    rank: '2nd Dan', qualifications: 'Certified Aikido instructor, children and beginners',
    centres: [BISHAN],
    availability: [[2, 1020, 1140], [6, 510, 660]],
    unavailable: [],
  },
  {
    name: 'Rahim Abdullah', email: 'rahim.abdullah@aikidoshinjukai.com', phone: '+65 9100 2003',
    rank: '2nd Dan', qualifications: 'Assistant instructor',
    centres: [JURONG],
    availability: [[2, 1140, 1260], [4, 1140, 1260], [6, 600, 720]],
    unavailable: [],
  },
  {
    name: 'Kenji Sato', email: 'kenji.sato@aikidoshinjukai.com', phone: '+65 9100 2004',
    rank: '5th Dan', qualifications: 'Head instructor, ASK Headquarters',
    centres: [HQ],
    availability: [[1, 1140, 1260], [3, 1140, 1260], [5, 600, 720]],
    unavailable: [],
  },
  {
    name: 'Siti Aminah', email: 'siti.aminah@aikidoshinjukai.com', phone: '+65 9100 2005',
    rank: '2nd Dan', qualifications: 'Instructor, beginners and teens',
    centres: ['Marine Parade Dojo', 'Rivervale Dojo'],
    availability: [[2, 1080, 1200], [3, 1080, 1200], [5, 1080, 1200]],
    unavailable: [],
  },
  {
    name: 'Lucas Wong', email: 'lucas.wong@aikidoshinjukai.com', phone: '+65 9100 2006',
    rank: '1st Dan', qualifications: 'Assistant instructor, weekend classes',
    centres: ['Tampines West Dojo'],
    availability: [[4, 1140, 1260], [6, 600, 780]],
    unavailable: [],
  },
  {
    name: 'Priya Nair', email: 'priya.nair@aikidoshinjukai.com', phone: '+65 9100 2007',
    rank: '2nd Dan', qualifications: 'Instructor, adult classes',
    centres: ['Thomson Dojo', 'Bukit Timah Dojo'],
    availability: [[2, 1140, 1260], [3, 1140, 1260], [6, 540, 660]],
    unavailable: [],
  },
  {
    name: 'Marcus Chua', email: 'marcus.chua@aikidoshinjukai.com', phone: '+65 9100 2008',
    rank: '1st Dan', qualifications: 'Assistant instructor, university club',
    centres: ['SMU Dojo'],
    availability: [[1, 1140, 1230], [4, 1140, 1230]],
    unavailable: [],
  },
  {
    name: 'Hannah Lee', email: 'hannah.lee@aikidoshinjukai.com', phone: '+65 9100 2009',
    rank: '1st Dan', qualifications: 'Instructor, children and beginners',
    centres: ['Siglap South Dojo'],
    availability: [[2, 1140, 1260], [6, 540, 660]],
    unavailable: [],
  },
  {
    name: 'Daniel Teo', email: 'daniel.teo@aikidoshinjukai.com', phone: '+65 9100 2010',
    rank: '2nd Dan', qualifications: 'Instructor, adult and weapons classes',
    centres: ['Bedok Dojo'],
    availability: [[0, 1170, 1290], [3, 1170, 1290]],
    unavailable: [],
  },
  {
    name: 'Nurul Huda', email: 'nurul.huda@aikidoshinjukai.com', phone: '+65 9100 2011',
    rank: '1st Kyu', qualifications: 'Assistant instructor, beginners',
    centres: ['Clementi Dojo'],
    availability: [[1, 1140, 1260], [5, 1140, 1260]],
    unavailable: [],
  },
  {
    name: 'Wei Sheng Lim', email: 'weisheng.lim@aikidoshinjukai.com', phone: '+65 9100 2012',
    rank: '4th Dan', qualifications: 'Technical advisor, grading panel',
    centres: [HQ, BISHAN],
    availability: [[5, 1140, 1260], [6, 480, 660]],
    unavailable: [['2026-12-20', 'Family leave']],
  },
];

// All classes are 60 minutes. weekday 0 = Monday ... 6 = Sunday. start/end are minutes from midnight.
const CLASSES = [
  { centre: BISHAN,              name: 'Beginners Aikido',    weekday: 2, start: 1140, end: 1200, instructor: 'Tan Wei Ming' },
  { centre: BISHAN,              name: 'Intermediate Aikido', weekday: 4, start: 1170, end: 1230, instructor: 'Tan Wei Ming' },
  { centre: BISHAN,              name: 'Kids Aikido',         weekday: 6, start:  540, end:  600, instructor: 'Aiko Yamada' },
  { centre: JURONG,              name: 'Beginners Aikido',    weekday: 2, start: 1140, end: 1200, instructor: 'Rahim Abdullah' },
  { centre: JURONG,              name: 'Weekend Aikido',      weekday: 6, start:  600, end:  660, instructor: 'Rahim Abdullah' },
  { centre: HQ,                  name: 'Adult Aikido',        weekday: 5, start:  600, end:  660, instructor: 'Kenji Sato' },
  { centre: HQ,                  name: 'Advanced Aikido',     weekday: 1, start: 1140, end: 1200, instructor: 'Kenji Sato' },
  { centre: 'Marine Parade Dojo', name: 'Beginners Aikido',   weekday: 5, start:  600, end:  660, instructor: 'Siti Aminah' },
  { centre: 'Marine Parade Dojo', name: 'Ladies Aikido',      weekday: 2, start: 1080, end: 1140, instructor: 'Siti Aminah' },
  { centre: 'Rivervale Dojo',    name: 'Teens Aikido',        weekday: 3, start: 1080, end: 1140, instructor: 'Siti Aminah' },
  { centre: 'Rivervale Dojo',    name: 'Beginners Aikido',    weekday: 5, start: 1080, end: 1140, instructor: 'Siti Aminah' },
  { centre: 'Tampines West Dojo', name: 'Beginners Aikido',   weekday: 5, start:  840, end:  900, instructor: 'Lucas Wong' },
  { centre: 'Tampines West Dojo', name: 'Kids Aikido',        weekday: 6, start:  600, end:  660, instructor: 'Lucas Wong' },
  { centre: 'Thomson Dojo',      name: 'Adult Aikido',        weekday: 4, start: 1170, end: 1230, instructor: 'Priya Nair' },
  { centre: 'Thomson Dojo',      name: 'Beginners Aikido',    weekday: 2, start: 1140, end: 1200, instructor: 'Priya Nair' },
  { centre: 'Bukit Timah Dojo',  name: 'Adult Aikido',        weekday: 2, start: 1140, end: 1200, instructor: 'Priya Nair' },
  { centre: 'Bukit Timah Dojo',  name: 'Weekend Aikido',      weekday: 6, start:  600, end:  660, instructor: 'Priya Nair' },
  { centre: 'SMU Dojo',          name: 'University Aikido',   weekday: 1, start: 1140, end: 1200, instructor: 'Marcus Chua' },
  { centre: 'SMU Dojo',          name: 'Open Mat',            weekday: 4, start: 1140, end: 1200, instructor: 'Marcus Chua' },
  { centre: 'Siglap South Dojo', name: 'Kids Aikido',         weekday: 6, start:  540, end:  600, instructor: 'Hannah Lee' },
  { centre: 'Siglap South Dojo', name: 'Beginners Aikido',    weekday: 2, start: 1140, end: 1200, instructor: 'Hannah Lee' },
  { centre: 'Bedok Dojo',        name: 'Beginners Aikido',    weekday: 0, start: 1170, end: 1230, instructor: 'Daniel Teo' },
  { centre: 'Bedok Dojo',        name: 'Weapons Class',       weekday: 3, start: 1170, end: 1230, instructor: 'Daniel Teo' },
  { centre: 'Clementi Dojo',     name: 'Beginners Aikido',    weekday: 1, start: 1140, end: 1200, instructor: 'Nurul Huda' },
  { centre: 'Clementi Dojo',     name: 'Adult Aikido',        weekday: 5, start: 1140, end: 1200, instructor: 'Nurul Huda' },
];

// Students are listed in seed order; every student also gets a paid package.
const STUDENTS = [
  { first: 'Demo',     last: 'Student',  email: DEMO_STUDENT.email,       centre: BISHAN, rank: '5th Kyu',   phone: '+65 9000 0000', dob: '1998-06-12', portal: true },
  { first: 'Alice',    last: 'Tan',      email: 'alice.tan@example.com',    centre: BISHAN, rank: '5th Kyu',   phone: '+65 9123 4001', dob: '2012-04-18', guardian: 'Tan Mei Ling',    guardianPhone: '+65 9123 4100', portal: true },
  { first: 'Benjamin', last: 'Lim',      email: 'ben.lim@example.com',      centre: BISHAN, rank: '4th Kyu',   phone: '+65 9123 4002', dob: '1995-07-02', portal: true },
  { first: 'Chloe',    last: 'Ng',       email: 'chloe.ng@example.com',     centre: BISHAN, rank: '6th Kyu',   phone: '+65 9123 4003', dob: '2001-11-30', portal: true },
  { first: 'Daniel',   last: 'Ong',      email: 'daniel.ong@example.com',   centre: JURONG, rank: '3rd Kyu',   phone: '+65 9123 4004', dob: '1988-03-14', portal: true },
  { first: 'Eliza',    last: 'Koh',      email: 'eliza.koh@example.com',    centre: JURONG, rank: '9th Kyu',   phone: null,            dob: '2015-09-09', guardian: 'Koh Hwee Ling',   guardianPhone: '+65 9123 4200', portal: true },
  { first: 'Farid',    last: 'Ismail',   email: 'farid.ismail@example.com', centre: JURONG, rank: '2nd Kyu',   phone: '+65 9123 4005', dob: '1992-01-21', portal: true },
  { first: 'Grace',    last: 'Wong',     email: 'grace.wong@example.com',   centre: BISHAN, rank: '7th Kyu',   phone: '+65 9123 4006', dob: '1999-05-12', portal: true },
  { first: 'Harris',   last: 'Lee',      email: 'harris.lee@example.com',   centre: BISHAN, rank: '8th Kyu',   phone: '+65 9123 4007', dob: '2010-02-28', guardian: 'Lee Chin Ho',     guardianPhone: '+65 9123 4101', portal: true },
  { first: 'Iris',     last: 'Chan',     email: 'iris.chan@example.com',    centre: JURONG, rank: '10th Kyu',  phone: '+65 9123 4008', dob: '2013-06-15', guardian: 'Chan Wing Seng',  guardianPhone: '+65 9123 4201', portal: true },
  { first: 'Jared',    last: 'Tan',      email: 'jared.tan@example.com',    centre: BISHAN, rank: '3rd Kyu',   phone: '+65 9123 4009', dob: '1993-09-20', portal: true },
  { first: 'Kelly',    last: 'Goh',      email: 'kelly.goh@example.com',    centre: 'Marine Parade Dojo', rank: '6th Kyu', phone: '+65 9123 4010', dob: '1998-12-03', portal: true },
  { first: 'Liam',     last: 'Sim',      email: 'liam.sim@example.com',     centre: 'Marine Parade Dojo', rank: '5th Kyu', phone: '+65 9123 4011', dob: '2005-08-17', guardian: 'Sim Kah Ming', guardianPhone: '+65 9123 4102' },
  { first: 'Maya',     last: 'Rahman',   email: 'maya.rahman@example.com',  centre: 'Rivervale Dojo',     rank: '7th Kyu', phone: '+65 9123 4012', dob: '1996-11-22' },
  { first: 'Noah',     last: 'Chia',     email: 'noah.chia@example.com',    centre: 'Rivervale Dojo',     rank: '4th Kyu', phone: '+65 9123 4013', dob: '2008-04-05', guardian: 'Chia Boon Keng', guardianPhone: '+65 9123 4103' },
  { first: 'Olivia',   last: 'Phua',     email: 'olivia.phua@example.com',  centre: 'Tampines West Dojo', rank: '8th Kyu', phone: '+65 9123 4014', dob: '2002-10-11' },
  { first: 'Prakash',  last: 'Naidu',    email: 'prakash.naidu@example.com',centre: 'Tampines West Dojo', rank: '6th Kyu', phone: '+65 9123 4015', dob: '1994-03-19' },
  { first: 'Quinn',    last: 'Yeo',      email: 'quinn.yeo@example.com',    centre: 'Thomson Dojo',       rank: '5th Kyu', phone: '+65 9123 4016', dob: '2007-01-14', guardian: 'Yeo Lai Heng', guardianPhone: '+65 9123 4104' },
  { first: 'Ryan',     last: 'Koh',      email: 'ryan.koh@example.com',     centre: 'Thomson Dojo',       rank: '2nd Kyu', phone: '+65 9123 4017', dob: '1990-07-08' },
  { first: 'Sara',     last: 'Lim',      email: 'sara.lim@example.com',     centre: 'Bukit Timah Dojo',   rank: '9th Kyu', phone: '+65 9123 4018', dob: '2011-05-23', guardian: 'Lim Swee Kim', guardianPhone: '+65 9123 4105' },
  { first: 'Tariq',    last: 'Aziz',     email: 'tariq.aziz@example.com',   centre: 'Bukit Timah Dojo',   rank: '3rd Kyu', phone: '+65 9123 4019', dob: '1987-02-27' },
  { first: 'Uma',      last: 'Krish',    email: 'uma.krish@example.com',    centre: 'SMU Dojo',           rank: '7th Kyu', phone: '+65 9123 4020', dob: '2003-09-30' },
  { first: 'Victor',   last: 'Loke',     email: 'victor.loke@example.com',  centre: 'SMU Dojo',           rank: '1st Kyu', phone: '+65 9123 4021', dob: '1991-12-08' },
  { first: 'Wendy',    last: 'Chong',    email: 'wendy.chong@example.com',  centre: 'Siglap South Dojo',  rank: '6th Kyu', phone: '+65 9123 4022', dob: '2004-06-19' },
  { first: 'Xavier',   last: 'Tan',      email: 'xavier.tan@example.com',   centre: 'Siglap South Dojo',  rank: '4th Kyu', phone: '+65 9123 4023', dob: '1997-08-14' },
  { first: 'Yuki',     last: 'Tanaka',   email: 'yuki.tanaka@example.com',  centre: HQ,                   rank: '1st Dan', phone: '+65 9123 4024', dob: '1985-10-01' },
  { first: 'Zara',     last: 'Hussein',  email: 'zara.hussein@example.com', centre: HQ,                   rank: '2nd Dan', phone: '+65 9123 4025', dob: '1983-04-25' },
  { first: 'Ahmad',    last: 'Rizal',    email: 'ahmad.rizal@example.com',  centre: HQ,                   rank: '4th Kyu', phone: '+65 9123 4026', dob: '1994-05-09' },
  { first: 'Bella',    last: 'Fong',     email: 'bella.fong@example.com',   centre: 'Bedok Dojo',         rank: '10th Kyu',phone: '+65 9123 4027', dob: '2014-08-21', guardian: 'Fong Wei Lun', guardianPhone: '+65 9123 4106' },
  { first: 'Cheng',    last: 'Hao',      email: 'cheng.hao@example.com',    centre: 'Bedok Dojo',         rank: '7th Kyu', phone: '+65 9123 4028', dob: '2000-02-16' },
  { first: 'Divya',    last: 'Menon',    email: 'divya.menon@example.com',  centre: 'Clementi Dojo',      rank: '8th Kyu', phone: '+65 9123 4029', dob: '2006-07-04' },
  { first: 'Ethan',    last: 'Yap',      email: 'ethan.yap@example.com',    centre: 'Clementi Dojo',      rank: '6th Kyu', phone: '+65 9123 4030', dob: '1999-03-11' },
  { first: 'Faith',    last: 'Goh',      email: 'faith.goh@example.com',    centre: 'Bedok Dojo',         rank: '9th Kyu', phone: '+65 9123 4031', dob: '2013-12-02', guardian: 'Goh Beng Huat', guardianPhone: '+65 9123 4107' },
];

const PACKAGES = [
  { name: 'Trial Class',           sessions: 1,  weeks: 2,  price: 2500 },
  { name: '5-Session Pack',        sessions: 5,  weeks: 6,  price: 9000 },
  { name: 'Junior 10-Session Pack', sessions: 10, weeks: 11, price: 13000 },
  { name: '10-Session Pack',       sessions: 10, weeks: 11, price: 16000 },
  { name: '20-Session Pack',       sessions: 20, weeks: 22, price: 30000 },
  { name: '40-Session Pack',       sessions: 40, weeks: 44, price: 56000 },
];

// Past sessions (status COMPLETED) come first, then upcoming ones (status SCHEDULED).
const GRADINGS = [
  { title: 'Mass Grading - HQ (Aug 2026)',           starts: '2026-08-16T10:00:00+08:00', ends: '2026-08-16T13:00:00+08:00', ranks: ['6th Kyu', '5th Kyu', '4th Kyu'], examiners: ['Kenji Sato', 'Tan Wei Ming'] },
  { title: 'Mass Grading - HQ (Sep 2026)',           starts: '2026-09-20T10:00:00+08:00', ends: '2026-09-20T13:00:00+08:00', ranks: ['9th Kyu', '8th Kyu', '7th Kyu'], examiners: ['Wei Sheng Lim', 'Aiko Yamada'] },
  { title: 'Mass Grading - HQ (Oct 2026)',           starts: '2026-10-18T10:00:00+08:00', ends: '2026-10-18T13:00:00+08:00', ranks: ['3rd Kyu', '2nd Kyu'], examiners: ['Kenji Sato'] },
  { title: 'Dan Grading - HQ (Oct 2026)',            starts: '2026-10-25T09:00:00+08:00', ends: '2026-10-25T12:00:00+08:00', ranks: ['1st Dan', '2nd Dan'], examiners: ['Kenji Sato', 'Wei Sheng Lim'] },
  { title: 'Mass Grading - HQ (Nov 2026)',           starts: '2026-11-15T10:00:00+08:00', ends: '2026-11-15T13:00:00+08:00', ranks: ['6th Kyu', '5th Kyu', '4th Kyu'], examiners: ['Tan Wei Ming', 'Priya Nair'] },
  { title: 'Mass Grading - HQ (Dec 2026)',           starts: '2026-12-13T10:00:00+08:00', ends: '2026-12-13T13:00:00+08:00', ranks: ['6th Kyu', '5th Kyu', '4th Kyu', '3rd Kyu'], examiners: ['Tan Wei Ming', 'Aiko Yamada'] },
  { title: 'Kids Grading - HQ (Dec 2026)',           starts: '2026-12-20T09:00:00+08:00', ends: '2026-12-20T11:00:00+08:00', ranks: ['10th Kyu', '9th Kyu', '8th Kyu'], examiners: ['Aiko Yamada', 'Hannah Lee'] },
  { title: 'Mass Grading - HQ (Jan 2027)',           starts: '2027-01-17T10:00:00+08:00', ends: '2027-01-17T13:00:00+08:00', ranks: ['5th Kyu', '3rd Kyu', '2nd Kyu'], examiners: ['Kenji Sato', 'Rahim Abdullah'] },
  { title: 'Dan Grading - HQ (Jan 2027)',            starts: '2027-01-24T09:00:00+08:00', ends: '2027-01-24T12:00:00+08:00', ranks: ['1st Dan', '2nd Dan', '3rd Dan'], examiners: ['Kenji Sato'] },
  { title: 'Mass Grading - HQ (Feb 2027)',           starts: '2027-02-14T10:00:00+08:00', ends: '2027-02-14T13:00:00+08:00', ranks: ['7th Kyu', '6th Kyu', '5th Kyu'], examiners: ['Priya Nair', 'Siti Aminah'] },
  { title: 'Mass Grading - HQ (Mar 2027)',           starts: '2027-03-14T10:00:00+08:00', ends: '2027-03-14T13:00:00+08:00', ranks: ['8th Kyu', '7th Kyu', '4th Kyu'], examiners: ['Daniel Teo', 'Marcus Chua'] },
  { title: 'Mass Grading - HQ (Apr 2027)',           starts: '2027-04-11T10:00:00+08:00', ends: '2027-04-11T13:00:00+08:00', ranks: ['6th Kyu', '5th Kyu', '2nd Kyu'], examiners: ['Lucas Wong', 'Nurul Huda'] },
];

// Payment channels are rotated so the Payments page shows a mix.
const CHANNELS = ['STRIPE', 'CASH', 'BANK_TRANSFER', 'WHATSAPP', 'EMAIL', 'STRIPE'];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function upsertUser(client, { email, password }, role) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true, updated_at = now()
     RETURNING id`,
    [email, hash, role]
  );
  return rows[0].id;
}

async function findOrInsert(client, selectSql, selectParams, insertSql, insertParams) {
  const found = await client.query(selectSql, selectParams);
  if (found.rows.length) return found.rows[0].id;
  const created = await client.query(insertSql, insertParams);
  return created.rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---------------------------------------------------------------- Users
    const adminId = await upsertUser(client, ADMIN, 'ADMIN');
    const secondAdminId = await upsertUser(client, SECOND_ADMIN, 'ADMIN');
    const demoUserId = await upsertUser(client, DEMO_STUDENT, 'STUDENT');

    const portalUserIds = new Map([[DEMO_STUDENT.email, demoUserId]]);
    for (const s of STUDENTS) {
      if (!s.portal || s.email === DEMO_STUDENT.email) continue;
      portalUserIds.set(s.email, await upsertUser(client, { email: s.email, password: STUDENT_PASSWORD }, 'STUDENT'));
    }

    // ---------------------------------------------------------------- Ranks
    await client.query('UPDATE ranks SET rank_order = -1000 - rank_order WHERE rank_order > 0');
    const rankId = {};
    const rankOrder = [];
    for (const r of RANKS) {
      const { rows } = await client.query(
        `INSERT INTO ranks (name, rank_order, colour) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET rank_order = EXCLUDED.rank_order, colour = EXCLUDED.colour
         RETURNING id`,
        [r.name, r.order, r.colour]
      );
      rankId[r.name] = rows[0].id;
      rankOrder.push(rows[0].id);
    }

    const nextRankId = (name) => {
      const i = RANKS.findIndex((r) => r.name === name);
      return i >= 0 && i + 1 < rankOrder.length ? rankOrder[i + 1] : null;
    };

    // ---------------------------------------------------------------- Centres
    const centreId = {};
    for (const c of CENTRES) {
      const { rows } = await client.query(
        `INSERT INTO centres (name, address, email, phone) VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE
           SET address = EXCLUDED.address, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = now()
         RETURNING id`,
        [c.name, c.address, c.email || null, c.phone || null]
      );
      centreId[c.name] = rows[0].id;
    }

    // Gradings are held at HQ, so exactly one centre must be flagged.
    await client.query(
      `UPDATE centres SET is_hq = true
        WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM centres WHERE is_hq AND id <> $1)`,
      [centreId[HQ]]
    );

    // ---------------------------------------------------------------- Instructors
    const instructorId = {};
    for (const i of INSTRUCTORS) {
      instructorId[i.name] = await findOrInsert(
        client,
        'SELECT id FROM instructors WHERE name = $1', [i.name],
        `INSERT INTO instructors (name, email, phone, rank_id, qualifications)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [i.name, i.email, i.phone, rankId[i.rank], i.qualifications]
      );
      await client.query(
        `UPDATE instructors SET email = $2, phone = $3, rank_id = $4, qualifications = $5, is_active = true, updated_at = now()
          WHERE id = $1`,
        [instructorId[i.name], i.email, i.phone, rankId[i.rank], i.qualifications]
      );
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

    // ---------------------------------------------------------------- Classes
    for (const cls of CLASSES) {
      const templateId = await findOrInsert(
        client,
        'SELECT id FROM class_templates WHERE centre_id = $1 AND name = $2 AND weekday = $3',
        [centreId[cls.centre], cls.name, cls.weekday],
        `INSERT INTO class_templates (centre_id, instructor_id, name, weekday, start_minute, end_minute)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [centreId[cls.centre], instructorId[cls.instructor], cls.name, cls.weekday, cls.start, cls.end]
      );
      await client.query(
        `UPDATE class_templates SET instructor_id = $2, start_minute = $3, end_minute = $4 WHERE id = $1`,
        [templateId, instructorId[cls.instructor], cls.start, cls.end]
      );
      await client.query(
        'INSERT INTO class_template_instructors (template_id, instructor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [templateId, instructorId[cls.instructor]]
      );
    }

    // ---------------------------------------------------------------- Students
    const studentId = {};
    for (const s of STUDENTS) {
      const userId = portalUserIds.get(s.email) || null;
      const { rows } = await client.query(
        `INSERT INTO students (user_id, centre_id, current_rank_id, first_name, last_name, email, phone,
                               date_of_birth, guardian_name, guardian_phone, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (email) DO UPDATE SET
           user_id = COALESCE(EXCLUDED.user_id, students.user_id),
           centre_id = EXCLUDED.centre_id, current_rank_id = EXCLUDED.current_rank_id,
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone,
           date_of_birth = EXCLUDED.date_of_birth, guardian_name = EXCLUDED.guardian_name,
           guardian_phone = EXCLUDED.guardian_phone, is_active = true, updated_at = now()
         RETURNING id`,
        [userId, centreId[s.centre], rankId[s.rank], s.first, s.last, s.email, s.phone || null,
         s.dob, s.guardian || null, s.guardianPhone || null, '2026-01-15T00:00:00+08:00']
      );
      studentId[s.email] = rows[0].id;
    }

    // ---------------------------------------------------------------- Packages
    const packageId = {};
    for (const p of PACKAGES) {
      const { rows } = await client.query(
        `INSERT INTO packages (name, sessions_total, validity_weeks, price_cents, currency, is_active)
         VALUES ($1, $2, $3, $4, 'SGD', true)
         ON CONFLICT (name) DO UPDATE
           SET sessions_total = EXCLUDED.sessions_total, validity_weeks = EXCLUDED.validity_weeks,
               price_cents = EXCLUDED.price_cents, is_active = true
         RETURNING id`,
        [p.name, p.sessions, p.weeks, p.price]
      );
      packageId[p.name] = rows[0].id;
    }

    // ---------------------------------------------------------------- Payments + student packages
    // Every student buys one package. A separate failed payment on the first four students
    // also fills the Payments page, and it is package-backed like every other payment.
    const packageNames = ['5-Session Pack', '10-Session Pack', '20-Session Pack', 'Junior 10-Session Pack', '10-Session Pack'];
    const paidStudents = STUDENTS;
    const purchasedAtByEmail = new Map();
    const packageIdByEmail = new Map();

    for (let i = 0; i < paidStudents.length; i++) {
      const s = paidStudents[i];
      const sid = studentId[s.email];

      // Rerunning the seed must not duplicate a purchase, so skip a student who already has one.
      const { rows: existing } = await client.query(
        'SELECT 1 FROM student_packages WHERE student_id = $1 LIMIT 1', [sid]
      );
      const purchasedAt = new Date(Date.UTC(2026, 8, 1 + i * 3, 2, 0, 0));
      purchasedAtByEmail.set(s.email, purchasedAt);

      if (existing.length) {
        const { rows: pkg } = await client.query(
          'SELECT package_id FROM student_packages WHERE student_id = $1 ORDER BY purchased_at DESC LIMIT 1', [sid]
        );
        if (pkg.length) packageIdByEmail.set(s.email, pkg[0].package_id);
        continue;
      }

      const packageName = packageNames[i % packageNames.length];
      const pkg = PACKAGES.find((p) => p.name === packageName);
      const channel = CHANNELS[i % CHANNELS.length];
      const amount = pkg.price;
      const paidAt = purchasedAt.toISOString();
      const recordedBy = i % 3 === 0 ? secondAdminId : adminId;
      const expiresAt = addDays(purchasedAt, pkg.weeks * 7).toISOString();

      // A student who is only known from a failed payment already has a payment row. Replace it so the
      // reference is generated for the package actually bought; a failed row never owns a package.
      await client.query(
        `DELETE FROM payments WHERE student_id = $1 AND status = 'FAILED'`, [sid]
      );

      const { rows: payment } = await client.query(
        `INSERT INTO payments (amount_cents, channel, status, paid_at, notes, recorded_by_id, student_id, package_id, created_at)
         VALUES ($1, $2, 'COMPLETED', $3, $4, $5, $6, $7, $3)
         RETURNING id`,
        [amount, channel, paidAt, `Seeded ${pkg.name} payment`, recordedBy, sid, packageId[packageName]]
      );

      await client.query(
        `INSERT INTO student_packages (student_id, package_id, payment_id, name, sessions_total, purchased_at, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
         ON CONFLICT (payment_id) DO NOTHING`,
        [sid, packageId[packageName], payment[0].id, pkg.name, pkg.sessions, paidAt, expiresAt]
      );
      packageIdByEmail.set(s.email, packageId[packageName]);
    }

    // A few failed payments on students who already bought a package. A failed payment never
    // activates a package, but it still names the package the student tried to buy.
    const failedStudents = STUDENTS.slice(0, 4);
    for (let i = 0; i < failedStudents.length; i++) {
      const s = failedStudents[i];
      const sid = studentId[s.email];
      const { rows: existing } = await client.query(
        `SELECT 1 FROM payments WHERE student_id = $1 AND status = 'FAILED' LIMIT 1`, [sid]
      );
      if (existing.length) continue;
      await client.query(
        `INSERT INTO payments (amount_cents, channel, status, paid_at, notes, recorded_by_id, student_id, package_id, created_at)
         VALUES ($1, 'STRIPE', 'FAILED', $2, 'Card declined at checkout', $3, $4, $5, $2)`,
        [16000, new Date(Date.UTC(2026, 10, 2 + i, 3)).toISOString(), adminId, sid, packageId['10-Session Pack']]
      );
    }

    // ---------------------------------------------------------------- Attendance
    const ATTENDANCE_DAYS = [7, 14, 21, 28, 35, 42];
    for (let i = 0; i < paidStudents.length; i++) {
      const s = paidStudents[i];
      const sid = studentId[s.email];
      const purchasedAt = purchasedAtByEmail.get(s.email);
      if (!purchasedAt) continue;

      const { rows: pkgRows } = await client.query(
        'SELECT id FROM student_packages WHERE student_id = $1 ORDER BY purchased_at DESC LIMIT 1', [sid]
      );
      if (!pkgRows.length) continue;

      const sessions = [2, 3, 4, 5][i % 4];
      for (let n = 0; n < sessions; n++) {
        const attendedAt = addDays(purchasedAt, ATTENDANCE_DAYS[n]);
        if (attendedAt > new Date(Date.UTC(2026, 10, 18))) break;
        await client.query(
          `INSERT INTO attendance (student_id, student_package_id, attended_at, attended_on)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (student_id, attended_on) DO NOTHING`,
          [sid, pkgRows[0].id, attendedAt.toISOString(), isoDate(attendedAt)]
        );
      }
    }

    // ---------------------------------------------------------------- Grading sessions
    const now = new Date();
    for (let si = 0; si < GRADINGS.length; si++) {
      const g = GRADINGS[si];
      const isPast = new Date(g.starts) < now;

      const gradingId = await findOrInsert(
        client,
        'SELECT id FROM grading_sessions WHERE centre_id = $1 AND title = $2', [centreId[HQ], g.title],
        `INSERT INTO grading_sessions (centre_id, type, status, title, starts_at, ends_at, notes)
         VALUES ($1, 'MASS', $2, $3, $4, $5, $6) RETURNING id`,
        [centreId[HQ], isPast ? 'COMPLETED' : 'SCHEDULED', g.title, g.starts, g.ends, isPast ? 'Results recorded.' : null]
      );

      for (const r of g.ranks) {
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

      // 12 candidates per session, spread across centres so every centre filter returns results.
      const candidates = STUDENTS.filter((_, idx) => (idx + si) % 3 !== 0).slice(0, 12);
      const examinerName = g.examiners[si % g.examiners.length];

      for (let ci = 0; ci < candidates.length; ci++) {
        const s = candidates[ci];
        const gradedFor = nextRankId(s.rank) || rankId[s.rank];
        const outcome = isPast ? (ci % 6 === 0 ? 'NOT_GRADED' : 'GRADED') : null;
        // The target rank and examiner are part of the session plan, so every candidate has them
        // from the moment they are entered. Only the result itself waits for the session to happen.
        await client.query(
          `INSERT INTO grading_candidates
             (grading_session_id, student_id, from_rank_id, graded_for_rank_id, instructor_id,
              outcome, remarks, result_recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (grading_session_id, student_id) DO UPDATE
             SET graded_for_rank_id = COALESCE(grading_candidates.graded_for_rank_id, EXCLUDED.graded_for_rank_id),
                 instructor_id       = COALESCE(grading_candidates.instructor_id, EXCLUDED.instructor_id)`,
          [
            gradingId,
            studentId[s.email],
            rankId[s.rank],
            gradedFor,
            instructorId[examinerName],
            outcome,
            isPast ? (outcome === 'GRADED' ? 'Good technique, passed.' : 'Needs more practice on ukemi.') : null,
            isPast ? g.starts : null,
          ]
        );
      }
    }

    // ---------------------------------------------------------------- Rank history
    for (let i = 0; i < STUDENTS.length; i++) {
      const s = STUDENTS[i];
      const order = RANKS.findIndex((r) => r.name === s.rank);
      if (order < 4) continue;

      const fromRankId = rankOrder[order - 1];
      const sid = studentId[s.email];
      const promotedAt = new Date(Date.UTC(2026, 5 + (i % 5), 5 + (i % 20), 2, 0, 0)).toISOString();

      const { rows: existing } = await client.query(
        'SELECT 1 FROM promotion_history WHERE student_id = $1 AND from_rank_id = $2 AND to_rank_id = $3 LIMIT 1',
        [sid, fromRankId, rankId[s.rank]]
      );
      if (existing.length) continue;

      await client.query(
        `INSERT INTO promotion_history (student_id, candidate_id, from_rank_id, to_rank_id, promoted_at, changed_by_id, note)
         VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
        [sid, fromRankId, rankId[s.rank], promotedAt, adminId, 'Promotion recorded after grading.']
      );
    }

    // ---------------------------------------------------------------- Settings
    await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2), ($3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['reminderDaysBefore', JSON.stringify(3), 'overdueIntervalsDays', JSON.stringify([1, 7, 14])]
    );

    await client.query('COMMIT');

    const counts = await Promise.all([
      client.query('SELECT count(*)::int AS n FROM centres'),
      client.query('SELECT count(*)::int AS n FROM instructors'),
      client.query('SELECT count(*)::int AS n FROM students'),
      client.query('SELECT count(*)::int AS n FROM class_templates'),
      client.query('SELECT count(*)::int AS n FROM grading_sessions'),
      client.query('SELECT count(*)::int AS n FROM grading_candidates'),
      client.query('SELECT count(*)::int AS n FROM payments'),
      client.query('SELECT count(*)::int AS n FROM student_packages'),
      client.query('SELECT count(*)::int AS n FROM attendance'),
      client.query('SELECT count(*)::int AS n FROM promotion_history'),
      client.query('SELECT count(*)::int AS n FROM users'),
    ]);

    console.log('Seed complete.');
    console.log(
      `centres=${counts[0].rows[0].n} instructors=${counts[1].rows[0].n} students=${counts[2].rows[0].n} ` +
      `classes=${counts[3].rows[0].n} gradings=${counts[4].rows[0].n} candidates=${counts[5].rows[0].n} ` +
      `payments=${counts[6].rows[0].n} packages_owned=${counts[7].rows[0].n} attendance=${counts[8].rows[0].n} ` +
      `promotions=${counts[9].rows[0].n} users=${counts[10].rows[0].n}`
    );
    console.log(`Admin:   ${ADMIN.email} / ${ADMIN.password}`);
    console.log(`Admin:   ${SECOND_ADMIN.email} / ${SECOND_ADMIN.password}`);
    console.log(`Student: ${DEMO_STUDENT.email} / ${DEMO_STUDENT.password}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
