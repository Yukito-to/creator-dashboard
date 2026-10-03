/* ============================================================
   创作者数据分析 · 时段预测视图 + AI 深度分析层
   ============================================================ */
'use strict';

/* ==================== 时段预测视图配置 ==================== */
function renderForecastConfig() {
  const grid = $('#fcDailyGrid');
  if (!grid) return;

  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const startEl = $('#fcStartDate');
  const daysEl = $('#fcDays');
  const startDate = startEl ? startEl.value : (S.latestDate ? dateAdd(S.latestDate, 1) : new Date().toISOString().slice(0, 10));
  const days = daysEl ? parseInt(daysEl.value, 10) : 7;

  if (!S.forecastInputs) S.forecastInputs = {};
  if (!S.forecastInputs[biz]) S.forecastInputs[biz] = {};

  const volumeMap = S.volumeForecast[biz] || {};
  let hasAutoData = false;

  let html = '';
  for (let i = 0; i < days; i++) {
    const date = dateAdd(startDate, i);
    if (!date) continue;
    const wd = new Date(date + 'T00:00:00Z').getUTCDay();
    const isWeekend = (wd === 0 || wd === 6);

    let val = S.forecastInputs[biz][date];
    let isAuto = false;
    if (val === undefined || val === '') {
      if (volumeMap[date] != null) {
        val = volumeMap[date];
        isAuto = true;
        hasAutoData = true;
      } else {
        val = '';
      }
    }

    const rowClass = isWeekend ? 'fc-daily-row fc-weekend' : 'fc-daily-row';
    const readonly = '';
    const autoTag = isAuto ? '<span class="fc-auto-tag">预测量</span>' : '';

    html += '<div class="' + rowClass + '" data-date="' + date + '">' +
      '<div class="fc-daily-date">' + date.slice(5) + ' 周' + WEEKDAY_CN[wd] + autoTag + '</div>' +
      '<input type="number" inputmode="decimal" step="1" min="0" value="' + esc(val) + '" ' + readonly + ' data-date="' + date + '" placeholder="输入总量">' +
      '<label class="fc-holiday"><input type="checkbox" data-date="' + date + '"' + (S.forecastHolidays && S.forecastHolidays.has(date) ? ' checked' : '') + '> 节假日</label>' +
    '</div>';
  }

  grid.innerHTML = html || '<div class="muted">请选择日期范围。</div>';

  const tipEl = $('#fcAutoTip');
  if (tipEl) {
    if (hasAutoData) {
      tipEl.style.display = 'block';
      tipEl.innerHTML = '💡 检测到导入的「预测量」数据，已自动填充。带 <span class="fc-auto-tag">预测量</span> 标记的输入框可直接修改覆盖。';
    } else {
      tipEl.style.display = 'none';
    }
  }

  grid.querySelectorAll('input[type=number]').forEach(inp => {
    inp.addEventListener('input', () => {
      const d = inp.dataset.date;
      S.forecastInputs[biz][d] = inp.value;
    });
  });

  grid.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', () => {
      const d = chk.dataset.date;
      if (!S.forecastHolidays) S.forecastHolidays = new Set();
      if (chk.checked) S.forecastHolidays.add(d);
      else S.forecastHolidays.delete(d);
      try { localStorage.setItem('creator_forecast_holidays', JSON.stringify([...S.forecastHolidays])); } catch (_) {}
      renderForecastResult();
    });
  });

  renderForecastResult();
}

/* ==================== 收集每日总量 ==================== */
function collectDailyTotals() {
  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const grid = $('#fcDailyGrid');
  const totals = {};
  if (!grid) return totals;

  grid.querySelectorAll('input[type=number]').forEach(inp => {
    const d = inp.dataset.date;
    const v = parseFloat(inp.value);
    if (!isNaN(v) && v > 0) totals[d] = v;
  });
  return totals;
}

