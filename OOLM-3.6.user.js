// ==UserScript==
// @name         OOLM-3.6 by Vyrnox
// @namespace    vyrnox.olm
// @version      3.7.0
// @description  Xem đáp án OLM, chặn nộp, spoof thời gian, bypass chặn mobile.
// @author       Vyrnox
// @match        https://olm.vn/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ================== BYPASS MOBILE BLOCK ==================
    (function BypassMobileBlock() {
        let W = window;
        try {
            if (typeof unsafeWindow !== 'undefined') {
                W = unsafeWindow;
                if (W.wrappedJSObject) W = W.wrappedJSObject;
            }
        } catch (e) {
            console.warn('[Bypass] không lấy được unsafeWindow:', e);
        }

        const TARGET_WIDTH = 1920;
        const TARGET_HEIGHT = 1080;

        function log(...a) {
            try { console.log('%c[Bypass]', 'color:#22c55e;font-weight:bold', ...a); } catch (e) {}
        }
        function safe(fn, label) {
            try { fn(); } catch (e) { console.warn('[Bypass] fail:', label, e); }
        }

        // ========== 1. Ép _webview = 1 (chìa khóa) ==========
        safe(() => {
            const force = () => {
                try { if (W._webview !== 1) W._webview = 1; } catch (e) {}
            };
            force();
            setInterval(force, 200);
            log('_webview = 1');
        }, '_webview');

        // ========== 2. innerWidth / innerHeight ==========
        safe(() => {
            Object.defineProperty(W, 'innerWidth', { get: () => TARGET_WIDTH, configurable: true });
            Object.defineProperty(W, 'outerWidth', { get: () => TARGET_WIDTH, configurable: true });
            Object.defineProperty(W, 'innerHeight', { get: () => TARGET_HEIGHT, configurable: true });
            Object.defineProperty(W, 'outerHeight', { get: () => TARGET_HEIGHT, configurable: true });
        }, 'innerWidth');

        // ========== 3. matchMedia ==========
        safe(() => {
            const origMM = W.matchMedia;
            if (!origMM) return;
            const fakeMQL = (query, matches) => ({
                matches, media: query, onchange: null,
                addListener: () => {}, removeListener: () => {},
                addEventListener: () => {}, removeEventListener: () => {},
                dispatchEvent: () => false
            });
            W.matchMedia = function (query) {
                if (typeof query !== 'string') return origMM.call(W, query);
                const q = query.toLowerCase();
                if (/max-width|max-height/.test(q)) return fakeMQL(query, false);
                if (/pointer\s*:\s*coarse/.test(q)) return fakeMQL(query, false);
                if (/hover\s*:\s*none/.test(q)) return fakeMQL(query, false);
                if (/orientation\s*:\s*portrait/.test(q)) return fakeMQL(query, false);
                if (/touch/.test(q)) return fakeMQL(query, false);
                return origMM.call(W, query);
            };
        }, 'matchMedia');

        // ========== 4. Element clientWidth/offsetWidth ==========
        safe(() => {
            const patch = (proto, prop, val) => {
                const orig = Object.getOwnPropertyDescriptor(proto, prop);
                if (!orig || !orig.get) return;
                Object.defineProperty(proto, prop, {
                    configurable: true,
                    get() {
                        if (this === document.documentElement || this === document.body) return val;
                        return orig.get.call(this);
                    }
                });
            };
            ['clientWidth', 'offsetWidth', 'scrollWidth'].forEach(p => patch(Element.prototype, p, TARGET_WIDTH));
            ['clientHeight', 'offsetHeight'].forEach(p => patch(Element.prototype, p, TARGET_HEIGHT));
        }, 'clientWidth');

        // ========== 5. screen ==========
        safe(() => {
            const s = W.screen;
            Object.defineProperty(s, 'width', { get: () => TARGET_WIDTH, configurable: true });
            Object.defineProperty(s, 'height', { get: () => TARGET_HEIGHT, configurable: true });
            Object.defineProperty(s, 'availWidth', { get: () => TARGET_WIDTH, configurable: true });
            Object.defineProperty(s, 'availHeight', { get: () => TARGET_HEIGHT, configurable: true });
        }, 'screen');

        // ========== 6. devicePixelRatio ==========
        safe(() => {
            Object.defineProperty(W, 'devicePixelRatio', { get: () => 1, configurable: true });
        }, 'dpr');

        // ========== 7. _is_mobile / _isMobile ==========
        safe(() => {
            const install = () => {
                if (!W._isMobile) return false;
                W._isMobile = function () {
                    return {
                        Android: () => false, BlackBerry: () => false,
                        iOS: () => false, Opera: () => false,
                        Windows: () => false, any: () => false
                    };
                };
                return true;
            };
            if (!install()) {
                const t = setInterval(() => { if (install()) clearInterval(t); }, 100);
                setTimeout(() => clearInterval(t), 10000);
            }
        }, '_isMobile');

        // ========== 8. Patch store exam — QUAN TRỌNG NHẤT ==========
        safe(() => {
            const patched = new WeakSet();

            const patchStore = () => {
                try {
                    document.querySelectorAll('[id^="exam-hierarchy-container"]').forEach(c => {
                        const rootKey = Object.keys(c).find(k => k.startsWith('__reactContainer'));
                        if (!rootKey) return;
                        const rootFiber = c[rootKey];

                        let storeFiber = null;
                        const find = (f) => {
                            if (!f || storeFiber) return;
                            if (f.type?.name === 'CategoryStoreProvider') { storeFiber = f; return; }
                            find(f.child);
                            find(f.sibling);
                        };
                        find(rootFiber);

                        const store = storeFiber?.memoizedProps?.currentStore;
                        if (!store || patched.has(store)) return;
                        patched.add(store);
                        W.__oolmStore = store;

                        const fix = () => {
                            try {
                                const s = store.getState();
                                if (s.asubmit > 0) {
                                    store.setState({ asubmit: 0 });
                                    log('set asubmit = 0');
                                }
                            } catch (e) {}
                        };
                        fix();
                        store.subscribe(fix);
                        log('Đã patch store exam');
                    });
                } catch (e) {}
            };

            setTimeout(patchStore, 300);
            setInterval(patchStore, 1000);
        }, 'store-patch');

        // ========== 9. Chặn resize listener (chỉ trước khi panel mount) ==========
        safe(() => {
            const origAdd = W.addEventListener.bind(W);
            W.addEventListener = function (type, listener, opts) {
                if ((type === 'resize' || type === 'orientationchange') && !W.__oolmAllowResize) {
                    return;
                }
                return origAdd(type, listener, opts);
            };
        }, 'addEventListener');

        // ========== 10. DEBUG ==========
        safe(() => {
            log(`innerWidth=${W.innerWidth} matchMedia=${W.matchMedia('(max-width: 1024px)').matches} _webview=${W._webview}`);
        }, 'debug');

        try { W.__oolmBypass = { log }; } catch (e) {}
    })();

    // ==================== CONFIG ====================
    const CONFIG = {
        VERSION: '3.7.0',
        API_KEYWORDS: ['get-question-of-ids', 'get-question?belongs=1'],
        XOR_KEY: '1047823200',
        SUBMIT_ENDPOINTS: ['/course/teacher-static', '/teacher-static']
    };

    const VP = {
        get w() {
            if (window.visualViewport && window.visualViewport.width) return window.visualViewport.width;
            if (screen && screen.width) return screen.width;
            return 1024;
        },
        get h() {
            if (window.visualViewport && window.visualViewport.height) return window.visualViewport.height;
            if (screen && screen.height) return screen.height;
            return 768;
        }
    };

    // ==================== LATEX → UNICODE ====================
    const Latex = {
        SYMBOLS: {
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
        },
        FUNCTIONS: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc',
                    'arcsin', 'arccos', 'arctan',
                    'sinh', 'cosh', 'tanh',
                    'log', 'ln', 'lim', 'limsup', 'liminf', 'max', 'min',
                    'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd', 'lcm'],
        SUP: {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
            'n': 'ⁿ', 'i': 'ⁱ', '*': '∗', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ',
            'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ',
            'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ',
            's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ',
            'y': 'ʸ', 'z': 'ᶻ'
        },
        SUB: {
            '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
            '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
            '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
            'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
            'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
            'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
            'v': 'ᵥ', 'x': 'ₓ'
        },
        _toSup(str) { return str.split('').map(c => this.SUP[c] || c).join(''); },
        _toSub(str) { return str.split('').map(c => this.SUB[c] || c).join(''); },
        convert(input) {
            if (!input || typeof input !== 'string') return input;
            let s = input;
            s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
            s = s.replace(/\$([^$\n]*?)\$/g, '$1');
            s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
            s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
            let prev;
            do {
                prev = s;
                s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
            } while (s !== prev);
            s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g, (_, n, x) => this._toSup(n) + '√(' + x + ')');
            s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
            s = s.replace(/\^\{([^{}]*)\}/g, (_, c) => this._toSup(c));
            s = s.replace(/_\{([^{}]*)\}/g, (_, c) => this._toSub(c));
            s = s.replace(/\^([0-9a-zA-Z+\-=()n])/g, (_, c) => this._toSup(c));
            s = s.replace(/_([0-9a-zA-Z+\-=()])/g, (_, c) => this._toSub(c));
            s = s.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|operatorname)\{([^{}]*)\}/g, '$1');
            s = s.replace(/\\left/g, '').replace(/\\right/g, '');
            s = s.replace(/\\vec\{([^{}]*)\}/g, '$1\u20D7');
            s = s.replace(/\\overline\{([^{}]*)\}/g, '$1\u0305');
            s = s.replace(/\\underline\{([^{}]*)\}/g, '$1\u0332');
            s = s.replace(/\\hat\{([^{}]*)\}/g, '$1\u0302');
            s = s.replace(/\\bar\{([^{}]*)\}/g, '$1\u0304');
            s = s.replace(/\\tilde\{([^{}]*)\}/g, '$1\u0303');
            s = s.replace(/\\dot\{([^{}]*)\}/g, '$1\u0307');
            this.FUNCTIONS.forEach(fn => {
                s = s.replace(new RegExp('\\\\' + fn + '\\b', 'g'), fn);
            });
            const keys = Object.keys(this.SYMBOLS).sort((a, b) => b.length - a.length);
            for (const k of keys) s = s.split(k).join(this.SYMBOLS[k]);
            s = s.replace(/\\[a-zA-Z]+/g, '');
            s = s.replace(/[ \t]+/g, ' ').trim();
            return s;
        }
    };

    // ==================== UTILS ====================
    const Utils = {
        decodeBase64(base64) {
            if (!base64) return null;
            try {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return new TextDecoder('utf-8').decode(bytes);
            } catch (e) { return null; }
        },
        xorDecrypt(bytes, key) {
            const keyBytes = new TextEncoder().encode(key);
            const keyLen = keyBytes.length;
            const out = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyLen];
            return out;
        },
        decodeJsonContent(encoded) {
            if (!encoded) return null;
            try {
                if (typeof encoded === 'object') return encoded;
                const trimmed = String(encoded).trim();
                if (trimmed.startsWith('{')) return JSON.parse(trimmed);
                const binary = atob(trimmed);
                const raw = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);
                const decrypted = this.xorDecrypt(raw, CONFIG.XOR_KEY);
                let text = new TextDecoder('utf-8', { fatal: false }).decode(decrypted);
                try { text = decodeURIComponent(text); } catch (e) {}
                try { text = decodeURIComponent(escape(text)); } catch (e) {}
                return JSON.parse(text);
            } catch (e) { return null; }
        },
        createElement(tag, { id, className, style, children, innerHTML, ...attrs } = {}) {
            const el = document.createElement(tag);
            if (id) el.id = id;
            if (className) el.className = className;
            if (style) Object.assign(el.style, style);
            if (innerHTML !== undefined) el.innerHTML = innerHTML;
            Object.keys(attrs).forEach(k => {
                const v = attrs[k];
                if (v != null) el.setAttribute(k, v);
            });
            if (children && Array.isArray(children)) {
                children.forEach(child => {
                    if (child == null || child === false) return;
                    if (typeof child === 'string' || typeof child === 'number') {
                        el.appendChild(document.createTextNode(String(child)));
                    } else if (child.nodeType) {
                        el.appendChild(child);
                    }
                });
            }
            return el;
        },
        sleep: ms => new Promise(r => setTimeout(r, ms)),
        formatNumber: n => (typeof n === 'number' ? n.toLocaleString('vi-VN') : '0'),
        formatTime: s => `${Math.floor(s / 60)}p${String(s % 60).padStart(2, '0')}s`
    };

    // ==================== TIME SPOOF ====================
    const TimeSpoof = {
        enabled: true,
        seconds: GM_getValue('oolm_time_seconds', 480),
        init() {
            this._hookFetch();
            this._hookXHR();
        },
        setSeconds(s) {
            this.seconds = Math.max(30, Math.min(Math.round(s), 3600));
            GM_setValue('oolm_time_seconds', this.seconds);
            return this.seconds;
        },
        random7to10() {
            const s = 420 + Math.floor(Math.random() * 181);
            this.setSeconds(s);
            return s;
        },
        _spoofPayload(body) {
            if (!body || typeof body !== 'string') return body;
            try {
                const params = new URLSearchParams(body);
                if (!params.has('time_spent') && !params.has('time_init')) return body;
                const spoofed = this.seconds;
                const now = Math.floor(Date.now() / 1000);
                params.set('time_spent', String(spoofed));
                params.set('time_init', String(now - spoofed - 5));
                params.set('time_stored', String(now));
                params.set('date_end', String(now - 3));
                if (params.has('data_log')) {
                    try {
                        const log = JSON.parse(params.get('data_log'));
                        const n = log.length;
                        if (n > 0) {
                            const perQ = Math.floor(spoofed / n);
                            log.forEach(entry => {
                                const jitter = 0.7 + Math.random() * 0.6;
                                entry.time_spent = Math.max(15, Math.round(perQ * jitter));
                                if (entry.q_params) {
                                    try {
                                        const qp = JSON.parse(entry.q_params);
                                        qp.time = Math.round(perQ * 1000 * jitter * 0.8);
                                        entry.q_params = JSON.stringify(qp);
                                    } catch (e) {}
                                }
                            });
                        }
                        params.set('data_log', JSON.stringify(log));
                    } catch (e) {}
                }
                return params.toString();
            } catch (e) { return body; }
        },
        _isSubmitUrl(url) {
            return url && CONFIG.SUBMIT_ENDPOINTS.some(e => url.includes(e));
        },
        _hookFetch() {
            const orig = unsafeWindow.fetch;
            if (!orig) return;
            unsafeWindow.fetch = async function (input, init) {
                const url = typeof input === 'string' ? input : input?.url;
                const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
                if (TimeSpoof.enabled && method === 'POST' && TimeSpoof._isSubmitUrl(url)
                    && init?.body && typeof init.body === 'string') {
                    init = { ...init, body: TimeSpoof._spoofPayload(init.body) };
                }
                return orig.call(this, input, init);
            };
        },
        _hookXHR() {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.__method = method;
                this.__url = url;
                return origOpen.call(this, method, url, ...rest);
            };
            XMLHttpRequest.prototype.send = function (body) {
                if (TimeSpoof.enabled && this.__method?.toUpperCase() === 'POST'
                    && TimeSpoof._isSubmitUrl(this.__url) && typeof body === 'string') {
                    body = TimeSpoof._spoofPayload(body);
                }
                return origSend.call(this, body);
            };
        },
        toggle() {
            this.enabled = !this.enabled;
            return this.enabled;
        }
    };

    // ==================== HINT PARSER ====================
    const HintParser = {
        _extractText(node) {
            let text = '';
            if (!node) return text;
            if (node.type === 'image' && node.src) text += ` [ẢNH: ${node.src}] `;
            else if (node.type === 'equation' && node.equation) text += ` $${node.equation}$ `;
            else if (node.text) text += node.text;
            if (node.children && Array.isArray(node.children)) {
                text += node.children.map(c => this._extractText(c)).join('');
            }
            return text;
        },
        _extractStem(root) {
            const parts = [];
            let found = false;
            const walk = (node) => {
                if (found || !node) return;
                if (node.type === 'olm-list' || node.type === 'fillme-input'
                    || node.name === 'merge-list' || node.name === 'group-list') {
                    found = true; return;
                }
                if (node.type === 'paragraph' || node.type === 'heading') {
                    const t = this._extractText(node).trim();
                    if (t) parts.push(t);
                    return;
                }
                if (node.type === 'equation' && node.equation) {
                    parts.push(`$${node.equation}$`);
                    return;
                }
                if (node.children && Array.isArray(node.children)) node.children.forEach(walk);
            };
            if (root.children) root.children.forEach(walk);
            return parts.join(' ').replace(/\s+/g, ' ').trim();
        },
        _scan(node, hints, q_type = 0) {
            if (!node || typeof node !== 'object') return;

            if ((q_type === 21 || q_type === 22) && node.correct === true && node.type === 'olm-list-item') {
                const text = this._extractText(node).trim();
                if (text) hints.push({ type: 'Bài đọc', content: text, subIndex: null });
                return;
            }
            if (node.type === 'olm-input-text' && (node.name === 'selecttext' || node.name === 'dragtext') && node.content) {
                const parts = String(node.content).split('||').map(s => s.trim()).filter(Boolean);
                if (parts.length) hints.push({ type: node.name === 'dragtext' ? 'Kéo thả' : 'Chọn từ', content: parts[0], subIndex: null });
                return;
            }
            if (node.name === 'merge-list' && node.type === 'olm-list' && node.children) {
                node.children.forEach(item => {
                    if (item.type !== 'olm-list-item' || !item.children) return;
                    const left = item.children.find(c => c.type === 'position-column' && c.position === 'left');
                    const right = item.children.find(c => c.type === 'position-column' && c.position === 'right');
                    if (left && right) {
                        const l = this._extractText(left).trim();
                        const r = this._extractText(right).trim();
                        if (l && r) hints.push({ type: 'Ghép nối', content: `${l} ➔ ${r}`, subIndex: null });
                    }
                });
                return;
            }
            if (node.name === 'sort-list' && node.type === 'olm-list' && node.children) {
                const items = node.children.filter(c => c.type === 'olm-list-item')
                    .map(c => this._extractText(c).trim()).filter(Boolean);
                if (items.length) hints.push({ type: 'Sắp xếp', content: items.join(' → '), subIndex: null });
                return;
            }
            if (node.name === 'dragmore' && node.type === 'olm-input-text' && node.children) {
                const correct = node.children.filter(c => c.type === 'drag-more-item' && c.correct === true)
                    .map(c => this._extractText(c).trim()).filter(Boolean);
                if (correct.length) hints.push({ type: 'Kéo thả', content: correct.join(' | '), subIndex: null });
                else {
                    const all = node.children.filter(c => c.type === 'drag-more-item')
                        .map(c => this._extractText(c).trim()).filter(Boolean);
                    if (all.length) hints.push({ type: 'Kéo thả', content: all[0], subIndex: null });
                }
                return;
            }
            if (node.name === 'exp' && (q_type === 11 || q_type === 18) && node.children) {
                const text = this._extractText(node).replace(/^Hư[ơớ]ng d[ẫâ]n gi[aả]i:?/i, '').trim();
                if (text) hints.push({ type: 'Giải thích', content: text, subIndex: null });
                return;
            }
            if (q_type === 13 && node.name === 'true-false' && node.type === 'olm-list') {
                (node.children || []).forEach(item => {
                    if (item.type === 'olm-list-item') {
                        const text = this._extractText(item).trim();
                        if (text) hints.push({ type: 'Đúng/Sai', content: text, subIndex: item.correct ? 'ĐÚNG' : 'SAI' });
                    }
                });
                return;
            }
            if (q_type === 2 && node.type === 'fillme-input' && node.content) {
                hints.push({ type: 'Điền đáp án', content: String(node.content).trim(), subIndex: null });
                return;
            }
            if (q_type === 10 && node.name === 'group-list' && node.children) {
                node.children.forEach((item, idx) => {
                    if (item.type !== 'olm-list-item' || !item.children) return;
                    const titleNode = item.children.find(c => c.type === 'group-title');
                    const title = titleNode ? this._extractText(titleNode).trim() : 'Nhóm';
                    const answers = item.children.filter(c => c.position === 'group')
                        .map(c => this._extractText(c).trim()).filter(Boolean);
                    if (answers.length) hints.push({ type: 'Kéo nhóm', content: `${title}: ${answers.join(', ')}`, subIndex: idx + 1 });
                });
                return;
            }
            if ((q_type === 2 || q_type === 3) && node.type === 'paragraph' && node.children) {
                const first = node.children[0];
                if (first && first.text && /^\d+\.\s/.test(first.text.trim())) {
                    const m = first.text.trim().match(/^(\d+)\./);
                    const num = m ? m[1] : '0';
                    const inputs = node.children.filter(c =>
                        (c.type === 'fillme-input' || c.type === 'olm-input-text') && c.content);
                    if (inputs.length) {
                        inputs.forEach(input => hints.push({
                            type: 'Điền đáp án',
                            content: String(input.content).trim(),
                            subIndex: num
                        }));
                        return;
                    }
                }
            }
            if (node.correct === true && (node.type === 'olm-list-item' || node.type === 'list-item')) {
                const text = this._extractText(node).trim();
                if (text) hints.push({ type: 'Trắc nghiệm', content: text, subIndex: null });
                return;
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => this._scan(child, hints, q_type));
            }
        },
        parse(question) {
            const hints = [];
            let stem = '';
            if (question.json_content) {
                const data = Utils.decodeJsonContent(question.json_content);
                if (data && data.root) {
                    stem = this._extractStem(data.root);
                    this._scan(data.root, hints, question.q_type);
                }
            }
            if (question.content) {
                const html = Utils.decodeBase64(question.content);
                if (html) {
                    const div = Utils.createElement('div', { innerHTML: html });
                    div.querySelectorAll('.correctAnswer, .correct-answer').forEach(el => {
                        const t = el.textContent.trim();
                        if (t) hints.push({ type: 'Gợi ý (cũ)', content: t });
                    });
                }
            }
            const seen = new Set();
            return {
                stem,
                hints: hints.filter(h => {
                    const k = (h.content || '').toLowerCase();
                    if (!k || seen.has(k)) return false;
                    seen.add(k);
                    return true;
                })
            };
        }
    };

    // ==================== BLOCK SUBMIT ====================
    const BlockSubmit = {
        enabled: true,
        init() {
            const isSubmit = (url, method) => {
                if (!url) return false;
                const m = (method || 'GET').toUpperCase();
                return m === 'POST' && CONFIG.SUBMIT_ENDPOINTS.some(e => url.includes(e));
            };
            const origFetch = unsafeWindow.fetch;
            unsafeWindow.fetch = function (...args) {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
                const method = args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET');
                if (BlockSubmit.enabled && isSubmit(url, method)) {
                    console.warn('[BlockSubmit] Chặn fetch:', url);
                    return Promise.resolve(new Response(
                        JSON.stringify({ message: 'success', blocked: true }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    ));
                }
                return origFetch.apply(this, args);
            };
            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.__method = method;
                this.__url = url;
                return origOpen.call(this, method, url, ...rest);
            };
            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...args) {
                if (BlockSubmit.enabled && isSubmit(this.__url, this.__method)) {
                    console.warn('[BlockSubmit] Chặn XHR:', this.__url);
                    setTimeout(() => {
                        Object.defineProperty(this, 'status', { value: 200, configurable: true });
                        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(this, 'responseText', {
                            value: '{"message":"success","blocked":true}', configurable: true
                        });
                        Object.defineProperty(this, 'response', {
                            value: '{"message":"success","blocked":true}', configurable: true
                        });
                        this.dispatchEvent(new Event('load'));
                        this.dispatchEvent(new Event('loadend'));
                    }, 50);
                    return;
                }
                return origSend.apply(this, args);
            };
        },
        toggle() {
            this.enabled = !this.enabled;
            return this.enabled;
        }
    };

    // ==================== PANEL ====================
    class Panel {
        constructor() {
            this.collapsed = GM_getValue('oolm_collapsed', false);
            const defaultX = Math.max(10, Math.min(20, VP.w - 500));
            const defaultY = 80;
            const saved = GM_getValue('oolm_pos', null);
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number'
                && saved.x >= 0 && saved.x < VP.w - 50
                && saved.y >= 0 && saved.y < VP.h - 50) {
                this.pos = saved;
            } else {
                this.pos = { x: defaultX, y: defaultY };
            }
            this.container = null;
            this.header = null;
            this.summary = null;
            this.body = null;
            this.collapseBtn = null;
            this.timeInput = null;
        }
        init() {
            this.container = this._build();
            this._bind();
            document.body.appendChild(this.container);
            this._applyCollapse(true);
            setTimeout(() => { window.__oolmAllowResize = true; }, 100);
        }
        _build() {
            this.body = Utils.createElement('div', { id: 'oolm-body' });
            this.collapseBtn = Utils.createElement('button', {
                className: 'oolm-btn', children: ['−'], title: 'Thu gọn / Mở rộng'
            });
            const closeBtn = Utils.createElement('button', {
                className: 'oolm-btn', children: ['×'], title: 'Đóng'
            });
            closeBtn.onclick = () => this.setVisible(false);
            const mathBtn = Utils.createElement('button', {
                className: 'oolm-btn', children: ['∑'], title: 'Render lại MathJax'
            });
            mathBtn.onclick = () => this.renderMath();
            const infoBtn = Utils.createElement('button', {
                className: 'oolm-btn', children: ['ℹ'], title: 'Thông tin'
            });
            infoBtn.onclick = () => alert(
                `OOLM-${CONFIG.VERSION} by Vyrnox\n` +
                `Chặn nộp: ${BlockSubmit.enabled ? 'BẬT' : 'TẮT'}\n` +
                `TimeSpoof: ${TimeSpoof.enabled ? 'BẬT' : 'TẮT'} — ${Utils.formatTime(TimeSpoof.seconds)}`
            );
            const title = Utils.createElement('span', {
                className: 'oolm-title',
                children: [
                    '📖 OOLM',
                    Utils.createElement('span', { className: 'oolm-badge', children: ['3.7'] }),
                    Utils.createElement('span', { className: 'oolm-version', children: ['by Vyrnox'] })
                ]
            });
            this.header = Utils.createElement('div', {
                className: 'oolm-header',
                children: [title, Utils.createElement('div', {
                    className: 'oolm-controls',
                    children: [mathBtn, infoBtn, this.collapseBtn, closeBtn]
                })]
            });
            this.summary = Utils.createElement('div', {
                className: 'oolm-summary',
                children: [
                    this._pill('Câu hỏi', '0', 'oolm-pill-q'),
                    this._pill('Gợi ý', '0', 'oolm-pill-h'),
                    this._pill('Trạng thái', 'Chờ dữ liệu...', 'oolm-pill-s')
                ]
            });
            this.timeInput = Utils.createElement('input', {
                type: 'number', id: 'oolm-time-input',
                value: String(TimeSpoof.seconds), min: '30', max: '3600', step: '10'
            });
            this.timeInput.addEventListener('change', () => {
                const v = parseInt(this.timeInput.value, 10) || 480;
                TimeSpoof.setSeconds(v);
                this.timeInput.value = String(TimeSpoof.seconds);
                this._updateTimePreview();
            });
            const randomBtn = Utils.createElement('button', {
                className: 'oolm-mini-btn', children: ['🎲 7-10p'], title: 'Random 7-10 phút'
            });
            randomBtn.onclick = (e) => {
                e.stopPropagation();
                const s = TimeSpoof.random7to10();
                this.timeInput.value = String(s);
                this._updateTimePreview();
            };
            const timePreview = Utils.createElement('span', {
                className: 'oolm-time-preview', id: 'oolm-time-preview',
                children: [Utils.formatTime(TimeSpoof.seconds)]
            });
            const timeRow = Utils.createElement('div', {
                className: 'oolm-time-row',
                children: [
                    Utils.createElement('span', { className: 'oolm-time-icon', children: ['⏱️'] }),
                    this.timeInput,
                    Utils.createElement('span', { className: 'oolm-time-unit', children: ['s'] }),
                    timePreview, randomBtn
                ]
            });
            const blockToggleBtn = Utils.createElement('button', {
                className: 'oolm-footer-btn', id: 'oolm-block-toggle',
                title: 'Bật/tắt chặn nộp bài',
                style: { background: 'rgba(220, 38, 38, 0.15)', color: '#fecaca', borderColor: 'rgba(248, 113, 113, 0.6)' }
            });
            blockToggleBtn.textContent = '🚫 Đang chặn nộp';
            blockToggleBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const blocked = BlockSubmit.toggle();
                blockToggleBtn.textContent = blocked ? '🚫 Đang chặn nộp' : '✅ Cho phép nộp';
                blockToggleBtn.style.background = blocked ? 'rgba(220, 38, 38, 0.15)' : 'rgba(34, 197, 94, 0.15)';
                blockToggleBtn.style.borderColor = blocked ? 'rgba(248, 113, 113, 0.6)' : 'rgba(74, 222, 128, 0.6)';
                blockToggleBtn.style.color = blocked ? '#fecaca' : '#bbf7d0';
            });
            const timeToggleBtn = Utils.createElement('button', {
                className: 'oolm-footer-btn', id: 'oolm-time-toggle',
                title: 'Bật/tắt TimeSpoof',
                style: { background: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe', borderColor: 'rgba(129, 140, 248, 0.6)' }
            });
            timeToggleBtn.textContent = '⏱️ TimeSpoof ON';
            timeToggleBtn.onclick = (e) => {
                e.stopPropagation();
                const on = TimeSpoof.toggle();
                timeToggleBtn.textContent = on ? '⏱️ TimeSpoof ON' : '⏱️ TimeSpoof OFF';
                timeToggleBtn.style.background = on ? 'rgba(99, 102, 241, 0.15)' : 'rgba(107, 114, 128, 0.15)';
                timeToggleBtn.style.borderColor = on ? 'rgba(129, 140, 248, 0.6)' : 'rgba(156, 163, 175, 0.6)';
                timeToggleBtn.style.color = on ? '#c7d2fe' : '#d1d5db';
            };
            const footer = Utils.createElement('div', {
                className: 'oolm-footer',
                children: [
                    Utils.createElement('span', { className: 'oolm-footer-left', children: ['OOLM-3.7'] }),
                    Utils.createElement('div', {
                        style: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
                        children: [
                            timeToggleBtn, blockToggleBtn,
                            Utils.createElement('button', {
                                className: 'oolm-footer-btn', children: ['🧹 Xóa'],
                                title: 'Xóa toàn bộ gợi ý',
                                onclick: () => this.clear()
                            })
                        ]
                    })
                ]
            });
            return Utils.createElement('div', {
                id: 'oolm-container',
                style: { left: `${this.pos.x}px`, top: `${this.pos.y}px` },
                children: [this.header, this.summary, timeRow, this.body, footer]
            });
        }
        _pill(label, value, cls) {
            return Utils.createElement('div', {
                className: `oolm-pill ${cls}`,
                children: [
                    Utils.createElement('span', { className: 'oolm-pill-label', children: [label] }),
                    Utils.createElement('span', { className: 'oolm-pill-value', children: [value] })
                ]
            });
        }
        _updateTimePreview() {
            const el = this.container?.querySelector('#oolm-time-preview');
            if (el) el.textContent = Utils.formatTime(TimeSpoof.seconds);
        }
        _bind() {
            this.collapseBtn.onclick = e => { e.stopPropagation(); this.toggle(); };
            this.header.addEventListener('dblclick', () => this.toggle());
            this.header.addEventListener('click', () => { if (this.collapsed) this.toggle(); });
            this._bindDrag();
        }
        _bindDrag() {
            let dragging = false, sx, sy, ix, iy;
            const start = e => {
                if (e.target.classList.contains('oolm-btn')
                    || e.target.classList.contains('oolm-mini-btn')
                    || e.target.tagName === 'INPUT'
                    || e.target.tagName === 'BUTTON') return;
                dragging = true;
                this.container.classList.add('oolm-dragging');
                const t = e.touches ? e.touches[0] : e;
                sx = t.clientX; sy = t.clientY;
                const r = this.container.getBoundingClientRect();
                ix = r.left; iy = r.top;
                document.addEventListener('mousemove', move, { passive: false });
                document.addEventListener('touchmove', move, { passive: false });
                document.addEventListener('mouseup', stop);
                document.addEventListener('touchend', stop);
                e.preventDefault();
            };
            const move = e => {
                if (!dragging) return;
                const t = e.touches ? e.touches[0] : e;
                const dx = t.clientX - sx, dy = t.clientY - sy;
                const vw = VP.w, vh = VP.h;
                const nx = Math.max(6, Math.min(ix + dx, vw - this.container.offsetWidth - 6));
                const ny = Math.max(6, Math.min(iy + dy, vh - this.container.offsetHeight - 6));
                this.container.style.left = `${nx}px`;
                this.container.style.top = `${ny}px`;
                e.preventDefault();
            };
            const stop = () => {
                if (!dragging) return;
                dragging = false;
                this.container.classList.remove('oolm-dragging');
                document.removeEventListener('mousemove', move);
                document.removeEventListener('touchmove', move);
                document.removeEventListener('mouseup', stop);
                document.removeEventListener('touchend', stop);
                const r = this.container.getBoundingClientRect();
                this.pos = { x: r.left, y: r.top };
                GM_setValue('oolm_pos', this.pos);
            };
            this.header.addEventListener('mousedown', start);
            this.header.addEventListener('touchstart', start);
            this.container.addEventListener('mousedown', start);
            this.container.addEventListener('touchstart', start);
        }
        toggle() {
            this.collapsed = !this.collapsed;
            this._applyCollapse();
            GM_setValue('oolm_collapsed', this.collapsed);
        }
        _applyCollapse(initial = false) {
            if (!initial) this.container.style.transition = 'all 0.25s ease';
            this.container.classList.toggle('oolm-collapsed', this.collapsed);
            this.collapseBtn.innerHTML = this.collapsed ? '+' : '−';
            if (!initial) setTimeout(() => { this.container.style.transition = ''; }, 260);
        }
        setVisible(v) {
            if (this.container) this.container.style.display = v ? 'flex' : 'none';
        }
        clear() {
            if (!this.body) return;
            this.body.innerHTML = '';
            this.body.appendChild(Utils.createElement('div', {
                className: 'oolm-empty',
                children: ['🔍 Đang chờ dữ liệu câu hỏi từ OLM...']
            }));
            this.setSummary({ q: 0, h: 0, s: 'Chờ dữ liệu...' });
        }
        setSummary({ q, h, s }) {
            if (!this.summary) return;
            const qEl = this.summary.querySelector('.oolm-pill-q .oolm-pill-value');
            const hEl = this.summary.querySelector('.oolm-pill-h .oolm-pill-value');
            const sEl = this.summary.querySelector('.oolm-pill-s .oolm-pill-value');
            if (qEl) qEl.textContent = Utils.formatNumber(q || 0);
            if (hEl) hEl.textContent = Utils.formatNumber(h || 0);
            if (sEl) sEl.textContent = s || 'Đã cập nhật';
        }
        addQuestion(item) {
            if (!this.body) return;
            if (this.body.querySelector('.oolm-empty')) this.body.innerHTML = '';
            const items = item.hints.map(hint => {
                const isTF = (hint.type === 'Đúng/Sai');
                const isFill = (hint.type === 'Điền đáp án');
                const isReading = (hint.type === 'Bài đọc');
                const isSelectText = (hint.type === 'Chọn từ');
                const isMerge = (hint.type === 'Ghép nối');
                const isDrag = (hint.type === 'Kéo thả');
                const isExplain = (hint.type === 'Giải thích');
                const isSort = (hint.type === 'Sắp xếp');
                const isGroup = (hint.type === 'Kéo nhóm');
                let displayText = Latex.convert(hint.content || '');
                if (isTF && hint.subIndex) {
                    const mark = hint.subIndex === 'ĐÚNG' ? '✅ ĐÚNG' : '❌ SAI';
                    displayText = `<b style="color:${hint.subIndex === 'ĐÚNG' ? '#22c55e' : '#ef4444'}">${mark}</b> — ${displayText}`;
                }
                if (isFill) displayText = `<b style="color:#f59e0b">→ ${displayText}</b>`;
                if (isReading) displayText = `<b style="color:#a855f7">📚 ${displayText}</b>`;
                if (isSelectText) displayText = `<b style="color:#06b6d4">🔽 ${displayText}</b>`;
                if (isMerge) displayText = `<b style="color:#ec4899">🔗 ${displayText}</b>`;
                if (isDrag) displayText = `<b style="color:#14b8a6">🎯 ${displayText}</b>`;
                if (isExplain) displayText = `<span style="color:#94a3b8; font-style:italic">💡 ${displayText}</span>`;
                if (isSort) displayText = `<b style="color:#f97316">🔢 ${displayText}</b>`;
                if (isGroup) displayText = `<b style="color:#8b5cf6">📦 ${displayText}</b>`;
                const text = Utils.createElement('span', {
                    className: 'oolm-hint-text',
                    innerHTML: displayText.replace(/\n/g, '<br>')
                });
                const borderColor = isTF ? '#f59e0b'
                    : (isFill ? '#ef4444'
                    : (isReading ? '#a855f7'
                    : (isSelectText ? '#06b6d4'
                    : (isMerge ? '#ec4899'
                    : (isDrag ? '#14b8a6'
                    : (isSort ? '#f97316'
                    : (isGroup ? '#8b5cf6'
                    : (isExplain ? '#64748b' : '#22c55e'))))))));
                return Utils.createElement('li', {
                    children: [text],
                    style: { borderLeftColor: borderColor }
                });
            });
            const stemBlock = item.stem
                ? Utils.createElement('div', {
                    className: 'oolm-stem',
                    innerHTML: `<b style="color:#60a5fa">📖 Đề:</b> ${Latex.convert(item.stem).replace(/\n/g, '<br>')}`
                })
                : null;
            const block = Utils.createElement('div', {
                className: 'oolm-item',
                children: [
                    Utils.createElement('div', {
                        className: 'oolm-item-title',
                        children: [`📝 ${Latex.convert(item.title)}`]
                    }),
                    stemBlock,
                    Utils.createElement('div', {
                        className: 'oolm-item-body',
                        children: [
                            items.length
                                ? Utils.createElement('ul', { children: items })
                                : Utils.createElement('div', {
                                    className: 'oolm-empty-hint',
                                    children: ['Không tìm thấy gợi ý cụ thể.']
                                })
                        ]
                    })
                ].filter(Boolean)
            });
            this.body.appendChild(block);
        }
        renderMath() {
            const go = () => {
                try {
                    if (unsafeWindow.MathJax && unsafeWindow.MathJax.typesetPromise) {
                        unsafeWindow.MathJax.typesetPromise([this.body]).catch(e => console.error(e));
                    }
                } catch (e) {}
            };
            if (unsafeWindow.MathJax) return go();
            unsafeWindow.MathJax = {
                tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
                svg: { fontCache: 'global' }
            };
            const s = Utils.createElement('script', {
                src: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js', async: true
            });
            s.onload = go;
            document.head.appendChild(s);
        }
    }

    // ==================== APP ====================
    const App = {
        panel: null,
        init() {
            this._injectStyles();
            this.panel = new Panel();
            this.panel.init();
            this.panel.clear();
        },
        async process(rawQuestions) {
            const processed = rawQuestions.map(q => {
                const parsed = HintParser.parse(q);
                return { question: q, stem: parsed.stem, hints: parsed.hints };
            });
            const totalHints = processed.reduce((s, i) => s + (i.hints?.length || 0), 0);
            this.panel.clear();
            this.panel.setVisible(true);
            this.panel.setSummary({ q: processed.length, h: totalHints, s: 'Đã lấy dữ liệu' });
            let fallbackIndex = 1;
            for (const item of processed) {
                const q = item.question;
                const baseTitle = (q.title && String(q.title).trim())
                    || (q._id ? `ID: ${String(q._id).slice(-4)}` : (q.id || '?'));
                const hasSubIndices = item.hints.some(h => h.subIndex);
                const isReading = (q.q_type === 21 || q.q_type === 22);
                if (isReading) {
                    const displayIndices = q._displayIndices || [];
                    let counter = 0;
                    if (item.hints.length === 0) {
                        const displayIndex = displayIndices[0] || fallbackIndex++;
                        this.panel.addQuestion({
                            title: `Câu ${displayIndex}: ${baseTitle}`,
                            stem: item.stem, hints: []
                        });
                    } else {
                        for (const hint of item.hints) {
                            const displayIndex = displayIndices[counter]
                                || (displayIndices[0] ? displayIndices[0] + counter : fallbackIndex);
                            this.panel.addQuestion({
                                title: `Câu ${displayIndex}: ${baseTitle}`,
                                stem: counter === 0 ? item.stem : '',
                                hints: [hint]
                            });
                            counter++;
                        }
                        fallbackIndex = (displayIndices[displayIndices.length - 1] || fallbackIndex) + 1;
                    }
                    await Utils.sleep(8);
                    continue;
                }
                if (!hasSubIndices) {
                    const displayIndex = q._displayIndex || fallbackIndex++;
                    this.panel.addQuestion({
                        title: `Câu ${displayIndex}: ${baseTitle}`,
                        stem: item.stem,
                        hints: item.hints || []
                    });
                } else {
                    const groupedHints = {};
                    item.hints.forEach(hint => {
                        const index = hint.subIndex || 'general';
                        if (!groupedHints[index]) groupedHints[index] = [];
                        groupedHints[index].push(hint);
                    });
                    const displayIndices = q._displayIndices || [];
                    let subIndexCounter = 0;
                    for (const subIndex in groupedHints) {
                        const hintsForPanel = groupedHints[subIndex];
                        if (!hintsForPanel.length) continue;
                        let displayIndex;
                        if (subIndex !== 'general' && !isNaN(parseInt(subIndex))) displayIndex = subIndex;
                        else if (displayIndices.length > 0) displayIndex = displayIndices[subIndexCounter] || (displayIndices[0] + subIndexCounter);
                        else displayIndex = (q._displayIndex || fallbackIndex) + subIndexCounter;
                        if (hintsForPanel.length > 1 && hintsForPanel.every(h => h.type === 'Điền đáp án')) {
                            hintsForPanel[0].content = hintsForPanel.map(h => h.content).join(' | ');
                            hintsForPanel.splice(1);
                        }
                        this.panel.addQuestion({
                            title: `Câu ${displayIndex}: ${baseTitle}`,
                            stem: subIndexCounter === 0 ? item.stem : '',
                            hints: hintsForPanel
                        });
                        subIndexCounter++;
                    }
                    fallbackIndex += subIndexCounter;
                }
                await Utils.sleep(8);
            }
        },
        _injectStyles() {
            GM_addStyle(`
                #oolm-container {
                    font-family: system-ui, -apple-system, 'Inter', sans-serif;
                    position: fixed; width: 480px; height: 580px; min-height: 220px; max-height: 85vh;
                    border-radius: 18px; z-index: 10001; display: flex; flex-direction: column;
                    overflow: hidden;
                    background: radial-gradient(circle at top left, rgba(94, 234, 212, 0.25), transparent 55%),
                                radial-gradient(circle at bottom right, rgba(129, 140, 248, 0.3), transparent 55%),
                                linear-gradient(145deg, #020617, #020617);
                    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.85), 0 0 0 1px rgba(148, 163, 184, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.65);
                    backdrop-filter: blur(14px); color: #e5e7eb;
                    animation: oolmFade 0.35s ease-out;
                }
                #oolm-container::before {
                    content: ''; position: absolute; inset: -40%;
                    background: radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.4), transparent 60%),
                                radial-gradient(circle at 100% 100%, rgba(244, 114, 182, 0.35), transparent 60%);
                    opacity: 0.35; filter: blur(32px); z-index: -1;
                }
                #oolm-container.oolm-dragging { transition: none !important; cursor: grabbing !important; }
                .oolm-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 0 18px; height: 58px; cursor: move; flex-shrink: 0;
                    background: linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.6));
                    border-bottom: 1px solid rgba(148, 163, 184, 0.4);
                    user-select: none; -webkit-user-select: none;
                }
                .oolm-title {
                    background: linear-gradient(135deg, #60a5fa, #a855f7);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;
                }
                .oolm-badge {
                    background: #22c55e; color: white; padding: 2px 6px; border-radius: 999px;
                    font-size: 9px; font-weight: 800; text-transform: uppercase;
                    -webkit-text-fill-color: white;
                }
                .oolm-version {
                    padding: 2px 7px; border-radius: 999px; font-size: 9px;
                    border: 1px solid rgba(148, 163, 184, 0.7); color: #cbd5f5;
                    background: rgba(15, 23, 42, 0.85);
                    -webkit-text-fill-color: #cbd5f5;
                }
                .oolm-controls { display: flex; gap: 6px; }
                .oolm-btn {
                    width: 30px; height: 30px; border-radius: 10px; border: none; cursor: pointer;
                    background: radial-gradient(circle at 30% 0, rgba(248, 250, 252, 0.08), transparent 60%),
                                rgba(15, 23, 42, 0.9);
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    color: #9ca3af; font-size: 15px;
                    display: flex; align-items: center; justify-content: center;
                }
                .oolm-btn:hover {
                    transform: translateY(-1px) scale(1.03); color: #e5e7eb;
                    box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.6);
                }
                .oolm-time-row {
                    display: flex; align-items: center; gap: 6px;
                    padding: 6px 12px;
                    background: linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.7));
                    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
                    flex-shrink: 0;
                }
                .oolm-time-icon { font-size: 14px; }
                #oolm-time-input {
                    width: 70px; padding: 5px 8px;
                    border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.6);
                    background: rgba(15, 23, 42, 0.95);
                    color: #e5e7eb; font-size: 12px;
                    text-align: center; outline: none;
                    font-family: monospace;
                }
                #oolm-time-input:focus { border-color: #818cf8; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3); }
                #oolm-time-input::-webkit-outer-spin-button,
                #oolm-time-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                #oolm-time-input { -moz-appearance: textfield; }
                .oolm-time-unit { font-size: 11px; color: #9ca3af; }
                .oolm-time-preview {
                    font-size: 11px; color: #a5b4fc;
                    background: rgba(99, 102, 241, 0.15);
                    padding: 3px 8px; border-radius: 6px;
                    font-family: monospace; flex: 1;
                }
                .oolm-mini-btn {
                    border: none; cursor: pointer;
                    font-size: 10px; padding: 5px 9px;
                    border-radius: 8px;
                    background: rgba(99, 102, 241, 0.2);
                    color: #c7d2fe;
                    border: 1px solid rgba(129, 140, 248, 0.5);
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .oolm-mini-btn:hover { background: rgba(99, 102, 241, 0.35); transform: translateY(-1px); }
                #oolm-body { padding: 12px 14px 10px; flex: 1; overflow-y: auto; scroll-behavior: smooth; }
                #oolm-body::-webkit-scrollbar { width: 6px; }
                #oolm-body::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.8); }
                #oolm-body::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 999px;
                }
                .oolm-summary {
                    display: flex; gap: 8px; padding: 8px 12px 6px;
                    background: linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.75));
                    border-bottom: 1px solid rgba(148, 163, 184, 0.35); flex-shrink: 0;
                }
                .oolm-pill {
                    flex: 1; display: flex; flex-direction: column; justify-content: center;
                    padding: 6px 9px; border-radius: 10px;
                    background: radial-gradient(circle at top left, rgba(148, 163, 184, 0.22), transparent 60%),
                                rgba(15, 23, 42, 0.9);
                    border: 1px solid rgba(148, 163, 184, 0.6);
                }
                .oolm-pill-q { border-color: rgba(59, 130, 246, 0.75); }
                .oolm-pill-h { border-color: rgba(16, 185, 129, 0.8); }
                .oolm-pill-s { border-style: dashed; }
                .oolm-pill-label {
                    font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
                    color: #9ca3af; margin-bottom: 2px;
                }
                .oolm-pill-value { font-size: 13px; font-weight: 600; color: #e5e7eb; }
                .oolm-pill-s .oolm-pill-value { font-size: 12px; }
                .oolm-item {
                    margin-bottom: 10px; padding: 11px 10px;
                    background: radial-gradient(circle at top left, rgba(55, 65, 81, 0.5), transparent 65%),
                                rgba(15, 23, 42, 0.92);
                    border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.5);
                    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.7);
                }
                .oolm-item-title {
                    font-weight: 600; color: #e5e7eb; margin-bottom: 6px; font-size: 13px;
                }
                .oolm-stem {
                    padding: 8px 10px; margin-bottom: 8px;
                    background: rgba(59, 130, 246, 0.1);
                    border-left: 3px solid #60a5fa;
                    border-radius: 8px; font-size: 12px;
                    color: #cbd5e0; line-height: 1.5;
                }
                .oolm-item-body ul {
                    list-style: none; padding: 0; margin: 0;
                    display: flex; flex-direction: column; gap: 4px;
                }
                .oolm-item-body li {
                    display: flex; gap: 6px; padding: 6px 8px;
                    background: rgba(15, 23, 42, 0.9); border-radius: 9px;
                    border-left: 2px solid #6366f1; color: #cbd5e0; font-size: 12px;
                    align-items: flex-start;
                }
                .oolm-hint-text { font-size: 12px; line-height: 1.4; color: #e5e7eb; }
                .oolm-empty { text-align: center; padding: 40px 16px; color: #9ca3af; font-size: 13px; }
                .oolm-empty-hint { color: #a0aec0; text-align: center; padding: 10px; }
                .oolm-footer {
                    min-height: 38px; padding: 5px 10px 7px;
                    display: flex; align-items: center; justify-content: space-between;
                    border-top: 1px solid rgba(148, 163, 184, 0.4);
                    background: linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.8));
                    font-size: 11px; color: #9ca3af; flex-shrink: 0;
                }
                .oolm-footer-left { font-size: 10px; color: #6b7280; }
                .oolm-footer-btn {
                    border: none; font-size: 10px; padding: 5px 9px; border-radius: 999px;
                    background: rgba(220, 38, 38, 0.15); color: #fecaca; cursor: pointer;
                    border: 1px solid rgba(248, 113, 113, 0.6);
                    display: flex; align-items: center; gap: 4px;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .oolm-footer-btn:hover { opacity: 0.85; transform: translateY(-1px); }
                #oolm-container.oolm-collapsed {
                    width: 60px !important; height: 60px !important;
                    min-height: 0; border-radius: 16px; transition: all 0.25s ease;
                    cursor: move;
                }
                #oolm-container.oolm-collapsed .oolm-header { cursor: move; }
                #oolm-container.oolm-collapsed .oolm-title,
                #oolm-container.oolm-collapsed .oolm-time-row,
                #oolm-container.oolm-collapsed #oolm-body,
                #oolm-container.oolm-collapsed .oolm-controls,
                #oolm-container.oolm-collapsed .oolm-summary,
                #oolm-container.oolm-collapsed .oolm-footer { display: none; }
                @keyframes oolmFade {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @media (max-width: 768px) {
                    #oolm-container {
                        width: calc(100vw - 28px) !important;
                        left: 14px !important; right: 14px !important; height: 75vh;
                    }
                }
            `);
        }
    };

    // ==================== API HOOK ====================
    const Hook = {
        _ready: false,
        init(cb) {
            if (this._ready) return;
            this._ready = true;
            this._patchFetch(cb);
            this._patchXHR(cb);
        },
        _extract(text, url) {
            if (CONFIG.API_KEYWORDS.some(k => url.includes(k))) {
                try {
                    const d = JSON.parse(text);
                    const q = d?.questions || d;
                    if (Array.isArray(q) && q.length) return q;
                } catch (e) {}
            }
            return null;
        },
        _patchFetch(cb) {
            const orig = unsafeWindow.fetch;
            if (!orig) return;
            unsafeWindow.fetch = async (...args) => {
                const res = await orig.apply(this, args);
                const url = args[0] instanceof Request ? args[0].url : args[0];
                if (res && res.ok) {
                    res.clone().text().then(t => {
                        const q = this._extract(t, url);
                        if (q) cb(q);
                    });
                }
                return res;
            };
        },
        _patchXHR(cb) {
            const orig = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...args) {
                this.addEventListener('load', () => {
                    if (this.status === 200) {
                        const q = Hook._extract(this.responseText, this.responseURL || '');
                        if (q) cb(q);
                    }
                });
                return orig.apply(this, args);
            };
        }
    };

    // ==================== MAIN ====================
    function waitForBody() {
        return new Promise(resolve => {
            if (document.body) return resolve();
            const obs = new MutationObserver(() => {
                if (document.body) { obs.disconnect(); resolve(); }
            });
            obs.observe(document.documentElement, { childList: true });
        });
    }

    async function main() {
        try {
            TimeSpoof.init();
            BlockSubmit.init();
            await waitForBody();
            App.init();
            Hook.init(App.process.bind(App));
            console.log(`[OOLM] v${CONFIG.VERSION} by Vyrnox — khởi động`);
        } catch (e) {
            console.error('[OOLM] Lỗi khởi tạo:', e);
        }
    }

    if (document.readyState === 'loading' || !document.body) {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
