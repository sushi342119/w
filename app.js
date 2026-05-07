// ============ 工时记账 App ============
// 数据存储使用 localStorage

const STORE_KEY = 'gsjz_data_v1';
const DEFAULT_DATA = {
  settings: {
    hourRate: 23,        // 每小时时薪
    mealSubsidy: 15,     // 每日餐补
    housingSubsidy: 200, // 每月房补（满勤）
    workType: '小时工',   // 身份
  },
  hours: {},     // { 'YYYY-MM-DD': { shift:'day|rest', hours:8, subsidies:{meal,overtimeHours,other}, note } }
  records: [],   // 记账 [{id, type:'expense|income|neutral', cat, amount, note, time, account}]
  categories: {
    expense: [
      {k:'food',name:'餐饮',icon:'🍴'},
      {k:'fruit',name:'水果',icon:'🍎'},
      {k:'snack',name:'零食',icon:'🍪'},
      {k:'drink',name:'饮品',icon:'🍺'},
      {k:'shop',name:'购物',icon:'🛍️'},
      {k:'traffic',name:'交通',icon:'🚗'},
      {k:'fun',name:'娱乐',icon:'🎬'},
      {k:'medical',name:'医疗',icon:'💊'},
      {k:'edu',name:'教育',icon:'🎓'},
      {k:'house',name:'住房',icon:'🏠'},
      {k:'util',name:'水电费',icon:'⚡'},
      {k:'net',name:'网络',icon:'📶'},
      {k:'phone',name:'话费',icon:'📱'},
      {k:'cloth',name:'服饰',icon:'👕'},
      {k:'beauty',name:'美容',icon:'💄'},
      {k:'gym',name:'健身',icon:'🏋️'},
      {k:'travel',name:'旅行',icon:'✈️'},
      {k:'gift',name:'礼物',icon:'🎁'},
      {k:'pet',name:'宠物',icon:'🐾'},
      {k:'book',name:'图书',icon:'📚'},
      {k:'sport',name:'运动',icon:'🏀'},
      {k:'toy',name:'玩具',icon:'🎮'},
      {k:'stationery',name:'文具',icon:'✏️'},
      {k:'insurance',name:'保险',icon:'🛡️'},
      {k:'invloss',name:'投资损失',icon:'📉'},
      {k:'repay',name:'还款',icon:'💰'},
      {k:'other_e',name:'其他支出',icon:'⚫'},
    ],
    income: [
      {k:'salary',name:'工资',icon:'💵'},
      {k:'bonus',name:'奖金',icon:'🎁'},
      {k:'invest',name:'投资收益',icon:'📈'},
      {k:'parttime',name:'兼职',icon:'💼'},
      {k:'business',name:'生意',icon:'🏪'},
      {k:'redpack',name:'红包',icon:'🧧'},
      {k:'reimburse',name:'报销',icon:'📋'},
      {k:'interest',name:'利息',icon:'💹'},
      {k:'dividend',name:'股息',icon:'📊'},
      {k:'refund',name:'退款',icon:'↩️'},
      {k:'pension',name:'退休金',icon:'👴'},
      {k:'scholar',name:'奖学金',icon:'🏆'},
      {k:'rent',name:'租金收入',icon:'🏡'},
      {k:'royalty',name:'版税',icon:'©️'},
      {k:'donation',name:'捐款收入',icon:'❤️'},
      {k:'other_i',name:'其他收入',icon:'⚫'},
    ],
    neutral: [
      {k:'transfer',name:'转账',icon:'🔄'},
      {k:'saving',name:'存款',icon:'🏦'},
      {k:'withdraw',name:'取款',icon:'💳'},
      {k:'other_n',name:'其他',icon:'⚫'},
    ]
  }
};

let STATE = loadData();

function loadData(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const d = JSON.parse(raw);
    // merge defaults for new fields
    d.settings = Object.assign({}, DEFAULT_DATA.settings, d.settings||{});
    d.hours = d.hours||{};
    d.records = d.records||[];
    d.categories = d.categories||DEFAULT_DATA.categories;
    return d;
  }catch(e){
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}
function saveData(){ localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); }

// ============ Date helpers ============
function pad(n){return n<10?'0'+n:''+n;}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function shortYM(d){return String(d.getFullYear()).slice(2)+'年'+(d.getMonth()+1)+'月';}
function weekdayCN(d){return ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];}
const TODAY = new Date();
let viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
let selectedDate = new Date(TODAY);
let currentTab = 'calendar';

// Lunar (simplified — just show days 初一/初二)
const LUNAR_DAY = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
function lunarLabel(d){
  const dd = d.getDate();
  return LUNAR_DAY[(dd-1)%30];
}

// ============ 法定节假日表（休=节假日，work=调休上班日）============
// 官方放假安排，2025-2026（数据来自国务院办公厅）
const HOLIDAYS = {
  // 2025
  '2025-01-01':{n:'元旦',rest:true},
  '2025-01-28':{n:'除夕',rest:true},'2025-01-29':{n:'春节',rest:true},'2025-01-30':{n:'春节',rest:true},
  '2025-01-31':{n:'春节',rest:true},'2025-02-01':{n:'春节',rest:true},'2025-02-02':{n:'春节',rest:true},
  '2025-02-03':{n:'春节',rest:true},'2025-02-04':{n:'春节',rest:true},
  '2025-01-26':{n:'调休',work:true},'2025-02-08':{n:'调休',work:true},
  '2025-04-04':{n:'清明',rest:true},'2025-04-05':{n:'清明',rest:true},'2025-04-06':{n:'清明',rest:true},
  '2025-05-01':{n:'劳动',rest:true},'2025-05-02':{n:'劳动',rest:true},'2025-05-03':{n:'劳动',rest:true},
  '2025-05-04':{n:'劳动',rest:true},'2025-05-05':{n:'劳动',rest:true},
  '2025-04-27':{n:'调休',work:true},
  '2025-05-31':{n:'端午',rest:true},'2025-06-01':{n:'端午',rest:true},'2025-06-02':{n:'端午',rest:true},
  '2025-10-01':{n:'国庆',rest:true},'2025-10-02':{n:'国庆',rest:true},'2025-10-03':{n:'国庆',rest:true},
  '2025-10-04':{n:'国庆',rest:true},'2025-10-05':{n:'国庆',rest:true},'2025-10-06':{n:'中秋',rest:true},
  '2025-10-07':{n:'国庆',rest:true},'2025-10-08':{n:'国庆',rest:true},
  '2025-09-28':{n:'调休',work:true},'2025-10-11':{n:'调休',work:true},
  // 2026（按惯例估算，正式发布后可修正）
  '2026-01-01':{n:'元旦',rest:true},'2026-01-02':{n:'元旦',rest:true},'2026-01-03':{n:'元旦',rest:true},
  '2026-02-16':{n:'春节',rest:true},'2026-02-17':{n:'春节',rest:true},'2026-02-18':{n:'春节',rest:true},
  '2026-02-19':{n:'春节',rest:true},'2026-02-20':{n:'春节',rest:true},'2026-02-21':{n:'春节',rest:true},
  '2026-02-22':{n:'春节',rest:true},'2026-02-23':{n:'春节',rest:true},'2026-02-24':{n:'春节',rest:true},
  '2026-04-04':{n:'清明',rest:true},'2026-04-05':{n:'清明',rest:true},'2026-04-06':{n:'清明',rest:true},
  '2026-05-01':{n:'劳动',rest:true},'2026-05-02':{n:'劳动',rest:true},'2026-05-03':{n:'劳动',rest:true},
  '2026-05-04':{n:'劳动',rest:true},'2026-05-05':{n:'劳动',rest:true},
  '2026-06-19':{n:'端午',rest:true},'2026-06-20':{n:'端午',rest:true},'2026-06-21':{n:'端午',rest:true},
  '2026-09-25':{n:'中秋',rest:true},'2026-09-26':{n:'中秋',rest:true},'2026-09-27':{n:'中秋',rest:true},
  '2026-10-01':{n:'国庆',rest:true},'2026-10-02':{n:'国庆',rest:true},'2026-10-03':{n:'国庆',rest:true},
  '2026-10-04':{n:'国庆',rest:true},'2026-10-05':{n:'国庆',rest:true},'2026-10-06':{n:'国庆',rest:true},
  '2026-10-07':{n:'国庆',rest:true},'2026-10-08':{n:'国庆',rest:true},
};

