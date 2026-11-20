// model/dashboardModel.js - figures for the admin dashboard (AS-2).
//
// Every query takes centreId. null means all centres; a UUID limits the figures to that centre
// ("$1::uuid IS NULL OR ..." is the optional-filter pattern used across the app).
// pool.query(sql, params) runs one statement; $1, $2 ... are placeholders (prevents SQL injection).
const pool = require('../dbConfig');

// The four summary cards.
//  - students: active students
//  - active centres: centres not archived (when filtered to one centre, 1 or 0)
//  - upcoming gradings: sessions that start from now on. Gradings are held at HQ, so with a centre
//    filter a session counts when it has a student from that centre (same rule as the Grading page).
//  - collected this month: Successful (COMPLETED) payments paid in the current Singapore month.
// count(*)::int casts the bigint result to a plain integer; COALESCE(SUM(..), 0) turns "no rows" into 0.
async function summary(centreId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM students s
         WHERE s.is_active AND ($1::uuid IS NULL OR s.centre_id = $1)) AS total_students,
       (SELECT count(*)::int FROM centres c
         WHERE c.is_active AND ($1::uuid IS NULL OR c.id = $1)) AS active_centres,
       (SELECT count(*)::int FROM grading_sessions g
         WHERE g.starts_at >= now() AND g.status = 'SCHEDULED'
           AND ($1::uuid IS NULL OR EXISTS (
                 SELECT 1 FROM grading_candidates gc JOIN students st ON st.id = gc.student_id
                  WHERE gc.grading_session_id = g.id AND st.centre_id = $1))) AS upcoming_gradings,
       (SELECT COALESCE(SUM(p.amount_cents), 0)::int FROM payments p
          JOIN students s ON s.id = p.student_id
         WHERE p.status = 'COMPLETED'
           AND ($1::uuid IS NULL OR s.centre_id = $1)
           AND date_trunc('month', p.paid_at AT TIME ZONE 'Asia/Singapore')
             = date_trunc('month', now() AT TIME ZONE 'Asia/Singapore')) AS collected_this_month_cents`,
    [centreId]
  );
  return rows[0];
}

// The next few gradings, soonest first.
async function upcomingGradings(centreId, limit) {
  const { rows } = await pool.query(
    `SELECT g.id, g.title, g.starts_at, c.name AS centre_name,
            (SELECT count(*)::int FROM grading_candidates gc WHERE gc.grading_session_id = g.id) AS student_count
       FROM grading_sessions g
       JOIN centres c ON c.id = g.centre_id
      WHERE g.starts_at >= now() AND g.status = 'SCHEDULED'
        AND ($1::uuid IS NULL OR EXISTS (
              SELECT 1 FROM grading_candidates gc JOIN students st ON st.id = gc.student_id
               WHERE gc.grading_session_id = g.id AND st.centre_id = $1))
      ORDER BY g.starts_at ASC
      LIMIT $2`,
    [centreId, limit]
  );
  return rows;
}

// The latest payments, newest first. Failed ones are included so admins can see them.
// A payment with no paid date (pending or failed) is placed by when it was created instead.
// Every payment belongs to a package.
async function recentPayments(centreId, limit) {
  const { rows } = await pool.query(
    `SELECT p.id, p.amount_cents, p.paid_at, p.status, p.reference,
            s.first_name, s.last_name, pk.name AS package_name
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN packages pk ON pk.id = p.package_id
      WHERE ($1::uuid IS NULL OR s.centre_id = $1)
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC
      LIMIT $2`,
    [centreId, limit]
  );
  return rows;
}

module.exports = { summary, upcomingGradings, recentPayments };
