/* 创作者数据分析 · 主逻辑 */
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad2 = n => String(n).padStart(2, '0');
const esc  = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const WK_BASE_UTC = Date.UTC(2026, 8, 1);
const WK_BASE_NUM = 36;
const WK_BASE_DATE = '2026-09-01';
const BIZ_LIST = ['买手合作', '博主合作'];
const CAT_ORDER = { '老人': 1, '次月': 2, '首月': 3 };
const S30_THRESHOLD = { '买手合作': 0.97, '博主合作': 0.95 };
const WEEKDAY_CN = ['日','一','二','三','四','五','六'];

const METRICS = [
  { key:'caseVolume', label:'CASE处理量', icon:'📊', digits:0, pct:false, better:'up' },
  { key:'cpd', label:'CPD', icon:'📈', digits:2, pct:false, better:'up' },
  { key:'aht', label:'AHT', icon:'⏱️', digits:2, pct:false, better:'down' },
  { key:'concurrency', label:'并发', icon:'🔀', digits:2, pct:false, better:'up' },
  { key:'utilization', label:'工时利用率', icon:'⚙️', digits:2, pct:true, better:'up' },
  { key:'solveRate', label:'解决率', icon:'✅', digits:2, pct:true, better:'up' },
  { key:'satisfaction', label:'满意度', icon:'⭐', digits:2, pct:true, better:'up' },
  { key:'escalateRate', label:'升级率', icon:'⚠️', digits:2, pct:true, better:'down' },
  { key:'fcr', label:'FCR', icon:'🔁', digits:2, pct:true, better:'down' },
  { key:'qualityPassRate', label:'质检合格率', icon:'🎯', digits:2, pct:true, better:'up' },
  { key:'s30Rate', label:'30S接起率', icon:'📞', digits:2, pct:true, better:'up' },
];
const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));
const metricLabel = m => (m.icon ? m.icon + ' ' : '') + m.label;
const METRIC_BG = { caseVolume:'#E8EDF3', cpd:'#F3EFE2', aht:'#E4EFE6', concurrency:'#F5E6EC', utilization:'#E4EAF5', solveRate:'#F5F0DF', satisfaction:'#ECE6F5', escalateRate:'#E0EFEC', fcr:'#F5E4E2', qualityPassRate:'#F0E6F0', s30Rate:'#E0EFEC' };

const MAP_DEF = {
  buyer: { name:'主责客服姓名', date:'CASE创建日期', period:'CASE创建时段', l1:'一级打点', l2:'二级打点', volume:'人工服务量', s30Num:'30S接起率-分子', s30Den:'30S接起率-分母', aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量', satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数', repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）' },
  blogger: { name:'主责客服姓名', date:'CASE创建日期', period:'CASE创建时段', l1:'一级打点', l2:'二级打点', volume:'人工服务量', s30Num:'30S接起量', s30Den:'人工服务量', aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量', satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数', repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）' },
  inspectionBuyer: { date:'质检日期', id:'质检对象id', name:'责任客服姓名', l1:'一级打点', pass:'是否合格' },
  inspectionBlogger: { date:'质检日期', id:'质检对象id', name:'责任客服姓名', l1:'一级打点', pass:'是否合格' },
  worktime: { name:'客服姓名', date:'日期', online:'在线（H）', after:'后处理（H）', official:'公务（H）', train:'培训（H）', mentor:'带教（H）', rest:'小休（H）,包含busy', meal:'就餐（H）', total:'总登录时长（不含就餐）-H' },
  business:  { l1:'一级打点', biz:'业务线' },
  business2: { l1:'一级打点', l2:'二级打点', biz:'业务线' },
  buyerSla:   {},
  bloggerSla: {},
};
const FIELD_LABEL = { name:'姓名', date:'日期', period:'时段', l1:'一级打点', l2:'二级打点', volume:'CASE处理量（人工服务量）', s30Num:'30S接起率-分子', s30Den:'30S接起率-分母', aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量', satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数', repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）', online:'在线时长', after:'后处理时长', official:'公务时长', train:'培训时长', mentor:'带教时长', rest:'小休时长（含busy）', meal:'就餐时长', total:'总登录时长（不含就餐）', biz:'业务线', id:'质检对象id', pass:'是否合格' };
const MAP_TITLE = { buyer:'买手员工数据', blogger:'博主员工数据', inspectionBuyer:'买手员工质检', inspectionBlogger:'博主员工质检', worktime:'工时', business:'业务线映射', business2:'二级打点映射', buyerSla:'买手员工SLA', bloggerSla:'博主员工SLA' };
const DATE_BG = ['#E8EDF3','#F3EFE2','#E4EFE6','#F5E6EC','#E4EAF5','#F5F0DF','#ECE6F5','#E0EFEC','#F5E4E2','#F0E6F0'];

const BUYER_AHT2_ORDER = [['买手带货','业务介绍'],['买手带货','准入门槛'],['买手带货','买手撮合'],['买手带货','商家分销'],['买手带货','买手选品'],['买手带货','笔记带货'],['买手带货','橱窗带货'],['买手带货','蓝链带货'],['买手带货','直播带货'],['买手带货','营销运营'],['买手带货','直播间审核'],['买手带货','笔记审核'],['买手带货','账号违规'],['买手带货','买手拿样'],['买手带货','买手成长'],['买手带货','商家分销结算'],['买手带货','经营数据'],['买手带货','买手活动'],['买手带货','合作纠纷'],['买手带货','买手财务'],['买手合作','其他']];
const BLOGGER_AHT2_ORDER = [['博主合作','蒲公英准入/准出'],['博主合作','蒲公英合作产品'],['博主合作','财务管理'],['博主合作','蒲公英审核'],['博主合作','健康等级'],['博主合作','蒲公英数据'],['博主合作','蒲公英合作纠纷'],['博主合作','蒲公英基础功能'],['蒲公英代理商','代理商入驻/审核'],['蒲公英代理商','蒲公英代理商保证金'],['蒲公英代理商','核实/解绑蒲公英代理商'],['蒲公英代理商','蒲公英代理商登录'],['蒲公英代理商','蒲公英代理商功能操作'],['蒲公英代理商','蒲公英代理商管理规范咨询'],['蒲公英代理商','蒲公英代理商策略'],['MCN机构（新）','MCN商业入驻'],['MCN机构（新）','MCN机构保证金'],['MCN机构（新）','MCN生态'],['博主合作','其他'],['博主合作','博主其他']];

const normAHT2 = s => String(s == null ? '' : s).replace(/\uFF08/g,'(').replace(/\uFF09/g,')').replace(/\uFF0F/g,'/').replace(/\u3000/g,'').replace(/\s+/g,'').toLowerCase();
const aht2Key = (l1, l2) => normAHT2(l1) + '|' + normAHT2(l2);

const S = { fileName:'', sheets:{}, headers:{}, mapping:{}, roster:[], records:[], wtRecords:[], inspections:[], slaBuyer:[], slaBlogger:[], businessMap:{}, business2Map:{}, shiftMap:{}, schedule:{}, scheduleDates:[], month:'', latestDate:'', latestWK:0, hidden:false, attOverride:{}, personSel:new Set(), teamSel:{ group:new Set(), batch:new Set(), category:new Set() }, s30Dates:new Set(), s30ShowSummary:true, expandedRows:new Set(), forecastBuyer:{}, forecastBlogger:{} };

const num = v => { if (v===''||v==null) return 0; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?0:n; };
const fmtVal = (n,m) => { if (n==null||!isFinite(n)) return '—'; if (m.pct) return (n*100).toFixed(m.digits)+'%'; return n.toFixed(m.digits); };
const fmtInt = v => (v==null||!isFinite(v)) ? '—' : String(Math.round(v));
const pct2 = v => (v==null||!isFinite(v)) ? '—' : (v*100).toFixed(2)+'%';
const num2 = (v,d) => (v==null||!isFinite(v)) ? '—' : v.toFixed(d==null?2:d);
const dArrow = d => (d==null||!isFinite(d)||Math.abs(d)<1e-9) ? '' : (d>0?'↑':'↓');
const dStr = (d,dg) => (d==null||!isFinite(d)) ? '—' : (d>0?'+':'')+d.toFixed(dg==null?2:dg);
const dPct = (d,dg) => (d==null||!isFinite(d)) ? '—' : (d>0?'+':'')+(d*100).toFixed(dg==null?2:dg)+'%';

function isPassValue(v) { const s = String(v == null ? '' : v).trim(); if (!s) return false; if (/不合格|不通过|不达标|未通过|fail/i.test(s)) return false; if (/^(n|no|0|false|否)$/i.test(s)) return false; return true; }
function bizToSrc(biz) { return biz === '博主合作' ? 'blogger' : 'buyer'; }

function parseDate(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date) return v.getFullYear()+'-'+pad2(v.getMonth()+1)+'-'+pad2(v.getDate());
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899,11,30) + Math.round(v*86400000)); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
  const s = String(v).trim();
  let m = /^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/.exec(s);
  if (m) return m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]);
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
  if (m) return m[3]+'-'+pad2(m[1])+'-'+pad2(m[2]);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  return '';
}
const monthOf = d => d ? d.slice(0,7) : '';
const wkOf = d => { if (!d) return 0; const t = Date.parse(d + 'T00:00:00Z'); if (isNaN(t)) return 0; return WK_BASE_NUM + Math.floor(Math.floor((t - WK_BASE_UTC) / 86400000) / 7); };
const dateAdd = (d, delta) => { const t = Date.parse(d + 'T00:00:00Z') + delta * 86400000; if (isNaN(t)) return ''; const x = new Date(t); return x.getUTCFullYear()+'-'+pad2(x.getUTCMonth()+1)+'-'+pad2(x.getUTCDate()); };
const wkStartDate = wk => dateAdd(WK_BASE_DATE, (wk - WK_BASE_NUM) * 7);
const wkEndDate   = wk => dateAdd(wkStartDate(wk), 6);
const weekdayOf   = d => d ? WEEKDAY_CN[new Date(d + 'T00:00:00Z').getUTCDay()] : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getCheckedValues(selector) { const el = $(selector); if (!el) return []; return Array.from(el.querySelectorAll('.chip.on')).map(ch => ch.dataset.val); }
function ensureChipContainer(id) { let el = document.getElementById(id); if (!el) return null; if (el.tagName !== 'DIV') { const div = document.createElement('div'); div.id = id; el.parentNode.replaceChild(div, el); el = div; } if (!el.classList.contains('chips')) el.classList.add('chips'); el.style.margin = '0'; return el; }
function setProgress(pct, text) { const w = $('#progressWrap'); if (w) w.classList.remove('hidden'); const f = $('#progressFill'); if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%'; const p = $('#progressPct'); if (p) p.textContent = Math.round(pct) + '%'; if (text) { const t = $('#progressText'); if (t) t.textContent = text; } }
function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);background:#3A3A44;color:#fff;padding:10px 22px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.2);transition:.25s;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.bottom = '60px'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 1800);
}

function identify(name) {
  const n = String(name);
  if (/花名册|名单|员工表|人员表|人员信息/.test(n)) return 'roster';
  if (/班次/.test(n)) return 'shift';
  if (/班表|排班/.test(n)) return 'schedule';
  if (/买手.*质检|质检.*买手/.test(n)) return 'inspectionBuyer';
  if (/博主.*质检|质检.*博主/.test(n)) return 'inspectionBlogger';
  if (/二级打点|二级映射/.test(n)) return 'business2';
  if (/买手.*SLA|SLA.*买手/i.test(n)) return 'buyerSla';
  if (/博主.*SLA|SLA.*博主/i.test(n)) return 'bloggerSla';
  if (/买手.*预测|预测.*买手/.test(n)) return 'forecastBuyer';
  if (/博主.*预测|预测.*博主/.test(n)) return 'forecastBlogger';
  if (/买手/.test(n)) return 'buyer';
  if (/博主/.test(n)) return 'blogger';
  if (/工时|在线时长|工时表/.test(n)) return 'worktime';
  if (/业务线/.test(n)) return 'business';
  return null;
}
function detectHeaders(rows) {
  if (!rows || !rows.length) return [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i] || [];
    const nonEmpty = r.filter(x => x !== '' && x != null).length;
    if (nonEmpty >= 2) return r.map(x => String(x == null ? '' : x).trim());
  }
  return (rows[0] || []).map(x => String(x == null ? '' : x).trim());
}
function normalize(s) { return String(s||'').replace(/\s+/g,'').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/[，]/g,',').replace(/[－—]/g,'-').toLowerCase(); }
function autoMatch(headers, wanted) {
  let hit = headers.find(h => h === wanted);
  if (hit) return hit;
  const nw = normalize(wanted);
  hit = headers.find(h => normalize(h) === nw);
  if (hit) return hit;
  hit = headers.find(h => { const nh = normalize(h); return nh && (nh.includes(nw) || nw.includes(nh)); });
  return hit || '';
}
function buildAutoMap(headers, def) { const out = {}; for (const k in def) out[k] = autoMatch(headers, def[k]); return out; }

async function handleFile(file) {
  if (typeof XlsxParser === 'undefined') { alert('解析器未加载：请确认 lib/xlsx.js 存在，且 index.html 里 <script src="lib/xlsx.js"></script> 位于 dashboard.js 之前。'); return; }
  S.fileName = file.name;
  const impSum = $('#importSummary'); if (impSum) impSum.innerHTML = '';
  setProgress(1, '准备读取…');
  try {
    const lower = file.name.toLowerCase();
    let sheets;
    if (lower.endsWith('.csv')) {
      setProgress(20, '读取 CSV…');
      const text = await file.text();
      const base = file.name.replace(/\.csv$/i, '');
      sheets = [{ name: base || 'Sheet1', rows: parseCSV(text) }];
    } else {
      const buf = await file.arrayBuffer();
      sheets = await XlsxParser.parseWorkbook(buf, (p, t) => setProgress(p * 0.85, t));
    }
    setProgress(88, '识别工作表类型…'); await sleep(30);
    S.sheets = {}; S.headers = {}; S.mapping = {};
    for (const sh of sheets) {
      const k = identify(sh.name);
      if (!k || S.sheets[k]) continue;
      S.sheets[k] = sh;
      S.headers[k] = detectHeaders(sh.rows);
    }
    for (const mod of ['buyer','blogger','inspectionBuyer','inspectionBlogger','worktime','business','business2']) {
      if (S.headers[mod]) S.mapping[mod] = buildAutoMap(S.headers[mod], MAP_DEF[mod]);
    }
    setProgress(92, '解析花名册…'); await sleep(20);
    parseRoster();
    setProgress(96, '构建数据记录…'); await sleep(20);
    buildAll();
    setProgress(99, '汇总…'); await sleep(20);
    afterLoad();
    setProgress(100, '完成');
    const st = $('#dataStatus');
    if (st) {
      const nm = S.fileName.length > 12 ? S.fileName.slice(0, 12) + '…' : S.fileName;
      st.textContent = '✓ ' + nm;
      st.title = '已导入：' + S.fileName;
      st.classList.remove('pill-off');
      st.classList.add('pill-on');
    }
  } catch (err) {
    console.error(err);
    setProgress(0, '❌ ' + err.message);
    alert('解析失败：' + err.message);
  }
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { cur.push(field); field = ''; } else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; } else if (c !== '\r') field += c; }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function rowsToObjs(kind) {
  const sheet = S.sheets[kind];
  if (!sheet) return [];
  const headers = S.headers[kind] || [];
  const map = S.mapping[kind] || {};
  const idx = {};
  for (const k in map) idx[k] = map[k] ? headers.indexOf(map[k]) : -1;
  const out = [];
  for (let i = 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    if (!r || !r.length) continue;
    const o = {};
    for (const k in idx) o[k] = idx[k] >= 0 && r[idx[k]] !== undefined ? r[idx[k]] : '';
    if (!String(o.name||'').trim() && !String(o.date||'').trim() && !String(o.l1||'').trim() && !String(o.id||'').trim() && !String(o.metric||'').trim()) continue;
    out.push(o);
  }
  return out;
}

function parseRoster() {
  S.roster = [];
  const sheet = S.sheets.roster;
  if (!sheet) return;
  const headers = S.headers.roster || [];
  const findCol = (keys) => {
    for (const k of keys) { const i = headers.findIndex(h => h === k); if (i >= 0) return i; }
    for (const k of keys) { const nk = normalize(k); const i = headers.findIndex(h => normalize(h).includes(nk)); if (i >= 0) return i; }
    return -1;
  };
  const cName   = findCol(['姓名','员工姓名','客服姓名','主责客服姓名']);
  const cGroup  = findCol(['组别','小组','团队']);
  const cBatch  = findCol(['批次']);
  const cOnline = findCol(['上线日期','上线时间','入职日期']);
  const cBiz    = findCol(['业务线']);
  const cAttr   = findCol(['属性','员工属性']);
  const cResign = findCol(['离职日期','离职时间','离职日','离职']);
  const catCols = [];
  headers.forEach((h, i) => { if (/分类/.test(h)) { const mm = /(\d{1,2})\s*月/.exec(h); catCols.push({ idx:i, month: mm ? parseInt(mm[1],10) : null }); } });

  for (let i = 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i] || [];
    const name = cName >= 0 ? String(r[cName] || '').trim() : '';
    if (!name) continue;
    const emp = {
      name,
      group:      cGroup  >= 0 ? String(r[cGroup]  || '').trim() : '',
      batch:      cBatch  >= 0 ? String(r[cBatch]  || '').trim() : '',
      onlineDate: cOnline >= 0 ? parseDate(r[cOnline]) : '',
      biz:        cBiz    >= 0 ? String(r[cBiz]    || '').trim() : '',
      attr:       cAttr   >= 0 ? String(r[cAttr]   || '').trim() : '',
      categories: {},
      resignDate: cResign >= 0 ? parseDate(r[cResign]) : ''
    };
    for (const cc of catCols) {
      const v = String(r[cc.idx] || '').trim();
      if (cc.month != null) emp.categories[cc.month] = v;
      else if (emp.categories['*'] == null) emp.categories['*'] = v;
    }
    S.roster.push(emp);
  }

  try {
    const memo = JSON.parse(localStorage.getItem('creator_roster_memo') || '{}');
    if (memo.resign) for (const e of S.roster) if (memo.resign[e.name]) e.resignDate = memo.resign[e.name];
    if (memo.att) S.attOverride = memo.att;
  } catch (_) {}
}
function persistMemo() { const resign = {}; for (const e of S.roster) if (e.resignDate) resign[e.name] = e.resignDate; localStorage.setItem('creator_roster_memo', JSON.stringify({ resign, att: S.attOverride })); }
function getEmp(name) { return S.roster.find(e => e.name === name); }
function categoryOf(emp, monthStr) { if (!emp) return ''; if (monthStr) { const m = parseInt(monthStr.slice(5,7), 10); if (emp.categories[m] != null && emp.categories[m] !== '') return emp.categories[m]; } return emp.categories['*'] || ''; }
function catSortKey(c) { for (const k in CAT_ORDER) if (String(c).includes(k)) return CAT_ORDER[k]; return 9; }
function empBiz(name) { const e = getEmp(name); if (!e) return ''; const b = String(e.biz || ''); if (BIZ_LIST.includes(b)) return b; if (/买手/.test(b)) return '买手合作'; if (/博主/.test(b)) return '博主合作'; return ''; }
function employeeVisible(e) { if (!e) return false; if (S.hidden && e.resignDate) return false; return true; }
function srcEmployeeSet(src) { const set = new Set(); for (const r of S.records) if (r.src === src) set.add(r.name); for (const r of S.inspections) if (r.src === src) set.add(r.name); return set; }
function bizByL1(l1, defaultBiz) { const b = S.businessMap[l1] || ''; if (BIZ_LIST.includes(b)) return b; return defaultBiz; }
function bizByL1L2(l1, l2, defaultBiz) {
  const key = (l1 || '') + '|' + (l2 || '');
  const b2 = S.business2Map[key] || '';
  if (b2) return { biz: b2, l1: l1, l2: l2 };
  if (defaultBiz === '买手合作') return { biz: '买手合作', l1: '买手合作', l2: '其他' };
  return { biz: '博主合作', l1: '博主合作', l2: '博主其他' };
}

function normPeriod(p) {
  const s = String(p == null ? '' : p).trim();
  if (!s) return '';
  const m = /^(\d{1,2})/.exec(s);
  if (m) return String(parseInt(m[1], 10));
  return s;
}

function parseForecastSheet(kind) {
  const sheet = S.sheets[kind];
  if (!sheet) return {};
  const rows = sheet.rows || [];
  if (!rows.length) return {};

  let headerRow = -1;
  let dateCols = [];
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const row = rows[r] || [];
    const dc = [];
    for (let c = 0; c < row.length; c++) {
      const d = parseDate(row[c]);
      if (d) dc.push({ idx: c, date: d });
    }
    if (dc.length >= 2) { headerRow = r; dateCols = dc; break; }
  }
  if (headerRow < 0 || !dateCols.length) return {};

  const firstDateCol = Math.min.apply(null, dateCols.map(d => d.idx));
  const periodCol = firstDateCol > 0 ? firstDateCol - 1 : 0;

  const out = {};
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.length) continue;
    const periodRaw = row[periodCol];
    if (periodRaw == null || periodRaw === '') continue;
    const period = normPeriod(periodRaw);
    if (!period) continue;
    for (const dc of dateCols) {
      const raw = row[dc.idx];
      if (raw === '' || raw == null) continue;
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
      if (isNaN(parsed)) continue;
      out[dc.date + '|' + period] = parsed;
    }
  }
  return out;
}

function normPctVal(v) {
  const n = num(v);
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}
function parseSlaSheet(kind) {
  const sheet = S.sheets[kind];
  if (!sheet) return [];
  const headers = S.headers[kind] || [];
  const cMetric   = headers.findIndex(h => /指标/.test(h));
  const cCategory = headers.findIndex(h => /分类/.test(h));
  if (cMetric < 0 || cCategory < 0) return [];

  const monthCols = {};
  headers.forEach((h, i) => {
    const hh = String(h||'').trim();
    let m;
    if ((m = /^(\d{1,2})\s*月\s*权重$/.exec(hh))) {
      const mo = parseInt(m[1], 10);
      (monthCols[mo] = monthCols[mo] || {}).weight = i;
    } else if ((m = /^(\d{1,2})\s*月\s*目标$/.exec(hh))) {
      const mo = parseInt(m[1], 10);
      (monthCols[mo] = monthCols[mo] || {}).target = i;
    } else if ((m = /^(\d{1,2})\s*月\s*得分$/.exec(hh))) {
      const mo = parseInt(m[1], 10);
      (monthCols[mo] = monthCols[mo] || {}).points = i;
    }
  });

  const groups = new Map();
  for (let r = 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const metric   = String(row[cMetric]   || '').trim();
    const category = String(row[cCategory] || '').trim();
    if (!metric || !category) continue;
    const key = metric + '|' + category;
    if (!groups.has(key)) groups.set(key, { metric, category, months: {} });
    const g = groups.get(key);

    for (const moStr in monthCols) {
      const mo = parseInt(moStr, 10);
      const cols = monthCols[mo];
      if (!g.months[mo]) g.months[mo] = { weight: null, tiers: [] };
      const mObj = g.months[mo];

      if (mObj.weight == null && cols.weight != null) {
        const raw = row[cols.weight];
        if (raw !== '' && raw != null) {
          const v = normPctVal(raw);
          if (v != null) mObj.weight = v;
        }
      }
      const tRaw = cols.target != null ? row[cols.target] : '';
      const pRaw = cols.points != null ? row[cols.points] : '';
      if (tRaw !== '' && tRaw != null && pRaw !== '' && pRaw != null) {
        const pts = num(pRaw);
        if (isFinite(pts)) mObj.tiers.push({ rawThreshold: tRaw, points: pts });
      }
    }
  }

  for (const g of groups.values()) {
    for (const mo in g.months) {
      const mObj = g.months[mo];
      for (const t of mObj.tiers) t.threshold = normPctVal(t.rawThreshold);
      mObj.tiers = mObj.tiers.filter(t => t.threshold != null && isFinite(t.threshold));
      mObj.tiers.sort((a, b) => b.threshold - a.threshold);
    }
  }
  return Array.from(groups.values());
}

