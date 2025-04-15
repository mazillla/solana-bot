-- users: для авторизации и ролей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- chains: цепочки мониторинга
CREATE TABLE IF NOT EXISTS chains (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- chain_tokens: звенья цепочек (один токен == одно звено)
CREATE TABLE IF NOT EXISTS chain_tokens (
    id SERIAL PRIMARY KEY,
    chain_id INT REFERENCES chains(id) ON DELETE CASCADE,
    mint_address TEXT NOT NULL,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,

    status TEXT CHECK (
        status IN ('active', 'bought', 'sold', 'skipped')
    ) DEFAULT 'active',

    -- торговля
    buy_signature TEXT,
    sell_signature TEXT,

    buy_amount_sol NUMERIC(18, 9),
    buy_price_usd NUMERIC(18, 6),
    buy_fee_sol NUMERIC(18, 9),

    sell_amount_token NUMERIC(18, 9),
    sell_price_usd NUMERIC(18, 6),
    sell_fee_sol NUMERIC(18, 9),

    profit_sol NUMERIC(18, 9),
    profit_usd NUMERIC(18, 6),

    skipped_reason TEXT,
    notes TEXT
);

-- token_accounts: Минтовый, Соучастники, Share
CREATE TABLE IF NOT EXISTS token_accounts (
    id SERIAL PRIMARY KEY,
    token_id INT REFERENCES chain_tokens(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    type TEXT CHECK (type IN ('mint', 'participant', 'share')) NOT NULL,
    last_signature TEXT,
    first_seen TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- subscriber_config: глобальная конфигурация подписчика
CREATE TABLE IF NOT EXISTS subscriber_config (
    id SERIAL PRIMARY KEY,
    rpc_endpoints JSONB NOT NULL,
    control_accounts TEXT[] NOT NULL,
    silence_threshold_ms INTEGER NOT NULL DEFAULT 60000,
    queue_max_length INTEGER NOT NULL DEFAULT 1000,
    rpc_timeout_ms INTEGER NOT NULL DEFAULT 5000,
    parse_concurrency INTEGER DEFAULT 3,
    parse_queue_max_length INTEGER DEFAULT 1000,
    max_parse_duration_ms INTEGER DEFAULT 86400000,
    heartbeat_interval_ms INTEGER DEFAULT 30000,
    default_history_max_age_ms INTEGER DEFAULT 604800000,
    recovery_cooldown_ms INTEGER DEFAULT 60000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- subscriptions: активные подписки на аккаунты
CREATE TABLE IF NOT EXISTS subscriptions (
    chain_id TEXT NOT NULL,
    account TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    last_signature TEXT,
    history_max_age_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chain_id, account)
);
