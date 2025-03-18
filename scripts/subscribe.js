import { createClient } from "redis";

const redisClient = createClient();
await redisClient.connect();

const args = process.argv.slice(2);
if (args.length < 3) {
    console.error("Использование: node subscribe.js <chain_id> <subscribe/unsubscribe> <account>");
    process.exit(1);
}

const [chain_id, action, account] = args;

await redisClient.xAdd("subscribe_addresses_stream", "*", {
    chain_id,
    action,
    accounts: JSON.stringify([account])
});

console.log(`[✅] ${action.toUpperCase()} аккаунта ${account} для цепочки ${chain_id} отправлено в Redis.`);
process.exit(0);