// 判断一个日期是不是"应出勤工作日"（周一~五 且 非法定节假日 或 调休上班日）
function isWorkday(d){
  const key = ymd(d);
  const h = HOLIDAYS[key];
  if(h?.rest) return false;
  if(h?.work) return true; // 调休上班
  const wd = d.getDay();
  return wd>=1 && wd<=5; // 周一至周五
}

// 计算某月应出勤天数
function workdaysInMonth(y, m){
  const days = new Date(y, m, 0).getDate();
  let count = 0;
  for(let i=1;i<=days;i++){
    if(isWorkday(new Date(y, m-1, i))) count++;
  }
  return count;
}

// 计算某月实际出勤天数（有工时记录且不是 rest）
function attendedDaysInMonth(y, m){
  const prefix = `${y}-${pad(m)}`;
  let count = 0;
  Object.keys(STATE.hours).forEach(k=>{
    if(!k.startsWith(prefix)) return;
    if(STATE.hours[k].shift==='rest') return;
    count++;
  });
  return count;
}

// 计算某月房补 = 满勤金额 × (实际出勤 / 应出勤)，封顶满勤
function housingSubsidyForMonth(y, m){
  const target = workdaysInMonth(y, m);
  const attended = attendedDaysInMonth(y, m);
  const full = Number(STATE.settings.housingSubsidy)||0;
  const amount = target===0 ? 0 : Math.min(full, full * attended / target);
  return {amount, attended, target, full};
}

