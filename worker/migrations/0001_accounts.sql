PRAGMA foreign_keys = ON;
CREATE TABLE auth_user (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE auth_session (
 id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE TABLE auth_account (
 id TEXT PRIMARY KEY, issuer TEXT NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER,
 refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(issuer,account_id)
);
CREATE INDEX auth_account_user_idx ON auth_account(user_id);
CREATE TABLE auth_verification (
 id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX auth_verification_identifier_idx ON auth_verification(identifier);
CREATE TABLE auth_rate_limit (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request INTEGER NOT NULL);
CREATE TABLE people (
 id TEXT PRIMARY KEY, user_id TEXT UNIQUE REFERENCES auth_user(id) ON DELETE SET NULL,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL, phone TEXT,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','superuser')),
 status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','disabled','removed')),
 owner INTEGER NOT NULL DEFAULT 0, must_change_password INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX one_owner ON people(owner) WHERE owner=1;
CREATE TABLE invitations (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id), token_hash TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL, used_at INTEGER, revoked_at INTEGER
);
CREATE INDEX invitation_person_idx ON invitations(person_id);
CREATE TABLE account_requests (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('access','password')),
 email TEXT NOT NULL COLLATE NOCASE, name TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','invited','declined','resolved')),
 notified_at INTEGER, created_at INTEGER NOT NULL, resolved_at INTEGER
);
CREATE INDEX account_requests_status_idx ON account_requests(status,created_at);
CREATE UNIQUE INDEX account_requests_pending_idx ON account_requests(kind,email) WHERE status='pending';
CREATE TABLE account_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, target_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX account_audit_time_idx ON account_audit(created_at);
CREATE TABLE role_previews (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE account_studies (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 title TEXT NOT NULL, case_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(length(payload)<=131072), updated_at INTEGER NOT NULL
);
CREATE INDEX account_studies_user_idx ON account_studies(user_id,updated_at);
