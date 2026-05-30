let currentPeriod = 'all';
let globalBudgetLimit = parseFloat(localStorage.getItem('user_monthly_budget')) || 2500.0;
let wishGoalName = localStorage.getItem('user_wish_name') || '毕业旅行储备基金';
let wishGoalCost = parseFloat(localStorage.getItem('user_wish_cost')) || 2000.0;
let wishSavedAmount = parseFloat(localStorage.getItem('user_wish_saved_amt')) || 0.0;
let achievedWishes = JSON.parse(localStorage.getItem('user_achieved_wishes')) || ["🎓 毕业照西装", "🎧 降噪耳机"];

let walletTotalBalance = 0;
let monthlyRemainQuota = 0;
let globalRawRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    initUIValues();

    // 先加载全量数据，保证配额计算准确
    fetch('/api/records/all_raw')
        .then(res => res.json())
        .then(records => {
            globalRawRecords = records;
            loadRecords();
        });

    initFireworksCanvas();

    document.getElementById('recordForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRecord();
    });
});

function initUIValues() {
    document.getElementById('budget-limit-label').innerText = globalBudgetLimit.toFixed(2);
    document.getElementById('input-budget-limit').value = globalBudgetLimit;
    document.getElementById('wish-name-input').value = wishGoalName;
    document.getElementById('wish-cost-input').value = wishGoalCost;
    document.getElementById('wish-name-label').innerText = wishGoalName;
    document.getElementById('wish-cost-label').innerText = wishGoalCost.toFixed(2);
    renderWishBadgesWall();
}

function renderWishBadgesWall() {
    const wall = document.getElementById('history-wishes-badges');
    if(!wall) return;
    wall.innerHTML = '';
    if (achievedWishes.length === 0) {
        wall.innerHTML = '<span style="font-size:11px; color:#b2b8b6; font-style:italic;">虚位以待，存钱拔草吧</span>';
        return;
    }
    achievedWishes.forEach(w => {
        const span = document.createElement('span');
        span.className = 'wish-badge';
        span.innerText = w;
        wall.appendChild(span);
    });
}

function updateBudgetLimit() {
    const inputVal = document.getElementById('input-budget-limit').value;
    if (inputVal && parseFloat(inputVal) >= 0) {
        globalBudgetLimit = parseFloat(inputVal);
        localStorage.setItem('user_monthly_budget', globalBudgetLimit);
        document.getElementById('budget-limit-label').innerText = globalBudgetLimit.toFixed(2);
        loadRecords();
    }
}

function autoCarryOverSurplus(){
    if(monthlyRemainQuota <= 0){
        alert("本月暂无剩余配额可转入！");
        return;
    }
    walletTotalBalance += monthlyRemainQuota;
    monthlyRemainQuota = 0;
    alert(`成功将本月剩余配额转入钱包总资产！`);
    loadRecords();
}

function saveWishGoal() {
    const nameVal = document.getElementById('wish-name-input').value;
    const costVal = document.getElementById('wish-cost-input').value;
    if (nameVal && costVal && parseFloat(costVal) > 0) {
        wishGoalName = nameVal;
        wishGoalCost = parseFloat(costVal);
        localStorage.setItem('user_wish_name', wishGoalName);
        localStorage.setItem('user_wish_cost', wishGoalCost);
        document.getElementById('wish-name-label').innerText = wishGoalName;
        document.getElementById('wish-cost-label').innerText = wishGoalCost.toFixed(2);
        refreshWishPoolDisplay();
    }
}

function injectMoneyToWish() {
    const amtInput = document.getElementById('wish-inject-amount');
    const val = parseFloat(amtInput.value);
    if (!val || val <= 0) {
        alert("请输入投币金额！");
        return;
    }
    if (val > walletTotalBalance) {
        alert("钱包总资产不足，无法投币！");
        return;
    }

    wishSavedAmount += val;
    localStorage.setItem('user_wish_saved_amt', wishSavedAmount);
    amtInput.value = '';

    const today = new Date().toISOString().split('T')[0];
    fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: today,
            type: '支出',
            category: '储蓄',
            amount: val,
            note: `存入【${wishGoalName}】心愿储蓄`
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            loadRecords();
            refreshWishPoolDisplay();
            alert(`成功从钱包总资产转出 ￥${val} 存入心愿储蓄！`);
        }
    })
    .catch(err => console.error("储蓄投币失败:", err));
}