function buildAll() {
  S.records = []; S.wtRecords = []; S.inspections = [];
  S.slaBuyer = []; S.slaBlogger = [];
  S.businessMap = {}; S.business2Map = {};
  S.shiftMap = {}; S.schedule = {}; S.scheduleDates = [];
  S.forecastBuyer = {}; S.forecastBlogger = {};
  if (S.sheets.business) { for (const o of rowsToObjs('business')) { const l1 = String(o.l1||'').trim(); const biz = String(o.biz||'').trim(); if (l1 && biz && !S.businessMap[l1]) S.businessMap[l1] = biz; } }
  if (S.sheets.business2) { for (const o of rowsToObjs('business2')) { const l1 = String(o.l1||'').trim(); const l2 = String(o.l2||'').trim(); const biz = String(o.biz||'').trim(); if (l1 && l2 && biz) { const key = l1 + '|' + l2; if (!S.business2Map[key]) S.business2Map[key] = biz; } } }
  if (S.sheets.shift) { for (const row of S.sheets.shift.rows) { if (!row) continue; const name = String(row[0]||'').trim(); if (!name || name === '班次') continue; S.shiftMap[name] = num(row[1]); } }
  if (S.sheets.schedule) {
    const rows = S.sheets.schedule.rows;
    if (rows.length) {
      const head = rows[0] || [];
      const dates = []; const dateCols = [];
      for (let c = 0; c < head.length; c++) { const d = parseDate(head[c]); if (d) { dates.push(d); dateCols.push(c); } }
      S.scheduleDates = dates;
      let nameCol = -1;
      for (let r = 0; r < Math.min(rows.length, 3) && nameCol < 0; r++) { const rr = rows[r] || []; for (let c = 0; c < rr.length; c++) if (String(rr[c]||'').trim() === '姓名') { nameCol = c; break; } }
      if (nameCol < 0) nameCol = 0;
      let start = 1;
      for (let r = 0; r < Math.min(rows.length, 3); r++) { const rr = rows[r] || []; if (String(rr[nameCol]||'').trim() === '姓名') { start = r + 1; break; } }
      for (let r = start; r < rows.length; r++) {
        const row = rows[r] || [];
        const name = String(row[nameCol]||'').trim();
        if (!name) continue;
        if (!S.schedule[name]) S.schedule[name] = {};
        for (let i = 0; i < dateCols.length; i++) S.schedule[name][dates[i]] = String(row[dateCols[i]]||'').trim();
      }
    }
  }
  for (const mod of ['buyer','blogger']) {
    if (!S.sheets[mod]) continue;
    const defaultBiz = (mod === 'buyer') ? '买手合作' : '博主合作';
    for (const o of rowsToObjs(mod)) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      if (!name || !date) continue;
      const l1Raw = String(o.l1||'').trim();
      const l2Raw = String(o.l2||'').trim();
      const biz = bizByL1(l1Raw, defaultBiz);
      const m2 = bizByL1L2(l1Raw, l2Raw, defaultBiz);
      S.records.push({ src: mod, biz, biz2: m2.biz, name, date, wk: wkOf(date), month: monthOf(date), period: String(o.period||'').trim(), l1: m2.l1, l2: m2.l2, l1Raw, l2Raw, volume: num(o.volume), s30Num: num(o.s30Num), s30Den: num(o.s30Den), aht: num(o.aht), solved: num(o.solved), solveEval: num(o.solveEval), satisfy: num(o.satisfy), satisfyEval: num(o.satisfyEval), escalate: num(o.escalate), repeat72: num(o.repeat72), fcrDen: num(o.fcrDen) });
    }
  }
  for (const mod of ['inspectionBuyer','inspectionBlogger']) {
    if (!S.sheets[mod]) continue;
    const src = (mod === 'inspectionBuyer') ? 'buyer' : 'blogger';
    const defaultBiz = (mod === 'inspectionBuyer') ? '买手合作' : '博主合作';
    for (const o of rowsToObjs(mod)) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      const id = String(o.id||'').trim();
      if (!date || !id) continue;
      const l1 = String(o.l1||'').trim();
      const biz = bizByL1(l1, defaultBiz);
      S.inspections.push({ src, biz, name, date, id, l1, wk: wkOf(date), month: monthOf(date), pass: isPassValue(o.pass) });
    }
  }
  if (S.sheets.worktime) {
    for (const o of rowsToObjs('worktime')) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      if (!name || !date) continue;
      S.wtRecords.push({ name, date, wk: wkOf(date), month: monthOf(date), biz: empBiz(name), online: num(o.online), after: num(o.after), official: num(o.official), train: num(o.train), mentor: num(o.mentor), rest: num(o.rest), meal: num(o.meal), total: num(o.total) });
    }
  }
  if (S.sheets.buyerSla) S.slaBuyer = parseSlaSheet('buyerSla');
  if (S.sheets.bloggerSla) S.slaBlogger = parseSlaSheet('bloggerSla');
  S.forecastBuyer   = parseForecastSheet('forecastBuyer');
  S.forecastBlogger = parseForecastSheet('forecastBlogger');
  const dates = [];
  for (const r of S.records) dates.push(r.date);
  for (const r of S.wtRecords) dates.push(r.date);
  for (const r of S.inspections) dates.push(r.date);
  dates.sort();
  S.latestDate = dates[dates.length-1] || '';
  S.latestWK = wkOf(S.latestDate);
  S.month = monthOf(S.latestDate);
  if (S.s30Dates.size === 0 && S.latestDate) { for (let i = 0; i < 3; i++) { const d = dateAdd(S.latestDate, -i); if (d) S.s30Dates.add(d); } }
}

function attOf(name, date) { const ov = S.attOverride[name]; if (ov && ov[date] !== undefined) return ov[date]; const sched = S.schedule[name]; if (!sched) return 0; const shift = sched[date]; if (!shift) return 0; return S.shiftMap[shift] != null ? S.shiftMap[shift] : 0; }

function aggregate(recs, wts, attDays, insp) {
  let volume=0, s30Num=0, s30Den=0, aht=0, solved=0, solveEval=0, satisfy=0, satisfyEval=0, escalate=0, repeat72=0, fcrDen=0, online=0, after=0, total=0;
  for (const r of recs) { volume += r.volume; s30Num += r.s30Num; s30Den += r.s30Den; aht += r.aht; solved += r.solved; solveEval += r.solveEval; satisfy += r.satisfy; satisfyEval += r.satisfyEval; escalate += r.escalate; repeat72 += r.repeat72; fcrDen += r.fcrDen; }
  for (const w of wts) { online += w.online; after += w.after; total += w.total; }
  const inspTotal = insp ? insp.total : 0; const inspPass = insp ? insp.pass : 0;
  return { caseVolume: volume, cpd: attDays > 0 ? volume / attDays : null, aht: volume > 0 ? aht / volume : null, concurrency: online > 0 ? aht / (online * 60) : null, utilization: total > 0 ? (online + after) / total : null, solveRate: solveEval > 0 ? solved / solveEval : null, satisfaction: satisfyEval > 0 ? satisfy / satisfyEval : null, escalateRate: volume > 0 ? escalate / volume : null, fcr: fcrDen > 0 ? 1 - repeat72 / fcrDen : null, qualityPassRate: inspTotal > 0 ? inspPass / inspTotal : null, s30Num, s30Den, s30Miss: s30Den - s30Num, s30Rate: s30Den > 0 ? s30Num / s30Den : null };
}

function filterRecs(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, src } = o || {};
  return S.records.filter(r => {
    if (bizL1 && r.biz !== bizL1) return false;
    if (src && r.src !== src) return false;
    if (nameSet && !nameSet.has(r.name)) return false;
    if (dateSet && !dateSet.has(r.date)) return false;
    if (wkSet && !wkSet.has(r.wk)) return false;
    if (monthSet && !monthSet.has(r.month)) return false;
    return true;
  });
}
function filterWt(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, srcEmps } = o || {};
  return S.wtRecords.filter(r => {
    if (bizL1 && r.biz !== bizL1) return false;
    if (srcEmps && !srcEmps.has(r.name)) return false;
    if (nameSet && !nameSet.has(r.name)) return false;
    if (dateSet && !dateSet.has(r.date)) return false;
    if (wkSet && !wkSet.has(r.wk)) return false;
    if (monthSet && !monthSet.has(r.month)) return false;
    return true;
  });
}
function inspectionStats(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, src } = o || {};
  const seen = new Set();
  let total = 0, passCount = 0;
  for (const r of S.inspections) {
    if (bizL1 && r.biz !== bizL1) continue;
    if (src && r.src !== src) continue;
    if (nameSet && !nameSet.has(r.name)) continue;
    if (dateSet && !dateSet.has(r.date)) continue;
    if (wkSet && !wkSet.has(r.wk)) continue;
    if (monthSet && !monthSet.has(r.month)) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    total += 1;
    if (r.pass) passCount += 1;
  }
  return { total, pass: passCount, fail: total - passCount };
}

function s30AggFor(biz, opts) {
  const timeOpts = {};
  if (opts) {
    if (opts.dateSet)  timeOpts.dateSet  = opts.dateSet;
    if (opts.wkSet)    timeOpts.wkSet    = opts.wkSet;
    if (opts.monthSet) timeOpts.monthSet = opts.monthSet;
    if (opts.nameSet)  timeOpts.nameSet  = opts.nameSet;
    if (opts.srcEmps)  timeOpts.srcEmps  = opts.srcEmps;
  }
  const o = Object.assign({ bizL1: biz }, timeOpts);
  return aggregate(filterRecs(o), filterWt(o), 0, inspectionStats(o));
}

function calcBySrc(src, opts) {
  const srcEmps = srcEmployeeSet(src);
  const o = Object.assign({ src, srcEmps }, opts || {});
  const recs = filterRecs(o);
  const wts = filterWt(o);
  const empSet = new Set(recs.map(r => r.name));
  const dateSet = new Set(recs.map(r => r.date));
  let attDays = 0;
  for (const n of empSet) for (const d of dateSet) attDays += attOf(n, d);
  const insp = inspectionStats(o);
  const agg = aggregate(recs, wts, attDays, insp);

  const biz = (src === 'buyer') ? '买手合作' : '博主合作';
  const s30 = s30AggFor(biz, opts || {});
  agg.s30Num  = s30.s30Num;
  agg.s30Den  = s30.s30Den;
  agg.s30Miss = s30.s30Miss;
  agg.s30Rate = s30.s30Rate;

  return agg;
}
function calcBySrcAndL1(src, bizL1, opts) {
  const srcEmps = srcEmployeeSet(src);
  const o = Object.assign({ src, bizL1, srcEmps }, opts || {});
  const recs = filterRecs(o);
  const wts = filterWt(o);
  const empSet = new Set(recs.map(r => r.name));
  const dateSet = new Set(recs.map(r => r.date));
  let attDays = 0;
  for (const n of empSet) for (const d of dateSet) attDays += attOf(n, d);
  const insp = inspectionStats(o);
  const agg = aggregate(recs, wts, attDays, insp);

  const s30 = s30AggFor(bizL1, opts || {});
  agg.s30Num  = s30.s30Num;
  agg.s30Den  = s30.s30Den;
  agg.s30Miss = s30.s30Miss;
  agg.s30Rate = s30.s30Rate;

  return agg;
}
function calcByL1(bizL1, opts) { const o = Object.assign({ bizL1 }, opts || {}); return aggregate(filterRecs(o), filterWt(o), 0, inspectionStats(o)); }

function timeCols() {
  const latest = S.latestDate;
  const wks = [S.latestWK-2, S.latestWK-1, S.latestWK];
  const dateSet = new Set();
  for (const r of S.records) if (r.date) dateSet.add(r.date);
  for (const r of S.wtRecords) if (r.date) dateSet.add(r.date);
  for (const r of S.inspections) if (r.date) dateSet.add(r.date);
  let last7 = Array.from(dateSet).sort();
  if (last7.length > 7) last7 = last7.slice(-7);
  else if (last7.length < 7) {
    const fallback = [];
    for (let i = 1; i <= 7 && last7.length + fallback.length < 7; i++) { const d = dateAdd(latest, -i); if (d && !dateSet.has(d)) fallback.push(d); }
    last7 = Array.from(new Set([...last7, ...fallback])).sort().slice(-7);
  }
  return { monthLabel: S.month ? (parseInt(S.month.slice(5,7),10) + '月') : '月度', wks, last7, latest };
}
function buildHeaderHTML(cols) {
  const ths = ['<th>指标</th>', '<th>' + esc(cols.monthLabel) + '</th>'];
  for (const w of cols.wks) ths.push('<th>WK' + w + '</th>');
  ths.push('<th>WK' + cols.wks[1] + ' − WK' + cols.wks[0] + '</th>');
  ths.push('<th>WK' + cols.wks[2] + ' − WK' + cols.wks[1] + '</th>');
  for (const d of cols.last7) ths.push('<th>' + esc(d.slice(5)) + '</th>');
  return ths.join('');
}
function diffHTML(cur, prev, metric) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="na">—</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="delta-flat">0</span>';
  const up = d > 0;
  const good = metric.better === 'up' ? up : !up;
  const cls = good ? 'delta-up' : 'delta-down';
  const arrow = up ? '↑' : '↓';
  const s = metric.pct ? (Math.abs(d) * 100).toFixed(metric.digits) + '%' : Math.abs(d).toFixed(metric.digits);
  return '<span class="' + cls + '">' + arrow + ' ' + s + '</span>';
}
function diffInt(cur, prev) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="na">—</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="delta-flat">0</span>';
  const up = d > 0;
  const cls = up ? 'delta-up' : 'delta-down';
  const arrow = up ? '↑' : '↓';
  return '<span class="' + cls + '">' + arrow + ' ' + Math.abs(Math.round(d)) + '</span>';
}
function diffText(cur, prev, metric) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '—';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '0';
  const arrow = d > 0 ? '↑' : '↓';
  const s = metric.pct ? (Math.abs(d) * 100).toFixed(metric.digits) + '%' : Math.abs(d).toFixed(metric.digits);
  return arrow + s;
}
function rowHTMLSrcToggle(label, src, metric, opts, rowBg, toggleKey, expanded, labelHtml) {
  const cols = timeCols();
  const m = calcBySrc(src, Object.assign({}, opts || {}, { monthSet: new Set([S.month]) }));
  const wkA = cols.wks.map(w => calcBySrc(src, Object.assign({}, opts || {}, { wkSet: new Set([w]) })));
  const dayA = cols.last7.map(d => calcBySrc(src, Object.assign({}, opts || {}, { dateSet: new Set([d]) })));
  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const arrow = expanded ? '▼' : '▶';
  let firstTd;
  if (labelHtml != null) {
    firstTd = '<td' + tdStyle + '>' +
      '<div class="row-flex">' +
        '<span class="row-toggle" data-key="' + esc(toggleKey) + '">' + arrow + '</span>' +
        '<div class="row-label-stack">' + labelHtml + '</div>' +
      '</div>' +
    '</td>';
  } else {
    firstTd = '<td' + tdStyle + '><span class="row-toggle" data-key="' + esc(toggleKey) + '">' + arrow + '</span>' + esc(label) + '</td>';
  }
  const tds = [firstTd, '<td' + tdStyle + '>' + fmtVal(m[metric.key], metric) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtVal(w[metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtVal(d[metric.key], metric) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}
function rowHTMLByL1(label, src, bizL1, metric, opts, rowBg) {
  const cols = timeCols();
  const m = calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { monthSet: new Set([S.month]) }));
  const wkA = cols.wks.map(w => calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { wkSet: new Set([w]) })));
  const dayA = cols.last7.map(d => calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { dateSet: new Set([d]) })));
  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const tds = ['<td' + tdStyle + '>' + esc(label) + '</td>', '<td' + tdStyle + '>' + fmtVal(m[metric.key], metric) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtVal(w[metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtVal(d[metric.key], metric) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}
function inspRowToggleHTML(label, src, opts, valueKey, toggleKey, expanded, rowBg) {
  const cols = timeCols();
  const queryOpts = Object.assign({}, opts || {}, { src });
  function pick(o) { return inspectionStats(Object.assign({}, queryOpts, o))[valueKey] || 0; }
  const m = pick({ monthSet: new Set([S.month]) });
  const wkA = cols.wks.map(w => pick({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => pick({ dateSet: new Set([d]) }));
  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const arrow = expanded ? '▼' : '▶';
  const firstTd = '<td' + tdStyle + '><span class="row-toggle" data-key="' + esc(toggleKey) + '">' + arrow + '</span>' + esc(label) + '</td>';
  const tds = [firstTd, '<td' + tdStyle + '>' + fmtInt(m) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtInt(w) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[1], wkA[0]) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[2], wkA[1]) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtInt(d) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}
function inspRowByL1HTML(label, src, bizL1, opts, valueKey, rowBg) {
  const cols = timeCols();
  const queryOpts = Object.assign({}, opts || {}, { src, bizL1 });
  function pick(o) { return inspectionStats(Object.assign({}, queryOpts, o))[valueKey] || 0; }
  const m = pick({ monthSet: new Set([S.month]) });
  const wkA = cols.wks.map(w => pick({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => pick({ dateSet: new Set([d]) }));
  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const tds = ['<td' + tdStyle + '>' + esc(label) + '</td>', '<td' + tdStyle + '>' + fmtInt(m) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtInt(w) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[1], wkA[0]) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[2], wkA[1]) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtInt(d) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}
function renderExpandRows(src, opts, metricKey, parentKey) {
  const rows = [];
  if (metricKey === 'qualityPassRate') {
    const inspSub = [ { key: 'total', label: '　└ 抽检量', bg: '#F0E6F0' }, { key: 'pass', label: '　└ 合格量', bg: '#F0E6F0' }, { key: 'fail', label: '　└ 不合格量', bg: '#F0E6F0' } ];
    for (const ik of inspSub) {
      const subKey = parentKey + '|' + ik.key;
      const subExpanded = S.expandedRows.has(subKey);
      rows.push(inspRowToggleHTML(ik.label, src, opts, ik.key, subKey, subExpanded, ik.bg));
      if (subExpanded) { rows.push(inspRowByL1HTML('　　└ 买手合作', src, '买手合作', opts, ik.key, '#ECE6F5')); rows.push(inspRowByL1HTML('　　└ 博主合作', src, '博主合作', opts, ik.key, '#ECE6F5')); }
    }
  } else {
    const metric = METRIC_MAP[metricKey];
    rows.push(rowHTMLByL1('　└ 买手合作 CASE', src, '买手合作', metric, opts, '#E8EDF3'));
    rows.push(rowHTMLByL1('　└ 博主合作 CASE', src, '博主合作', metric, opts, '#F3EFE2'));
  }
  return rows;
}
function rateSpan(rate, biz) {
  if (rate == null || !isFinite(rate)) return '—';
  const th = s30Threshold(biz);
  const cls = rate >= th ? 'rate-ok' : 'rate-bad';
  return '<span class="' + cls + '">' + (rate * 100).toFixed(2) + '%</span>';
}
function rowHTMLS30(label, biz, metric) {
  const cols = timeCols();
  const calc = opts => calcByL1(biz, opts);
  const m = calc({ monthSet: new Set([S.month]) });
  const wkA = cols.wks.map(w => calc({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => calc({ dateSet: new Set([d]) }));
  const cell = v => (metric.key === 's30Rate') ? rateSpan(v, biz) : fmtVal(v, metric);
  const tds = ['<td>' + esc(label) + '</td>', '<td>' + cell(m[metric.key]) + '</td>'];
  for (const w of wkA) tds.push('<td>' + cell(w[metric.key]) + '</td>');
  tds.push('<td>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td>' + cell(d[metric.key]) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}
function switchView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}
function afterLoad() { renderImportSummary(); renderMapping(); renderRoster(); initSelects(); refreshAll(); }

function renderImportSummary() {
  const el = $('#importSummary');
  if (!el) return;
  if (!S.records.length && !S.roster.length) { el.innerHTML = ''; return; }
  const items = [
    ['花名册员工数', S.roster.length],
    ['买手员工数据行', S.records.filter(r => r.src === 'buyer').length],
    ['博主员工数据行', S.records.filter(r => r.src === 'blogger').length],
    ['买手员工质检行', S.inspections.filter(r => r.src === 'buyer').length],
    ['博主员工质检行', S.inspections.filter(r => r.src === 'blogger').length],
    ['工时数据行', S.wtRecords.length],
    ['班次数量', Object.keys(S.shiftMap).length],
    ['班表员工数', Object.keys(S.schedule).length],
    ['买手员工SLA组', S.slaBuyer.length],
    ['博主员工SLA组', S.slaBlogger.length],
    ['买手合作预测量', Object.keys(S.forecastBuyer).length],
    ['博主合作预测量', Object.keys(S.forecastBlogger).length],
    ['业务线映射', Object.keys(S.businessMap).length],
    ['二级打点映射', Object.keys(S.business2Map).length],
    ['数据主月份', S.month || '—'],
    ['最新日期', S.latestDate || '—'],
    ['最新 WK', 'WK' + (S.latestWK || '—')],
  ];
  el.innerHTML = items.map(([k,v]) => '<div class="sum-item"><div class="k">' + esc(k) + '</div><div class="v">' + esc(String(v)) + '</div></div>').join('');
}

function renderMapping() {
  const el = $('#mappingBody');
  if (!el) return;
  const mods = ['buyer','blogger','inspectionBuyer','inspectionBlogger','worktime','business','business2'];
  const parts = [];
  for (const mod of mods) {
    if (!S.headers[mod]) continue;
    const headers = S.headers[mod];
    const cur = S.mapping[mod] || {};
    const rows = Object.keys(MAP_DEF[mod]).map(field => {
      const v = cur[field] || '';
      const opts = ['<option value="">— 未映射 —</option>'].concat(headers.map(h => '<option value="' + esc(h) + '"' + (h === v ? ' selected' : '') + '>' + esc(h) + '</option>')).join('');
      return '<div class="map-row"><span class="label">' + esc(FIELD_LABEL[field] || field) + '</span><select data-mod="' + mod + '" data-field="' + field + '">' + opts + '</select></div>';
    }).join('');
    parts.push('<div class="map-block"><h3>' + esc(MAP_TITLE[mod]) + ' · ' + headers.length + ' 列</h3><div class="map-grid">' + rows + '</div></div>');
  }
  el.innerHTML = parts.join('') || '<p class="muted">尚未导入数据，请先导入表格。</p>';
  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      S.mapping[sel.dataset.mod][sel.dataset.field] = sel.value;
      parseRoster(); buildAll(); renderRoster(); refreshAll();
    });
  });
}

function renderRoster() {
  const el = $('#rosterTable');
  if (!el) return;
  const search = $('#rosterSearch');
  const kw = ((search && search.value) || '').trim().toLowerCase();
  const list = S.roster
    .map((e, i) => ({ e, i }))
    .filter(x => { if (!kw) return true; const e = x.e; return (e.name + e.group + e.batch + e.attr + e.biz).toLowerCase().includes(kw); })
    .sort((a, b) => {
      const ar = a.e.resignDate || ''; const br = b.e.resignDate || '';
      const aResigned = ar !== ''; const bResigned = br !== '';
      if (aResigned !== bResigned) return aResigned ? 1 : -1;
      if (aResigned && bResigned) { if (ar !== br) return ar < br ? 1 : -1; return a.i - b.i; }
      return a.i - b.i;
    })
    .map(x => x.e);
  const head = '<tr>' + ['姓名','组别','批次','上线日期','业务线','属性','分类','离职日期'].map(h => '<th>' + h + '</th>').join('') + '</tr>';
  const body = list.map(e => {
    const cat = categoryOf(e, S.month);
    const dim = S.hidden && e.resignDate;
    return '<tr' + (dim ? ' style="opacity:.4"' : '') + '>' +
      '<td>' + esc(e.name) + '</td><td>' + esc(e.group || '—') + '</td><td>' + esc(e.batch || '—') + '</td>' +
      '<td>' + esc(e.onlineDate || '—') + '</td><td>' + esc(e.biz || '—') + '</td><td>' + esc(e.attr || '—') + '</td>' +
      '<td>' + esc(cat || '—') + '</td>' +
      '<td><input class="resign-input" type="date" data-name="' + esc(e.name) + '" value="' + esc(e.resignDate || '') + '"></td>' +
    '</tr>';
  }).join('');
  el.innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  const cnt = $('#rosterCount'); if (cnt) cnt.textContent = '共 ' + list.length + ' 人';
  el.querySelectorAll('.resign-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const emp = S.roster.find(x => x.name === inp.dataset.name);
      if (!emp) return;
      emp.resignDate = inp.value || '';
      persistMemo(); renderRoster(); refreshAll();
    });
  });
}

function renderOverview() {
  const el = $('#ovBody');
  if (!el) return;
  const bizEl = $('#ovBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  if (!S.records.length) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }
  const l1Sum = { '买手合作':0, '博主合作':0 };
  for (const r of S.records) if (l1Sum[r.biz] != null) l1Sum[r.biz] += r.volume;
  const empSum = { '买手合作':0, '博主合作':0 };
  for (const r of S.records) { const eb = (r.src === 'buyer') ? '买手合作' : '博主合作'; if (empSum[eb] != null) empSum[eb] += r.volume; }
  const cross = { '买手合作': { '买手合作':0, '博主合作':0 }, '博主合作': { '买手合作':0, '博主合作':0 } };
  for (const r of S.records) { const srcKey = (r.src === 'buyer') ? '买手合作' : '博主合作'; if (cross[srcKey] && cross[srcKey][r.biz] != null) cross[srcKey][r.biz] += r.volume; }
  const overview = '<div class="summary-grid" style="margin-bottom:16px">' +
    '<div class="sum-item"><div class="k">① 一级打点 · 买手合作 CASE</div><div class="v">' + Math.round(l1Sum['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">① 一级打点 · 博主合作 CASE</div><div class="v">' + Math.round(l1Sum['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">② 买手员工数据 · 总 CASE</div><div class="v">' + Math.round(empSum['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">② 博主员工数据 · 总 CASE</div><div class="v">' + Math.round(empSum['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 买手员工数据中 · 买手合作 CASE</div><div class="v">' + Math.round(cross['买手合作']['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 买手员工数据中 · 博主合作 CASE</div><div class="v">' + Math.round(cross['买手合作']['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 博主员工数据中 · 买手合作 CASE</div><div class="v">' + Math.round(cross['博主合作']['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 博主员工数据中 · 博主合作 CASE</div><div class="v">' + Math.round(cross['博主合作']['博主合作']) + '</div></div>' +
    '</div>';
  const cols = timeCols();
  const rows = [];
  for (const m of METRICS) {
    const key = 'ov|' + m.key;
    const expanded = S.expandedRows.has(key);
    const bg = METRIC_BG[m.key] || '';
    rows.push(rowHTMLSrcToggle(metricLabel(m), src, m, null, bg, key, expanded));
    if (expanded) { const ex = renderExpandRows(src, null, m.key, key); for (const r of ex) rows.push(r); }
  }
  el.innerHTML = overview + '<div class="table-scroll"><table><thead><tr>' + buildHeaderHTML(cols) + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key); else S.expandedRows.add(key);
      renderOverview();
    });
  });
}

function refreshPersonOptions() {
  const em = ensureChipContainer('peMetric');
  if (!em) return;
  const personMetrics = METRICS.filter(m => m.key !== 's30Rate');
  const selected = new Set(getCheckedValues('#peMetric'));
  selected.delete('s30Rate');
  if (selected.size === 0 && personMetrics.length > 0) selected.add(personMetrics[0].key);

  em.innerHTML = personMetrics.map(m =>
    '<span class="chip' + (selected.has(m.key) ? ' on' : '') +
    '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>'
  ).join('');

  em.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      ch.classList.toggle('on');
      renderPerson();
    });
  });
}
function renderPerson() {
  const bizEl = $('#peBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  const body = $('#peBody'); const names = $('#peNames');
  if (!body || !names) return;
  if (!S.records.length) { body.innerHTML = '<p class="muted">尚未导入数据。</p>'; names.innerHTML = ''; return; }
  const srcEmps = srcEmployeeSet(src);
  let emps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name) && /一线/.test(e.attr || ''));
  if (!emps.length) emps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));
  names.innerHTML = emps.map(e => '<span class="chip' + (S.personSel.has(e.name) ? ' on' : '') + '" data-name="' + esc(e.name) + '">' + esc(e.name) + '</span>').join('');
  names.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const n = ch.dataset.name;
      if (S.personSel.has(n)) S.personSel.delete(n); else S.personSel.add(n);
      ch.classList.toggle('on'); renderPersonBody(src, emps);
    });
  });
  renderPersonBody(src, emps);
}
function renderPersonBody(src, emps) {
  const el = $('#peBody');
  if (!el) return;
  const names = Array.from(S.personSel).filter(n => emps.some(e => e.name === n));
  if (!names.length) { el.innerHTML = '<p class="muted">请选择员工。</p>'; return; }
  const metricKeys = getCheckedValues('#peMetric').filter(k => k !== 's30Rate');
  if (!metricKeys.length) { el.innerHTML = '<p class="muted">请至少选择一个指标。</p>'; return; }
  const rows = [];
  for (const n of names) {
    for (const mk of metricKeys) {
      const metric = METRIC_MAP[mk];
      const bg = METRIC_BG[mk] || '';
      const key = 'pe|' + n + '|' + mk;
      const expanded = S.expandedRows.has(key);
      const opts = { nameSet: new Set([n]) };
      const labelHtml =
        '<span class="row-name">' + esc(n) + '</span>' +
        '<span class="row-metric">' + esc(metricLabel(metric)) + '</span>';
      rows.push(rowHTMLSrcToggle(n + ' · ' + metricLabel(metric), src, metric, opts, bg, key, expanded, labelHtml));
      if (expanded) { const ex = renderExpandRows(src, opts, mk, key); for (const r of ex) rows.push(r); }
    }
  }
  const cols = timeCols();
  el.innerHTML = '<table><thead><tr><th>员工 / 指标</th>' + buildHeaderHTML(cols).replace('<th>指标</th>', '') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key); else S.expandedRows.add(key);
      renderPersonBody(src, emps);
    });
  });
}

