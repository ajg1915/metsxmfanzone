DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN SELECT msg_id, message FROM pgmq.q_auth_emails_dlq LOOP
    PERFORM pgmq.send('auth_emails', m.message);
    PERFORM pgmq.delete('auth_emails_dlq', m.msg_id);
  END LOOP;
  FOR m IN SELECT msg_id, message FROM pgmq.q_transactional_emails_dlq LOOP
    PERFORM pgmq.send('transactional_emails', m.message);
    PERFORM pgmq.delete('transactional_emails_dlq', m.msg_id);
  END LOOP;
END $$;