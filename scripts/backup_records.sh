#!/bin/bash

# 路径配置
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
CSV_PATH="$BASE_DIR/data/records.csv"
BACKUP_DIR="$BASE_DIR/data/backups"
LOG_FILE="$BASE_DIR/data/backup.log"
KEEP_DAYS=7   # 自动清理超过7天的旧备份

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
DATE_TAG=$(date +"%Y%m%d_%H%M%S")

echo -e "${YELLOW}[${TIMESTAMP}] 开始执行账单数据备份...${NC}"

# 检查源文件是否存在
if [ ! -f "$CSV_PATH" ]; then
    echo -e "${RED}[${TIMESTAMP}] 错误：账单文件不存在 -> $CSV_PATH${NC}"
    echo "[${TIMESTAMP}] ERROR: 账单文件不存在，备份中止" >> "$LOG_FILE"
    exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行 tar 压缩备份
BACKUP_FILE="$BACKUP_DIR/records_backup_${DATE_TAG}.tar.gz"
tar -zcf "$BACKUP_FILE" -C "$BASE_DIR" "data/records.csv"

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}[${TIMESTAMP}] 备份成功！文件: $BACKUP_FILE (大小: $FILE_SIZE)${NC}"
    echo "[${TIMESTAMP}] SUCCESS: 备份至 $BACKUP_FILE，大小 $FILE_SIZE" >> "$LOG_FILE"
else
    echo -e "${RED}[${TIMESTAMP}] 备份失败！tar 命令执行出错${NC}"
    echo "[${TIMESTAMP}] ERROR: tar 备份失败" >> "$LOG_FILE"
    exit 1
fi

# 自动清理超过 KEEP_DAYS 天的旧备份
OLD_COUNT=$(find "$BACKUP_DIR" -name "records_backup_*.tar.gz" -mtime +${KEEP_DAYS} | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
    find "$BACKUP_DIR" -name "records_backup_*.tar.gz" -mtime +${KEEP_DAYS} -exec rm -f {} \;
    echo -e "${YELLOW}[${TIMESTAMP}] 已清理 ${OLD_COUNT} 个超过 ${KEEP_DAYS} 天的旧备份文件${NC}"
    echo "[${TIMESTAMP}] CLEAN: 清理了 ${OLD_COUNT} 个旧备份" >> "$LOG_FILE"
fi

# 输出当前备份目录状态
echo "── 当前备份列表 ──────────────────────────────────"
ls -lh "$BACKUP_DIR" | grep "records_backup_"
echo "──────────────────────────────────────────────────"
echo "[${TIMESTAMP}] 备份任务完成" >> "$LOG_FILE"