-- create "tokens" table
create table if not exists tokens (
    id text primary key not null,
    expires timestamptz not null,
    target text not null,
    callback text not null default ''
);

-- create "users" table
create table if not exists users (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    email text not null,
    phone text not null default '',
    access bigint not null,
    sub text not null,
    avatar text not null default '',
    customer_id text not null default '',
    subscription_id text not null default '',
    subscription_end timestamptz not null default '2000-01-01 00:00:00',
    api_key text not null default '',
    unique (email, sub)
);

-- create "files" table
create table if not exists files (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    file_key text not null,
    file_name text not null,
    file_size bigint not null,
    content_type text not null
);

-- create "emails" table
create table if not exists emails (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    email_to text not null,
    email_from text not null,
    email_subject text not null,
    email_body text not null
);

-- create "email_attachments" table
create table if not exists email_attachments (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    email_id uuid not null,
    file_name text not null,
    content_type text not null
);

-- create "notes" table
create table if not exists notes (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    title text not null,
    category text not null,
    content text not null
);
