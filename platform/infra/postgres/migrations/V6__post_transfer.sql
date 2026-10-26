-- The only way to move money. The app can call it but can't update balances or write the ledger itself, so every balance
-- change comes with its transfer row, its ledger entries and its outbox event, whatever the backend does.
-- SECURITY DEFINER: runs with the owner's rights; search_path is pinned so a caller can't swap in look-alike tables.
--
-- The sender comes from the session token, not a card number, and the password is checked here,
-- so even a compromised backend can only debit a card whose owner is signed in and whose password it has.
--
-- Errors carry their own SQLSTATE (class TF) so the backend can map them to HTTP statuses.
CREATE OR REPLACE FUNCTION post_transfer(
  p_session_token text,
  p_password      text,
  p_transfer_id   uuid,
  p_to_bank_code  text,
  p_to_account    text,
  p_to_name       text,
  p_amount        bigint,
  p_content       text
) RETURNS TABLE (
  transfer_id   uuid,
  reference     text,
  to_bank_code  text,
  to_account    text,
  to_name       text,
  amount        bigint,
  content       text,
  created_at    timestamptz,
  balance       bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  -- This platform's bank code (OUR_BANK in the backend): a transfer to it credits an account here.
  our_bank CONSTANT text := 'HCMMB';
  v_from    text;
  v_to      text;
  v_name    text;
  v_balance bigint;
  t         transfers%ROWTYPE;
BEGIN
  SELECT s.card_id INTO v_from
  FROM sessions s JOIN auth a USING (card_id)
  WHERE s.token_hash = sha256(convert_to(p_session_token, 'UTF8')) AND s.expires_at > now() AND a.status = 'ACTIVE';
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'sign in again' USING ERRCODE = 'TF401';
  END IF;

  -- Before any lock is taken: bcrypt is slow.
  IF NOT EXISTS (SELECT 1 FROM auth WHERE card_id = v_from AND password_hash = crypt(p_password, password_hash)) THEN
    RAISE EXCEPTION 'incorrect password' USING ERRCODE = 'TF403';
  END IF;

  IF p_to_bank_code = our_bank THEN
    SELECT a.card_id, upper(c.first_name || ' ' || c.last_name) INTO v_to, v_name
    FROM accounts a JOIN cardholders c USING (card_id)
    WHERE a.account_number = p_to_account;
    IF v_to IS NULL THEN
      RAISE EXCEPTION 'account not found' USING ERRCODE = 'TF404';
    END IF;
    IF v_to = v_from THEN
      RAISE EXCEPTION 'cannot transfer to your own account' USING ERRCODE = 'TF422';
    END IF;
  ELSE
    -- Another bank: the money leaves through NAPAS, there is no account here to credit.
    v_name := p_to_name;
  END IF;

  -- Lock both accounts in card_id order, so two opposite transfers between the same pair can't deadlock.
  -- Before the INSERT: its foreign keys take a share lock on these rows, and upgrading that lock later is what deadlocks.
  PERFORM 1 FROM accounts WHERE card_id IN (v_from, v_to) ORDER BY card_id FOR NO KEY UPDATE;

  -- The primary key is the idempotency check: the same transferId again answers with the first transfer and moves nothing.
  INSERT INTO transfers AS tr (transfer_id, from_card, to_bank_code, to_account, to_name, to_card, amount, content)
  VALUES (p_transfer_id, v_from, p_to_bank_code, p_to_account, v_name, v_to, p_amount, p_content)
  ON CONFLICT (transfer_id) DO NOTHING
  RETURNING tr.* INTO t;

  IF t.transfer_id IS NULL THEN
    SELECT * INTO t FROM transfers tr WHERE tr.transfer_id = p_transfer_id;
    IF t.from_card <> v_from OR t.to_bank_code <> p_to_bank_code OR t.to_account <> p_to_account OR t.amount <> p_amount THEN
      RAISE EXCEPTION 'transferId was already used for a different transfer' USING ERRCODE = 'TF409';
    END IF;
    SELECT a.balance INTO v_balance FROM accounts a WHERE a.card_id = v_from;
  ELSE
    -- Check and debit in one statement: the balance can't change between the check and the write.
    UPDATE accounts a SET balance = a.balance - p_amount, updated_at = now()
    WHERE a.card_id = v_from AND a.balance >= p_amount
    RETURNING a.balance INTO v_balance;
    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'TF402';
    END IF;

    INSERT INTO ledger_entries (card_id, kind, amount, reference) VALUES (v_from, 'DEBIT', -p_amount, t.reference);

    IF v_to IS NOT NULL THEN
      UPDATE accounts a SET balance = a.balance + p_amount, updated_at = now() WHERE a.card_id = v_to;
      INSERT INTO ledger_entries (card_id, kind, amount, reference) VALUES (v_to, 'CREDIT', p_amount, t.reference);
    END IF;

    INSERT INTO outbox (aggregate_id, type, payload) VALUES (t.transfer_id::text, 'TransferPosted', jsonb_build_object(
      'transferId', t.transfer_id,
      'reference', t.reference,
      'kind', CASE WHEN v_to IS NULL THEN 'NAPAS' ELSE 'INTERNAL' END,
      'fromCard', v_from,
      'toCard', v_to,
      'to', jsonb_build_object('bankCode', t.to_bank_code, 'account', t.to_account, 'name', t.to_name),
      'amount', t.amount,
      'content', t.content,
      'ts', t.created_at));
  END IF;

  RETURN QUERY SELECT t.transfer_id, t.reference, t.to_bank_code, t.to_account, t.to_name, t.amount, t.content, t.created_at, v_balance;
END $$;

-- Functions are executable by everyone by default; only the app login gets it (afterMigrate__app_role.sql).
REVOKE ALL ON FUNCTION post_transfer(text, text, uuid, text, text, text, bigint, text) FROM PUBLIC;
