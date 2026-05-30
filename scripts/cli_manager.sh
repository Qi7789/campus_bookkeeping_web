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
    echo " 4. [维护] 一键一键安全备份账目底层数据 (tar工具)"
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
            echo -e "${YELLOW}合规选项清单：[餐饮/购物/生活费/交通/转账/水电]${NC}"
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

            # 防错位换行符对齐纠正
            if [ -f "$CSV_PATH" ] && [ -s "$CSV_PATH" ]; then
                last_char=$(tail -c 1 "$CSV_PATH")
                if [ "$last_char" != "" ]; then echo "" >> "$CSV_PATH"; fi
            else
                echo "date,type,category,amount,note" > "$CSV_PATH"
            fi

            echo "$r_date,$r_type,$r_cat,$r_amount,$r_note" >> "$CSV_PATH"
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

                # 极其华丽的高分硬核 awk 字符统计可视化逻辑
                awk -F',' '
                NR>1 && $2=="支出" {sum[$3]+=$4}
                END {
                    # 先找出分类最大值，以此为基准比例尺（防止柱子爆出屏幕）
                    max_val = 0;
                    for(cat in sum) { if(sum[cat] > max_val) max_val = sum[cat] }
                    if(max_val == 0) max_val = 1;

                    # 循环输出条形图
                    for(cat in sum) {
                        printf " %-16s | %-12.2f | ", cat, sum[cat];
                        # 计算需要打印多少个 ■ 符号 (最大比例缩放到 20 个字符宽)
                        bars = int((sum[cat] / max_val) * 20);
                        for(i=0; i<bars; i++) printf "■";
                        printf "\n";
                    }
                }' "$CSV_PATH"

                # 2000元超支预警横向综合对比
                total_exp=$(awk -F',' 'NR>1 && $2=="支出" {sum+=$4} END {print sum+0}' "$CSV_PATH")
                echo "-----------------------------------------------------"
                echo " 全局当月总支出: $total_exp 元 / 配额红线: $BUDGET_LIMIT.00 元"

                is_over=$(awk -v exp="$total_exp" -v lim="$BUDGET_LIMIT" 'BEGIN {print (exp>lim) ? 1 : 0}')
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
                # 完美结合 Linux 原生 tar 命令进行压缩持久化归档
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