-- create "tokens" table
CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY NOT NULL,
    expires DATETIME NOT NULL,
    target TEXT NOT NULL,
    callback TEXT NOT NULL DEFAULT ''
);

-- create "users" table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    access INTEGER NOT NULL,
    sub TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    subscription_id TEXT NOT NULL DEFAULT '',
    subscription_end DATETIME NOT NULL DEFAULT '2000-01-01 00:00:00',
    api_key TEXT NOT NULL DEFAULT '',
    UNIQUE (email, sub)
);

-- create "files" table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL
);

-- create "emails" table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    email_to TEXT NOT NULL,
    email_from TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL
);

-- create "email_attachments" table
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL
);

-- create "notes" table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL
);
