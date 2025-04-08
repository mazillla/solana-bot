import dotenv from "dotenv";

dotenv.config();

const config = {
    RPC_HTTP_URL: process.env.RPC_HTTP_URL || "https://api.mainnet-beta.solana.com",
    RPC_WS_URL: process.env.RPC_WS_URL || "wss://api.mainnet-beta.solana.com",
    CONTROL_ACCOUNTS: process.env.CONTROL_ACCOUNTS ? process.env.CONTROL_ACCOUNTS.split(",") : []
};

export default config;
