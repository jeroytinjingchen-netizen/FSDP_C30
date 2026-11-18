-- migrations/003_payment_references.sql
-- Removes payout dates and gives every payment a readable, method-based reference.
-- Existing references are replaced in payment-date order. Stripe's own ids remain in their
-- dedicated columns, so webhook duplicate detection and reconciliation are preserved.

-- One independent sequence per payment method. CREATE SEQUENCE IF NOT EXISTS is safe to rerun.
CREATE SEQUENCE IF NOT EXISTS payment_reference_bank_transfer_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_cash_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_stripe_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_whatsapp_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_email_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_other_seq;

-- BEFORE INSERT runs before a new row is saved. NEW is the row being inserted.
-- nextval() takes the next number from the sequence for that payment method.
-- lpad(..., 5, '0') pads the number to five digits, for example 12 -> 00012.
CREATE OR REPLACE FUNCTION assign_payment_reference() RETURNS trigger AS $$
BEGIN
  NEW.reference := CASE NEW.channel
    WHEN 'BANK_TRANSFER' THEN 'BT-' || lpad(nextval('payment_reference_bank_transfer_seq')::text, 5, '0')
    WHEN 'CASH'          THEN 'C-'  || lpad(nextval('payment_reference_cash_seq')::text, 5, '0')
    WHEN 'STRIPE'        THEN 'ST-' || lpad(nextval('payment_reference_stripe_seq')::text, 5, '0')
    WHEN 'WHATSAPP'      THEN 'WA-' || lpad(nextval('payment_reference_whatsapp_seq')::text, 5, '0')
    WHEN 'EMAIL'         THEN 'EM-' || lpad(nextval('payment_reference_email_seq')::text, 5, '0')
    ELSE                      'OT-' || lpad(nextval('payment_reference_other_seq')::text, 5, '0')
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_assign_reference ON payments;
CREATE TRIGGER payments_assign_reference
BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION assign_payment_reference();

-- Move old values aside first. Otherwise swapping two existing references can temporarily
-- collide while Postgres checks the unique constraint one row at a time.
UPDATE payments SET reference = 'migration-' || id::text;

-- Convert existing rows in a stable order. row_number() numbers rows within each channel.
-- The CTE calculates all new values before the UPDATE changes any references.
WITH numbered AS (
  SELECT id,
         CASE channel::text
           WHEN 'BANK_TRANSFER' THEN 'BT-'
           WHEN 'CASH'          THEN 'C-'
           WHEN 'STRIPE'        THEN 'ST-'
           WHEN 'WHATSAPP'      THEN 'WA-'
           WHEN 'EMAIL'         THEN 'EM-'
           ELSE                      'OT-'
         END || lpad(row_number() OVER (PARTITION BY channel ORDER BY paid_at, id)::text, 5, '0') AS new_reference
  FROM payments
)
UPDATE payments p
SET reference = n.new_reference
FROM numbered n
WHERE p.id = n.id;

-- Start each sequence after the largest existing reference for that method.
-- setval(..., false) makes the next nextval() return exactly the supplied number.
SELECT setval('payment_reference_bank_transfer_seq',
  COALESCE((SELECT max(substring(reference FROM 4)::bigint) FROM payments WHERE channel = 'BANK_TRANSFER'), 0) + 1, false);
SELECT setval('payment_reference_cash_seq',
  COALESCE((SELECT max(substring(reference FROM 3)::bigint) FROM payments WHERE channel = 'CASH'), 0) + 1, false);
SELECT setval('payment_reference_stripe_seq',
  COALESCE((SELECT max(substring(reference FROM 4)::bigint) FROM payments WHERE channel = 'STRIPE'), 0) + 1, false);
SELECT setval('payment_reference_whatsapp_seq',
  COALESCE((SELECT max(substring(reference FROM 4)::bigint) FROM payments WHERE channel = 'WHATSAPP'), 0) + 1, false);
SELECT setval('payment_reference_email_seq',
  COALESCE((SELECT max(substring(reference FROM 4)::bigint) FROM payments WHERE channel = 'EMAIL'), 0) + 1, false);
SELECT setval('payment_reference_other_seq',
  COALESCE((SELECT max(substring(reference FROM 4)::bigint) FROM payments WHERE channel = 'OTHER'), 0) + 1, false);

ALTER TABLE payments ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_reference ON payments(reference);

-- Payout dates are no longer part of the payment record.
DROP INDEX IF EXISTS idx_payments_payout;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_payout;
ALTER TABLE payments DROP COLUMN IF EXISTS payout_at;
