-- A PENDING transaction moves no money, so a card frozen just after the request's own check may still record one: the
-- fraud detector or settle() then declines it. Posting from a frozen account stays refused.
-- A redelivered insert of a row that already exists passes, as before.
CREATE OR REPLACE FUNCTION forbid_frozen_sender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM transactions WHERE txn_id = NEW.txn_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('DECLINED', 'PENDING')
     AND EXISTS (SELECT 1 FROM accounts WHERE card_id = NEW.card_id AND status = 'FROZEN') THEN
    RAISE EXCEPTION 'account % is frozen', NEW.card_id USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END $$;
