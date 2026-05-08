// ============ 工时记账 App ============
// 数据存储使用 localStorage

const STORE_KEY = 'gsjz_data_v1';
const DEFAULT_DATA = {
  settings: {
    hourRate: 23,         // 每小时时薪
    mealSubsidy: 15,      // 每日餐补
    housingSubsidy: 200,  // 每月房补（满勤）
    workType: '小时工',    // 身份
    themeColor: '#ff8c1a',// 主题色
    payday: 10,           // 发薪日（每月X号）
    cycleStartDay: 1,     // 考勤周期起始日
    savingsGoal: 0,       // 储蓄目标金额
    savingsGoalName: '',  // 储蓄目标名称
    autoIncomeFromHours: true, // 工时→记账自动生成
    backupReminderAt: 0,  // 上次提醒备份的时间戳
    backupInterval: 30,   // 备份提醒间隔（天）
  },
  hours: {},     // { 'YYYY-MM-DD': { shift:'day|rest', hours:8, subsidies:{meal,overtimeHours,other}, note } }
  records: [],   // 记账 [{id, type:'expense|income|neutral', cat, amount, note, time, account, fromHours?}]
  budgets: {},   // { catKey: monthLimit } 各分类月度预算
  accounts: [    // 账户/钱包
    {k:'wechat',name:'微信',icon:'💚'},
    {k:'alipay',name:'支付宝',icon:'💙'},
    {k:'cash',name:'现金',icon:'💵'},
    {k:'card',name:'银行卡',icon:'💳'},
  ],
  templates: [], // 记账常用模板 [{id,type,cat,amount,note,account}]
  undoStack: [], // 撤销栈（只保留最近20条）
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
    d.settings = Object.assign({}, DEFAULT_DATA.settings, d.settings||{});
    d.hours = d.hours||{};
    d.records = d.records||[];
    d.categories = d.categories||DEFAULT_DATA.categories;
    d.budgets = d.budgets||{};
    d.accounts = d.accounts && d.accounts.length ? d.accounts : JSON.parse(JSON.stringify(DEFAULT_DATA.accounts));
    d.templates = d.templates||[];
    d.undoStack = d.undoStack||[];
    // 清除任何残留的"刚导入"标记
    d.records.forEach(r=>{ if(r.imported) delete r.imported; });
    return d;
  }catch(e){
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}
function saveData(){
  // undoStack 只在内存，不持久化（避免 localStorage 被快照撑爆）
  const toSave = Object.assign({}, STATE, {undoStack: []});
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify(toSave));
  }catch(e){
    if(e.name==='QuotaExceededError'){
      showToast && showToast('💾 存储已满，请导出 JSON 备份后清理');
    }
  }
}

// 撤销栈：保存一个快照（限制深度，避免占爆 localStorage）
function pushUndo(desc){
  STATE.undoStack.push({
    t: Date.now(),
    desc,
    snapshot: {
      hours: JSON.parse(JSON.stringify(STATE.hours)),
      records: JSON.parse(JSON.stringify(STATE.records)),
    }
  });
  if(STATE.undoStack.length>20) STATE.undoStack.shift();
}
function undoLast(){
  const last = STATE.undoStack.pop();
  if(!last){ showToast('没有可撤销的操作'); return false; }
  STATE.hours = last.snapshot.hours;
  STATE.records = last.snapshot.records;
  saveData();
  return last;
}

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

// 本月汇总：出勤/工时/收入/房补
function monthSummary(y, m){
  const prefix = `${y}-${pad(m)}`;
  let days=0, hours=0, otHours=0, income=0;
  Object.keys(STATE.hours).forEach(k=>{
    if(!k.startsWith(prefix)) return;
    const r = STATE.hours[k];
    if(r.shift==='rest') return;
    days++;
    hours += Number(r.hours)||0;
    otHours += Number(r.subsidies?.overtimeHours)||0;
    income += calcDayPay(r);
  });
  const hs = housingSubsidyForMonth(y, m);
  return {days, hours, otHours, income, housing:hs.amount, attended:hs.attended, target:hs.target, totalIncome: income + hs.amount};
}

// 发薪日倒计时
function daysUntilPayday(){
  const payday = Number(STATE.settings.payday)||10;
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), payday);
  if(now.getDate() > payday) next = new Date(now.getFullYear(), now.getMonth()+1, payday);
  const diff = Math.ceil((next - now) / 86400000);
  return {days: diff, date: next};
}

// 工时真实时薪（含所有补贴）
function realHourlyRate(y, m){
  const s = monthSummary(y, m);
  const totalHours = s.hours + s.otHours;
  if(totalHours===0) return 0;
  return s.totalIncome / totalHours;
}

// ============ Calendar Rendering ============
function renderCalendar(){
  renderOverviewCard();
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
    let otFire = '';
    if(rec && rec.shift !== 'rest' && Number(rec.subsidies?.overtimeHours)>0){
      otFire = '<div class="ot-fire">🔥</div>';
    }
    return `<div class="cal-cell ${c.other?'other':''} ${isToday?'today':''} ${isSelected?'selected':''} ${isWeekend?'weekend':''} ${holiday?.rest?'holiday':''}" data-date="${key}">
      ${cornerHTML}
      ${otFire}
      <div class="day">${d.getDate()}</div>
      <div class="lunar">${holiday?holiday.n:lunarLabel(d)}</div>
      ${badgeHTML}
    </div>`;
  }).join('');
  grid.querySelectorAll('.cal-cell').forEach(el=>{
    let lastTap = 0;
    el.addEventListener('click',()=>{
      const key = el.dataset.date;
      const [yy,mm,dd] = key.split('-').map(Number);
      const now = Date.now();
      const isSameSelected = ymd(selectedDate)===key;
      const isDouble = isSameSelected && (now - lastTap < 400);
      selectedDate = new Date(yy,mm-1,dd);
      renderCalendar();
      renderTodayCards();
      if(isDouble || STATE.hours[key]){
        // 双击或者点已有记录：打开编辑
        openHoursSheet(key);
      }
      lastTap = now;
    });
  });
}

// 根据某天工时同步一条"工资"记账（type=income, cat=salary）
// 每天最多一条，id 固定为 hr_<dateKey>
function syncSalaryRecord(dateKey){
  const id = 'hr_'+dateKey;
  const existingIdx = STATE.records.findIndex(r=>r.id===id);
  // 开关关闭：确保删除可能已存在的条目
  if(!STATE.settings.autoIncomeFromHours){
    if(existingIdx>=0) STATE.records.splice(existingIdx, 1);
    return;
  }
  const rec = STATE.hours[dateKey];
  if(!rec || rec.shift==='rest'){
    if(existingIdx>=0) STATE.records.splice(existingIdx, 1);
    return;
  }
  const amount = calcDayPay(rec);
  if(amount<=0){
    if(existingIdx>=0) STATE.records.splice(existingIdx, 1);
    return;
  }
  const [y,m,d] = dateKey.split('-').map(Number);
  const time = new Date(y, m-1, d, 18, 0).getTime();
  const entry = {id, type:'income', cat:'salary', amount, note:`${m}月${d}日 工时收入`, time, account:null, fromHours:true};
  if(existingIdx>=0) STATE.records[existingIdx] = entry;
  else STATE.records.push(entry);
}

