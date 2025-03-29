-- users: для авторизации и ролей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- chains: цепочки мониторинга
CREATE TABLE chains (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- chain_tokens: звенья цепочек (один токен == одно звено)
CREATE TABLE chain_tokens (
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
CREATE TABLE token_accounts (
    id SERIAL PRIMARY KEY,
    token_id INT REFERENCES chain_tokens(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    type TEXT CHECK (type IN ('mint', 'participant', 'share')) NOT NULL,
    last_signature TEXT,
    first_seen TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
