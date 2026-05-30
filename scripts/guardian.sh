#!/bin/bash
# 智能运维 Agent - Web 进程防宕机自动化自愈守护脚本

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
URL="http://127.0.0.1:8080/"
LOG_FILE="$BASE_DIR/data/guardian.log"
CHECK_INTERVAL=10  # 检测间隔（秒）

echo "[$(date +"%Y-%m-%d %H:%M:%S")] 自动化守护 Agent 已激活上线，PID=$$" >> "$LOG_FILE"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] 监控目标: $URL，检测间隔: ${CHECK_INTERVAL}s" >> "$LOG_FILE"

while true; do
    # 用 curl 探测服务状态码
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL")

    if [ "$HTTP_CODE" != "200" ]; then
        echo "[$(date +"%Y-%m-%d %H:%M:%S")] [警告] Web 服务不可用，状态码: $HTTP_CODE。准备自愈..." >> "$LOG_FILE"

        # 用 lsof 找占用端口的进程并强制终止
        PID=$(lsof -t -i:8080)
        if [ ! -z "$PID" ]; then
            kill -9 $PID
            echo "[$(date +"%Y-%m-%d %H:%M:%S")] [清理] 已终止僵尸进程 PID=$PID" >> "$LOG_FILE"
        fi

        # nohup 将 Flask 推送到后台守护运行
        cd "$BASE_DIR"
        nohup python3 app.py > /dev/null 2>&1 &
        NEW_PID=$!
        echo "[$(date +"%Y-%m-%d %H:%M:%S")] [自愈成功] Flask 已重启，新 PID=$NEW_PID" >> "$LOG_FILE"
    else
        echo "[$(date +"%Y-%m-%d %H:%M:%S")] [正常] 服务运行中，HTTP $HTTP_CODE" >> "$LOG_FILE"
    fi

    sleep $CHECK_INTERVAL
done