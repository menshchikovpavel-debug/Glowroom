/* ==========================================================================
   storefront.js — правки витрины, которые нельзя сделать одним CSS.
   Идёт и в демо, и в боевую версию (см. Shoptet/christina-widgets.js).
   Две вещи:
     1) Instagram-лента переезжает из подвала в отдельную секцию перед ним;
     2) блоки товаров на главной становятся листаемыми (стрелки + точки).
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var CFG = window.CHRISTINA_CONFIG || {};
  var AVATAR = CFG.instagramAvatar || 'assets/img/brand/instagram-avatar.jpg';
  var HANDLE = CFG.instagramHandle || '@christinakosmetika';

  /* ------------------------------------------------------------------
     1. Instagram — последняя секция сайта, перед подвалом
     ------------------------------------------------------------------ */
  function moveInstagram() {
    var col = $('.custom-footer__instagram');
    var footer = $('#footer') || $('footer.footer');
    if (!col || !footer) return;

    var widget = $('.instagram-widget', col);
    if (!widget) return;

    /* «Sledovat na Instagramu» — последний элемент виджета, он же кнопка */
    var kids = Array.prototype.slice.call(widget.children);
    var follow = kids[kids.length - 1];
    var followHref = '#';
    if (follow && !follow.querySelector('img')) {
      var a = follow.querySelector('a');
      if (a) followHref = a.getAttribute('href') || '#';
      follow.parentNode.removeChild(follow);
    }

    var section = document.createElement('section');
    section.className = 'ig-section';
    section.innerHTML =
      '<div class="container ig-section__inner">' +
        '<header class="ig-head">' +
          '<img class="ig-head__ava" src="' + AVATAR + '" alt="" width="80" height="80" loading="lazy">' +
          '<div class="ig-head__meta"><b>christinakosmetika</b><span>' + HANDLE + '</span></div>' +
          '<a class="ig-head__btn" href="' + followHref + '" target="_blank" rel="noopener">Sledovat na Instagramu</a>' +
        '</header>' +
      '</div>';
    section.querySelector('.ig-section__inner').appendChild(widget);
    footer.parentNode.insertBefore(section, footer);
    col.parentNode.removeChild(col);
  }

  /* ------------------------------------------------------------------
     2. Блоки товаров — листаемые: стрелки по бокам, точки под лентой
     ------------------------------------------------------------------ */
  /* Лента листается трансформом, а не скроллом: у карточки при наведении
     выезжает полка с описанием, и overflow-y должен оставаться видимым. */
  function makeSlider(grid) {
    var items = $$('.product', grid);
    if (items.length < 2) return;

    var wrap = grid.closest('.products-wrapper') || grid.parentNode;
    wrap.classList.add('slider');

    var view = document.createElement('div');
    view.className = 'slider__viewport';
    grid.parentNode.insertBefore(view, grid);
    view.appendChild(grid);
    grid.classList.add('slider__track');

    var nav = document.createElement('div');
    nav.className = 'slider__nav';
    nav.innerHTML =
      '<button type="button" class="slider__btn slider__btn--prev" aria-label="Předchozí">' +
        '<svg class="ico" aria-hidden="true"><use href="#ic-chevron-left"/></svg></button>' +
      '<button type="button" class="slider__btn slider__btn--next" aria-label="Další">' +
        '<svg class="ico" aria-hidden="true"><use href="#ic-chevron-right"/></svg></button>';
    wrap.appendChild(nav);

    var dots = document.createElement('div');
    dots.className = 'slider__dots';
    wrap.appendChild(dots);

    var page = 0;

    function perView() {
      var w = window.innerWidth;
      return w < 576 ? 2 : w < 992 ? 3 : 4;
    }
    function pages() { return Math.max(1, Math.ceil(items.length / perView())); }
    function step() {
      var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      return (items[0].getBoundingClientRect().width + gap) * perView();
    }

    function renderDots() {
      var n = pages();
      if (dots.childElementCount !== n) {
        dots.innerHTML = '';
        for (var i = 0; i < n; i++) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Strana ' + (i + 1));
          b.addEventListener('click', (function (k) { return function () { go(k); }; })(i));
          dots.appendChild(b);
        }
      }
      $$('button', dots).forEach(function (b, i) { b.classList.toggle('is-active', i === page); });
      dots.hidden = n < 2;
      nav.hidden = n < 2;
    }

    function go(p) {
      page = Math.max(0, Math.min(p, pages() - 1));
      grid.style.transform = 'translate3d(' + (-page * step()) + 'px,0,0)';
      sync();
    }
    function sync() {
      $('.slider__btn--prev', nav).disabled = page <= 0;
      $('.slider__btn--next', nav).disabled = page >= pages() - 1;
      renderDots();
    }

    $('.slider__btn--prev', nav).addEventListener('click', function () { go(page - 1); });
    $('.slider__btn--next', nav).addEventListener('click', function () { go(page + 1); });

    /* свайп */
    var x0 = null;
    view.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    view.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(page + (dx < 0 ? 1 : -1));
      x0 = null;
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { go(0); }, 120);
    });
    /* страницы демо лежат в одном файле: пока лента скрыта, ширины равны нулю,
       поэтому пересчитываем её, когда страница становится видимой */
    document.addEventListener('demo:page', function () {
      setTimeout(function () { go(0); }, 60);
    });

    /* ?strana=N — открыть ленту сразу на нужной странице (для ревью) */
    var start = parseInt(new URLSearchParams(location.search).get('strana'), 10);
    go(start > 0 ? start - 1 : 0);
  }

  /* ------------------------------------------------------------------
     3. Описание товара — в пустой промежуток над ценой
     В разметке Shoptet .p-desc лежит в самом низу карточки, под кнопкой.
     Переносим его между рейтингом и ценой: карточки в ряду одной высоты,
     поэтому у большинства там уже есть свободное место. Описание занимает
     ровно его (flex: 1 1 0 + overflow: hidden в CSS), так что при наведении
     не двигается ни фото, ни название, ни цена, ни кнопка.
     ------------------------------------------------------------------ */
  /* Кнопка «Otevřít filtr» в разметке Shoptet лежит отдельным блоком под
     строкой управления. Переносим её в .category-header, чтобы сортировка,
     фильтр и счётчик стояли в одной строке. */
  function moveFilterButton(root) {
    (root || document).querySelectorAll('.category-header').forEach(function (bar) {
      var wrap = bar.parentElement && bar.parentElement.querySelector('.filters-wrapper');
      var btn  = wrap && wrap.querySelector('.filters-unveil-button-wrapper');
      if (btn && !bar.contains(btn)) bar.insertBefore(btn, bar.firstChild);
    });
  }

  function moveDescriptions() {
    $$('.product .p').forEach(function (card) {
      var desc = $('.p-desc', card);
      var bottom = $('.p-bottom', card);
      if (desc && bottom && bottom.parentNode) bottom.parentNode.insertBefore(desc, bottom);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    moveInstagram();
    moveDescriptions();
    moveFilterButton(document);
    $$('.products.product-slider').forEach(makeSlider);
  });
})();
