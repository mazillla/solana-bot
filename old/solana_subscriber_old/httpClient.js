import { Connection, PublicKey } from "@solana/web3.js";
import { logger } from "./utils/logger.js";

// 📌 **Функция загрузки пропущенных транзакций с учётом новых транзакций из WebSocket**
export async function getMissedTransactions(connection, chain_id, latestSignature, newWebSocketTransactions) {
    let recoveredLogs = [];

    for (const [account, beforeSignature] of latestSignature.entries()) {
        let lastSignature = beforeSignature;

        while (true) {
            try {
                const signatures = await connection.getSignaturesForAddress(new PublicKey(account), {
                    limit: 100,
                    before: lastSignature,
                });

                if (signatures.length === 0) break; // Если больше нет транзакций, выходим

                for (const sig of signatures.reverse()) {
                    if (newWebSocketTransactions.has(sig.signature)) {
                        logger.info(`[🔄] Пропущенная транзакция ${sig.signature} уже пришла через WebSocket, исключаем.`);
                        continue; // Исключаем транзакции, которые уже пришли через WebSocket
                    }

                    const tx = await connection.getParsedTransaction(sig.signature, {
                        commitment: "confirmed",
                        maxSupportedTransactionVersion: 0,
                    });

                    if (tx) {
                        recoveredLogs.push({ chain_id, account, log: tx });
                        latestSignature.set(account, sig.signature);
                    }
                }

                lastSignature = signatures[signatures.length - 1].signature; // Обновляем последнюю сигнатуру

                if (signatures.length < 100) break; // Если получили меньше 100 транзакций, значит, больше нет
            } catch (error) {
                logger.error(`[❌] Ошибка восстановления логов для ${account}: ${error.message}`);
                break; // Если произошла ошибка, выходим из цикла
            }
        }
    }

    return recoveredLogs;
}
