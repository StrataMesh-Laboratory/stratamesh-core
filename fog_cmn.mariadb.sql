-- fog_cmn.mariadb.sql
-- LAB only. Optional exclusive-off Fog MariaDB adapter for StrataMesh-core.
-- Apply as grok against database fog_cmn (already created). grok has GRANT fog_cmn.* only.
-- Do not CREATE DATABASE / GRANT here — grok is not MySQL root.
-- n=1, oracle_live=false, no mesh claim. No Worker/D1/KV/R2/RDS/workers.dev.
-- PersistentDAG SQLite today is only `transactions` + `meta`; those two tables match 1:1.
-- Staff, subsistence, gossip live in-process in node_persistent and are mapped 1:1 below.
-- Sidecar snapshot tables (gossip_snapshot, subsistence_snapshot, staff_identities)
-- may already exist locally; this file does not DROP them.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- PersistentDAG (src/persistent_dag.py) 1:1
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  tx_id VARCHAR(128) NOT NULL,
  tx_type VARCHAR(64) NOT NULL,
  parents TEXT NOT NULL,
  weight DOUBLE NOT NULL,
  cumulative_weight DOUBLE NOT NULL,
  timestamp DOUBLE NOT NULL,
  cid VARCHAR(256) NULL,
  sender VARCHAR(256) NULL,
  PRIMARY KEY (tx_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta (
  `key` VARCHAR(128) NOT NULL,
  value TEXT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Staff 1:1 (docs/AUTH-STAFF-2FA.md in-process staff + staff_otp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  staff_role VARCHAR(64) NOT NULL,
  clearance VARCHAR(64) NOT NULL,
  is_root_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_sca TINYINT(1) NOT NULL DEFAULT 0,
  mariadb_user VARCHAR(64) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_otp (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  challenge VARCHAR(128) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  expires_at DOUBLE NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_staff_otp_email (email),
  KEY idx_staff_otp_challenge (challenge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lab identity rows only. No passwords. Re-apply is safe.
INSERT IGNORE INTO staff
  (email, password_hash, staff_role, clearance, is_root_admin, is_sca, mariadb_user, note)
VALUES
  ('amcmorais@icloud.com', NULL, 'root_admin', 'TOP_SECRET', 1, 0, NULL,
   'AUTH-STAFF-2FA lab seed; password never stored in this SQL'),
  ('geral@calhegasmorais.pt', NULL, 'admin', 'SECRET', 0, 0, NULL,
   'AUTH-STAFF-2FA lab seed; password never stored in this SQL'),
  ('grok@calhegasmorais.pt', NULL, 'external_assistant', 'SECRET', 0, 0, 'grok',
   'Fog MariaDB user grok@; GRANT fog_cmn.* only; not SCA; not root_admin');

-- ---------------------------------------------------------------------------
-- Subsistence 1:1 (src/subsistence/ledger.py AgentAccount + ResourceMeter + LedgerEntry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subsistence_accounts (
  agent_id VARCHAR(128) NOT NULL,
  reserve DOUBLE NOT NULL DEFAULT 0,
  tau DOUBLE NOT NULL DEFAULT 0,
  grace_remaining INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_surplus DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsistence_meters (
  agent_id VARCHAR(128) NOT NULL,
  window_start DOUBLE NOT NULL,
  consumed_compute DOUBLE NOT NULL DEFAULT 0,
  consumed_memory_time DOUBLE NOT NULL DEFAULT 0,
  consumed_bandwidth DOUBLE NOT NULL DEFAULT 0,
  consumed_energy DOUBLE NOT NULL DEFAULT 0,
  consumed_other DOUBLE NOT NULL DEFAULT 0,
  earned_compute DOUBLE NOT NULL DEFAULT 0,
  earned_memory_time DOUBLE NOT NULL DEFAULT 0,
  earned_bandwidth DOUBLE NOT NULL DEFAULT 0,
  earned_energy DOUBLE NOT NULL DEFAULT 0,
  earned_other DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsistence_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  agent_id VARCHAR(128) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  amount DOUBLE NOT NULL DEFAULT 0,
  detail TEXT NULL,
  ts DOUBLE NOT NULL,
  PRIMARY KEY (id),
  KEY idx_subsistence_log_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Gossip 1:1 (src/gossip.py GossipNode.pending + encode() wire messages)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gossip_pending (
  tx_id VARCHAR(128) NOT NULL,
  tx_type VARCHAR(64) NOT NULL,
  parents TEXT NOT NULL,
  weight DOUBLE NOT NULL,
  cumulative_weight DOUBLE NOT NULL,
  timestamp DOUBLE NOT NULL,
  cid VARCHAR(256) NULL,
  sender VARCHAR(256) NULL,
  PRIMARY KEY (tx_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gossip_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  msg_type VARCHAR(32) NOT NULL,
  payload TEXT NOT NULL,
  ts DOUBLE NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gossip_messages_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