function buildGroups(allEmps) {
  const { group: sg, batch: sb, category: sc } = S.teamSel;
  const hasSel = sg.size || sb.size || sc.size;
  if (!hasSel) return [];
  const match = e => {
    if (sg.size && !sg.has(e.group || '—')) return false;
    if (sb.size && !sb.has(e.batch || '—')) return false;
    if (sc.size && !sc.has(categoryOf(e, S.month) || '—')) return false;
    return true;
  };
  const groups = [];
  if (allEmps.length) {
    if (sg.size) for (const g of Array.from(sg).sort()) groups.push({ label: '组别 · ' + g, names: allEmps.filter(e => (e.group||'—') === g && match(e)).map(e => e.name) });
    if (sb.size) for (const b of Array.from(sb).sort()) groups.push({ label: '批次 · ' + b, names: allEmps.filter(e => (e.batch||'—') === b && match(e)).map(e => e.name) });
    if (sc.size) for (const c of Array.from(sc).sort((a,b) => catSortKey(a)-catSortKey(b))) groups.push({ label: '分类 · ' + c, names: allEmps.filter(e => (categoryOf(e, S.month)||'—') === c && match(e)).map(e => e.name) });
  }
  return groups;
}
function renderTeam() {
  const bizEl = $('#tmBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  const dimsEl = $('#tmDims'); const bodyEl = $('#tmBody');
  if (!dimsEl || !bodyEl) return;
  if (!S.records.length) { dimsEl.innerHTML = ''; bodyEl.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }
  const srcEmps = srcEmployeeSet(src);
  const allEmps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));
  const dims = ['group','batch','category'];
  const dimLabel = { group:'组别', batch:'批次', category:'分类' };
  const dimHTML = dims.map(dim => {
    let vals;
    if (dim === 'category') { const set = new Set(); for (const e of allEmps) set.add(categoryOf(e, S.month) || '—'); vals = Array.from(set).sort((a,b) => catSortKey(a) - catSortKey(b)); }
    else { const set = new Set(); for (const e of allEmps) set.add(e[dim] || '—'); vals = Array.from(set).sort(); }
    const chips = vals.map(v => { const on = S.teamSel[dim].has(v); return '<span class="chip' + (on ? ' on' : '') + '" data-dim="' + dim + '" data-val="' + esc(v) + '">' + esc(v) + '</span>'; }).join('');
    return '<div class="dim-row"><span class="dim-label">' + dimLabel[dim] + '</span><div class="chips" style="margin:0">' + chips + '</div></div>';
  }).join('');
  dimsEl.innerHTML = dimHTML;
  dimsEl.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const dim = ch.dataset.dim, val = ch.dataset.val;
      const set = S.teamSel[dim];
      if (set.has(val)) set.delete(val); else set.add(val);
      ch.classList.toggle('on'); renderTeamBody(src, allEmps);
    });
  });
  renderTeamBody(src, allEmps);
}
function renderTeamBody(src, allEmps) {
  const el = $('#tmBody');
  if (!el) return;
  const metricKeys = getCheckedValues('#tmMetric').filter(k => k !== 's30Rate');
  if (!metricKeys.length) { el.innerHTML = '<p class="muted">请至少选择一个指标。</p>'; return; }
  const groups = buildGroups(allEmps);
  const rows = [];
  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '';
    const overallKey = 'team|整体|' + mk;
    const overallExpanded = S.expandedRows.has(overallKey);
    const overallLabelHtml =
      '<span class="row-name">整体</span>' +
      '<span class="row-metric">' + esc(metricLabel(metric)) + '</span>';
    rows.push(rowHTMLSrcToggle('整体 · ' + metricLabel(metric), src, metric, null, bg, overallKey, overallExpanded, overallLabelHtml));
    if (overallExpanded) { const ex = renderExpandRows(src, null, mk, overallKey); for (const r of ex) rows.push(r); }
    for (const gr of groups) {
      if (!gr.names.length) continue;
      const key = 'team|' + gr.label + '|' + mk;
      const expanded = S.expandedRows.has(key);
      const opts = { nameSet: new Set(gr.names) };
      const grLabelHtml =
        '<span class="row-name">' + esc(gr.label) + '</span>' +
        '<span class="row-metric">' + esc(metricLabel(metric)) + '</span>';
      rows.push(rowHTMLSrcToggle(gr.label + ' · ' + metricLabel(metric), src, metric, opts, bg, key, expanded, grLabelHtml));
      if (expanded) { const ex = renderExpandRows(src, opts, mk, key); for (const r of ex) rows.push(r); }
    }
  }
  const cols = timeCols();
  el.innerHTML = '<table><thead><tr><th>维度 / 指标</th>' + buildHeaderHTML(cols).replace('<th>指标</th>', '') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key); else S.expandedRows.add(key);
      renderTeamBody(src, allEmps);
    });
  });
}
function refreshTeamOptions() {
  const em = ensureChipContainer('tmMetric');
  if (!em) return;
  const teamMetrics = METRICS.filter(m => m.key !== 's30Rate');
  const selected = new Set(getCheckedValues('#tmMetric'));
  selected.delete('s30Rate');
  if (selected.size === 0 && teamMetrics.length > 0) selected.add(teamMetrics[0].key);

  em.innerHTML = teamMetrics.map(m =>
    '<span class="chip' + (selected.has(m.key) ? ' on' : '') +
    '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>'
  ).join('');

  em.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      ch.classList.toggle('on');
      renderTeam();
    });
  });
}

function renderS30() {
  const bizEl = $('#s30Biz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const top = $('#s30Top'); const dates = $('#s30Dates'); const body = $('#s30Body');
  if (!top) return;
  if (!S.records.length) { top.innerHTML = '<p class="muted">尚未导入数据。</p>'; if (dates) dates.innerHTML = ''; if (body) body.innerHTML = ''; return; }
  const cols = timeCols();
  const subMetrics = [
    { key:'s30Rate', label:'30s接起率', digits:2, pct:true, better:'up' },
    { key:'s30Num', label:'30S接起率-分子', digits:0, pct:false, better:'up' },
    { key:'s30Den', label:'30S接起率-分母', digits:0, pct:false, better:'up' },
    { key:'s30Miss', label:'30sMiss量', digits:0, pct:false, better:'down' },
  ];
  top.innerHTML = '<div class="table-scroll"><table><thead><tr>' + buildHeaderHTML(cols) + '</tr></thead><tbody>' + subMetrics.map(m => rowHTMLS30(m.label, biz, m)).join('') + '</tbody></table></div>';
  const dateSet = new Set();
  for (const r of S.records) if (r.biz === biz) dateSet.add(r.date);
  const allDates = Array.from(dateSet).sort();
  if (!allDates.length) { if (dates) dates.innerHTML = ''; if (body) body.innerHTML = ''; return; }
  if (dates) {
    dates.innerHTML = allDates.map(d => { const on = S.s30Dates.has(d); return '<span class="chip' + (on ? ' on' : '') + '" data-d="' + d + '">' + esc(d.slice(5)) + '</span>'; }).join('');
    dates.querySelectorAll('.chip').forEach(ch => {
      ch.addEventListener('click', () => {
        const d = ch.dataset.d;
        if (S.s30Dates.has(d)) S.s30Dates.delete(d); else S.s30Dates.add(d);
        ch.classList.toggle('on'); renderS30Body(biz);
      });
    });
  }
  renderS30Body(biz);
}

/* 颜色加深工具：用于「当日汇总」行背景 */
function darkenColor(hex, factor) {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#') return hex;
  let r, g, b;
  if (hex.length === 4) {
    r = parseInt(hex[1]+hex[1], 16);
    g = parseInt(hex[2]+hex[2], 16);
    b = parseInt(hex[3]+hex[3], 16);
  } else {
    r = parseInt(hex.slice(1,3), 16);
    g = parseInt(hex.slice(3,5), 16);
    b = parseInt(hex.slice(5,7), 16);
  }
  const f = factor || 0.88;
  const to2 = c => Math.max(0, Math.round(c * f)).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

/* 30S 明细：按日期分组；每组上方插入「当日汇总」行（可显隐） */
function renderS30Body(biz) {
  const el = $('#s30Body');
  if (!el) return;

  const btnSum = $('#btnS30Sum');
  if (btnSum) {
    btnSum.textContent = S.s30ShowSummary ? '隐藏日汇总' : '显示日汇总';
    btnSum.onclick = () => {
      S.s30ShowSummary = !S.s30ShowSummary;
      btnSum.textContent = S.s30ShowSummary ? '隐藏日汇总' : '显示日汇总';
      renderS30Body(biz);
    };
  }

  const dates = Array.from(S.s30Dates).sort();
  if (!dates.length) { el.innerHTML = '<p class="muted">请选择日期。</p>'; return; }

  const bgMap = {};
  dates.forEach((d, i) => bgMap[d] = DATE_BG[i % DATE_BG.length]);
  const forecastMap = (biz === '买手合作') ? S.forecastBuyer : S.forecastBlogger;
  const hasFc = !!(forecastMap && Object.keys(forecastMap).length);

  const map = {};
  for (const r of S.records) {
    if (r.biz !== biz) continue;
    if (!S.s30Dates.has(r.date)) continue;
    const key = r.date + '|' + (r.period || '—');
    if (!map[key]) map[key] = { date: r.date, period: r.period || '—', num: 0, den: 0 };
    map[key].num += r.s30Num;
    map[key].den += r.s30Den;
  }
  const list = Object.values(map).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return String(a.period).localeCompare(String(b.period));
  });

  const groups = [];
  const gIdx = new Map();
  for (const x of list) {
    let g = gIdx.get(x.date);
    if (!g) {
      g = { date: x.date, rows: [], num: 0, den: 0, forecast: 0, hasFc: false };
      gIdx.set(x.date, g);
      groups.push(g);
    }
    g.rows.push(x);
    g.num += x.num;
    g.den += x.den;
    if (hasFc) {
      const fc = forecastMap[x.date + '|' + normPeriod(x.period)];
      if (fc != null && isFinite(fc) && fc > 0) { g.forecast += fc; g.hasFc = true; }
    }
  }

  const head = '<tr><th>日期 | 时段</th><th>30s接起率</th><th>30S接起率-分子</th><th>30S接起率-分母</th><th>30sMiss量</th>' +
    (hasFc ? '<th>时段预测量</th><th>预测偏差</th>' : '') + '</tr>';

  const renderFc = (forecast, den) => {
    let fcDisp = '—', biasDisp = '—', biasCls = '';
    if (forecast != null && isFinite(forecast) && forecast > 0) {
      fcDisp = String(Math.round(forecast * 100) / 100);
      const bias = (den / forecast) * 100;
      if (isFinite(bias)) {
        biasDisp = bias.toFixed(2) + '%';
        if (bias > 120) biasCls = 'bias-over';
      }
    }
    return {
      fc: fcDisp,
      bias: biasCls ? '<span class="' + biasCls + '">' + biasDisp + '</span>' : biasDisp
    };
  };

  const showSum = S.s30ShowSummary !== false;
  const bodyParts = [];
  for (const g of groups) {
    const bg = bgMap[g.date] || '#fff';
    const darkBg = darkenColor(bg, 0.86);

    if (showSum) {
      const sumStyle = ' style="background:' + darkBg +
        ';font-weight:700;font-size:14px;' +
        'border-top:2px solid #B0ADA4;border-bottom:1px solid #C9C6BE"';
      const sumRate = g.den > 0 ? g.num / g.den : null;
      const sumMiss = g.den - g.num;
      let sumExtra = '';
      if (hasFc) {
        const f = renderFc(g.hasFc ? g.forecast : null, g.den);
        sumExtra = '<td' + sumStyle + '>' + f.fc + '</td><td' + sumStyle + '>' + f.bias + '</td>';
      }
      bodyParts.push(
        '<tr>' +
          '<td' + sumStyle + '>📅 ' + esc(g.date) + ' 当日汇总</td>' +
          '<td' + sumStyle + '>' + rateSpan(sumRate, biz) + '</td>' +
          '<td' + sumStyle + '>' + Math.round(g.num) + '</td>' +
          '<td' + sumStyle + '>' + Math.round(g.den) + '</td>' +
          '<td' + sumStyle + '>' + Math.round(sumMiss) + '</td>' +
          sumExtra +
        '</tr>'
      );
    }

    for (const x of g.rows) {
      const r = x.den > 0 ? x.num / x.den : null;
      const m = x.den - x.num;
      const style = ' style="background:' + bg + '"';
      let extra = '';
      if (hasFc) {
        const fc = forecastMap[x.date + '|' + normPeriod(x.period)];
        const f = renderFc(fc, x.den);
        extra = '<td' + style + '>' + f.fc + '</td><td' + style + '>' + f.bias + '</td>';
      }
      bodyParts.push(
        '<tr>' +
          '<td' + style + '>' + esc(x.date) + ' | ' + esc(x.period) + '</td>' +
          '<td' + style + '>' + rateSpan(r, biz) + '</td>' +
          '<td' + style + '>' + Math.round(x.num) + '</td>' +
          '<td' + style + '>' + Math.round(x.den) + '</td>' +
          '<td' + style + '>' + Math.round(m) + '</td>' +
          extra +
        '</tr>'
      );
    }
  }

  el.innerHTML = '<table><thead>' + head + '</thead><tbody>' + bodyParts.join('') + '</tbody></table>';
}

function renderAHT2() {
  const el = $('#a2Body');
  if (!el) return;
  el.classList.remove('table-scroll');
  el.style.overflow = 'visible';
  el.style.maxHeight = 'none';
  el.style.border = 'none';
  el.style.borderRadius = '0';
  el.style.background = 'transparent';
  el.style.position = 'static';

  const bizEl = $('#a2Biz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  if (!S.records.length) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }
  const wkNow = S.latestWK;
  const wkPrev = wkNow - 1;
  function bizAHT(wk) {
    const recs = S.records.filter(r => r.biz2 === biz && r.wk === wk);
    let aht = 0, volume = 0;
    for (const r of recs) { aht += r.aht || 0; volume += r.volume || 0; }
    return { aht, volume, ahtRate: volume > 0 ? aht / volume : null };
  }
  const combos = new Map();
  for (const r of S.records) {
    if (r.biz2 !== biz) continue;
    if (r.wk !== wkNow && r.wk !== wkPrev) continue;
    const l1 = r.l1 || ''; const l2 = r.l2 || '';
    if (!l1 && !l2) continue;
    const key = l1 + '|' + l2;
    if (!combos.has(key)) combos.set(key, { l1, l2, ahtNow:0, volumeNow:0, ahtPrev:0, volumePrev:0 });
    const o = combos.get(key);
    if (r.wk === wkNow) { o.ahtNow += r.aht || 0; o.volumeNow += r.volume || 0; }
    if (r.wk === wkPrev) { o.ahtPrev += r.aht || 0; o.volumePrev += r.volume || 0; }
  }
  const fixedOrder = biz === '买手合作' ? BUYER_AHT2_ORDER : biz === '博主合作' ? BLOGGER_AHT2_ORDER : null;
  if (fixedOrder) {
    const have = new Set(Array.from(combos.values()).map(o => aht2Key(o.l1, o.l2)));
    for (const [l1, l2] of fixedOrder) { const k = aht2Key(l1, l2); if (have.has(k)) continue; have.add(k); combos.set(l1 + '|' + l2, { l1, l2, ahtNow:0, volumeNow:0, ahtPrev:0, volumePrev:0 }); }
  }
  const bizNow = bizAHT(wkNow);
  const bizPrev = bizAHT(wkPrev);
  const summary = '<div class="summary-grid" style="margin-bottom:14px">' +
    '<div class="sum-item"><div class="k">业务线 · WK' + wkPrev + ' AHT</div><div class="v">' + (bizPrev.ahtRate == null ? '—' : bizPrev.ahtRate.toFixed(2)) + '</div></div>' +
    '<div class="sum-item"><div class="k">业务线 · WK' + wkNow + ' AHT</div><div class="v">' + (bizNow.ahtRate == null ? '—' : bizNow.ahtRate.toFixed(2)) + '</div></div>' +
    '<div class="sum-item"><div class="k">业务线 · WK' + wkPrev + ' 服务量</div><div class="v">' + Math.round(bizPrev.volume) + '</div></div>' +
    '<div class="sum-item"><div class="k">业务线 · WK' + wkNow + ' 服务量</div><div class="v">' + Math.round(bizNow.volume) + '</div></div>' +
    '</div>';
  const header = '<tr><th>二级打点</th><th>WK' + wkPrev + ' 处理时长</th><th>WK' + wkNow + ' 处理时长</th><th>WK' + wkPrev + ' 服务量</th><th>WK' + wkNow + ' 服务量</th><th>WK' + wkPrev + ' AHT</th><th>WK' + wkNow + ' AHT</th><th>AHT 环比</th><th>服务量 环比</th><th>影响值</th></tr>';
  const list = Array.from(combos.values());
  if (fixedOrder) {
    const orderIdx = new Map(fixedOrder.map(([l1, l2], i) => [aht2Key(l1, l2), i]));
    list.sort((a, b) => {
      const ai = orderIdx.get(aht2Key(a.l1, a.l2));
      const bi = orderIdx.get(aht2Key(b.l1, b.l2));
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1; if (bi != null) return 1;
      return (b.ahtNow + b.ahtPrev) - (a.ahtNow + a.ahtPrev);
    });
  } else list.sort((a, b) => (b.ahtNow + b.ahtPrev) - (a.ahtNow + a.ahtPrev));
  const rows = list.map(o => {
    const ahtNow = o.volumeNow > 0 ? o.ahtNow / o.volumeNow : null;
    const ahtPrev = o.volumePrev > 0 ? o.ahtPrev / o.volumePrev : null;
    let dAHTHtml = '—';
    if (ahtNow != null && ahtPrev != null) {
      const d = ahtNow - ahtPrev;
      const cls = d > 0 ? 'delta-down' : (d < 0 ? 'delta-up' : 'delta-flat');
      const arrow = d > 0 ? '↑' : (d < 0 ? '↓' : '');
      dAHTHtml = '<span class="' + cls + '">' + arrow + ' ' + Math.abs(d).toFixed(2) + '</span>';
    }
    const dVol = o.volumeNow - o.volumePrev;
    let dVolHtml;
    if (Math.abs(dVol) < 1e-9) dVolHtml = '<span class="delta-flat">0</span>';
    else { const clsV = dVol > 0 ? 'delta-up' : 'delta-down'; const arrowV = dVol > 0 ? '↑' : '↓'; dVolHtml = '<span class="' + clsV + '">' + arrowV + ' ' + Math.abs(Math.round(dVol)) + '</span>'; }
    let impactHtml = '—';
    if (ahtNow != null && bizNow.ahtRate != null) {
      const newAhtTotal = bizNow.aht - o.ahtNow;
      const newVolTotal = bizNow.volume - o.volumeNow;
      if (newVolTotal > 0) {
        const newRate = newAhtTotal / newVolTotal;
        const impact = newRate - bizNow.ahtRate;
        const cls = impact > 0 ? 'delta-up' : (impact < 0 ? 'delta-down' : 'delta-flat');
        const arrow = impact > 0 ? '↑' : (impact < 0 ? '↓' : '');
        impactHtml = '<span class="' + cls + '">' + arrow + ' ' + Math.abs(impact).toFixed(2) + '</span>';
      }
    }
    const l2Cell =
      '<td>' +
        '<div class="aht2-l2">' + esc(o.l2 || '—') + '</div>' +
        (o.l1 ? '<div class="aht2-l1">' + esc(o.l1) + '</div>' : '') +
      '</td>';
    return '<tr>' + l2Cell +
      '<td>' + (o.ahtPrev === 0 ? '—' : o.ahtPrev.toFixed(2)) + '</td>' +
      '<td>' + (o.ahtNow === 0 ? '—' : o.ahtNow.toFixed(2)) + '</td>' +
      '<td>' + fmtInt(o.volumePrev) + '</td>' +
      '<td>' + fmtInt(o.volumeNow) + '</td>' +
      '<td>' + (ahtPrev == null ? '—' : ahtPrev.toFixed(2)) + '</td>' +
      '<td>' + (ahtNow == null ? '—' : ahtNow.toFixed(2)) + '</td>' +
      '<td>' + dAHTHtml + '</td>' +
      '<td>' + dVolHtml + '</td>' +
      '<td>' + impactHtml + '</td>' +
    '</tr>';
  }).join('');
  el.innerHTML = summary + '<div class="table-scroll"><table><thead>' + header + '</thead><tbody>' + rows + '</tbody></table></div>';
}

/* ===== 达成 SLA ===== */
const SLA_METRIC_ALIAS = {
  'casevolume': 'caseVolume', 'case处理量': 'caseVolume', 'case量': 'caseVolume', '人工服务量': 'caseVolume', 'case处理': 'caseVolume',
  'cpd': 'cpd',
  'aht': 'aht', '处理时长': 'aht', 'case处理时长': 'aht',
  'concurrency': 'concurrency', '并发': 'concurrency',
  'utilization': 'utilization', '工时利用率': 'utilization', '利用率': 'utilization',
  'solverate': 'solveRate', '解决率': 'solveRate',
  'satisfaction': 'satisfaction', '满意度': 'satisfaction',
  'escalaterate': 'escalateRate', '升级率': 'escalateRate',
  'fcr': 'fcr',
  'qualitypassrate': 'qualityPassRate', '质检合格率': 'qualityPassRate', '质检': 'qualityPassRate',
  's30rate': 's30Rate', '30s接起率': 's30Rate', '30s': 's30Rate', '30秒接起率': 's30Rate',
};
function matchMetricKey(s) {
  const n = String(s||'').replace(/\s+/g,'').replace(/[（(][^)）]*[)）]/g,'').toLowerCase();
  if (SLA_METRIC_ALIAS[n]) return SLA_METRIC_ALIAS[n];
  const keys = Object.keys(SLA_METRIC_ALIAS).sort((a,b)=>b.length-a.length);
  for (const k of keys) if (n.includes(k)) return SLA_METRIC_ALIAS[k];
  return null;
}

/* ✅ 修改：SLA 员工维度计算（30S 接起率也按员工分类计算） */
function slaAchieve(src, metricKey, category) {
  const monthSet = new Set([S.month]);
  const srcEmps = srcEmployeeSet(src);

  /* 判断「整体」类分类（不按员工细分） */
  const c = String(category == null ? '' : category).trim();
  const isOverall = !c || c === '整体' || c === '全部' || c === '合计' || c === '总计' || c === '平均' || c === '总体';

  /* 非整体分类：先按员工维度圈定人员 */
  let nameSet = null;
  if (!isOverall) {
    const names = S.roster
      .filter(e => srcEmps.has(e.name) && (categoryOf(e, S.month) || '').includes(c))
      .map(e => e.name);
    if (!names.length) return null;
    nameSet = new Set(names);
  }

  /* 统一走 calcBySrc：所有指标（含 30S 接起率）都按员工维度计算
     calcBySrc 内部通过 s30AggFor 按 nameSet 过滤 30S 分子/分母 */
  const opts = { monthSet };
  if (nameSet) opts.nameSet = nameSet;
  return calcBySrc(src, opts)[metricKey];
}

function calcSlaScore(metricKey, actual, monthCfg) {
  if (!monthCfg) return { threshold: null, points: null, achieveRate: null, finalScore: null, hitTierIndex: -1, actualDisp: null, weight: null, isPct: false, belowLowest: false };
  const m = metricKey ? METRIC_MAP[metricKey] : null;
  const isPct = m ? !!m.pct : false;
  const better = m ? m.better : 'up';

  const actualDisp = actual == null || !isFinite(actual) ? null : actual;
  if (actualDisp == null || !monthCfg.tiers.length) {
    return { threshold: null, points: null, achieveRate: null, finalScore: null, hitTierIndex: -1, actualDisp, weight: monthCfg.weight, isPct, belowLowest: false };
  }

  const target = monthCfg.tiers[0].threshold;
  let achieveRate = null;
  if (target != null && target !== 0) {
    if (better === 'down') achieveRate = actualDisp > 0 ? target / actualDisp : null;
    else                   achieveRate = actualDisp / target;
  }

  let hitIdx = -1, points = null;
  if (better === 'down') {
    if (achieveRate != null) {
      for (let i = 0; i < monthCfg.tiers.length; i++) {
        if (achieveRate >= monthCfg.tiers[i].threshold) { hitIdx = i; points = monthCfg.tiers[i].points; break; }
      }
    }
  } else {
    for (let i = 0; i < monthCfg.tiers.length; i++) {
      if (actualDisp >= monthCfg.tiers[i].threshold) { hitIdx = i; points = monthCfg.tiers[i].points; break; }
    }
  }

  let belowLowest = false;
  if (hitIdx === -1) {
    const lowest = monthCfg.tiers[monthCfg.tiers.length - 1];
    if (lowest && lowest.points != null && isFinite(lowest.points)) {
      points = lowest.points;
      belowLowest = true;
    }
  }

  const finalScore = (points != null && monthCfg.weight != null) ? points * monthCfg.weight : null;
  return { threshold: target, points, achieveRate, finalScore, hitTierIndex: hitIdx, actualDisp, weight: monthCfg.weight, isPct, belowLowest };
}

