/**
 * 🌳 樹木調查系統 — 安全 DOM 工廠工具模組
 * @module dom
 * 
 * 提供安全的 DOM 操作替代 innerHTML 字串拼接，根本性防範 XSS。
 * 所有使用者資料透過 textContent / setAttribute 寫入，永不解析為 HTML。
 */

// ============================================================
// 基礎 Element 建立
// ============================================================

/**
 * 建立 DOM element
 * @param {string} tag - HTML tag name
 * @param {string} [className] - CSS class(es)
 * @param {Object<string, string>} [attrs] - attribute map (安全設定)
 * @returns {HTMLElement}
 */
function el(tag, className, attrs) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (attrs) {
        Object.keys(attrs).forEach(function(k) {
            e.setAttribute(k, attrs[k]);
        });
    }
    return e;
}

/**
 * 建立 text node 並包裝在指定 tag 中
 * @param {string} tag - HTML tag name
 * @param {string} text - 純文字內容 (永不解析 HTML)
 * @param {string} [className] - CSS class
 * @returns {HTMLElement}
 */
function elText(tag, text, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    e.textContent = text != null ? String(text) : '';
    return e;
}

/**
 * 安全設定 textContent
 * @param {HTMLElement} elem
 * @param {*} value
 */
function setText(elem, value) {
    elem.textContent = value != null ? String(value) : '';
}

// ============================================================
// Button 建立（避免 onclick 屬性拼接）
// ============================================================

/**
 * 建立按鈕 element（安全事件綁定）
 * @param {string} label - 按鈕文字
 * @param {string} [className] - CSS class
 * @param {Function} [onClick] - click handler
 * @returns {HTMLButtonElement}
 */
function elButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.className = className || '';
    btn.textContent = label;
    if (onClick) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            onClick(e);
        });
    }
    return btn;
}

// ============================================================
// Badge 建立（取代 healthBadge / structBadge / recBadge）
// ============================================================

/**
 * 建立 Condition Badge（安全，無 innerHTML）
 * @param {string|null} value - 顯示值
 * @param {string} cssClass - 對應的 CSS class
 * @returns {HTMLElement}
 */
function elBadge(value, cssClass) {
    if (!value) {
        const span = document.createElement('span');
        span.className = 'null-cell';
        span.textContent = '—';
        return span;
    }
    const span = document.createElement('span');
    span.className = 'tc-badge ' + (cssClass || '');
    span.textContent = value;
    return span;
}

/**
 * Health Condition → Badge Element
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function healthBadgeEl(v) {
    if (!v) return elBadge(null, '');
    return elBadge(v, v.toLowerCase());
}

/**
 * Structural Condition → Badge Element
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function structBadgeEl(v) {
    if (!v) return elBadge(null, '');
    return elBadge(v, v.toLowerCase());
}

/**
 * Recommendation → Badge Element
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function recBadgeEl(v) {
    if (!v) return elBadge(null, '');
    var m = {retain:'retain',fell:'fell',transplant:'transplant',prune:'prune',monitor:'monitor','further investigation':'investigation'};
    var cls = m[(v || '').toLowerCase()] || '';
    return elBadge(v, cls);
}

// ============================================================
// Table 輔助
// ============================================================

/**
 * 建立 TD element（安全設定 textContent）
 * @param {*} content - 文字內容或 DOM element
 * @param {string} [className] - CSS class
 * @returns {HTMLTableCellElement}
 */
function elTd(content, className) {
    const td = document.createElement('td');
    if (className) td.className = className;
    if (content instanceof Node) {
        td.appendChild(content);
    } else {
        td.textContent = content != null ? String(content) : '';
    }
    return td;
}

/**
 * 建立 TR element，接收 TD element 陣列
 * @param {HTMLElement[]} cells - TD element 陣列
 * @returns {HTMLTableRowElement}
 */
function elTr(cells) {
    const tr = document.createElement('tr');
    cells.forEach(function(td) { tr.appendChild(td); });
    return tr;
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.dom = {
    el: el,
    elText: elText,
    setText: setText,
    elButton: elButton,
    elBadge: elBadge,
    healthBadgeEl: healthBadgeEl,
    structBadgeEl: structBadgeEl,
    recBadgeEl: recBadgeEl,
    elTd: elTd,
    elTr: elTr
};
