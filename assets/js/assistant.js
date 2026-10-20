/* ==========================================================================
   assistant.js — «Poradce péče» (Kristýna)
   --------------------------------------------------------------------------
   Семь вопросов → детерминированный подбор по реальному каталогу
   (assets/data/catalog.json, 134 позиции с сайта) → три пакета 3/5/8.
   Никакого случайного выбора: одинаковые ответы дают одинаковый результат.
   ========================================================================== */
(function () {
  'use strict';

  /* Настройки. В демо работают дефолты; на боевом Shoptet перед подключением
     скрипта объявляется window.PORADCE_CONFIG (см. Shoptet/christina-poradce.js). */
  var CFG = window.PORADCE_CONFIG || {};
  var CATALOG_URL = CFG.catalog || 'assets/data/catalog.json';
  var SPRITE_URL  = CFG.sprite  || null;
  var PROMO_AFTER = CFG.promoAfter || null;

  var root, body, progress, catalog = null, loading = false;
  var answers = {}, step = 0, result = null, activePack = 5;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var plural = function (n) {
    return n + (n === 1 ? ' přípravek' : n < 5 ? ' přípravky' : ' přípravků');
  };
  var money = function (n) { return Math.round(n).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč'; };
  var ico = function (n, cls) { return '<svg class="' + (cls || 'ico') + '" aria-hidden="true"><use href="#ic-' + n + '"/></svg>'; };
  /* Иконка с «отложенной» подменой: пока в спрайте нет ic-<want>, показываем «?».
     Как только клиент добавит символ, refreshIcons() подставит его без правок кода. */
  var icoOr = function (want, cls) {
    return '<svg class="' + (cls || 'ico') + '" aria-hidden="true" data-ic="' + want +
           '"><use href="#ic-missing"/></svg>';
  };
  function refreshIcons(scope) {
    $$('[data-ic]', scope || document).forEach(function (el) {
      var id = 'ic-' + el.getAttribute('data-ic');
      if (!document.getElementById(id)) return;
      var u = el.querySelector('use');
      if (u) { u.setAttribute('href', '#' + id); el.removeAttribute('data-missing'); }
    });
  }
  /* Если в спрайте уже есть иконка клиента с нужным id — берём её.
     Пока её нет, показываем плейсхолдер «?». Новые иконки подхватываются
     автоматически: достаточно добавить <symbol id="ic-<name>"> в icons.svg. */
  var optIcon = function (o) {
    return o && o.ic && document.getElementById('ic-' + o.ic) ? ico(o.ic) : ico('missing');
  };

  /* ======================================================================
     ВОПРОСЫ
     ====================================================================== */
  var Q = [
    {
      id: 'goal', kind: 'one',
      title: 'Čím začneme?',
      sub: 'Řekněte mi, co je pro vás v péči o pleť teď nejdůležitější.',
      opts: [
        { v: 'age', ic: 'anti-age',     t: 'Omlazení',            d: 'Vrásky, pevnost, ztráta tonusu',   care: ['Omlazení pleti', 'Lifting pleti'] },
        { v: 'hydra', ic: 'drop',   t: 'Hydratace',           d: 'Suchost, staženost, mdlý tón',     care: ['Hydratace pleti', 'Suchá pleť'] },
        { v: 'acne', ic: 'acne',    t: 'Akné a mastná pleť',  d: 'Nedokonalosti, lesk, póry',        care: ['Problematická pleť', 'Mastná pleť'] },
        { v: 'tone', ic: 'brightness',    t: 'Sjednocení tónu',     d: 'Pigmentace, post-akné, skvrny',    care: ['Pigmentace'] },
        { v: 'calm', ic: 'calm',    t: 'Zklidnění',           d: 'Citlivost, zarudnutí, cévky',      care: ['Citlivá pleť', 'Podrážděná pleť', 'Cévky'] },
        { v: 'complex', ic: 'routine', t: 'Komplexní péče',      d: 'Chci ucelenou rutinu, ne jeden krém', care: ['Imunita pleti', 'Výživa pleti', 'Hydratace pleti'] }
      ]
    },
    {
      id: 'skin', kind: 'one',
      title: 'Jaký máte typ pleti?',
      sub: 'Pokud si nejste jistá, vyberte «Nevím přesně» — poznám to z ostatních odpovědí.',
      opts: [
        { v: 'normal', ic: 'skin-normal',      t: 'Normální',   d: 'Bez výrazného lesku ani staženosti' },
        { v: 'dry', ic: 'skin-dry',         t: 'Suchá',      d: 'Staženost, možné olupování' },
        { v: 'oily', ic: 'skin-oily',        t: 'Mastná',     d: 'Lesk, rozšířené póry' },
        { v: 'combination', ic: 'skin-combi', t: 'Smíšená',    d: 'Mastná T-zóna, normální tváře' },
        { v: 'sensitive', ic: 'skin-sensitive',   t: 'Citlivá',    d: 'Reaguje na počasí i nové přípravky' },
        { v: 'unknown', ic: 'help',     t: 'Nevím přesně', d: 'Pomozte mi to určit' }
      ]
    },
    {
      id: 'age', kind: 'one',
      title: 'Kolik je vám let?',
      sub: 'Věk mění, co má péče řešit jako první — a co ještě počká.',
      opts: [
        { v: '18-24', ic: 'age-1', t: 'Do 24 let',  d: 'Prevence a správný základ', n: 21 },
        { v: '25-34', ic: 'age-2', t: '25–34 let',  d: 'První jemné linky, prevence', n: 30 },
        { v: '35-44', ic: 'age-3', t: '35–44 let',  d: 'Pevnost, tón, první vrásky',  n: 39 },
        { v: '45-54', ic: 'age-4', t: '45–54 let',  d: 'Kontura, hloubková výživa',   n: 49 },
        { v: '55+', ic: 'age-5',   t: '55 a více',  d: 'Obnova bariéry a regenerace', n: 60 }
      ]
    },
    {
      id: 'issues', kind: 'many',
      title: 'Co na pleti nejvíc řešíte?',
      sub: 'Vyberte klidně víc možností — podle toho určím pořadí kroků.',
      opts: [
        { v: 'wrinkles', ic: 'wrinkles', t: 'Vrásky',            d: 'Mimické i statické',        care: ['Omlazení pleti'] },
        { v: 'firmness', ic: 'firmness', t: 'Ztráta pevnosti',   d: 'Ovál obličeje, kontura',    care: ['Lifting pleti'] },
        { v: 'dryness', ic: 'drop',  t: 'Suchost',           d: 'Staženost, olupování',      care: ['Suchá pleť', 'Hydratace pleti'] },
        { v: 'acne', ic: 'acne',     t: 'Nedokonalosti',     d: 'Akné, ucpané póry',         care: ['Problematická pleť'] },
        { v: 'pigment', ic: 'brightness',  t: 'Pigmentace',        d: 'Skvrny, nerovný tón',       care: ['Pigmentace'] },
        { v: 'redness', ic: 'redness',  t: 'Zarudnutí a cévky', d: 'Kuperóza, podráždění',      care: ['Cévky', 'Podrážděná pleť'] },
        { v: 'pores', ic: 'pores',    t: 'Rozšířené póry',    d: 'Lesk v T-zóně',             care: ['Mastná pleť'] },
        { v: 'dull', ic: 'dull',     t: 'Unavená pleť',      d: 'Bez jasu, bez energie',     care: ['Výživa pleti', 'Imunita pleti'] }
      ]
    },
    {
      id: 'level', kind: 'one',
      title: 'Jak jste na tom se zkušenostmi?',
      sub: 'Od toho se odvíjí, jak silné látky vám mohu doporučit.',
      opts: [
        { v: 'beginner', ic: 'level-1', t: 'Začínám',           d: 'Zatím mýdlo a krém, nic víc' },
        { v: 'basic', ic: 'level-2',    t: 'Mám základní rutinu', d: 'Čištění, krém, občas maska' },
        { v: 'advanced', ic: 'level-3', t: 'Vyznám se',         d: 'Používám séra, retinol, kyseliny' }
      ]
    },
    {
      id: 'brand', kind: 'one',
      title: 'Znáte už kosmetiku CHRISTINA?',
      sub: 'Podle toho zvolím, jestli začneme od základu, nebo navážeme.',
      opts: [
        { v: 'new', ic: 'brand-new',  t: 'Jsem tu poprvé',        d: 'Značku teprve objevuji' },
        { v: 'one', ic: 'brand-one',  t: 'Používám jednu řadu',   d: 'Chci ji doplnit nebo rozšířit' },
        { v: 'many', ic: 'brand-many', t: 'Znám víc řad',          d: 'Kombinuji je podle potřeby' }
      ]
    },
    {
      id: 'limits', kind: 'many', optional: true,
      title: 'Mám na něco brát ohled?',
      sub: 'Podle omezení některé přípravky z výběru rovnou vyřadím.',
      opts: [
        { v: 'pregnancy', ic: 'pregnancy', t: 'Těhotenství nebo kojení', d: 'Vynechám retinoidy a silné kyseliny' },
        { v: 'reactive', ic: 'skin-sensitive',  t: 'Velmi citlivá pleť',      d: 'Bez kyselin a dráždivých látek' },
        { v: 'allergy', ic: 'allergy',   t: 'Alergie na kosmetiku',    d: 'Doporučím opatrnější postup' },
        { v: 'none', ic: 'check',      t: 'Nic z toho',              d: 'Můžeme jet naplno', solo: true }
      ]
    }
  ];

  /* ======================================================================
     ТЕКСТЫ
     ====================================================================== */
  var SKIN_ACC = { normal: 'normální pleť', dry: 'suchou pleť', oily: 'mastnou pleť',
                   combination: 'smíšenou pleť', sensitive: 'citlivou pleť', unknown: 'vaši pleť' };
  var SKIN_NOM = { normal: 'Normální pleť', dry: 'Suchá pleť', oily: 'Mastná pleť',
                   combination: 'Smíšená pleť', sensitive: 'Citlivá pleť', unknown: 'Vaše pleť' };
  var GOAL_TITLE = { age: 'Omlazující rutina', hydra: 'Hydratační rutina',
                     acne: 'Péče pro problematickou pleť', tone: 'Rozjasňující péče',
                     calm: 'Zklidňující péče', complex: 'Komplexní domácí péče' };
  var GOAL_WORD = { age: 'omlazení', hydra: 'hydrataci', acne: 'problematickou pleť',
                    tone: 'sjednocení tónu', calm: 'zklidnění', complex: 'ucelenou péči' };
  var AGE_OPENER = {
    '18-24': 'se ve vašem věku obnovuje ještě sama od sebe. Úkolem péče je jí v tom nepřekážet a včas postavit základ, na kterém se dá stavět dalších dvacet let.',
    '25-34': 'kolem třicítky zpomaluje tvorbu kolagenu. Právě teď má prevence největší návratnost — děláte ji pro pleť, kterou budete mít ve čtyřiceti.',
    '35-44': 'po pětatřicítce reaguje pomaleji, zato viditelněji. Rozhoduje pravidelnost: tři kroky každý den udělají víc než osm kroků jednou týdně.',
    '45-54': 'v tomto období ztrácí pevnost i schopnost udržet vodu. Péče proto musí řešit obojí najednou, jinak se jeden problém léčí na úkor druhého.',
    '55+':   'potřebuje především výživu a obnovu ochranné bariéry. Bez ní se účinné látky nedostanou tam, kam mají, ať jsou jakkoliv kvalitní.'
  };
  var GOAL_PLAN = {
    age:     'Sestavila jsem vám rutinu, která pracuje na pevnosti a kontuře — od denní ochrany po noční regeneraci s peptidy.',
    hydra:   'Sestavila jsem vám rutinu, která vodu do pleti nejen dodá, ale hlavně ji tam udrží — na tom druhém většina péče selhává.',
    acne:    'Sestavila jsem vám rutinu, která reguluje maz a uklidňuje záněty, ale nevysušuje. Přesušená pleť si totiž mastnotu vyrobí zpátky.',
    tone:    'Sestavila jsem vám rutinu, která rozjasňuje a zároveň chrání — bez denního SPF se pigmentace vrací rychleji, než mizí.',
    calm:    'Sestavila jsem vám rutinu s krátkým složením a bez zbytečných dráždivých látek. U citlivé pleti dělá nejvíc to, co v péči není.',
    complex: 'Sestavila jsem vám ucelenou rutinu na ráno i večer, kde na sebe jednotlivé kroky navazují a navzájem si nepřekážejí.'
  };
  var STEP_WHY = {
    cleanse:   'Odstraní make-up i nečistoty, aniž by narušil ochrannou bariéru — na čistou pleť účinné látky zabírají výrazně lépe.',
    tone:      'Vrátí pleti pH po umytí a připraví ji na sérum. Krok, který se vynechává nejčastěji, a přitom je nejlevnější.',
    serum:     'Nejsilnější článek rutiny — nese koncentraci účinných látek, které řeší váš hlavní cíl.',
    day:       'Uzavře hydrataci na celý den a chrání pleť před vysoušením v klimatizaci i v mrazu.',
    spf:       'Bez UV ochrany se výsledky ostatních kroků každý den částečně mažou. Nejlevnější anti-age krok, jaký existuje.',
    night:     'V noci se pleť obnovuje nejrychleji. Tenhle krém pracuje, zatímco spíte.',
    eye:       'Kůže kolem očí je několikanásobně tenčí a potřebuje jinou konzistenci než zbytek obličeje.',
    exfoliate: 'Jednou až dvakrát týdně odstraní odumřelé buňky. Pleť se rozjasní a lépe přijme sérum.',
    mask:      'Intenzivní dávka jednou až dvakrát týdně — nejrychleji viditelný krok celé rutiny.'
  };
  var PACKS = [
    { size: 3, key: 'Základní péče',   note: 'Tři kroky, se kterými se dá začít hned' },
    { size: 5, key: 'Doporučená péče', note: 'Kompletní rutina na ráno i večer', best: true },
    { size: 8, key: 'Kompletní péče',  note: 'Rutina i týdenní intenzivní péče' }
  ];

  /* ======================================================================
     ПОДБОР
     ====================================================================== */
  function wantedCare() {
    var set = {};
    var g = Q[0].opts.filter(function (o) { return o.v === answers.goal; })[0];
    if (g) g.care.forEach(function (c) { set[c] = 3; });
    (answers.issues || []).forEach(function (v) {
      var o = Q[3].opts.filter(function (x) { return x.v === v; })[0];
      if (o && o.care) o.care.forEach(function (c) { set[c] = (set[c] || 0) + 2; });
    });
    return set;
  }

  function hash(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h % 7); }

  function score(p, want, ctx) {
    var s = 0, k;
    for (k = 0; k < p.c.length; k++) if (want[p.c[k]]) s += 8 + want[p.c[k]] * 4;

    var skin = answers.skin;
    if (skin === 'unknown') s += 4;
    else if (p.sk.indexOf(skin) >= 0) s += 14;
    else s -= 6;

    var age = ctx.age;
    if (age >= p.a[0] && age <= p.a[1]) s += 12;
    else if (age >= p.a[0] - 6 && age <= p.a[1] + 6) s += 4;
    else s -= 12;

    if (answers.level === 'beginner' && p.st) s -= 22;
    if (answers.level === 'basic' && p.st) s -= 5;
    if (answers.level === 'advanced' && p.st) s += 7;

    if (ctx.reactive) { if (p.st) s -= 40; if (p.sk.indexOf('sensitive') >= 0) s += 10; }
    if (ctx.allergy && p.st) s -= 8;

    var same = ctx.lines[p.l] || 0;
    if (same) s += 8 / (1 + same * 0.7);              // связность линейки, но с затуханием
    s += hash(p.id) * 0.4;                          // детерминированный тай-брейк
    return s;
  }

  function pick(stepName, want, ctx, taken) {
    var best = null, bestScore = -1e9;
    for (var i = 0; i < catalog.length; i++) {
      var p = catalog[i];
      if (p.s !== stepName || taken[p.id]) continue;
      if (ctx.pregnancy && !p.ps) continue;
      if (ctx.reactive && p.st) continue;
      var sc = score(p, want, ctx);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    return best;
  }

  function build() {
    var want = wantedCare();
    var limits = answers.limits || [];
    var ctx = {
      age: (Q[2].opts.filter(function (o) { return o.v === answers.age; })[0] || { n: 35 }).n,
      pregnancy: limits.indexOf('pregnancy') >= 0,
      reactive:  limits.indexOf('reactive') >= 0,
      allergy:   limits.indexOf('allergy') >= 0,
      lines: {}
    };

    var wantsSPF = answers.goal === 'tone' || answers.goal === 'age' ||
                   (answers.issues || []).indexOf('pigment') >= 0;
    var plan = ['cleanse', 'serum', wantsSPF ? 'spf' : 'day',   /* 3 */
                'tone', 'night',                                /* 5 */
                'eye', 'mask', 'exfoliate'];                    /* 8 */

    var taken = {}, items = [], i, p;
    for (i = 0; i < plan.length; i++) {
      p = pick(plan[i], want, ctx, taken);
      if (!p) continue;
      taken[p.id] = 1;
      ctx.lines[p.l] = (ctx.lines[p.l] || 0) + 1;
      items.push(p);
    }
    /* если какой-то шаг выпал — добираем лучшими из оставшихся */
    var fallback = ['day', 'spf', 'serum', 'mask'];
    for (i = 0; items.length < 8 && i < fallback.length; i++) {
      p = pick(fallback[i], want, ctx, taken);
      if (p) { taken[p.id] = 1; items.push(p); }
    }

    return { items: items, ctx: ctx, want: want };
  }

  /* ======================================================================
     ТЕКСТЫ РЕЗУЛЬТАТА
     ====================================================================== */
  function verdictTitle() {
    var t = GOAL_TITLE[answers.goal] || 'Domácí péče';
    return t + ' pro ' + (SKIN_ACC[answers.skin] || 'vaši pleť');
  }

  function verdictText(r) {
    var parts = [];
    parts.push(SKIN_NOM[answers.skin] + ' ' + AGE_OPENER[answers.age]);
    parts.push(GOAL_PLAN[answers.goal]);

    var iss = (answers.issues || []).map(function (v) {
      var o = Q[3].opts.filter(function (x) { return x.v === v; })[0];
      return o ? o.t.toLowerCase() : null;
    }).filter(Boolean);
    if (iss.length === 1) parts.push('Zvlášť jsem hlídala ' + iss[0] + '.');
    else if (iss.length > 1) parts.push('Zvlášť jsem hlídala ' + iss.slice(0, -1).join(', ') + ' a ' + iss[iss.length - 1] + '.');

    if (r.ctx.pregnancy) parts.push('Vzhledem k těhotenství nebo kojení jsem z výběru vyřadila retinoidy i silné kyseliny — všechny přípravky níže jsou v tomto ohledu bezpečné.');
    else if (r.ctx.reactive) parts.push('Kvůli citlivosti jsem vynechala kyseliny a dráždivé látky. Rutina je záměrně krátká.');
    if (answers.level === 'beginner') parts.push('Protože začínáte, doporučuji nejdřív Základní péči a rozšířit ji až za pár týdnů.');
    if (answers.brand === 'many') parts.push('Řady CHRISTINA jdou kombinovat mezi sebou — u vás jsem toho využila.');

    return parts.join(' ');
  }

  var LINE_CLAUSE = [
    'Z řady {l}, která je stavěná právě na {g}.',
    'Řada {l} je u vás páteří celé rutiny — tenhle krok ji drží pohromadě.',
    '{l} sem přidávám kvůli jinému složení, než má zbytek rutiny — doplňuje ji, nedubluje.'
  ];

  /* Обоснование: английское имя продукта + смысл шага.
     Клаузулу про линейку добавляем максимум дважды, чтобы список не звучал шаблонно. */
  function itemWhy(p, i, items) {
    var why = STEP_WHY[p.s] || '';
    var g = Q[0].opts.filter(function (o) { return o.v === answers.goal; })[0];
    var hit = g && g.care.some(function (c) { return p.c.indexOf(c) >= 0; });
    var mainLine = items[0] ? items[0].l : '';
    if (i === 1 && hit) {
      why += ' ' + LINE_CLAUSE[0].replace('{l}', p.l).replace('{g}', GOAL_WORD[answers.goal]);
    } else if (i === 0 && p.l === mainLine) {
      why += ' ' + LINE_CLAUSE[1].replace('{l}', p.l);
    } else if (p.l !== mainLine && i > 1 && !items.__alt) {
      var seen = items.slice(0, i).filter(function (x) { return x.l === p.l; }).length;
      if (!seen) { items.__alt = 1; why += ' ' + LINE_CLAUSE[2].replace('{l}', p.l); }
    }
    return why;
  }

  function notes(items, ctx) {
    var out = [];
    var has = function (s) { return items.some(function (p) { return p.s === s; }); };
    out.push('Nové přípravky zavádějte postupně, jeden za tři až pět dní. Pleť tak stihne zareagovat a vy poznáte, co jí sedí.');
    if (has('spf')) out.push('SPF nanášejte každý den, i když je zataženo. Je to nejdůležitější krok prevence stárnutí i pigmentace.');
    if (has('exfoliate') || has('mask')) out.push('Peeling a masku používejte nejvýše jednou až dvakrát týdně — častěji byste pleť přetížila.');
    if (ctx.pregnancy) out.push('I když je výběr bezpečný, každý nový přípravek během těhotenství raději proberte se svým lékařem.');
    if (ctx.reactive || ctx.allergy) out.push('Při citlivé pleti začněte večerní aplikací. Kdyby pleť reagovala, vynechte nejdřív sérum a vraťte ho až po týdnu.');
    if (answers.level === 'advanced') out.push('Sérum a noční krém můžete nasadit rovnou společně — s aktivními látkami už umíte pracovat.');
    out.push('Před prvním použitím udělejte test na malém místě za uchem a počkejte 24 hodin.');
    return out;
  }

  function routine(items) {
    var by = {}; items.forEach(function (p) { by[p.s] = p; });
    var morning = ['cleanse', 'tone', 'serum', 'spf', 'day'].map(function (s) { return by[s]; }).filter(Boolean);
    var evening = ['cleanse', 'tone', 'serum', 'night', 'eye'].map(function (s) { return by[s]; }).filter(Boolean);
    var weekly  = ['exfoliate', 'mask'].map(function (s) { return by[s]; }).filter(Boolean);
    if (!by.night && by.day) evening.push(by.day);
    return { morning: morning, evening: evening, weekly: weekly };
  }

  /* ======================================================================
     РЕНДЕР
     ====================================================================== */
  function setProgress(n, total) {
    if (!progress) return;
    if (n === null) { progress.hidden = true; return; }
    progress.hidden = false;
    $('.assist__progress-bar i', progress).style.width = Math.round(n / total * 100) + '%';
    $('.assist__progress-txt', progress).textContent = n + ' / ' + total;
  }

  function renderQuestion() {
    var q = Q[step];
    setProgress(step + 1, Q.length);
    var cur = answers[q.id];
    var on = function (v) {
      return q.kind === 'many' ? (cur || []).indexOf(v) >= 0 : cur === v;
    };
    body.innerHTML =
      '<div class="aq">' +
        '<span class="aq__eyebrow">Otázka ' + String(step + 1).padStart(2, '0') + '</span>' +
        '<h2 class="aq__title">' + esc(q.title) + '</h2>' +
        '<p class="aq__sub">' + esc(q.sub) + '</p>' +
        '<div class="aq__opts">' + q.opts.map(function (o) {
          return '<button type="button" class="aq__opt' + (on(o.v) ? ' is-on' : '') + '" data-v="' + o.v + '">' +
            '<span class="aq__opt-ico">' + optIcon(o) + '</span>' +
            '<span class="aq__opt-txt"><b>' + esc(o.t) + '</b><small>' + esc(o.d) + '</small></span>' +
            '<span class="aq__opt-check">' + ico('check') + '</span>' +
          '</button>';
        }).join('') + '</div>' +
        (q.kind === 'many' ? '<p class="aq__hint">Můžete vybrat víc možností.</p>' : '') +
        '<div class="aq__nav">' +
          (step > 0 ? '<button type="button" class="btn btn-outline aq__back">' + ico('chevron-left') + 'Zpět</button>' : '') +
          '<button type="button" class="btn aq__next">' + (step === Q.length - 1 ? 'Sestavit péči' : 'Další') + ico('arrow-right') + '</button>' +
        '</div>' +
      '</div>';

    $$('.aq__opt', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v');
        var opt = q.opts.filter(function (o) { return o.v === v; })[0];
        if (q.kind === 'many') {
          var arr = (answers[q.id] || []).slice();
          if (opt.solo) arr = arr.indexOf(v) >= 0 ? [] : [v];
          else {
            arr = arr.filter(function (x) {
              var o2 = q.opts.filter(function (o) { return o.v === x; })[0];
              return !(o2 && o2.solo);
            });
            var i = arr.indexOf(v);
            if (i >= 0) arr.splice(i, 1); else arr.push(v);
          }
          answers[q.id] = arr;
        } else {
          answers[q.id] = v;
        }
        renderQuestion();
        if (q.kind === 'one') setTimeout(next, 220);
      });
    });
    var back = $('.aq__back', body); if (back) back.addEventListener('click', prev);
    var nx = $('.aq__next', body);
    var ready = q.optional || (q.kind === 'many' ? (answers[q.id] || []).length > 0 : !!answers[q.id]);
    if (!ready) nx.setAttribute('disabled', '');
    nx.addEventListener('click', next);
    body.scrollTop = 0;
  }

  function next() {
    var q = Q[step];
    var ready = q.optional || (q.kind === 'many' ? (answers[q.id] || []).length > 0 : !!answers[q.id]);
    if (!ready) return;
    if (step < Q.length - 1) { step++; renderQuestion(); }
    else renderLoading();
  }
  function prev() { if (step > 0) { step--; renderQuestion(); } }

  var LOAD_STEPS = [
    'Procházím profil vaší pleti',
    'Porovnávám přípravky z katalogu CHRISTINA',
    'Kontroluji kombinace a omezení',
    'Skládám rutinu na ráno a večer'
  ];

  function renderLoading() {
    setProgress(null);
    body.innerHTML =
      '<div class="aload">' +
        '<div>' +
          '<div class="aload__ring">' + ico('sparkle') + '</div>' +
          '<h2 class="aload__title">Sestavuji vaši péči</h2>' +
          '<p class="aload__text">Dejte mi pár vteřin. Procházím složení, kontroluji, aby si přípravky navzájem nepřekážely, a hlídám vaše omezení.</p>' +
          '<div class="aload__steps">' + LOAD_STEPS.map(function (s, i) {
            return '<span class="aload__step" data-i="' + i + '">' + ico('check') + esc(s) + '</span>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';
    var els = $$('.aload__step', body);
    els.forEach(function (el, i) { setTimeout(function () { el.classList.add('is-on'); }, 350 + i * 520); });
    setTimeout(function () { result = build(); activePack = 5; renderResult(); }, 2500);
  }

  function packItems() {
    return result.items.slice(0, activePack);
  }
  function packSum() {
    return packItems().reduce(function (a, p) { return a + p.p; }, 0);
  }

  function renderResult() {
    setProgress(null);
    var items = packItems();
    items.__alt = 0;
    var r = routine(items), ns = notes(items, result.ctx);

    body.innerHTML =
      '<div class="ares">' +
        '<span class="ares__from">— od Kristýny</span>' +
        '<h2 class="ares__title">' + esc(verdictTitle()) + '</h2>' +
        '<p class="ares__verdict">' + esc(verdictText(result)) + '</p>' +

        '<section class="ares__sec">' +
          '<span class="ares__hk">Tři úrovně</span>' +
          '<h3 class="ares__h">Vyberte, čím začít</h3>' +
          '<p class="ares__hsub">Můžete začít třemi klíčovými přípravky, kompletní domácí rutinou, nebo rozšířenou variantou s týdenní péčí. Všechny varianty na sebe navazují.</p>' +
          '<div class="apacks">' + PACKS.map(function (pk) {
            var sum = result.items.slice(0, pk.size).reduce(function (a, p) { return a + p.p; }, 0);
            return '<button type="button" class="apack' + (activePack === pk.size ? ' is-on' : '') + '" data-size="' + pk.size + '">' +
              (pk.best ? '<span class="apack__badge">Doporučujeme</span>' : '') +
              '<span class="apack__tag">' + esc(pk.key) + '</span>' +
              '<span class="apack__n">' + plural(pk.size) + '</span>' +
              '<span class="apack__price">' + money(sum) + '</span>' +
            '</button>';
          }).join('') + '</div>' +

          '<div class="aitems">' + items.map(function (p, i) {
            return '<article class="aitem" data-id="' + esc(p.id) + '">' +
              '<span class="aitem__n">' + String(i + 1).padStart(2, '0') + '</span>' +
              '<img class="aitem__img" src="' + esc(p.img) + '" alt="" loading="lazy">' +
              '<div class="aitem__body">' +
                '<span class="aitem__line">' + esc(p.l) + '</span>' +
                '<span class="aitem__name">' + esc(p.n) + '</span>' +
                '<span class="aitem__step">' + esc(p.sl) + '</span>' +
                '<span class="aitem__why">' + (p.en ? '<b>' + esc(p.en) + '</b> — ' : '') + esc(itemWhy(p, i, items)) + '</span>' +
              '</div>' +
              '<div class="aitem__side">' +
                '<span class="aitem__price">' + money(p.p) + '</span>' +
                '<button type="button" class="btn aitem__add">Do košíku</button>' +
              '</div>' +
            '</article>';
          }).join('') + '</div>' +

          '<div class="abuy">' +
            '<div class="abuy__meta"><b>' + money(packSum()) + '</b>' +
              '<small>' + plural(items.length) + ' · ' + esc(PACKS.filter(function (x) { return x.size === activePack; })[0].key) + '</small></div>' +
            '<button type="button" class="btn abuy__all">Přidat celou péči do košíku</button>' +
          '</div>' +
        '</section>' +

        '<section class="ares__sec">' +
          '<span class="ares__hk">Jak používat</span>' +
          '<h3 class="ares__h">Váš den</h3>' +
          '<p class="ares__hsub">Pořadí kroků není detail — je to polovina výsledku. Takhle vypadá den s touto péčí.</p>' +
          '<div class="aday">' +
            dayCol('sun', 'Ráno', '07:00 – 08:00', r.morning) +
            dayCol('moon', 'Večer', '21:00 – 22:00', r.evening) +
          '</div>' +
          (r.weekly.length ? '<div class="aday" style="margin-top:var(--sp-4)">' +
            dayCol('refresh', 'Jednou až dvakrát týdně', 'večer, místo séra', r.weekly) + '</div>' : '') +
        '</section>' +

        '<section class="ares__sec">' +
          '<span class="ares__hk">Poznámky</span>' +
          '<h3 class="ares__h">Co je dobré vědět</h3>' +
          '<ul class="anotes">' + ns.map(function (n) {
            return '<li>' + ico('info') + '<span>' + esc(n) + '</span></li>';
          }).join('') + '</ul>' +
        '</section>' +

        '<div class="aend">' +
          '<form class="aend__mail">' +
            '<input type="email" placeholder="vas@email.cz" aria-label="E-mail">' +
            '<button type="submit" class="btn btn-outline">Uložit výsledek na e-mail</button>' +
          '</form>' +
          '<button type="button" class="ares__restart">' + ico('refresh') + 'Projít dotazník znovu</button>' +
        '</div>' +
        '<p class="ares__legal">Doporučení vychází z vašich odpovědí a z katalogu CHRISTINA. Nejde o lékařskou konzultaci — při kožním onemocnění se obraťte na dermatologa.</p>' +
      '</div>';

    $$('.apack', body).forEach(function (b) {
      b.addEventListener('click', function () { activePack = +b.getAttribute('data-size'); renderResult(); });
    });
    $$('.aitem', body).forEach(function (el) {
      var p = result.items.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      $('.aitem__add', el).addEventListener('click', function () {
        addOne(p); el.classList.add('is-added');
        $('.aitem__add', el).textContent = 'Přidáno';
      });
    });
    $('.abuy__all', body).addEventListener('click', function () {
      packItems().forEach(addOne);
      if (window.demoToast) window.demoToast(items.length + ' přípravků přidáno do košíku.');
      close();
    });
    $('.aend__mail', body).addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.demoToast) window.demoToast('výsledek by se odeslal na váš e-mail.');
    });
    $('.ares__restart', body).addEventListener('click', function () {
      answers = {}; step = 0; result = null; renderQuestion();
    });
    body.scrollTop = 0;
  }

  function dayCol(icon, title, time, list) {
    return '<div class="aday__col">' +
      '<div class="aday__hd">' + ico(icon) + '<b>' + esc(title) + '</b><small>' + esc(time) + '</small></div>' +
      '<ol class="aday__list">' + list.map(function (p) {
        return '<li><span><b>' + esc(p.sl) + '</b>' + esc(p.n) + '</span></li>';
      }).join('') + '</ol>' +
    '</div>';
  }

  /* В демо кладём в фейковую корзину, на боевом — в шоптетовскую. */
  function addOne(p) {
    if (window.demoAddToCart) {
      window.demoAddToCart({ id: p.id, name: p.n, price: p.p, qty: 1, img: p.img });
      return;
    }
    if (!p.sid) return;
    var fd = new FormData();
    fd.append('productId', p.sid);
    fd.append('amount', '1');
    fetch('/action/Cart/addCartItem/', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function () {
        if (window.shoptet && window.shoptet.cart && window.shoptet.cart.reloadCart) window.shoptet.cart.reloadCart();
        else document.dispatchEvent(new CustomEvent('ShoptetCartUpdated'));
      })
      .catch(function () {});
  }

  /* ======================================================================
     ОТКРЫТИЕ / ЗАКРЫТИЕ
     ====================================================================== */
  var lastFocus = null;

  function open() {
    if (!root) return;
    lastFocus = document.activeElement;
    root.hidden = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('demo-locked');
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    if (!catalog) loadCatalog(); else if (!result) renderQuestion();
    if (result) renderResult();
  }
  function close() {
    if (!root) return;
    root.classList.remove('is-open');
    document.body.classList.remove('demo-locked');
    setTimeout(function () { root.hidden = true; root.setAttribute('aria-hidden', 'true'); }, 260);
    if (lastFocus) lastFocus.focus();
  }

  /* Каталог: сначала fetch, при неудаче — обычным <script> (нужно для file://,
     где fetch запрещён политикой origin). */
  function loadCatalog() {
    if (loading) return;
    loading = true;
    body.innerHTML = '<div class="aload"><div><div class="aload__ring">' + ico('sparkle') + '</div>' +
                     '<p class="aload__text">Načítám katalog…</p></div></div>';

    function ready(data) { catalog = data; loading = false; renderQuestion(); }
    function fail() {
      loading = false;
      body.innerHTML = '<div class="aload"><div><p class="aload__text">' +
        'Katalog se nepodařilo načíst. Zkuste to prosím znovu.</p></div></div>';
    }
    function viaScript() {
      if (window.PORADCE_CATALOG) { ready(window.PORADCE_CATALOG); return; }
      var sc = document.createElement('script');
      sc.src = CATALOG_URL.replace(/\.json$/, '.js');
      sc.onload = function () {
        if (window.PORADCE_CATALOG) ready(window.PORADCE_CATALOG); else fail();
      };
      sc.onerror = fail;
      document.head.appendChild(sc);
    }

    if (location.protocol === 'file:') { viaScript(); return; }
    fetch(CATALOG_URL)
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(ready)
      .catch(viaScript);
  }

  var OVERLAY_HTML =
    '<div class="assist" id="assist" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Poradce péče">' +
      '<div class="assist__scrim" data-assist-close></div>' +
      '<div class="assist__panel" role="document">' +
        '<header class="assist__bar">' +
          '<div class="assist__who"><span class="assist__ava">' + icoOr('advisor') + '</span>' +
            '<span class="assist__who-txt"><b>Kristýna</b><small>Poradkyně péče CHRISTINA</small></span></div>' +
          '<div class="assist__progress" id="assist-progress" hidden>' +
            '<div class="assist__progress-bar"><i></i></div><span class="assist__progress-txt"></span></div>' +
          '<button type="button" class="assist__close" data-assist-close aria-label="Zavřít">' + ico('close') + '</button>' +
        '</header>' +
        '<div class="assist__body" id="assist-body"></div>' +
      '</div>' +
    '</div>';

  var PROMO_HTML =
    '<section class="assist-promo"><div class="assist-promo__inner">' +
      '<div class="assist-promo__badge">' + icoOr('advisor') + '</div>' +
      '<div class="assist-promo__copy">' +
        '<span class="assist-promo__eyebrow">Osobní poradkyně</span>' +
        '<h2 class="assist-promo__title">Nevíte, čím začít?</h2>' +
        '<p class="assist-promo__text">Odpovězte na sedm otázek o své pleti a Kristýna sestaví domácí péči přesně pro vás — z více než 130 přípravků CHRISTINA. Zabere to dvě minuty.</p>' +
      '</div>' +
      '<button type="button" class="assist-btn assist-btn--lg js-assist-open">' + ico('sparkle') + '<span>Vybrat péči</span></button>' +
    '</div></section>';

  var FAB_HTML =
    '<button type="button" class="assist-fab js-assist-open" aria-label="Vybrat péči">' +
      ico('sparkle') + '<span>Vybrat péči</span></button>';

  function mountMarkup() {
    if (SPRITE_URL && !document.getElementById('icon-sprite')) {
      fetch(SPRITE_URL).then(function (r) { return r.text(); }).then(function (svg) {
        var d = document.createElement('div');
        d.style.display = 'none';
        d.innerHTML = svg;
        document.body.insertBefore(d, document.body.firstChild);
        refreshIcons();
      }).catch(function () {});
    }
    if (!$('#assist')) document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);
    if (!$('.assist-fab')) document.body.insertAdjacentHTML('beforeend', FAB_HTML);
    if (PROMO_AFTER && !$('.assist-promo')) {
      var anchor = $(PROMO_AFTER);
      if (anchor) anchor.insertAdjacentHTML('afterend', PROMO_HTML);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountMarkup();
    root = $('#assist'); body = $('#assist-body'); progress = $('#assist-progress');
    if (!root) return;
    refreshIcons();
    $$('.js-assist-open').forEach(function (b) { b.addEventListener('click', open); });
    $$('[data-assist-close]', root).forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) close();
    });
    /* ?poradce=1 — сразу открыть; &odpovedi=goal,skin,age,issues|issues,level,brand,limits
       — прокрутить до результата. Нужно для снятия скриншотов и демо-ссылок. */
    var qs = new URLSearchParams(location.search);
    if (qs.get('plne')) document.documentElement.setAttribute('data-assist-full', '1');
    if (qs.get('odpovedi')) {
      var a = qs.get('odpovedi').split(',');
      answers = { goal: a[0], skin: a[1], age: a[2],
                  issues: (a[3] || '').split('|').filter(Boolean),
                  level: a[4], brand: a[5],
                  limits: (a[6] || '').split('|').filter(Boolean) };
      open();
      var wait = setInterval(function () {
        if (!catalog) return;
        clearInterval(wait);
        result = build(); activePack = +(qs.get('balicek') || 5); renderResult();
      }, 80);
    } else if (qs.get('poradce')) {
      open();
    }

    /* кнопка в шапке */
    var nav = $('.navigation-buttons');
    if (nav) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'assist-btn js-assist-open';
      b.innerHTML = ico('sparkle') + '<span>Poradce péče</span>';
      b.addEventListener('click', open);
      nav.insertBefore(b, nav.firstChild);
    }
  });
})();