function renderSLA() {
  const el = $('#slaBody');
  if (!el) return;
  const bizEl = $('#slaBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  const rawList = (src === 'buyer') ? S.slaBuyer : S.slaBlogger;
  if (!rawList || !rawList.length) {
    el.innerHTML = '<p class="muted">尚未导入「' + (src === 'buyer' ? '买手' : '博主') + '员工SLA」数据，或该 sheet 为空。</p>';
    return;
  }

  const curMonth = S.month ? parseInt(S.month.slice(5,7), 10) : null;
  const monthLabel = curMonth != null ? curMonth + '月' : '—';

  const list = rawList.filter(it => curMonth != null && it.months[curMonth]);

  const headInfo = '<p class="muted" style="margin-bottom:8px">当前数据月份：<b>' + monthLabel +
    '</b>，自动读取对应月份的权重 / 目标 / 得分。未达最低档位时按最低档位保底计算。</p>';

  if (!list.length) {
    el.innerHTML = headInfo + '<p class="muted">当前月份没有匹配的 SLA 数据。</p>';
    return;
  }

  const computed = list.map(item => {
    const key = matchMetricKey(item.metric);
    const cfg = item.months[curMonth];
    const actual = key ? slaAchieve(src, key, item.category) : null;
    const score = calcSlaScore(key, actual, cfg);
    return { item, key, cfg, actual, score };
  });

  let totalScore = 0, totalWeight = 0, scored = 0, maxPossible = 0;
  for (const c of computed) {
    if (c.score.finalScore != null) { totalScore += c.score.finalScore; scored++; }
    if (c.score.weight != null) totalWeight += c.score.weight;
    if (c.cfg.tiers.length && c.cfg.weight != null) {
      const maxPts = Math.max.apply(null, c.cfg.tiers.map(t => t.points));
      maxPossible += maxPts * c.cfg.weight;
    }
  }

  const hasScore = scored > 0;
  const scoreCard = hasScore
    ? '<div class="rp-kpis" style="margin-bottom:14px">' +
        '<div class="rp-kpi" style="border-left-color:#7B8FBF"><div class="k">SLA 总分</div><div class="v">' + totalScore.toFixed(2) + '</div>' +
          '<div class="d">满分 ' + maxPossible.toFixed(2) + '</div></div>' +
        '<div class="rp-kpi" style="border-left-color:#7CAE8B"><div class="k">达成率</div><div class="v">' +
          (maxPossible > 0 ? (totalScore / maxPossible * 100).toFixed(1) + '%' : '—') + '</div>' +
          '<div class="d">得分 / 满分</div></div>' +
        '<div class="rp-kpi"><div class="k">权重合计</div><div class="v">' + (totalWeight * 100).toFixed(2) + '%</div>' +
          '<div class="d">' + scored + ' / ' + computed.length + ' 项已计分</div></div>' +
      '</div>'
    : '';

  const rows = computed.map(c => {
    const it = c.item;
    const sc = c.score;
    const isPct = sc.isPct;

    const wDisp = c.cfg.weight != null ? (c.cfg.weight * 100).toFixed(2) + '%' : '—';

    let tDisp = '—';
    if (sc.threshold != null) {
      tDisp = isPct ? (sc.threshold * 100).toFixed(2) + '%' : sc.threshold.toFixed(2);
    }

    let aDisp = '—';
    if (sc.actualDisp != null) {
      aDisp = isPct ? (sc.actualDisp * 100).toFixed(2) + '%' : sc.actualDisp.toFixed(2);
    }

    let rateDisp = '—';
    if (sc.achieveRate != null) rateDisp = (sc.achieveRate * 100).toFixed(2) + '%';

    const pointsDisp = sc.points != null ? sc.points.toFixed(2) : '—';
    const scoreDisp = sc.finalScore != null ? sc.finalScore.toFixed(2) : '—';

    let statusBadge = '<span class="delta-flat">—</span>';
    if (sc.points != null) {
      if (sc.belowLowest) {
        statusBadge = '<span class="rp-badge warn">未达最低档（按最低档计）</span>';
      } else {
        const tiers = c.cfg.tiers;
        const maxPts = Math.max.apply(null, tiers.map(t => t.points));
        const isTop = tiers.length && sc.points === maxPts;
        statusBadge = isTop
          ? '<span class="rp-badge ok">满档</span>'
          : '<span class="rp-badge flat">档位</span>';
      }
    }

    const metricDisp = esc(it.metric) + (c.key ? '' : '<span class="sla-unknown">（未识别）</span>');

    return '<tr>' +
      '<td>' + metricDisp + '</td>' +
      '<td>' + esc(it.category) + '</td>' +
      '<td>' + wDisp + '</td>' +
      '<td>' + tDisp + '</td>' +
      '<td>' + aDisp + '</td>' +
      '<td>' + rateDisp + '</td>' +
      '<td>' + pointsDisp + '</td>' +
      '<td>' + scoreDisp + '</td>' +
      '<td>' + statusBadge + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML = headInfo + scoreCard +
    '<div class="table-scroll"><table class="rp-table"><thead><tr>' +
      '<th>指标</th><th>分类</th><th>权重</th>' +
      '<th>目标</th><th>实际</th><th>达成率</th>' +
      '<th>档位分</th><th>最终得分</th><th>状态</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderAttendance() {
  const el = $('#attBody');
  if (!el) return;
  const nameEl = $('#attName');
  const name = nameEl && nameEl.value;
  if (!name) { el.innerHTML = '<p class="muted">请选择员工。</p>'; return; }
  if (!S.month) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }
  const emp = getEmp(name);
  if (!emp) { el.innerHTML = '<p class="muted">未在花名册中找到此员工。</p>'; return; }
  const [y, m] = S.month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(S.month + '-' + pad2(i));
  let monthTotal = 0;
  for (const d of days) monthTotal += attOf(name, d);
  const lastWK = S.latestWK;
  const wkList = [lastWK-2, lastWK-1, lastWK];
  const wkDates = {}; for (const w of wkList) wkDates[w] = [];
  for (const d of days) { const w = wkOf(d); if (wkDates[w]) wkDates[w].push(d); }
  const wkTotals = wkList.map(w => ({ w, total: wkDates[w].reduce((s, d) => s + attOf(name, d), 0) }));
  const cols = timeCols();
  const last7 = cols.last7.map(d => ({ d, v: attOf(name, d) }));
  const dayCards = days.map(d => {
    const v = attOf(name, d);
    const shift = (S.schedule[name] || {})[d] || '';
    const ov = S.attOverride[name] && S.attOverride[name][d] !== undefined;
    return '<div class="att-day"><div class="d">' + d.slice(5) + '</div><input type="number" inputmode="decimal" step="0.01" min="0" max="1" value="' + v.toFixed(2) + '" data-d="' + d + '"><div class="shift">' + esc(shift) + (ov ? ' ✎' : '') + '</div></div>';
  }).join('');
  el.innerHTML = '<div class="att-stat">' +
    '<div class="item"><div class="k">月度出勤天数</div><div class="v">' + monthTotal.toFixed(2) + '</div></div>' +
    wkTotals.map(x => '<div class="item"><div class="k">WK' + x.w + ' 出勤天数</div><div class="v">' + x.total.toFixed(2) + '</div></div>').join('') +
    '</div><h3 class="sub-title">近 7 天每日出勤</h3><div class="att-stat">' +
    last7.map(x => '<div class="item"><div class="k">' + x.d.slice(5) + '</div><div class="v">' + x.v.toFixed(2) + '</div></div>').join('') +
    '</div><h3 class="sub-title">当月每日出勤（可手动调整 0~1）</h3><div class="att-day-grid">' + dayCards + '</div>';
  el.querySelectorAll('.att-day input').forEach(inp => {
    inp.addEventListener('change', () => {
      const d = inp.dataset.d;
      let v = parseFloat(inp.value);
      if (isNaN(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      v = Math.round(v * 100) / 100;
      inp.value = v.toFixed(2);
      if (!S.attOverride[name]) S.attOverride[name] = {};
      S.attOverride[name][d] = v;
      persistMemo(); renderAttendance(); refreshAll();
    });
  });
}

function refreshExportOptions() {
  const em = ensureChipContainer('exMetric');
  if (em) {
    const selectedMetrics = new Set(getCheckedValues('#exMetric'));
    if (selectedMetrics.size === 0 && METRICS.length > 0) selectedMetrics.add(METRICS[0].key);
    em.innerHTML = METRICS.map(m => '<span class="chip' + (selectedMetrics.has(m.key) ? ' on' : '') + '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>').join('');
  }
  const fillChips = (id, values, sortFn) => {
    const sel = ensureChipContainer(id);
    if (!sel) return;
    const current = new Set(getCheckedValues('#' + id));
    const uniq = Array.from(new Set(values)).filter(Boolean);
    if (sortFn) uniq.sort(sortFn); else uniq.sort();
    sel.innerHTML = uniq.map(v => '<span class="chip' + (current.has(v) ? ' on' : '') + '" data-val="' + esc(v) + '">' + esc(v) + '</span>').join('');
  };
  const bizEl = $('#exBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  const srcEmps = srcEmployeeSet(src);
  const empsForChips = S.roster.filter(e => srcEmps.has(e.name));
  fillChips('exGroup', empsForChips.map(e => e.group || '—'));
  fillChips('exBatch', empsForChips.map(e => e.batch || '—'));
  fillChips('exCategory', empsForChips.map(e => categoryOf(e, S.month) || '—'), (a, b) => catSortKey(a) - catSortKey(b));
  for (const id of ['exMetric','exGroup','exBatch','exCategory']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.querySelectorAll('.chip').forEach(ch => { ch.addEventListener('click', () => ch.classList.toggle('on')); });
  }
}
let _lastBlobUrl = null;
function buildExportCanvas() {
  const bizEl = $('#exBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const src = bizToSrc(biz);
  const metricKeys = getCheckedValues('#exMetric');
  const groups = getCheckedValues('#exGroup');
  const batches = getCheckedValues('#exBatch');
  const cats = getCheckedValues('#exCategory');
  if (!metricKeys.length) { alert('请至少选择一个指标'); return null; }
  const srcEmps = srcEmployeeSet(src);
  const allEmps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));
  const groupRows = [];
  if (groups.length || batches.length || cats.length) {
    for (const g of groups) { const names = allEmps.filter(e => (e.group || '—') === g).map(e => e.name); if (names.length) groupRows.push({ label: '组别 · ' + g, names }); }
    for (const b of batches) { const names = allEmps.filter(e => (e.batch || '—') === b).map(e => e.name); if (names.length) groupRows.push({ label: '批次 · ' + b, names }); }
    for (const c of cats) { const names = allEmps.filter(e => (categoryOf(e, S.month) || '—') === c).map(e => e.name); if (names.length) groupRows.push({ label: '分类 · ' + c, names }); }
  } else { for (const e of allEmps) groupRows.push({ label: e.name, names: [e.name] }); }
  const cols = timeCols();
  const header = ['指标', cols.monthLabel];
  for (const w of cols.wks) header.push('WK' + w);
  header.push('WK' + cols.wks[1] + '−WK' + cols.wks[0]);
  header.push('WK' + cols.wks[2] + '−WK' + cols.wks[1]);
  for (const d of cols.last7) header.push(d.slice(5));
  const rows = [{ cells: header, bg: '#E8EDF3' }];
  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '#ffffff';
    const m = calcBySrc(src, { monthSet: new Set([S.month]) });
    const wkA = cols.wks.map(w => calcBySrc(src, { wkSet: new Set([w]) }));
    const dayA = cols.last7.map(d => calcBySrc(src, { dateSet: new Set([d]) }));
    const row = ['整体 · ' + metricLabel(metric), fmtVal(m[mk], metric)];
    for (const w of wkA) row.push(fmtVal(w[mk], metric));
    row.push(diffText(wkA[1][mk], wkA[0][mk], metric));
    row.push(diffText(wkA[2][mk], wkA[1][mk], metric));
    for (const d of dayA) row.push(fmtVal(d[mk], metric));
    rows.push({ cells: row, bg });
  }
  rows.push({ cells: new Array(header.length).fill(''), bg: '#ffffff' });
  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '#ffffff';
    for (const gr of groupRows) {
      const nameSet = new Set(gr.names);
      const m = calcBySrc(src, { nameSet, monthSet: new Set([S.month]) });
      const wkA = cols.wks.map(w => calcBySrc(src, { nameSet, wkSet: new Set([w]) }));
      const dayA = cols.last7.map(d => calcBySrc(src, { nameSet, dateSet: new Set([d]) }));
      const row = [gr.label + ' · ' + metricLabel(metric), fmtVal(m[mk], metric)];
      for (const w of wkA) row.push(fmtVal(w[mk], metric));
      row.push(diffText(wkA[1][mk], wkA[0][mk], metric));
      row.push(diffText(wkA[2][mk], wkA[1][mk], metric));
      for (const d of dayA) row.push(fmtVal(d[mk], metric));
      rows.push({ cells: row, bg });
    }
    rows.push({ cells: new Array(header.length).fill(''), bg: '#ffffff' });
  }
  const scale = 2, pad = 24, titleH = 50, cellH = 30, firstW = 220, cellW = 115;
  const totalW = pad * 2 + firstW + (header.length - 1) * cellW;
  const totalH = pad * 2 + titleH + rows.length * cellH;
  const cv = document.createElement('canvas');
  cv.width = totalW * scale; cv.height = totalH * scale;
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, totalW, totalH);
  ctx.fillStyle = '#7B8FBF'; ctx.font = 'bold 16px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('创作者数据分析 · ' + biz + ' · ' + S.month, pad, pad + 18);
  const y0 = pad + titleH;
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  for (let c = 0; c < header.length; c++) {
    const x = pad + (c === 0 ? 0 : firstW + (c-1) * cellW);
    const w = c === 0 ? firstW : cellW;
    ctx.fillStyle = '#F5F4F0'; ctx.fillRect(x, y0, w, cellH);
    ctx.strokeStyle = '#E5E1DA'; ctx.strokeRect(x, y0, w, cellH);
    ctx.fillStyle = '#7A7A87'; ctx.fillText(String(header[c]), x + w / 2, y0 + cellH / 2);
  }
  ctx.font = '12px sans-serif';
  for (let r = 1; r < rows.length; r++) {
    const rowObj = rows[r]; const row = rowObj.cells; const rowBg = rowObj.bg || '#ffffff';
    const y = y0 + r * cellH;
    for (let c = 0; c < header.length; c++) {
      const x = pad + (c === 0 ? 0 : firstW + (c-1) * cellW);
      const w = c === 0 ? firstW : cellW;
      ctx.fillStyle = rowBg; ctx.fillRect(x, y, w, cellH);
      ctx.strokeStyle = '#EBE8E1'; ctx.strokeRect(x, y, w, cellH);
      const txt = row[c] == null ? '' : String(row[c]);
      ctx.fillStyle = '#3A3A44'; ctx.textAlign = 'center';
      if (txt.startsWith('↑')) ctx.fillStyle = '#7CAE8B';
      else if (txt.startsWith('↓')) ctx.fillStyle = '#D48A8A';
      ctx.fillText(txt, x + w / 2, y + cellH / 2);
    }
  }
  return cv;
}
function previewExport() {
  const cv = buildExportCanvas();
  if (!cv) return;
  const box = $('#exPreview'); if (!box) return;
  box.innerHTML = '';
  if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
  cv.toBlob(blob => {
    _lastBlobUrl = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = _lastBlobUrl;
    box.appendChild(img);
    const btn = $('#btnExport'); if (btn) btn.disabled = false;
  }, 'image/png');
}
function downloadExport() {
  if (!_lastBlobUrl) { alert('请先生成预览'); return; }
  const bizEl = $('#exBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const a = document.createElement('a');
  a.href = _lastBlobUrl;
  a.download = 'creator-analytics-' + biz + '-' + S.month + '.png';
  a.click();
}

/* ===== 周报 · 目标读取 ===== */
function loadTargets() { try { return JSON.parse(localStorage.getItem('creator_kpi_target') || '{}'); } catch (_) { return {}; } }
function saveTargets(t) { localStorage.setItem('creator_kpi_target', JSON.stringify(t)); }

function slaTargets100(biz) {
  const out = {};
  const src = bizToSrc(biz);
  const rawList = (src === 'buyer') ? S.slaBuyer : S.slaBlogger;
  if (!rawList || !rawList.length) return out;
  const curMonth = S.month ? parseInt(S.month.slice(5,7), 10) : null;
  if (curMonth == null) return out;

  const isElder = (cat) => {
    const c = String(cat == null ? '' : cat).trim();
    return c.includes('老人');
  };
  const isOverall = (cat) => {
    const c = String(cat == null ? '' : cat).trim();
    if (!c) return true;
    return c === '整体' || c === '全部' || c === '合计' || c === '总计' || c === '平均' || c === '总体';
  };
  const isFullScore = (points) => {
    const p = Number(points);
    if (!isFinite(p)) return false;
    if (p === 100) return true;
    if (Math.abs(p - 1) < 1e-6) return true;
    return false;
  };

  for (const round of [1, 2, 3]) {
    for (const item of rawList) {
      const key = matchMetricKey(item.metric);
      if (!key || out[key] != null) continue;
      const elder = isElder(item.category);
      const overall = isOverall(item.category);
      if (round === 1 && !elder) continue;
      if (round === 2 && (!overall || elder)) continue;
      if (round === 3 && (elder || overall)) continue;

      const cfg = item.months[curMonth];
      if (!cfg || !cfg.tiers || !cfg.tiers.length) continue;
      const t100 = cfg.tiers.find(t => isFullScore(t.points));
      if (!t100 || t100.threshold == null || !isFinite(t100.threshold)) continue;

      const m = METRIC_MAP[key];
      let v;
      if (m && m.pct) {
        v = t100.threshold;
      } else {
        const raw = num(t100.rawThreshold);
        v = (isFinite(raw) && raw !== 0) ? raw : t100.threshold;
      }
      out[key] = v;
    }
  }
  return out;
}

function getTargets(biz) {
  const manual = loadTargets()[biz] || {};
  const sla = slaTargets100(biz);
  return Object.assign({}, sla, manual);
}

function s30TargetFromSLA(biz) {
  const t = slaTargets100(biz);
  return t.s30Rate != null ? t.s30Rate : null;
}
function s30Threshold(biz) {
  const v = s30TargetFromSLA(biz);
  if (v != null) return v;
  return S30_THRESHOLD[biz] != null ? S30_THRESHOLD[biz] : 0.97;
}
function s30TargetPct(biz) {
  const t = getTargets(biz);
  if (t && t.s30Rate != null) return Number(t.s30Rate);
  return S30_THRESHOLD[biz] != null ? S30_THRESHOLD[biz] : 0.97;
}

function renderTargetConfig() {
  const grid = $('#targetGrid');
  if (!grid) return;
  const bizEl = $('#rpBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const manual = loadTargets()[biz] || {};
  const sla = slaTargets100(biz);
  const slaRawCount = (bizToSrc(biz) === 'buyer') ? S.slaBuyer.length : S.slaBlogger.length;
  const curMonth = S.month ? parseInt(S.month.slice(5,7), 10) : null;
  const slaMatchedCount = Object.keys(sla).length;

  let statusTip = '';
  if (!S.slaBuyer.length && !S.slaBlogger.length) {
    statusTip = '<span style="color:#C98383">⚠ 未检测到 SLA 数据（请确认导入文件中包含「买手员工SLA」/「博主员工SLA」sheet）</span>';
  } else if (slaRawCount === 0) {
    statusTip = '<span style="color:#C98383">⚠ 当前业务线（' + esc(biz) + '）无 SLA 数据</span>';
  } else if (curMonth == null) {
    statusTip = '<span style="color:#C98383">⚠ 无法确定数据月份（请检查 CASE 日期是否可解析）</span>';
  } else if (slaMatchedCount === 0) {
    statusTip = '<span style="color:#C98383">⚠ SLA 已加载 ' + slaRawCount + ' 组，但当前月份（' + curMonth + '月）未匹配到任何 100% 档位目标。请检查：① SLA 表头是否有「指标」「分类」列；② 是否有「' + curMonth + '月权重 / ' + curMonth + '月目标 / ' + curMonth + '月得分」列；③ 指标名是否可识别。</span>';
  } else {
    statusTip = '<span style="color:#6EA980">✓ SLA 已加载 ' + slaRawCount + ' 组，当前月份（' + curMonth + '月）匹配到 ' + slaMatchedCount + ' 个指标</span>';
  }

  const fmtDisp = (m, v) => (v == null) ? '' : (m.pct ? (v * 100).toFixed(2) : String(v));

  const hint = '<div style="grid-column:1/-1;font-size:11.5px;color:#77778A;line-height:1.7;margin:0 0 4px;padding:8px 10px;background:#FAF9F7;border-radius:8px;border-left:3px solid #98A8CE">' +
    statusTip + '<br>' +
    '目标值默认取 SLA 中该指标 <b style="color:#7B8FBF">「老人」分类 100% 得分档位</b>（无老人时回退到「整体」，再回退到其他分类）。' +
    '带 <span class="sla-tag sla" style="vertical-align:middle">SLA</span> 标记的为自动取值，<b>可手动覆盖</b>，修改前会二次确认；' +
    '带 <span class="sla-tag manual" style="vertical-align:middle">⚠ 已覆盖</span> 标记的为已手动覆盖 SLA 的值，<b>清空输入框并失焦可恢复为 SLA 值</b>。' +
    'SLA 中没有的指标才需手动填写。' +
  '</div>';

  grid.innerHTML = hint + METRICS.map(m => {
    const hasManual = manual[m.key] != null;
    const hasSla    = sla[m.key]    != null;
    let src, disp;
    if (hasManual)   { src = 'manual'; disp = fmtDisp(m, manual[m.key]); }
    else if (hasSla) { src = 'sla';    disp = fmtDisp(m, sla[m.key]);    }
    else             { src = 'none';   disp = ''; }

    let tag = '';
    if (src === 'manual' && hasSla) {
      tag = '<span class="sla-tag manual" title="已手动覆盖 SLA 100 分档（' + fmtDisp(m, sla[m.key]) + (m.pct ? '%' : '') + '）">⚠ 已覆盖</span>';
    } else if (src === 'manual') {
      tag = '<span class="sla-tag manual" title="SLA 中无该指标，值为手动设置">手动</span>';
    } else if (src === 'sla') {
      tag = '<span class="sla-tag sla" title="来自 SLA 老人分类 100% 得分档位，可手动覆盖">SLA</span>';
    } else {
      tag = '<span class="sla-tag none" title="SLA 中无该指标，请手动设置">未设置</span>';
    }

    return '<div class="target-row">' +
      '<span class="lb" title="' + esc(m.label) + '">' + esc(metricLabel(m)) + '</span>' +
      '<input type="text" inputmode="decimal" data-key="' + esc(m.key) + '" data-src="' + src + '" value="' + esc(disp) + '" placeholder="未设置">' +
      '<span class="unit">' + (m.pct ? '%' : '') + '</span>' +
      tag +
    '</div>';
  }).join('');

  grid.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      const key = inp.dataset.key;
      const m = METRIC_MAP[key];
      const raw = inp.value.trim();
      const src = inp.dataset.src;
      const slaVal = sla[key];
      const slaDisp = slaVal != null ? fmtDisp(m, slaVal) + (m.pct ? '%' : '') : null;

      if (src === 'sla' && slaVal != null && raw !== '') {
        const newDisp = raw + (m.pct ? '%' : '');
        const ok = confirm(
          '⚠ 强提醒\n\n' +
          '【' + m.label + '】当前目标来自 SLA 100% 得分档位：' + slaDisp + '\n' +
          '即将手动覆盖为：' + newDisp + '\n\n' +
          '确认覆盖吗？\n' +
          '（覆盖后该指标不再随 SLA 自动更新；清空输入框并失焦可恢复 SLA 值）'
        );
        if (!ok) {
          inp.value = fmtDisp(m, slaVal);
          inp.dataset.src = 'sla';
          return;
        }
      }

      const all = loadTargets();
      if (!all[biz]) all[biz] = {};
      if (raw === '') {
        delete all[biz][key];
      } else {
        const n = parseFloat(raw);
        if (isNaN(n)) delete all[biz][key];
        else all[biz][key] = m.pct ? n / 100 : n;
      }
      saveTargets(all);
      renderTargetConfig();
      renderReport();
    });
  });
}