function refreshWishPoolDisplay() {
    let pct = (wishSavedAmount / wishGoalCost) * 100;
    if (pct > 100) pct = 100;

    const progressFill = document.getElementById('wish-progress-fill');
    if(progressFill) progressFill.style.width = `${pct.toFixed(1)}%`;

    const card = document.getElementById('wishPoolCard');
    const injectCtrl = document.getElementById('wishInjectControl');
    const successZone = document.getElementById('wish-success-zone');

    if (pct >= 100) {
        if(card) card.classList.add('gold-success');
        if(injectCtrl) injectCtrl.style.display = 'none';
        if(successZone) successZone.style.display = 'block';
    } else {
        if(card) card.classList.remove('gold-success');
        if(injectCtrl) injectCtrl.style.display = 'flex';
        if(successZone) successZone.style.display = 'none';
    }
}

function harvestWish() {
    createFireworksExplosion();
    achievedWishes.unshift(`🎉 ${wishGoalName}`);
    localStorage.setItem('user_achieved_wishes', JSON.stringify(achievedWishes));

    wishSavedAmount = 0;
    localStorage.setItem('user_wish_saved_amt', wishSavedAmount);
    wishGoalName = "新学期愿望清单";
    wishGoalCost = 1000;
    localStorage.setItem('user_wish_name', wishGoalName);
    localStorage.setItem('user_wish_cost', wishGoalCost);

    initUIValues();
    refreshWishPoolDisplay();
}

function changePeriod(buttonElement) {
    const buttons = buttonElement.parentElement.querySelectorAll('.capsule-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');
    currentPeriod = buttonElement.getAttribute('data-period');
    loadRecords();
}

