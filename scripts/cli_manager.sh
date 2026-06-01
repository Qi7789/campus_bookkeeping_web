#!/bin/bash
# 校园对账系统 - Linux SSH 终端交互式文本分析利器与高级可视化引擎

# 弹性绝对路径自适应逻辑
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
CSV_PATH="$BASE_DIR/data/records.csv"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
BUDGET_LIMIT=2000

while true; do
    clear
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}      校园智能对账系统 与 文本流分析引擎 (SSH版)     ${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo " 1. [查看] 实时滚动账单明细流 (tail+column)"
    echo " 2. [录入] 快捷命令行记账 (规范分类自动同步)"
    echo " 3. [图表] 运行原生 Awk 高阶计算并动态输出柱状图"
    echo " 4. [维护] 一键安全备份账目底层数据 (tar工具)"
    echo " 5. [退出] 安全断开连接"
    echo -e "${GREEN}=====================================================${NC}"
    read -p "请输入运维管理指令 [1-5]: " choice

    case $choice in
        1)
            echo -e "${YELLOW}--- 最新10条账单记录快照 ---${NC}"
            if [ ! -f "$CSV_PATH" ]; then
                echo "核心数据中心暂无记录文件"
            else
                tail -n 10 "$CSV_PATH" | column -s, -t
            fi
            read -p "按回车键返回菜单..." dummy
            ;;
        2)
            echo -e "${YELLOW}--- 快捷录入记账流 ---${NC}"
            read -p "类型 (收入/支出): " r_type
            echo -e "${YELLOW}合规选项清单：[餐饮/购物/生活费/交通/转账/水电/娱乐/储蓄]${NC}"
            read -p "账单分类: " r_cat
            read -p "记账金额: " r_amount
            read -p "流向备注(选填): " r_note

            if [ -z "$r_type" ] || [ -z "$r_cat" ] || [ -z "$r_amount" ]; then
                echo -e "${RED}❌ 写入失败：核心必填参数存在空缺！${NC}"
                sleep 2
                continue
            fi

            r_date=$(date +"%Y-%m-%d")
            mkdir -p "$BASE_DIR/data"

            # ✅ 修复：生成与 app.py 兼容的 8位随机 id
            r_id=$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' | head -c 8)
            if [ -z "$r_id" ]; then
                r_id=$(date +%s%N | md5sum | head -c 8)
            fi

            # 初始化 CSV 文件头（含 id 字段，与 app.py 保持一致）
            if [ ! -f "$CSV_PATH" ] || [ ! -s "$CSV_PATH" ]; then
                echo "id,date,type,category,amount,note" > "$CSV_PATH"
            fi

            # 防错位换行符对齐纠正
            last_char=$(tail -c 1 "$CSV_PATH" | wc -c)
            if [ "$last_char" -gt 0 ]; then
                last_byte=$(tail -c 1 "$CSV_PATH" | od -An -tx1 | tr -d ' ')
                if [ "$last_byte" != "0a" ]; then
                    echo "" >> "$CSV_PATH"
                fi
            fi

            # ✅ 修复：写入格式加入 id 字段，顺序与 app.py 的 fieldnames 一致
            echo "$r_id,$r_date,$r_type,$r_cat,$r_amount,$r_note" >> "$CSV_PATH"
            logger -t CAMPUS_BILL "Added record via TUI: Type=$r_type, Amount=$r_amount"
            echo -e "${GREEN}√ 底层数据对账保存成功！Web端已完成联动更新。${NC}"
            sleep 1.2
            ;;
        3)
                    echo -e "${YELLOW}--- 原生 Awk 文本大数据计算与字符柱状图可视化 ---${NC}"
                    if [ ! -f "$CSV_PATH" ] || [ $(wc -l < "$CSV_PATH") -le 1 ]; then
                        echo "数据中心未检测到可供分析的数据流"
                    else
                        echo -e "${BLUE}-----------------------------------------------------"
                        echo -e " 消费品类             支出总金额          终端数据柱状图"
                        echo -e "-----------------------------------------------------${NC}"

                        # 获取当前月份 (格式例如: 2026-06)
                        CURRENT_MONTH=$(date +"%Y-%m")

                        # ✅ 修复：通过 -v 传入月份变量，并在条件中加入 $2 ~ ym 进行当月过滤
                        awk -F',' -v ym="$CURRENT_MONTH" '
                        NR>1 && $3=="支出" && $2 ~ ym {sum[$4]+=$5}
                        END {
                            max_val = 0;
                            for(cat in sum) { if(sum[cat] > max_val) max_val = sum[cat] }
                            if(max_val == 0) max_val = 1;

                            for(cat in sum) {
                                printf " %-16s | %-12.2f | ", cat, sum[cat];
                                bars = int((sum[cat] / max_val) * 20);
                                for(i=0; i<bars; i++) printf "■";
                                printf "\n";
                            }
                        }' "$CSV_PATH"

                        # ✅ 修复：总支出计算也同步加入 $2 ~ ym 进行当月过滤
                        total_amt=$(awk -F',' -v ym="$CURRENT_MONTH" 'NR>1 && $3=="支出" && $2 ~ ym {sum+=$5} END {print sum+0}' "$CSV_PATH")
                        echo "-----------------------------------------------------"
                        echo " 全局当月总支出: $total_amt 元 / 配额红线: $BUDGET_LIMIT.00 元"

                        # 计算是否超支
                        is_over=$(awk -v total_amt="$total_amt" -v lim="$BUDGET_LIMIT" 'BEGIN {print (total_amt>lim) ? 1 : 0}')
                        if [ "$is_over" -eq 1 ]; then
                            echo -e "${RED}⚠️  [CRITICAL 警告]：系统核心指标发出警报！本月支出已超支！${NC}"
                        else
                            echo -e "${GREEN}√ 当前预算态势安全。${NC}"
                        fi
                    fi
                    read -p "按回车键返回菜单..." dummy
                    ;;
        4)
            echo -e "${YELLOW}--- 自动化运维安全：核心资产快照归档 ---${NC}"
            BACKUP_DIR="$BASE_DIR/data/backups"
            mkdir -p "$BACKUP_DIR"
            BACKUP_FILE="$BACKUP_DIR/records_snapshot_$(date +%Y%m%d_%H%M%S).tar.gz"

            if [ -f "$CSV_PATH" ]; then
                tar -zcvf "$BACKUP_FILE" -C "$BASE_DIR" "data/records.csv"
                echo -e "${GREEN}√ 自动化备份成功！快照打包路径：$BACKUP_FILE${NC}"
                ls -lh "$BACKUP_FILE"
            else
                echo -e "${RED}❌ 错误：核心 CSV 文件尚未建立，拒绝空打包。${NC}"
            fi
            read -p "按回车键返回菜单..." dummy
            ;;
        5)
            echo "优雅断开数据安全通道..."
            exit 0
            ;;
        *)
            echo -e "${RED}无此管理指令，请重新审阅！${NC}"
            sleep 1
            ;;
    esac
done