function metricLineParts(curRaw, prevRaw, monthRaw, m, tgt, monthLabel) {
  const isPct = !!m.pct;
  const unit = isPct ? '%' : '';
  const curDisp = isPct ? pct2(curRaw) : num2(curRaw);
  const dd = (curRaw != null && prevRaw != null && isFinite(curRaw) && isFinite(prevRaw)) ? curRaw - prevRaw : null;
  const wowDisp = dd == null ? '—' : (isPct ? dPct(dd) : dStr(dd));
  const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');

  const tw = (tgt && tgt[m.key] != null) ? Number(tgt[m.key]) : null;

  let weekHit = null, weekRate = null;
  if (tw != null && curRaw != null && isFinite(curRaw)) {
    weekHit = m.better === 'down' ? curRaw <= tw : curRaw >= tw;
    weekRate = m.better === 'down' ? (curRaw > 0 ? tw / curRaw : null) : (tw > 0 ? curRaw / tw : null);
  }
  let monthHit = null, monthRate = null;
  if (tw != null && monthRaw != null && isFinite(monthRaw)) {
    monthHit = m.better === 'down' ? monthRaw <= tw : monthRaw >= tw;
    monthRate = m.better === 'down' ? (monthRaw > 0 ? tw / monthRaw : null) : (tw > 0 ? monthRaw / tw : null);
  }
  const monthDisp = isPct ? pct2(monthRaw) : num2(monthRaw);
  const twDisp = tw == null ? '—' : (isPct ? (tw * 100).toFixed(2) : tw.toFixed(0));
  return { isPct, unit, curDisp, wowDisp, arrow, tw, twDisp, weekHit, weekRate, monthHit, monthRate, monthDisp, monthLabel };
}
function metricLineHTML(label, curRaw, prevRaw, monthRaw, m, tgt, monthLabel) {
  const p = metricLineParts(curRaw, prevRaw, monthRaw, m, tgt, monthLabel);
  let s = '<b>' + esc(label) + '</b><span class="rpt-v">' + p.curDisp + '</span>';
  s += '<span class="rpt-sep">|</span>周度WoW' + p.wowDisp + p.arrow;
  if (p.weekHit != null) s += (p.weekHit ? '' : '🔴') + '（' + (p.weekHit ? '已达成' : '未达成') + '）（周度达成率' + pct2(p.weekRate) + '）';
  s += '，';
  if (p.tw != null) {
    s += '<span class="rpt-sep">|</span>' + p.monthLabel + '目标：' + p.twDisp + p.unit;
    s += '，' + p.monthLabel + '达成：' + p.monthDisp;
    if (p.monthHit != null) s += '（月度达成率' + pct2(p.monthRate) + '）' + (p.monthHit ? '' : '🔴（未达成）');
  } else {
    s += '<span class="rpt-sep">|</span>' + p.monthLabel + '达成：' + p.monthDisp;
  }
  s += '<span class="rpt-sep">|</span>';
  return s;
}
function metricLineText(label, curRaw, prevRaw, monthRaw, m, tgt, monthLabel) {
  const p = metricLineParts(curRaw, prevRaw, monthRaw, m, tgt, monthLabel);
  let s = label + p.curDisp;
  s += ' | 周度WoW' + p.wowDisp + p.arrow;
  if (p.weekHit != null) s += (p.weekHit ? '' : '🔴') + '（' + (p.weekHit ? '已达成' : '未达成') + '）（周度达成率' + pct2(p.weekRate) + '）';
  s += '，';
  if (p.tw != null) {
    s += ' | ' + p.monthLabel + '目标：' + p.twDisp + p.unit;
    s += '，' + p.monthLabel + '达成：' + p.monthDisp;
    if (p.monthHit != null) s += '（月度达成率' + pct2(p.monthRate) + '）' + (p.monthHit ? '' : '🔴（未达成）');
  } else { s += ' | ' + p.monthLabel + '达成：' + p.monthDisp; }
  s += ' |';
  return s;
}
function catLineHTML(cat, curRaw, prevRaw, m) {
  if (curRaw == null || !isFinite(curRaw)) return '<div class="rpt-sub">' + cat + '达成：—</div>';
  const curDisp = m.pct ? pct2(curRaw) : num2(curRaw);
  if (prevRaw == null || !isFinite(prevRaw)) return '<div class="rpt-sub">' + cat + '达成：' + curDisp + '</div>';
  const dd = curRaw - prevRaw;
  const prevDisp = m.pct ? pct2(prevRaw) : num2(prevRaw);
  const dDisp = m.pct ? (Math.abs(dd) * 100).toFixed(2) + '%' : num2(Math.abs(dd));
  return '<div class="rpt-sub">' + cat + '达成：' + curDisp + '（' + prevDisp + '→' + curDisp + '，' + dArrow(dd) + dDisp + '）</div>';
}
function catLineText(cat, curRaw, prevRaw, m) {
  if (curRaw == null || !isFinite(curRaw)) return cat + '达成：—';
  const curDisp = m.pct ? pct2(curRaw) : num2(curRaw);
  if (prevRaw == null || !isFinite(prevRaw)) return cat + '达成：' + curDisp;
  const dd = curRaw - prevRaw;
  const prevDisp = m.pct ? pct2(prevRaw) : num2(prevRaw);
  const dDisp = m.pct ? (Math.abs(dd) * 100).toFixed(2) + '%' : num2(Math.abs(dd));
  return cat + '达成：' + curDisp + '（' + prevDisp + '→' + curDisp + '，' + dArrow(dd) + dDisp + '）';
}
function allWeeks() {
  const set = new Set();
  for (const r of S.records) if (r.wk) set.add(r.wk);
  for (const r of S.wtRecords) if (r.wk) set.add(r.wk);
  for (const r of S.inspections) if (r.wk) set.add(r.wk);
  return Array.from(set).sort((a, b) => a - b);
}
function aht2ByWeek(biz, wk) {
  const prevWk = wk - 1;
  const map = new Map();
  let bizAht = 0, bizVol = 0;
  for (const r of S.records) {
    if (r.biz2 !== biz) continue;
    if (r.wk !== wk && r.wk !== prevWk) continue;
    if (r.wk === wk) { bizAht += r.aht || 0; bizVol += r.volume || 0; }
    const key = (r.l1 || '') + '|' + (r.l2 || '');
    if (!map.has(key)) map.set(key, { l1: r.l1 || '—', l2: r.l2 || '—', ahtNow:0, volNow:0, ahtPrev:0, volPrev:0 });
    const o = map.get(key);
    if (r.wk === wk) { o.ahtNow += r.aht || 0; o.volNow += r.volume || 0; }
    else             { o.ahtPrev += r.aht || 0; o.volPrev += r.volume || 0; }
  }
  const bizRate = bizVol > 0 ? bizAht / bizVol : null;
  const list = Array.from(map.values()).map(o => {
    const ahtNow  = o.volNow  > 0 ? o.ahtNow  / o.volNow  : null;
    const ahtPrev = o.volPrev > 0 ? o.ahtPrev / o.volPrev : null;
    let impact = null;
    if (ahtNow != null && bizRate != null) { const nv = bizVol - o.volNow; if (nv > 0) impact = (bizAht - o.ahtNow) / nv - bizRate; }
    return { l1:o.l1, l2:o.l2, ahtNow, ahtPrev, volNow:o.volNow, volPrev:o.volPrev, impact };
  });
  return { list, bizRate, bizVol };
}
function bizAttendanceCount(biz, wk) {
  const start = wkStartDate(wk);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(dateAdd(start, i));

  const srcEmps = srcEmployeeSet(bizToSrc(biz));
  let total = 0;
  for (const name of srcEmps) {
    const e = getEmp(name);
    if (e && !employeeVisible(e)) continue;
    for (const d of days) total += attOf(name, d);
  }
  return total;
}
function attendanceByWeek(emps, wk) {
  const start = wkStartDate(wk);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(dateAdd(start, i));
  const rows = emps.map(e => {
    let total = 0;
    for (const d of days) total += attOf(e.name, d);
    return { name: e.name, group: e.group || '—', total };
  });
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return { days, rows, sum, avg: rows.length ? sum / rows.length : 0 };
}
function reportConclusion(d) {
  const { biz, cur, prev, s30Cur, s30Prev, groups, aht2, att } = d;
  const hasPrev = prev.caseVolume > 0;
  const out = [];
  if (cur.caseVolume > 0) {
    let s = '本周 <b>' + esc(biz) + '</b> 共处理 CASE <b>' + fmtInt(cur.caseVolume) + '</b> 单';
    if (hasPrev) {
      const dv = cur.caseVolume - prev.caseVolume;
      if (Math.abs(dv) < 1) s += '，与上周基本持平';
      else { const pct = prev.caseVolume > 0 ? Math.abs(dv / prev.caseVolume * 100).toFixed(1) : '—'; s += '，较上周 <span class="' + (dv > 0 ? 'up' : 'down') + '">' + (dv > 0 ? '↑' : '↓') + ' ' + fmtInt(Math.abs(dv)) + ' 单（' + pct + '%）</span>'; }
    }
    s += '。'; out.push(s);
  }
  const parts2 = [];
  if (cur.cpd != null) { let t = '人均 CPD <b>' + cur.cpd.toFixed(2) + '</b>'; if (hasPrev && prev.cpd != null) { const dv = cur.cpd - prev.cpd; if (Math.abs(dv) >= 0.01) t += '（<span class="' + (dv > 0 ? 'up' : 'down') + '">' + (dv > 0 ? '↑' : '↓') + ' ' + Math.abs(dv).toFixed(2) + '</span>）'; } parts2.push(t); }
  if (cur.aht != null) { let t = 'AHT <b>' + cur.aht.toFixed(2) + '</b> 分钟'; if (hasPrev && prev.aht != null) { const dv = cur.aht - prev.aht; if (Math.abs(dv) >= 0.01) t += '（<span class="' + (dv < 0 ? 'up' : 'down') + '">' + (dv > 0 ? '↑' : '↓') + ' ' + Math.abs(dv).toFixed(2) + '</span>）'; } parts2.push(t); }
  if (parts2.length) out.push(parts2.join('，') + '。');
  const parts3 = [];
  if (cur.solveRate != null) parts3.push('解决率 <b>' + (cur.solveRate * 100).toFixed(2) + '%</b>');
  if (cur.satisfaction != null) parts3.push('满意度 <b>' + (cur.satisfaction * 100).toFixed(2) + '%</b>');
  if (cur.qualityPassRate != null) parts3.push('质检合格率 <b>' + (cur.qualityPassRate * 100).toFixed(2) + '%</b>');
  if (parts3.length) out.push(parts3.join('，') + '。');
  if (s30Cur && s30Cur.s30Den > 0) {
    const th = s30Threshold(biz);
    const rate = s30Cur.s30Rate;
    const ok = rate != null && rate >= th;
    let s = '30S 接起率 <b>' + (rate != null ? (rate * 100).toFixed(2) + '%' : '—') + '</b>（目标 ≥ ' + (th * 100).toFixed(2) + '%），' + (ok ? '<span class="up">已达标</span>' : '<span class="down">未达标</span>') + '，Miss 量 ' + fmtInt(s30Cur.s30Miss) + ' 单';
    if (s30Prev && s30Prev.s30Den > 0 && s30Prev.s30Rate != null && rate != null) { const dv = rate - s30Prev.s30Rate; if (Math.abs(dv) >= 0.0001) s += '，环比 ' + (dv > 0 ? '<span class="up">↑ ' : '<span class="down">↓ ') + (Math.abs(dv) * 100).toFixed(2) + '%</span>'; }
    s += '。'; out.push(s);
  }
  if (groups && groups.length >= 2) {
    const sorted = groups.slice().sort((a, b) => (b.cur.cpd || 0) - (a.cur.cpd || 0));
    const best = sorted[0], worst = sorted[sorted.length - 1];
    if (best.cur.cpd != null && worst.cur.cpd != null && best.cur.cpd > worst.cur.cpd) {
      out.push('组别 CPD 表现：<b>' + esc(best.name) + '</b> 最高（' + best.cur.cpd.toFixed(2) + '），<b>' + esc(worst.name) + '</b> 最低（' + worst.cur.cpd.toFixed(2) + '），差距 ' + (best.cur.cpd - worst.cur.cpd).toFixed(2) + '。');
    }
  }
  if (aht2) {
    const topImpact = aht2.list.filter(o => o.impact != null && o.volNow > 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3);
    if (topImpact.length) {
      const seg = topImpact.map(o => { const good = o.impact < 0; return '<b>' + esc(o.l1) + ' / ' + esc(o.l2) + '</b>（<span class="' + (good ? 'up' : 'down') + '">' + (o.impact > 0 ? '+' : '') + o.impact.toFixed(2) + '</span>）'; }).join('、');
      out.push('AHT 影响值最大的二级打点：' + seg + '。');
    }
  }
  if (att && att.sum > 0) out.push('本周出勤合计 <b>' + att.sum.toFixed(2) + '</b> 天，人均 <b>' + att.avg.toFixed(2) + '</b> 天。');
  return out;
}

/* ==================== 30S 接起率 多维度归因分析（含预测量维度） ==================== */
function s30AnalysisData(biz, wk) {
  const records = S.records.filter(r => r.biz === biz && r.wk === wk);
  if (!records.length) return null;

  const forecastMap = (biz === '买手合作') ? S.forecastBuyer : S.forecastBlogger;
  const hasFc = !!(forecastMap && Object.keys(forecastMap).length);

  const dpMap = new Map();
  for (const r of records) {
    const p = normPeriod(r.period) || '—';
    const key = r.date + '|' + p;
    if (!dpMap.has(key)) dpMap.set(key, { date: r.date, period: p, num: 0, den: 0, forecast: 0, hasFc: false });
    const o = dpMap.get(key);
    o.num += r.s30Num;
    o.den += r.s30Den;
  }
  if (hasFc) {
    for (const o of dpMap.values()) {
      const fc = forecastMap[o.date + '|' + o.period];
      if (fc != null && isFinite(fc) && fc > 0) { o.forecast = fc; o.hasFc = true; }
    }
  }
  const dpList = Array.from(dpMap.values());

  let totNum = 0, totDen = 0, totFc = 0, fcCover = 0;
  for (const o of dpList) {
    totNum += o.num; totDen += o.den;
    if (o.hasFc) { totFc += o.forecast; fcCover += o.den; }
  }
  if (totDen <= 0) return null;

  const totRate = totNum / totDen;
  const th = s30Threshold(biz);
  const hit = totRate >= th;
  const targetNum = th * totDen;
  /* 30S 接起率缺口（仅未达标时计算，向上取整）：
     设缺口为 X，使其满足 (接起分子 + X) / (接起分母 + X) = 目标值
     解得：X = (目标值 × 分母 − 分子) / (1 − 目标值)
     gapNum = ceil(X)，减 1e-9 抵消 JS 浮点误差 */
  const gapRaw = (th * totDen - totNum) / (1 - th);
  const gapNum = (!hit && th > 0 && th < 1 && isFinite(gapRaw))
    ? Math.max(0, Math.ceil(gapRaw - 1e-9))
    : null;
  const totBias = totFc > 0 ? totDen / totFc : null;
  const fcCoverRate = totDen > 0 ? fcCover / totDen : 0;

  const dayMap = new Map();
  for (const o of dpList) {
    if (!dayMap.has(o.date)) dayMap.set(o.date, { date: o.date, num: 0, den: 0, forecast: 0, hasFc: false });
    const d = dayMap.get(o.date);
    d.num += o.num; d.den += o.den;
    if (o.hasFc) { d.forecast += o.forecast; d.hasFc = true; }
  }
  const days = Array.from(dayMap.values()).map(o => {
    const rate = o.den > 0 ? o.num / o.den : null;
    const bias = (o.hasFc && o.forecast > 0) ? o.den / o.forecast : null;
    return { date: o.date, num: o.num, den: o.den, forecast: o.forecast, hasFc: o.hasFc,
      rate, miss: o.den - o.num, hit: rate != null && rate >= th, bias };
  }).sort((a, b) => a.date < b.date ? -1 : 1);

  const periodMap = new Map();
  for (const o of dpList) {
    const p = o.period;
    if (!periodMap.has(p)) periodMap.set(p, { period: p, num: 0, den: 0, forecast: 0, hasFc: false });
    const x = periodMap.get(p);
    x.num += o.num; x.den += o.den;
    if (o.hasFc) { x.forecast += o.forecast; x.hasFc = true; }
  }
  const periods = Array.from(periodMap.values()).map(o => {
    const rate = o.den > 0 ? o.num / o.den : null;
    const bias = (o.hasFc && o.forecast > 0) ? o.den / o.forecast : null;
    return { period: o.period, num: o.num, den: o.den, forecast: o.forecast, hasFc: o.hasFc,
      rate, miss: o.den - o.num, bias };
  }).filter(o => o.den > 0).sort((a, b) => {
    const ai = parseInt(a.period, 10), bi = parseInt(b.period, 10);
    if (isFinite(ai) && isFinite(bi) && ai !== bi) return ai - bi;
    return String(a.period).localeCompare(String(b.period));
  });

  const empMap = new Map();
  for (const r of records) {
    if (!r.name) continue;
    if (!empMap.has(r.name)) empMap.set(r.name, { name: r.name, num: 0, den: 0 });
    const o = empMap.get(r.name);
    o.num += r.s30Num; o.den += r.s30Den;
  }
  const emps = Array.from(empMap.values()).map(o => ({
    name: o.name, num: o.num, den: o.den,
    rate: o.den > 0 ? o.num / o.den : null, miss: o.den - o.num
  })).filter(o => o.den > 0).sort((a, b) => b.miss - a.miss);

  const fcSlices = dpList.filter(o => o.hasFc && o.forecast > 0);
  const fcBuckets = {
    over:   { label: '超预测（>120%）', den: 0, miss: 0, cnt: 0 },
    near:   { label: '接近预测（100%~120%）', den: 0, miss: 0, cnt: 0 },
    under:  { label: '低于预测（<100%）', den: 0, miss: 0, cnt: 0 }
  };
  for (const o of fcSlices) {
    const b = o.den / o.forecast;
    const miss = o.den - o.num;
    let k;
    if (b > 1.2) k = 'over';
    else if (b < 1.0) k = 'under';
    else k = 'near';
    fcBuckets[k].den += o.den;
    fcBuckets[k].miss += miss;
    fcBuckets[k].cnt += 1;
  }

  return {
    biz, wk, totNum, totDen, totRate, th, hit, targetNum, gapNum,
    hasFc, totFc, totBias, fcCover, fcCoverRate,
    days, periods, emps, fcSlices, fcBuckets, dpList
  };
}

/* 超预测 + 不达标时段的 Miss 回补影响值
   筛选：偏差 > 120% 且 时段接起率 < 阈值 且 Miss > 0
   日度影响值 = (该日 num + Miss) / 该日 den − 该日实际 rate
   周度影响值 = (整周 num + Miss) / 整周 den − 整周实际 rate
   排序：按周度影响值升序（拖累最大的排前） */
function computeOverForecastImpactDetail(cur) {
  const th = cur.th;
  const totNum = cur.totNum, totDen = cur.totDen, totRate = cur.totRate;
  const dayMap = new Map();
  for (const d of cur.days) dayMap.set(d.date, d);

  const rows = [];
  for (const o of cur.fcSlices) {
    if (!o.hasFc || !o.forecast || o.forecast <= 0) continue;
    const bias = o.den / o.forecast;
    if (bias <= 1.2) continue;
    if (o.den <= 0) continue;
    const rate = o.num / o.den;
    if (rate >= th) continue;
    const miss = o.den - o.num;
    if (miss <= 0) continue;

    const day = dayMap.get(o.date);
    if (!day || day.den <= 0) continue;

    const newDayRate = (day.num + miss) / day.den;
    const dayImpact = newDayRate - day.rate;

    const newWeekRate = (totNum + miss) / totDen;
    const weekImpact = newWeekRate - totRate;

    rows.push({
      date: o.date, period: o.period,
      forecast: o.forecast, den: o.den, num: o.num,
      miss, bias, rate, dayImpact, weekImpact
    });
  }
  rows.sort((a, b) => a.weekImpact - b.weekImpact);
  return rows;
}

