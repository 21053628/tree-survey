/**
 * 🌳 樹木調查系統 — Dashboard 模組（Chart.js 圖表）
 * @module dashboard
 *
 * 提供 KPI 卡片、圓環圖、直條圖、橫條圖、高危樹木表格。
 * 一次性查詢 Supabase，client-side 分組計算。
 */

TreeApp.dashboard = (function () {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

  /** @type {object|null} 上次查詢的原始資料快取 */
  let _rawCache = null;
  let _rawCacheTs = 0;

  /** @type {Map<string, Chart>} 已建立的 Chart 實例 */
  const _charts = new Map();

  // ============================================================
  // HTML 跳脫（防止 XSS）
  // ============================================================

  function _escape(str) {
    str = String(str == null ? '' : str);
    return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }

  // ============================================================
  // Badge HTML（用於 innerHTML 情境的安全版本）
  // ============================================================

  function _badgeHTML(value, cssClass) {
    if (!value) return '<span class="null-cell">—</span>';
    return '<span class="tc-badge ' + _escape(cssClass || '') + '">' + _escape(value) + '</span>';
  }

  function _healthBadgeHTML(v) {
    if (!v) return _badgeHTML(null, '');
    return _badgeHTML(v, v.toLowerCase());
  }

  function _structBadgeHTML(v) {
    if (!v) return _badgeHTML(null, '');
    return _badgeHTML(v, v.toLowerCase());
  }

  function _recBadgeHTML(v) {
    if (!v) return _badgeHTML(null, '');
    var m = { retain: 'retain', fell: 'fell', transplant: 'transplant', prune: 'prune', monitor: 'monitor', 'further investigation': 'investigation' };
    var cls = m[(v || '').toLowerCase()] || '';
    return _badgeHTML(v, cls);
  }

  // ============================================================
  // 公用：一次查詢 trees + tree_photos
  // ============================================================

  async function _fetchAllData() {
    var now = Date.now();
    if (_rawCache && (now - _rawCacheTs) < CACHE_TTL) {
      return _rawCache;
    }

    var client = AppState.supabase;
    if (!client) {
      console.warn('Dashboard: Supabase 尚未初始化');
      return null;
    }

    var treesRes, photosRes;
    try {
      var results = await Promise.all([
        client.from('trees').select('id,healthCondition,structuralCondition,recommendation,chineseName,botanicalName,treeIdNo,projectId,created_at,latitude,longitude,trunkDiameter'),
        client.from('tree_photos').select('is_spoofed,exif_latitude')
      ]);
      treesRes = results[0];
      photosRes = results[1];
    } catch (e) {
      console.error('Dashboard: fetch error', e);
      return null;
    }

    var result = {
      trees: treesRes.data || [],
      photos: photosRes.data || [],
      treesError: treesRes.error,
      photosError: photosRes.error
    };

    _rawCache = result;
    _rawCacheTs = now;
    return result;
  }

  // ============================================================
  // 輔助：安全計數
  // ============================================================

  function _count(arr, field, value) {
    return arr.filter(function (t) { return t[field] === value; }).length;
  }

  // ============================================================
  // 輔助：銷毀 Chart
  // ============================================================

  function _destroyChart(key) {
    if (_charts.has(key)) {
      _charts.get(key).destroy();
      _charts.delete(key);
    }
  }

  function _destroyAllCharts() {
    _charts.forEach(function (c) { c.destroy(); });
    _charts.clear();
  }

  // ============================================================
  // 建立 Chart 通用包裝
  // ============================================================

  function _createChart(canvasId, key, config) {
    _destroyChart(key);
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var chart = new Chart(canvas, config);
    _charts.set(key, chart);
    return chart;
  }

  // ============================================================
  // KPI 卡片
  // ============================================================

  function _renderKPIs(trees, photos) {
    var total = trees.length;

    // 去重高危樹木
    var highRiskSet = new Set();
    trees.forEach(function (t) {
      if (t.healthCondition === 'Dead' || t.structuralCondition === 'Hazardous' || t.recommendation === 'Fell') {
        highRiskSet.add(t.id);
      }
    });
    var highRiskDedup = highRiskSet.size;

    var withGps = trees.filter(function (t) { return t.latitude != null && t.longitude != null; }).length;
    var gpsPct = total > 0 ? Math.round((withGps / total) * 100) : 0;

    var spoofed = photos.filter(function (p) { return p.is_spoofed === true; }).length;

    _setEl('dsTotalTrees', total.toLocaleString());
    _setEl('dsHighRisk', highRiskDedup.toLocaleString());
    _setEl('dsGpsCoverage', gpsPct + '%');
    _setEl('dsSpoofed', spoofed.toLocaleString());

    var hrEl = document.getElementById('dsHighRisk');
    if (hrEl) hrEl.style.color = highRiskDedup > 0 ? '#ef4444' : '#22c55e';
  }

  function _setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ============================================================
  // Chart 1：健康狀況圓環圖 (Donut)
  // ============================================================

  function _renderHealthDonut(trees) {
    var good = _count(trees, 'healthCondition', 'Good');
    var fair = _count(trees, 'healthCondition', 'Fair');
    var poor = _count(trees, 'healthCondition', 'Poor');
    var dead = _count(trees, 'healthCondition', 'Dead');

    _createChart('chartHealthDonut', 'health', {
      type: 'doughnut',
      data: {
        labels: ['良好 Good', '一般 Fair', '差 Poor', '枯死 Dead'],
        datasets: [{
          data: [good, fair, poor, dead],
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
          borderColor: '#18181b',
          borderWidth: 3,
          hoverBorderColor: '#27272a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 16, font: { size: 12 }, usePointStyle: true } }
        }
      }
    });
  }

  // ============================================================
  // Chart 2：每月調查趨勢堆疊直條圖
  // ============================================================

  function _renderMonthlyBar(trees) {
    var monthly = {};
    trees.forEach(function (t) {
      var m = t.created_at ? t.created_at.slice(0, 7) : null;
      if (!m) return;
      if (!monthly[m]) monthly[m] = { Good: 0, Fair: 0, Poor: 0, Dead: 0, Other: 0 };
      if (monthly[m][t.healthCondition] !== undefined) {
        monthly[m][t.healthCondition]++;
      } else {
        monthly[m].Other++;
      }
    });

    var months = Object.keys(monthly).sort();

    _createChart('chartMonthlyBar', 'monthly', {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Good', data: months.map(function (m) { return monthly[m].Good; }), backgroundColor: '#22c55e' },
          { label: 'Fair', data: months.map(function (m) { return monthly[m].Fair; }), backgroundColor: '#eab308' },
          { label: 'Poor', data: months.map(function (m) { return monthly[m].Poor; }), backgroundColor: '#f97316' },
          { label: 'Dead', data: months.map(function (m) { return monthly[m].Dead; }), backgroundColor: '#ef4444' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#cbd5e1', usePointStyle: true } },
          tooltip: { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1 }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { color: 'rgba(148,163,184,0.08)' } },
          y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } }
        }
      }
    });
  }

  // ============================================================
  // Chart 3：Top 10 樹種橫條圖
  // ============================================================

  function _renderSpeciesBar(trees) {
    var species = {};
    trees.forEach(function (t) {
      var name = t.chineseName || t.botanicalName || '未知';
      species[name] = (species[name] || 0) + 1;
    });

    var top10 = Object.entries(species)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 10);

    _createChart('chartSpeciesBar', 'species', {
      type: 'bar',
      data: {
        labels: top10.map(function (e) { return e[0]; }),
        datasets: [{
          label: '數量',
          data: top10.map(function (e) { return e[1]; }),
          backgroundColor: top10.map(function (_, i) { return 'hsl(' + (200 + i * 15) + ', 70%, 50%)'; }),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1 }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
          y: { ticks: { color: '#cbd5e1', font: { size: 11 } } }
        }
      }
    });
  }

  // ============================================================
  // Chart 4：建議措施圓環圖
  // ============================================================

  function _renderRecommendationDonut(trees) {
    var recs = {};
    trees.forEach(function (t) {
      var r = t.recommendation || '未指定';
      recs[r] = (recs[r] || 0) + 1;
    });

    var labels = Object.keys(recs);
    var values = Object.values(recs);
    var colors = {
      'Retain': '#22c55e',
      'Fell': '#ef4444',
      'Transplant': '#8b5cf6',
      'Prune': '#3b82f6',
      'Monitor': '#eab308',
      'Further Investigation': '#06b6d4',
      '未指定': '#64748b'
    };

    _createChart('chartRecommendationDonut', 'recommendation', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(function (l) { return colors[l] || '#64748b'; }),
          borderColor: '#18181b',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 12, font: { size: 11 }, usePointStyle: true } }
        }
      }
    });
  }

  // ============================================================
  // Chart 5：結構狀況圓環圖
  // ============================================================

  function _renderStructuralDonut(trees) {
    var good = _count(trees, 'structuralCondition', 'Good');
    var fair = _count(trees, 'structuralCondition', 'Fair');
    var poor = _count(trees, 'structuralCondition', 'Poor');
    var haz = _count(trees, 'structuralCondition', 'Hazardous');

    _createChart('chartStructuralDonut', 'structural', {
      type: 'doughnut',
      data: {
        labels: ['良好 Good', '一般 Fair', '差 Poor', '危險 Hazardous'],
        datasets: [{
          data: [good, fair, poor, haz],
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
          borderColor: '#18181b',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 14, font: { size: 11 }, usePointStyle: true } }
        }
      }
    });
  }

  // ============================================================
  // Chart 6：DBH 分佈直方圖
  // ============================================================

  function _renderDbhHistogram(trees) {
    var dbhValues = trees
      .filter(function (t) { return t.trunkDiameter != null && t.trunkDiameter > 0; })
      .map(function (t) { return t.trunkDiameter; });

    if (dbhValues.length === 0) {
      _createChart('chartDbhHistogram', 'dbh', {
        type: 'bar',
        data: { labels: ['無資料'], datasets: [{ data: [0], backgroundColor: '#64748b' }] },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } }
        }
      });
      return;
    }

    var min = Math.min.apply(null, dbhValues);
    var max = Math.max.apply(null, dbhValues);
    var bucketCount = 10;
    var bucketWidth = (max - min) / bucketCount || 1;
    var buckets = new Array(bucketCount).fill(0);
    var bucketLabels = [];

    for (var i = 0; i < bucketCount; i++) {
      var lo = Math.round(min + i * bucketWidth);
      var hi = Math.round(min + (i + 1) * bucketWidth);
      bucketLabels.push(lo + '-' + hi);
    }

    dbhValues.forEach(function (v) {
      var idx = Math.min(Math.floor((v - min) / bucketWidth), bucketCount - 1);
      buckets[idx]++;
    });

    _createChart('chartDbhHistogram', 'dbh', {
      type: 'bar',
      data: {
        labels: bucketLabels,
        datasets: [{
          label: '樹木數量',
          data: buckets,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1 }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(148,163,184,0.08)' }, title: { display: true, text: 'DBH (mm)', color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' }, title: { display: true, text: '數量', color: '#94a3b8' } }
        }
      }
    });
  }

  // ============================================================
  // 高危樹木表格
  // ============================================================

  function _renderHighRiskTable(trees) {
    var tbody = document.getElementById('highRiskBody');
    if (!tbody) return;

    var highRisk = trees.filter(function (t) {
      return t.healthCondition === 'Dead'
        || t.structuralCondition === 'Hazardous'
        || t.recommendation === 'Fell';
    });

    if (highRisk.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">✅ 冇高危樹木，非常好！</td></tr>';
      return;
    }

    tbody.innerHTML = highRisk.map(function (t) {
      var rowStyle = t.healthCondition === 'Dead' ? 'style="background:rgba(239,68,68,0.08);"' : '';
      var name = _escape(t.chineseName || t.botanicalName || '-');
      var tid = _escape(t.treeIdNo || '-');
      var healthBadge = _healthBadgeHTML(t.healthCondition);
      var structBadge = _structBadgeHTML(t.structuralCondition);
      var recBadge = _recBadgeHTML(t.recommendation);
      return '<tr class="table-row" ' + rowStyle + '>' +
        '<td><strong>' + tid + '</strong></td>' +
        '<td>' + name + '</td>' +
        '<td>' + healthBadge + '</td>' +
        '<td>' + structBadge + '</td>' +
        '<td>' + recBadge + '</td>' +
        '<td><button class="btn btn-xs btn-outline" data-action="open-project-from-dashboard" data-project-id="' + _escape(t.projectId || '') + '">🔗</button></td>' +
        '</tr>';
    }).join('');
  }

  // ============================================================
  // 初始化
  // ============================================================

  async function init() {
    console.log('📊 Dashboard init...');

    // Chart.js Global 設定
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = '#cbd5e1';
      Chart.defaults.borderColor = 'rgba(148,163,184,0.1)';
      Chart.defaults.font.family = "'Segoe UI','PingFang HK','Microsoft YaHei',system-ui,sans-serif";
      Chart.defaults.plugins.tooltip.backgroundColor = '#18181b';
      Chart.defaults.plugins.tooltip.borderColor = '#27272a';
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.titleFont = { size: 13 };
      Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
    }

    // 顯示 loading
    _setEl('dsTotalTrees', '...');
    _setEl('dsHighRisk', '...');
    _setEl('dsGpsCoverage', '...');
    _setEl('dsSpoofed', '...');

    var raw = await _fetchAllData();
    if (!raw || raw.treesError) {
      console.error('Dashboard: 查詢失敗', raw && raw.treesError);
      _setEl('dsTotalTrees', '❌');
      _setEl('dsHighRisk', '❌');
      _setEl('dsGpsCoverage', '❌');
      _setEl('dsSpoofed', '❌');
      return;
    }

    var trees = raw.trees;
    var photos = raw.photos;

    // KPI
    _renderKPIs(trees, photos);

    // Charts
    _renderHealthDonut(trees);
    _renderMonthlyBar(trees);
    _renderSpeciesBar(trees);
    _renderRecommendationDonut(trees);
    _renderStructuralDonut(trees);
    _renderDbhHistogram(trees);

    // High Risk Table
    _renderHighRiskTable(trees);

    console.log('✅ Dashboard ready - ' + trees.length + ' trees, ' + photos.length + ' photos');
  }

  // ============================================================
  // 銷毀（切換視圖時清理）
  // ============================================================

  function destroy() {
    _destroyAllCharts();
    _rawCache = null;
    _rawCacheTs = 0;
  }

  function invalidateCache() {
    _rawCache = null;
    _rawCacheTs = 0;
  }

  function resize() {
    _charts.forEach(function (c) { c.resize(); });
  }

  // ============================================================
  // Public API
  // ============================================================

  return {
    init: init,
    destroy: destroy,
    resize: resize,
    invalidateCache: invalidateCache
  };

})();