// 重算所有工时对应的工资记账（开关切换或规则改变时用）
function resyncAllSalaryRecords(){
  STATE.records = STATE.records.filter(r=>!r.fromHours);
  if(STATE.settings.autoIncomeFromHours){
    Object.keys(STATE.hours).forEach(syncSalaryRecord);
  }
  saveData();
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

function renderOverviewCard(){
  const wrap = document.getElementById('overview-card');
  if(!wrap) return;
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth()+1;
  const s = monthSummary(y, m);
  const pd = daysUntilPayday();
  const goal = Number(STATE.settings.savingsGoal)||0;
  const goalName = STATE.settings.savingsGoalName||'';
  // 累计结余 = 所有收入 - 所有支出
  let totalInc = STATE.records.filter(r=>r.type==='income').reduce((a,r)=>a+r.amount,0);
  let totalExp = STATE.records.filter(r=>r.type==='expense').reduce((a,r)=>a+r.amount,0);
  const balance = totalInc - totalExp;
  const goalPct = goal>0 ? Math.min(100, Math.max(0, balance/goal*100)) : 0;
  const isCurrentMonth = (y===TODAY.getFullYear() && m===TODAY.getMonth()+1);
  wrap.innerHTML = `
    <div style="margin:6px 12px 4px;background:linear-gradient(90deg,#2d1a10,#1a1410);border-radius:10px;padding:8px 12px;border:1px solid #3a2a1a;display:flex;align-items:center;gap:10px;font-size:12px">
      <div style="display:flex;gap:14px;flex:1">
        <div><span style="color:#888">出勤 </span><b style="color:#ff8c1a">${s.days}</b></div>
        <div><span style="color:#888">工时 </span><b style="color:#3b82f6">${s.hours + s.otHours}h</b></div>
        <div><span style="color:#888">收入 </span><b style="color:#fbbf24">¥${s.totalIncome.toFixed(0)}</b></div>
      </div>
      ${isCurrentMonth?(pd.days<=3
        ?`<div style="font-size:10px;color:#fff;background:linear-gradient(90deg,#f59e0b,#ef4444);padding:3px 8px;border-radius:9px;white-space:nowrap;animation:pulseBadge 1.5s ease-in-out infinite">🎉 ${pd.days===0?'今天发薪':pd.days+'天后发薪'}</div>`
        :`<div style="font-size:10px;color:#ffa500;background:#3a2410;padding:2px 7px;border-radius:9px;white-space:nowrap">发薪还有${pd.days}天</div>`
      ):''}
    </div>
    <style>@keyframes pulseBadge{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}</style>
    ${goal>0?`
    <div style="margin:0 12px 4px;background:#141414;border-radius:10px;padding:6px 12px;display:flex;align-items:center;gap:8px;font-size:11px">
      <span style="color:#ccc">🎯${goalName||'目标'}</span>
      <div style="flex:1;height:4px;background:#1a1a1a;border-radius:2px;overflow:hidden"><div style="width:${goalPct}%;height:100%;background:linear-gradient(90deg,#ff8c1a,#fbbf24)"></div></div>
      <span style="color:#ffa500">¥${balance.toFixed(0)}/${goal}</span>
    </div>`:''}`;
}

function renderTodayCards(){
  const wrap = document.getElementById('today-cards');
  const key = ymd(selectedDate);
  const rec = STATE.hours[key];
  const wd = weekdayCN(selectedDate);
  const mLabel = (selectedDate.getMonth()+1)+'月'+selectedDate.getDate()+'日';
  const holiday = HOLIDAYS[key];
  const isToday = ymd(TODAY)===key;
  const quotes = [
    '工资到账的快乐无可替代',
    '今天的付出，明天的底气',
    '每一分钱都值得记录',
    '搬砖虽苦，账本有甜',
    '认真搬砖的人最可爱',
    '收工的感觉真棒',
    '有记录才有底',
    '把日子过成想要的样子',
    '慢慢来，比较快',
    '给未来的自己攒惊喜',
    '今天也要好好赚钱',
    '努力工作 努力生活',
  ];
  const qIdx = (selectedDate.getMonth()*31 + selectedDate.getDate()) % quotes.length;
  const quote = quotes[qIdx];

  // 头部：日期 + 周几 + 状态胶囊
  let statusChip;
  if(rec && rec.shift!=='rest') statusChip = `<span class="status-chip on">已记工时</span>`;
  else if(rec && rec.shift==='rest') statusChip = `<span class="status-chip rest">休息日</span>`;
  else statusChip = `<span class="status-chip todo">待记录</span>`;

  const header = `
    <div class="card-head">
      <div class="date-wrap">
        <div class="date-main">${mLabel} ${isToday?'<span class="today-tag">今天</span>':''}</div>
        <div class="date-sub">${wd}${holiday?' · '+holiday.n:''}</div>
      </div>
      ${statusChip}
    </div>`;

  let body;
  if(rec && rec.shift!=='rest'){
    const pay = calcDayPay(rec);
    const formula = payFormulaParts(rec, 'tag');
    const otH = Number(rec.subsidies?.overtimeHours)||0;
    body = `
      <div class="stats-row">
        <div class="stat-cell">
          <div class="stat-label">班次</div>
          <div class="stat-value stat-icon">☀️</div>
          <div class="stat-unit">上班</div>
        </div>
        <div class="stat-cell mid">
          <div class="stat-label">工时</div>
          <div class="stat-value" style="color:#60a5fa">${rec.hours}${otH>0?`<span class="ot-badge">+${otH}🔥</span>`:''}</div>
          <div class="stat-unit">小时</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">收入</div>
          <div class="stat-value" style="color:#fbbf24">${pay.toFixed(0)}</div>
          <div class="stat-unit">元</div>
        </div>
      </div>
      <div class="formula-box">💰 ${formula}</div>
      <button class="edit-btn" data-edit-hour="${key}">✏️ 修改工时</button>`;
  } else if(rec && rec.shift==='rest'){
    body = `
      <div class="rest-box">
        <div style="font-size:40px">☕</div>
        <div class="rest-text">今日休息 · 好好放松</div>
      </div>
      <button class="edit-btn ghost" data-record-hour="${key}">修改</button>`;
  } else {
    body = `
      <div class="empty-box">
        <div class="quote-text">💡 ${quote}</div>
      </div>
      <button class="rec-btn" data-record-hour="${key}">开始记工时</button>
      <div class="hint-line">提示：双击日历日期可以直接记</div>`;
  }

  wrap.innerHTML = `<style>
    #today-cards{padding:4px 12px 12px}
    .today-card{background:linear-gradient(180deg,#161616,#121212);border-radius:16px;padding:14px;border:1px solid #232323;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    .card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .date-main{font-size:18px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}
    .today-tag{background:#3b82f6;color:#fff;font-size:10px;padding:2px 7px;border-radius:8px;font-weight:500}
    .date-sub{font-size:12px;color:#888;margin-top:3px}
    .status-chip{font-size:11px;padding:5px 11px;border-radius:11px;font-weight:500}
    .status-chip.on{background:#064e3b55;color:#6ee7b7;border:1px solid #065f46}
    .status-chip.rest{background:#3f3f4655;color:#d4d4d8;border:1px solid #52525b}
    .status-chip.todo{background:#3a241055;color:#fbbf24;border:1px solid #78350f}
    .stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;background:#0a0a0a;border-radius:12px;padding:14px 0;margin-bottom:10px}
    .stat-cell{text-align:center}
    .stat-cell.mid{border-left:1px solid #1a1a1a;border-right:1px solid #1a1a1a}
    .stat-label{font-size:11px;color:#888;margin-bottom:4px}
    .stat-value{font-size:26px;font-weight:700;color:#fff;line-height:1.1}
    .stat-value.stat-icon{font-size:26px;font-weight:400}
    .stat-unit{font-size:11px;color:#888;margin-top:3px}
    .ot-badge{font-size:12px;color:#fca5a5;margin-left:3px;font-weight:500}
    .formula-box{padding:10px 12px;background:#0a0a0a;border-radius:10px;font-size:11px;color:#9ca3af;line-height:1.7;margin-bottom:10px}
    .formula-box .tag.hour{background:#1e40af33;color:#93c5fd;padding:1px 6px;border-radius:4px;font-size:10px;margin:0 1px}
    .formula-box .tag.meal{background:#15803d33;color:#86efac;padding:1px 6px;border-radius:4px;font-size:10px;margin:0 1px}
    .formula-box .tag.night{background:#7c2d1233;color:#fca5a5;padding:1px 6px;border-radius:4px;font-size:10px;margin:0 1px}
    .edit-btn{width:100%;padding:10px;background:transparent;border:1px solid #2a2a2a;color:#93c5fd;border-radius:10px;font-size:13px;cursor:pointer;transition:all .15s}
    .edit-btn:active{background:#1a1a1a}
    .edit-btn.ghost{color:#888;border-color:#2a2a2a}
    .rest-box{text-align:center;padding:24px 10px;background:#0a0a0a;border-radius:12px;margin-bottom:10px}
    .rest-text{font-size:14px;color:#a1a1aa;margin-top:6px}
    .empty-box{text-align:center;padding:16px 10px;background:#0a0a0a;border-radius:12px;margin-bottom:10px}
    .quote-text{font-size:13px;color:#d1d5db;font-style:italic}
    .rec-btn{width:100%;padding:12px;background:linear-gradient(135deg,#2563eb,#3b82f6);border:none;color:#fff;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,.25);transition:transform .1s}
    .rec-btn:active{transform:scale(.98)}
    .hint-line{font-size:10px;color:#525252;text-align:center;margin-top:8px}
  </style>
  <div class="today-card">
    ${header}
    ${body}
  </div>`;
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
  .sheet .drag{width:40px;height:4px;background:#333;border-radius:2px;margin:0 auto 14px;cursor:grab;touch-action:none}
  .sheet .drag:active{cursor:grabbing}
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
  // 下滑手势关闭
  const drag = sheet.querySelector('.drag');
  if(drag){
    let startY = 0, deltaY = 0, dragging = false;
    const onStart = e => {
      dragging = true;
      startY = (e.touches?e.touches[0]:e).clientY;
      sheet.style.transition = 'none';
    };
    const onMove = e => {
      if(!dragging) return;
      deltaY = (e.touches?e.touches[0]:e).clientY - startY;
      if(deltaY<0) deltaY=0;
      sheet.style.transform = `translateY(${deltaY}px)`;
    };
    const onEnd = ()=>{
      if(!dragging) return;
      dragging = false;
      sheet.style.transition = 'transform .28s ease-out';
      if(deltaY>80) closeSheet();
      else sheet.style.transform = '';
      deltaY = 0;
    };
    drag.addEventListener('touchstart', onStart, {passive:true});
    drag.addEventListener('touchmove', onMove, {passive:true});
    drag.addEventListener('touchend', onEnd);
    drag.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    // 记录下来，关闭时移除
    sheet._dragCleanup = ()=>{
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
    };
  }
  return root;
}
function closeSheet(){
  const root = document.getElementById('sheet-root');
  const mask = root.querySelector('.sheet-mask');
  const sheet = root.querySelector('.sheet');
  if(!mask) return;
  if(sheet && sheet._dragCleanup) sheet._dragCleanup();
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
  if(del) del.addEventListener('click',async()=>{
    if(await showConfirm({icon:'🗑️', title:'删除工时？', message:'这天的工时记录将被删除，无法恢复', okText:'删除', cancelText:'取消', danger:true})){
      pushUndo('删除工时:'+dateKey);
      delete STATE.hours[dateKey];
      syncSalaryRecord(dateKey);
      saveData(); closeSheet(); renderCalendar(); renderTodayCards();
      if(currentTab==='hours') renderHoursPage();
      if(currentTab==='ledger') renderLedgerPage();
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
    pushUndo('保存工时:'+dateKey);
    STATE.hours[dateKey] = newRec;
    syncSalaryRecord(dateKey);
    saveData(); closeSheet();
    renderCalendar(); renderTodayCards();
    if(currentTab==='hours') renderHoursPage();
    if(currentTab==='ledger') renderLedgerPage();
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
  // 默认展开当前查看月份的详情
  const defaultM = (viewMonth.getFullYear()===y) ? viewMonth.getMonth()+1 : (y===TODAY.getFullYear() ? TODAY.getMonth()+1 : 1);
  if(monthStats[defaultM]) showMonthDetail(y, defaultM);
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
function openRecordSheet(existing, prefill){
  // prefill 用于从模板或"继续添加"时的初始值
  let type = existing?.type || prefill?.type || 'expense';
  let cat = existing?.cat || prefill?.cat || '';
  let amount = existing ? existing.amount : (prefill?.amount||'0');
  let title = existing?.note || prefill?.note || '';
  let account = existing?.account || prefill?.account || null;
  let recTime = existing ? new Date(existing.time) : new Date();
  let continuous = false; // 保存后是否继续添加

  function renderBody(){
    const root = document.getElementById('sheet-root');
    const cats = STATE.categories[type];
    if(!cat && cats.length) cat = cats[0].k;
    const amtDisplay = (typeof amount==='string' && amount==='0')?'0':amount;
    const templates = STATE.templates||[];
    const accountName = account ? (STATE.accounts.find(a=>a.k===account)||{}).name||'' : '';
    const html = `
      <h3>${existing?'编辑记录':'添加记录'}</h3>
      <div class="type-switch">
        <div class="t ${type==='expense'?'active':''}" data-type="expense">支出</div>
        <div class="t ${type==='income'?'active':''}" data-type="income">收入</div>
        <div class="t ${type==='neutral'?'active':''}" data-type="neutral">不计收支</div>
      </div>
      ${!existing && templates.length ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;color:#888;margin-bottom:6px">⚡ 常用模板（点击快速填充）</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${templates.map((t,i)=>{
              const tc = (STATE.categories[t.type]||[]).find(c=>c.k===t.cat)||{icon:'⚪',name:t.cat};
              return `<div class="tpl-chip" data-tpl="${i}" style="background:#1f1f1f;border:1px solid #2a2a2a;padding:6px 10px;border-radius:14px;font-size:12px;cursor:pointer">${tc.icon} ${t.note||tc.name} ¥${t.amount}</div>`;
            }).join('')}
          </div>
        </div>` : ''}
      <div class="cat-grid">
        ${cats.map(c=>`<div class="cat-item ${cat===c.k?'active':''}" data-cat="${c.k}"><div class="icon">${c.icon}</div><div class="name">${c.name}</div></div>`).join('')}
      </div>
      <div class="amount-row">
        <input class="title-input" id="rec-title" placeholder="输入记录标题" value="${title.replace(/"/g,'&quot;')}">
        <div class="amt" id="rec-amt">${amtDisplay}</div>
      </div>
      <div class="meta-row">
        <div><span class="label">时间：</span>${pad(recTime.getMonth()+1)}-${pad(recTime.getDate())} ${pad(recTime.getHours())}:${pad(recTime.getMinutes())}</div>
        <div id="account-picker" style="cursor:pointer"><span class="label">账户：</span>${accountName||'未选择'}</div>
        <div><span class="label">分类：</span>${(STATE.categories[type].find(c=>c.k===cat)||{}).name||''}</div>
      </div>
      <div class="keypad">
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="back">退格</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="ok" data-k="save">${existing?'保存':'记账'}</button>
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
        <button class="op" data-k="clear">清空</button><button data-k="0">0</button><button data-k=".">.</button>
      </div>
      ${existing ? '<button class="btn danger" style="width:100%;margin-top:10px" id="rec-del">删除</button>' : `
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn ghost" style="flex:1" id="rec-continuous">☑ 连续添加</button>
          <button class="btn ghost" style="flex:1" id="rec-tpl">⭐ 存为模板</button>
        </div>`}
    `;
    root.querySelector('.sheet').innerHTML = '<div class="drag"></div>'+html;
    bindSheet();
  }

  function saveRecord(){
    const val = parseFloat(String(amount))||0;
    pushUndo(existing?'编辑记账':'添加记账');
    const r = existing || {id:Date.now()+'_'+Math.random().toString(36).slice(2,7)};
    r.type=type; r.cat=cat; r.amount=val; r.note=title; r.time=recTime.getTime();
    if(account) r.account=account; else delete r.account;
    if(existing){
      const idx = STATE.records.findIndex(x=>x.id===r.id);
      if(idx>=0) STATE.records[idx]=r;
    } else {
      STATE.records.push(r);
    }
    saveData();
    return true;
  }

  function bindSheet(){
    document.querySelectorAll('.type-switch .t').forEach(el=>el.addEventListener('click',()=>{
      type = el.dataset.type; cat=''; renderBody();
    }));
    document.querySelectorAll('.cat-item').forEach(el=>el.addEventListener('click',()=>{
      cat = el.dataset.cat;
      document.querySelectorAll('.cat-item').forEach(x=>x.classList.toggle('active', x.dataset.cat===cat));
    }));
    document.querySelectorAll('.tpl-chip').forEach(el=>el.addEventListener('click',()=>{
      const t = STATE.templates[Number(el.dataset.tpl)];
      if(!t) return;
      type = t.type; cat = t.cat; amount = String(t.amount); title = t.note||''; account = t.account||null;
      renderBody();
    }));
    document.getElementById('rec-title').addEventListener('input',e=>title=e.target.value);
    document.getElementById('account-picker').addEventListener('click',openAccountPicker);
    document.querySelectorAll('.keypad button').forEach(btn=>btn.addEventListener('click',()=>{
      const k = btn.dataset.k;
      let amt = String(amount);
      if(k==='back'){ amt = amt.length<=1?'0':amt.slice(0,-1); }
      else if(k==='clear'){ amt = '0'; }
      else if(k==='.'){ if(!amt.includes('.')) amt += '.'; }
      else if(k==='save'){
        const val = parseFloat(String(amount))||0;
        if(val<=0){ showToast('⚠️ 请输入金额'); return; }
        if(!cat){ showToast('⚠️ 请选择分类'); return; }
        // 支出且未选账户时，先弹账户选择
        if(!existing && !account && type==='expense' && STATE.accounts.length>0){
          openAccountPicker(()=>{
            if(!saveRecord()) return;
            if(continuous){
              amount='0'; title=''; recTime=new Date();
              renderBody(); return;
            }
            closeSheet(); renderCurrentTab();
          });
          return;
        }
        if(!saveRecord()) return;
        if(continuous && !existing){
          amount = '0'; title = '';
          recTime = new Date();
          renderBody();
          return;
        }
        closeSheet(); renderCurrentTab();
        return;
      }
      else { if(amt==='0' && k!=='.') amt = k; else amt += k; }
      amount = amt;
      const amtEl = document.getElementById('rec-amt');
      if(amtEl) amtEl.textContent = amt;
    }));
    const del = document.getElementById('rec-del');
    if(del) del.addEventListener('click',async()=>{
      if(await showConfirm({icon:'🗑️', title:'删除此记录？', message:'这条记账条目将被删除', okText:'删除', cancelText:'取消', danger:true})){
        pushUndo('删除记账');
        STATE.records = STATE.records.filter(x=>x.id!==existing.id);
        saveData(); closeSheet(); renderCurrentTab();
      }
    });
    const contBtn = document.getElementById('rec-continuous');
    if(contBtn) contBtn.addEventListener('click',()=>{
      continuous = !continuous;
      contBtn.textContent = (continuous?'✅':'☑')+' 连续添加';
      contBtn.style.background = continuous?'#ff8c1a':'#2a2a2a';
    });
    const tplBtn = document.getElementById('rec-tpl');
    if(tplBtn) tplBtn.addEventListener('click',()=>{
      const val = parseFloat(String(amount))||0;
      if(val<=0 || !cat){ showToast('⚠️ 请先填金额和分类'); return; }
      STATE.templates.push({type,cat,amount:val,note:title,account});
      if(STATE.templates.length>12) STATE.templates.shift();
      saveData();
      showToast('⭐ 已存为常用模板');
      renderBody();
    });
  }

  function openAccountPicker(onPicked){
    const accts = STATE.accounts;
    const btns = accts.map(a=>`<div class="acct-opt" data-acct="${a.k}" style="flex:1 1 calc(50% - 6px);padding:14px;background:#1f1f1f;border-radius:10px;text-align:center;cursor:pointer;border:2px solid ${account===a.k?'#ff8c1a':'transparent'}"><div style="font-size:24px">${a.icon}</div><div style="font-size:13px;margin-top:4px">${a.name}</div></div>`).join('');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:flex-end;justify-content:center';
    modal.innerHTML = `<div style="background:#141414;border-top-left-radius:16px;border-top-right-radius:16px;padding:20px 16px calc(16px + env(safe-area-inset-bottom));width:100%;max-width:500px">
      <div style="width:40px;height:4px;background:#333;border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-weight:600;margin-bottom:14px;text-align:center;font-size:16px">选择支付账户</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${btns}</div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn ghost" style="flex:1" id="acct-none">不选账户</button>
        <button class="btn ghost" style="flex:1" id="acct-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = ()=>modal.remove();
    modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
    modal.querySelectorAll('.acct-opt').forEach(el=>el.addEventListener('click',()=>{
      account = el.dataset.acct;
      close();
      if(onPicked) onPicked(); else renderBody();
    }));
    modal.querySelector('#acct-none').addEventListener('click',()=>{
      account = null;
      close();
      if(onPicked) onPicked(); else renderBody();
    });
    modal.querySelector('#acct-cancel').addEventListener('click',close);
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
        <div style="margin:10px 12px;background:#141414;border-radius:12px;padding:12px;border:1px solid #1f1f1f;position:relative" data-edit="${k}">
          <div style="position:absolute;top:10px;right:12px;background:#0f766e;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px">${STATE.settings.workType}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
            <div><div style="font-size:11px;color:#888">📅 日期</div><div style="font-weight:600;font-size:14px">${m}月${dd}日</div><div style="font-size:11px;color:#888">${weekdayCN(d)}</div></div>
            <div><div style="font-size:11px;color:#888">👥 班次</div><div style="font-size:20px">☀️</div><div style="font-size:11px;color:#888">上班</div></div>
            <div><div style="font-size:11px;color:#888">🕐 工时</div><div style="font-weight:600;font-size:18px;color:#3b82f6">${rec.hours}${(rec.subsidies?.overtimeHours)>0?`<span style="font-size:11px;color:#fca5a5">+${rec.subsidies.overtimeHours}</span>`:''}</div><div style="font-size:11px;color:#888">小时</div></div>
            <div><div style="font-size:11px;color:#888">💰 收入</div><div style="font-weight:700;font-size:18px;color:#c9a227">${pay.toFixed(0)}</div><div style="font-size:11px;color:#888">元</div></div>
          </div>
          <div style="margin-top:10px;font-size:11px;color:#aaa;padding-top:8px;border-top:1px solid #1f1f1f">
            收入 = ${formula}
          </div>
          ${rec.note?`<div style="margin-top:6px;font-size:12px;color:#888">📝 ${rec.note}</div>`:''}
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
        const acct = r.account ? (STATE.accounts.find(a=>a.k===r.account)||{}) : null;
        const acctLabel = acct ? ` · ${acct.icon}${acct.name}` : '';
        const tag = r.fromHours ? ' <span style="background:#1e40af33;color:#93c5fd;padding:1px 5px;border-radius:3px;font-size:10px">自动</span>' : '';
        return `<div data-rid="${r.id}" style="display:flex;align-items:center;gap:12px;padding:12px;background:${r.imported?'#2a2410':'#141414'};border-radius:12px;margin-top:6px;cursor:pointer;${r.imported?'border:1px solid #fbbf24;animation:flashBill 1s ease-in-out 3':''}">
          <div style="width:42px;height:42px;border-radius:50%;background:#1f1f1f;display:flex;align-items:center;justify-content:center;font-size:20px">${cat.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px">${r.note||cat.name}${tag}${r.imported?' <span style="background:#fbbf2433;color:#fbbf24;padding:1px 5px;border-radius:3px;font-size:10px">新导入</span>':''}</div>
            <div style="font-size:11px;color:#888">${cat.name} · ${pad(time.getHours())}:${pad(time.getMinutes())}${acctLabel}</div>
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
      if(r){
        if(r.fromHours){
          showConfirm({icon:'🔒', title:'这是自动生成的工资', message:'由工时自动生成，请去日历页修改对应日期的工时', okText:'去修改', cancelText:'留着不改'}).then(ok=>{
            if(ok){
              const dateKey = r.id.replace(/^hr_/,'');
              if(/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) openHoursSheet(dateKey);
            }
          });
          return;
        }
        openRecordSheet(r);
      }
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
  const byCat = {};
  exp.forEach(r=>{ byCat[r.cat] = (byCat[r.cat]||0) + r.amount; });
  const catList = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const total = totalExp || 1;
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
  const legendRows = catList.slice(0,10).map(([k,v],i)=>{
    const cat = STATE.categories.expense.find(c=>c.k===k) || {name:k,icon:'⚫'};
    const pct = (v/total*100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:13px">
      <div style="width:10px;height:10px;background:${colors[i%colors.length]};border-radius:2px;flex-shrink:0"></div>
      <span style="color:#ccc;flex:1">${cat.icon} ${cat.name}</span>
      <span style="color:#aaa;font-variant-numeric:tabular-nums">¥${v.toFixed(0)}</span>
      <span style="color:#888;font-variant-numeric:tabular-nums;min-width:42px;text-align:right">${pct}%</span>
    </div>`;
  }).join('');
  const listHTML = catList.map(([k,v],i)=>{
    const cat = STATE.categories.expense.find(c=>c.k===k) || {name:k,icon:'⚫'};
    const pct = (v/total*100).toFixed(2);
    const budget = Number(STATE.budgets?.[k])||0;
    const overBudget = budget>0 && v>budget;
    const budPct = budget>0 ? Math.min(100, v/budget*100) : 0;
    return `<div style="background:#141414;border-radius:12px;padding:14px;margin:10px 16px;border:1px solid ${overBudget?'#7f1d1d':'#1f1f1f'}">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:50%;background:#1f1f1f;display:flex;align-items:center;justify-content:center;font-size:20px">${cat.icon}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:600">${cat.name}${overBudget?' <span style="color:#ef4444;font-size:10px">⚠️超支</span>':''}</div><div style="color:#ef4444;font-weight:600">-¥${v.toFixed(2)}</div></div>
          <div style="font-size:12px;color:#888;margin-top:2px">占比 ${pct}%${budget>0?` · 预算 ¥${budget}`:''}</div>
        </div>
      </div>
      <div style="margin-top:8px;height:4px;background:#1f1f1f;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:#ff8c1a"></div></div>
      ${budget>0?`<div style="margin-top:4px;height:3px;background:#1f1f1f;border-radius:2px;overflow:hidden"><div style="width:${budPct}%;height:100%;background:${overBudget?'#ef4444':'#10b981'}"></div></div>`:''}
    </div>`;
  }).join('');

  // 近12月结余曲线
  const trend = [];
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const next = new Date(d.getFullYear(), d.getMonth()+1, 1);
    const rs = STATE.records.filter(r=>r.time>=d.getTime() && r.time<next.getTime());
    const ein = rs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
    const eout = rs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
    trend.push({label:`${d.getMonth()+1}月`, bal:ein-eout, inc:ein, exp:eout});
  }
  const maxAbs = Math.max(1, ...trend.map(t=>Math.abs(t.bal)));
  const trendW = 320, trendH = 120;
  const step = trendW/(trend.length-1 || 1);
  const zeroY = trendH/2 + 10;
  const points = trend.map((t,i)=>{
    const x = i*step;
    const y = zeroY - (t.bal/maxAbs)*(trendH/2-4);
    return {x,y,t};
  });
  const polyline = points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const xLabels = trend.map((t,i)=>`<text x="${i*step}" y="${trendH+28}" fill="#666" font-size="10" text-anchor="middle">${t.label}</text>`).join('');
  const dots = points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="${p.t.bal>=0?'#10b981':'#ef4444'}"/>`).join('');
  // 标注极值
  const nonZero = points.filter(p=>p.t.bal!==0);
  let markers = '';
  if(nonZero.length>1){
    const maxP = nonZero.reduce((a,b)=>b.t.bal>a.t.bal?b:a);
    const minP = nonZero.reduce((a,b)=>b.t.bal<a.t.bal?b:a);
    if(maxP !== minP){
      markers += `<text x="${maxP.x}" y="${maxP.y-8}" fill="#10b981" font-size="10" text-anchor="middle" font-weight="700">↑¥${maxP.t.bal.toFixed(0)}</text>`;
      markers += `<text x="${minP.x}" y="${minP.y+16}" fill="#ef4444" font-size="10" text-anchor="middle" font-weight="700">↓¥${minP.t.bal.toFixed(0)}</text>`;
    }
  }

  // 时薪真实值（当前范围覆盖的月份取平均）
  let rhrText = '';
  if(statsRange==='month'){
    const r = realHourlyRate(now.getFullYear(), now.getMonth()+1);
    if(r>0) rhrText = `<div style="margin:0 16px 12px;padding:12px;background:#141414;border-radius:12px;border:1px solid #1f1f1f;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;color:#ccc">⏱️ 本月实际时薪（含补贴）</span><span style="font-size:18px;font-weight:700;color:#fbbf24">¥${r.toFixed(2)}/h</span></div>`;
  }

  wrap.innerHTML = `
    <div style="padding:16px">
      <div style="background:#141414;border-radius:14px;padding:12px">
        <div style="display:flex;gap:8px;justify-content:space-around">
          ${['week','month','year'].map(r=>{
            const n = r==='week'?'本周':r==='month'?'本月':'本年';
            return `<div class="range-tab" data-range="${r}" style="padding:8px 18px;border-radius:16px;${statsRange===r?'border:1px solid #ff8c1a;color:#ff8c1a':'color:#888'};cursor:pointer">${n}</div>`;
          }).join('')}
          <div class="range-tab" id="open-annual" style="padding:8px 14px;border-radius:16px;background:#ff8c1a22;color:#ff8c1a;cursor:pointer;font-size:12px">🎉 年度报告</div>
        </div>
      </div>
    </div>
    <div style="background:#141414;margin:0 16px;border-radius:14px;padding:20px;display:flex;justify-content:space-around;text-align:center">
      <div><div style="color:#10b981;font-size:22px;font-weight:700">¥${totalInc.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">总收入</div></div>
      <div><div style="color:#ef4444;font-size:22px;font-weight:700">¥${totalExp.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">总支出</div></div>
      <div><div style="color:${balance>=0?'#fff':'#ef4444'};font-size:22px;font-weight:700">¥${balance.toFixed(2)}</div><div style="font-size:12px;color:#888;margin-top:4px">结余</div></div>
    </div>
    ${rhrText}
    <div style="background:#141414;margin:12px 16px;border-radius:14px;padding:16px">
      <div style="font-weight:600;margin-bottom:10px">📈 近12月结余趋势</div>
      <svg viewBox="0 -20 ${trendW} ${trendH+50}" style="width:100%;display:block">
        <line x1="0" y1="${zeroY}" x2="${trendW}" y2="${zeroY}" stroke="#2a2a2a" stroke-dasharray="3,3"/>
        <polyline fill="none" stroke="#ff8c1a" stroke-width="2" points="${polyline}"/>
        ${dots}
        ${markers}
        ${xLabels}
      </svg>
      <div style="font-size:11px;color:#888;text-align:center;margin-top:6px">绿色=结余正数 / 红色=负数</div>
    </div>
    <div style="padding:0 16px;margin-bottom:10px">
      <button id="open-budget" class="btn ghost" style="width:100%">⚙️ 管理分类预算</button>
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
      <div style="margin-top:12px;border-top:1px solid #1f1f1f;padding-top:8px">${legendRows}</div>
    </div>
    <div style="font-weight:600;margin:16px 16px 0">分类明细</div>
    ${listHTML}
    `:'<div style="text-align:center;padding:40px;color:#666">暂无数据</div>'}
  `;
  wrap.querySelectorAll('.range-tab').forEach(el=>el.addEventListener('click',()=>{
    if(el.id==='open-annual'){ openAnnualReport(); return; }
    statsRange = el.dataset.range;
    wrap.style.opacity = '0.3';
    setTimeout(()=>{ renderStatsPage(); wrap.style.opacity = '1'; wrap.style.transition='opacity .2s'; }, 100);
  }));
  document.getElementById('open-budget').addEventListener('click',openBudgetEditor);
}

// ============ 预算编辑器 ============
function openBudgetEditor(){
  const cats = STATE.categories.expense;
  const html = `<h3>分类预算（月度）</h3>
    <div style="max-height:60vh;overflow-y:auto">
      ${cats.map(c=>{
        const v = STATE.budgets[c.k]||'';
        return `<div class="form-row">
          <label>${c.icon} ${c.name}</label>
          <input type="number" data-cat="${c.k}" value="${v}" placeholder="不限" class="bud-input">
          <span style="color:#888;font-size:12px">元</span>
        </div>`;
      }).join('')}
    </div>
    <div class="btn-group">
      <button class="btn ghost" id="bud-cancel">取消</button>
      <button class="btn primary" id="bud-save">保存</button>
    </div>`;
  openSheet(html);
  document.getElementById('bud-cancel').addEventListener('click',closeSheet);
  document.getElementById('bud-save').addEventListener('click',()=>{
    document.querySelectorAll('.bud-input').forEach(inp=>{
      const v = parseFloat(inp.value);
      if(v>0) STATE.budgets[inp.dataset.cat] = v;
      else delete STATE.budgets[inp.dataset.cat];
    });
    saveData(); closeSheet(); renderStatsPage();
  });
}

// ============ 年度报告 ============
function openAnnualReport(){
  const y = new Date().getFullYear();
  const yearStart = new Date(y, 0, 1).getTime();
  const yearEnd = new Date(y+1, 0, 1).getTime();
  const yearRecs = STATE.records.filter(r=>r.time>=yearStart && r.time<yearEnd);
  const totalInc = yearRecs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const totalExp = yearRecs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  let workDays=0, workHours=0, workIncome=0, housingTotal=0;
  Object.keys(STATE.hours).forEach(k=>{
    if(!k.startsWith(y+'-')) return;
    const r = STATE.hours[k];
    if(r.shift==='rest') return;
    workDays++;
    workHours += (Number(r.hours)||0) + (Number(r.subsidies?.overtimeHours)||0);
    workIncome += calcDayPay(r);
  });
  for(let m=1;m<=12;m++){
    const hs = housingSubsidyForMonth(y, m);
    housingTotal += hs.amount;
  }
  // 最高支出分类
  const byCat = {};
  yearRecs.filter(r=>r.type==='expense').forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+r.amount; });
  const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const topCatInfo = topCat ? ((STATE.categories.expense.find(c=>c.k===topCat[0])||{}).name+'（¥'+topCat[1].toFixed(0)+'）') : '暂无';
  // 最辛苦月份
  const monthHours = {};
  Object.keys(STATE.hours).forEach(k=>{
    if(!k.startsWith(y+'-')) return;
    const r = STATE.hours[k];
    if(r.shift==='rest') return;
    const m = k.slice(5,7);
    monthHours[m] = (monthHours[m]||0) + (Number(r.hours)||0) + (Number(r.subsidies?.overtimeHours)||0);
  });
  const topMonth = Object.entries(monthHours).sort((a,b)=>b[1]-a[1])[0];
  const topMonthStr = topMonth ? `${+topMonth[0]}月（${topMonth[1]}小时）` : '暂无';

  const html = `<h3>🎉 ${y}年 搬砖报告</h3>
    <div style="background:linear-gradient(135deg,#2d1a10,#1a1410);border-radius:14px;padding:20px;margin-bottom:14px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:13px;color:#ccc;margin-bottom:4px">今年搬砖</div>
        <div style="font-size:34px;font-weight:800;color:#ff8c1a">${workDays}<span style="font-size:18px;font-weight:500;color:#ccc"> 天</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center">
        <div><div style="color:#fbbf24;font-size:18px;font-weight:700">${workHours}h</div><div style="font-size:11px;color:#888">总工时</div></div>
        <div><div style="color:#10b981;font-size:18px;font-weight:700">¥${(workIncome+housingTotal).toFixed(0)}</div><div style="font-size:11px;color:#888">工资收入</div></div>
        <div><div style="color:#ef4444;font-size:18px;font-weight:700">¥${totalExp.toFixed(0)}</div><div style="font-size:11px;color:#888">年度支出</div></div>
        <div><div style="color:${totalInc-totalExp>=0?'#fff':'#ef4444'};font-size:18px;font-weight:700">¥${(totalInc-totalExp).toFixed(0)}</div><div style="font-size:11px;color:#888">年度结余</div></div>
      </div>
    </div>
    <div style="background:#141414;border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;color:#888;margin-bottom:4px">💸 花钱最多</div>
      <div style="font-size:16px">${topCatInfo}</div>
    </div>
    <div style="background:#141414;border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;color:#888;margin-bottom:4px">💪 最辛苦的月份</div>
      <div style="font-size:16px">${topMonthStr}</div>
    </div>
    <div style="background:#141414;border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;color:#888;margin-bottom:4px">🏠 累计房补</div>
      <div style="font-size:16px">¥${housingTotal.toFixed(0)}</div>
    </div>
    <div class="btn-group">
      <button class="btn ghost" id="ar-save">🖼️ 保存为图片</button>
      <button class="btn primary" id="ar-close">太棒了！</button>
    </div>`;
  openSheet(html);
  document.getElementById('ar-close').addEventListener('click',closeSheet);
  document.getElementById('ar-save').addEventListener('click',()=>{
    exportAnnualReportImage({y, workDays, workHours, workIncome, housingTotal, totalExp, totalInc, topCatInfo, topMonthStr});
  });
}

// ============ 年度报告图片导出 ============
function exportAnnualReportImage(d){
  const W=720, H=1280;
  const canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#2d1a10'); grad.addColorStop(1,'#0a0a0a');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  // 顶部小人图标
  ctx.fillStyle = '#ff8c1a';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('🏗️ 搬砖记 · 年度报告', W/2, 90);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 110px sans-serif';
  ctx.fillText(d.y+' 年', W/2, 220);
  ctx.fillStyle = '#ccc';
  ctx.font = '22px sans-serif';
  ctx.fillText('这一年，我搬砖了', W/2, 270);
  // 大数字
  ctx.fillStyle = '#ff8c1a';
  ctx.font = 'bold 140px sans-serif';
  ctx.fillText(d.workDays+'', W/2, 430);
  ctx.fillStyle = '#888';
  ctx.font = '26px sans-serif';
  ctx.fillText('天', W/2+100, 430);
  // 4 行卡片
  const items = [
    {label:'💪 总工时', value:d.workHours+' 小时', color:'#fbbf24'},
    {label:'💰 工资收入', value:'¥ '+(d.workIncome+d.housingTotal).toFixed(0), color:'#10b981'},
    {label:'🏠 累计房补', value:'¥ '+d.housingTotal.toFixed(0), color:'#93c5fd'},
    {label:'💸 总支出', value:'¥ '+d.totalExp.toFixed(0), color:'#ef4444'},
    {label:'✨ 年度结余', value:'¥ '+(d.totalInc-d.totalExp).toFixed(0), color: (d.totalInc-d.totalExp)>=0?'#fff':'#ef4444'},
  ];
  items.forEach((it,i)=>{
    const y0 = 490+i*90;
    ctx.fillStyle = '#14141477';
    ctx.fillRect(50, y0, W-100, 74);
    ctx.fillStyle = '#ccc';
    ctx.font = '22px sans-serif';
    ctx.textAlign='left';
    ctx.fillText(it.label, 80, y0+45);
    ctx.fillStyle = it.color;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign='right';
    ctx.fillText(it.value, W-80, y0+48);
  });
  // 底部两条信息
  ctx.fillStyle = '#888';
  ctx.font = '20px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('💸 花钱最多：'+d.topCatInfo, W/2, 1060);
  ctx.fillText('💪 最辛苦的月份：'+d.topMonthStr, W/2, 1095);
  // 页脚
  ctx.fillStyle = '#555';
  ctx.font = '18px sans-serif';
  ctx.fillText('由「搬砖记」生成 · '+ymd(new Date()), W/2, H-40);
  canvas.toBlob(blob=>{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `搬砖记_${d.y}年度报告.png`;
    a.click();
  }, 'image/png');
}

// ============ Me Page ============
function renderMePage(){
  const wrap = document.getElementById('me-body');
  const s = STATE.settings;
  const themes = [
    {k:'#ff8c1a',n:'橙色'},
    {k:'#3b82f6',n:'蓝色'},
    {k:'#10b981',n:'绿色'},
    {k:'#a78bfa',n:'紫色'},
    {k:'#ec4899',n:'粉色'},
    {k:'#f59e0b',n:'琥珀'},
  ];
  wrap.innerHTML = `
    <div style="padding:16px">
      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">💼 工资规则设置</div>
        <div class="form-row"><label>身份</label><input id="s-worktype" value="${s.workType}"></div>
        <div class="form-row"><label>时薪</label><input type="number" id="s-hourrate" value="${s.hourRate}"><span style="color:#888;font-size:12px">元/小时</span></div>
        <div class="form-row"><label>每日餐补</label><input type="number" id="s-meal" value="${s.mealSubsidy}"><span style="color:#888;font-size:12px">元</span></div>
        <div class="form-row"><label>月度房补</label><input type="number" id="s-housing" value="${s.housingSubsidy??200}"><span style="color:#888;font-size:12px">元</span></div>
        <div style="font-size:11px;color:#666;margin:8px 0;line-height:1.6">房补：满勤 ${s.housingSubsidy??200} 元，按工作日出勤比例发放。周末和法定节假日不计入应出勤。</div>
        <div class="form-row"><label>发薪日</label><input type="number" id="s-payday" min="1" max="31" value="${s.payday||10}"><span style="color:#888;font-size:12px">每月X号</span></div>
        <div class="form-row"><label>考勤周期起</label><input type="number" id="s-cycle" min="1" max="31" value="${s.cycleStartDay||1}"><span style="color:#888;font-size:12px">1=自然月</span></div>
        <div class="form-row"><label>工资→账本</label>
          <select id="s-auto">
            <option value="1" ${s.autoIncomeFromHours?'selected':''}>自动生成收入记录</option>
            <option value="0" ${!s.autoIncomeFromHours?'selected':''}>不自动生成</option>
          </select>
        </div>
      </div>

      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">🎯 储蓄目标</div>
        <div class="form-row"><label>目标名称</label><input id="s-goalname" value="${(s.savingsGoalName||'').replace(/"/g,'&quot;')}" placeholder="如 买手机"></div>
        <div class="form-row"><label>目标金额</label><input type="number" id="s-goal" value="${s.savingsGoal||0}"><span style="color:#888;font-size:12px">元</span></div>
        <div style="font-size:11px;color:#666;margin-top:6px">达成进度 = 所有收入 - 所有支出</div>
      </div>

      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">🎨 主题色</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${themes.map(t=>`<div class="theme-opt" data-color="${t.k}" style="width:48px;height:48px;border-radius:50%;background:${t.k};cursor:pointer;border:3px solid ${s.themeColor===t.k?'#fff':'transparent'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px">${s.themeColor===t.k?'✓':''}</div>`).join('')}
        </div>
      </div>

      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">💳 账户（${STATE.accounts.length}）</div>
        <div style="font-size:12px;color:#888;margin-bottom:10px">记账时可选微信/支付宝/现金等账户，方便对账</div>
        <button id="mgr-accounts" class="me-btn" style="padding-left:12px">📝 管理账户</button>
      </div>

      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">📊 数据统计</div>
        <div style="display:flex;justify-content:space-around;text-align:center">
          <div><div style="font-size:20px;font-weight:700;color:#ff8c1a">${Object.keys(STATE.hours).length}</div><div style="font-size:11px;color:#888">工时记录</div></div>
          <div><div style="font-size:20px;font-weight:700;color:#10b981">${STATE.records.filter(r=>r.type==='income').length}</div><div style="font-size:11px;color:#888">收入条目</div></div>
          <div><div style="font-size:20px;font-weight:700;color:#ef4444">${STATE.records.filter(r=>r.type==='expense').length}</div><div style="font-size:11px;color:#888">支出条目</div></div>
        </div>
      </div>

      <div style="background:#141414;border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:12px">💾 数据管理</div>
        <button id="export-data" class="me-btn">📤 导出 JSON 备份</button>
        <button id="import-data" class="me-btn">📥 导入 JSON 数据</button>
        <button id="export-csv" class="me-btn">📊 导出 CSV 表格</button>
        <button id="import-alipay" class="me-btn">💙 导入支付宝/微信账单</button>
        <button id="undo-btn" class="me-btn">↩️ 撤销最近操作 (${STATE.undoStack.length})</button>
        <button id="export-image" class="me-btn">🖼️ 保存本月图片</button>
        <button id="resync-salary" class="me-btn">🔄 重新生成工资记录</button>
        <button id="clear-templates" class="me-btn">🗑️ 清空常用模板 (${STATE.templates.length})</button>
        <button id="clear-data" style="width:100%;padding:12px;background:#2a0a0a;color:#ef4444;border:1px solid #7f1d1d;border-radius:10px;font-size:14px;margin-top:8px">🗑️ 清空所有数据</button>
      </div>
      <div style="text-align:center;color:#555;font-size:11px;margin:20px 0">搬砖记 v1.2 · 数据仅保存在本机</div>
      <button id="save-settings" style="width:100%;padding:14px;background:#ff8c1a;color:#fff;border:none;border-radius:10px;font-weight:600;font-size:16px;margin-top:6px;margin-bottom:20px;box-shadow:0 4px 14px rgba(255,140,26,.4)">💾 保存所有设置</button>
    </div>
    <style>
      .me-btn{width:100%;padding:12px;background:#1f1f1f;color:#fff;border:none;border-radius:10px;font-size:14px;margin-bottom:8px;cursor:pointer;text-align:left;padding-left:16px}
      .me-btn:hover{background:#2a2a2a}
      #me-body .form-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1f1f1f}
      #me-body .form-row label{min-width:100px;color:#ccc}
      #me-body .form-row input,#me-body .form-row select{flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px}
    </style>`;

  document.getElementById('save-settings').addEventListener('click',()=>{
    STATE.settings.workType = document.getElementById('s-worktype').value||'小时工';
    STATE.settings.hourRate = +document.getElementById('s-hourrate').value||0;
    STATE.settings.mealSubsidy = +document.getElementById('s-meal').value||0;
    STATE.settings.housingSubsidy = +document.getElementById('s-housing').value||0;
    STATE.settings.payday = Math.min(31, Math.max(1, +document.getElementById('s-payday').value||10));
    STATE.settings.cycleStartDay = Math.min(31, Math.max(1, +document.getElementById('s-cycle').value||1));
    STATE.settings.autoIncomeFromHours = document.getElementById('s-auto').value==='1';
    STATE.settings.savingsGoalName = document.getElementById('s-goalname').value||'';
    STATE.settings.savingsGoal = +document.getElementById('s-goal').value||0;
    saveData();
    resyncAllSalaryRecords();
    applyThemeColor();
    showToast('✅ 设置已保存');
    renderMePage();
  });

  document.getElementById('mgr-accounts').addEventListener('click',openAccountManager);
  document.querySelectorAll('.theme-opt').forEach(el=>el.addEventListener('click',()=>{
    STATE.settings.themeColor = el.dataset.color;
    saveData(); applyThemeColor(); renderMePage();
  }));

  document.getElementById('export-data').addEventListener('click',()=>{
    STATE.settings.backupReminderAt = Date.now();
    saveData();
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
      r.onload=async()=>{
        try{
          const d = JSON.parse(r.result);
          if(await showConfirm({icon:'⚠️', title:'覆盖所有数据？', message:'当前所有工时和记账会被替换为文件中的数据', okText:'覆盖', cancelText:'取消', danger:true})){
            STATE = {
              settings: Object.assign({}, DEFAULT_DATA.settings, d.settings||{}),
              hours: d.hours || {},
              records: d.records || [],
              categories: d.categories || JSON.parse(JSON.stringify(DEFAULT_DATA.categories)),
              budgets: d.budgets || {},
              accounts: (d.accounts && d.accounts.length) ? d.accounts : JSON.parse(JSON.stringify(DEFAULT_DATA.accounts)),
              templates: d.templates || [],
              undoStack: [],
            };
            saveData();
            applyThemeColor();
            showToast('✅ 已导入');
            renderCurrentTab();
          }
        }catch(err){ showAlert({icon:'❌', title:'导入失败', message:'文件格式错误，请检查'}); }
      };
      r.readAsText(f);
    };
    inp.click();
  });

  document.getElementById('export-csv').addEventListener('click',exportCSV);
  document.getElementById('import-alipay').addEventListener('click',openBillImport);
  document.getElementById('export-image').addEventListener('click',exportMonthImage);

  document.getElementById('undo-btn').addEventListener('click',()=>{
    const r = undoLast();
    if(r){ showToast('↩️ 已撤销：'+r.desc); renderCurrentTab(); renderMePage(); }
  });

  document.getElementById('resync-salary').addEventListener('click',async()=>{
    if(await showConfirm({icon:'🔄', title:'重新生成工资记录？', message:'将根据工时记录重新生成所有工资收入条目，原有自动记录会被覆盖', okText:'重新生成', cancelText:'取消'})){
      resyncAllSalaryRecords();
      showToast('✅ 已同步');
      renderCurrentTab();
    }
  });

  document.getElementById('clear-templates').addEventListener('click',async()=>{
    if(STATE.templates.length===0){ showToast('没有模板'); return; }
    if(await showConfirm({icon:'🗑️', title:'清空常用模板？', message:`将删除全部 ${STATE.templates.length} 个模板`, okText:'清空', cancelText:'取消', danger:true})){
      STATE.templates = []; saveData(); renderMePage();
    }
  });

  document.getElementById('clear-data').addEventListener('click',async()=>{
    if(await showConfirm({icon:'⚠️', title:'清空所有数据？', message:'这个操作会删除全部工时、记账、模板、预算等数据\n无法恢复！', okText:'继续', cancelText:'取消', danger:true})){
      if(await showConfirm({icon:'🔴', title:'最后确认', message:'真的要删除所有数据吗？\n建议先导出备份', okText:'确认删除', cancelText:'还是算了', danger:true})){
        STATE = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
        applyThemeColor();
        showToast('已清空');
        renderCurrentTab();
      }
    }
  });
}