function s30AnalysisHTML(biz, wk, prevWk) {
  const cur = s30AnalysisData(biz, wk);
  if (!cur) return '';
  const th = cur.th;
  const thPct = (th * 100).toFixed(2);
  const P = [];

  P.push('<h4 class="sub-title">🔍 30S 接起率 多维度归因分析</h4>');

  if (cur.hit) {
    P.push('<div class="rpt-sub">本周 30S 接起率 <b>' + (cur.totRate * 100).toFixed(2) + '%</b> 已达标（目标 ≥ ' + thPct + '%），无缺口。</div>');
  } else {
    const gapPp = (th - cur.totRate) * 100;
    const gapTxt = (cur.gapNum != null)
      ? '；按「（接起量 + 缺口）/（服务量 + 缺口）= ' + thPct + '%」测算，接起率缺口为 <b>' + cur.gapNum + ' 单</b>才能达标'
      : '；目标值 ≥ 100%，无法通过增加接起量达成';
    P.push('<div class="rpt-sub" style="color:#D9363E;font-weight:600">⚠ 本周 30S 接起率 <b>' + (cur.totRate * 100).toFixed(2) + '%</b> 低于目标 <b>' + thPct + '%</b>，差距 <b>' + gapPp.toFixed(2) + 'pp</b>' + gapTxt + '。</div>');
  }

  if (cur.hasFc && cur.totFc > 0) {
    P.push('<div class="rpt-sub" style="margin-top:8px">📊 <b>预测量级维度</b></div>');
    const biasTxt = cur.totBias != null ? (cur.totBias * 100).toFixed(2) + '%' : '—';
    const biasColor = (cur.totBias != null && cur.totBias > 1.2) ? '#D9363E' : '#4A4A56';
    P.push('<div class="rpt-sub">本周预测量合计 <b>' + fmtInt(cur.totFc) + '</b> 单，实际人工服务量 <b>' + fmtInt(cur.totDen) + '</b> 单，' +
      '预测偏差 <b style="color:' + biasColor + '">' + biasTxt + '</b>' +
      (cur.totBias != null && cur.totBias > 1.2 ? '（实际量已明显超出预测）' : cur.totBias != null && cur.totBias < 1.0 ? '（实际量低于预测）' : '（实际量与预测接近）') +
      '；预测覆盖率 <b>' + (cur.fcCoverRate * 100).toFixed(1) + '%</b>。</div>');

    const bk = cur.fcBuckets;
    const totalMissFc = bk.over.miss + bk.near.miss + bk.under.miss;
    P.push('<div class="rpt-sub" style="line-height:2.2">' +
      '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#FDF0F0;font-size:11.5px;color:#B33">' +
        '超预测 >120% · <b>' + bk.over.cnt + '</b> 段 · Miss <b>' + bk.over.miss + '</b>（占比 ' + (totalMissFc > 0 ? (bk.over.miss / totalMissFc * 100).toFixed(1) : '0') + '%）</span>' +
      '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#F8F7F4;font-size:11.5px;color:#4A4A56">' +
        '接近预测 100%~120% · <b>' + bk.near.cnt + '</b> 段 · Miss <b>' + bk.near.miss + '</b>（占比 ' + (totalMissFc > 0 ? (bk.near.miss / totalMissFc * 100).toFixed(1) : '0') + '%）</span>' +
      '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#F0F7F2;font-size:11.5px;color:#3D7A52">' +
        '低于预测 <100% · <b>' + bk.under.cnt + '</b> 段 · Miss <b>' + bk.under.miss + '</b>（占比 ' + (totalMissFc > 0 ? (bk.under.miss / totalMissFc * 100).toFixed(1) : '0') + '%）</span>' +
    '</div>');

    const overSlices = cur.fcSlices
      .map(o => Object.assign({}, o, { bias: o.den / o.forecast, miss: o.den - o.num }))
      .filter(o => o.bias > 1.2 && o.miss > 0)
      .sort((a, b) => b.miss - a.miss).slice(0, 3);
    if (overSlices.length) {
      const html = overSlices.map(o =>
        '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#FDF0F0;font-size:11.5px;color:#B33">' +
        esc(o.date.slice(5)) + ' ' + esc(o.period) + '时 · 预测 ' + Math.round(o.forecast) + ' / 实际 ' + Math.round(o.den) +
        '（偏差 ' + (o.bias * 100).toFixed(0) + '%）· Miss ' + o.miss + '</span>'
      ).join('');
      P.push('<div class="rpt-sub">超预测且 Miss>0 的日期×时段 TOP3：' + html + '</div>');
    }

    const overShare = totalMissFc > 0 ? bk.over.miss / totalMissFc : 0;
    const nearShare = totalMissFc > 0 ? bk.near.miss / totalMissFc : 0;
    const badFc = (cur.totBias != null && cur.totBias > 1.2);
    let insight;
    if (badFc && overShare >= 0.5) {
      insight = '🔎 <b>推断：量级超预测是主因。</b>本周实际服务量超预测量 ' + ((cur.totBias - 1) * 100).toFixed(1) + '%，' +
        'Miss 的 <b>' + (overShare * 100).toFixed(1) + '%</b> 集中在超预测时段，说明预测偏低、排班未能弹性覆盖突发增量。';
    } else if (!badFc && nearShare >= 0.5) {
      insight = '🔎 <b>推断：接起能力（非量级）是主因。</b>实际服务量与预测量基本吻合，' +
        '但 Miss 的 <b>' + (nearShare * 100).toFixed(1) + '%</b> 集中在与预测一致的时段，说明排班匹配度尚可，问题更可能出在话务技能、系统稳定性或短时并发上。';
    } else if (badFc) {
      insight = '🔎 <b>推断：量级与能力双重因素。</b>实际服务量超预测 ' + ((cur.totBias - 1) * 100).toFixed(1) + '%，' +
        'Miss 在超预测时段占 ' + (overShare * 100).toFixed(1) + '%、在与预测一致时段占 ' + (nearShare * 100).toFixed(1) + '%，需同时评估预测模型与接起能力。';
    } else {
      insight = '🔎 <b>推断：量级正常，需关注能力侧。</b>实际服务量 ' + (cur.totBias != null ? (cur.totBias * 100).toFixed(0) + '%' : '—') + ' 于预测，' +
        'Miss 分布未见明显的量级集中特征。';
    }
    P.push('<div class="rpt-sub">' + insight + '</div>');
  }

  /* 🎯 日度时段超预测影响值（含 Miss 回补） */
  if (cur.hasFc && cur.fcSlices && cur.fcSlices.length) {
    const impacts = computeOverForecastImpactDetail(cur);
    if (impacts.length) {
      const totalMiss = impacts.reduce((s, x) => s + x.miss, 0);
      P.push('<div class="rpt-sub" style="margin-top:8px">🎯 <b>日度时段超预测影响值</b>（仅统计超预测 &gt;120% 且时段接起率不达标的切片；将 Miss 回补至 30S 接起量后重算日 / 周接起率，影响值 = 回补后接起率 − 实际接起率）</div>');
      P.push('<div class="rpt-sub">符合条件时段共 <b>' + impacts.length + '</b> 个，累计 Miss <b>' + totalMiss + '</b> 单。负值表示该时段拉低整体接起率。</div>');

      const rows = impacts.map((x, i) => {
        const dayColor = x.dayImpact < 0 ? '#D9363E' : '#6EA980';
        const weekColor = x.weekImpact < 0 ? '#D9363E' : '#6EA980';
        const dayDisp = (x.dayImpact >= 0 ? '+' : '') + (x.dayImpact * 100).toFixed(2) + 'pp';
        const weekDisp = (x.weekImpact >= 0 ? '+' : '') + (x.weekImpact * 100).toFixed(2) + 'pp';
        return '<tr>' +
          '<td style="text-align:center">' + (i + 1) + '</td>' +
          '<td>' + esc(x.date.slice(5)) + ' ' + esc(x.period) + '时</td>' +
          '<td style="text-align:center">' + Math.round(x.forecast) + '</td>' +
          '<td style="text-align:center">' + Math.round(x.den) + '</td>' +
          '<td style="text-align:center">' + (x.bias * 100).toFixed(1) + '%</td>' +
          '<td style="text-align:center">' + x.miss + '</td>' +
          '<td style="text-align:center;color:#D9363E;font-weight:600">' + (x.rate * 100).toFixed(2) + '%</td>' +
          '<td style="text-align:center;color:' + dayColor + ';font-weight:600">' + dayDisp + '</td>' +
          '<td style="text-align:center;color:' + weekColor + ';font-weight:600">' + weekDisp + '</td>' +
        '</tr>';
      }).join('');
      P.push('<div class="table-scroll-x"><table class="rp-table"><thead><tr>' +
        '<th>排名</th><th>日期 × 时段</th><th>预测量</th><th>实际量</th><th>超预测率</th><th>Miss</th><th>时段接起率</th><th>日度影响值</th><th>周度影响值</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>');

      /* 📌 一句话总结 */
      const totalMissAll = impacts.reduce((s, x) => s + x.miss, 0);
      const newWeekRate  = (cur.totNum + totalMissAll) / cur.totDen;
      const totalImpact  = newWeekRate - cur.totRate;
      const worst        = impacts[0];
      const top3Miss     = impacts.slice(0, 3).reduce((s, x) => s + x.miss, 0);
      const top3Pct      = totalMissAll > 0 ? (top3Miss / totalMissAll * 100).toFixed(1) : '0';
      P.push('<div class="rpt-sub" style="margin-top:8px;padding:10px 14px;background:#FAF9F7;border-radius:8px;border-left:3px solid #98A8CE;line-height:1.9">' +
        '📌 <b>一句话总结：</b>本周共 <b>' + impacts.length + '</b> 个「超预测且接起不达标」的时段（累计 Miss <b>' + totalMissAll + '</b> 单，其中 TOP3 时段贡献 <b>' + top3Pct + '%</b>）；' +
        '若将这些 Miss 全部回补至接起量，周度 30S 接起率将从 <b>' + (cur.totRate * 100).toFixed(2) + '%</b> 提升至 <b>' + (newWeekRate * 100).toFixed(2) + '%</b>，' +
        '即超预测对周度接起率的拖累约 <b style="color:#D9363E">' + (totalImpact * 100).toFixed(2) + 'pp</b>；' +
        '影响最大的时段为 <b>' + esc(worst.date.slice(5)) + ' ' + esc(worst.period) + '时</b>' +
        '（偏差 ' + (worst.bias * 100).toFixed(0) + '%，Miss ' + worst.miss + '，周度影响 <b style="color:#D9363E">' + (worst.weekImpact * 100).toFixed(2) + 'pp</b>）。' +
      '</div>');
    }
  }

  if (cur.days.length) {
    P.push('<div class="rpt-sub" style="margin-top:8px">📅 <b>日期维度</b></div>');
    const cells = cur.days.map(d => {
      const color = d.hit ? '#6EA980' : '#D9363E';
      const fcTxt = (d.hasFc && d.forecast > 0) ? ' · 预测 ' + Math.round(d.forecast) : '';
      return '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#F8F7F4;font-size:11.5px;color:' + color + ';' + (d.hit ? '' : 'font-weight:600') + '">' +
        '<b>' + d.date.slice(5) + '</b> ' + (d.rate != null ? (d.rate * 100).toFixed(2) + '%' : '—') + ' · Miss ' + d.miss + fcTxt + '</span>';
    }).join('');
    P.push('<div class="rpt-sub" style="line-height:2.2">' + cells + '</div>');
    const badDays = cur.days.filter(d => !d.hit);
    if (badDays.length) {
      const worstDay = cur.days.filter(d => d.rate != null).sort((a, b) => a.rate - b.rate)[0];
      const missDay = cur.days.slice().sort((a, b) => b.miss - a.miss)[0];
      P.push('<div class="rpt-sub">→ 未达标 <b>' + badDays.length + '/' + cur.days.length + '</b> 天，接起率最低为 <b>' + worstDay.date + '</b>（' + (worstDay.rate * 100).toFixed(2) + '%）；Miss 量最大为 <b>' + missDay.date + '</b>（Miss ' + missDay.miss + '）。</div>');
    }
  }

  if (cur.periods.length) {
    P.push('<div class="rpt-sub" style="margin-top:8px">⏰ <b>时段维度</b></div>');
    const missTotal = cur.periods.reduce((s, p) => s + p.miss, 0);
    const topMiss = cur.periods.slice().sort((a, b) => b.miss - a.miss).slice(0, 3);
    const topMissSum = topMiss.reduce((s, p) => s + p.miss, 0);
    const topPct = missTotal > 0 ? (topMissSum / missTotal * 100).toFixed(1) : '0';
    const cells = topMiss.map(p => {
      const fcTxt = (p.hasFc && p.forecast > 0) ? ' · 预测 ' + Math.round(p.forecast) : '';
      return '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#FDF0F0;font-size:11.5px;color:#B33">' +
        p.period + ' 时 · Miss ' + p.miss + fcTxt + '（接起率 ' + (p.rate * 100).toFixed(2) + '%）</span>';
    }).join('');
    P.push('<div class="rpt-sub" style="line-height:2.2">Miss 量 TOP3 时段：' + cells + '</div>');
    P.push('<div class="rpt-sub">→ 前三时段贡献了 <b>' + topPct + '%</b> 的 Miss 量（' + topMissSum + '/' + missTotal + ' 单）。</div>');
    const lowRate = cur.periods.filter(p => p.den >= 20).sort((a, b) => a.rate - b.rate).slice(0, 3);
    if (lowRate.length) {
      const lc = lowRate.map(p =>
        '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:6px;background:#FDF0F0;font-size:11.5px;color:#B33">' +
        p.period + ' 时 · ' + (p.rate * 100).toFixed(2) + '%（服务量 ' + p.den + '）</span>'
      ).join('');
      P.push('<div class="rpt-sub">接起率最低时段（服务量 ≥20）：' + lc + '</div>');
    }
  }

  if (cur.emps.length) {
    P.push('<div class="rpt-sub" style="margin-top:8px">👤 <b>员工维度</b>（按 Miss 量降序 TOP5）</div>');
    const totalMiss = cur.emps.reduce((s, e) => s + e.miss, 0);
    const top5 = cur.emps.slice(0, 5);
    const top5Miss = top5.reduce((s, e) => s + e.miss, 0);
    const top5Pct = totalMiss > 0 ? (top5Miss / totalMiss * 100).toFixed(1) : '0';
    const rows = top5.map((e, i) => {
      const emp = getEmp(e.name);
      const grp = emp ? (emp.group || '—') : '—';
      const color = e.rate >= th ? '#6EA980' : '#D9363E';
      const weight = e.rate >= th ? '400' : '600';
      return '<tr>' +
        '<td style="text-align:center">' + (i + 1) + '</td>' +
        '<td>' + esc(e.name) + ' <span style="color:#A0A0AE;font-size:11px">' + esc(grp) + '</span></td>' +
        '<td style="text-align:center">' + fmtInt(e.den) + '</td>' +
        '<td style="text-align:center">' + fmtInt(e.miss) + '</td>' +
        '<td style="text-align:center;color:' + color + ';font-weight:' + weight + '">' + (e.rate * 100).toFixed(2) + '%</td>' +
      '</tr>';
    }).join('');
    P.push('<div class="table-scroll-x"><table class="rp-table"><thead><tr>' +
      '<th>排名</th><th>员工</th><th>人工服务量</th><th>Miss 量</th><th>接起率</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>');
    P.push('<div class="rpt-sub">→ TOP5 员工贡献了 <b>' + top5Pct + '%</b> 的 Miss 量（' + top5Miss + '/' + totalMiss + ' 单）。</div>');
    const lowEmps = cur.emps.filter(e => e.den >= 30 && e.rate < th).sort((a, b) => a.rate - b.rate).slice(0, 5);
    if (lowEmps.length) {
      P.push('<div class="rpt-sub">服务量 ≥30 单且未达标员工：' +
        lowEmps.map(e => esc(e.name) + '（' + (e.rate * 100).toFixed(2) + '%）').join('、') + '</div>');
    }
  }

  const prev = s30AnalysisData(biz, prevWk);
  if (prev && prev.totDen > 0) {
    const dRate = cur.totRate - prev.totRate;
    const dMiss = (cur.totDen - cur.totNum) - (prev.totDen - prev.totNum);
    const dDen = cur.totDen - prev.totDen;
    const rateColor = dRate >= 0 ? '#6EA980' : '#D9363E';
    P.push('<div class="rpt-sub" style="margin-top:8px">📈 <b>环比维度</b>（vs WK' + prevWk + '）</div>');
    P.push('<div class="rpt-sub">' +
      '接起率 ' + (prev.totRate * 100).toFixed(2) + '% → <b>' + (cur.totRate * 100).toFixed(2) + '%</b>' +
      '（<span style="color:' + rateColor + ';font-weight:600">' + (dRate >= 0 ? '↑' : '↓') + ' ' + (Math.abs(dRate) * 100).toFixed(2) + 'pp</span>）；' +
      'Miss 量 ' + (prev.totDen - prev.totNum) + ' → <b>' + (cur.totDen - cur.totNum) + '</b>（' + (dMiss >= 0 ? '↑' : '↓') + ' ' + Math.abs(dMiss) + '）；' +
      '人工服务量 ' + prev.totDen + ' → <b>' + cur.totDen + '</b>（' + (dDen >= 0 ? '↑' : '↓') + ' ' + Math.abs(dDen) + '）。' +
    '</div>');
    if (cur.hasFc && prev.hasFc && prev.totFc > 0 && cur.totFc > 0) {
      P.push('<div class="rpt-sub">预测量 ' + fmtInt(prev.totFc) + ' → <b>' + fmtInt(cur.totFc) + '</b>（' + ((cur.totFc - prev.totFc) >= 0 ? '↑ ' : '↓ ') + Math.abs(cur.totFc - prev.totFc) + '）；' +
        '预测偏差 ' + (prev.totBias != null ? (prev.totBias * 100).toFixed(1) + '%' : '—') + ' → <b>' + (cur.totBias != null ? (cur.totBias * 100).toFixed(1) + '%' : '—') + '</b>。</div>');
    }
  }

  if (!cur.hit) {
    P.push('<div class="rpt-sub" style="margin-top:8px">💡 <b>改进建议</b></div>');
    const sg = [];
    const badFc = (cur.totBias != null && cur.totBias > 1.2);

    if (badFc) {
      sg.push('<b>【预测与容量】</b>本周实际服务量超预测量 <b>' + ((cur.totBias - 1) * 100).toFixed(1) + '%</b>，' +
        '建议：① 复核预测模型近期是否有结构性偏差（活动、季节性、投放）；' +
        '② 建立「预测偏差 > 120%」的自动预警，提前 1~2 天触发排班弹性加人。');
    }

    if (cur.periods.length) {
      const top3 = cur.periods.slice().sort((a, b) => b.miss - a.miss).slice(0, 3).filter(p => p.den >= 30);
      if (top3.length) {
        const overInTop = top3.filter(p => p.bias != null && p.bias > 1.2).map(p => p.period + '时');
        let s = '重点时段【' + top3.map(p => p.period + '时').join('、') + '】Miss 量最高，建议加强排班密度、预留应急坐席，并检查该时段是否存在系统/网络异常。';
        if (overInTop.length) s += ' 其中【' + overInTop.join('、') + '】属超预测时段，应优先纳入弹性排班名单。';
        sg.push(s);
      }
    }
    if (cur.days.length) {
      const worstDay = cur.days.filter(d => d.rate != null).sort((a, b) => a.rate - b.rate)[0];
      if (worstDay && !worstDay.hit) {
        let s = '【' + worstDay.date + '（周' + weekdayOf(worstDay.date) + '）】接起率最低（' + (worstDay.rate * 100).toFixed(2) + '%），需复盘当日排班、突发量或系统稳定性。';
        if (worstDay.bias != null && worstDay.bias > 1.2) s += ' 当日整体偏差 ' + (worstDay.bias * 100).toFixed(0) + '%，属量超预期情形。';
        sg.push(s);
      }
    }
    if (cur.emps.length) {
      const low = cur.emps.filter(e => e.den >= 20 && e.rate < th - 0.02).sort((a, b) => a.rate - b.rate).slice(0, 3);
      if (low.length) sg.push('【' + low.map(e => e.name).join('、') + '】等员工接起率明显低于目标，建议针对性话术/系统操作培训，必要时一对一辅导。');
    }
    if (cur.gapNum != null && cur.gapNum > 0) {
      let s = '按「（接起量 + 缺口）/（服务量 + 缺口）= ' + thPct + '%」测算，需至少多接起 <b>' + cur.gapNum + ' 单</b>才能达标；若服务量继续增长，需同步扩大接起能力。';
      if (badFc) s += '（本周已出现超预测，扩容需以偏差率为基准，避免按预测值安排。）';
      sg.push(s);
    }
    sg.forEach((s, i) => P.push('<div class="rpt-sub">' + (i + 1) + '. ' + s + '</div>'));
  }

  return P.join('');
}

function s30AnalysisText(biz, wk, prevWk) {
  const cur = s30AnalysisData(biz, wk);
  if (!cur) return [];
  const th = cur.th;
  const thPct = (th * 100).toFixed(2);
  const L = [];

  L.push('### 🔍 30S 接起率 多维度归因分析');
  L.push('');

  if (cur.hit) {
    L.push('- 本周 30S 接起率 **' + (cur.totRate * 100).toFixed(2) + '%** 已达标（目标 ≥ ' + thPct + '%）。');
  } else {
    const gapPp = (th - cur.totRate) * 100;
    const gapTxt = (cur.gapNum != null)
      ? '；按「（接起量 + 缺口）/（服务量 + 缺口）= ' + thPct + '%」测算，接起率缺口为 **' + cur.gapNum + ' 单**才能达标'
      : '；目标值 ≥ 100%，无法通过增加接起量达成';
    L.push('- ⚠ 本周 30S 接起率 **' + (cur.totRate * 100).toFixed(2) + '%** 低于目标 **' + thPct + '%**，差距 **' + gapPp.toFixed(2) + 'pp**' + gapTxt + '。');
  }
  L.push('');

  if (cur.hasFc && cur.totFc > 0) {
    L.push('**📊 预测量级维度**'); L.push('');
    L.push('- 预测量合计：**' + cur.totFc + '** 单');
    L.push('- 实际人工服务量：**' + cur.totDen + '** 单');
    L.push('- 预测偏差（实际/预测）：**' + (cur.totBias != null ? (cur.totBias * 100).toFixed(2) + '%' : '—') + '**' +
      (cur.totBias != null && cur.totBias > 1.2 ? '（超出预测）' : cur.totBias != null && cur.totBias < 1.0 ? '（低于预测）' : '（接近预测）'));
    L.push('- 预测覆盖率（实际有预测的记录占比）：**' + (cur.fcCoverRate * 100).toFixed(1) + '%**');
    L.push('');
    const bk = cur.fcBuckets;
    const totalMissFc = bk.over.miss + bk.near.miss + bk.under.miss;
    L.push('| 偏差分档 | 切片数 | Miss 量 | Miss 占比 |');
    L.push('| --- | ---: | ---: | ---: |');
    L.push('| 超预测（>120%） | ' + bk.over.cnt + ' | ' + bk.over.miss + ' | ' + (totalMissFc > 0 ? (bk.over.miss / totalMissFc * 100).toFixed(1) + '%' : '—') + ' |');
    L.push('| 接近预测（100% ~ 120%） | ' + bk.near.cnt + ' | ' + bk.near.miss + ' | ' + (totalMissFc > 0 ? (bk.near.miss / totalMissFc * 100).toFixed(1) + '%' : '—') + ' |');
    L.push('| 低于预测（<100%） | ' + bk.under.cnt + ' | ' + bk.under.miss + ' | ' + (totalMissFc > 0 ? (bk.under.miss / totalMissFc * 100).toFixed(1) + '%' : '—') + ' |');
    L.push('');
    const overSlices = cur.fcSlices
      .map(o => Object.assign({}, o, { bias: o.den / o.forecast, miss: o.den - o.num }))
      .filter(o => o.bias > 1.2 && o.miss > 0)
      .sort((a, b) => b.miss - a.miss).slice(0, 3);
    if (overSlices.length) {
      L.push('超预测且 Miss>0 的日期×时段 TOP3：');
      for (const o of overSlices) {
        L.push('- ' + o.date.slice(5) + ' ' + o.period + ' 时 · 预测 ' + Math.round(o.forecast) + ' / 实际 ' + Math.round(o.den) +
          '（偏差 ' + (o.bias * 100).toFixed(0) + '%）· Miss ' + o.miss);
      }
      L.push('');
    }
    const overShare = totalMissFc > 0 ? bk.over.miss / totalMissFc : 0;
    const nearShare = totalMissFc > 0 ? bk.near.miss / totalMissFc : 0;
    const badFc = (cur.totBias != null && cur.totBias > 1.2);
    let insight;
    if (badFc && overShare >= 0.5) {
      insight = '🔎 **推断：量级超预测是主因。**本周实际服务量超预测量 ' + ((cur.totBias - 1) * 100).toFixed(1) + '%，Miss 的 ' + (overShare * 100).toFixed(1) + '% 集中在超预测时段。';
    } else if (!badFc && nearShare >= 0.5) {
      insight = '🔎 **推断：接起能力（非量级）是主因。**实际服务量与预测量基本吻合，但 Miss 的 ' + (nearShare * 100).toFixed(1) + '% 集中在与预测一致的时段。';
    } else if (badFc) {
      insight = '🔎 **推断：量级与能力双重因素。**实际服务量超预测 ' + ((cur.totBias - 1) * 100).toFixed(1) + '%，Miss 分布同时受量级和能力影响。';
    } else {
      insight = '🔎 **推断：量级正常，需关注能力侧。**实际服务量 ' + (cur.totBias != null ? (cur.totBias * 100).toFixed(0) + '%' : '—') + ' 于预测。';
    }
    L.push(insight);
    L.push('');
  }

  if (cur.hasFc && cur.fcSlices && cur.fcSlices.length) {
    const impacts = computeOverForecastImpactDetail(cur);
    if (impacts.length) {
      const totalMiss = impacts.reduce((s, x) => s + x.miss, 0);
      L.push('**🎯 日度时段超预测影响值**（仅统计超预测 >120% 且时段接起率不达标的切片；将 Miss 回补至 30S 接起量后重算日 / 周接起率，影响值 = 回补后接起率 − 实际接起率）');
      L.push('');
      L.push('- 符合条件时段共 **' + impacts.length + '** 个，累计 Miss **' + totalMiss + '** 单');
      L.push('- 负值表示该时段拉低整体接起率');
      L.push('');
      L.push('| 排名 | 日期 × 时段 | 预测量 | 实际量 | 超预测率 | Miss | 时段接起率 | 日度影响值 | 周度影响值 |');
      L.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
      for (let i = 0; i < impacts.length; i++) {
        const x = impacts[i];
        const dayDisp = (x.dayImpact >= 0 ? '+' : '') + (x.dayImpact * 100).toFixed(2) + 'pp';
        const weekDisp = (x.weekImpact >= 0 ? '+' : '') + (x.weekImpact * 100).toFixed(2) + 'pp';
        L.push('| ' + (i + 1) + ' | ' + x.date.slice(5) + ' ' + x.period + '时 | ' + Math.round(x.forecast) +
          ' | ' + Math.round(x.den) + ' | ' + (x.bias * 100).toFixed(1) + '% | ' + x.miss +
          ' | ' + (x.rate * 100).toFixed(2) + '% | ' + dayDisp + ' | ' + weekDisp + ' |');
      }
      L.push('');

      const totalMissAll = impacts.reduce((s, x) => s + x.miss, 0);
      const newWeekRate  = (cur.totNum + totalMissAll) / cur.totDen;
      const totalImpact  = newWeekRate - cur.totRate;
      const worst        = impacts[0];
      const top3Miss     = impacts.slice(0, 3).reduce((s, x) => s + x.miss, 0);
      const top3Pct      = totalMissAll > 0 ? (top3Miss / totalMissAll * 100).toFixed(1) : '0';
      L.push('📌 **一句话总结：** 本周共 **' + impacts.length + '** 个「超预测且接起不达标」的时段（累计 Miss **' + totalMissAll + '** 单，其中 TOP3 时段贡献 **' + top3Pct + '%**）；若将这些 Miss 全部回补至接起量，周度 30S 接起率将从 **' + (cur.totRate * 100).toFixed(2) + '%** 提升至 **' + (newWeekRate * 100).toFixed(2) + '%**，即超预测对周度接起率的拖累约 **' + (totalImpact * 100).toFixed(2) + 'pp**；影响最大的时段为 **' + worst.date.slice(5) + ' ' + worst.period + '时**（偏差 ' + (worst.bias * 100).toFixed(0) + '%，Miss ' + worst.miss + '，周度影响 **' + (worst.weekImpact * 100).toFixed(2) + 'pp**）。');
      L.push('');
    }
  }

  if (cur.days.length) {
    L.push('**📅 日期维度**'); L.push('');
    L.push('| 日期 | 接起率 | Miss 量 | 预测量 | 预测偏差 | 是否达标 |');
    L.push('| --- | ---: | ---: | ---: | ---: | :---: |');
    for (const d of cur.days) {
      L.push('| ' + d.date.slice(5) + ' 周' + weekdayOf(d.date) + ' | ' + (d.rate != null ? (d.rate * 100).toFixed(2) + '%' : '—') +
        ' | ' + d.miss +
        ' | ' + (d.hasFc ? Math.round(d.forecast) : '—') +
        ' | ' + (d.bias != null ? (d.bias * 100).toFixed(0) + '%' : '—') +
        ' | ' + (d.hit ? '✅' : '❌') + ' |');
    }
    L.push('');
  }

  if (cur.periods.length) {
    L.push('**⏰ 时段维度**（按 Miss 量降序 TOP5）'); L.push('');
    L.push('| 时段 | 人工服务量 | Miss 量 | 接起率 | 预测量 | 预测偏差 |');
    L.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    const sortedP = cur.periods.slice().sort((a, b) => b.miss - a.miss).slice(0, 5);
    for (const p of sortedP) {
      L.push('| ' + p.period + ' 时 | ' + p.den + ' | ' + p.miss + ' | ' + (p.rate * 100).toFixed(2) + '%' +
        ' | ' + (p.hasFc ? Math.round(p.forecast) : '—') +
        ' | ' + (p.bias != null ? (p.bias * 100).toFixed(0) + '%' : '—') + ' |');
    }
    L.push('');
  }

  if (cur.emps.length) {
    L.push('**👤 员工维度**（按 Miss 量降序 TOP5）'); L.push('');
    L.push('| 排名 | 员工 | 人工服务量 | Miss 量 | 接起率 |');
    L.push('| ---: | --- | ---: | ---: | ---: |');
    cur.emps.slice(0, 5).forEach((e, i) => {
      const emp = getEmp(e.name);
      const grp = emp ? (emp.group || '—') : '—';
      L.push('| ' + (i + 1) + ' | ' + e.name + '（' + grp + '） | ' + e.den + ' | ' + e.miss + ' | ' + (e.rate * 100).toFixed(2) + '% |');
    });
    L.push('');
  }

  const prev = s30AnalysisData(biz, prevWk);
  if (prev && prev.totDen > 0) {
    const dRate = cur.totRate - prev.totRate;
    const dMiss = (cur.totDen - cur.totNum) - (prev.totDen - prev.totNum);
    const dDen = cur.totDen - prev.totDen;
    L.push('**📈 环比维度**（vs WK' + prevWk + '）'); L.push('');
    L.push('- 接起率：' + (prev.totRate * 100).toFixed(2) + '% → **' + (cur.totRate * 100).toFixed(2) + '%**（' + (dRate >= 0 ? '↑' : '↓') + ' ' + (Math.abs(dRate) * 100).toFixed(2) + 'pp）');
    L.push('- Miss 量：' + (prev.totDen - prev.totNum) + ' → **' + (cur.totDen - cur.totNum) + '**（' + (dMiss >= 0 ? '↑' : '↓') + ' ' + Math.abs(dMiss) + '）');
    L.push('- 人工服务量：' + prev.totDen + ' → **' + cur.totDen + '**（' + (dDen >= 0 ? '↑' : '↓') + ' ' + Math.abs(dDen) + '）');
    if (cur.hasFc && prev.hasFc && prev.totFc > 0 && cur.totFc > 0) {
      L.push('- 预测量：' + prev.totFc + ' → **' + cur.totFc + '**（' + ((cur.totFc - prev.totFc) >= 0 ? '↑ ' : '↓ ') + Math.abs(cur.totFc - prev.totFc) + '）');
      L.push('- 预测偏差：' + (prev.totBias != null ? (prev.totBias * 100).toFixed(1) + '%' : '—') + ' → **' + (cur.totBias != null ? (cur.totBias * 100).toFixed(1) + '%' : '—') + '**');
    }
    L.push('');
  }

  if (!cur.hit) {
    L.push('**💡 改进建议**'); L.push('');
    const sg = [];
    const badFc = (cur.totBias != null && cur.totBias > 1.2);

    if (badFc) {
      sg.push('【预测与容量】本周实际服务量超预测量 **' + ((cur.totBias - 1) * 100).toFixed(1) + '%**，' +
        '建议：① 复核预测模型近期是否有结构性偏差（活动、季节性、投放）；' +
        '② 建立「预测偏差 > 120%」的自动预警，提前 1~2 天触发排班弹性加人。');
    }
    if (cur.periods.length) {
      const top3 = cur.periods.slice().sort((a, b) => b.miss - a.miss).slice(0, 3).filter(p => p.den >= 30);
      if (top3.length) {
        const overInTop = top3.filter(p => p.bias != null && p.bias > 1.2).map(p => p.period + '时');
        let s = '重点时段【' + top3.map(p => p.period + '时').join('、') + '】Miss 量最高，建议加强排班密度、预留应急坐席，并检查该时段是否存在系统/网络异常。';
        if (overInTop.length) s += ' 其中【' + overInTop.join('、') + '】属超预测时段，应优先纳入弹性排班名单。';
        sg.push(s);
      }
    }
    if (cur.days.length) {
      const worstDay = cur.days.filter(d => d.rate != null).sort((a, b) => a.rate - b.rate)[0];
      if (worstDay && !worstDay.hit) {
        let s = '【' + worstDay.date + '（周' + weekdayOf(worstDay.date) + '）】接起率最低（' + (worstDay.rate * 100).toFixed(2) + '%），需复盘当日排班、突发量或系统稳定性。';
        if (worstDay.bias != null && worstDay.bias > 1.2) s += ' 当日整体偏差 ' + (worstDay.bias * 100).toFixed(0) + '%，属量超预期情形。';
        sg.push(s);
      }
    }
    if (cur.emps.length) {
      const low = cur.emps.filter(e => e.den >= 20 && e.rate < th - 0.02).sort((a, b) => a.rate - b.rate).slice(0, 3);
      if (low.length) sg.push('【' + low.map(e => e.name).join('、') + '】等员工接起率明显低于目标，建议针对性话术/系统操作培训，必要时一对一辅导。');
    }
    if (cur.gapNum != null && cur.gapNum > 0) {
      let s = '按「（接起量 + 缺口）/（服务量 + 缺口）= ' + thPct + '%」测算，需至少多接起 **' + cur.gapNum + ' 单**才能达标；若服务量继续增长，需同步扩大接起能力。';
      if (badFc) s += '（本周已出现超预测，扩容需以偏差率为基准，避免按预测值安排。）';
      sg.push(s);
    }
    sg.forEach((s, i) => L.push((i + 1) + '. ' + s));
    L.push('');
  }

  return L;
}

