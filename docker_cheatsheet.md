# 📦 Docker Cheatsheet — команды с пояснениями

# ----------------------
# 📦 ОБРАЗЫ (IMAGES)
# ----------------------

# 🔍 Посмотреть все образы
docker images

# 🧹 Удалить образ по IMAGE ID
docker rmi <image_id>

# 🧼 Удалить все "dangling" (none) образы
docker image prune

# 🧼 Удалить ВСЕ образы (осторожно!)
docker rmi $(docker images -q)


# ----------------------
# 📦 КОНТЕЙНЕРЫ (CONTAINERS)
# ----------------------

# 🔍 Все контейнеры, включая остановленные
docker ps -a

# 🔍 Только запущенные контейнеры
docker ps

# 🧼 Удалить все остановленные контейнеры
docker container prune

# ❌ Удалить конкретный контейнер
docker rm <container_name_or_id>

# 🚫 Принудительно удалить (даже если запущен)
docker rm -f <container_name_or_id>


# ----------------------
# ⚙️ docker-compose
# ----------------------

# 📥 Построить и запустить контейнеры из compose файла
docker compose -f <path-to-yml> up -d --build

# 🚀 Запустить без пересборки
docker compose -f <path-to-yml> up -d

# 🛑 Остановить и удалить контейнеры и сеть
docker compose -f <path-to-yml> down


# ----------------------
# 📄 ЛОГИ
# ----------------------

# 📋 Показать логи контейнера
docker logs <container_name>


# ----------------------
# 🔎 ПОИСК
# ----------------------

# 🔍 Найти контейнер по имени или ключевому слову
docker ps -a | grep <search_term>


# ----------------------
# 🧰 ДОПОЛНИТЕЛЬНО
# ----------------------

# 📋 Найти все "none" образы
docker images -f "dangling=true"

# 🧼 Удалить все "none" образы
docker rmi $(docker images -f "dangling=true" -q)

# 🔧 Проверка открытых портов контейнеров
docker ps