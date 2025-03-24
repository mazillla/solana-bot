// consumer.js
import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
});

const streamKey = "solanaStream";
const consumerGroup = "subscribers";
const consumerName = "solana_1";

async function createGroupIfNotExists() {
  try {
    await redis.xgroup("CREATE", streamKey, consumerGroup, "0", "MKSTREAM");
    console.log("👷‍♂️ Группа создана");
  } catch (err) {
    if (!err.message.includes("BUSYGROUP")) {
      console.error("Ошибка при создании группы:", err.message);
    }
  }
}

async function listenToStream() {
  await createGroupIfNotExists();

  console.log("👂 Слушаем Redis Stream...");

  while (true) {
    try {
      const result = await redis.xreadgroup(
        "GROUP", consumerGroup, consumerName,
        "BLOCK", 5000, // ждём 5 секунд
        "COUNT", 10,
        "STREAMS", streamKey, ">"
      );

      if (result) {
        const [stream, messages] = result[0];

        for (const [id, fields] of messages) {
          const data = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }

          console.log(`📥 Получено сообщение ${id}:`, data);

          // Подтверждаем, что обработано
          await redis.xack(streamKey, consumerGroup, id);
        }
      }
    } catch (err) {
      console.error("❌ Ошибка при чтении стрима:", err.message);
    }
  }
}

listenToStream();