// ============ Calendar Rendering ============
function renderCalendar(){
  const grid = document.getElementById('cal-grid');
  const chip = document.getElementById('cal-month-chip');
  chip.textContent = shortYM(viewMonth);
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const firstDay = new Date(y, m, 1);
  let startOffset = firstDay.getDay() - 1; // Mon=0
  if(startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const cells = [];
  // previous month fillers
  const prevMonthDays = new Date(y, m, 0).getDate();
  for(let i=startOffset-1;i>=0;i--){
    cells.push({date:new Date(y, m-1, prevMonthDays-i), other:true});
  }
  for(let i=1;i<=daysInMonth;i++){
    cells.push({date:new Date(y, m, i), other:false});
  }
  while(cells.length%7!==0 || cells.length<42){
    const last = cells[cells.length-1].date;
    const nd = new Date(last); nd.setDate(last.getDate()+1);
    cells.push({date:nd, other:nd.getMonth()!==m});
    if(cells.length>=42) break;
  }
  grid.innerHTML = cells.map(c=>{
    const d = c.date;
    const key = ymd(d);
    const rec = STATE.hours[key];
    const isToday = ymd(d)===ymd(TODAY);
    const isSelected = ymd(d)===ymd(selectedDate);
    const isWeekend = d.getDay()===0 || d.getDay()===6;
    let badgeHTML = '';
    if(isToday && !rec){
      badgeHTML = '<div class="badge today-badge">记工时</div>';
    } else if(rec && rec.shift !== 'rest'){
      const pay = calcDayPay(rec);
      badgeHTML = '<div class="badge income-badge">'+pay.toFixed(0)+'元</div>';
    }
    let cornerHTML = '';
    const holiday = HOLIDAYS[key];
    if(rec){
      if(rec.shift==='rest') cornerHTML = '<div class="corner rest">休</div>';
    } else if(holiday){
      if(holiday.rest) cornerHTML = `<div class="corner rest">${holiday.n.slice(0,2)}</div>`;
      else if(holiday.work) cornerHTML = '<div class="corner work">班</div>';
    }
    return `<div class="cal-cell ${c.other?'other':''} ${isToday?'today':''} ${isSelected?'selected':''} ${isWeekend?'weekend':''} ${holiday?.rest?'holiday':''}" data-date="${key}">
      ${cornerHTML}
      <div class="day">${d.getDate()}</div>
      <div class="lunar">${holiday?holiday.n:lunarLabel(d)}</div>
      ${badgeHTML}
    </div>`;
  }).join('');
  grid.querySelectorAll('.cal-cell').forEach(el=>{
    el.addEventListener('click',()=>{
      const key = el.dataset.date;
      const [yy,mm,dd] = key.split('-').map(Number);
      selectedDate = new Date(yy,mm-1,dd);
      renderCalendar();
      renderTodayCards();
      openHoursSheet(key);
    });
  });
}

function calcDayPay(rec){
  if(!rec || rec.shift==='rest') return 0;
  const s = STATE.settings;
  const hours = Number(rec.hours)||0;
  const subs = rec.subsidies||{};
  const hourPay = hours * (Number(s.hourRate)||0);
  const meal = Number(subs.meal)||0;
  let overtimePay = 0;
  if(subs.overtimeHours !== undefined){
    overtimePay = (Number(subs.overtimeHours)||0) * (Number(s.hourRate)||0);
  } else if(subs.overtime !== undefined){
    overtimePay = Number(subs.overtime)||0;
  }
  const other = Number(subs.other)||0;
  return hourPay + meal + overtimePay + other;
}

// 生成收入公式的组成部分，供今日卡片和工时页共用
// style: 'tag' 用CSS class（浅色卡片）或 'inline' 内联样式（深色卡片）
function payFormulaParts(rec, style='tag'){
  const subs = rec.subsidies||{};
  const s = STATE.settings;
  const hourPay = (Number(rec.hours)||0) * (Number(s.hourRate)||0);
  const parts = [];
  const tag = (cls, inline, text)=> style==='tag'
    ? `<span class="tag ${cls}">${text}</span>`
    : `<span style="background:${inline};padding:1px 6px;border-radius:3px;font-size:11px">${text}</span>`;
  parts.push(tag('hour','#1e40af33;color:#93c5fd',`工时${hourPay.toFixed(0)}元`));
  if(Number(subs.meal)>0) parts.push(tag('meal','#15803d33;color:#86efac',`餐补${subs.meal}元`));
  const otH = Number(subs.overtimeHours)||0;
  if(otH>0){
    const otP = otH*(Number(s.hourRate)||0);
    parts.push(tag('meal','#7c2d1233;color:#fca5a5',`加班${otH}h(${otP.toFixed(0)}元)`));
  } else if(Number(subs.overtime)>0){
    parts.push(tag('meal','#7c2d1233;color:#fca5a5',`加班${subs.overtime}元`));
  }
  if(Number(subs.other)>0) parts.push(tag('','#2a2a2a;color:#ccc',`其他${subs.other}元`));
  return parts.join(' + ');
}

function renderTodayCards(){
  const wrap = document.getElementById('today-cards');
  const key = ymd(selectedDate);
  const rec = STATE.hours[key];
  const wd = weekdayCN(selectedDate);
  const mLabel = (selectedDate.getMonth()+1)+'月'+selectedDate.getDate()+'日';
  const card1 = `
    <div class="info-card">
      <div class="title">${mLabel}</div>
      <div class="hint" style="color:#ccc;font-size:13px;margin-bottom:4px">${wd}</div>
      <div class="hint" style="font-size:12px;color:#888">点击下方按钮开始记录</div>
    </div>`;
  let card2;
  if(rec && rec.shift!=='rest'){
    const pay = calcDayPay(rec);
    const formula = payFormulaParts(rec, 'tag');
    card2 = `
      <div class="info-card">
        <div class="title">${mLabel} 工时</div>
        <div class="triple">
          <div class="cell"><div class="k">班次</div><div class="v" style="font-size:28px">☀️</div><div class="u">(上班)</div></div>
          <div class="cell"><div class="k">工时</div><div class="v">${rec.hours}</div><div class="u">(小时)</div></div>
          <div class="cell"><div class="k">收入</div><div class="v yellow">${pay.toFixed(0)}</div><div class="u">(元)</div></div>
        </div>
        <div class="formula">收入 = ${formula}</div>
        <div class="edit-row"><div class="cat">📁 工资</div><div class="edit" data-edit-hour="${key}">✏️ 编辑</div></div>
      </div>`;
  } else if(rec && rec.shift==='rest'){
    card2 = `
      <div class="info-card">
        <div class="title">${mLabel} 休息</div>
        <div class="hint">今日未工作</div>
        <button class="record-btn" data-record-hour="${key}" style="background:#2a2a2a">修改</button>
      </div>`;
  } else {
    card2 = `
      <div class="info-card">
        <div class="title" style="color:#3b82f6">💡 记${mLabel}工时</div>
        <div class="triple">
          <div class="cell"><div class="k">班次</div><div class="v" style="color:#666">-</div><div class="u">&nbsp;</div></div>
          <div class="cell"><div class="k">工时</div><div class="v" style="color:#666">-</div><div class="u">(小时)</div></div>
          <div class="cell"><div class="k">收入</div><div class="v" style="color:#666">-</div><div class="u">(元)</div></div>
        </div>
        <div class="hint" style="text-align:center;margin:8px 0">记工时，享受赚钱的乐趣</div>
        <button class="record-btn" data-record-hour="${key}">记工时</button>
      </div>`;
  }
  wrap.innerHTML = card1 + card2;
  wrap.querySelectorAll('[data-record-hour]').forEach(b=>b.addEventListener('click',()=>openHoursSheet(b.dataset.recordHour)));
  wrap.querySelectorAll('[data-edit-hour]').forEach(b=>b.addEventListener('click',()=>openHoursSheet(b.dataset.editHour)));
}

// ============ Sheet (bottom popup) ============
function ensureSheetStyle(){
  if(document.getElementById('sheet-style')) return;
  const s = document.createElement('style');
  s.id = 'sheet-style';
  s.textContent = `
  .sheet-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;opacity:0;transition:opacity .25s;display:flex;align-items:flex-end;justify-content:center}
  .sheet-mask.show{opacity:1}
  .sheet{width:100%;max-width:500px;background:#141414;border-top-left-radius:20px;border-top-right-radius:20px;padding:20px 16px calc(16px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .28s ease-out;max-height:90vh;overflow-y:auto}
  .sheet.show{transform:translateY(0)}
  .sheet h3{font-size:16px;font-weight:600;text-align:center;margin-bottom:16px}
  .sheet .drag{width:40px;height:4px;background:#333;border-radius:2px;margin:0 auto 14px}
  .sheet .form-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1f1f1f}
  .sheet .form-row label{min-width:70px;color:#aaa;font-size:14px}
  .sheet .form-row input,.sheet .form-row select{flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px;font-size:14px}
  .sheet .btn-group{display:flex;gap:10px;margin-top:16px}
  .sheet .btn{flex:1;padding:12px;border-radius:8px;border:none;font-size:15px;font-weight:600;cursor:pointer}
  .sheet .btn.primary{background:#ff8c1a;color:#fff}
  .sheet .btn.ghost{background:#2a2a2a;color:#fff}
  .sheet .btn.danger{background:#dc2626;color:#fff}
  .shift-select{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .shift-option{padding:12px;text-align:center;background:#1f1f1f;border-radius:10px;border:2px solid transparent;cursor:pointer;font-size:14px}
  .shift-option.active{border-color:#ff8c1a;background:#2a1f10}
  .shift-option .ic{font-size:24px;margin-bottom:4px}
  .cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
  .cat-item{background:#1f1f1f;border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;border:2px solid transparent;transition:all .15s}
  .cat-item.active{border-color:#ff8c1a}
  .cat-item .icon{font-size:22px;margin-bottom:4px}
  .cat-item .name{font-size:12px;color:#ccc}
  .type-switch{display:flex;gap:6px;background:#1f1f1f;padding:4px;border-radius:20px;margin-bottom:12px}
  .type-switch .t{flex:1;padding:8px;text-align:center;border-radius:16px;font-size:13px;cursor:pointer;color:#888}
  .type-switch .t.active{background:#ff8c1a;color:#fff;font-weight:600}
  .keypad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
  .keypad button{padding:16px 0;background:#1f1f1f;border:none;color:#fff;font-size:18px;border-radius:10px;cursor:pointer;font-weight:500}
  .keypad button.op{background:#2a2a2a;font-size:14px;color:#ccc}
  .keypad button.ok{background:#ff8c1a;grid-row:span 2;font-size:16px;font-weight:600}
  .amount-row{display:flex;justify-content:space-between;align-items:center;padding:12px;background:#1f1f1f;border-radius:10px;margin:10px 0}
  .amount-row .title-input{flex:1;background:transparent;border:none;color:#fff;font-size:15px;outline:none}
  .amount-row .amt{font-size:28px;color:#ff8c1a;font-weight:600}
  .meta-row{display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;font-size:12px;color:#ff8c1a}
  .meta-row span.label{color:#ccc}
  `;
  document.head.appendChild(s);
}
function openSheet(content){
  ensureSheetStyle();
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-mask"><div class="sheet"><div class="drag"></div>${content}</div></div>`;
  const mask = root.querySelector('.sheet-mask');
  const sheet = root.querySelector('.sheet');
  requestAnimationFrame(()=>{ mask.classList.add('show'); sheet.classList.add('show'); });
  mask.addEventListener('click',e=>{if(e.target===mask) closeSheet();});
  return root;
}
function closeSheet(){
  const root = document.getElementById('sheet-root');
  const mask = root.querySelector('.sheet-mask');
  const sheet = root.querySelector('.sheet');
  if(!mask) return;
  mask.classList.remove('show');
  sheet.classList.remove('show');
  setTimeout(()=>{root.innerHTML='';},280);
}

// ============ Hours Sheet ============
function openHoursSheet(dateKey){
  const rec = STATE.hours[dateKey] || {shift:'day',hours:8,subsidies:{meal:STATE.settings.mealSubsidy,overtimeHours:0,other:0},note:''};
  const [yy,mm,dd] = dateKey.split('-').map(Number);
  const d = new Date(yy,mm-1,dd);
  const title = `${mm}月${dd}日 · ${weekdayCN(d)}`;
  const shifts = [
    {k:'day',ic:'☀️',n:'上班'},
    {k:'rest',ic:'☕',n:'休息'},
  ];
  const otOptions = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const curOT = Number(rec.subsidies?.overtimeHours)||0;
  const html = `
    <h3>${title} · 工时记录</h3>
    <div class="shift-select" style="grid-template-columns:repeat(2,1fr)">
      ${shifts.map(s=>`<div class="shift-option ${rec.shift===s.k?'active':''}" data-shift="${s.k}"><div class="ic">${s.ic}</div>${s.n}</div>`).join('')}
    </div>
    <div id="work-inputs">
      <div class="form-row"><label>工作时长</label>
        <div style="flex:1;display:flex;align-items:center;gap:6px">
          <button class="step-btn" data-step="hours" data-dir="-1">－</button>
          <input type="number" step="0.5" id="h-hours" value="${rec.hours||8}" style="flex:1;text-align:center">
          <button class="step-btn" data-step="hours" data-dir="1">＋</button>
          <span style="color:#888;font-size:12px;min-width:30px">小时</span>
        </div>
      </div>
      <div class="form-row"><label>餐补</label>
        <input type="number" id="h-meal" value="${rec.subsidies?.meal??STATE.settings.mealSubsidy}">
        <span style="color:#888;font-size:12px">元</span>
      </div>
      <div class="form-row" style="display:block">
        <label style="display:block;margin-bottom:8px">加班时长</label>
        <div class="ot-options">
          ${otOptions.map(o=>`<div class="ot-opt ${curOT===o?'active':''}" data-ot="${o}">${o===0?'无':o+'h'}</div>`).join('')}
        </div>
      </div>
      <div class="form-row"><label>其他补贴</label>
        <input type="number" id="h-other" value="${rec.subsidies?.other??0}">
        <span style="color:#888;font-size:12px">元</span>
      </div>
      <div class="form-row"><label>备注</label><input type="text" id="h-note" placeholder="可选" value="${(rec.note||'').replace(/"/g,'&quot;')}"></div>
    </div>
    <div style="background:#1a1a1a;border-radius:10px;padding:14px;margin-top:14px">
      <div style="font-size:12px;color:#888;margin-bottom:6px">预计今日收入</div>
      <div style="font-size:28px;font-weight:700;color:#ffa500" id="calc-pay">0</div>
      <div style="font-size:11px;color:#888;margin-top:8px" id="calc-detail"></div>
    </div>
    <div class="btn-group">
      <button class="btn ghost" id="btn-cancel">取消</button>
      ${STATE.hours[dateKey]?'<button class="btn danger" id="btn-delete">删除</button>':''}
      <button class="btn primary" id="btn-save">确定</button>
    </div>
  `;
  openSheet(html);
  ensureStepStyle();
  let shift = rec.shift==='rest'?'rest':'day';
  let otHours = curOT;

  function readInputs(){
    return {
      shift,
      hours: +document.getElementById('h-hours').value||0,
      subsidies: {
        meal: +document.getElementById('h-meal').value||0,
        overtimeHours: otHours,
        other: +document.getElementById('h-other').value||0,
      }
    };
  }
  function updateCalc(){
    const r = readInputs();
    const s = STATE.settings;
    const hourPay = r.hours * (Number(s.hourRate)||0);
    const otPay = r.subsidies.overtimeHours * (Number(s.hourRate)||0);
    const meal = r.subsidies.meal||0;
    const other = r.subsidies.other||0;
    const total = shift==='rest'?0:(hourPay+otPay+meal+other);
    document.getElementById('calc-pay').textContent = total.toFixed(2) + ' 元';
    let parts = [];
    if(shift!=='rest'){
      if(hourPay>0) parts.push(`工时 ${r.hours}h × ${s.hourRate}元 = ${hourPay.toFixed(0)}元`);
      if(meal>0) parts.push(`餐补 ${meal}元`);
      if(otPay>0) parts.push(`加班 ${r.subsidies.overtimeHours}h × ${s.hourRate}元 = ${otPay.toFixed(0)}元`);
      if(other>0) parts.push(`其他 ${other}元`);
    }
    document.getElementById('calc-detail').innerHTML = parts.join(' ＋ ') || '未工作';
  }
  function updateVisibility(){
    const hide = shift==='rest';
    document.getElementById('work-inputs').style.display = hide?'none':'block';
    updateCalc();
  }
  document.querySelectorAll('.shift-option').forEach(el=>{
    el.addEventListener('click',()=>{
      shift = el.dataset.shift;
      document.querySelectorAll('.shift-option').forEach(x=>x.classList.toggle('active', x.dataset.shift===shift));
      updateVisibility();
    });
  });
  document.querySelectorAll('.ot-opt').forEach(el=>{
    el.addEventListener('click',()=>{
      otHours = Number(el.dataset.ot);
      document.querySelectorAll('.ot-opt').forEach(x=>x.classList.toggle('active', Number(x.dataset.ot)===otHours));
      updateCalc();
    });
  });
  document.querySelectorAll('.step-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const inp = document.getElementById('h-hours');
      let v = +inp.value||0;
      v += 0.5 * Number(btn.dataset.dir);
      if(v<0) v=0;
      inp.value = v;
      updateCalc();
    });
  });
  ['h-hours','h-meal','h-other'].forEach(id=>{
    document.getElementById(id).addEventListener('input',updateCalc);
  });
  updateVisibility();
  document.getElementById('btn-cancel').addEventListener('click',closeSheet);
  const del = document.getElementById('btn-delete');
  if(del) del.addEventListener('click',()=>{
    if(confirm('删除这天的工时记录？')){
      delete STATE.hours[dateKey];
      saveData(); closeSheet(); renderCalendar(); renderTodayCards();
      if(currentTab==='hours') renderHoursPage();
    }
  });
  document.getElementById('btn-save').addEventListener('click',()=>{
    const r = readInputs();
    const newRec = {
      shift,
      hours: shift==='rest'?0:r.hours,
      subsidies: shift==='rest'?{meal:0,overtimeHours:0,other:0}:r.subsidies,
      note: document.getElementById('h-note').value||''
    };
    STATE.hours[dateKey] = newRec;
    saveData(); closeSheet();
    renderCalendar(); renderTodayCards();
    if(currentTab==='hours') renderHoursPage();
  });
}

