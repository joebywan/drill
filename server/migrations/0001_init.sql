-- Drill sync. No names, emails or free text: a profile is the hash of a device-held token.
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,               -- SHA-256 of the auth token derived from the recovery code
  friend_code TEXT NOT NULL UNIQUE,  -- 8 characters, what friends swap
  card TEXT,                         -- public card JSON, preset values only (src/sync/presets.js)
  blob TEXT,                         -- progress, AES-GCM encrypted on the device; unreadable here
  rev INTEGER NOT NULL DEFAULT 0,    -- bumped on every upload, so two devices never overwrite blindly
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

-- A short-lived 6-digit code holding the recovery code, wrapped on the device with a key from the code.
CREATE TABLE pairings (
  code TEXT PRIMARY KEY,
  profile TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wrapped TEXT NOT NULL,
  expires INTEGER NOT NULL
);

-- One row per direction: 'asked' (src asked dst), 'friends', or 'blocked' (src blocked dst).
CREATE TABLE links (
  src TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dst TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('asked', 'friends', 'blocked')),
  PRIMARY KEY (src, dst)
);
CREATE INDEX links_dst ON links(dst);

-- One cheer a day from one friend to another, from the fixed set.
CREATE TABLE cheers (
  src TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dst TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  cheer TEXT NOT NULL,
  PRIMARY KEY (src, dst, day)
);
CREATE INDEX cheers_dst ON cheers(dst);

-- Fixed-window rate limits: key is what is limited (an IP or a profile, and the action).
CREATE TABLE rates (
  key TEXT PRIMARY KEY,
  win INTEGER NOT NULL,
  count INTEGER NOT NULL,
  until INTEGER NOT NULL             -- when the window ends (ms); rows past it are swept (worker.js sweep)
);
