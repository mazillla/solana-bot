// producer.js
import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
});

const streamKey = "solanaStream";

async function sendMessage() {
  const message = {
    token: "So11111111111111111111111111111111111111112",
    signature: "sample_signature_" + Date.now(),
    timestamp: Date.now().toString(),
  };

  const id = await redis.xadd(streamKey, "*", ...Object.entries(message).flat());

  console.log(`✅ Сообщение отправлено в стрим с ID: ${id}`);
  process.exit(0);
}

sendMessage();