function ensureStepStyle(){
  if(document.getElementById('step-style')) return;
  const s = document.createElement('style');
  s.id = 'step-style';
  s.textContent = `
    .step-btn{width:36px;height:36px;background:#2a2a2a;border:none;color:#fff;border-radius:8px;font-size:18px;cursor:pointer;flex-shrink:0}
    .step-btn:active{background:#ff8c1a}
    .ot-options{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .ot-opt{padding:10px 0;text-align:center;background:#1f1f1f;border-radius:8px;border:2px solid transparent;cursor:pointer;font-size:14px;color:#ccc}
    .ot-opt.active{border-color:#ff8c1a;background:#2a1f10;color:#ff8c1a;font-weight:600}
  `;
  document.head.appendChild(s);
}

// ============ 年月选择器 & 月度工时详情 ============
let pickerYear = new Date().getFullYear();
function openMonthPicker(){
  pickerYear = viewMonth.getFullYear();
  renderMonthPicker();
}
function renderMonthPicker(){
  const y = pickerYear;
  // 统计每个月的工时和收入
  const monthStats = {};
  Object.keys(STATE.hours).forEach(k=>{
    const rec = STATE.hours[k];
    if(rec.shift==='rest') return;
    const [yy,mm] = k.split('-');
    if(+yy!==y) return;
    if(!monthStats[+mm]) monthStats[+mm] = {hours:0,income:0,days:0};
    monthStats[+mm].hours += Number(rec.hours)||0;
    monthStats[+mm].hours += Number(rec.subsidies?.overtimeHours)||0;
    monthStats[+mm].income += calcDayPay(rec);
    monthStats[+mm].days++;
  });
  // 加房补
  for(let m=1;m<=12;m++){
    if(monthStats[m]){
      const hs = housingSubsidyForMonth(y, m);
      monthStats[m].income += hs.amount;
      monthStats[m].housing = hs.amount;
    }
  }
  const monthsHTML = Array.from({length:12},(_,i)=>{
    const m = i+1;
    const s = monthStats[m];
    const active = (viewMonth.getFullYear()===y && viewMonth.getMonth()===i);
    return `
      <div class="mp-month ${active?'active':''} ${s?'has-data':''}" data-m="${m}">
        <div class="mp-m">${m}月</div>
        ${s?`<div class="mp-s">${s.days}天 · ${s.hours.toFixed(1)}h</div><div class="mp-inc">¥${s.income.toFixed(0)}</div>`:'<div class="mp-s" style="color:#555">无记录</div>'}
      </div>`;
  }).join('');
  const html = `
    <div class="mp-year-bar">
      <button class="mp-arr" id="mp-prev">‹</button>
      <div class="mp-year">${y}年</div>
      <button class="mp-arr" id="mp-next">›</button>
    </div>
    <div class="mp-grid">${monthsHTML}</div>
    <div id="mp-detail"></div>
    <div class="btn-group">
      <button class="btn ghost" id="mp-close">关闭</button>
    </div>
  `;
  ensureMPStyle();
  openSheet(html);
  document.getElementById('mp-prev').addEventListener('click',()=>{pickerYear--;renderMPInPlace();});
  document.getElementById('mp-next').addEventListener('click',()=>{pickerYear++;renderMPInPlace();});
  document.getElementById('mp-close').addEventListener('click',closeSheet);
  document.querySelectorAll('.mp-month').forEach(el=>{
    el.addEventListener('click',()=>{
      const m = Number(el.dataset.m);
      viewMonth = new Date(pickerYear, m-1, 1);
      renderCalendar();
      showMonthDetail(pickerYear, m);
    });
  });
}
function renderMPInPlace(){
  // 只重绘年份栏和月份网格，保留详情区和动画
  const root = document.getElementById('sheet-root');
  const sheet = root.querySelector('.sheet');
  if(!sheet) return;
  const y = pickerYear;
  const monthStats = {};
  Object.keys(STATE.hours).forEach(k=>{
    const rec = STATE.hours[k];
    if(rec.shift==='rest') return;
    const [yy,mm] = k.split('-');
    if(+yy!==y) return;
    if(!monthStats[+mm]) monthStats[+mm] = {hours:0,income:0,days:0};
    monthStats[+mm].hours += (Number(rec.hours)||0) + (Number(rec.subsidies?.overtimeHours)||0);
    monthStats[+mm].income += calcDayPay(rec);
    monthStats[+mm].days++;
  });
  for(let m=1;m<=12;m++){
    if(monthStats[m]){
      const hs = housingSubsidyForMonth(y, m);
      monthStats[m].income += hs.amount;
    }
  }
  sheet.querySelector('.mp-year').textContent = y+'年';
  sheet.querySelector('.mp-grid').innerHTML = Array.from({length:12},(_,i)=>{
    const m = i+1;
    const s = monthStats[m];
    const active = (viewMonth.getFullYear()===y && viewMonth.getMonth()===i);
    return `<div class="mp-month ${active?'active':''} ${s?'has-data':''}" data-m="${m}">
      <div class="mp-m">${m}月</div>
      ${s?`<div class="mp-s">${s.days}天 · ${s.hours.toFixed(1)}h</div><div class="mp-inc">¥${s.income.toFixed(0)}</div>`:'<div class="mp-s" style="color:#555">无记录</div>'}
    </div>`;
  }).join('');
  sheet.querySelectorAll('.mp-month').forEach(el=>{
    el.addEventListener('click',()=>{
      const m = Number(el.dataset.m);
      viewMonth = new Date(pickerYear, m-1, 1);
      renderCalendar();
      showMonthDetail(pickerYear, m);
    });
  });
  // 换年时清掉上一年的详情
  sheet.querySelector('#mp-detail').innerHTML = '';
}
function showMonthDetail(y, m){
  const key = `${y}-${pad(m)}`;
  const entries = Object.keys(STATE.hours)
    .filter(k=>k.startsWith(key) && STATE.hours[k].shift!=='rest')
    .sort();
  let totalH=0, totalInc=0, totalOT=0;
  entries.forEach(k=>{
    const r = STATE.hours[k];
    totalH += Number(r.hours)||0;
    totalOT += Number(r.subsidies?.overtimeHours)||0;
    totalInc += calcDayPay(r);
  });
  const rows = entries.length ? entries.map(k=>{
    const r = STATE.hours[k];
    const [yy,mm,dd] = k.split('-').map(Number);
    const d = new Date(yy,mm-1,dd);
    const otH = Number(r.subsidies?.overtimeHours)||0;
    return `
      <div class="mp-row" data-date="${k}">
        <div class="mp-row-date">
          <div class="mp-d">${mm}/${pad(dd)}</div>
          <div class="mp-wd">${weekdayCN(d).slice(1)}</div>
        </div>
        <div class="mp-row-h">
          <div>${r.hours}h${otH>0?` <span style="color:#fca5a5">+${otH}h加班</span>`:''}</div>
          <div class="mp-sub">餐补 ${r.subsidies?.meal||0}元${r.subsidies?.other>0?` · 其他 ${r.subsidies.other}元`:''}</div>
        </div>
        <div class="mp-row-v">¥${calcDayPay(r).toFixed(0)}</div>
      </div>`;
  }).join('') : '<div style="text-align:center;padding:24px;color:#666">该月暂无工时记录</div>';
  const hs = housingSubsidyForMonth(y, m);
  totalInc += hs.amount;
  const housingHTML = hs.target>0 ? `
    <div class="mp-housing">
      <div class="mp-housing-title">🏠 房补</div>
      <div class="mp-housing-body">
        <div>应出勤 <b>${hs.target}</b> 天 · 已出勤 <b style="color:${hs.attended>=hs.target?'#10b981':'#ffa500'}">${hs.attended}</b> 天${hs.attended>=hs.target?'（满勤 ✓）':''}</div>
        <div style="margin-top:4px">本月房补 <b style="color:#ffa500;font-size:18px">¥${hs.amount.toFixed(0)}</b>${hs.attended<hs.target?` <span style="color:#888;font-size:11px">(满勤¥${hs.full})</span>`:''}</div>
      </div>
    </div>` : '';
  const html = `
    <div class="mp-sum">
      <div><div class="mp-sum-k">工作天数</div><div class="mp-sum-v">${entries.length}</div></div>
      <div><div class="mp-sum-k">总工时</div><div class="mp-sum-v">${totalH}${totalOT>0?`<span style="font-size:13px;color:#fca5a5">+${totalOT}</span>`:''}<span style="font-size:13px;color:#888">h</span></div></div>
      <div><div class="mp-sum-k">总收入</div><div class="mp-sum-v" style="color:#ffa500">¥${totalInc.toFixed(0)}</div></div>
    </div>
    ${housingHTML}
    <div class="mp-detail-title">${y}年${m}月 · 每日明细</div>
    <div class="mp-rows">${rows}</div>
  `;
  document.getElementById('mp-detail').innerHTML = html;
  document.querySelectorAll('.mp-row').forEach(el=>{
    el.addEventListener('click',()=>{
      closeSheet();
      setTimeout(()=>openHoursSheet(el.dataset.date), 280);
    });
  });
  // 滚到详情区
  setTimeout(()=>{
    document.getElementById('mp-detail').scrollIntoView({behavior:'smooth',block:'start'});
  },50);
}
function ensureMPStyle(){
  if(document.getElementById('mp-style')) return;
  const s = document.createElement('style');
  s.id = 'mp-style';
  s.textContent = `
    .mp-year-bar{display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:16px}
    .mp-arr{width:36px;height:36px;background:#1f1f1f;border:none;color:#fff;border-radius:50%;font-size:20px;cursor:pointer}
    .mp-year{font-size:20px;font-weight:700;min-width:100px;text-align:center}
    .mp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
    .mp-month{background:#1f1f1f;border-radius:10px;padding:12px 8px;text-align:center;cursor:pointer;border:2px solid transparent;min-height:80px;display:flex;flex-direction:column;justify-content:center}
    .mp-month.has-data{background:#1a2338}
    .mp-month.active{border-color:#ff8c1a}
    .mp-month .mp-m{font-size:15px;font-weight:600;margin-bottom:4px}
    .mp-month .mp-s{font-size:11px;color:#aaa}
    .mp-month .mp-inc{font-size:12px;color:#ffa500;font-weight:600;margin-top:2px}
    .mp-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px;background:#1a1a1a;border-radius:10px;margin-bottom:14px;text-align:center}
    .mp-sum-k{font-size:11px;color:#888;margin-bottom:4px}
    .mp-sum-v{font-size:18px;font-weight:700;color:#fff}
    .mp-detail-title{font-size:14px;font-weight:600;color:#ccc;margin-bottom:10px}
    .mp-rows{max-height:360px;overflow-y:auto}
    .mp-row{display:flex;align-items:center;gap:10px;padding:12px;background:#141414;border-radius:10px;margin-bottom:6px;cursor:pointer;border:1px solid #1f1f1f}
    .mp-row:active{background:#1f1f1f}
    .mp-row-date{min-width:54px;text-align:center}
    .mp-row-date .mp-d{font-size:15px;font-weight:700}
    .mp-row-date .mp-wd{font-size:11px;color:#888}
    .mp-row-h{flex:1;font-size:13px}
    .mp-row-h .mp-sub{font-size:11px;color:#888;margin-top:2px}
    .mp-row-v{font-size:16px;font-weight:700;color:#c9a227}
    .mp-housing{background:#1a2338;border-radius:10px;padding:12px;margin-bottom:12px;border:1px solid #1e3a8a}
    .mp-housing-title{font-size:13px;color:#93c5fd;font-weight:600;margin-bottom:6px}
    .mp-housing-body{font-size:12px;color:#ccc;line-height:1.7}
  `;
  document.head.appendChild(s);
}

