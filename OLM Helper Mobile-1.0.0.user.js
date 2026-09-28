// ==UserScript==
// @name         OLM Helper Mobile
// @namespace    olm.mobile
// @version      1.0.0
// @description  Xem đáp án OLM trên điện thoại, chặn nộp bài, fake thời gian làm bài.
// @author       anon
// @match        https://olm.vn/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        version: '1.0.0',
        apiKeywords: ['get-question-of-ids', 'get-question?belongs=1'],
        xorKey: '1047823200',
        submitEndpoints: ['/course/teacher-static', '/teacher-static']
    };

    // ---------- LaTeX -> Unicode ----------
    const SYMBOLS = {
        '\\mathbb{N}': 'ℕ', '\\mathbb{Z}': 'ℤ', '\\mathbb{Q}': 'ℚ',
        '\\mathbb{R}': 'ℝ', '\\mathbb{C}': 'ℂ', '\\mathbb{P}': 'ℙ',
        '\\cup': '∪', '\\cap': '∩', '\\in': '∈', '\\notin': '∉',
        '\\subset': '⊂', '\\subseteq': '⊆', '\\supset': '⊃', '\\supseteq': '⊇',
        '\\emptyset': '∅', '\\varnothing': '∅',
        '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
        '\\neg': '¬', '\\land': '∧', '\\lor': '∨',
        '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
        '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
        '\\to': '→', '\\mapsto': '↦',
        '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
        '\\cdot': '·', '\\ast': '∗', '\\star': '⋆',
        '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
        '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
        '\\sqrt': '√', '\\propto': '∝', '\\approx': '≈', '\\neq': '≠',
        '\\equiv': '≡', '\\leq': '≤', '\\geq': '≥', '\\ll': '≪', '\\gg': '≫',
        '\\sim': '∼', '\\simeq': '≃', '\\cong': '≅',
        '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
        '\\triangle': '△', '\\square': '□', '\\circ': '∘', '\\bullet': '•',
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
        '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
        '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
        '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\sigma': 'σ',
        '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ', '\\varphi': 'φ',
        '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
        '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
        '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
        '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
        '\\quad': ' ', '\\qquad': '  ', '\\,': ' ', '\\;': ' ', '\\:': ' ',
        '\\!': '', '\\ ': ' ',
        '\\%': '%', '\\$': '$', '\\#': '#', '\\&': '&', '\\_': '_',
        '\\{': '{', '\\}': '}', '\\|': '‖',
        '\\langle': '⟨', '\\rangle': '⟩',
        '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉'
    };

    const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc',
        'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
        'log', 'ln', 'lim', 'limsup', 'liminf', 'max', 'min',
        'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd', 'lcm'];

    const SUP = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
        '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ', 'i': 'ⁱ', '*': '∗', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ',
        'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ',
        'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ',
        's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ',
        'y': 'ʸ', 'z': 'ᶻ'
    };

    const SUB = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
        '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
        'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
        'v': 'ᵥ', 'x': 'ₓ'
    };

    const toSup = s => s.split('').map(c => SUP[c] || c).join('');
    const toSub = s => s.split('').map(c => SUB[c] || c).join('');

    function latexToText(input) {
        if (!input || typeof input !== 'string') return input;
        let s = input;

        s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
             .replace(/\$([^$\n]*?)\$/g, '$1')
             .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
             .replace(/\\\[([\s\S]*?)\\\]/g, '$1');

        let prev;
        do {
            prev = s;
            s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
        } while (s !== prev);

        s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g, (_, n, x) => toSup(n) + '√(' + x + ')')
             .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
             .replace(/\^\{([^{}]*)\}/g, (_, c) => toSup(c))
             .replace(/_\{([^{}]*)\}/g, (_, c) => toSub(c))
             .replace(/\^([0-9a-zA-Z+\-=()n])/g, (_, c) => toSup(c))
             .replace(/_([0-9a-zA-Z+\-=()])/g, (_, c) => toSub(c));

        s = s.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|operatorname)\{([^{}]*)\}/g, '$1')
             .replace(/\\left/g, '').replace(/\\right/g, '')
             .replace(/\\vec\{([^{}]*)\}/g, '$1\u20D7')
             .replace(/\\overline\{([^{}]*)\}/g, '$1\u0305')
             .replace(/\\underline\{([^{}]*)\}/g, '$1\u0332')
             .replace(/\\hat\{([^{}]*)\}/g, '$1\u0302')
             .replace(/\\bar\{([^{}]*)\}/g, '$1\u0304')
             .replace(/\\tilde\{([^{}]*)\}/g, '$1\u0303')
             .replace(/\\dot\{([^{}]*)\}/g, '$1\u0307');

        FUNCS.forEach(fn => {
            s = s.replace(new RegExp('\\\\' + fn + '\\b', 'g'), fn);
        });

        const keys = Object.keys(SYMBOLS).sort((a, b) => b.length - a.length);
        for (const k of keys) s = s.split(k).join(SYMBOLS[k]);

        return s.replace(/\\[a-zA-Z]+/g, '').replace(/[ \t]+/g, ' ').trim();
    }

    // ---------- tiện ích ----------
    const fmtTime = s => `${Math.floor(s / 60)}p${String(s % 60).padStart(2, '0')}s`;
    const fmtNum = n => (typeof n === 'number' ? n.toLocaleString('vi-VN') : '0');

    function decodeB64(b64) {
        if (!b64) return null;
        try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return null; }
    }

    function xorBytes(bytes, key) {
        const k = new TextEncoder().encode(key);
        const out = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k[i % k.length];
        return out;
    }

    function decodeJsonContent(encoded) {
        if (!encoded) return null;
        try {
            if (typeof encoded === 'object') return encoded;
            const trimmed = String(encoded).trim();
            if (trimmed.startsWith('{')) return JSON.parse(trimmed);

            const bin = atob(trimmed);
            const raw = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

            const dec = xorBytes(raw, CONFIG.xorKey);
            let text = new TextDecoder('utf-8', { fatal: false }).decode(dec);
            try { text = decodeURIComponent(text); } catch (e) {}
            try { text = decodeURIComponent(escape(text)); } catch (e) {}
            return JSON.parse(text);
        } catch (e) { return null; }
    }

    function mk(tag, opts = {}) {
        const el = document.createElement(tag);
        if (opts.id) el.id = opts.id;
        if (opts.className) el.className = opts.className;
        if (opts.style) Object.assign(el.style, opts.style);
        if (opts.html !== undefined) el.innerHTML = opts.html;
        if (opts.text !== undefined) el.textContent = opts.text;
        if (opts.attrs) for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k]);
        if (opts.children) opts.children.forEach(c => {
            if (typeof c === 'string') el.appendChild(document.createTextNode(c));
            else if (c instanceof Node) el.appendChild(c);
        });
        return el;
    }

    // ---------- fake thời gian ----------
    const timeHack = {
        on: true,
        seconds: GM_getValue('olm_time_sec', 480),

        start() {
            this._hookFetch();
            this._hookXHR();
        },

        set(s) {
            this.seconds = Math.max(30, Math.min(Math.round(s), 3600));
            GM_setValue('olm_time_sec', this.seconds);
            return this.seconds;
        },

        random() {
            return this.set(420 + Math.floor(Math.random() * 181));
        },

        _patch(body) {
            if (!body || typeof body !== 'string') return body;
            try {
                const p = new URLSearchParams(body);
                if (!p.has('time_spent') && !p.has('time_init')) return body;

                const sec = this.seconds;
                const now = Math.floor(Date.now() / 1000);

                p.set('time_spent', String(sec));
                p.set('time_init', String(now - sec - 5));
                p.set('time_stored', String(now));
                p.set('date_end', String(now - 3));

                if (p.has('data_log')) {
                    try {
                        const log = JSON.parse(p.get('data_log'));
                        if (log.length) {
                            const each = Math.floor(sec / log.length);
                            log.forEach(e => {
                                const j = 0.7 + Math.random() * 0.6;
                                e.time_spent = Math.max(15, Math.round(each * j));
                                if (e.q_params) {
                                    try {
                                        const qp = JSON.parse(e.q_params);
                                        qp.time = Math.round(each * 1000 * j * 0.8);
                                        e.q_params = JSON.stringify(qp);
                                    } catch (err) {}
                                }
                            });
                        }
                        p.set('data_log', JSON.stringify(log));
                    } catch (err) {}
                }
                return p.toString();
            } catch (e) { return body; }
        },

        _isSubmit(url) {
            return url && CONFIG.submitEndpoints.some(e => url.includes(e));
        },

        _hookFetch() {
            const orig = unsafeWindow.fetch;
            if (!orig) return;
            unsafeWindow.fetch = async function (input, init) {
                const url = typeof input === 'string' ? input : input?.url;
                const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
                if (timeHack.on && method === 'POST' && timeHack._isSubmit(url) && init?.body && typeof init.body === 'string') {
                    init = { ...init, body: timeHack._patch(init.body) };
                }
                return orig.call(this, input, init);
            };
        },

        _hookXHR() {
            const _open = XMLHttpRequest.prototype.open;
            const _send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (m, u, ...rest) {
                this.__m = m; this.__u = u;
                return _open.call(this, m, u, ...rest);
            };
            XMLHttpRequest.prototype.send = function (body) {
                if (timeHack.on && this.__m?.toUpperCase() === 'POST' && timeHack._isSubmit(this.__u) && typeof body === 'string') {
                    body = timeHack._patch(body);
                }
                return _send.call(this, body);
            };
        }
    };

    // ---------- chặn nộp ----------
    const submitBlock = {
        on: true,

        start() {
            const isSubmit = (url, method) => {
                if (!url) return false;
                const m = (method || 'GET').toUpperCase();
                return m === 'POST' && CONFIG.submitEndpoints.some(e => url.includes(e));
            };

            const _fetch = unsafeWindow.fetch;
            unsafeWindow.fetch = function (...args) {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
                const method = args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET');
                if (submitBlock.on && isSubmit(url, method)) {
                    return Promise.resolve(new Response(
                        JSON.stringify({ message: 'success', blocked: true }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    ));
                }
                return _fetch.apply(this, args);
            };

            const _open = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (m, u, ...rest) {
                this.__m = m; this.__u = u;
                return _open.call(this, m, u, ...rest);
            };

            const _send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...args) {
                if (submitBlock.on && isSubmit(this.__u, this.__m)) {
                    setTimeout(() => {
                        Object.defineProperty(this, 'status', { value: 200, configurable: true });
                        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(this, 'responseText', { value: '{"message":"success","blocked":true}', configurable: true });
                        Object.defineProperty(this, 'response', { value: '{"message":"success","blocked":true}', configurable: true });
                        this.dispatchEvent(new Event('load'));
                        this.dispatchEvent(new Event('loadend'));
                    }, 50);
                    return;
                }
                return _send.apply(this, args);
            };
        }
    };

    // ---------- trích xuất gợi ý ----------
    function nodeText(node) {
        if (!node) return '';
        let t = '';
        if (node.type === 'image' && node.src) t += ` [Ảnh] `;
        else if (node.type === 'equation' && node.equation) t += ` $${node.equation}$ `;
        else if (node.text) t += node.text;
        if (Array.isArray(node.children)) t += node.children.map(nodeText).join('');
        return t;
    }

    function extractStem(root) {
        const parts = [];
        let stop = false;
        const walk = n => {
            if (stop || !n) return;
            if (n.type === 'olm-list' || n.type === 'fillme-input' || n.name === 'merge-list' || n.name === 'group-list') {
                stop = true; return;
            }
            if (n.type === 'paragraph' || n.type === 'heading') {
                const t = nodeText(n).trim();
                if (t) parts.push(t);
                return;
            }
            if (n.type === 'equation' && n.equation) {
                parts.push(`$${n.equation}$`);
                return;
            }
            if (Array.isArray(n.children)) n.children.forEach(walk);
        };
        if (root.children) root.children.forEach(walk);
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    function scanHints(node, hints, qType) {
        if (!node || typeof node !== 'object') return;

        if ((qType === 21 || qType === 22) && node.correct === true && node.type === 'olm-list-item') {
            const t = nodeText(node).trim();
            if (t) hints.push({ type: 'Bài đọc', text: t });
            return;
        }

        if (node.type === 'olm-input-text' && (node.name === 'selecttext' || node.name === 'dragtext') && node.content) {
            const parts = String(node.content).split('||').map(s => s.trim()).filter(Boolean);
            if (parts.length) hints.push({ type: node.name === 'dragtext' ? 'Kéo thả' : 'Chọn từ', text: parts[0] });
            return;
        }

        if (node.name === 'merge-list' && node.type === 'olm-list' && node.children) {
            node.children.forEach(item => {
                if (item.type !== 'olm-list-item' || !item.children) return;
                const L = item.children.find(c => c.type === 'position-column' && c.position === 'left');
                const R = item.children.find(c => c.type === 'position-column' && c.position === 'right');
                if (L && R) {
                    const a = nodeText(L).trim(), b = nodeText(R).trim();
                    if (a && b) hints.push({ type: 'Ghép nối', text: `${a} ➔ ${b}` });
                }
            });
            return;
        }

        if (node.name === 'sort-list' && node.type === 'olm-list' && node.children) {
            const items = node.children.filter(c => c.type === 'olm-list-item')
                .map(c => nodeText(c).trim()).filter(Boolean);
            if (items.length) hints.push({ type: 'Sắp xếp', text: items.join(' → ') });
            return;
        }

        if (node.name === 'dragmore' && node.type === 'olm-input-text' && node.children) {
            const correct = node.children.filter(c => c.type === 'drag-more-item' && c.correct === true)
                .map(c => nodeText(c).trim()).filter(Boolean);
            if (correct.length) hints.push({ type: 'Kéo thả', text: correct.join(' | ') });
            else {
                const all = node.children.filter(c => c.type === 'drag-more-item')
                    .map(c => nodeText(c).trim()).filter(Boolean);
                if (all.length) hints.push({ type: 'Kéo thả', text: all[0] });
            }
            return;
        }

        if (node.name === 'exp' && (qType === 11 || qType === 18) && node.children) {
            const t = nodeText(node).replace(/^Hư[ơớ]ng d[ẫâ]n gi[aả]i:?/i, '').trim();
            if (t) hints.push({ type: 'Giải thích', text: t });
            return;
        }

        if (qType === 13 && node.name === 'true-false' && node.type === 'olm-list') {
            (node.children || []).forEach(item => {
                if (item.type === 'olm-list-item') {
                    const t = nodeText(item).trim();
                    if (t) hints.push({ type: 'Đúng/Sai', text: t, sub: item.correct ? 'ĐÚNG' : 'SAI' });
                }
            });
            return;
        }

        if (qType === 2 && node.type === 'fillme-input' && node.content) {
            hints.push({ type: 'Điền', text: String(node.content).trim() });
            return;
        }

        if (qType === 10 && node.name === 'group-list' && node.children) {
            node.children.forEach((item, i) => {
                if (item.type !== 'olm-list-item' || !item.children) return;
                const titleNode = item.children.find(c => c.type === 'group-title');
                const title = titleNode ? nodeText(titleNode).trim() : 'Nhóm';
                const ans = item.children.filter(c => c.position === 'group')
                    .map(c => nodeText(c).trim()).filter(Boolean);
                if (ans.length) hints.push({ type: 'Kéo nhóm', text: `${title}: ${ans.join(', ')}`, sub: i + 1 });
            });
            return;
        }

        if ((qType === 2 || qType === 3) && node.type === 'paragraph' && node.children) {
            const first = node.children[0];
            if (first?.text && /^\d+\.\s/.test(first.text.trim())) {
                const m = first.text.trim().match(/^(\d+)\./);
                const num = m ? m[1] : '0';
                const inputs = node.children.filter(c =>
                    (c.type === 'fillme-input' || c.type === 'olm-input-text') && c.content);
                if (inputs.length) {
                    inputs.forEach(inp => hints.push({ type: 'Điền', text: String(inp.content).trim(), sub: num }));
                    return;
                }
            }
        }

        if (node.correct === true && (node.type === 'olm-list-item' || node.type === 'list-item')) {
            const t = nodeText(node).trim();
            if (t) hints.push({ type: 'Trắc nghiệm', text: t });
            return;
        }

        if (Array.isArray(node.children)) node.children.forEach(c => scanHints(c, hints, qType));
    }

    function parseQuestion(q) {
        const hints = [];
        let stem = '';

        if (q.json_content) {
            const data = decodeJsonContent(q.json_content);
            if (data?.root) {
                stem = extractStem(data.root);
                scanHints(data.root, hints, q.q_type);
            }
        }

        if (q.content) {
            const html = decodeB64(q.content);
            if (html) {
                const div = document.createElement('div');
                div.innerHTML = html;
                div.querySelectorAll('.correctAnswer, .correct-answer').forEach(el => {
                    const t = el.textContent.trim();
                    if (t) hints.push({ type: 'Gợi ý', text: t });
                });
            }
        }

        const seen = new Set();
        return {
            stem,
            hints: hints.filter(h => {
                const k = (h.text || '').toLowerCase();
                if (!k || seen.has(k)) return false;
                seen.add(k);
                return true;
            })
        };
    }

    // ---------- UI ----------
    const styleMap = {
        'Trắc nghiệm': '#22c55e',
        'Đúng/Sai': '#f59e0b',
        'Điền': '#ef4444',
        'Bài đọc': '#a855f7',
        'Chọn từ': '#06b6d4',
        'Ghép nối': '#ec4899',
        'Kéo thả': '#14b8a6',
        'Sắp xếp': '#f97316',
        'Giải thích': '#64748b',
        'Kéo nhóm': '#8b5cf6',
        'Gợi ý': '#6366f1'
    };

    const iconMap = {
        'Trắc nghiệm': '✅',
        'Đúng/Sai': '⚖️',
        'Điền': '✏️',
        'Bài đọc': '📚',
        'Chọn từ': '🔽',
        'Ghép nối': '🔗',
        'Kéo thả': '🎯',
        'Sắp xếp': '🔢',
        'Giải thích': '💡',
        'Kéo nhóm': '📦',
        'Gợi ý': '💬'
    };

    class MobilePanel {
        constructor() {
            this.collapsed = GM_getValue('olm_collapsed', false);
            this.pos = GM_getValue('olm_pos', { x: 10, y: 80 });
            this.el = null;
            this.body = null;
            this.summary = null;
            this.fab = null;
        }

        mount() {
            this.el = this._build();
            this._wire();
            document.body.appendChild(this.el);
            this._applyCollapse(true);
        }

        _build() {
            // toggle buttons
            const collapseBtn = mk('button', { className: 'om-btn', text: '−' });
            const closeBtn = mk('button', { className: 'om-btn', text: '×' });
            const mathBtn = mk('button', { className: 'om-btn', text: '∑' });
            const infoBtn = mk('button', { className: 'om-btn', text: 'ℹ' });

            collapseBtn.onclick = e => { e.stopPropagation(); this.toggle(); };
            closeBtn.onclick = () => this.hide();
            mathBtn.onclick = () => this.renderMath();
            infoBtn.onclick = () => alert(
                `OLM Mobile v${CONFIG.version}\n` +
                `Chặn nộp: ${submitBlock.on ? 'BẬT' : 'TẮT'}\n` +
                `Fake time: ${timeHack.on ? 'BẬT' : 'TẮT'} (${fmtTime(timeHack.seconds)})`
            );

            const title = mk('div', {
                className: 'om-title',
                children: [
                    mk('span', { text: 'OLM Mobile' }),
                    mk('span', { className: 'om-tag', text: 'FREE' })
                ]
            });

            const header = mk('div', {
                className: 'om-header',
                children: [title, mk('div', { className: 'om-actions', children: [mathBtn, infoBtn, collapseBtn, closeBtn] })]
            });

            this.summary = mk('div', {
                className: 'om-summary',
                children: [
                    this._stat('Câu', '0', 'om-s-q'),
                    this._stat('Gợi ý', '0', 'om-s-h'),
                    this._stat('Trạng thái', 'Chờ...', 'om-s-st')
                ]
            });

            // time row
            const timeInput = mk('input', {
                className: 'om-time-input',
                attrs: { type: 'number', min: '30', max: '3600', step: '10', value: String(timeHack.seconds) }
            });
            timeInput.addEventListener('change', () => {
                const v = parseInt(timeInput.value, 10) || 480;
                timeHack.set(v);
                timeInput.value = String(timeHack.seconds);
                preview.textContent = fmtTime(timeHack.seconds);
            });

            const preview = mk('span', { className: 'om-time-preview', text: fmtTime(timeHack.seconds) });

            const randomBtn = mk('button', { className: 'om-mini', text: '7-10p' });
            randomBtn.onclick = e => {
                e.stopPropagation();
                const s = timeHack.random();
                timeInput.value = String(s);
                preview.textContent = fmtTime(s);
            };

            const timeRow = mk('div', {
                className: 'om-time-row',
                children: [
                    mk('span', { text: '⏱️', style: { fontSize: '15px' } }),
                    timeInput,
                    mk('span', { text: 's', style: { fontSize: '11px', color: '#9ca3af' } }),
                    preview,
                    randomBtn
                ]
            });

            // footer
            const blockBtn = mk('button', { className: 'om-foot-btn om-block-on', text: '🚫 Chặn nộp' });
            blockBtn.onclick = e => {
                e.stopPropagation();
                submitBlock.on = !submitBlock.on;
                blockBtn.textContent = submitBlock.on ? '🚫 Chặn nộp' : '✅ Cho nộp';
                blockBtn.className = 'om-foot-btn ' + (submitBlock.on ? 'om-block-on' : 'om-block-off');
            };

            const timeBtn = mk('button', { className: 'om-foot-btn om-time-on', text: '⏱️ Time ON' });
            timeBtn.onclick = e => {
                e.stopPropagation();
                timeHack.on = !timeHack.on;
                timeBtn.textContent = timeHack.on ? '⏱️ Time ON' : '⏱️ Time OFF';
                timeBtn.className = 'om-foot-btn ' + (timeHack.on ? 'om-time-on' : 'om-time-off');
            };

            const clearBtn = mk('button', { className: 'om-foot-btn om-clear', text: '🧹 Xóa' });
            clearBtn.onclick = () => this.clear();

            const footer = mk('div', {
                className: 'om-footer',
                children: [timeBtn, blockBtn, clearBtn]
            });

            this.body = mk('div', { className: 'om-body' });

            return mk('div', {
                id: 'olm-mobile',
                className: 'om-root',
                style: { left: this.pos.x + 'px', top: this.pos.y + 'px' },
                children: [header, this.summary, timeRow, this.body, footer]
            });
        }

        _stat(label, val, cls) {
            return mk('div', {
                className: 'om-stat ' + cls,
                children: [
                    mk('div', { className: 'om-stat-label', text: label }),
                    mk('div', { className: 'om-stat-value', text: val })
                ]
            });
        }

        _wire() {
            const header = this.el.querySelector('.om-header');
            header.addEventListener('dblclick', () => this.toggle());
            header.addEventListener('click', () => { if (this.collapsed) this.toggle(); });
            this._drag(header);
        }

        _drag(handle) {
            let dragging = false, sx, sy, ox, oy;

            const start = e => {
                if (e.target.closest('.om-btn') || e.target.closest('.om-mini') ||
                    e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                dragging = true;
                this.el.classList.add('om-dragging');
                const t = e.touches ? e.touches[0] : e;
                sx = t.clientX; sy = t.clientY;
                const r = this.el.getBoundingClientRect();
                ox = r.left; oy = r.top;
                document.addEventListener('mousemove', move, { passive: false });
                document.addEventListener('touchmove', move, { passive: false });
                document.addEventListener('mouseup', end);
                document.addEventListener('touchend', end);
                e.preventDefault();
            };

            const move = e => {
                if (!dragging) return;
                const t = e.touches ? e.touches[0] : e;
                const nx = Math.max(6, Math.min(ox + t.clientX - sx, window.innerWidth - this.el.offsetWidth - 6));
                const ny = Math.max(6, Math.min(oy + t.clientY - sy, window.innerHeight - this.el.offsetHeight - 6));
                this.el.style.left = nx + 'px';
                this.el.style.top = ny + 'px';
                e.preventDefault();
            };

            const end = () => {
                if (!dragging) return;
                dragging = false;
                this.el.classList.remove('om-dragging');
                document.removeEventListener('mousemove', move);
                document.removeEventListener('touchmove', move);
                document.removeEventListener('mouseup', end);
                document.removeEventListener('touchend', end);
                const r = this.el.getBoundingClientRect();
                this.pos = { x: r.left, y: r.top };
                GM_setValue('olm_pos', this.pos);
            };

            handle.addEventListener('mousedown', start);
            handle.addEventListener('touchstart', start);
        }

        toggle() {
            this.collapsed = !this.collapsed;
            this._applyCollapse();
            GM_setValue('olm_collapsed', this.collapsed);
        }

        _applyCollapse(initial) {
            if (!initial) this.el.style.transition = 'all .22s ease';
            this.el.classList.toggle('om-collapsed', this.collapsed);
            const btn = this.el.querySelector('.om-btn');
            if (btn) btn.textContent = this.collapsed ? '+' : '−';
            if (!initial) setTimeout(() => { this.el.style.transition = ''; }, 240);
        }

        hide() { if (this.el) this.el.style.display = 'none'; }
        show() { if (this.el) this.el.style.display = 'flex'; }

        clear() {
            this.body.innerHTML = '';
            this.body.appendChild(mk('div', { className: 'om-empty', text: '🔍 Đang chờ dữ liệu câu hỏi...' }));
            this.updateStats(0, 0, 'Chờ...');
        }

        updateStats(q, h, st) {
            const set = (cls, val) => {
                const el = this.summary.querySelector('.' + cls + ' .om-stat-value');
                if (el) el.textContent = val;
            };
            set('om-s-q', fmtNum(q));
            set('om-s-h', fmtNum(h));
            set('om-s-st', st);
        }

        addItem({ title, stem, hints }) {
            if (!this.body) return;
            const empty = this.body.querySelector('.om-empty');
            if (empty) empty.remove();

            const list = hints.length
                ? mk('div', {
                    className: 'om-list',
                    children: hints.map(h => this._hintNode(h))
                })
                : mk('div', { className: 'om-nohint', text: 'Không có gợi ý.' });

            const stemBox = stem ? mk('div', {
                className: 'om-stem',
                html: '<b>📖 Đề:</b> ' + latexToText(stem).replace(/\n/g, '<br>')
            }) : null;

            const block = mk('div', {
                className: 'om-item',
                children: [
                    mk('div', { className: 'om-item-title', text: '📝 ' + latexToText(title) }),
                    stemBox,
                    list
                ].filter(Boolean)
            });
            this.body.appendChild(block);
        }

        _hintNode(h) {
            const color = styleMap[h.type] || '#6366f1';
            const icon = iconMap[h.type] || '•';

            let html = latexToText(h.text);
            if (h.type === 'Đúng/Sai' && h.sub) {
                const c = h.sub === 'ĐÚNG' ? '#22c55e' : '#ef4444';
                html = `<b style="color:${c}">${h.sub === 'ĐÚNG' ? '✅ ĐÚNG' : '❌ SAI'}</b> — ${html}`;
            }

            return mk('div', {
                className: 'om-hint',
                style: { borderLeftColor: color },
                children: [
                    mk('span', { className: 'om-hint-type', text: icon, style: { color } }),
                    mk('span', { className: 'om-hint-text', html })
                ]
            });
        }

        renderMath() {
            const go = () => {
                try {
                    if (unsafeWindow.MathJax?.typesetPromise) {
                        unsafeWindow.MathJax.typesetPromise([this.body]).catch(() => {});
                    }
                } catch (e) {}
            };
            if (unsafeWindow.MathJax) return go();
            unsafeWindow.MathJax = {
                tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
                svg: { fontCache: 'global' }
            };
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
            s.async = true;
            s.onload = go;
            document.head.appendChild(s);
        }
    }

    // ---------- ứng dụng ----------
    const app = {
        panel: null,

        boot() {
            this._injectStyles();
            this.panel = new MobilePanel();
            this.panel.mount();
            this.panel.clear();
        },

        async process(raw) {
            const parsed = raw.map(q => {
                const p = parseQuestion(q);
                return { q, stem: p.stem, hints: p.hints };
            });
            const total = parsed.reduce((s, x) => s + x.hints.length, 0);

            this.panel.clear();
            this.panel.show();
            this.panel.updateStats(parsed.length, total, 'Đã lấy dữ liệu');

            let fallback = 1;
            for (const item of parsed) {
                const q = item.q;
                const baseTitle = (q.title && String(q.title).trim())
                    || (q._id ? 'ID: ' + String(q._id).slice(-4) : (q.id || '?'));

                const hasSub = item.hints.some(h => h.sub);
                const isReading = (q.q_type === 21 || q.q_type === 22);

                if (isReading) {
                    const idxs = q._displayIndices || [];
                    let c = 0;
                    if (!item.hints.length) {
                        const i = idxs[0] || fallback++;
                        this.panel.addItem({ title: `Câu ${i}: ${baseTitle}`, stem: item.stem, hints: [] });
                    } else {
                        for (const h of item.hints) {
                            const i = idxs[c] || (idxs[0] ? idxs[0] + c : fallback);
                            this.panel.addItem({
                                title: `Câu ${i}: ${baseTitle}`,
                                stem: c === 0 ? item.stem : '',
                                hints: [h]
                            });
                            c++;
                        }
                        fallback = (idxs[idxs.length - 1] || fallback) + 1;
                    }
                    await new Promise(r => setTimeout(r, 8));
                    continue;
                }

                if (!hasSub) {
                    const i = q._displayIndex || fallback++;
                    this.panel.addItem({
                        title: `Câu ${i}: ${baseTitle}`,
                        stem: item.stem,
                        hints: item.hints || []
                    });
                } else {
                    const grouped = {};
                    item.hints.forEach(h => {
                        const k = h.sub || 'general';
                        (grouped[k] = grouped[k] || []).push(h);
                    });

                    const idxs = q._displayIndices || [];
                    let counter = 0;

                    for (const sub in grouped) {
                        const list = grouped[sub];
                        if (!list.length) continue;

                        let i;
                        if (sub !== 'general' && !isNaN(parseInt(sub))) i = sub;
                        else if (idxs.length) i = idxs[counter] || (idxs[0] + counter);
                        else i = (q._displayIndex || fallback) + counter;

                        if (list.length > 1 && list.every(h => h.type === 'Điền')) {
                            list[0].text = list.map(h => h.text).join(' | ');
                            list.splice(1);
                        }

                        this.panel.addItem({
                            title: `Câu ${i}: ${baseTitle}`,
                            stem: counter === 0 ? item.stem : '',
                            hints: list
                        });
                        counter++;
                    }
                    fallback += counter;
                }

                await new Promise(r => setTimeout(r, 8));
            }
        },

        _injectStyles() {
            GM_addStyle(`
                #olm-mobile, #olm-mobile * {
                    box-sizing: border-box;
                    -webkit-tap-highlight-color: transparent;
                }
                #olm-mobile {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: fixed;
                    width: min(94vw, 420px);
                    height: min(78vh, 640px);
                    display: flex;
                    flex-direction: column;
                    z-index: 2147483645;
                    border-radius: 16px;
                    overflow: hidden;
                    background: linear-gradient(160deg, #0f172a, #020617);
                    border: 1px solid rgba(148, 163, 184, 0.5);
                    box-shadow: 0 20px 50px rgba(0, 0, 0, .6);
                    color: #e2e8f0;
                    animation: omIn .3s ease-out;
                }
                @keyframes omIn {
                    from { opacity: 0; transform: translateY(12px) scale(.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                #olm-mobile.om-dragging { transition: none !important; }

                .om-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 12px;
                    height: 52px;
                    flex-shrink: 0;
                    background: linear-gradient(90deg, rgba(15, 23, 42, .95), rgba(30, 41, 59, .7));
                    border-bottom: 1px solid rgba(148, 163, 184, .35);
                    cursor: grab;
                    user-select: none; -webkit-user-select: none;
                    touch-action: none;
                }
                .om-header:active { cursor: grabbing; }

                .om-title {
                    display: flex; align-items: center; gap: 6px;
                    font-weight: 700; font-size: 14px;
                    background: linear-gradient(135deg, #60a5fa, #a855f7);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .om-tag {
                    -webkit-text-fill-color: white;
                    background: #22c55e; color: white;
                    padding: 2px 6px; border-radius: 999px;
                    font-size: 9px; font-weight: 800;
                }

                .om-actions { display: flex; gap: 4px; }
                .om-btn {
                    width: 34px; height: 34px;
                    border: none; border-radius: 10px;
                    background: rgba(51, 65, 85, .85);
                    color: #cbd5e1;
                    font-size: 16px; font-weight: 600;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all .15s;
                    padding: 0;
                }
                .om-btn:active { transform: scale(.92); background: rgba(71, 85, 105, .95); }

                .om-summary {
                    display: flex; gap: 6px;
                    padding: 8px 10px;
                    background: rgba(15, 23, 42, .9);
                    border-bottom: 1px solid rgba(148, 163, 184, .3);
                    flex-shrink: 0;
                }
                .om-stat {
                    flex: 1;
                    padding: 6px 8px;
                    border-radius: 10px;
                    background: rgba(30, 41, 59, .8);
                    border: 1px solid rgba(148, 163, 184, .4);
                    min-width: 0;
                }
                .om-s-q { border-color: rgba(59, 130, 246, .7); }
                .om-s-h { border-color: rgba(16, 185, 129, .7); }
                .om-s-st { border-style: dashed; }
                .om-stat-label {
                    font-size: 9px; text-transform: uppercase;
                    color: #94a3b8; letter-spacing: .4px;
                    margin-bottom: 2px;
                }
                .om-stat-value {
                    font-size: 13px; font-weight: 600;
                    color: #f1f5f9;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .om-s-st .om-stat-value { font-size: 11px; }

                .om-time-row {
                    display: flex; align-items: center; gap: 6px;
                    padding: 8px 10px;
                    background: rgba(15, 23, 42, .85);
                    border-bottom: 1px solid rgba(148, 163, 184, .25);
                    flex-shrink: 0;
                }
                .om-time-input {
                    width: 66px; padding: 7px 6px;
                    border-radius: 8px;
                    border: 1px solid rgba(99, 102, 241, .6);
                    background: rgba(2, 6, 23, .95);
                    color: #e2e8f0;
                    font-size: 13px; text-align: center;
                    font-family: ui-monospace, monospace;
                    outline: none;
                }
                .om-time-input:focus { border-color: #818cf8; box-shadow: 0 0 0 2px rgba(99, 102, 241, .3); }
                .om-time-input::-webkit-outer-spin-button,
                .om-time-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .om-time-input { -moz-appearance: textfield; }

                .om-time-preview {
                    flex: 1;
                    font-size: 11px;
                    color: #a5b4fc;
                    background: rgba(99, 102, 241, .15);
                    padding: 6px 8px;
                    border-radius: 7px;
                    font-family: ui-monospace, monospace;
                    text-align: center;
                    min-width: 0;
                }

                .om-mini {
                    padding: 7px 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(129, 140, 248, .5);
                    background: rgba(99, 102, 241, .2);
                    color: #c7d2fe;
                    font-size: 11px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all .15s;
                }
                .om-mini:active { transform: scale(.94); background: rgba(99, 102, 241, .35); }

                .om-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    -webkit-overflow-scrolling: touch;
                }
                .om-body::-webkit-scrollbar { width: 5px; }
                .om-body::-webkit-scrollbar-track { background: transparent; }
                .om-body::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #6366f1, #a855f7);
                    border-radius: 999px;
                }

                .om-empty {
                    text-align: center;
                    padding: 50px 16px;
                    color: #94a3b8;
                    font-size: 13px;
                }
                .om-nohint {
                    text-align: center;
                    padding: 10px;
                    color: #94a3b8;
                    font-size: 12px;
                }

                .om-item {
                    margin-bottom: 10px;
                    padding: 10px;
                    border-radius: 12px;
                    background: rgba(30, 41, 59, .75);
                    border: 1px solid rgba(148, 163, 184, .35);
                }
                .om-item-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 6px;
                    word-break: break-word;
                }
                .om-stem {
                    padding: 8px 10px;
                    margin-bottom: 8px;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #cbd5e1;
                    background: rgba(59, 130, 246, .1);
                    border-left: 3px solid #60a5fa;
                    border-radius: 8px;
                    word-break: break-word;
                }
                .om-list { display: flex; flex-direction: column; gap: 5px; }

                .om-hint {
                    display: flex;
                    gap: 7px;
                    align-items: flex-start;
                    padding: 8px 9px;
                    border-radius: 9px;
                    background: rgba(15, 23, 42, .85);
                    border-left: 3px solid #6366f1;
                    font-size: 12.5px;
                    line-height: 1.45;
                    color: #e2e8f0;
                    word-break: break-word;
                }
                .om-hint-type { flex-shrink: 0; font-size: 14px; line-height: 1.2; }
                .om-hint-text { flex: 1; min-width: 0; }

                .om-footer {
                    display: flex; gap: 6px;
                    padding: 8px 10px;
                    border-top: 1px solid rgba(148, 163, 184, .3);
                    background: rgba(15, 23, 42, .95);
                    flex-shrink: 0;
                }
                .om-foot-btn {
                    flex: 1;
                    padding: 10px 4px;
                    border-radius: 9px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1px solid;
                    transition: all .15s;
                    white-space: nowrap;
                    text-align: center;
                }
                .om-foot-btn:active { transform: scale(.95); }
                .om-block-on { background: rgba(220, 38, 38, .2); color: #fecaca; border-color: rgba(248, 113, 113, .5); }
                .om-block-off { background: rgba(34, 197, 94, .2); color: #bbf7d0; border-color: rgba(74, 222, 128, .5); }
                .om-time-on { background: rgba(99, 102, 241, .2); color: #c7d2fe; border-color: rgba(129, 140, 248, .5); }
                .om-time-off { background: rgba(107, 114, 128, .2); color: #d1d5db; border-color: rgba(156, 163, 175, .5); }
                .om-clear { background: rgba(30, 41, 59, .9); color: #cbd5e1; border-color: rgba(148, 163, 184, .4); }

                #olm-mobile.om-collapsed {
                    width: 56px !important;
                    height: 56px !important;
                    border-radius: 50%;
                    cursor: pointer;
                }
                #olm-mobile.om-collapsed .om-summary,
                #olm-mobile.om-collapsed .om-time-row,
                #olm-mobile.om-collapsed .om-body,
                #olm-mobile.om-collapsed .om-footer,
                #olm-mobile.om-collapsed .om-actions .om-btn:not(:first-child),
                #olm-mobile.om-collapsed .om-title { display: none; }
                #olm-mobile.om-collapsed .om-header {
                    height: 100%;
                    padding: 0;
                    justify-content: center;
                    border: none;
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                }
                #olm-mobile.om-collapsed .om-actions { width: 100%; justify-content: center; }
                #olm-mobile.om-collapsed .om-actions .om-btn {
                    background: transparent;
                    width: 100%; height: 100%;
                    font-size: 22px;
                    color: white;
                }

                @media (max-height: 500px) {
                    #olm-mobile { height: 92vh; }
                }
            `);
        }
    };

    // ---------- hook API ----------
    const apiHook = {
        ready: false,
        boot(cb) {
            if (this.ready) return;
            this.ready = true;
            this._hookFetch(cb);
            this._hookXHR(cb);
        },

        _extract(text, url) {
            if (!CONFIG.apiKeywords.some(k => url.includes(k))) return null;
            try {
                const d = JSON.parse(text);
                const q = d?.questions || d;
                if (Array.isArray(q) && q.length) return q;
            } catch (e) {}
            return null;
        },

        _hookFetch(cb) {
            const _f = unsafeWindow.fetch;
            if (!_f) return;
            unsafeWindow.fetch = async function (...args) {
                const res = await _f.apply(this, args);
                const url = args[0] instanceof Request ? args[0].url : args[0];
                if (res?.ok) {
                    res.clone().text().then(t => {
                        const q = apiHook._extract(t, url);
                        if (q) cb(q);
                    }).catch(() => {});
                }
                return res;
            };
        },

        _hookXHR(cb) {
            const _send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...args) {
                this.addEventListener('load', () => {
                    if (this.status === 200) {
                        const q = apiHook._extract(this.responseText, this.responseURL || '');
                        if (q) cb(q);
                    }
                });
                return _send.apply(this, args);
            };
        }
    };

    // ---------- khởi động ----------
    function boot() {
        try {
            timeHack.start();
            submitBlock.start();
            app.boot();
            apiHook.boot(app.process.bind(app));
        } catch (e) {
            console.error('[OLM Mobile] boot error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();