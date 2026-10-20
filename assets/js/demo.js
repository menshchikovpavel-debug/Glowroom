/* ==========================================================================
   demo.js — поведение витрины в демоверсии.
   Заменяет вырезанный main-3g.js Shoptet: карусель, слайдеры товаров,
   выпадающее меню, мини-корзина, тосты, модалка «страница вне демо».
   В боевой версии этот файл не нужен — всё уже умеет сам Shoptet.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- тосты */
  var toastEl = $('#demo-toast'), toastTimer;
  function toast(msg, kind) {
    if (!toastEl) return;
    toastEl.innerHTML = '<span class="demo-toast__mark">Demoverze</span>' + msg;
    toastEl.className = 'demo-toast is-open' + (kind ? ' demo-toast--' + kind : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-open');
      setTimeout(function () { toastEl.hidden = true; }, 260);
    }, 3200);
  }
  window.demoToast = toast;


  /* ==================================================================
     Роутер демо. Все страницы лежат в одном index.html внутри #demo-pages;
     клик по ссылке показывает нужную и подменяет класс на <body> — от него
     зависят стили (type-category, type-detail, ordering-process и т. д.).
     ================================================================== */
  var pagesBox = $('#demo-pages');
  var ROUTES = {
    '/': 'index',
    '/domaci-pece/': 'eshop',
    '/profesionalni-kosmetika/': 'eshop',
    '/slevy/': 'eshop',
    '/biophyto-domaci-pece/': 'kategorie',
    '/biophyto-domaci-pece/biophyto-jemny-cistici-gel/': 'produkt',
    '/o-kosmetice/o-spolecnosti-christina/': 'stranka',
    '/o-kosmetice/': 'stranka',
    '/sluzby/': 'sluzby',
    '/pro-salony/': 'salony',
    '/profesionalni-kosmetika/': 'salon',
    '/slevy/': 'akce',
    '/kosmeticke-rady/': 'eshop',
    '/kontakty/': 'kontakty',
    '/kosik/': 'kosik'
  };
  /* Демо содержит по одному экземпляру каждого типа страницы. Чтобы по нему
     можно было ходить, любая ссылка на товар ведёт на нашу страницу товара,
     любая ссылка на категорию — на нашу категорию. Модалка остаётся для
     страниц, которых в демо нет вообще: блог, контакты, юридические. */
  var NOT_SHOP = /^(kosik|login|registrace|vyhledavani|blog|jak-nakupovat|obchodni-podminky|doprava-a-platba|odstoupeni-od-smlouvy|ochrana-osobnich-udaju|zasady-|hodnoceni-obchodu|external)/;

  function routeFor(path) {
    var direct = ROUTES[path] || ROUTES[path.replace(/\/$/, '') + '/'];
    if (direct) return direct;

    var parts = path.split('/').filter(Boolean);
    if (!parts.length) return 'index';
    if (NOT_SHOP.test(parts[0])) return null;
    return parts.length >= 2 ? 'produkt' : 'kategorie';
  }

  var BASE_BODY = document.body.className
    .replace(/\btype-[a-z-]+\b/g, '')
    .replace(/\bordering-process\b/g, '')
    .replace(/\s+/g, ' ').trim();

  /* Демо содержит по одному экземпляру каждого типа страницы, поэтому
     ссылка на «Séra» и на «Masky» открывает одну и ту же категорию.
     Чтобы это не выглядело поломкой, подставляем в заголовок и в последнюю
     крошку название того пункта, по которому кликнули. */
  function retitle(target, label) {
    var h1 = $('h1', target);
    if (h1) {
      if (target.getAttribute('data-h1') === null) target.setAttribute('data-h1', h1.textContent.trim());
      h1.textContent = label || target.getAttribute('data-h1');
    }
    var crumbs = $$('.breadcrumbs > span', target);
    var last = crumbs[crumbs.length - 1];
    var span = last && (last.querySelector('span[itemprop="name"]') || last);
    if (span) {
      if (last.getAttribute('data-crumb') === null) last.setAttribute('data-crumb', span.textContent.trim());
      span.textContent = label || last.getAttribute('data-crumb');
    }
  }

  function showPage(key, push, label) {
    if (!pagesBox) return false;
    var target = $('.demo-page[data-page="' + key + '"]', pagesBox);
    if (!target) return false;
    retitle(target, label);

    $$('.demo-page', pagesBox).forEach(function (p) { p.hidden = p !== target; });
    document.body.className = BASE_BODY + ' ' + (target.getAttribute('data-body') || '');
    document.title = target.getAttribute('data-title') || document.title;
    document.body.classList.toggle('demo-no-footer', key === 'kosik');

    /* подсветка текущего раздела в меню */
    var top = ({ kategorie: 'eshop', produkt: 'eshop' })[key] || key;
    $$('.menu-level-1 > li').forEach(function (li) {
      var a = li.querySelector(':scope > a');
      li.classList.toggle('active', !!a && a.getAttribute('href') === '#' + top);
    });

    /* меню не должно оставаться раскрытым после перехода. Курсор всё ещё
       стоит на пункте, поэтому :hover продолжает работать — держим замок,
       пока мышь не уйдёт с навигации. */
    document.body.classList.remove('demo-menu-open');
    document.body.classList.add('demo-menu-lock');
    $$('.menu-level-1 > li').forEach(function (li) { li.classList.remove('is-open', 'is-menu-demo'); });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    if (push) history.pushState({ page: key }, '', key === 'index' ? './' : '#' + key);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    /* виджеты внутри только что показанной страницы */
    document.dispatchEvent(new CustomEvent('demo:page', { detail: { page: key } }));
    return true;
  }
  window.demoShowPage = showPage;

  if (pagesBox) {
    var hash = location.hash.replace('#', '');
    if (hash && $('.demo-page[data-page="' + hash + '"]')) showPage(hash, false);
    window.addEventListener('popstate', function () {
      showPage(location.hash.replace('#', '') || 'index', false);
    });
  }

  /* затемнение страницы под раскрытым мегаменю */
  $$('.menu-level-1 > li.ext').forEach(function (li) {
    li.addEventListener('mouseenter', function () {
      if (!document.body.classList.contains('demo-menu-lock')) {
        document.body.classList.add('demo-menu-open');
      }
    });
    li.addEventListener('mouseleave', function () { document.body.classList.remove('demo-menu-open'); });
  });
  var navBox = $('#navigation') || $('.navigation-in');
  if (navBox) navBox.addEventListener('mouseleave', function () {
    document.body.classList.remove('demo-menu-lock');
  });
  window.addEventListener('scroll', function () {
    document.body.classList.remove('demo-menu-lock');
  }, { passive: true });

  /* ------------------------------------------------ модалка «вне демо» */
  var modal = $('#demo-modal'), crumb = $('#demo-crumb'), lastFocus = null;
  var LABELS = {
    'kosik': 'Košík', 'login': 'Přihlášení', 'domaci-pece': 'Domácí péče',
    'o-kosmetice': 'O kosmetice', 'kosmeticke-rady': 'Řady CHRISTINA',
    'typ': 'Typ péče', 'pro-salony': 'Pro salony', 'external': 'Externí odkaz'
  };
  function pretty(seg) {
    if (LABELS[seg]) return LABELS[seg];
    return seg.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function openModal(path) {
    if (!modal) return;
    lastFocus = document.activeElement;
    var parts = String(path || '').split('/').filter(Boolean);
    crumb.innerHTML = '<span>Úvod</span>' + parts.map(function (p) {
      return '<span aria-hidden="true">›</span><span>' + pretty(p) + '</span>';
    }).join('');
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    document.body.classList.add('demo-locked');
    var b = modal.querySelector('.demo-modal__x'); if (b) b.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('demo-locked');
    setTimeout(function () { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); }, 220);
    if (lastFocus) lastFocus.focus();
    if (location.hash && location.hash !== '#') history.replaceState(null, '', location.pathname);
  }
  $$('[data-demo-close]').forEach(function (b) { b.addEventListener('click', closeModal); });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    /* ссылки внутри демо */
    if (href.indexOf('#/') === 0) {
      e.preventDefault();
      var path = href.slice(1);
      var key = routeFor(path);
      /* точный маршрут ведёт на «свою» страницу — заголовок не трогаем */
      var exact = !!(ROUTES[path] || ROUTES[path.replace(/\/$/, '') + '/']);
      var label = exact ? null : (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (key && showPage(key, true, label)) return;
      openModal(href.slice(2));
      return;
    }
    /* якоря страниц демо: #eshop, #kategorie, … и './' для главной */
    var anchor = href.replace(/^[.#\/]+/, '').replace('.html', '');
    if (href === './' || href === '/' ) { e.preventDefault(); showPage('index', true); return; }
    if (/^(index|eshop|salon|akce|sluzby|salony|kategorie|produkt|stranka|kontakty|kosik)$/.test(anchor)) {
      e.preventDefault();
      showPage(anchor, true);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modal && !modal.hidden) closeModal();
  });

  /* --------------------------------------------------------- формы демо */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.classList.contains('pr-action')) return;          // корзину обрабатываем ниже
    e.preventDefault();
    if (f.classList.contains('search-form')) { toast('vyhledávání není v ukázce aktivní.'); return; }
    if (f.classList.contains('subscribe-form')) { toast('přihlášení k newsletteru se neodesílá.'); return; }
    toast('formulář se v ukázce neodesílá.');
  });

  /* ------------------------------------------------------------ корзина */
  var cart = { items: [], count: 0, sum: 0 };
  function money(n) { return n.toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč'; }
  function renderCart() {
    var link = $('.navigation-buttons .cart-count');
    if (link) {
      link.setAttribute('data-count', cart.count);
      var p = link.querySelector('.cart-price');
      if (p) p.textContent = cart.count ? money(cart.sum) : 'Prázdný košík';
    }
    var w = $('#cart-widget .popup-widget-inner');
    if (!w) return;
    if (!cart.count) { w.innerHTML = '<p class="mini-cart__empty">Váš košík je prázdný.</p>'; return; }
    w.innerHTML =
      '<div class="mini-cart">' +
        '<div class="mini-cart__list">' + cart.items.map(function (i) {
          return '<div class="mini-cart__item">' +
            (i.img ? '<img src="' + i.img + '" alt="" loading="lazy">' : '<span class="mini-cart__ph"></span>') +
            '<span class="mini-cart__meta"><b>' + i.name + '</b><small>' + i.qty + ' × ' + money(i.price) + '</small></span>' +
            '<span class="mini-cart__sum">' + money(i.qty * i.price) + '</span>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="mini-cart__total"><span>Celkem</span><b>' + money(cart.sum) + '</b></div>' +
        '<a href="#/kosik/" class="btn mini-cart__go">Přejít do košíku</a>' +
      '</div>';
  }
  function addToCart(item) {
    var ex = cart.items.filter(function (i) { return i.id === item.id; })[0];
    if (ex) ex.qty += item.qty; else cart.items.push(item);
    cart.count += item.qty;
    cart.sum += item.qty * item.price;
    renderCart();
    openCartPopup();
  }
  window.demoAddToCart = addToCart;

  var cartPopup = $('#cart-widget'), cartTimer;
  function openCartPopup() {
    if (!cartPopup) return;
    cartPopup.classList.add('is-open');
    clearTimeout(cartTimer);
    cartTimer = setTimeout(function () { cartPopup.classList.remove('is-open'); }, 4200);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.cart-count, #cart-widget');
    if (!t && cartPopup) cartPopup.classList.remove('is-open');
  });

  /* товары со страницы → в корзину */
  $$('.product .p').forEach(function (p) {
    var form = $('form.pr-action', p);
    if (!form) return;
    var name  = (($('a.name span', p) || {}).textContent || '').trim();
    var price = parseFloat((form.closest('.p-bottom') || p).querySelector('[data-micro-price]')
                 ? (form.closest('.p-bottom').querySelector('[data-micro-price]').getAttribute('data-micro-price')) : '0') || 0;
    var img   = ($('a.image img', p) || {}).src || '';
    var id    = ($('.p', p) || p).getAttribute('data-micro-product-id') || name;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var qty = parseInt((form.querySelector('input.amount') || {}).value, 10) || 1;
      addToCart({ id: id, name: name, price: price, qty: qty, img: img });
    });
    var inc = $('.increase', form), dec = $('.decrease', form), amt = $('input.amount', form);
    if (inc && amt) inc.addEventListener('click', function () { amt.value = Math.min(9999, (+amt.value || 1) + 1); });
    if (dec && amt) dec.addEventListener('click', function () { amt.value = Math.max(1, (+amt.value || 1) - 1); });
  });
  renderCart();

  /* ----------------------------------------------------------- карусель */
  (function () {
    var root = $('#carousel'); if (!root) return;
    var items = $$('.carousel-inner .item', root);
    var dots  = $$('.carousel-dots button', root);
    var i = Math.max(0, items.findIndex(function (el) { return el.classList.contains('active'); }));
    var timer, DUR = 6000;

    function show(n) {
      i = (n + items.length) % items.length;
      items.forEach(function (el, k) { el.classList.toggle('active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      root.setAttribute('data-hero-tone', items[i].getAttribute('data-tone') === 'brandred' ? 'dark' : 'light');
    }
    function play()  { stop(); timer = setInterval(function () { show(i + 1); }, DUR); }
    function stop()  { clearInterval(timer); }

    $$('.carousel-control', root).forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        show(i + (c.classList.contains('right') ? 1 : -1)); play();
      });
    });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { show(+d.getAttribute('data-slide-to')); play(); });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);

    /* свайп */
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
      x0 = null; play();
    });

    show(i); play();
  })();

  /* -------------------------------------------------- слайдеры товаров */
  $$('.products-nav').forEach(function (nav) {
    var grid = document.getElementById(nav.getAttribute('data-for'));
    if (!grid) return;
    var all = $$('.product', grid);
    var per = function () {
      var w = window.innerWidth;
      return w < 768 ? 2 : w < 1200 ? 3 : 4;
    };
    var page = 0;
    function render() {
      var n = per(), max = Math.max(0, Math.ceil(all.length / n) - 1);
      page = Math.min(page, max);
      all.forEach(function (el, k) {
        var on = k >= page * n && k < (page + 1) * n;
        el.style.display = on ? '' : 'none';
      });
      $$('button', nav).forEach(function (b) {
        var d = +b.getAttribute('data-dir');
        b.disabled = (d < 0 && page === 0) || (d > 0 && page === max);
      });
    }
    $$('button', nav).forEach(function (b) {
      b.addEventListener('click', function () { page += +b.getAttribute('data-dir'); render(); });
    });
    window.addEventListener('resize', render);
    grid.classList.add('is-paged');
    render();
  });

  /* --------------------------------------------------- меню и мобилка */
  var hamburger = $('[data-target="navigation"]');
  if (hamburger) hamburger.addEventListener('click', function (e) {
    e.preventDefault();
    document.body.classList.toggle('demo-nav-open');
  });
  var searchToggle = $('[data-target="search"]');
  if (searchToggle) searchToggle.addEventListener('click', function (e) {
    e.preventDefault();
    document.body.classList.toggle('demo-search-open');
    var inp = $('.search-form .search-input'); if (inp) inp.focus();
  });
  $$('.menu-level-1 > li').forEach(function (li) {
    var a = li.querySelector(':scope > a');
    var sub = li.querySelector(':scope > .menu-level-2');
    if (!a || !sub) return;
    a.addEventListener('click', function (e) {
      if (window.innerWidth > 991) return;
      e.preventDefault(); e.stopPropagation();
      li.classList.toggle('is-open');
    });
  });

  /* ------------------------------------ карточка товара: вкладки
     На боевом сайте вкладки переключает родной main-3g.js. */
  var tabs = $$('.shp-tabs > li > a');
  if (tabs.length) {
    tabs.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var id = (a.getAttribute('href') || '').replace(/^#/, '');
        $$('.shp-tabs > li').forEach(function (li) { li.classList.remove('active'); });
        a.parentNode.classList.add('active');
        $$('.tab-content > .tab-pane').forEach(function (p) {
          var on = p.id === id;
          p.classList.toggle('active', on);
          p.classList.toggle('in', on);   /* .fade без .in остаётся прозрачной */
        });
      });
    });
    if (!$('.shp-tabs > li.active')) tabs[0].parentNode.classList.add('active');
    if (!$('.tab-content > .tab-pane.active')) {
      var first = $('.tab-content > .tab-pane');
      if (first) first.classList.add('active');
    }
  }

  /* степпер на карточке товара */
  var detailQty = $('.p-detail .add-to-cart .quantity');
  if (detailQty) {
    var amt = $('input.amount', detailQty);
    var inc = $('.increase', detailQty), dec = $('.decrease', detailQty);
    if (inc && amt) inc.addEventListener('click', function () { amt.value = Math.min(9999, (+amt.value || 1) + 1); });
    if (dec && amt) dec.addEventListener('click', function () { amt.value = Math.max(1, (+amt.value || 1) - 1); });
  }

  /* ------------------------------- категория: сортировка и фильтры
     На боевом сайте это делает родной main-3g.js, который в демо вырезан. */
  $$('.listSorting').forEach(function (sorting) {
    var sortBtn = $('.sortingToggle', sorting);
    if (sortBtn) sortBtn.addEventListener('click', function (e) {
      e.preventDefault();
      sorting.classList.toggle('is-open');
    });
    $$('.listSorting__control', sorting).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        $$('.listSorting__control', sorting).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var v = $('.sortingToggle__value', sorting);
        if (v) v.textContent = b.textContent.trim();
        sorting.classList.remove('is-open');
        toast('řazení se v ukázce nemění.');
      });
    });
    document.addEventListener('click', function (e) {
      if (!sorting.contains(e.target)) sorting.classList.remove('is-open');
    });
  });

  $$('.filters-wrapper').forEach(function (wrap) {
    var unveil = $('.unveil-button', wrap);
    var box = $('.filters', wrap);
    if (!unveil || !box) return;
    /* display задаёт стиль шаблона, поэтому переключаем инлайном */
    var open = false;
    function paint() {
      box.hidden = !open;
      box.style.display = open ? 'block' : 'none';
      unveil.textContent = open ? 'Zavřít filtr' : 'Otevřít filtr';
      wrap.classList.toggle('is-open', open);
    }
    paint();
    unveil.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open = !open;
      paint();
    });
  });
  $$('.filters input[type="checkbox"]').forEach(function (c) {
    c.addEventListener('change', function () { toast('filtry se v ukázce nepoužijí.'); });
  });

  /* ------------------------------------------------------- cookie-бар */
  var cookies = $('.js-siteCookies');
  function syncCookieHeight() {
    var vis = cookies && getComputedStyle(cookies).display !== 'none';
    var h = vis ? cookies.getBoundingClientRect().height + 12 : 0;
    document.documentElement.style.setProperty('--cookie-h', Math.round(h) + 'px');
  }
  if (cookies) { syncCookieHeight(); window.addEventListener('resize', syncCookieHeight); }
  if (cookies) $$('.siteCookies__button', cookies).forEach(function (b) {
    b.addEventListener('click', function () {
      cookies.style.display = 'none';
      document.body.classList.add('cookies-done');
      syncCookieHeight();
    });
  });

  /* ?hover=1 — принудительно раскрывает ховер второй карточки, чтобы состояние
     можно было снять скриншотом. На поведение демо не влияет. */
  var menuN = new URLSearchParams(location.search).get('menu');
  if (menuN) {
    var exts = $$('.navigation-in > ul > li.ext');
    var li = exts[Math.max(0, (+menuN || 1) - 1)];
    if (li) { li.classList.add('is-menu-demo'); document.body.classList.add('demo-menu-open'); }
  }

  if (new URLSearchParams(location.search).get('hover')) {
    var demoCard = $$('.product .p')[1];
    if (demoCard) demoCard.classList.add('is-hover-demo');
  }

  /* ----------------------------------------------- плашка Aurifer */
  var badge = $('#demo-badge'), badgeX = $('#demo-badge-close');
  if (badgeX) badgeX.addEventListener('click', function () { badge.classList.add('is-hidden'); });
})();