// ============ Record (Ledger) Sheet ============
function openRecordSheet(existing){
  let type = existing?.type || 'expense';
  let cat = existing?.cat || '';
  let amount = existing?existing.amount:'0';
  let title = existing?.note || '';
  let recTime = existing?new Date(existing.time):new Date();
  function renderBody(){
    const root = document.getElementById('sheet-root');
    const cats = STATE.categories[type];
    if(!cat && cats.length) cat = cats[0].k;
    const amtDisplay = (typeof amount==='string' && amount==='0')?'0':amount;
    const html = `
      <h3>添加记录</h3>
      <div class="type-switch">
        <div class="t ${type==='expense'?'active':''}" data-type="expense">支出</div>
        <div class="t ${type==='income'?'active':''}" data-type="income">收入</div>
        <div class="t ${type==='neutral'?'active':''}" data-type="neutral">不计收支</div>
      </div>
      <div class="cat-grid">
        ${cats.map(c=>`<div class="cat-item ${cat===c.k?'active':''}" data-cat="${c.k}"><div class="icon">${c.icon}</div><div class="name">${c.name}</div></div>`).join('')}
      </div>
      <div class="amount-row">
        <input class="title-input" id="rec-title" placeholder="输入记录标题" value="${title.replace(/"/g,'&quot;')}">
        <div class="amt" id="rec-amt">${amtDisplay}</div>
      </div>
      <div class="meta-row">
        <div><span class="label">记账时间：</span>${pad(recTime.getMonth()+1)}-${pad(recTime.getDate())} ${pad(recTime.getHours())}:${pad(recTime.getMinutes())}</div>
        <div><span class="label">分类：</span>${(STATE.categories[type].find(c=>c.k===cat)||{}).name||''}</div>
      </div>
      <div class="keypad">
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="back">退格</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="ok" data-k="save">${existing?'保存':'记账'}</button>
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
        <button class="op" data-k="clear">清空</button><button data-k="0">0</button><button data-k=".">.</button>
      </div>
      ${existing?'<button class="btn danger" style="width:100%;margin-top:10px" id="rec-del">删除</button>':''}
    `;
    root.querySelector('.sheet').innerHTML = '<div class="drag"></div>'+html;
    bindSheet();
  }
  function bindSheet(){
    document.querySelectorAll('.type-switch .t').forEach(el=>el.addEventListener('click',()=>{
      type = el.dataset.type; cat=''; renderBody();
    }));
    document.querySelectorAll('.cat-item').forEach(el=>el.addEventListener('click',()=>{
      cat = el.dataset.cat;
      document.querySelectorAll('.cat-item').forEach(x=>x.classList.toggle('active', x.dataset.cat===cat));
    }));
    document.getElementById('rec-title').addEventListener('input',e=>title=e.target.value);
    document.querySelectorAll('.keypad button').forEach(btn=>btn.addEventListener('click',()=>{
      const k = btn.dataset.k;
      let amt = String(amount);
      if(k==='back'){ amt = amt.length<=1?'0':amt.slice(0,-1); }
      else if(k==='clear'){ amt = '0'; }
      else if(k==='.'){ if(!amt.includes('.')) amt += '.'; }
      else if(k==='save'){
        const val = parseFloat(amt)||0;
        if(val<=0){ alert('请输入金额'); return; }
        if(!cat){ alert('请选择分类'); return; }
        const r = existing||{id:Date.now()+'_'+Math.random().toString(36).slice(2,7)};
        r.type=type; r.cat=cat; r.amount=val; r.note=title; r.time=recTime.getTime();
        if(existing){
          const idx = STATE.records.findIndex(x=>x.id===r.id);
          if(idx>=0) STATE.records[idx]=r;
        } else {
          STATE.records.push(r);
        }
        saveData(); closeSheet(); renderCurrentTab();
        return;
      }
      else { if(amt==='0' && k!=='.') amt = k; else amt += k; }
      amount = amt;
      document.getElementById('rec-amt').textContent = amt;
    }));
    const del = document.getElementById('rec-del');
    if(del) del.addEventListener('click',()=>{
      if(confirm('删除此记录？')){
        STATE.records = STATE.records.filter(x=>x.id!==existing.id);
        saveData(); closeSheet(); renderCurrentTab();
      }
    });
  }
  openSheet('');
  renderBody();
}

