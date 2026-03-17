-- Reset rate-limit cooldown so worker resumes immediately
UPDATE email_send_state SET retry_after_until = NULL, updated_at = now() WHERE id = 1;

-- Purge all old broken messages from the active queue
DELETE FROM pgmq.q_transactional_emails;

-- Purge all old broken messages from the DLQ
DELETE FROM pgmq.q_transactional_emails_dlq;

-- Also purge auth email queues of any stale messages
DELETE FROM pgmq.q_auth_emails;
DELETE FROM pgmq.q_auth_emails_dlq;