// ====================== 核心修复：剩余配额永远只算本月 ======================
function loadRecords() {
    const keyword = document.getElementById('keywordFilter').value;

    fetch(`/api/records?period=${currentPeriod}&keyword=${encodeURIComponent(keyword)}`)
        .then(res => res.json())
        .then(data => {
            // 1. 固定计算【本月】支出，不受筛选影响
            const now = new Date();
            const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const thisMonthNonSavingExpense = (globalRawRecords || []).filter(r =>
                r.date && r.date.startsWith(thisMonthStr) &&
                r.type === '支出' &&
                r.category !== '储蓄'
            ).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

            // 2. 计算剩余配额（永远不变）
            monthlyRemainQuota = globalBudgetLimit - thisMonthNonSavingExpense;

            // 3. 页面渲染
            walletTotalBalance = data.balance;
            document.getElementById('wallet-total-balance').innerText = walletTotalBalance.toFixed(2);
            document.getElementById('total-income').innerText = `￥${data.total_income.toFixed(2)}`;
            document.getElementById('total-expense').innerText = `￥${data.total_expense.toFixed(2)}`;
            document.getElementById('balance').innerText = `￥${data.monthly_net_balance.toFixed(2)}`;
            document.getElementById('remaining-budget').innerText = monthlyRemainQuota.toFixed(2);

            let percent = (thisMonthNonSavingExpense / globalBudgetLimit) * 100;
            document.getElementById('budget-progress-fill').style.width = `${percent > 100 ? 100 : percent}%`;
            document.getElementById('budget-warn').style.display = monthlyRemainQuota < 0 ? 'block' : 'none';

            renderSurvivalCard(monthlyRemainQuota);
            refreshWishPoolDisplay();
            loadGlobalAnalysisData();

            const tbody = document.getElementById('records-tbody');
            tbody.innerHTML = '';
            if (data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#8e9492; padding:20px;">账本里空空如也</td></tr>';
                return;
            }

            data.records.forEach(r => {
                const tr = document.createElement('tr');
                const amtSign = r.type === '支出' ? '-' : '+';
                const amtColor = r.type === '支出' ? 'var(--morandi-pink)' : 'var(--morandi-green)';
                tr.innerHTML = `
                    <td>${r.date.substring(5)}</td>
                    <td><span class="badge-cozy-cat">${r.category}</span></td>
                    <td style="color: ${amtColor}; font-weight:600;">${amtSign}${parseFloat(r.amount).toFixed(2)}</td>
                    <td style="color:#8e9492;">${escapeHtml(r.note) || '-'}</td>
                    <td class="action-cell">
                        <button class="btn-action-edit" onclick="openCozyModal('${r.id}', '${r.amount}', '${r.note}')">修改</button>
                        <button class="btn-action-del" onclick="openDeleteModal('${r.id}')">删除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }).catch(err => console.error("加载数据出错:", err));
}

function renderSurvivalCard(remainingBudget) {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - today.getDate() + 1;

    document.getElementById('survival-days-count').innerText = remainingDays;
    const dailyBudget = remainingBudget > 0 ? (remainingBudget / remainingDays) : 0;
    document.getElementById('survival-daily-budget').innerText = `￥${dailyBudget.toFixed(2)}`;

    const tag = document.getElementById('survival-status-tag');
    if (remainingBudget <= 0) {
        tag.innerText = "🚨 临界生存，开启吃土模式";
        tag.style.backgroundColor = "#faf0e8"; tag.style.color = "#ba8b72";
    } else if (dailyBudget > 80) {
        tag.innerText = "🌿 财富自由，加个鸡腿";
        tag.style.backgroundColor = "#edf7f4"; tag.style.color = "#5c9985";
    } else if (dailyBudget >= 30) {
        tag.innerText = "⚠️ 稳健前行，食堂友好";
        tag.style.backgroundColor = "#fffbf0"; tag.style.color = "#cca15c";
    } else {
        tag.innerText = "📉 节衣缩食，清淡一点";
        tag.style.backgroundColor = "#faf0e8"; tag.style.color = "#ba8b72";
    }
}

function loadGlobalAnalysisData() {
    fetch('/api/records/all_raw')
        .then(res => res.json())
        .then(records => {
            globalRawRecords = records;
            initMonthSelector();
            const selector = document.getElementById('month-selector');
            const selectedMonth = selector ? selector.value : 'all';
            renderCategoryDiagnostic(selectedMonth); // 数据加载完再渲染饼图
            renderDynamicMonthlyChart(records);
        })
        .catch(err => console.error("加载分析数据出错:", err));
}

function initMonthSelector() {
    const selector = document.getElementById('month-selector');
    if (!selector) return;
    const currentSelection = selector.value;
    const months = [...new Set(globalRawRecords.filter(r => r.date).map(r => r.date.substring(0, 7)))].sort().reverse();

    selector.innerHTML = '<option value="all">全部月份</option>';
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        const [y, m] = month.split('-');
        option.text = `${y}年${m}月`;
        selector.appendChild(option);
    });

    if (months.includes(currentSelection)) {
        selector.value = currentSelection;
    } else if (currentSelection !== 'all' && months.length > 0) {
        selector.value = months[0];
    }
}

function renderCategoryDiagnostic(selectedMonth) {
    const barsContainer = document.getElementById('category-progress-bars');
    const pieCanvas = document.getElementById('categoryPieChart');
    if (!barsContainer || !pieCanvas) return;
    barsContainer.innerHTML = '';

    const filteredExpenses = globalRawRecords.filter(r => {
        if (r.type !== '支出') return false;
        if (selectedMonth === 'all') return true;
        return r.date && r.date.startsWith(selectedMonth);
    });

    let categoryMap = {};
    let totalExpense = 0;
    filteredExpenses.forEach(r => {
        let amt = parseFloat(r.amount) || 0;
        let cat = r.category || '其它';
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        totalExpense += amt;
    });

    if (totalExpense === 0) {
        let periodText = selectedMonth === 'all' ? '全部记录中' : `${selectedMonth.split('-')[1]}月份`;
        barsContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">📅 ${periodText}暂无消费开支明细</div>`;
        drawEmptyPieChart(pieCanvas);
        return;
    }

    const morandiColors = [
        'var(--morandi-green)',
        'var(--morandi-blue)',
        'var(--morandi-pink)',
        'var(--morandi-orange)',
        '#c2b2a2',
        '#b8b0a8',
        '#a8c2b8'
    ];
    const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    sortedCategories.forEach(([catName, catAmt], index) => {
        let percent = ((catAmt / totalExpense) * 100).toFixed(1);
        let color = morandiColors[index % morandiColors.length];
        const rowHtml = `
            <div class="progress-row" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
                <div class="progress-info" style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span><strong>${catName}</strong> <span style="color: var(--text-muted);">￥${catAmt.toFixed(2)}</span></span>
                    <span style="font-weight: 600; color: ${color};">${percent}%</span>
                </div>
                <div class="progress-bar-bg" style="width: 100%; height: 8px; background-color: #f0ede4; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar-fill" style="width: ${percent}%; height: 100%; background-color: ${color}; border-radius: 4px;"></div>
                </div>
            </div>
        `;
        barsContainer.insertAdjacentHTML('beforeend', rowHtml);
    });

    drawPieChart(pieCanvas, sortedCategories, morandiColors, totalExpense);
}

function drawEmptyPieChart(svgEl) {
    if (!svgEl) return;
    const NS = 'http://www.w3.org/2000/svg';
    svgEl.innerHTML = '';
    const cx = 80, cy = 80;

    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', 60);
    bg.setAttribute('fill', '#f0ede4');
    svgEl.appendChild(bg);

    const hole = document.createElementNS(NS, 'circle');
    hole.setAttribute('cx', cx); hole.setAttribute('cy', cy); hole.setAttribute('r', 36);
    hole.setAttribute('fill', '#ffffff');
    svgEl.appendChild(hole);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', cx); t.setAttribute('y', cy);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('font-size', '11'); t.setAttribute('fill', '#8e9492');
    t.textContent = '暂无数据';
    svgEl.appendChild(t);
}

function drawPieChart(svgEl, categories, colors, total) {
    if (!svgEl) return;
    const NS = 'http://www.w3.org/2000/svg';
    svgEl.innerHTML = '';

    const cx = 80, cy = 80, outerR = 60, innerR = 36;

    // 解析 CSS 变量为实际颜色
    const colorResolved = (() => {
        const style = getComputedStyle(document.documentElement);
        return {
            'var(--morandi-green)':  style.getPropertyValue('--morandi-green').trim()  || '#9ca998',
            'var(--morandi-blue)':   style.getPropertyValue('--morandi-blue').trim()   || '#a3b8cc',
            'var(--morandi-pink)':   style.getPropertyValue('--morandi-pink').trim()   || '#d9bca3',
            'var(--morandi-orange)': style.getPropertyValue('--morandi-orange').trim() || '#e6b79c',
        };
    })();
    const resolveColor = c => colorResolved[c] || c;

    // SVG defs：发光滤镜
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
        <filter id="pie-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
    svgEl.appendChild(defs);

    // 中心标签（会在 hover 时动态更新）
    const mkText = (content, y, size, weight, fill) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx); t.setAttribute('y', y);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-size', size); t.setAttribute('font-weight', weight);
        t.setAttribute('fill', fill); t.textContent = content;
        return t;
    };
    const tLabel = mkText('消费占比', cy - 10, '10', '500', '#8e9492');
    const tAmt   = mkText(`￥${total.toFixed(0)}`, cy + 10, '12', 'bold', '#4a4e4d');

    // 极坐标转笛卡尔
    const polar = (angleDeg, r) => {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    // 构建扇形 path（楔形，用于实心饼图 + 环形打孔）
    const wedgePath = (startDeg, endDeg) => {
        const s1 = polar(startDeg, outerR), e1 = polar(endDeg, outerR);
        const s2 = polar(endDeg, innerR),  e2 = polar(startDeg, innerR);
        const large = (endDeg - startDeg) > 180 ? 1 : 0;
        return [
            `M ${s1.x} ${s1.y}`,
            `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
            `L ${s2.x} ${s2.y}`,
            `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`,
            'Z'
        ].join(' ');
    };

    const gap = categories.length > 1 ? 1.5 : 0; // 扇区间隙（度）
    let startDeg = 0;
    const slices = [];

    categories.forEach(([catName, catAmt], index) => {
        const spanDeg = (catAmt / total) * 360;
        const endDeg  = startDeg + spanDeg - gap;
        const rawColor = colors[index % colors.length];
        const color    = resolveColor(rawColor);

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', wedgePath(startDeg, Math.max(startDeg + 0.5, endDeg)));
        path.setAttribute('fill', color);
        path.style.cursor = 'pointer';
        path.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        path.style.transformOrigin = `${cx}px ${cy}px`;

        path.addEventListener('mouseenter', () => {
            // 放大当前扇区 + 发光
            path.style.transform = 'scale(1.06)';
            path.setAttribute('filter', 'url(#pie-glow)');
            // 其余扇区变淡
            slices.forEach(s => { if (s !== path) s.style.opacity = '0.3'; });
            // 中心显示该分类
            const pct = ((catAmt / total) * 100).toFixed(1);
            tLabel.textContent = `${catName} ${pct}%`;
            tLabel.setAttribute('fill', color);
            tAmt.textContent = `￥${catAmt.toFixed(2)}`;
        });

        path.addEventListener('mouseleave', () => {
            path.style.transform = '';
            path.removeAttribute('filter');
            slices.forEach(s => { s.style.opacity = '1'; });
            tLabel.textContent = '消费占比';
            tLabel.setAttribute('fill', '#8e9492');
            tAmt.textContent = `￥${total.toFixed(0)}`;
        });

        slices.push(path);
        svgEl.appendChild(path);
        startDeg += spanDeg;
    });

    // 中心标签层叠在扇区上方
    svgEl.appendChild(tLabel);
    svgEl.appendChild(tAmt);
}

function renderDynamicMonthlyChart(records) {
    const container = document.getElementById('monthly-bars-dom');
    if (!container) return;
    container.innerHTML = '';
    const monthlyData = {};
    records.forEach(r => {
        if (r.type === '支出' && r.date) {
            const monthStr = r.date.substring(0, 7);
            monthlyData[monthStr] = (monthlyData[monthStr] || 0) + parseFloat(r.amount);
        }
    });

    let sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length === 0) {
        container.innerHTML = '<div style="width:100%; text-align:center; color:var(--text-muted); font-size:12px; margin-bottom: 20px;">还没有历史数据积淀哦</div>';
        return;
    }
    sortedMonths = sortedMonths.slice(-5);
    const peakAmount = Math.max(...sortedMonths.map(m => monthlyData[m]), 100);

    sortedMonths.forEach((mStr, index) => {
        const amt = monthlyData[mStr];
        const heightPercentage = amt > 0 ? (amt / peakAmount) * 100 : 0;
        const isLatest = (index === sortedMonths.length - 1);
        const mName = parseInt(mStr.split('-')[1]) + '月';
        const col = document.createElement('div');
        col.className = `monthly-col ${isLatest ? 'is-current' : ''}`;
        col.innerHTML = `
            <div class="monthly-track" data-hint="${mName}支出: ￥${amt.toFixed(2)}">
                <div class="monthly-bar-fill" style="height: ${Math.max(heightPercentage, amt > 0 ? 5 : 0)}%; background-color: ${isLatest ? 'var(--morandi-green)' : '#c3cbd6'};"></div>
            </div>
            <span class="monthly-date-label" style="font-weight: ${isLatest ? '600' : '400'};">${mName}</span>
        `;
        container.appendChild(col);
    });
}

function submitRecord() {
    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const amount = document.getElementById('amount').value;
    const note = document.getElementById('note').value;

    fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, category, amount, note })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('amount').value = '';
            document.getElementById('note').value = '';
            loadRecords();
        }
    });
}

function openCozyModal(id, amt, note) {
    document.getElementById('edit-record-id').value = id;
    document.getElementById('edit-amount').value = amt;
    document.getElementById('edit-note').value = note === '-' ? '' : note;
    document.getElementById('cozyModalOverlay').classList.add('active');
}
function closeCozyModal() { document.getElementById('cozyModalOverlay').classList.remove('active'); }
function submitCozyEdit() {
    const id = document.getElementById('edit-record-id').value;
    const amount = document.getElementById('edit-amount').value;
    const note = document.getElementById('edit-note').value;
    fetch(`/api/records/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, amount, note })
    }).then(() => { closeCozyModal(); loadRecords(); });
}
function openDeleteModal(id) {
    document.getElementById('delete-record-id').value = id;
    document.getElementById('cozyDeleteOverlay').classList.add('active');
}
function closeDeleteModal() { document.getElementById('cozyDeleteOverlay').classList.remove('active'); }
function submitCozyDelete() {
    const id = document.getElementById('delete-record-id').value;
    fetch(`/api/records/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }).then(() => { closeDeleteModal(); loadRecords(); });
}

let canvas, ctx, particles = [];
function initFireworksCanvas() {
    canvas = document.getElementById('fireworksCanvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}
function resizeCanvas() { if(canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } }

function createFireworksExplosion() {
    const colors = ['#9ca998', '#d9bca3', '#a3b8cc', '#e6b79c', '#f1c40f', '#e67e22'];
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    for (let i = 0; i < 120; i++) {
        particles.push({
            x: startX, y: startY,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 6 + 2,
            radius: Math.random() * 3 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1, decay: Math.random() * 0.015 + 0.01
        });
    }
    requestAnimationFrame(updateFireworksFrame);
}

function updateFireworksFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
        if (p.alpha > 0) {
            alive = true;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed + 0.9;
            p.alpha -= p.decay;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.restore();
        }
    });
    if (alive) requestAnimationFrame(updateFireworksFrame);
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}