// ============ Hours Page ============
function renderHoursPage(){
  const wrap = document.getElementById('hours-list');
  const allKeys = Object.keys(STATE.hours).sort((a,b)=>b.localeCompare(a));
  const monthStats = {};
  let totalDays=0, totalHours=0, totalIncome=0, totalHousing=0;
  allKeys.forEach(k=>{
    const rec = STATE.hours[k];
    if(rec.shift==='rest') return;
    const m = k.slice(0,7);
    if(!monthStats[m]) monthStats[m]={days:0,hours:0,income:0,housing:0};
    monthStats[m].days++;
    monthStats[m].hours += Number(rec.hours)||0;
    monthStats[m].hours += Number(rec.subsidies?.overtimeHours)||0;
    monthStats[m].income += calcDayPay(rec);
    totalDays++;
    totalHours += Number(rec.hours)||0;
    totalHours += Number(rec.subsidies?.overtimeHours)||0;
    totalIncome += calcDayPay(rec);
  });
  // 算每个月的房补
  Object.keys(monthStats).forEach(m=>{
    const [y,mo] = m.split('-').map(Number);
    const hs = housingSubsidyForMonth(y, mo);
    monthStats[m].housing = hs.amount;
    monthStats[m].attended = hs.attended;
    monthStats[m].target = hs.target;
    monthStats[m].income += hs.amount;
    totalIncome += hs.amount;
    totalHousing += hs.amount;
  });
  const months = Object.keys(monthStats).sort((a,b)=>b.localeCompare(a));
  const chipHTML = `
    <div style="display:flex;gap:8px;overflow-x:auto;padding:12px 16px;-webkit-overflow-scrolling:touch">
      <div class="stat-chip active" style="min-width:120px;background:#e0f2fe;color:#0369a1;padding:10px;border-radius:10px;text-align:center">
        <div style="font-weight:600">全部</div>
        <div style="font-size:11px;margin-top:4px">工作: ${totalDays}天</div>
        <div style="font-size:11px">工时: ${totalHours}小时</div>
        <div style="font-size:11px">收入: ${totalIncome.toFixed(0)}元</div>
        ${totalHousing>0?`<div style="font-size:11px;color:#0891b2">含房补: ${totalHousing.toFixed(0)}元</div>`:''}
      </div>
      ${months.map(m=>{
        const s = monthStats[m];
        const ym = m.split('-');
        return `<div class="stat-chip" style="min-width:120px;background:#1f1f1f;color:#ccc;padding:10px;border-radius:10px;text-align:center">
          <div style="font-weight:600">${ym[0].slice(2)}年${+ym[1]}月</div>
          <div style="font-size:11px;margin-top:4px">出勤: ${s.attended}/${s.target}天</div>
          <div style="font-size:11px">工时: ${s.hours}小时</div>
          <div style="font-size:11px">收入: ${s.income.toFixed(0)}元</div>
          ${s.housing>0?`<div style="font-size:11px;color:#93c5fd">房补: ${s.housing.toFixed(0)}元</div>`:''}
        </div>`;
      }).join('')}
    </div>`;
  let listHTML = '';
  if(allKeys.length===0){
    listHTML = '<div style="text-align:center;padding:60px 20px;color:#666">还没有工时记录<br><span style="font-size:12px">在日历页点击日期开始记录</span></div>';
  } else {
    listHTML = allKeys.filter(k=>STATE.hours[k].shift!=='rest').map(k=>{
      const rec = STATE.hours[k];
      const [y,m,dd] = k.split('-').map(Number);
      const d = new Date(y,m-1,dd);
      const pay = calcDayPay(rec);
      const formula = payFormulaParts(rec, 'inline');
      return `
        <div style="margin:10px 12px;background:#141414;border-radius:12px;display:flex;overflow:hidden;border:1px solid #1f1f1f" data-edit="${k}">
          <div style="background:#0f766e;color:#fff;padding:20px 8px;writing-mode:vertical-rl;letter-spacing:4px;font-size:12px">${STATE.settings.workType}</div>
          <div style="flex:1;padding:12px">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
              <div><div style="font-size:11px;color:#888">📅 日期</div><div style="font-weight:600">${m}月${dd}日</div><div style="font-size:11px;color:#888">(${weekdayCN(d)})</div></div>
              <div><div style="font-size:11px;color:#888">👥 班次</div><div style="font-size:20px">☀️</div><div style="font-size:11px;color:#888">(上班)</div></div>
              <div><div style="font-size:11px;color:#888">🕐 工时</div><div style="font-weight:600;font-size:18px">${rec.hours}</div><div style="font-size:11px;color:#888">(小时)</div></div>
              <div><div style="font-size:11px;color:#888">💰 收入</div><div style="font-weight:600;font-size:18px;color:#c9a227">${pay.toFixed(0)}</div><div style="font-size:11px;color:#888">(元)</div></div>
            </div>
            <div style="margin-top:10px;font-size:11px;color:#aaa;padding-top:8px;border-top:1px solid #1f1f1f">
              收入 = ${formula}
            </div>
            <div style="margin-top:6px;font-size:12px;color:#888">📁 工资${rec.note?' · '+rec.note:''}</div>
          </div>
        </div>`;
    }).join('');
  }
  wrap.innerHTML = chipHTML + listHTML;
  wrap.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',()=>openHoursSheet(el.dataset.edit)));
}

