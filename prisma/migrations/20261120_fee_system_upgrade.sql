-- ============================================================================
-- SM Public School — Fool-Proof State-of-the-Art Fee System Migration
-- Idempotent PostgreSQL migration for SM_School
-- ============================================================================

-- 1. Fee Types Catalog (MONTHLY, EXAM, PROMOTION, BOOKS)
CREATE TABLE IF NOT EXISTS fee_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'per_term', 'once_per_session', 'on_promotion')),
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP(0) DEFAULT NOW(),
    updated_at TIMESTAMP(0) DEFAULT NOW()
);

INSERT INTO fee_types (code, name, frequency, description, is_active, sort_order, created_at, updated_at)
VALUES
    ('MONTHLY',   'Monthly Tuition Fee', 'monthly',          'Recurring monthly tuition fee (eligible for sibling concession)', TRUE, 1, NOW(), NOW()),
    ('EXAM',      'Examination Fee',     'per_term',         'Charged per examination term (e.g. Mid-Term, Final Term)',          TRUE, 2, NOW(), NOW()),
    ('PROMOTION', 'Promotion Fee',       'on_promotion',     'One-time fee charged when a student is promoted to a new class',    TRUE, 3, NOW(), NOW()),
    ('BOOKS',     'Books & Stationery',  'once_per_session', 'Annual books and curriculum pack fee charged once per session',     TRUE, 4, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Per-Class, Per-Session Fee Amounts (Administrator-only editable)
CREATE TABLE IF NOT EXISTS class_fee_amounts (
    id BIGSERIAL PRIMARY KEY,
    school_class_id BIGINT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    academic_session_id BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    fee_type_id BIGINT NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP(0) DEFAULT NOW(),
    updated_at TIMESTAMP(0) DEFAULT NOW(),
    CONSTRAINT class_fee_amounts_unique UNIQUE (school_class_id, academic_session_id, fee_type_id)
);

CREATE INDEX IF NOT EXISTS class_fee_amounts_session_idx ON class_fee_amounts (academic_session_id);
CREATE INDEX IF NOT EXISTS class_fee_amounts_class_idx ON class_fee_amounts (school_class_id);

-- Backfill MONTHLY & EXAM from existing class_fee_structures
INSERT INTO class_fee_amounts (school_class_id, academic_session_id, fee_type_id, amount, created_at, updated_at)
SELECT cfs.school_class_id, cfs.academic_session_id, ft.id, cfs.tuition_fee, NOW(), NOW()
FROM class_fee_structures cfs
JOIN fee_types ft ON ft.code = 'MONTHLY'
WHERE cfs.deleted_at IS NULL AND cfs.academic_session_id IS NOT NULL
ON CONFLICT (school_class_id, academic_session_id, fee_type_id) DO NOTHING;

INSERT INTO class_fee_amounts (school_class_id, academic_session_id, fee_type_id, amount, created_at, updated_at)
SELECT cfs.school_class_id, cfs.academic_session_id, ft.id, cfs.exam_fee, NOW(), NOW()
FROM class_fee_structures cfs
JOIN fee_types ft ON ft.code = 'EXAM'
WHERE cfs.deleted_at IS NULL AND cfs.academic_session_id IS NOT NULL
ON CONFLICT (school_class_id, academic_session_id, fee_type_id) DO NOTHING;

-- Seed default amounts for every active class in the current session so the Fee Settings matrix is complete
INSERT INTO class_fee_amounts (school_class_id, academic_session_id, fee_type_id, amount, created_at, updated_at)
SELECT
    sc.id,
    sess.id,
    ft.id,
    CASE
        WHEN ft.code = 'MONTHLY' THEN
            CASE
                WHEN sc.sort_order <= 2 THEN 3200.00
                WHEN sc.sort_order <= 5 THEN 3800.00
                WHEN sc.sort_order <= 8 THEN 4500.00
                ELSE 5500.00
            END
        WHEN ft.code = 'EXAM' THEN
            CASE
                WHEN sc.sort_order <= 5 THEN 400.00
                ELSE 500.00
            END
        WHEN ft.code = 'PROMOTION' THEN 500.00
        WHEN ft.code = 'BOOKS' THEN
            CASE
                WHEN sc.sort_order <= 2 THEN 1200.00
                WHEN sc.sort_order <= 5 THEN 1800.00
                WHEN sc.sort_order <= 8 THEN 2400.00
                ELSE 3000.00
            END
        ELSE 0.00
    END,
    NOW(),
    NOW()
FROM school_classes sc
CROSS JOIN academic_sessions sess
CROSS JOIN fee_types ft
WHERE sc.deleted_at IS NULL
  AND sess.deleted_at IS NULL
  AND sess.is_current = TRUE
ON CONFLICT (school_class_id, academic_session_id, fee_type_id) DO NOTHING;

-- 3. Immutable Append-Only Fee Audit Log Table + Trigger
CREATE TABLE IF NOT EXISTS fee_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP(0) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fee_audit_logs_action_idx ON fee_audit_logs (action);
CREATE INDEX IF NOT EXISTS fee_audit_logs_created_idx ON fee_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS fee_audit_logs_entity_idx ON fee_audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION prevent_fee_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'fee_audit_logs is append-only; % operations are forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_fee_audit_mutation ON fee_audit_logs;
CREATE TRIGGER trg_prevent_fee_audit_mutation
    BEFORE UPDATE OR DELETE ON fee_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fee_audit_mutation();

-- 4. Harden fee_payments (idempotency key, reversal fields, positive amount check)
ALTER TABLE fee_payments
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'posted',
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP(0),
    ADD COLUMN IF NOT EXISTS reversed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_idempotency_key_unique
    ON fee_payments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_amount_positive_check') THEN
        ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_amount_positive_check CHECK (amount_paid > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_status_check') THEN
        ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_status_check CHECK (status IN ('posted', 'reversed'));
    END IF;
END $$;

-- 5. Harden family_fee_challans (no negative paid, no overpayment, late fine tracking)
ALTER TABLE family_fee_challans
    ADD COLUMN IF NOT EXISTS late_fine_applied_at TIMESTAMP(0);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_fee_challans_paid_nonneg_check') THEN
        ALTER TABLE family_fee_challans ADD CONSTRAINT family_fee_challans_paid_nonneg_check CHECK (paid_amount >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_fee_challans_no_overpay_check') THEN
        ALTER TABLE family_fee_challans ADD CONSTRAINT family_fee_challans_no_overpay_check CHECK (paid_amount <= GREATEST(payable_before_due, payable_after_due));
    END IF;
END $$;

-- 6. Extend student_fees to link fee_types, enrollments, and dedup keys
ALTER TABLE student_fees
    ADD COLUMN IF NOT EXISTS fee_type_id BIGINT REFERENCES fee_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS student_enrollment_id BIGINT REFERENCES student_enrollments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billing_key VARCHAR(120);

CREATE INDEX IF NOT EXISTS student_fees_fee_type_idx ON student_fees (fee_type_id);
CREATE INDEX IF NOT EXISTS student_fees_billing_key_idx ON student_fees (student_id, academic_session_id, fee_type_id, billing_key);

-- Backfill fee_type_id = MONTHLY for existing student_fees rows where null
UPDATE student_fees sf
SET fee_type_id = ft.id
FROM fee_types ft
WHERE ft.code = 'MONTHLY' AND sf.fee_type_id IS NULL;

-- 7. Collision-free Receipt Sequence
CREATE SEQUENCE IF NOT EXISTS receipt_no_seq START WITH 1 INCREMENT BY 1;
SELECT setval('receipt_no_seq', GREATEST(1, (SELECT COALESCE(COUNT(*), 0) + 1 FROM fee_payments)), false);

-- 8. Seed Fee RBAC Permissions & Role Assignments
INSERT INTO permissions (name, guard_name, created_at, updated_at)
VALUES
    ('ViewAny:Fee',         'web', NOW(), NOW()),
    ('Update:FeeStructure', 'web', NOW(), NOW()),
    ('Create:FeeChallan',   'web', NOW(), NOW()),
    ('Create:FeePayment',   'web', NOW(), NOW()),
    ('Reverse:FeePayment',  'web', NOW(), NOW()),
    ('ViewAny:FeeAudit',    'web', NOW(), NOW())
ON CONFLICT (name, guard_name) DO NOTHING;

-- Super Admin & super_admin receive all fee permissions
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
JOIN roles r ON r.name IN ('Super Admin', 'super_admin')
WHERE p.name IN ('ViewAny:Fee', 'Update:FeeStructure', 'Create:FeeChallan', 'Create:FeePayment', 'Reverse:FeePayment', 'ViewAny:FeeAudit')
ON CONFLICT DO NOTHING;

-- Accountant receives ViewAny:Fee, Create:FeeChallan, Create:FeePayment (CANNOT edit fees, reverse payments, or view audit)
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
JOIN roles r ON r.name = 'Accountant'
WHERE p.name IN ('ViewAny:Fee', 'Create:FeeChallan', 'Create:FeePayment')
ON CONFLICT DO NOTHING;

-- Registrar receives ViewAny:Fee (read-only)
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
JOIN roles r ON r.name = 'Registrar'
WHERE p.name = 'ViewAny:Fee'
ON CONFLICT DO NOTHING;
