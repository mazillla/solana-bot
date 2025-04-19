-- database/init.sql

-- 👤 users: пользователи системы (для авторизации и разграничения доступа)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,                                -- Уникальный ID пользователя
    email TEXT UNIQUE NOT NULL,                           -- Email пользователя (уникальный логин)
    password_hash TEXT NOT NULL,                          -- Защищённый хэш пароля
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user', -- Роль пользователя
    created_at TIMESTAMP DEFAULT NOW()                    -- Дата и время создания
);

-- 🔗 chains: логические цепочки токенов (наборы токенов, с которыми работает бот)
CREATE TABLE IF NOT EXISTS chains (
    id SERIAL PRIMARY KEY,                                -- Уникальный ID цепочки
    name TEXT NOT NULL,                                   -- Название цепи (например, chain1)
    user_id INT REFERENCES users(id) ON DELETE CASCADE,   -- Владелец цепи
    is_active BOOLEAN DEFAULT TRUE,                       -- Активна ли цепочка
    created_at TIMESTAMP DEFAULT NOW()                    -- Дата создания
);

-- 🪙 chain_tokens: звенья цепочки — каждый токен
CREATE TABLE IF NOT EXISTS chain_tokens (
    id SERIAL PRIMARY KEY,                                -- ID токена
    chain_id INT REFERENCES chains(id) ON DELETE CASCADE, -- К какой цепочке относится
    mint_address TEXT NOT NULL,                           -- Mint-адрес токена
    start_time TIMESTAMP DEFAULT NOW(),                   -- Время начала наблюдения
    end_time TIMESTAMP,                                   -- Время окончания (если завершено)

    status TEXT CHECK (
        status IN ('active', 'bought', 'sold', 'skipped')
    ) DEFAULT 'active',                                   -- Текущий статус токена

    -- 🟢 Покупка
    buy_signature TEXT,                                   -- Сигнатура покупки
    buy_amount_sol NUMERIC(18, 9),                        -- Сколько SOL потрачено
    buy_price_usd NUMERIC(18, 6),                         -- Цена в USD
    buy_fee_sol NUMERIC(18, 9),                           -- Комиссия за покупку

    -- 🔴 Продажа
    sell_signature TEXT,                                  -- Сигнатура продажи
    sell_amount_token NUMERIC(18, 9),                     -- Сколько токенов продано
    sell_price_usd NUMERIC(18, 6),                        -- Цена в USD
    sell_fee_sol NUMERIC(18, 9),                          -- Комиссия за продажу

    -- 📈 Прибыль
    profit_sol NUMERIC(18, 9),                            -- Прибыль в SOL
    profit_usd NUMERIC(18, 6),                            -- Прибыль в USD

    skipped_reason TEXT,                                  -- Причина пропуска (если skipped)
    notes TEXT                                            -- Примечания
);

-- 🧾 token_accounts: аккаунты, связанные с токеном (mint / участники / раздача)
CREATE TABLE IF NOT EXISTS token_accounts (
    id SERIAL PRIMARY KEY,                                -- Уникальный ID записи
    token_id INT REFERENCES chain_tokens(id) ON DELETE CASCADE, -- К какому токену относится
    address TEXT NOT NULL,                                -- Адрес Solana аккаунта
    type TEXT CHECK (type IN ('mint', 'participant', 'share')) NOT NULL, -- Тип аккаунта
    last_signature TEXT,                                  -- Последняя сигнатура, замеченная этим аккаунтом
    first_seen TIMESTAMP DEFAULT NOW(),                   -- Когда впервые обнаружен
    notes TEXT                                            -- Комментарии
);

-- ⚙️ subscriber_config: глобальная конфигурация подписчика из БД
CREATE TABLE IF NOT EXISTS subscriber_config (
    id SERIAL PRIMARY KEY,

    rpc_endpoints JSONB NOT NULL,                         -- Список RPC эндпоинтов (http/ws)
    control_accounts TEXT[] NOT NULL,                     -- Список адресов, которые всегда слушаются

    silence_threshold_ms INTEGER NOT NULL DEFAULT 60000,  -- Сколько можно не получать событий до "молчания"
    queue_max_length INTEGER NOT NULL DEFAULT 1000,       -- Максимальная длина очередей

    rpc_timeout_ms INTEGER NOT NULL DEFAULT 5000,         -- Таймаут для RPC-запросов
    parse_concurrency INTEGER DEFAULT 3,                  -- Кол-во воркеров парсинга
    max_parse_duration_ms INTEGER DEFAULT 86400000,       -- Максимальный возраст задачи (24ч)

    heartbeat_interval_ms INTEGER DEFAULT 30000,          -- Интервал отправки heartbeat в Redis
    heartbeat_stream_key TEXT DEFAULT 'system_heartbeat', -- Поток для heartbeat сообщений

    default_history_max_age_ms INTEGER DEFAULT 604800000, -- Максимальный возраст истории при восстановлении (7 дней)
    recovery_cooldown_ms INTEGER DEFAULT 60000,           -- Интервал между recovery повторно

    -- 🆕 Новый параметр: сколько истории восстанавливать при превышении лимита (rate limit)
    recovery_max_age_ms INTEGER DEFAULT 300000,           -- Например, последние 5 минут

    http_limit_per_sec INTEGER NOT NULL DEFAULT 10,       -- Лимит HTTP-запросов в секунду
    ws_limit_per_sec INTEGER NOT NULL DEFAULT 5,          -- Лимит WebSocket-событий в секунду

    service_name TEXT DEFAULT 'solana_subscriber',        -- Имя сервиса (для логов)
    stream_subscription_state TEXT DEFAULT 'subscriber_subscription_state', -- Поток для подписок
    commitment TEXT CHECK (commitment IN ('processed', 'confirmed', 'finalized')) DEFAULT 'confirmed', -- Уровень подтверждения

    -- 🆕 Интервал проверки актуальности WebSocket-подписок (в миллисекундах)
    subscription_verifier_interval_ms INTEGER DEFAULT 60000,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 📡 subscriptions: текущие подписки, поддерживаемые подписчиком
CREATE TABLE IF NOT EXISTS subscriptions (
    chain_id TEXT NOT NULL,                                -- Название логической цепочки
    account TEXT NOT NULL,                                 -- Адрес Solana аккаунта
    active BOOLEAN DEFAULT TRUE,                           -- Флаг активности подписки
    last_signature TEXT,                                   -- Последняя сигнатура, полученная по аккаунту
    history_max_age_ms INTEGER,                            -- Насколько глубоко восстанавливать историю
    priority BOOLEAN DEFAULT false,                        -- Приоритетная ли подписка (с отдельной очередью)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,        -- Время создания
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,        -- Последнее обновление
    PRIMARY KEY (chain_id, account)                        -- Уникальность по цепочке + адресу
);
