-- migrations/004_descriptive_payment_references.sql
-- Changes payment references to METHOD-SESSIONS-YYYYMMDD-NNNNN, for example ST-5S-20261118-00001.
--   METHOD    BT (bank transfer), C (cash), ST (Stripe), WA (WhatsApp), EM (email), OT (other)
--   SESSIONS  the package's session count with an S suffix (5S), or NP when no package is linked
--   DATE      the payment date (paid_at) as YYYYMMDD
--   NNNNN     one counter shared by all methods, so it keeps counting over all time
-- Safe to rerun: the counter sequence is created only if missing, and the function is replaced.

CREATE SEQUENCE IF NOT EXISTS payment_reference_counter_seq;

-- Builds the reference for a new row. Runs before each insert, so the package and payment date are known.
CREATE OR REPLACE FUNCTION assign_payment_reference() RETURNS trigger AS $$
DECLARE
  method_code text;
  session_code text;
BEGIN
  method_code := CASE NEW.channel::text
    WHEN 'BANK_TRANSFER' THEN 'BT'
    WHEN 'CASH'          THEN 'C'
    WHEN 'STRIPE'        THEN 'ST'
    WHEN 'WHATSAPP'      THEN 'WA'
    WHEN 'EMAIL'         THEN 'EM'
    ELSE                      'OT'
  END;

  -- Look up the package's session count. NP means no package is linked to this payment.
  SELECT CASE WHEN sessions_total IS NULL THEN 'NP' ELSE sessions_total::text || 'S' END
    INTO session_code
    FROM packages
   WHERE id = NEW.package_id;
  session_code := (session_code, 'NP');

  NEW.reference := method_code || '-' || session_code || '-'
    || to_char(NEW.paid_at AT TIME ZONE 'Asia/Singapore', 'YYYYMMDD') || '-'
    || lpad(nextval('payment_reference_counter_seq')::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Move old values aside first, so the unique constraint is not hit while rows are renumbered.
UPDATE payments SET reference = 'migration-' || id::text;

-- Renumber existing payments in payment-date order, so the counter follows the original sequence.
WITH numbered AS (
  SELECT p.id,
         CASE p.channel::text
           WHEN 'BANK_TRANSFER' THEN 'BT'
           WHEN 'CASH'          THEN 'C'
           WHEN 'STRIPE'        THEN 'ST'
           WHEN 'WHATSAPP'      THEN 'WA'
           WHEN 'EMAIL'         THEN 'EM'
           ELSE                      'OT'
         END
         || '-'
         || COALESCE(CASE WHEN pk.sessions_total IS NULL THEN NULL ELSE pk.sessions_total::text || 'S' END, 'NP')
         || '-'
         || to_char(p.paid_at AT TIME ZONE 'Asia/Singapore', 'YYYYMMDD')
         || '-'
         || lpad(row_number() OVER (ORDER BY p.paid_at, p.id)::text, 5, '0') AS new_reference
    FROM payments pCOALESCE
    LEFT JOIN packages pk ON pk.id = p.package_id
)
UPDATE payments p
   SET reference = n.new_reference
  FROM numbered n
 WHERE p.id = n.id;

-- Continue the counter after the renumbered rows, so new payments do not reuse a number.
SELECT setval('payment_reference_counter_seq', COALESCE((SELECT COUNT(*) FROM payments), 0) + 1, false);
