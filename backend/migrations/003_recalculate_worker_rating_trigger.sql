-- 003_recalculate_worker_rating_trigger.sql
-- Trigger function to recalculate worker rating_avg and total_reviews on reviews change

CREATE OR REPLACE FUNCTION trigger_recalculate_worker_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_worker_id UUID;
    new_avg NUMERIC(3,2);
    new_total INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_worker_id := OLD.worker_id;
    ELSE
        target_worker_id := NEW.worker_id;
    END IF;

    SELECT COALESCE(ROUND(AVG(score)::numeric, 2), 0.0), COUNT(*)
    INTO new_avg, new_total
    FROM reviews
    WHERE worker_id = target_worker_id;

    UPDATE worker_profiles
    SET rating_avg = new_avg,
        total_reviews = new_total
    WHERE id = target_worker_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_worker_rating ON reviews;

CREATE TRIGGER trg_recalculate_worker_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_worker_rating();