// ============ Ledger Page ============
let ledgerMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
function renderLedgerPage(){
  const wrap = document.getElementById('ledger-list');
  const y = ledgerMonth.getFullYear(), m = ledgerMonth.getMonth();
  const monthRecs = STATE.records.filter(r=>{
    const d = new Date(r.time);
    return d.getFullYear()===y && d.getMonth()===m;
  }).sort((a,b)=>b.time-a.time);
  // group by day
  const days = {};
  monthRecs.forEach(r=>{
    const d = new Date(r.time);
    const key = ymd(d);
    if(!days[key]) days[key] = {date:d, records:[], income:0, expense:0};
    days[key].records.push(r);
    if(r.type==='expense') days[key].expense += r.amount;
    else if(r.type==='income') days[key].income += r.amount;
  });
  const dayKeys = Object.keys(days).sort().reverse();
  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
      <div style="background:#1f1f1f;color:#ff8c1a;padding:8px 18px;border-radius:18px;border:1px solid #ff8c1a;font-size:13px">全部账单</div>
      <div style="display:flex;align-items:center;gap:12px;font-size:15px">
        <span style="cursor:pointer;color:#888;font-size:18px" id="ledger-prev">‹</span>
        <span>${y}年${m+1}月</span>
        <span style="cursor:pointer;color:#888;font-size:18px" id="ledger-next">›</span>
      </div>
    </div>`;
  let body = '';
  if(dayKeys.length===0){
    body = '<div style="text-align:center;padding:60px 20px;color:#666">本月暂无记录<br><span style="font-size:12px">点击下方+号开始记账</span></div>';
  } else {
    body = dayKeys.map(dk=>{
      const info = days[dk];
      const d = info.date;
      const recs = info.records.map(r=>{
        const cat = (STATE.categories[r.type]||[]).find(c=>c.k===r.cat) || {name:r.cat,icon:'⚪'};
        const amt = r.type==='expense'?'-¥'+r.amount.toFixed(2):r.type==='income'?'+¥'+r.amount.toFixed(2):'¥'+r.amount.toFixed(2);
        const color = r.type==='expense'?'#ef4444':r.type==='income'?'#10b981':'#fff';
        const time = new Date(r.time);
        return `<div data-rid="${r.id}" style="display:flex;align-items:center;gap:12px;padding:12px;background:#141414;border-radius:12px;margin-top:6px;cursor:pointer">
          <div style="width:42px;height:42px;border-radius:50%;background:#1f1f1f;display:flex;align-items:center;justify-content:center;font-size:20px">${cat.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px">${r.note||cat.name}</div>
            <div style="font-size:11px;color:#888">${cat.name} · ${pad(time.getHours())}:${pad(time.getMinutes())}</div>
          </div>
          <div style="color:${color};font-weight:600;font-size:16px">${amt}</div>
        </div>`;
      }).join('');
      return `
        <div style="margin:12px 12px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0f0f0f;border-radius:10px;border:1px solid #1f1f1f">
            <div style="font-weight:700">${pad(d.getMonth()+1)}月${pad(d.getDate())}日</div>
            <div style="font-size:12px;color:#888">收: <span style="color:#10b981">¥${info.income.toFixed(2)}</span>　支: <span style="color:#ef4444">¥${info.expense.toFixed(2)}</span></div>
          </div>
          ${recs}
        </div>`;
    }).join('');
  }
  wrap.innerHTML = header + body;
  document.getElementById('ledger-prev').addEventListener('click',()=>{
    ledgerMonth.setMonth(ledgerMonth.getMonth()-1); renderLedgerPage();
  });
  document.getElementById('ledger-next').addEventListener('click',()=>{
    ledgerMonth.setMonth(ledgerMonth.getMonth()+1); renderLedgerPage();
  });
  wrap.querySelectorAll('[data-rid]').forEach(el=>{
    el.addEventListener('click',()=>{
      const r = STATE.records.find(x=>x.id===el.dataset.rid);
      if(r) openRecordSheet(r);
    });
  });
}

// ============ Stats Page ============
let statsRange = 'month'; // week|month|year
function renderStatsPage(){
  const wrap = document.getElementById('stats-body');
  const now = new Date();
  let start;
  if(statsRange==='week'){
    start = new Date(now); start.setDate(now.getDate()-6);
  } else if(statsRange==='month'){
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  const recs = STATE.records.filter(r=>new Date(r.time)>=start && new Date(r.time)<=now);
  const exp = recs.filter(r=>r.type==='expense');
  const inc = recs.filter(r=>r.type==='income');
  const totalExp = exp.reduce((s,r)=>s+r.amount,0);
  const totalInc = inc.reduce((s,r)=>s+r.amount,0);
  const balance = totalInc - totalExp;
  // by category
  const byCat = {};
  exp.forEach(r=>{
    byCat[r.cat] = (byCat[r.cat]||0) + r.amount;
  });
  const catList = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const total = totalExp || 1;
  // pie chart (SVG)
  const colors = ['#ec4899','#a78bfa','#f87171','#fbbf24','#34d399','#60a5fa','#f472b6','#fb923c','#2dd4bf','#818cf8'];
  let angle = -Math.PI/2;
  const slices = catList.filter(([k,v])=>v/total>=0.02).map(([k,v],i)=>{
    const ratio = v/total;
    const a2 = angle + ratio*Math.PI*2;
    const large = ratio>0.5?1:0;
    const x1 = 100+80*Math.cos(angle), y1 = 100+80*Math.sin(angle);
    const x2 = 100+80*Math.cos(a2), y2 = 100+80*Math.sin(a2);
    const path = `M100,100 L${x1},${y1} A80,80 0 ${large} 1 ${x2},${y2} Z`;
    angle = a2;
    return `<path d="${path}" fill="${colors[i%colors.length]}" stroke="#0a0a0a" stroke-width="2"/>`;
  }).join('');
  const legendRows = catList.slice(0,8).map(([k,v],i)=>{
    const cat = STATE.categories.expense.find(c=>c.k===k) || {name:k,icon:'⚫'};
    const pct = (v/total*100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px;flex:0 0 50%"><div style="width:12px;height:12px;background:${colors[i%colors.length]};border-radius:3px"></div><span style="color:#ccc;font-size:13px">${cat.name}</span><span style="color:#888;font-size:13px;margin-left:auto;margin-right:12px">${pct}%</span></div>`;
  }).join('');
  const listHTML = catList.map(([k,v],i)=>{
    const cat = STATE.categories.expense.find(c=>c.k===k) || {name:k,icon:'⚫'};
    const pct = (v/total*100).toFixed(2);
    return `<div style="background:#141414;border-radius:12px;padding:14px;margin:10px 16px;border:1px solid #1f1f1f">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:50%;background:#1f1f1f;display:flex;align-items:center;justify-content:center;font-size:20px">${cat.icon}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:600">${cat.name}</div><div style="color:#ef4444;font-weight:600">-¥${v.toFixed(2)}</div></div>
          <div style="font-size:12px;color:#888;margin-top:2px">${pct}%</div>
        </div>
      </div>
      <div style="margin-top:8px;height:4px;background:#1f1f1f;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:#ff8c1a"></div></div>
    </div>`;
  }).join('');
  wrap.innerHTML = `
    <div style="padding:16px">
      <div style="background:#141414;border-radius:14px;padding:12px">
        <div style="display:flex;gap:8px;justify-content:space-around">
          ${['week','month','year'].map(r=>{
            const n = r==='week'?'本周':r==='month'?'本月':'本年';
            return `<div class="range-tab" data-range="${r}" style="padding:8px 18px;border-radius:16px;${statsRange===r?'border:1px solid #ff8c1a;color:#ff8c1a':'color:#888'};cursor:pointer">${n}</div>`;
          }).join('')}
        </div>
      </div>
    </div>
    <div style="background:#141414;margin:0 16px;border-radius:14px;padding:20px;display:flex;justify-content:space-around;text-align:center">
      <div><div style="color:#10b981;font-size:22px;font-weight:700">¥${totalInc.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">总收入</div></div>
      <div><div style="color:#ef4444;font-size:22px;font-weight:700">¥${totalExp.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">总支出</div></div>
      <div><div style="color:#fff;font-size:22px;font-weight:700">¥${balance.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">结余</div></div>
    </div>
    ${catList.length?`
    <div style="background:#141414;margin:16px;border-radius:14px;padding:16px">
      <div style="font-weight:600;margin-bottom:12px">支出分类占比</div>
      <svg viewBox="0 0 200 200" style="width:100%;max-width:240px;display:block;margin:0 auto">
        ${slices}
        <circle cx="100" cy="100" r="44" fill="#141414"/>
        <text x="100" y="96" text-anchor="middle" fill="#888" font-size="12">支出</text>
        <text x="100" y="114" text-anchor="middle" fill="#fff" font-size="14" font-weight="600">¥${totalExp.toFixed(0)}</text>
      </svg>
      <div style="display:flex;flex-wrap:wrap;margin-top:12px">${legendRows}</div>
    </div>
    <div style="font-weight:600;margin:16px 16px 0">分类明细</div>
    ${listHTML}
    `:'<div style="text-align:center;padding:40px;color:#666">暂无数据</div>'}
  `;
  wrap.querySelectorAll('.range-tab').forEach(el=>el.addEventListener('click',()=>{
    statsRange = el.dataset.range; renderStatsPage();
  }));
}