/* ==================== 渲染预测结果表格 ==================== */
function renderForecastResult() {
  const el = $('#fcResult');
  const notesEl = $('#fcNotes');
  if (!el) return;

  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const startEl = $('#fcStartDate');
  const daysEl = $('#fcDays');
  const weeksEl = $('#fcSampleWeeks');

  const startDate = startEl ? startEl.value : '';
  const days = daysEl ? parseInt(daysEl.value, 10) : 7;
  const sampleWeeks = weeksEl ? parseInt(weeksEl.value, 10) : 4;

  if (!startDate) {
    el.innerHTML = '<p class="muted">请选择起始日期。</p>';
    if (notesEl) notesEl.innerHTML = '';
    return;
  }

  const dailyTotals = collectDailyTotals();
  if (Object.keys(dailyTotals).length === 0) {
    el.innerHTML = '<p class="muted">请至少输入一天的总量。</p>';
    if (notesEl) notesEl.innerHTML = '';
    return;
  }

  const holidays = S.forecastHolidays || new Set();
  const forecast = generateForecast(biz, 'caseVolume', sampleWeeks, startDate, days, dailyTotals, holidays);

  if (!forecast) {
    el.innerHTML = '<p class="muted">无法生成预测，请检查历史数据是否充足。</p>';
    if (notesEl) notesEl.innerHTML = '';
    return;
  }

  const { stats, results, periods } = forecast;
  const periodList = (periods && periods.length) ? periods : PREDICT_PERIODS;
  const diag = stats.diagnostic || {};

  if (!stats.dailyStats || stats.dailyStats.length === 0) {
    const periodDisp = (diag.periodsDetected && diag.periodsDetected.length)
      ? diag.periodsDetected.join('、')
      : '（无）';
    el.innerHTML =
      '<div style="padding:14px 16px;background:#FFF7E6;border-radius:10px;border-left:3px solid #E8A33E;line-height:1.9;font-size:13px">' +
      '<div style="font-weight:700;color:#B36A00;margin-bottom:6px">⚠ 未能从历史数据中提取时段占比</div>' +
      '<div>扫描数据行：<b>' + (diag.scanned || 0) + '</b> 条（样本周期 ' +
        (diag.sampleRange ? diag.sampleRange.start + ' ~ ' + diag.sampleRange.end : '—') + '）</div>' +
      '<div>有效天数：<b>' + (diag.matchedDays || 0) + '</b> 天</div>' +
      '<div>时段行数：<b>' + (diag.rowsWithPeriod || 0) + '</b> 条（含时段的明细）</div>' +
      '<div>CASE 处理量合计：<b>' + (diag.sumVolume || 0) + '</b></div>' +
      '<div>检测到的时段：<b>' + periodDisp + '</b></div>' +
      (diag.hint ? '<div style="margin-top:8px;color:#B36A00">' + esc(diag.hint) + '</div>' : '') +
      '</div>';
    if (notesEl) notesEl.innerHTML = '';
    return;
  }

  let thead = '<tr><th>日期</th><th>类型</th><th>总量</th>';
  for (const p of periodList) thead += '<th>' + esc(p) + '时</th>';
  thead += '</tr>';

  let tbody = '';
  for (const r of results) {
    const wd = new Date(r.date + 'T00:00:00Z').getUTCDay();
    const type = r.isHoliday ? '节假日' : (r.isWeekend ? '周末' : '工作日');
    const typeCls = r.isHoliday ? 'style="color:#E8A33E;font-weight:600"' : (r.isWeekend ? 'style="color:#C4B0CE;font-weight:600"' : '');

    tbody += '<tr>' +
      '<td>' + r.date.slice(5) + ' 周' + WEEKDAY_CN[wd] + '</td>' +
      '<td ' + typeCls + '>' + type + '</td>' +
      '<td style="font-weight:600">' + Math.round(r.total) + '</td>';

    for (const p of periodList) {
      const v = r.periods[p] || 0;
      tbody += '<td>' + (r.total > 0 ? Math.round(v) : '—') + '</td>';
    }
    tbody += '</tr>';
  }

  let totalRow = '<tr style="background:#F4F3EF;font-weight:600"><td>合计</td><td>—</td><td>' +
    Math.round(results.reduce((s, r) => s + r.total, 0)) + '</td>';
  for (const p of periodList) {
    const sum = results.reduce((s, r) => s + (r.periods[p] || 0), 0);
    totalRow += '<td>' + Math.round(sum) + '</td>';
  }
  totalRow += '</tr>';

  el.innerHTML = '<div class="table-scroll-x"><table class="rp-table"><thead>' + thead + '</thead><tbody>' + tbody + totalRow + '</tbody></table></div>';

  if (notesEl) {
    const weightTag = stats.usedRowCount
      ? '（⚠ 未检测到「CASE处理量」，已改用明细行数作为权重）'
      : '（按 CASE 处理量加权）';
    let noteHtml = '<div style="margin-bottom:6px">📊 <b>样本统计：</b>近 ' + sampleWeeks + ' 周，工作日 ' + stats.weekdayCount + ' 天 / 周末 ' + stats.weekendCount + ' 天，样本范围 ' + stats.sampleRange.start + ' ~ ' + stats.sampleRange.end + ' ' + weightTag + '。</div>';
    if (stats.abnormalDays && stats.abnormalDays.length) {
      noteHtml += '<div style="color:#C98383">⚠ <b>疑似异常天：</b>' + stats.abnormalDays.map(d => d.date + '（偏差' + d.totalDevPct + '%）').join('、') + '，已在计算中位数时排除。</div>';
    } else {
      noteHtml += '<div style="color:#6EA980">✓ 未检出显著异常天。</div>';
    }
    notesEl.innerHTML = noteHtml;
  }
}