// 提取 CSV 导出
function exportCSV(){
  const rows = [['日期','类型','分类','金额','账户','备注']];
  STATE.records.forEach(r=>{
    const cat = (STATE.categories[r.type]||[]).find(c=>c.k===r.cat)||{name:r.cat};
    const d = new Date(r.time);
    const t = r.type==='expense'?'支出':r.type==='income'?'收入':'不计';
    const acct = r.account ? ((STATE.accounts.find(a=>a.k===r.account)||{}).name||'') : '';
    rows.push([ymd(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes()), t, cat.name, r.amount.toFixed(2), acct, (r.note||'').replace(/"/g,'""')]);
  });
  rows.push([]);
  rows.push(['日期','班次','工时','餐补','加班时长','其他补贴','当日收入','备注']);
  Object.keys(STATE.hours).sort().forEach(k=>{
    const h = STATE.hours[k];
    const sb = h.subsidies||{};
    rows.push([k, h.shift==='rest'?'休息':'上班', h.hours||0, sb.meal||0, sb.overtimeHours||0, sb.other||0, calcDayPay(h).toFixed(2), (h.note||'').replace(/"/g,'""')]);
  });
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
}

// ============ 账户管理 ============
function openAccountManager(){
  const html = `<h3>账户管理</h3>
    <div id="acct-list" style="max-height:50vh;overflow-y:auto"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input id="new-acct-icon" placeholder="图标" maxlength="2" style="width:60px;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px;text-align:center;font-size:18px">
      <input id="new-acct-name" placeholder="账户名称" style="flex:1;background:#1f1f1f;border:none;color:#fff;padding:10px;border-radius:8px">
      <button class="btn primary" id="acct-add" style="flex:0 0 auto;padding:0 16px">+</button>
    </div>
    <div class="btn-group"><button class="btn ghost" id="acct-done">完成</button></div>`;
  openSheet(html);
  function renderList(){
    const list = document.getElementById('acct-list');
    list.innerHTML = STATE.accounts.map((a,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#1f1f1f;border-radius:10px;margin-bottom:6px">
        <div style="font-size:20px;width:32px;text-align:center">${a.icon}</div>
        <div style="flex:1">${a.name}</div>
        <button data-acct-del="${i}" style="background:#2a0a0a;color:#ef4444;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px">删除</button>
      </div>`).join('') || '<div style="text-align:center;color:#666;padding:20px">暂无账户</div>';
    list.querySelectorAll('[data-acct-del]').forEach(b=>b.addEventListener('click',async()=>{
      const i = Number(b.dataset.acctDel);
      if(await showConfirm({icon:'🗑️', title:'删除账户？', message:`账户「${STATE.accounts[i].name}」将被删除\n已记录的账单不会改动`, okText:'删除', cancelText:'取消', danger:true})){
        STATE.accounts.splice(i,1);
        saveData(); renderList();
      }
    }));
  }
  renderList();
  document.getElementById('acct-add').addEventListener('click',()=>{
    const icon = document.getElementById('new-acct-icon').value.trim()||'💰';
    const name = document.getElementById('new-acct-name').value.trim();
    if(!name){ showToast('⚠️ 请输入账户名'); return; }
    const k = 'u_'+Date.now().toString(36);
    STATE.accounts.push({k, name, icon});
    saveData();
    document.getElementById('new-acct-icon').value = '';
    document.getElementById('new-acct-name').value = '';
    renderList();
  });
  document.getElementById('acct-done').addEventListener('click',closeSheet);
}

// ============ 主题色应用 ============
function applyThemeColor(){
  const c = STATE.settings.themeColor || '#ff8c1a';
  let styleEl = document.getElementById('theme-override');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'theme-override';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .tabbar .tab.active{color:${c}!important}
    .tabbar .add-btn .circle{background:${c}!important;box-shadow:0 4px 12px ${c}66!important}
    .tabbar .add-btn{color:${c}!important}
    .sheet .btn.primary{background:${c}!important}
    .type-switch .t.active{background:${c}!important}
    .shift-option.active{border-color:${c}!important;background:${c}22!important}
    .ot-opt.active{border-color:${c}!important;background:${c}22!important;color:${c}!important}
    .cat-item.active{border-color:${c}!important}
    .range-tab{color:${c}}
    .info-card .formula .tag.hour{background:${c}33;color:${c}}
    .mp-arr{color:#fff}
    .mp-month.active{border-color:${c}!important}
    .info-card .record-btn{background:${c}!important}
    .step-btn:active{background:${c}!important}
  `;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute('content', c);
}

// ============ 账单导入（支付宝/微信 CSV） ============
function openBillImport(){
  const html = `<h3>导入账单</h3>
    <div style="font-size:13px;color:#ccc;line-height:1.7;margin-bottom:12px">
      支持 <b>支付宝</b> 和 <b>微信</b> 账单 CSV 文件导入：
      <ol style="padding-left:18px;margin-top:6px;color:#888;font-size:12px">
        <li>支付宝：账单 → 右上角 → 开具交易流水证明 → 导出 CSV</li>
        <li>微信：支付 → 钱包 → 账单 → 右上角 → 账单下载</li>
      </ol>
      <div style="color:#888;font-size:12px;margin-top:6px">导入时系统会自动识别分类，原始数据不动。</div>
    </div>
    <input type="file" id="bill-file" accept=".csv" style="width:100%;padding:10px;background:#1f1f1f;border:none;color:#fff;border-radius:8px;margin-bottom:12px">
    <div id="bill-preview" style="font-size:12px;color:#888;max-height:200px;overflow-y:auto"></div>
    <div class="btn-group">
      <button class="btn ghost" id="bill-cancel">取消</button>
      <button class="btn primary" id="bill-confirm" disabled>导入</button>
    </div>`;
  openSheet(html);
  let parsedRecords = [];
  document.getElementById('bill-cancel').addEventListener('click',closeSheet);
  document.getElementById('bill-file').addEventListener('change',e=>{
    const f = e.target.files[0]; if(!f) return;
    const tryParse = (text, encoding)=>{
      try{
        parsedRecords = parseBillCSV(text);
        const preview = parsedRecords.slice(0,5).map(r=>`<div style="padding:4px 0">· ${r.note} · ¥${r.amount.toFixed(2)} · ${r.type==='expense'?'支出':'收入'}</div>`).join('');
        document.getElementById('bill-preview').innerHTML = `[${encoding}] 共识别 <b style="color:#fff">${parsedRecords.length}</b> 条记录（预览前 5 条）：<br>${preview}`;
        document.getElementById('bill-confirm').disabled = parsedRecords.length===0;
        return true;
      }catch(err){
        return false;
      }
    };
    // 先 UTF-8，失败后尝试 GBK
    const r1 = new FileReader();
    r1.onload = ev => {
      if(!tryParse(ev.target.result, 'UTF-8')){
        const r2 = new FileReader();
        r2.onload = ev2 => {
          if(!tryParse(ev2.target.result, 'GBK')){
            document.getElementById('bill-preview').innerHTML = '<span style="color:#ef4444">解析失败：未识别到账单格式，请检查文件是否为支付宝/微信导出的 CSV</span>';
            document.getElementById('bill-confirm').disabled = true;
          }
        };
        try{ r2.readAsText(f, 'gbk'); }catch(e){ r2.readAsText(f); }
      }
    };
    r1.readAsText(f, 'utf-8');
  });
  document.getElementById('bill-confirm').addEventListener('click',()=>{
    if(!parsedRecords.length) return;
    pushUndo('导入账单 '+parsedRecords.length+' 条');
    const importedIds = [];
    parsedRecords.forEach(r=>{
      r.id = Date.now()+'_'+Math.random().toString(36).slice(2,7);
      r.imported = true; // 标记刚导入
      STATE.records.push(r);
      importedIds.push(r.id);
    });
    saveData(); closeSheet();
    showToast('✅ 已导入 '+parsedRecords.length+' 条（黄色高亮）');
    switchTab('ledger');
    // 5秒后清除 imported 标志
    setTimeout(()=>{
      STATE.records.forEach(r=>{ if(importedIds.includes(r.id)) delete r.imported; });
      saveData();
      renderCurrentTab();
    }, 5000);
  });
}

// Toast 小提示（替代 alert）
function showToast(msg, duration=2000){
  const old = document.getElementById('toast');
  if(old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:calc(100px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#1a1410;color:#fff;padding:10px 18px;border-radius:22px;font-size:13px;z-index:500;opacity:0;transition:opacity .2s;box-shadow:0 4px 16px rgba(0,0,0,.5);border:1px solid #ff8c1a';
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.style.opacity='1');
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(), 200); }, duration);
}

// ============ 自定义 Confirm / Alert（替代系统弹窗） ============
function showConfirm(opts){
  return new Promise(resolve=>{
    const {title='提示', message='', okText='确定', cancelText='取消', danger=false, icon=''} = typeof opts==='string'?{message:opts}:opts;
    const old = document.getElementById('custom-dialog');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.id = 'custom-dialog';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);z-index:600;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .2s';
    mask.innerHTML = `
      <div class="cd-box" style="background:linear-gradient(180deg,#1a1a1a,#141414);border-radius:18px;padding:24px 20px 18px;max-width:320px;width:100%;border:1px solid #2a2a2a;box-shadow:0 12px 40px rgba(0,0,0,.5);transform:scale(.92);transition:transform .2s">
        ${icon?`<div style="font-size:40px;text-align:center;margin-bottom:10px">${icon}</div>`:''}
        <div style="font-size:17px;font-weight:700;text-align:center;color:#fff;margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:#a1a1aa;text-align:center;line-height:1.6;margin-bottom:22px;white-space:pre-line">${message}</div>
        <div style="display:flex;gap:10px">
          <button id="cd-cancel" style="flex:1;padding:11px;background:#27272a;border:none;color:#d4d4d8;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer">${cancelText}</button>
          <button id="cd-ok" style="flex:1;padding:11px;background:${danger?'linear-gradient(135deg,#dc2626,#991b1b)':'linear-gradient(135deg,#ff8c1a,#f97316)'};border:none;color:#fff;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px ${danger?'rgba(220,38,38,.3)':'rgba(255,140,26,.3)'}">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const box = mask.querySelector('.cd-box');
    requestAnimationFrame(()=>{ mask.style.opacity='1'; box.style.transform='scale(1)'; });
    const close = (result)=>{
      box.style.transform = 'scale(.92)';
      mask.style.opacity = '0';
      setTimeout(()=>{ mask.remove(); resolve(result); }, 200);
    };
    mask.querySelector('#cd-cancel').addEventListener('click',()=>close(false));
    mask.querySelector('#cd-ok').addEventListener('click',()=>close(true));
    mask.addEventListener('click',e=>{ if(e.target===mask) close(false); });
  });
}

function showAlert(opts){
  return new Promise(resolve=>{
    const {title='提示', message='', okText='知道了', icon=''} = typeof opts==='string'?{message:opts}:opts;
    const old = document.getElementById('custom-dialog');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.id = 'custom-dialog';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);z-index:600;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .2s';
    mask.innerHTML = `
      <div class="cd-box" style="background:linear-gradient(180deg,#1a1a1a,#141414);border-radius:18px;padding:24px 20px 18px;max-width:320px;width:100%;border:1px solid #2a2a2a;box-shadow:0 12px 40px rgba(0,0,0,.5);transform:scale(.92);transition:transform .2s">
        ${icon?`<div style="font-size:40px;text-align:center;margin-bottom:10px">${icon}</div>`:''}
        <div style="font-size:17px;font-weight:700;text-align:center;color:#fff;margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:#a1a1aa;text-align:center;line-height:1.6;margin-bottom:22px;white-space:pre-line">${message}</div>
        <button id="cd-ok" style="width:100%;padding:11px;background:linear-gradient(135deg,#ff8c1a,#f97316);border:none;color:#fff;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(255,140,26,.3)">${okText}</button>
      </div>`;
    document.body.appendChild(mask);
    const box = mask.querySelector('.cd-box');
    requestAnimationFrame(()=>{ mask.style.opacity='1'; box.style.transform='scale(1)'; });
    const close = ()=>{
      box.style.transform = 'scale(.92)';
      mask.style.opacity = '0';
      setTimeout(()=>{ mask.remove(); resolve(); }, 200);
    };
    mask.querySelector('#cd-ok').addEventListener('click',close);
    mask.addEventListener('click',e=>{ if(e.target===mask) close(); });
  });
}

// 解析账单 CSV（支付宝/微信格式）
function parseBillCSV(text){
  // 去掉 BOM
  text = text.replace(/^﻿/,'');
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  // 找到数据开始行（包含"交易时间"或"交易分类"的那行作为表头）
  let headerIdx = -1;
  for(let i=0;i<Math.min(30, lines.length);i++){
    if(/交易时间|交易分类|收\/支|金额/.test(lines[i])){
      headerIdx = i; break;
    }
  }
  if(headerIdx<0) throw new Error('未识别到账单格式');
  const headerRaw = lines[headerIdx].split(',').map(s=>s.trim().replace(/"/g,''));
  const colIdx = {
    time: headerRaw.findIndex(h=>/交易时间|交易创建时间/.test(h)),
    cat: headerRaw.findIndex(h=>/交易分类|商品/.test(h)),
    flow: headerRaw.findIndex(h=>/收\/支|收支/.test(h)),
    amount: headerRaw.findIndex(h=>/金额/.test(h)),
    target: headerRaw.findIndex(h=>/交易对方|对方/.test(h)),
  };
  const recs = [];
  // 关键字 → 分类映射
  const catMap = [
    [/餐饮|食品|饭|餐|美食|外卖/, 'food'],
    [/水果/, 'fruit'],
    [/零食/, 'snack'],
    [/饮料|饮品|茶|咖啡|奶茶/, 'drink'],
    [/购物|淘宝|京东|拼多多|天猫/, 'shop'],
    [/交通|滴滴|打车|地铁|公交|共享单车|加油/, 'traffic'],
    [/娱乐|游戏|电影|KTV/, 'fun'],
    [/医疗|药|医院/, 'medical'],
    [/教育|培训|书|学费/, 'edu'],
    [/住房|房租/, 'house'],
    [/水电|电费|燃气/, 'util'],
    [/网络|宽带/, 'net'],
    [/话费|流量/, 'phone'],
    [/服饰|衣服|服装/, 'cloth'],
    [/美容|化妆/, 'beauty'],
    [/健身/, 'gym'],
    [/旅行|酒店|机票|火车/, 'travel'],
    [/礼物/, 'gift'],
    [/宠物/, 'pet'],
    [/图书/, 'book'],
    [/运动/, 'sport'],
    [/保险/, 'insurance'],
    [/还款|信用卡/, 'repay'],
    [/工资/, 'salary'],
    [/红包/, 'redpack'],
    [/退款/, 'refund'],
  ];
  for(let i=headerIdx+1;i<lines.length;i++){
    const row = lines[i].split(',').map(s=>s.trim().replace(/^"|"$/g,''));
    if(row.length<3) continue;
    const timeStr = row[colIdx.time]||'';
    const flow = colIdx.flow>=0 ? row[colIdx.flow] : '';
    const amtStr = colIdx.amount>=0 ? row[colIdx.amount].replace(/[¥￥]/g,'') : '';
    const amt = parseFloat(amtStr);
    if(!timeStr || !amt || isNaN(amt)) continue;
    const t = new Date(timeStr.replace(/-/g,'/'));
    if(isNaN(t.getTime())) continue;
    const catText = (colIdx.cat>=0?row[colIdx.cat]:'') + (colIdx.target>=0?row[colIdx.target]:'');
    const note = colIdx.target>=0 ? row[colIdx.target] : '';
    let type = 'expense';
    if(/收入/.test(flow)) type = 'income';
    else if(/不计|转账/.test(flow)) continue; // 跳过不计收支
    let cat = 'other_e';
    for(const [re,k] of catMap){
      if(re.test(catText)){ cat = k; break; }
    }
    if(type==='income') cat = /工资|salary/.test(catText) ? 'salary' : 'other_i';
    recs.push({type, cat, amount:amt, note:note.slice(0,40), time:t.getTime()});
  }
  return recs;
}

// ============ 导出本月图片 ============
function exportMonthImage(){
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth()+1;
  const s = monthSummary(y, m);
  const W = 720, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, '#2d1a10');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);
  // Logo 小人 emoji
  ctx.font = '60px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏗️', W/2, 90);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('搬砖记 · 月度报告', W/2, 150);
  ctx.fillStyle = '#ff8c1a';
  ctx.font = 'bold 90px sans-serif';
  ctx.fillText(`${y}年${m}月`, W/2, 270);
  const items = [
    {label:'📅 出勤天数', value:s.days+' 天', color:'#ff8c1a'},
    {label:'⏱️ 总工时', value:(s.hours+s.otHours)+' 小时', color:'#3b82f6'},
    {label:'💰 预估收入', value:'¥ '+s.totalIncome.toFixed(0), color:'#fbbf24'},
    {label:'🏠 房补', value:'¥ '+s.housing.toFixed(0), color:'#10b981'},
  ];
  items.forEach((it,i)=>{
    const y0 = 360 + i*140;
    ctx.fillStyle = '#141414cc';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(60, y0, W-120, 110, 16);
    else ctx.rect(60, y0, W-120, 110);
    ctx.fill();
    ctx.fillStyle = '#ccc';
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(it.label, 100, y0+68);
    ctx.fillStyle = it.color;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(it.value, W-100, y0+72);
  });
  // 脚注
  ctx.fillStyle = '#666';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏗️ 由「搬砖记」生成 · '+ymd(new Date()), W/2, H-50);

  canvas.toBlob(blob=>{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `搬砖记_${y}年${m}月.png`;
    a.click();
  }, 'image/png');
}

// ============ 备份提醒 ============
function checkBackupReminder(){
  const last = Number(STATE.settings.backupReminderAt)||0;
  const days = (Date.now()-last)/86400000;
  const interval = Number(STATE.settings.backupInterval)||30;
  const recCount = STATE.records.length + Object.keys(STATE.hours).length;
  if(recCount>=20 && days>=interval){
    setTimeout(()=>showBackupBanner(Math.floor(days)), 3000);
  }
}
function showBackupBanner(days){
  if(document.getElementById('backup-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'backup-banner';
  banner.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%) translateY(-100%);top:calc(env(safe-area-inset-top) + 10px);z-index:150;background:linear-gradient(90deg,#ff8c1a,#fbbf24);color:#1a1410;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;gap:10px;max-width:calc(500px - 20px);width:calc(100% - 30px);transition:transform .3s;font-size:13px';
  banner.innerHTML = `
    <div style="font-size:22px">💾</div>
    <div style="flex:1;font-weight:500;line-height:1.3">已 ${days} 天未备份<br><span style="font-size:11px;font-weight:400">建议导出 JSON 一份</span></div>
    <button id="bk-now" style="background:#1a1410;color:#fbbf24;border:none;padding:6px 10px;border-radius:8px;font-weight:600;font-size:12px;cursor:pointer">立即备份</button>
    <button id="bk-later" style="background:transparent;color:#1a1410;border:none;font-size:20px;cursor:pointer;padding:0 4px">×</button>`;
  document.body.appendChild(banner);
  requestAnimationFrame(()=>{ banner.style.transform = 'translateX(-50%) translateY(0)'; });
  const dismiss = (delay)=>{
    STATE.settings.backupReminderAt = Date.now() - ((Number(STATE.settings.backupInterval)||30)-delay)*86400000;
    saveData();
    banner.style.transform = 'translateX(-50%) translateY(-100%)';
    setTimeout(()=>banner.remove(), 300);
  };
  banner.querySelector('#bk-now').addEventListener('click',()=>{
    STATE.settings.backupReminderAt = Date.now();
    saveData();
    const blob = new Blob([JSON.stringify(STATE,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '搬砖记数据_'+ymd(new Date())+'.json';
    a.click();
    banner.style.transform = 'translateX(-50%) translateY(-100%)';
    setTimeout(()=>banner.remove(), 300);
  });
  banner.querySelector('#bk-later').addEventListener('click',()=>dismiss(7));
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
  applyThemeColor();
  document.querySelectorAll('.tabbar .tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
  document.getElementById('add-btn').addEventListener('click',()=>openRecordSheet());
  document.getElementById('cal-month-chip').addEventListener('click',openMonthPicker);
  document.getElementById('ledger-stats-btn').addEventListener('click',()=>switchTab('stats'));
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
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  checkBackupReminder();
  checkFirstTimeGuide();
}

function checkFirstTimeGuide(){
  if(localStorage.getItem('gsjz_guided')) return;
  const recCount = STATE.records.length + Object.keys(STATE.hours).length;
  if(recCount>0){ localStorage.setItem('gsjz_guided','1'); return; }
  setTimeout(showFirstTimeGuide, 500);
}

function showFirstTimeGuide(){
  const g = document.createElement('div');
  g.id = 'guide-overlay';
  g.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .3s';
  let step = 0;
  const steps = [
    {icon:'🏗️', title:'欢迎来到搬砖记', desc:'打工人专属的工时记账小工具\n所有数据保存在本机，安全私密'},
    {icon:'📅', title:'记工时很简单', desc:'点击日历上的日期 → 填写工时和补贴\n收入会自动计算（含加班、餐补、房补）'},
    {icon:'💰', title:'记账也很方便', desc:'点中间橙色 + 号添加每日支出\n支持分类、账户、模板快速记账'},
    {icon:'📊', title:'数据随时看', desc:'账本右上📊进统计看趋势\n年底自动生成年度报告可分享'},
  ];
  function render(){
    const s = steps[step];
    g.innerHTML = `
      <div style="font-size:72px;margin-bottom:20px;animation:fadeUp .4s">${s.icon}</div>
      <div style="font-size:26px;font-weight:700;color:#fff;margin-bottom:14px">${s.title}</div>
      <div style="font-size:14px;color:#ccc;text-align:center;line-height:1.8;white-space:pre-line;max-width:320px">${s.desc}</div>
      <div style="display:flex;gap:8px;margin:28px 0">
        ${steps.map((_,i)=>`<div style="width:${i===step?24:8}px;height:8px;background:${i===step?'#ff8c1a':'#444'};border-radius:4px;transition:all .2s"></div>`).join('')}
      </div>
      <div style="display:flex;gap:12px">
        <button id="g-skip" style="background:transparent;border:1px solid #444;color:#888;padding:10px 20px;border-radius:10px;cursor:pointer">跳过</button>
        <button id="g-next" style="background:#ff8c1a;border:none;color:#fff;padding:10px 30px;border-radius:10px;font-weight:600;cursor:pointer">${step===steps.length-1?'开始使用':'下一步'}</button>
      </div>
      <style>@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}</style>`;
    g.querySelector('#g-skip').addEventListener('click', close);
    g.querySelector('#g-next').addEventListener('click',()=>{
      step++;
      if(step>=steps.length) close();
      else render();
    });
  }
  function close(){
    localStorage.setItem('gsjz_guided','1');
    g.style.opacity = '0';
    setTimeout(()=>g.remove(), 300);
  }
  document.body.appendChild(g);
  requestAnimationFrame(()=>{ g.style.opacity = '1'; });
  render();
}
document.addEventListener('DOMContentLoaded',init);