// ============ Me Page ============
function renderMePage(){
  const wrap = document.getElementById('me-body');
  const s = STATE.settings;
  wrap.innerHTML = `
    <div style="padding:16px">
      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px">💼 工资规则设置</div>
        <div class="form-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1f1f1f"><label style="min-width:100px;color:#ccc">身份</label><input id="s-worktype" value="${s.workType}" style="flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px"></div>
        <div class="form-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1f1f1f"><label style="min-width:100px;color:#ccc">时薪(元/小时)</label><input type="number" id="s-hourrate" value="${s.hourRate}" style="flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px"></div>
        <div class="form-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1f1f1f"><label style="min-width:100px;color:#ccc">每日餐补</label><input type="number" id="s-meal" value="${s.mealSubsidy}" style="flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px"><span style="color:#888;font-size:12px">元</span></div>
        <div class="form-row" style="display:flex;align-items:center;gap:10px;padding:8px 0"><label style="min-width:100px;color:#ccc">月度房补</label><input type="number" id="s-housing" value="${s.housingSubsidy??200}" style="flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px"><span style="color:#888;font-size:12px">元</span></div>
        <div style="font-size:11px;color:#666;margin-top:8px;line-height:1.6">房补说明：满勤 ${s.housingSubsidy??200} 元，以工作日出勤天数按比例发放。周末和法定节假日不计入应出勤天数。</div>
        <button id="save-settings" style="width:100%;margin-top:12px;padding:12px;background:#ff8c1a;color:#fff;border:none;border-radius:10px;font-weight:600;font-size:15px">保存设置</button>
      </div>
      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">📊 数据统计</div>
        <div style="display:flex;justify-content:space-around;text-align:center">
          <div><div style="font-size:20px;font-weight:700;color:#ff8c1a">${Object.keys(STATE.hours).length}</div><div style="font-size:11px;color:#888">工时记录</div></div>
          <div><div style="font-size:20px;font-weight:700;color:#10b981">${STATE.records.filter(r=>r.type==='income').length}</div><div style="font-size:11px;color:#888">收入条目</div></div>
          <div><div style="font-size:20px;font-weight:700;color:#ef4444">${STATE.records.filter(r=>r.type==='expense').length}</div><div style="font-size:11px;color:#888">支出条目</div></div>
        </div>
      </div>
      <div style="background:#141414;border-radius:14px;padding:16px">
        <div style="font-weight:600;margin-bottom:12px">💾 数据管理</div>
        <button id="export-data" style="width:100%;padding:12px;background:#1f1f1f;color:#fff;border:none;border-radius:10px;font-size:14px;margin-bottom:8px">📤 导出数据(JSON)</button>
        <button id="import-data" style="width:100%;padding:12px;background:#1f1f1f;color:#fff;border:none;border-radius:10px;font-size:14px;margin-bottom:8px">📥 导入数据</button>
        <button id="export-csv" style="width:100%;padding:12px;background:#1f1f1f;color:#fff;border:none;border-radius:10px;font-size:14px;margin-bottom:8px">📊 导出 CSV 表格</button>
        <button id="clear-data" style="width:100%;padding:12px;background:#2a0a0a;color:#ef4444;border:1px solid #7f1d1d;border-radius:10px;font-size:14px">🗑️ 清空所有数据</button>
      </div>
      <div style="text-align:center;color:#555;font-size:11px;margin:20px 0">数据存储在本机浏览器，请定期导出备份</div>
    </div>`;
  document.getElementById('save-settings').addEventListener('click',()=>{
    STATE.settings.workType = document.getElementById('s-worktype').value||'小时工';
    STATE.settings.hourRate = +document.getElementById('s-hourrate').value||0;
    STATE.settings.mealSubsidy = +document.getElementById('s-meal').value||0;
    STATE.settings.housingSubsidy = +document.getElementById('s-housing').value||0;
    saveData();
    alert('已保存');
  });
  document.getElementById('export-data').addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify(STATE,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '搬砖记数据_'+ymd(new Date())+'.json';
    a.click();
  });
  document.getElementById('import-data').addEventListener('click',()=>{
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='.json';
    inp.onchange=e=>{
      const f = e.target.files[0]; if(!f) return;
      const r = new FileReader();
      r.onload=()=>{
        try{
          const d = JSON.parse(r.result);
          if(confirm('将覆盖当前所有数据，继续？')){
            STATE = {
              settings: Object.assign({}, DEFAULT_DATA.settings, d.settings||{}),
              hours: d.hours || {},
              records: d.records || [],
              categories: d.categories || JSON.parse(JSON.stringify(DEFAULT_DATA.categories)),
            };
            saveData();
            alert('已导入');
            renderCurrentTab();
          }
        }catch(err){ alert('导入失败：文件格式错误'); }
      };
      r.readAsText(f);
    };
    inp.click();
  });
  document.getElementById('export-csv').addEventListener('click',()=>{
    const rows = [['日期','类型','分类','金额','备注']];
    STATE.records.forEach(r=>{
      const cat = (STATE.categories[r.type]||[]).find(c=>c.k===r.cat)||{name:r.cat};
      const d = new Date(r.time);
      const t = r.type==='expense'?'支出':r.type==='income'?'收入':'不计';
      rows.push([ymd(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes()), t, cat.name, r.amount.toFixed(2), (r.note||'').replace(/"/g,'""')]);
    });
    rows.push([]);
    rows.push(['日期','班次','工时','餐补','加班时长','其他补贴','当日收入','备注']);
    Object.keys(STATE.hours).sort().forEach(k=>{
      const h = STATE.hours[k];
      const s = h.subsidies||{};
      rows.push([k, h.shift==='rest'?'休息':'上班', h.hours||0, s.meal||0, s.overtimeHours||0, s.other||0, calcDayPay(h).toFixed(2), (h.note||'').replace(/"/g,'""')]);
    });
    // 月度汇总（含房补）
    rows.push([]);
    rows.push(['月份','出勤天数','应出勤','总工时(含加班)','工时收入','房补','月总收入']);
    const monthSet = {};
    Object.keys(STATE.hours).forEach(k=>{
      if(STATE.hours[k].shift==='rest') return;
      monthSet[k.slice(0,7)] = true;
    });
    Object.keys(monthSet).sort().forEach(ym=>{
      const [y,m] = ym.split('-').map(Number);
      const hs = housingSubsidyForMonth(y, m);
      let hours=0, income=0;
      Object.keys(STATE.hours).forEach(k=>{
        if(!k.startsWith(ym)) return;
        const h = STATE.hours[k];
        if(h.shift==='rest') return;
        hours += (Number(h.hours)||0) + (Number(h.subsidies?.overtimeHours)||0);
        income += calcDayPay(h);
      });
      rows.push([ym, hs.attended, hs.target, hours, income.toFixed(2), hs.amount.toFixed(2), (income+hs.amount).toFixed(2)]);
    });
    const csv = '﻿'+rows.map(row=>row.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '搬砖记_'+ymd(new Date())+'.csv';
    a.click();
  });
  document.getElementById('clear-data').addEventListener('click',()=>{
    if(confirm('确定清空所有数据？此操作不可撤销！')){
      if(confirm('最后确认：真的要删除所有工时和记账数据？')){
        STATE = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
        alert('已清空');
        renderCurrentTab();
      }
    }
  });
}

// ============ Tab Navigation ============
function switchTab(name){
  currentTab = name;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.tabbar .tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  renderCurrentTab();
}
function renderCurrentTab(){
  if(currentTab==='calendar'){ renderCalendar(); renderTodayCards(); }
  else if(currentTab==='hours') renderHoursPage();
  else if(currentTab==='ledger') renderLedgerPage();
  else if(currentTab==='stats') renderStatsPage();
  else if(currentTab==='me') renderMePage();
}

// ============ Init ============
function init(){
  document.querySelectorAll('.tabbar .tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
  document.getElementById('add-btn').addEventListener('click',()=>openRecordSheet());
  document.getElementById('cal-month-chip').addEventListener('click',openMonthPicker);
  document.getElementById('ledger-stats-btn').addEventListener('click',()=>switchTab('stats'));
  // 左右滑动切月份（同步选中日为该月1号，避免下方卡片仍停留在旧日期）
  let sx=0, sy=0;
  const cal = document.getElementById('page-calendar');
  cal.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;});
  cal.addEventListener('touchend',e=>{
    const dx = e.changedTouches[0].clientX-sx;
    const dy = e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5){
      if(dx<0) viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 1);
      else viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()-1, 1);
      selectedDate = new Date(viewMonth);
      renderCalendar();
      renderTodayCards();
    }
  });
  renderCurrentTab();
  // register PWA
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded',init);