function buildReport(biz, wk) {
  const src = bizToSrc(biz);
  const prevWk = wk - 1;
  const month = S.month;
  const monthLabel = month ? parseInt(month.slice(5,7),10) + '月' : '月度';
  const targets = getTargets(biz);
  const wkSet = new Set([wk]); const prevSet = new Set([prevWk]); const monthSet = new Set([month]);
  const weekCur  = calcBySrc(src, { wkSet });
  const weekPrev = calcBySrc(src, { wkSet: prevSet });
  const monthCur = calcBySrc(src, { monthSet });
  const s30wCur  = calcByL1(biz, { wkSet });
  const s30wPrev = calcByL1(biz, { wkSet: prevSet });
  const s30mCur  = calcByL1(biz, { monthSet });
  const srcEmps = srcEmployeeSet(src);
  const emps = S.roster.filter(e => srcEmps.has(e.name));
  const byCat = {};
  for (const cat of ['首月','次月','老人']) {
    const names = emps.filter(e => (categoryOf(e, month) || '').includes(cat)).map(e => e.name);
    if (!names.length) { byCat[cat] = null; continue; }
    const nameSet = new Set(names);
    byCat[cat] = { count: names.length, weekCur: calcBySrc(src, { wkSet, nameSet }), weekPrev: calcBySrc(src, { wkSet: prevSet, nameSet }) };
  }
  const dayRows = [];
  for (let i = 0; i < 7; i++) {
    const day = dateAdd(wkStartDate(wk), i);
    if (!day) continue;
    dayRows.push({ day, cur: calcBySrc(src, { dateSet: new Set([day]) }) });
  }
  const allEmps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));
  const groupMap = {};
  for (const e of allEmps) { const g = e.group || '—'; (groupMap[g] = groupMap[g] || []).push(e.name); }
  const groups = Object.keys(groupMap).sort().map(g => {
    const nameSet = new Set(groupMap[g]);
    const c = calcBySrc(src, { nameSet, wkSet });
    if (c.caseVolume === 0) return null;
    return { name: g, count: nameSet.size, cur: c, prev: calcBySrc(src, { nameSet, wkSet: prevSet }) };
  }).filter(Boolean);
  const empRows = allEmps.map(e => {
    const nameSet = new Set([e.name]);
    return { name: e.name, group: e.group || '—', cur: calcBySrc(src, { nameSet, wkSet }), prev: calcBySrc(src, { nameSet, wkSet: prevSet }) };
  }).filter(x => x.cur.caseVolume > 0);
  const att = attendanceByWeek(allEmps, wk);
  return {
    biz, src, wk, prevWk, month, monthLabel,
    week:  { cur: weekCur,  prev: weekPrev },
    month: { cur: monthCur },
    s30:   { week: { cur: s30wCur, prev: s30wPrev }, month: { cur: s30mCur } },
    byCat,
    schedule: { week: bizAttendanceCount(biz, wk), prev: bizAttendanceCount(biz, prevWk) },
    aht2: aht2ByWeek(biz, wk),
    targets,
    range: [wkStartDate(wk), wkEndDate(wk)],
    dayRows, groups, emps: empRows, att,
    cur: weekCur, prev: weekPrev,
    s30Cur: s30wCur, s30Prev: s30wPrev,
  };
}

function reportHTML(d) {
  const { biz, wk, prevWk, monthLabel, week, s30, byCat, schedule, aht2, targets, range, dayRows, groups, emps, att } = d;
  const cur = week.cur, prev = week.prev, mCur = d.month.cur;
  const tgt = targets || {};
  const reasons = JSON.parse(localStorage.getItem('creator_aht2_reason') || '{}');
  const src = d.src;
  const P = [];

  P.push('<div class="rp-wrap"><div class="rp-head"><h2>📄 ' + esc(biz) + ' · 数据周报</h2><div class="rp-meta">' +
    '<span>周次：<b>WK' + wk + '</b>（' + range[0] + ' ~ ' + range[1] + '）</span>' +
    '<span>对比：<b>WK' + prevWk + '</b></span>' +
    '<span>生成：' + new Date().toLocaleString('zh-CN') + '</span>' +
  '</div></div>');

  P.push('<div class="rp-section"><h3>一、周报数据汇报</h3><div class="rpt-body">');
  P.push('<h4 class="sub-title">📊 核心指标</h4>');
  {
    const hasPrev = prev.caseVolume > 0;
    const cards = METRICS.map(m => {
      const v = cur[m.key];
      const p = hasPrev ? prev[m.key] : null;
      let dHtml = '<span class="delta-flat">—</span>';
      let badge = '<span class="rp-badge flat">—</span>';
      if (v != null && p != null && isFinite(v) && isFinite(p)) {
        const dv = v - p;
        if (Math.abs(dv) < 1e-9) { dHtml = '<span class="delta-flat">0</span>'; badge = '<span class="rp-badge flat">持平</span>'; }
        else {
          const up = dv > 0;
          const good = m.better === 'up' ? up : !up;
          const s = m.pct ? (Math.abs(dv) * 100).toFixed(m.digits) + '%' : Math.abs(dv).toFixed(m.digits);
          dHtml = '<span class="' + (good ? 'delta-up' : 'delta-down') + '">' + (up ? '↑' : '↓') + ' ' + s + '</span>';
          badge = good ? '<span class="rp-badge ok">向好</span>' : '<span class="rp-badge warn">走弱</span>';
        }
      }
      return '<div class="rp-kpi"><div class="k">' + esc(metricLabel(m)) + '</div><div class="v">' + fmtVal(v, m) + '</div><div class="d">' + dHtml + ' ' + badge + '</div></div>';
    }).join('');
    P.push('<div class="rp-kpis">' + cards + '</div>');
  }
  if (dayRows && dayRows.length) {
    P.push('<h4 class="sub-title">📅 本周每日趋势</h4>');
    const rows = dayRows.map(x => {
      const c = x.cur;
      return '<tr><td>' + x.day.slice(5) + ' 周' + weekdayOf(x.day) + '</td><td>' + fmtInt(c.caseVolume) + '</td><td>' + fmtVal(c.cpd, METRIC_MAP.cpd) + '</td><td>' + fmtVal(c.aht, METRIC_MAP.aht) + '</td><td>' + fmtVal(c.solveRate, METRIC_MAP.solveRate) + '</td><td>' + fmtVal(c.satisfaction, METRIC_MAP.satisfaction) + '</td></tr>';
    }).join('');
    P.push('<div class="table-scroll-x"><table class="rp-table"><thead><tr><th>日期</th><th>CASE</th><th>CPD</th><th>AHT</th><th>解决率</th><th>满意度</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }
  if (groups && groups.length) {
    P.push('<h4 class="sub-title">👥 团队表现</h4>');
    const rows = groups.map(g => {
      const c = g.cur;
      return '<tr><td>' + esc(g.name) + '</td><td>' + g.count + '</td><td>' + fmtInt(c.caseVolume) + '</td><td>' + fmtVal(c.cpd, METRIC_MAP.cpd) + '</td><td>' + fmtVal(c.aht, METRIC_MAP.aht) + '</td><td>' + fmtVal(c.concurrency, METRIC_MAP.concurrency) + '</td><td>' + fmtVal(c.solveRate, METRIC_MAP.solveRate) + '</td><td>' + fmtVal(c.satisfaction, METRIC_MAP.satisfaction) + '</td><td>' + fmtVal(c.qualityPassRate, METRIC_MAP.qualityPassRate) + '</td></tr>';
    }).join('');
    P.push('<div class="table-scroll-x"><table class="rp-table"><thead><tr><th>组别</th><th>人数</th><th>CASE</th><th>CPD</th><th>AHT</th><th>并发</th><th>解决率</th><th>满意度</th><th>质检合格率</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }
  if (emps && emps.length) {
    P.push('<h4 class="sub-title">🏆 员工榜单</h4>');
    const topCase = emps.slice().sort((a, b) => b.cur.caseVolume - a.cur.caseVolume).slice(0, 5);
    const topQual = emps.filter(e => e.cur.qualityPassRate != null && e.cur.qualityPassRate > 0).sort((a, b) => b.cur.qualityPassRate - a.cur.qualityPassRate).slice(0, 5);
    const watch = emps.filter(e => e.prev.caseVolume > 0).map(e => ({ e, dv: e.cur.caseVolume - e.prev.caseVolume })).filter(x => x.dv < 0).sort((a, b) => a.dv - b.dv).slice(0, 3);
    const listHTML = (arr, render) => arr.length ? '<ol>' + arr.map(render).join('') + '</ol>' : '<div class="empty">暂无数据</div>';
    P.push('<div class="rp-rank">' +
      '<div class="rp-rank-box"><h4>🏆 CASE 处理量 TOP5</h4>' + listHTML(topCase, e => '<li><b>' + esc(e.name) + '</b><span class="g">' + esc(e.group) + '</span> · ' + fmtInt(e.cur.caseVolume) + ' 单</li>') + '</div>' +
      '<div class="rp-rank-box"><h4>⭐ 质检合格率 TOP5</h4>' + listHTML(topQual, e => '<li><b>' + esc(e.name) + '</b><span class="g">' + esc(e.group) + '</span> · ' + (e.cur.qualityPassRate * 100).toFixed(2) + '%</li>') + '</div>' +
      '<div class="rp-rank-box"><h4>⚠️ CASE 环比降幅 TOP3</h4>' + listHTML(watch, x => '<li><b>' + esc(x.e.name) + '</b><span class="g">' + esc(x.e.group) + '</span> · <span class="down">↓ ' + fmtInt(Math.abs(x.dv)) + ' 单</span></li>') + '</div>' +
    '</div>');
  }

  if (s30.week.cur.s30Den > 0) {
    P.push('<h4 class="sub-title">📞 30S 接起</h4>');
    const th = s30Threshold(biz);
    const rate = s30.week.cur.s30Rate;
    const ok = rate != null && rate >= th;
    const prevRate = s30.week.prev.s30Den > 0 ? s30.week.prev.s30Rate : null;
    let rateD = '<span class="delta-flat">—</span>';
    if (rate != null && prevRate != null) {
      const dv = rate - prevRate;
      if (Math.abs(dv) < 1e-9) rateD = '<span class="delta-flat">持平</span>';
      else rateD = '<span class="' + (dv > 0 ? 'delta-up' : 'delta-down') + '">' + (dv > 0 ? '↑' : '↓') + ' ' + (Math.abs(dv) * 100).toFixed(2) + '%</span>';
    }
    const rateDisp = (rate != null ? (rate * 100).toFixed(2) + '%' : '—');
    const rateHtml = (rate != null && !ok) ? '<span class="rate-bad">' + rateDisp + '</span>' : rateDisp;
    P.push('<div class="rp-kpis">' +
      '<div class="rp-kpi"><div class="k">30S 接起率</div><div class="v">' + rateHtml + '</div><div class="d">' + rateD + ' ' + (ok ? '<span class="rp-badge ok">达标</span>' : '<span class="rp-badge warn">未达标</span>') + '</div></div>' +
      '<div class="rp-kpi"><div class="k">30S 接起量</div><div class="v">' + fmtInt(s30.week.cur.s30Num) + '</div></div>' +
      '<div class="rp-kpi"><div class="k">人工服务量</div><div class="v">' + fmtInt(s30.week.cur.s30Den) + '</div></div>' +
      '<div class="rp-kpi"><div class="k">30S Miss 量</div><div class="v">' + fmtInt(s30.week.cur.s30Miss) + '</div></div>' +
      '<div class="rp-kpi"><div class="k">达标阈值</div><div class="v">≥ ' + (th * 100).toFixed(2) + '%</div></div>' +
    '</div>');
    P.push(s30AnalysisHTML(biz, wk, prevWk));
  }

  if (att && att.sum > 0) {
    P.push('<h4 class="sub-title">🗓 出勤概况</h4>');
    const zeroCount = att.rows.filter(r => r.total === 0).length;
    const lowList = att.rows.filter(r => r.total > 0 && r.total < 3).sort((a, b) => a.total - b.total);
    P.push('<div class="rp-kpis">' +
      '<div class="rp-kpi"><div class="k">周出勤合计</div><div class="v">' + att.sum.toFixed(2) + ' 天</div></div>' +
      '<div class="rp-kpi"><div class="k">人均出勤</div><div class="v">' + att.avg.toFixed(2) + ' 天</div></div>' +
      '<div class="rp-kpi"><div class="k">全勤人数（≥7天）</div><div class="v">' + att.rows.filter(r => r.total >= 7).length + '</div></div>' +
      '<div class="rp-kpi"><div class="k">零出勤人数</div><div class="v">' + zeroCount + '</div></div>' +
    '</div>');
    if (lowList.length) {
      P.push('<p class="muted" style="margin-top:12px">出勤偏低（&lt; 3 天）：' + lowList.slice(0, 10).map(r => esc(r.name) + '（' + r.total.toFixed(2) + '）').join('、') + (lowList.length > 10 ? ' 等 ' + lowList.length + ' 人' : '') + '</p>');
    }
  }
  {
    P.push('<h4 class="sub-title">💡 本周结论</h4>');
    const concl = reportConclusion(d);
    P.push('<div class="rp-text">' + (concl.length ? concl.map(p => '<p>' + p + '</p>').join('') : '<p>本周暂无足够数据生成结论。</p>') + '</div>');
  }
  P.push('</div></div>');

  P.push('<div class="rp-section"><h3>二、人效部分</h3><div class="rpt-body">');

  {
    const c = cur.cpd, cp = prev.cpd, cm = mCur.cpd;
    const cpdTgt = (tgt && tgt.cpd != null) ? Number(tgt.cpd) : null;
    const dd = (c != null && cp != null) ? c - cp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    let s = '<b>①CPD：</b>' + num2(c) + '，<span class="rpt-sep">|</span> 周度WoW：' + num2(dd) + arrow;
    if (cpdTgt != null && c != null) {
      const rate = c / cpdTgt;
      const hit = c >= cpdTgt;
      s += '（周度达成率：' + pct2(rate) + '）' + (hit ? '' : '🔴（未达成）');
    }
    s += ' <span class="rpt-sep">|</span> ' + monthLabel + '目标：' + (cpdTgt != null ? num2(cpdTgt, 0) : '—') + '，' + monthLabel + '达成：' + num2(cm);
    if (cpdTgt != null && cm != null) {
      const mr = cm / cpdTgt;
      const mhit = cm >= cpdTgt;
      s += '（月度达成率：' + pct2(mr) + '）' + (mhit ? '' : '🔴（未达成）');
    }
    s += '；';
    P.push('<div class="rpt-line">' + s + '</div>');
  }

  {
    const bizShort = (biz === '博主合作') ? '博主' : '买手';
    const dv = cur.caseVolume - prev.caseVolume;
    P.push('<div class="rpt-line">本周' + bizShort + '接线量：' + fmtInt(cur.caseVolume) + '（' + fmtInt(prev.caseVolume) + '→' + fmtInt(cur.caseVolume) + '，' + dArrow(dv) + fmtInt(Math.abs(dv)) + '）</div>');

    const cBuyerN = calcBySrcAndL1(src, '买手合作', { wkSet: new Set([wk]) });
    const cBuyerP = calcBySrcAndL1(src, '买手合作', { wkSet: new Set([prevWk]) });
    const dvB = cBuyerN.caseVolume - cBuyerP.caseVolume;
    P.push('<div class="rpt-line">其中买手合作接线量：' + fmtInt(cBuyerN.caseVolume) + '（' + fmtInt(cBuyerP.caseVolume) + '→' + fmtInt(cBuyerN.caseVolume) + '，' + dArrow(dvB) + fmtInt(Math.abs(dvB)) + '）</div>');

    const cBlogN = calcBySrcAndL1(src, '博主合作', { wkSet: new Set([wk]) });
    const cBlogP = calcBySrcAndL1(src, '博主合作', { wkSet: new Set([prevWk]) });
    const dvBl = cBlogN.caseVolume - cBlogP.caseVolume;
    P.push('<div class="rpt-line">其中博主合作接线量：' + fmtInt(cBlogN.caseVolume) + '（' + fmtInt(cBlogP.caseVolume) + '→' + fmtInt(cBlogN.caseVolume) + '，' + dArrow(dvBl) + fmtInt(Math.abs(dvBl)) + '）</div>');

    const schWk = Math.round(schedule.week * 100) / 100;
    const schPrev = Math.round(schedule.prev * 100) / 100;
    const dmp = Math.round((schWk - schPrev) * 100) / 100;
    P.push('<div class="rpt-line">本周' + bizShort + '排班人力：' + schWk.toFixed(2) + '（' + schPrev.toFixed(2) + '→' + schWk.toFixed(2) + '，' + dArrow(dmp) + Math.abs(dmp).toFixed(2) + '）</div>');
  }

  for (const cat of ['老人','次月','首月']) {
    const b = byCat[cat];
    if (!b) continue;
    const cc = b.weekCur.cpd, pc = b.weekPrev.cpd;
    const dd = (cc != null && pc != null) ? cc - pc : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '↑' : '↓');
    P.push('<div class="rpt-line">' + cat + 'CPD：' + num2(cc) + '（' + num2(pc) + '→' + num2(cc) + '，' + arrow + num2(Math.abs(dd || 0)) + '）</div>');
  }

  {
    const a = cur.aht, ap = prev.aht, am = mCur.aht;
    const dd = (a != null && ap != null) ? a - ap : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    P.push('<div class="rpt-line"><b>②AHT：</b>' + num2(a) + '，<span class="rpt-sep">|</span> 周度WoW：' + num2(dd) + arrow + ' <span class="rpt-sep">|</span> ' + monthLabel + '达成：' + num2(am) + '；</div>');
  }

  {
    const c = cur.concurrency, cp = prev.concurrency, cm = mCur.concurrency;
    const dd = (c != null && cp != null) ? c - cp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    P.push('<div class="rpt-line"><b>③并发：</b>' + num2(c) + '，<span class="rpt-sep">|</span> 周度WoW：' + num2(dd) + arrow + ' <span class="rpt-sep">|</span> ' + monthLabel + '达成：' + num2(cm) + '；</div>');
  }

  for (const cat of ['老人','次月','首月']) {
    const b = byCat[cat];
    if (!b) continue;
    const cc = b.weekCur.concurrency, pc = b.weekPrev.concurrency;
    const dd = (cc != null && pc != null) ? cc - pc : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '↑' : '↓');
    P.push('<div class="rpt-line">' + cat + '并发：' + num2(cc) + '（' + num2(pc) + '→' + num2(cc) + '，' + arrow + num2(Math.abs(dd || 0)) + '）</div>');
  }

  {
    const r = s30.week.cur.s30Rate, rp = s30.week.prev.s30Rate, rm = s30.month.cur.s30Rate;
    const dd = (r != null && rp != null) ? r - rp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    const s30Tgt = s30TargetPct(biz);
    const ddPct = (v) => v == null ? '—' : ((v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%');
    const disp = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%';
    let s = '<b>④30s接起率：</b>' + disp(r) + '，<span class="rpt-sep">|</span> 周度WoW：' + ddPct(dd) + arrow;
    if (s30Tgt != null && r != null) {
      const rate = r * 100 / s30Tgt;
      const hit = rate >= 100;
      s += '（周度达成率：' + rate.toFixed(2) + '%）' + (hit ? '' : '🔴（未达成）');
    }
    s += ' <span class="rpt-sep">|</span> ' + monthLabel + '目标：' + (s30Tgt != null ? (s30Tgt * 100).toFixed(2) + '%' : '—') + '，' + monthLabel + '达成：' + disp(rm);
    if (s30Tgt != null && rm != null) {
      const mr = rm * 100 / s30Tgt;
      const mhit = mr >= 100;
      s += '（月度达成率：' + mr.toFixed(2) + '%）' + (mhit ? '' : '🔴（未达成）');
    }
    s += '；';
    P.push('<div class="rpt-line">' + s + '</div>');
  }

  {
    const c = cur.cpd, cp = prev.cpd;
    const dd = (c != null && cp != null) ? c - cp : null;
    P.push('<div class="rpt-line"><b>⑤周度：</b>' + num2(c) + '，【' + (dd == null ? '—' : (dd > 0 ? '+' : '') + dd.toFixed(2)) + '】</div>');
  }

  {
    const u = cur.utilization, up = prev.utilization;
    const du = (u != null && up != null) ? u - up : null;
    const arrow = (du == null || Math.abs(du) < 1e-9) ? '' : (du > 0 ? '↑' : '↓');
    P.push('<div class="rpt-line">本周工时利用率：' + (u != null ? (u*100).toFixed(2) + '%' : '—') + '（' + (up != null ? (up*100).toFixed(2) + '%' : '—') + '→' + (u != null ? (u*100).toFixed(2) + '%' : '—') + '，' + arrow + (du != null ? (Math.abs(du)*100).toFixed(2) + '%' : '—') + '）</div>');
  }

  /* ⑥二级AHT：新逻辑（负贡献且上升 / 正贡献且下降） */
  {
    const aNow = cur.aht, aPrev = prev.aht;
    const ahtRose = (aNow != null && aPrev != null && aNow > aPrev);
    const ahtFell = (aNow != null && aPrev != null && aNow < aPrev);
    const list = aht2.list.filter(o => o.volNow > 0 || o.volPrev > 0);
    let top3 = [];
    if (ahtRose) {
      top3 = list.filter(o =>
                o.impact != null && o.impact < 0 &&
                o.ahtNow != null && o.ahtPrev != null && o.ahtNow > o.ahtPrev
              )
              .sort((x, y) => x.impact - y.impact)
              .slice(0, 3);
    } else if (ahtFell) {
      top3 = list.filter(o =>
                o.impact != null && o.impact > 0 &&
                o.ahtNow != null && o.ahtPrev != null && o.ahtNow < o.ahtPrev
              )
              .sort((x, y) => y.impact - x.impact)
              .slice(0, 3);
    } else {
      top3 = list.filter(o => o.impact != null)
                 .sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact)).slice(0, 3);
    }
    const tag = ahtRose ? '负贡献' : (ahtFell ? '正贡献' : '影响值');
    P.push('<div class="rpt-line"><b>⑥二级AHT</b>（按影响值大小排序：当周度 AHT 上升时，展示负贡献且自身 AHT 上升的二级AHT；当周度 AHT 下降时，展示正贡献且自身 AHT 下降的二级AHT；当周度 AHT 持平，则展示影响值绝对值前三的二级AHT）</div>');
    if (!top3.length) P.push('<div class="rpt-sub">暂无数据</div>');
    else for (const o of top3) {
      const key = 'aht2r|' + wk + '|' + o.l1 + '|' + o.l2;
      const reason = reasons[key] || '';
      const dv2 = o.volNow - o.volPrev;
      const da = (o.ahtNow != null && o.ahtPrev != null) ? o.ahtNow - o.ahtPrev : null;
      const imp = o.impact;
      const impStr = imp == null ? '—' : Math.abs(imp).toFixed(2);
      P.push('<div class="rpt-sub">【' + esc(o.l2) + '】AHT达成：' + num2(o.ahtNow) + '，周度WOW：' + (da == null ? '—' : dStr(da)) + '，咨询量：(' + fmtInt(o.volPrev) + '→' + fmtInt(o.volNow) + '，' + (dv2 > 0 ? '+' : '') + fmtInt(dv2) + ')，原因：<input class="rpt-input" type="text" data-key="' + esc(key) + '" value="' + esc(reason) + '" placeholder="填写原因">，' + tag + '：' + impStr + '；</div>');
    }
  }

  P.push('</div></div>');

  P.push('<div class="rp-section"><h3>三、质量部分</h3><div class="rpt-body">');
  P.push('<div class="rpt-line">' + metricLineHTML('① 解决率：', cur.solveRate, prev.solveRate, mCur.solveRate, METRIC_MAP.solveRate, tgt, monthLabel) + '</div>');
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { P.push('<div class="rpt-sub">' + cat + '解决率：—</div>'); continue; }
    P.push(catLineHTML(cat + '解决率', b.weekCur.solveRate, b.weekPrev.solveRate, METRIC_MAP.solveRate));
  }
  P.push('<div class="rpt-line">' + metricLineHTML('② 满意度：', cur.satisfaction, prev.satisfaction, mCur.satisfaction, METRIC_MAP.satisfaction, tgt, monthLabel) + '</div>');
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { P.push('<div class="rpt-sub">' + cat + '满意度：—</div>'); continue; }
    P.push(catLineHTML(cat + '满意度', b.weekCur.satisfaction, b.weekPrev.satisfaction, METRIC_MAP.satisfaction));
  }
  P.push('<div class="rpt-line">' + metricLineHTML('③ 质检合格率：', cur.qualityPassRate, prev.qualityPassRate, mCur.qualityPassRate, METRIC_MAP.qualityPassRate, tgt, monthLabel) + '</div>');
  {
    const inspNow  = inspectionStats({ src, wkSet: new Set([wk]) });
    const inspPrev = inspectionStats({ src, wkSet: new Set([prevWk]) });
    const dTotal = inspNow.total - inspPrev.total;
    const dPass  = inspNow.pass - inspPrev.pass;
    const dFail  = inspNow.fail - inspPrev.fail;
    P.push('<div class="rpt-sub">本周抽检量：' + fmtInt(inspNow.total) + '，（' + fmtInt(inspPrev.total) + '→' + fmtInt(inspNow.total) + '，' + dArrow(dTotal) + fmtInt(Math.abs(dTotal)) + '）</div>');
    P.push('<div class="rpt-sub">合格量：' + fmtInt(inspNow.pass) + '，（' + fmtInt(inspPrev.pass) + '→' + fmtInt(inspNow.pass) + '，' + dArrow(dPass) + fmtInt(Math.abs(dPass)) + '）</div>');
    P.push('<div class="rpt-sub">不合格量：' + fmtInt(inspNow.fail) + '，（' + fmtInt(inspPrev.fail) + '→' + fmtInt(inspNow.fail) + '，' + dArrow(dFail) + fmtInt(Math.abs(dFail)) + '）</div>');
  }
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { P.push('<div class="rpt-sub">' + cat + '质检合格率：—</div>'); continue; }
    P.push(catLineHTML(cat + '质检合格率', b.weekCur.qualityPassRate, b.weekPrev.qualityPassRate, METRIC_MAP.qualityPassRate));
  }
  P.push('</div></div>');
  P.push('</div>');
  return P.join('');
}

