from flask import Flask, render_template, jsonify, request
import csv
import os
import uuid
from datetime import datetime, timedelta
from collections import defaultdict

app = Flask(__name__)

CSV_PATH = 'data/records.csv'


def read_records():
    records = []
    try:
        with open(CSV_PATH, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    row['amount'] = float(str(row['amount']).strip())
                    row['date'] = str(row['date']).strip()
                    row['type'] = str(row['type']).strip()
                    row['category'] = str(row['category']).strip()
                    row['note'] = str(row['note']).strip()
                    if 'id' not in row or not row['id']:
                        row['id'] = str(uuid.uuid4())[:8]
                    records.append(row)
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return records


def write_all_records(records):
    if not os.path.exists('data'):
        os.makedirs('data')
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['id', 'date', 'type', 'category', 'amount', 'note']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow({
                'id': r.get('id', str(uuid.uuid4())[:8]),
                'date': r.get('date'),
                'type': r.get('type'),
                'category': r.get('category'),
                'amount': r.get('amount'),
                'note': r.get('note', '')
            })


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/records', methods=['GET'])
def api_records():
    period = request.args.get('period', 'all')
    keyword = request.args.get('keyword', '')

    records = read_records()

    if keyword:
        records = [r for r in records if keyword in r['note'] or keyword in r['category']]

    total_balance = 0.0
    for r in records:
        if r['type'] == '收入':
            total_balance += r['amount']
        else:
            total_balance -= r['amount']

    # ✅ 修复：动态获取当前年月，不再硬编码
    now = datetime.now()
    base_year = now.year
    base_month = now.month
    month_prefix = f"{base_year}-{str(base_month).zfill(2)}"

    filtered_records = []
    for r in records:
        try:
            r_date = datetime.strptime(r['date'], '%Y-%m-%d')
        except ValueError:
            continue

        if period == 'month':
            if r_date.year == base_year and r_date.month == base_month:
                filtered_records.append(r)
        elif period == 'week':
            # ✅ 修复：本周以今天为基准，往前7天
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today - timedelta(days=7)
            if week_start <= r_date <= today:
                filtered_records.append(r)
        else:
            filtered_records.append(r)

    total_income = sum(r['amount'] for r in records if r['type'] == '收入' and r['date'].startswith(month_prefix))
    total_expense = sum(r['amount'] for r in records if r['type'] == '支出' and r['date'].startswith(month_prefix))

    expense_summary = defaultdict(float)
    for r in records:
        if r['type'] == '支出' and r['date'].startswith(month_prefix):
            expense_summary[r['category']] += r['amount']

    monthly_history = defaultdict(float)
    for r in records:
        if r['type'] == '支出':
            try:
                dt = datetime.strptime(r['date'], '%Y-%m-%d')
                key = f"{dt.year}-{str(dt.month).zfill(2)}"
                monthly_history[key] += r['amount']
            except ValueError:
                continue

    return jsonify({
        'balance': total_balance,
        'total_income': total_income,
        'total_expense': total_expense,
        'monthly_net_balance': total_income - total_expense,
        'expense_summary': dict(expense_summary),
        'monthly_history': dict(monthly_history),
        'records': filtered_records,
        'base_year': base_year,
        'base_month': base_month
    })


@app.route('/api/records/all_raw', methods=['GET'])
def api_get_all_records_raw():
    try:
        records = read_records()
        return jsonify(records)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/records', methods=['POST'])
def api_add_record():
    try:
        data = request.json
        records = read_records()
        new_record = {
            'id': str(uuid.uuid4())[:8],
            'date': data.get('date'),
            'type': data.get('type'),
            'category': data.get('category'),
            'amount': float(data.get('amount')),
            'note': data.get('note', '')
        }
        records.append(new_record)
        write_all_records(records)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/records/delete', methods=['POST'])
def api_delete_record():
    try:
        target_id = request.json.get('id')
        records = read_records()
        new_records = [r for r in records if r.get('id') != target_id]
        write_all_records(new_records)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/records/edit', methods=['POST'])
def api_edit_record():
    try:
        data = request.json
        target_id = data.get('id')
        new_amount = data.get('amount')
        new_note = data.get('note')
        records = read_records()
        for r in records:
            if r.get('id') == target_id:
                if new_amount:
                    r['amount'] = float(new_amount)
                if new_note:
                    r['note'] = new_note
        write_all_records(records)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(port=8080, debug=True)