/* ==================== AI 深度分析 ==================== */
async function runForecastAiAnalysis() {
  const outEl = $('#fcAiOut');
  const btnAi = $('#btnFcAi');
  if (!outEl) return;

  const keyEl = $('#aiKey');
  const modelEl = $('#aiModel');
  const apiKey = ((keyEl && keyEl.value) || '').trim();
  const model = (modelEl && modelEl.value) || 'glm-5.3-flash';

  if (!apiKey) {
    outEl.style.display = 'block';
    outEl.innerHTML = '<div class="ai-err">❌ 请先在「🤖 AI 设置」页配置 API Key。</div>';
    return;
  }

  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const startEl = $('#fcStartDate');
  const daysEl = $('#fcDays');
  const weeksEl = $('#fcSampleWeeks');

  const startDate = startEl ? startEl.value : '';
  const days = daysEl ? parseInt(daysEl.value, 10) : 7;
  const sampleWeeks = weeksEl ? parseInt(weeksEl.value, 10) : 4;

  const dailyTotals = collectDailyTotals();
  if (Object.keys(dailyTotals).length === 0) {
    outEl.style.display = 'block';
    outEl.innerHTML = '<div class="ai-err">❌ 请先输入每日总量。</div>';
    return;
  }

  const holidays = S.forecastHolidays || new Set();
  const forecast = generateForecast(biz, 'caseVolume', sampleWeeks, startDate, days, dailyTotals, holidays);
  if (!forecast) {
    outEl.style.display = 'block';
    outEl.innerHTML = '<div class="ai-err">❌ 无法生成预测数据，请检查历史记录。</div>';
    return;
  }
  if (!forecast.stats.dailyStats || forecast.stats.dailyStats.length === 0) {
    outEl.style.display = 'block';
    outEl.innerHTML = '<div class="ai-err">❌ 历史数据中没有可用的时段占比。请先在「🔗 映射」页确认「CASE创建时段」字段已正确映射。</div>';
    return;
  }

  const ctx = buildForecastAiContext(biz, 'caseVolume', sampleWeeks, startDate, days, dailyTotals, holidays, forecast);
  const ctxText = formatForecastAiContext(ctx);

  const system = [
    '你是一个资深的客服中心排班与预测分析师。',
    '请根据给定的历史时段占比、30S接起率、以及未来预测数据，输出一份专业的时段预测分析报告。',
    '',
    '【分析要求】',
    '1. 整体评估：评估未来几天的预测总量是否合理，与历史趋势是否一致。',
    '2. 高风险时段识别：识别预测量大但历史30S接起率低的时段，评估潜在风险。',
    '3. 排班与容量建议：针对高风险时段，给出具体的排班弹性建议（如提前加人、应急备班等）。',
    '4. 异常提示：如果历史数据中有异常天，请提醒排班时注意。',
    '',
    '【输出格式】',
    '请使用 Markdown 格式，包含以下部分：',
    '### 一、整体预测评估',
    '### 二、高风险时段预警',
    '### 三、排班与容量建议',
    '### 四、其他注意事项',
  ].join('\n');

  const user = '业务线：' + biz + '\n预测范围：' + startDate + ' 起 ' + days + ' 天\n样本周期：近 ' + sampleWeeks + ' 周\n\n=== 数据 ===\n\n' + ctxText + '\n\n请输出分析报告。';

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  outEl.style.display = 'block';
  outEl.innerHTML = '<div style="color:#7B8FBF;font-weight:600;padding:8px 0">🤖 AI 正在分析时段预测数据…</div><div class="ai-cursor"></div>';
  if (btnAi) { btnAi.disabled = true; btnAi.textContent = '分析中…'; }

  let buffer = '';
  let reasoningBuf = '';
  const logs = [];

  const render = () => {
    const dbg = logs.length ? '<div style="font-size:11px;color:#999;padding:4px 0;border-bottom:1px dashed #eee;margin-bottom:6px">' + logs.slice(-3).map(esc).join('<br>') + '</div>' : '';
    outEl.innerHTML = dbg + renderAiMarkdown(buffer) + (buffer ? '' : '<span class="ai-cursor"></span>');
    outEl.scrollTop = outEl.scrollHeight;
  };

  try {
    await callZhipuAI(
      apiKey, model, messages,
      (chunk, type) => {
        if (type === 'reasoning') reasoningBuf += chunk;
        else buffer += chunk;
        render();
      },
      null,
      (msg) => { logs.push('[调试] ' + msg); render(); }
    );
  } catch (err) {
    outEl.innerHTML = '<div class="ai-err">❌ 分析失败：' + esc(err.message) + '</div>';
  } finally {
    if (btnAi) { btnAi.disabled = false; btnAi.textContent = '🤖 AI 深度分析'; }
    if (!buffer.trim() && reasoningBuf.trim()) { buffer = reasoningBuf; render(); }
  }
}