function reportToText(d) {
  const { biz, wk, prevWk, monthLabel, week, s30, byCat, schedule, aht2, targets, range, dayRows, groups, emps, att } = d;
  const cur = week.cur, prev = week.prev, mCur = d.month.cur;
  const tgt = targets || {};
  const reasons = JSON.parse(localStorage.getItem('creator_aht2_reason') || '{}');
  const src = d.src;
  const L = [];

  L.push('# ' + biz + ' 数据周报'); L.push('');
  L.push('周次：WK' + wk + '（' + range[0] + ' ~ ' + range[1] + '），对比：WK' + prevWk);
  L.push('生成时间：' + new Date().toLocaleString('zh-CN')); L.push('');

  L.push('## 一、周报数据汇报'); L.push('');
  L.push('### 📊 核心指标'); L.push('');
  L.push('| 指标 | 本周 | 上周 | 环比 |');
  L.push('| --- | ---: | ---: | ---: |');
  { const hasPrev = prev.caseVolume > 0;
    for (const m of METRICS) {
      const v = cur[m.key];
      const p = hasPrev ? prev[m.key] : null;
      L.push('| ' + m.label + ' | ' + fmtVal(v, m) + ' | ' + (p != null ? fmtVal(p, m) : '—') + ' | ' + diffText(v, p, m) + ' |');
    }
  }
  L.push('');
  if (dayRows && dayRows.length) {
    L.push('### 📅 本周每日趋势'); L.push('');
    L.push('| 日期 | CASE | CPD | AHT | 解决率 | 满意度 |');
    L.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const x of dayRows) {
      const c = x.cur;
      L.push('| ' + x.day.slice(5) + ' 周' + weekdayOf(x.day) + ' | ' + fmtInt(c.caseVolume) + ' | ' + fmtVal(c.cpd, METRIC_MAP.cpd) + ' | ' + fmtVal(c.aht, METRIC_MAP.aht) + ' | ' + fmtVal(c.solveRate, METRIC_MAP.solveRate) + ' | ' + fmtVal(c.satisfaction, METRIC_MAP.satisfaction) + ' |');
    }
    L.push('');
  }
  if (groups && groups.length) {
    L.push('### 👥 团队表现'); L.push('');
    L.push('| 组别 | 人数 | CASE | CPD | AHT | 并发 | 解决率 | 满意度 | 质检合格率 |');
    L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const g of groups) {
      const c = g.cur;
      L.push('| ' + g.name + ' | ' + g.count + ' | ' + fmtInt(c.caseVolume) + ' | ' + fmtVal(c.cpd, METRIC_MAP.cpd) + ' | ' + fmtVal(c.aht, METRIC_MAP.aht) + ' | ' + fmtVal(c.concurrency, METRIC_MAP.concurrency) + ' | ' + fmtVal(c.solveRate, METRIC_MAP.solveRate) + ' | ' + fmtVal(c.satisfaction, METRIC_MAP.satisfaction) + ' | ' + fmtVal(c.qualityPassRate, METRIC_MAP.qualityPassRate) + ' |');
    }
    L.push('');
  }
  if (emps && emps.length) {
    L.push('### 🏆 员工榜单'); L.push('');
    const topCase = emps.slice().sort((a, b) => b.cur.caseVolume - a.cur.caseVolume).slice(0, 5);
    const topQual = emps.filter(e => e.cur.qualityPassRate != null && e.cur.qualityPassRate > 0).sort((a, b) => b.cur.qualityPassRate - a.cur.qualityPassRate).slice(0, 5);
    const watch = emps.filter(e => e.prev.caseVolume > 0).map(e => ({ e, dv: e.cur.caseVolume - e.prev.caseVolume })).filter(x => x.dv < 0).sort((a, b) => a.dv - b.dv).slice(0, 3);
    L.push('**🏆 CASE 处理量 TOP5**'); L.push('');
    if (topCase.length) topCase.forEach((e, i) => L.push((i + 1) + '. ' + e.name + '（' + e.group + '）— ' + fmtInt(e.cur.caseVolume) + ' 单'));
    else L.push('暂无数据');
    L.push('');
    L.push('**⭐ 质检合格率 TOP5**'); L.push('');
    if (topQual.length) topQual.forEach((e, i) => L.push((i + 1) + '. ' + e.name + '（' + e.group + '）— ' + (e.cur.qualityPassRate * 100).toFixed(2) + '%'));
    else L.push('暂无数据');
    L.push('');
    L.push('**⚠️ CASE 环比降幅 TOP3**'); L.push('');
    if (watch.length) watch.forEach((x, i) => L.push((i + 1) + '. ' + x.e.name + '（' + x.e.group + '）— ↓ ' + fmtInt(Math.abs(x.dv)) + ' 单'));
    else L.push('暂无数据');
    L.push('');
  }
  if (s30.week.cur.s30Den > 0) {
    L.push('### 📞 30S 接起'); L.push('');
    const th = s30Threshold(biz);
    const rate = s30.week.cur.s30Rate;
    L.push('- 30S 接起率：' + (rate != null ? (rate * 100).toFixed(2) + '%' : '—') + '（阈值 ≥ ' + (th * 100).toFixed(2) + '%，' + (rate != null && rate >= th ? '达标' : '未达标') + '）');
    L.push('- 30S 接起量：' + fmtInt(s30.week.cur.s30Num));
    L.push('- 人工服务量：' + fmtInt(s30.week.cur.s30Den));
    L.push('- 30S Miss 量：' + fmtInt(s30.week.cur.s30Miss));
    L.push('');
    const anal = s30AnalysisText(biz, wk, prevWk);
    if (anal.length) { for (const ln of anal) L.push(ln); }
    L.push('');
  }
  if (att && att.sum > 0) {
    L.push('### 🗓 出勤概况'); L.push('');
    L.push('- 周出勤合计：' + att.sum.toFixed(2) + ' 天');
    L.push('- 人均出勤：' + att.avg.toFixed(2) + ' 天');
    L.push('- 全勤人数（≥7天）：' + att.rows.filter(r => r.total >= 7).length);
    L.push('- 零出勤人数：' + att.rows.filter(r => r.total === 0).length);
    const lowList = att.rows.filter(r => r.total > 0 && r.total < 3).sort((a, b) => a.total - b.total);
    if (lowList.length) L.push('- 出勤偏低（< 3 天）：' + lowList.slice(0, 10).map(r => r.name + '（' + r.total.toFixed(2) + '）').join('、') + (lowList.length > 10 ? ' 等 ' + lowList.length + ' 人' : ''));
    L.push('');
  }
  {
    L.push('### 💡 本周结论'); L.push('');
    const concl = reportConclusion(d);
    if (concl.length) { for (const p of concl) L.push('- ' + p.replace(/<[^>]+>/g, '')); }
    else L.push('本周暂无足够数据生成结论。');
    L.push('');
  }

  L.push('## 二、人效部分'); L.push('');

  {
    const c = cur.cpd, cp = prev.cpd, cm = mCur.cpd;
    const cpdTgt = (tgt && tgt.cpd != null) ? Number(tgt.cpd) : null;
    const dd = (c != null && cp != null) ? c - cp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    let s = '①CPD：' + num2(c) + '，| 周度WoW：' + num2(dd) + arrow;
    if (cpdTgt != null && c != null) {
      const rate = c / cpdTgt;
      s += '（周度达成率：' + pct2(rate) + '）' + (c >= cpdTgt ? '' : '🔴（未达成）');
    }
    s += ' | ' + monthLabel + '目标：' + (cpdTgt != null ? num2(cpdTgt, 0) : '—') + '，' + monthLabel + '达成：' + num2(cm);
    if (cpdTgt != null && cm != null) {
      const mr = cm / cpdTgt;
      s += '（月度达成率：' + pct2(mr) + '）' + (cm >= cpdTgt ? '' : '🔴（未达成）');
    }
    s += '；';
    L.push(s);
  }

  {
    const bizShort = (biz === '博主合作') ? '博主' : '买手';
    const dv = cur.caseVolume - prev.caseVolume;
    L.push('本周' + bizShort + '接线量：' + fmtInt(cur.caseVolume) + '（' + fmtInt(prev.caseVolume) + '→' + fmtInt(cur.caseVolume) + '，' + dArrow(dv) + fmtInt(Math.abs(dv)) + '）');
    const cBuyerN = calcBySrcAndL1(src, '买手合作', { wkSet: new Set([wk]) });
    const cBuyerP = calcBySrcAndL1(src, '买手合作', { wkSet: new Set([prevWk]) });
    const dvB = cBuyerN.caseVolume - cBuyerP.caseVolume;
    L.push('其中买手合作接线量：' + fmtInt(cBuyerN.caseVolume) + '（' + fmtInt(cBuyerP.caseVolume) + '→' + fmtInt(cBuyerN.caseVolume) + '，' + dArrow(dvB) + fmtInt(Math.abs(dvB)) + '）');
    const cBlogN = calcBySrcAndL1(src, '博主合作', { wkSet: new Set([wk]) });
    const cBlogP = calcBySrcAndL1(src, '博主合作', { wkSet: new Set([prevWk]) });
    const dvBl = cBlogN.caseVolume - cBlogP.caseVolume;
    L.push('其中博主合作接线量：' + fmtInt(cBlogN.caseVolume) + '（' + fmtInt(cBlogP.caseVolume) + '→' + fmtInt(cBlogN.caseVolume) + '，' + dArrow(dvBl) + fmtInt(Math.abs(dvBl)) + '）');
    const schWk = Math.round(schedule.week * 100) / 100;
    const schPrev = Math.round(schedule.prev * 100) / 100;
    const dmp = Math.round((schWk - schPrev) * 100) / 100;
    L.push('本周' + bizShort + '排班人力：' + schWk.toFixed(2) + '（' + schPrev.toFixed(2) + '→' + schWk.toFixed(2) + '，' + dArrow(dmp) + Math.abs(dmp).toFixed(2) + '）');
  }

  for (const cat of ['老人','次月','首月']) {
    const b = byCat[cat];
    if (!b) continue;
    const cc = b.weekCur.cpd, pc = b.weekPrev.cpd;
    const dd = (cc != null && pc != null) ? cc - pc : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '↑' : '↓');
    L.push(cat + 'CPD：' + num2(cc) + '（' + num2(pc) + '→' + num2(cc) + '，' + arrow + num2(Math.abs(dd || 0)) + '）');
  }

  {
    const a = cur.aht, ap = prev.aht, am = mCur.aht;
    const dd = (a != null && ap != null) ? a - ap : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    L.push('②AHT：' + num2(a) + '，| 周度WoW：' + num2(dd) + arrow + ' | ' + monthLabel + '达成：' + num2(am) + '；');
  }

  {
    const c = cur.concurrency, cp = prev.concurrency, cm = mCur.concurrency;
    const dd = (c != null && cp != null) ? c - cp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    L.push('③并发：' + num2(c) + '，| 周度WoW：' + num2(dd) + arrow + ' | ' + monthLabel + '达成：' + num2(cm) + '；');
  }

  for (const cat of ['老人','次月','首月']) {
    const b = byCat[cat];
    if (!b) continue;
    const cc = b.weekCur.concurrency, pc = b.weekPrev.concurrency;
    const dd = (cc != null && pc != null) ? cc - pc : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '↑' : '↓');
    L.push(cat + '并发：' + num2(cc) + '（' + num2(pc) + '→' + num2(cc) + '，' + arrow + num2(Math.abs(dd || 0)) + '）');
  }

  {
    const r = s30.week.cur.s30Rate, rp = s30.week.prev.s30Rate, rm = s30.month.cur.s30Rate;
    const dd = (r != null && rp != null) ? r - rp : null;
    const arrow = (dd == null || Math.abs(dd) < 1e-9) ? '' : (dd > 0 ? '🔺' : '🔻');
    const s30Tgt = s30TargetPct(biz);
    const ddPct = (v) => v == null ? '—' : ((v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%');
    const disp = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%';
    let s = '④30s接起率：' + disp(r) + '，| 周度WoW：' + ddPct(dd) + arrow;
    if (s30Tgt != null && r != null) {
      const rate = r * 100 / s30Tgt;
      s += '（周度达成率：' + rate.toFixed(2) + '%）' + (rate >= 100 ? '' : '🔴（未达成）');
    }
    s += ' | ' + monthLabel + '目标：' + (s30Tgt != null ? (s30Tgt * 100).toFixed(2) + '%' : '—') + '，' + monthLabel + '达成：' + disp(rm);
    if (s30Tgt != null && rm != null) {
      const mr = rm * 100 / s30Tgt;
      s += '（月度达成率：' + mr.toFixed(2) + '%）' + (mr >= 100 ? '' : '🔴（未达成）');
    }
    s += '；';
    L.push(s);
  }

  {
    const c = cur.cpd, cp = prev.cpd;
    const dd = (c != null && cp != null) ? c - cp : null;
    L.push('⑤周度：' + num2(c) + '，【' + (dd == null ? '—' : (dd > 0 ? '+' : '') + dd.toFixed(2)) + '】');
  }

  {
    const u = cur.utilization, up = prev.utilization;
    const du = (u != null && up != null) ? u - up : null;
    const arrow = (du == null || Math.abs(du) < 1e-9) ? '' : (du > 0 ? '↑' : '↓');
    L.push('本周工时利用率：' + (u != null ? (u*100).toFixed(2) + '%' : '—') + '（' + (up != null ? (up*100).toFixed(2) + '%' : '—') + '→' + (u != null ? (u*100).toFixed(2) + '%' : '—') + '，' + arrow + (du != null ? (Math.abs(du)*100).toFixed(2) + '%' : '—') + '）');
  }

  /* ⑥二级AHT：新逻辑 */
  {
    const aNow = cur.aht, aPrev = prev.aht;
    const ahtRose = (aNow != null && aPrev != null && aNow > aPrev);
    const ahtFell = (aNow != null && aPrev != null && aNow < aPrev);
    const list = aht2.list.filter(o => o.volNow > 0 || o.volPrev > 0);
    let top3 = [];
    if (ahtRose) {
      top3 = list.filter(o =>
                o.impact != null && o.impact < 0 &&
                o.ahtNow != null && o.ahtPrev != null && o.ahtNow > o.ahtPrev
              )
              .sort((x, y) => x.impact - y.impact).slice(0, 3);
    } else if (ahtFell) {
      top3 = list.filter(o =>
                o.impact != null && o.impact > 0 &&
                o.ahtNow != null && o.ahtPrev != null && o.ahtNow < o.ahtPrev
              )
              .sort((x, y) => y.impact - x.impact).slice(0, 3);
    } else {
      top3 = list.filter(o => o.impact != null)
                 .sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact)).slice(0, 3);
    }
    const tag = ahtRose ? '负贡献' : (ahtFell ? '正贡献' : '影响值');
    L.push('⑥二级AHT（按影响值大小排序：当周度 AHT 上升时，展示负贡献且自身 AHT 上升的二级AHT；当周度 AHT 下降时，展示正贡献且自身 AHT 下降的二级AHT；当周度 AHT 持平，则展示影响值绝对值前三的二级AHT）');
    if (!top3.length) L.push('暂无数据');
    else for (const o of top3) {
      const key = 'aht2r|' + wk + '|' + o.l1 + '|' + o.l2;
      const reason = reasons[key] || 'XXX';
      const dv2 = o.volNow - o.volPrev;
      const da = (o.ahtNow != null && o.ahtPrev != null) ? o.ahtNow - o.ahtPrev : null;
      const imp = o.impact;
      const impStr = imp == null ? '—' : Math.abs(imp).toFixed(2);
      L.push('- 【' + o.l2 + '】AHT达成：' + num2(o.ahtNow) + '，周度WOW：' + (da == null ? '—' : dStr(da)) + '，咨询量：(' + fmtInt(o.volPrev) + '→' + fmtInt(o.volNow) + '，' + (dv2 > 0 ? '+' : '') + fmtInt(dv2) + ')，原因：' + reason + '，' + tag + '：' + impStr + '；');
    }
  }
  L.push('');

  L.push('## 三、质量部分'); L.push('');
  L.push(metricLineText('① 解决率：', cur.solveRate, prev.solveRate, mCur.solveRate, METRIC_MAP.solveRate, tgt, monthLabel));
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { L.push(cat + '解决率：—'); continue; }
    L.push(catLineText(cat + '解决率', b.weekCur.solveRate, b.weekPrev.solveRate, METRIC_MAP.solveRate));
  }
  L.push('');
  L.push(metricLineText('② 满意度：', cur.satisfaction, prev.satisfaction, mCur.satisfaction, METRIC_MAP.satisfaction, tgt, monthLabel));
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { L.push(cat + '满意度：—'); continue; }
    L.push(catLineText(cat + '满意度', b.weekCur.satisfaction, b.weekPrev.satisfaction, METRIC_MAP.satisfaction));
  }
  L.push('');
  L.push(metricLineText('③ 质检合格率：', cur.qualityPassRate, prev.qualityPassRate, mCur.qualityPassRate, METRIC_MAP.qualityPassRate, tgt, monthLabel));
  {
    const inspNow  = inspectionStats({ src, wkSet: new Set([wk]) });
    const inspPrev = inspectionStats({ src, wkSet: new Set([prevWk]) });
    const dTotal = inspNow.total - inspPrev.total;
    const dPass  = inspNow.pass - inspPrev.pass;
    const dFail  = inspNow.fail - inspPrev.fail;
    L.push('本周抽检量：' + fmtInt(inspNow.total) + '，（' + fmtInt(inspPrev.total) + '→' + fmtInt(inspNow.total) + '，' + dArrow(dTotal) + fmtInt(Math.abs(dTotal)) + '）');
    L.push('合格量：' + fmtInt(inspNow.pass) + '，（' + fmtInt(inspPrev.pass) + '→' + fmtInt(inspNow.pass) + '，' + dArrow(dPass) + fmtInt(Math.abs(dPass)) + '）');
    L.push('不合格量：' + fmtInt(inspNow.fail) + '，（' + fmtInt(inspPrev.fail) + '→' + fmtInt(inspNow.fail) + '，' + dArrow(dFail) + fmtInt(Math.abs(dFail)) + '）');
  }
  for (const cat of ['首月','次月','老人']) {
    const b = byCat[cat];
    if (!b) { L.push(cat + '质检合格率：—'); continue; }
    L.push(catLineText(cat + '质检合格率', b.weekCur.qualityPassRate, b.weekPrev.qualityPassRate, METRIC_MAP.qualityPassRate));
  }
  L.push('');
  return L.join('\n');
}

function renderReport() {
  const el = $('#rpBody');
  if (!el) return;
  const copyBtn = $('#btnRpCopy'); const mdBtn = $('#btnRpMd');
  if (!S.records.length && !S.wtRecords.length) {
    el.innerHTML = '<p class="muted">尚未导入数据。</p>';
    if (copyBtn) copyBtn.disabled = true;
    if (mdBtn) mdBtn.disabled = true;
    return;
  }
  const bizEl = $('#rpBiz'); const wkEl = $('#rpWK');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const wkVal = wkEl ? wkEl.value : '';
  if (!wkVal) {
    el.innerHTML = '<p class="muted">暂无可用周次，请先导入含日期的数据。</p>';
    if (copyBtn) copyBtn.disabled = true;
    if (mdBtn) mdBtn.disabled = true;
    return;
  }
  const wk = parseInt(wkVal, 10) || S.latestWK;
  const d = buildReport(biz, wk);
  if (!d.week.cur.caseVolume && !d.s30.week.cur.s30Den) {
    el.innerHTML = '<p class="muted">WK' + wk + ' 暂无数据，请选择其他周次。</p>';
    if (copyBtn) copyBtn.disabled = true;
    if (mdBtn) mdBtn.disabled = true;
    return;
  }
  el.innerHTML = reportHTML(d);
  bindReportInputs();
  if (copyBtn) copyBtn.disabled = false;
  if (mdBtn) mdBtn.disabled = false;
}
function bindReportInputs() {
  const el = $('#rpBody');
  if (!el) return;
  el.querySelectorAll('.rpt-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const all = JSON.parse(localStorage.getItem('creator_aht2_reason') || '{}');
      all[inp.dataset.key] = inp.value;
      localStorage.setItem('creator_aht2_reason', JSON.stringify(all));
    });
  });
}
async function copyReport() {
  const bizEl = $('#rpBiz'); const wkEl = $('#rpWK');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const wk = parseInt(wkEl && wkEl.value, 10) || S.latestWK;
  const text = reportToText(buildReport(biz, wk));
  try { await navigator.clipboard.writeText(text); toast('✅ 周报已复制到剪贴板'); }
  catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('✅ 周报已复制到剪贴板'); }
    catch (e) { toast('❌ 复制失败，请手动选择文本'); }
    document.body.removeChild(ta);
  }
}
function downloadReportMd() {
  const bizEl = $('#rpBiz'); const wkEl = $('#rpWK');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const wk = parseInt(wkEl && wkEl.value, 10) || S.latestWK;
  const text = reportToText(buildReport(biz, wk));
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '周报-' + biz + '-WK' + wk + '.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('⬇ 已下载 Markdown 文件');
}

function refreshAll() {
  if (!S.records.length && !S.wtRecords.length && !S.inspections.length) return;
  renderOverview(); renderPerson(); renderTeam(); renderS30(); renderAHT2(); renderSLA(); renderAttendance();
  refreshExportOptions(); renderReport();
}
function initSelects() {
  for (const s of ['#ovBiz','#peBiz','#tmBiz','#s30Biz','#a2Biz','#slaBiz','#exBiz','#rpBiz']) {
    const el = $(s); if (!el) continue;
    const cur = el.value;
    el.innerHTML = BIZ_LIST.map(b => '<option>' + b + '</option>').join('');
    if (BIZ_LIST.includes(cur)) el.value = cur;
  }
  const rpWK = $('#rpWK');
  if (rpWK) {
    const cur = rpWK.value;
    const wks = allWeeks();
    rpWK.innerHTML = wks.map(w => '<option value="' + w + '">WK' + w + '（' + wkStartDate(w) + ' ~ ' + wkEndDate(w) + '）</option>').join('') || '<option value="">暂无周次</option>';
    if (cur && wks.some(w => String(w) === cur)) rpWK.value = cur;
    else if (wks.length) rpWK.value = String(wks[wks.length - 1]);
  }
  const att = $('#attName');
  if (att) {
    const cur = att.value;
    const emps = S.roster.filter(e => /一线/.test(e.attr || ''));
    if (emps.length) att.innerHTML = emps.map(e => '<option value="' + esc(e.name) + '">' + esc(e.name) + '</option>').join('');
    else att.innerHTML = '<option value="">暂无一线员工</option>';
    if (cur && emps.some(e => e.name === cur)) att.value = cur;
  }
  refreshPersonOptions(); refreshTeamOptions(); refreshExportOptions(); renderTargetConfig();
}
function bindEvents() {
  const on = (sel, evt, fn) => { const el = $(sel); if (el) el.addEventListener(evt, fn); };
  on('#tabs', 'click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    switchView(b.dataset.view);
    if (b.dataset.view === 'report') renderTargetConfig();
    if (b.dataset.view === 'sla') renderSLA();
  });
  const dz = $('#dropZone'), fi = $('#fileInput');
  if (dz && fi) {
    dz.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { if (fi.files && fi.files[0]) handleFile(fi.files[0]); fi.value = ''; });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  } else console.error('[bindEvents] 未找到 #dropZone 或 #fileInput');
  on('#hideLeft', 'change', e => { S.hidden = e.target.checked; renderRoster(); refreshAll(); });
  on('#btnReset', 'click', () => {
    if (!confirm('确定要清除已导入数据吗？（花名册离职记忆、出勤调整记录会保留）')) return;
    S.sheets = {}; S.headers = {}; S.mapping = {};
    S.roster = []; S.records = []; S.wtRecords = []; S.inspections = [];
    S.slaBuyer = []; S.slaBlogger = [];
    S.businessMap = {}; S.business2Map = {}; S.shiftMap = {}; S.schedule = {};
    S.forecastBuyer = {}; S.forecastBlogger = {};
    S.scheduleDates = []; S.month = ''; S.latestDate = ''; S.latestWK = 0;
    S.expandedRows = new Set();
    const ds = $('#dataStatus'); if (ds) { ds.textContent = '未导入'; ds.classList.remove('pill-on'); ds.classList.add('pill-off'); }
    const pw = $('#progressWrap'); if (pw) pw.classList.add('hidden');
    const is = $('#importSummary'); if (is) is.innerHTML = '';
    const mb = $('#mappingBody'); if (mb) mb.innerHTML = '';
    const rt = $('#rosterTable'); if (rt) rt.innerHTML = '';
    const ov = $('#ovBody'); if (ov) ov.innerHTML = '';
    const pb = $('#peBody'); if (pb) pb.innerHTML = '';
    const pn = $('#peNames'); if (pn) pn.innerHTML = '';
    const tb = $('#tmBody'); if (tb) tb.innerHTML = '';
    const td = $('#tmDims'); if (td) td.innerHTML = '';
    const s3 = $('#s30Top'); if (s3) s3.innerHTML = '';
    const s3d = $('#s30Dates'); if (s3d) s3d.innerHTML = '';
    const s3b = $('#s30Body'); if (s3b) s3b.innerHTML = '';
    const a2 = $('#a2Body'); if (a2) a2.innerHTML = '';
    const sl = $('#slaBody'); if (sl) sl.innerHTML = '';
    const at = $('#attBody'); if (at) at.innerHTML = '';
    const ex = $('#exPreview'); if (ex) ex.innerHTML = '<div class="muted">选择条件后点击「生成预览」。</div>';
    const be = $('#btnExport'); if (be) be.disabled = true;
    const rb = $('#rpBody'); if (rb) rb.innerHTML = '';
    const rc = $('#btnRpCopy'); if (rc) rc.disabled = true;
    const rm = $('#btnRpMd'); if (rm) rm.disabled = true;
  });
  on('#rosterSearch', 'input', renderRoster);
  on('#ovBiz', 'change', renderOverview);
  on('#peBiz', 'change', () => { S.personSel.clear(); S.expandedRows = new Set(); const all = $('#peAll'); if (all) all.checked = false; refreshPersonOptions(); renderPerson(); });
  on('#peAll', 'change', e => {
    const bizEl = $('#peBiz');
    const biz = (bizEl && bizEl.value) || '买手合作';
    const src = bizToSrc(biz);
    if (e.target.checked) {
      S.personSel.clear();
      const srcEmps = srcEmployeeSet(src);
      let emps = S.roster.filter(x => employeeVisible(x) && srcEmps.has(x.name) && /一线/.test(x.attr||''));
      if (!emps.length) emps = S.roster.filter(x => employeeVisible(x) && srcEmps.has(x.name));
      emps.forEach(x => S.personSel.add(x.name));
    } else S.personSel.clear();
    renderPerson();
  });
  on('#peToggle', 'click', () => { const el = $('#peNames'); if (el) el.classList.toggle('collapsed'); });
  on('#tmBiz', 'change', () => { S.teamSel = { group:new Set(), batch:new Set(), category:new Set() }; S.expandedRows = new Set(); refreshTeamOptions(); renderTeam(); });
  on('#a2Biz', 'change', renderAHT2);
  on('#slaBiz', 'change', renderSLA);
  on('#exBiz', 'change', refreshExportOptions);
  on('#s30Biz', 'change', renderS30);
  on('#attName','change', renderAttendance);
  on('#btnPreview', 'click', previewExport);
  on('#btnExport', 'click', downloadExport);
  on('#rpBiz', 'change', () => { renderTargetConfig(); renderReport(); });
  on('#rpWK', 'change', renderReport);
  on('#btnRpCopy', 'click', copyReport);
  on('#btnRpMd', 'click', downloadReportMd);
}
function init() {
  ['peMetric', 'tmMetric', 'exMetric', 'exGroup', 'exBatch', 'exCategory'].forEach(ensureChipContainer);
  bindEvents();
  renderTargetConfig();
  switchView('import');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();