/* ==================== 复制 Markdown ==================== */
function copyForecastMd() {
  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  const startEl = $('#fcStartDate');
  const daysEl = $('#fcDays');
  const weeksEl = $('#fcSampleWeeks');

  const startDate = startEl ? startEl.value : '';
  const days = daysEl ? parseInt(daysEl.value, 10) : 7;
  const sampleWeeks = weeksEl ? parseInt(weeksEl.value, 10) : 4;

  const dailyTotals = collectDailyTotals();
  if (Object.keys(dailyTotals).length === 0) {
    toast('❌ 请先输入每日总量');
    return;
  }

  const holidays = S.forecastHolidays || new Set();
  const forecast = generateForecast(biz, 'caseVolume', sampleWeeks, startDate, days, dailyTotals, holidays);
  if (!forecast) {
    toast('❌ 无法生成预测数据');
    return;
  }

  const md = forecastToMarkdown(biz, 'caseVolume', sampleWeeks, forecast);
  navigator.clipboard.writeText(md).then(() => {
    toast('✅ Markdown 已复制到剪贴板');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = md;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('✅ Markdown 已复制到剪贴板'); }
    catch (e) { toast('❌ 复制失败，请手动选择文本'); }
    document.body.removeChild(ta);
  });
}

/* ==================== 清空输入 ==================== */
function clearForecastInputs() {
  const bizEl = $('#fcBiz');
  const biz = (bizEl && bizEl.value) || '买手合作';
  if (S.forecastInputs && S.forecastInputs[biz]) {
    S.forecastInputs[biz] = {};
  }
  if (S.forecastHolidays) {
    S.forecastHolidays.clear();
  }
  try { localStorage.removeItem('creator_forecast_holidays'); } catch (_) {}
  const outEl = $('#fcAiOut');
  if (outEl) { outEl.style.display = 'none'; outEl.innerHTML = ''; }
  renderForecastConfig();
  renderForecastResult();
  toast('已清空输入');
}

/* ============================================================
   END OF dashboard-forecast.js
   ============================================================ */