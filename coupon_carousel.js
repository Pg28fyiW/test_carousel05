
// おトクなクーポンのカルーセルJS

// <br> タグだけを許可するサニタイズ関数
function sanitizeHtml(html) {
  // <br>, <br/>, <br /> 以外のタグを削除
  return html.replace(/<(?!br\s*\/?>)[^>]*>/g, '').trim();
}

// 共通データソース内の商品要素を全件取得する
function getAllSourceItems() {
  return Array.from(document.querySelectorAll(".karte_kcx_data_coupons_source .karte_kcx_data_coupons_item"));
}

// 注記要素から表示可能な文字列だけを取り出す
function getSafeNoteText(sourceNote) {
  if (!sourceNote) { return ""; }

  const safeNote = sanitizeHtml(sourceNote.innerHTML);
  return safeNote ? safeNote : "";
}

// PCタイトルは1行表示向けに<br>を空白へ置換する
function getSafePcTitleText(sourceTitle) {
  if (!sourceTitle) { return ""; }

  const safeTitle = sanitizeHtml(sourceTitle.innerHTML);
  return safeTitle.replace(/<br\s*\/?\s*>/gi, " ").replace(/\s+/g, " ").trim();
}

// 注記の空要素を削除し、注記なし行を上詰め用クラスにする
function compactSpRowsByNote(scopeElement) {
  const scope = scopeElement || document;
  const rows = scope.querySelectorAll(".karte_kcx_sp_rec_home_coupons_row");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const note = row.querySelector(".karte_kcx_sp_rec_home_coupons_note");

    if (!note) {
      row.classList.add("karte_kcx_sp_rec_home_coupons_row--no-note");
      continue;
    }

    const noteText = (note.textContent || "").replace(/[\s\u00A0]+/g, "").trim();
    const htmlWithoutBr = (note.innerHTML || "").replace(/<br\s*\/?\s*>/gi, "").replace(/[\s\u00A0]+/g, "").trim();

    if (!noteText && !htmlWithoutBr) {
      note.remove();
      row.classList.add("karte_kcx_sp_rec_home_coupons_row--no-note");
    } else {
      row.classList.remove("karte_kcx_sp_rec_home_coupons_row--no-note");
    }
  }
}

// SPカードの実高さに合わせてroot高さを自動補正する
function adjustSpRootHeight() {
  const spRoot = document.querySelector(".karte_kcx_home_coupons_only_sp");
  if (!spRoot) { return; }

  compactSpRowsByNote(spRoot);

  const root = spRoot.querySelector(".karte_kcx_home_coupons_only_sp_root.astro-RSPN73YO_only_sp");
  if (!root) { return; }

  // PC表示ではSPのインライン高さを解除してCSSに委ねる
  if (window.innerWidth > 720) {
    root.style.removeProperty("height");
    return;
  }

  // いったんインライン高さを解除して、現在のCSS基準高さを取得
  root.style.removeProperty("height");
  const rootRect = root.getBoundingClientRect();

  const items = spRoot.querySelectorAll(".slider__Group-BZV63T2Q_only_sp .slider__Item-BZV63T2Q_only_sp");
  if (!items.length) { return; }

  let deepestBottom = 0;
  let contentScale = 1;

  for (let i = 0; i < items.length; i++) {
    const itemStyle = window.getComputedStyle(items[i]);
    if (itemStyle.display === "none" || itemStyle.visibility === "hidden") {
      continue;
    }

    const card = items[i].querySelector(".karte_kcx_sp_rec_home_coupons_card");
    if (!card) {
      continue;
    }

    const cardRect = card.getBoundingClientRect();
    const bottomFromRootTop = cardRect.bottom - rootRect.top;
    if (bottomFromRootTop > deepestBottom) {
      deepestBottom = bottomFromRootTop;
    }

    // overflow: hidden で隠れている内容がある場合は高さを拡張する
    if (card.clientHeight > 0 && card.scrollHeight > card.clientHeight) {
      const requiredScale = card.scrollHeight / card.clientHeight;
      if (requiredScale > contentScale) {
        contentScale = requiredScale;
      }
    }
  }

  const indicator = spRoot.querySelector(".slider__IndicatorGroup-BZV63T2Q_only_sp");
  if (indicator) {
    const indicatorRect = indicator.getBoundingClientRect();
    const indicatorBottom = indicatorRect.bottom - rootRect.top;
    if (indicatorBottom > deepestBottom) {
      deepestBottom = indicatorBottom;
    }
  }

  if (deepestBottom <= 0) { return; }

  const currentRootHeight = rootRect.height;
  const requiredByGeometry = Math.ceil(deepestBottom + 10);
  const requiredByContent = Math.ceil(currentRootHeight * contentScale + 8);
  const requiredRootHeight = Math.max(requiredByGeometry, requiredByContent);

  // 注記あり/なしで高さが変化するため、毎回必要高さへ合わせる
  root.style.height = `${requiredRootHeight}px`;
}

// rAFで連続呼び出しを間引きし、最新の調整関数だけを実行する
function createRafDebouncedAdjuster(adjustFn) {
  let rafId = 0;

  function requestAdjust() {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      adjustFn();
    });
  }

  return requestAdjust;
}

function createSpRootHeightAdjuster() {
  return createRafDebouncedAdjuster(adjustSpRootHeight);
}

// 画像読込・リサイズ・回転時に高さ再計測を予約する(SP/PC共通)
function setupHeightAdjustTriggers(thumbSelector, requestHeightAdjust) {
  if (typeof requestHeightAdjust !== "function") { return; }

  // 画像読込完了時に高さを再計測して、カード下部の切れを防ぐ
  const thumbImages = document.querySelectorAll(thumbSelector);
  for (let i = 0; i < thumbImages.length; i++) {
    thumbImages[i].addEventListener("load", requestHeightAdjust);
  }

  // 画面幅変更・端末回転時に再計測する
  window.addEventListener("resize", requestHeightAdjust);
  window.addEventListener("orientationchange", requestHeightAdjust);


  // 初期描画直後と少し遅らせたタイミングの2回で再計測し、
  // フォント反映や画像遅延読込によるズレを吸収する
  setTimeout(requestHeightAdjust, 100);
  setTimeout(requestHeightAdjust, 300);
}

function setupSpHeightAdjustTriggers(requestSpHeightAdjust) {
  setupHeightAdjustTriggers(".karte_kcx_home_coupons_only_sp .karte_kcx_sp_rec_home_coupons_thumb", requestSpHeightAdjust);
}

function adjustPcControlsPosition() {
  const pcRoot = document.querySelector(".karte_kcx_home_coupons_only_pc");
  if (!pcRoot) { return; }

  const slider = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_slider");
  const group = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_group");
  const controls = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_controls");
  if (!slider || !group || !controls) { return; }

  if (window.innerWidth <= 720) {
    controls.style.removeProperty("top");
    controls.style.removeProperty("bottom");
    return;
  }

  const sliderRect = slider.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  const groupBottomFromSliderTop = groupRect.bottom - sliderRect.top;

  controls.style.top = "0px";
  controls.style.removeProperty("bottom");

  const controlsRect = controls.getBoundingClientRect();
  const lowerBottomGap = 16;
  const minGapFromSlides = 8;

  // まずは下寄せにしつつ、カード領域と重ならない範囲に収める
  const maxAllowedBottom = sliderRect.height - (groupBottomFromSliderTop + controlsRect.height + minGapFromSlides);
  const usableBottom = Math.max(0, maxAllowedBottom);
  const bottom = Math.min(lowerBottomGap, usableBottom);

  const desiredTop = sliderRect.height - controlsRect.height - bottom;
  const minTop = groupBottomFromSliderTop + minGapFromSlides;
  const maxTop = Math.max(minTop, sliderRect.height - controlsRect.height - 2);
  const clampedTop = Math.min(Math.max(minTop, desiredTop), maxTop);

  controls.style.top = `${Math.round(clampedTop)}px`;
}

// PCカードの実高さに合わせてroot高さを自動補正する
function adjustPcRootHeight() {
  const pcRoot = document.querySelector(".karte_kcx_home_coupons_only_pc");
  if (!pcRoot) { return; }

  const root = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_root");
  if (!root) { return; }
  const group = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_group");
  if (!group) { return; }

  // SP表示ではPCのインライン高さを解除してCSSに委ねる
  if (window.innerWidth <= 720) {
    root.style.removeProperty("height");
    root.style.removeProperty("min-height");
    adjustPcControlsPosition();
    return;
  }


  // いったんインライン高さを解除して、現在のCSS基準高さを取得する
  root.style.removeProperty("height");
  root.style.removeProperty("min-height");
  const rootRect = root.getBoundingClientRect();
  const groupRect = group ? group.getBoundingClientRect() : null;
  const items = pcRoot.querySelectorAll(".karte_kcx_home_coupons_only_pc_item");

  let deepestContentBottom = 0;
  let reserveSpace = 70;

  if (groupRect) {
    const estimatedReserve = rootRect.height - groupRect.height;
    if (estimatedReserve > 0) {
      reserveSpace = estimatedReserve;
    }
  }

  for (let i = 0; i < items.length; i++) {
    const itemStyle = window.getComputedStyle(items[i]);
    if (itemStyle.display === "none" || itemStyle.visibility === "hidden") {
      continue;
    }

    const card = items[i].querySelector(".karte_kcx_pc_rec_home_coupons_card");
    if (!card) {
      continue;
    }

    const note = card.querySelector(".karte_kcx_pc_rec_home_coupons_note");
    const desc = card.querySelector(".karte_kcx_pc_rec_home_coupons_desc");
    const body = card.querySelector(".karte_kcx_pc_rec_home_coupons_body");
    const bottomAnchor = note || desc || body || card;
    const anchorRect = bottomAnchor.getBoundingClientRect();

    // 注記(なければ本文末尾)の直下に20pxだけ白余白を残す
    const bottomFromRootTop = anchorRect.bottom - rootRect.top + 20;
    if (bottomFromRootTop > deepestContentBottom) {
      deepestContentBottom = bottomFromRootTop;
    }
  }

  if (deepestContentBottom <= 0) { return; }

  // カードの必要高さ + 下部コントロール領域のみを確保する
  const requiredRootHeight = Math.ceil(deepestContentBottom + reserveSpace);

  root.style.minHeight = "0px";
  root.style.height = `${requiredRootHeight}px`;
  adjustPcControlsPosition();
}

function createPcRootHeightAdjuster() {
  return createRafDebouncedAdjuster(adjustPcRootHeight);
}

function setupPcHeightAdjustTriggers(requestPcHeightAdjust) {
  setupHeightAdjustTriggers(".karte_kcx_home_coupons_only_pc .karte_kcx_pc_rec_home_coupons_thumb", requestPcHeightAdjust);
}



// サイドイメージカルーセル
function createSP1s3cSideImageCarousel() {

  // SP用カルーセル全体を取得する
  const spRoot = document.querySelector(".karte_kcx_home_coupons_only_sp");

  // SP用HTMLが存在しない場合は処理を終了する
  if (!spRoot) { return; }

  // カルーセルがHTMLないしに存在するか確認する
  const isCarouselVisible = () => {
    const carousel = spRoot.querySelector('.slider__Group-BZV63T2Q_only_sp');
    return carousel !== null;
  }

  // カルーセルが存在しない場合は処理を終了する
  if (!isCarouselVisible()) {
    return;
  }

  const c = spRoot.querySelector(".slider-BZV63T2Q_only_sp");
  let i = spRoot.querySelector(".slider__Group-BZV63T2Q_only_sp"),
    e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");
  let u = spRoot.querySelector(".slider__IndicatorGroup-BZV63T2Q_only_sp");

  let B = spRoot.querySelector(".slider__Indicator-BZV63T2Q_only_sp"),
    o = spRoot.querySelector(".sliderCurrent-BZV63T2Q_only_sp"),
    a = spRoot.querySelector(".slider__prev-BZV63T2Q_only_sp"),
    f = spRoot.querySelector(".slider__next-BZV63T2Q_only_sp"),
    m = !1,
    d = 0;

  // カルーセルが存在する場合にのみ実行する
  let autoplayIntervalId; // 自動再生のタイムアウトID
  // 自動スライド設定(5秒)の関数
  function startAutoSlide() {
    // カルーセルが存在しない場合、処理終了
    if (!isCarouselVisible()) return;

    // すでに自動再生が始まっているなら、何もしない
    if (autoplayIntervalId) return;

    autoplayIntervalId = setInterval(() => {
      s("next", 1); // 次のスライドへ移動
    }, 5000);
  }

  //自動スライドを停止
  function stopAutoplay() {
    clearInterval(autoplayIntervalId);
    autoplayIntervalId = null; // idをリセット
  }

  // 停止ボタンの位置をインディケーターの右端に配置するメソッド
  function setPauseBtnPosition() {
    const dotWidth = 8; // ドットの幅
    const dotSpace = 12; // ドットとドットの間の幅

    const indicatorItems = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");
    const numIndicators = indicatorItems.length;

    // インディケーターの総幅を取得
    const totalWidth = (dotWidth * numIndicators) + (dotSpace * (numIndicators -1));
    // インディケーターの総幅の半分に15pxの余白をプラス
    const offsetPauseBtn = (totalWidth / 2) + 15;

    const pauseBtn = spRoot.querySelector('.karte_kcx_home_coupons_only_sp_auto_slide_btn.pause');
    pauseBtn.style.left = `calc(50% + ${offsetPauseBtn}px)`;
  }


  // 自動スライドの再生ボタンと停止ボタンを押した時のメソッド
  function togglePauseOrStart() {
    const dot = spRoot.querySelector('.karte_kcx_home_coupons_only_sp_auto_slide_btn');
    let isPause = true; // 初期状態は自動スライド再生しているので停止ボタンを表示

    dot.addEventListener('click', function() {
      if (isPause) {
        // 停止ボタンから再生ボタンに切り替える
        dot.classList.remove('pause');
        dot.classList.add('triangle');
        stopAutoplay(); //自動スライドを停止
      } else {
        // 再生ボタンから停止ボタンに切り替える
        dot.classList.remove('triangle');
        dot.classList.add('pause');
        startAutoSlide(); // 自動スライドを開始
      }
      // 状態をトグルする
      isPause = !isPause;
    });
  }

  // PC表示かどうかを判定する
  function isPcLayout() {
    return window.innerWidth >= 721;
  }

  function T() {
    e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");

    // すべてのスライドから現在位置を表すクラスを削除する
    for (let r = 0; r < e.length; r++) {
      e[r].classList.remove("sliderCurrent-BZV63T2Q_only_sp");
    }

    // PCは左端(1番目)、SP(720px以下)は中央(3番目)
    let currentSlideIndex;

    if (isPcLayout()) {
      // PCでは、一番左に表示されている１番目のスライドを現在位置にします。
      currentSlideIndex = 0;
    } else if (e[2]) {
      // 720px以下では、今までどおり中央にある３番目のスライドを現在位置にする。
      currentSlideIndex = 2;
    } else {
      // スライドが少ない場合の予備処理
      currentSlideIndex = 1;
    }

    // 対象スライドに現在位置クラスを付与
    if (e[currentSlideIndex]) {
      e[currentSlideIndex].classList.add("sliderCurrent-BZV63T2Q_only_sp");
    }

    // 現在位置スライドを再取得する
    o = spRoot.querySelector(".sliderCurrent-BZV63T2Q_only_sp");
    // インディケーター用の番号を設定
    if (o) {
      d = Number(o.getAttribute("data-slider-index"));
    }
  }

  function g() {
    const r = spRoot.querySelectorAll(".slider__Indicator-BZV63T2Q_only_sp");
    if (!r || r.length === 0) return;
    for (let n = 0; n < r.length; n++) r[n].classList.remove("indicatorcurrent-BZV63T2Q_only_sp");
    r[d].classList.add("indicatorcurrent-BZV63T2Q_only_sp");
  }

  function v() {
    if (e.length === 1) {
      i && i.classList.add("sliderSingle-BZV63T2Q_only_sp");
      a && a.remove();
      f && f.remove();
      u && u.remove();
    }
    // 2枚以上は無条件に無限カルーセル（何もしない）
  }

  function s(r, n) {
    if (!m) {
      m = !0;
      for (let l = 0; l < n; l++) setTimeout(() => {
        i = spRoot.querySelector(".slider__Group-BZV63T2Q_only_sp"); // 再取得
        e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp"); // 再取得

        if (!i || !e || e.length === 0) {
          m = false;
          return;
        }

        if (r === "next") {
          if (i && e[0] instanceof Node) {
            i.appendChild(e[0]);
          }
        }
        else if (r === "prev") {
          if (i && e[e.length - 1] instanceof Node && e[0] instanceof Node) {
            i.insertBefore(e[e.length - 1], e[0]);
          }
        }
        else return;
        T(), g()
      }, 200 * l);
      e.length < 5 ? m = !1 : setTimeout(() => {
        m = !1
      }, 800)
    }
  }

  function Q(r) {
    if (o && (d = Number(o.getAttribute("data-slider-index")), d !== r))
      if (d < r) {
        let n = r - d;
        s("next", n)
      } else {
        let n = d - r;
        s("prev", n)
      }
  }

  // ランダム表示
  function slideRandam() {
    var elements = spRoot.querySelectorAll('.slider__Group-BZV63T2Q_only_sp .slider__Item-BZV63T2Q_only_sp');
    var elementsArray = Array.prototype.slice.call(elements);
    if (!elementsArray.length || !elements[0] || !elements[0].parentNode) return;
    elementsArray.sort(function() {
      return Math.random() - 0.5;
    });
    var parent = elements[0].parentNode;
    elementsArray.forEach(function(element){
      if (element instanceof Node) {
        parent.appendChild(element);
      }
    })
  }

  // コンテンツ数に応じたクラスを付ける(SP)
  function setContentCountClass() {
    // SP用カルーセル内にある、すべての商品カードを取得する
    var cards = spRoot.querySelectorAll(".slider__Group-BZV63T2Q_only_sp .karte_kcx_sp_rec_home_coupons_card");

    // 取得した商品カードを1枚ずつ処理する
    for (var i = 0; i < cards.length; i++) {
      // 現在処理している商品カードを取得する
      var card = cards[i];

      // 前回付けた可能性がある商品数クラスをすべて削除する
      card.classList.remove("karte_kcx_sp_rec_home_coupons_card--count-1");
      card.classList.remove("karte_kcx_sp_rec_home_coupons_card--count-2");
      card.classList.remove("karte_kcx_sp_rec_home_coupons_card--count-3");

      // カード内にあるすべての子要素を取得する
      var children = card.children;

      // カード内の商品数を数える変数を0で初期化する
      var contentCount = 0;

      // カード内の子要素を１つずつ確認する
      for (var j = 0; j < children.length; j++) {
        // karte_kcx_sp_rec_home_coupons_rowクラスを持つ子要素なら商品数を1増やす
        if (children[j].classList.contains("karte_kcx_sp_rec_home_coupons_row")) {
          contentCount++;
        }
      }

      // 商品が0件でも、最低値を1として扱う
      if (contentCount < 1) {
        contentCount = 1;
      }

      // 商品が4件でも、最低値を3として扱う
      if (contentCount > 3) {
        contentCount = 3;
      }

      // 商品数に応じたクラスをカードに追加する
      card.classList.add("karte_kcx_sp_rec_home_coupons_card--count-" + contentCount);
    }
  }

  // インディケーターの生成
  function V() {
    // ランダム表示後、Nodeを再取得
    e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");
    u = spRoot.querySelector(".slider__IndicatorGroup-BZV63T2Q_only_sp");
    B = spRoot.querySelector(".slider__Indicator-BZV63T2Q_only_sp");

    const origCount = e.length; // 元の枚数を保存
    const minLoopSlides = 5;
    for (let t = 0; t < origCount - 1; t++) u && B && u.appendChild(B.cloneNode(!0));
    if (v(), origCount === 1) return;
    const r = spRoot.querySelectorAll(".slider__Indicator-BZV63T2Q_only_sp");
    for (let t = 0; t < origCount; t++) e[t].setAttribute("data-slider-index", String(t)), r[t] && r[t].setAttribute("data-indicator-index", String(t));
    for (let t = 0; t < r.length; t++) r[t].addEventListener("click", function() {
      let Z = Number(r[t].getAttribute("data-indicator-index"));
      Q(Z)
    });
    // 5枚未満は「枚数の倍数」で配列を組み直して、周回時の並び崩れを防ぐ
    if (origCount < minLoopSlides && i) {
      const originalSlides = Array.from(e);
      const loopCount = Math.ceil(minLoopSlides / origCount) * origCount;
      const startOffset = (origCount - 2 + origCount) % origCount;
      i.innerHTML = "";
      for (let t = 0; t < loopCount; t++) {
        const srcIndex = (startOffset + t) % origCount;
        const clone = originalSlides[srcIndex].cloneNode(true);
        clone.setAttribute("data-slider-index", String(srcIndex));
        i.appendChild(clone);
      }
      e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");
    } else if (i && i.firstElementChild && i.lastElementChild) {
      // 5枚以上は末尾2枚を順序維持したまま先頭に回す
      i.insertBefore(i.lastElementChild, i.firstElementChild);
      i.insertBefore(i.lastElementChild, i.firstElementChild);
      e = spRoot.querySelectorAll(".slider__Item-BZV63T2Q_only_sp");
    }
    T(), g(), setTimeout(() => {
      i && i.classList.add("sliderloaded-BZV63T2Q_only_sp")
    }, 50), a && a.addEventListener("click", function() {
      s("prev", 1)
    }), f && f.addEventListener("click", function() {
      s("next", 1)
    });
    let startX = 0,
      startY = 0,
      currentX = 0,
      currentY = 0,
      h = 30,
      isHorizontalSwipe = false,
      hasDirectionLock = false;
    c && (c.addEventListener("touchstart", function(t) {
      startX = t.touches[0].pageX;
      startY = t.touches[0].pageY;
      currentX = startX;
      currentY = startY;
      isHorizontalSwipe = false;
      hasDirectionLock = false;
    }, {
      passive: true
    }), c.addEventListener("touchmove", function(t) {
      currentX = t.changedTouches[0].pageX;
      currentY = t.changedTouches[0].pageY;

      if (!hasDirectionLock) {
        const diffX = Math.abs(currentX - startX);
        const diffY = Math.abs(currentY - startY);

        if (diffX > 8 || diffY > 8) {
          hasDirectionLock = true;
          isHorizontalSwipe = diffX > diffY;
        }
      }

      if (isHorizontalSwipe) {
        t.preventDefault();
      }
    }, {
      passive: false
    }), c.addEventListener("touchend", function() {
      if (!isHorizontalSwipe) {
        return;
      }

      currentX < startX && startX > currentX + h ? s("next", 1) : startX < currentX && startX + h < currentX && s("prev", 1)
    }), c.addEventListener("touchcancel", function() {
      isHorizontalSwipe = false;
      hasDirectionLock = false;
    }))
  }

  // コンテンツ数に応じたクラスを付ける(SP)
  setContentCountClass();

  // ランダム表示
  //slideRandam()
  // ランダム表示後に、インディケーターの生成
  V();


  // 自動スライド設定
  startAutoSlide();
  // 停止ボタンの位置をインディケーターの右端に配置するメソッド
  setPauseBtnPosition();
  // 自動スライドの再生ボタンと停止ボタンを押した時のメソッド
  togglePauseOrStart();
}

// データソース1件分からSP/PC共通の表示項目を抽出する
function extractSourceFields(sourceItem) {
  return {
    sourceImage: sourceItem.querySelector(".karte_kcx_data_coupons_thumb"),
    sourceBadge: sourceItem.querySelector(".karte_kcx_data_coupons_badge"),
    sourceTitle: sourceItem.querySelector(".karte_kcx_data_coupons_title"),
    sourceDescription: sourceItem.querySelector(".karte_kcx_data_coupons_desc"),
    sourceNote: sourceItem.querySelector(".karte_kcx_data_coupons_note"),
  };
}

// SP用１スライドにつき最大3件の商品を配置する
function createSpItemsFromSource(sourceItems) {
  const items = sourceItems || [];
  const spGroup = document.querySelector(".karte_kcx_home_coupons_only_sp .slider__Group-BZV63T2Q_only_sp");

  if (!spGroup || items.length === 0) { return; }

  // 現在HTMLに直接書かれているSP用スライドを削除する
  spGroup.innerHTML = "";

  for (let i = 0; i < items.length; i += 3) {
    const slideItem = document.createElement("div");
    const card = document.createElement("div");

    slideItem.className = "karte_kcx_home_coupons_only_sp_slider__Item slider__Item-BZV63T2Q_only_sp astro-RSPN73YO_only_sp";
    card.className = "karte_kcx_sp_rec_home_coupons_card";

    const slideItems = items.slice(i, i + 3);

    slideItems.forEach(function (sourceItem) {
      const { sourceImage, sourceBadge, sourceTitle, sourceDescription, sourceNote } = extractSourceFields(sourceItem);
      const row = document.createElement("a");
      const safeNote = getSafeNoteText(sourceNote);

      row.className = "karte_kcx_sp_rec_home_coupons_row";
      row.href = sourceItem.getAttribute("href") || "";

      const sourceTarget = sourceItem.getAttribute("target");
      if (sourceTarget) {
        row.setAttribute("target", sourceTarget);

        if (sourceTarget === "_blank") {
          row.setAttribute("rel", "noopener noreferrer");
        }
      }

      row.innerHTML = `
        <div class="karte_kcx_sp_rec_home_coupons_media">
          <img class="karte_kcx_sp_rec_home_coupons_thumb"
            src="${sourceImage ? sourceImage.getAttribute("src") : ""}"
            alt="${sourceImage ? sourceImage.getAttribute("alt") : ""}">
          ${sourceBadge ? `<span class="karte_kcx_coupon_discount_badge">${sanitizeHtml(sourceBadge.innerHTML)}</span>` : ""}
        </div>
        <div class="karte_kcx_sp_rec_home_coupons_body">
          <p class="karte_kcx_sp_rec_home_coupons_title">${sourceTitle ? sanitizeHtml(sourceTitle.innerHTML) : ""}</p>
          <span class="karte_kcx_sp_rec_home_coupons_line"></span>
          <p class="karte_kcx_sp_rec_home_coupons_desc">${sourceDescription ? sanitizeHtml(sourceDescription.innerHTML) : ""}</p>
        </div>
        ${safeNote ? `<p class="karte_kcx_sp_rec_home_coupons_note">${safeNote}</p>` : ""}
      `;

      compactSpRowsByNote(row);
      card.appendChild(row);
    });

    slideItem.appendChild(card);
    spGroup.appendChild(slideItem);
  }

  compactSpRowsByNote(spGroup);
}

// PC用カルーセルへ配置する
function createPcItemsFromSource(sourceItems) {
  const items = sourceItems || [];
  const pcGroup = document.querySelector(".karte_kcx_home_coupons_only_pc .karte_kcx_home_coupons_only_pc_group");

  if (!pcGroup || items.length === 0) { return; }

  // 現在HTMLに直接書かれているPC用カードを削除する
  pcGroup.innerHTML = "";

  items.forEach(function (sourceItem) {
    const pcItem = document.createElement("a");
    pcItem.className = "karte_kcx_home_coupons_only_pc_item";
    pcItem.href = sourceItem.getAttribute("href") || "";

    const sourceTarget = sourceItem.getAttribute("target");
    if (sourceTarget) {
      pcItem.setAttribute("target", sourceTarget);

      if (sourceTarget === "_blank") {
        pcItem.setAttribute("rel", "noopener noreferrer");
      }
    }

    const { sourceImage, sourceBadge, sourceTitle, sourceDescription, sourceNote } = extractSourceFields(sourceItem);
    const safePcTitle = getSafePcTitleText(sourceTitle);
    const safeNote = getSafeNoteText(sourceNote);

    pcItem.innerHTML = `
      <div class="karte_kcx_pc_rec_home_coupons_card">
        <div class="karte_kcx_pc_rec_home_coupons_media">
          <img class="karte_kcx_pc_rec_home_coupons_thumb"
            src="${sourceImage ? sourceImage.getAttribute("src") : ""}"
            alt="${sourceImage ? sourceImage.getAttribute("alt") : ""}">
          ${sourceBadge ? `<span class="karte_kcx_coupon_discount_badge">${sanitizeHtml(sourceBadge.innerHTML)}</span>` : ""}
        </div>

        <div class="karte_kcx_pc_rec_home_coupons_body">
          <p class="karte_kcx_pc_rec_home_coupons_title">${safePcTitle}</p>
          <span class="karte_kcx_pc_rec_home_coupons_line"></span>
          <p class="karte_kcx_pc_rec_home_coupons_desc">${sourceDescription ? sanitizeHtml(sourceDescription.innerHTML) : ""}</p>
          ${safeNote ? `<p class="karte_kcx_pc_rec_home_coupons_note">${safeNote}</p>` : ""}
        </div>
      </div>
    `;
    pcGroup.appendChild(pcItem);
  });
}

// PC用カルーセルの関数を追加する
function createPc4SlideCarousel(requestPcHeightAdjust) {
  var pcRoot = document.querySelector(".karte_kcx_home_coupons_only_pc .karte_kcx_home_coupons_only_pc_root");
  if (!pcRoot) return;

  var group = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_group");
  var prevButton = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_prev");
  var nextButton = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_next");
  var indicatorGroup = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_indicators");
  var pauseButton = pcRoot.querySelector(".karte_kcx_home_coupons_only_pc_pause");
  if (!group) return;

  var autoplayIntervalId = null;
  var isPlaying = true;

  function requestPcLayoutAdjust() {
    if (typeof requestPcHeightAdjust === "function") {
      requestPcHeightAdjust();
    }
  }

  function getSlides() {
    return group.querySelectorAll(".karte_kcx_home_coupons_only_pc_item");
  }

  // 4枚以下はループさせず、移動可能な時のみスライド配列を返す
  function getSlidesIfMovable() {
    var slides = getSlides();
    if (slides.length <= 4) return null;
    return slides;
  }

  var firstSlides = getSlides();

  for (var i = 0; i < firstSlides.length; i++) {
    firstSlides[i].setAttribute("data-pc-index", String(i));
  }

  function createIndicators() {
    if (!indicatorGroup) return;

    indicatorGroup.innerHTML = "";

    for (var i = 0; i < firstSlides.length; i++) {
      var indicator = document.createElement("button");
      indicator.type = "button";
      indicator.className = "karte_kcx_home_coupons_only_pc_indicator";
      indicator.setAttribute("data-pc-indicator-index", String(i));
      indicator.setAttribute("aria-label", String(i + 1) + "ページ目を表示");

      indicator.addEventListener("click", function () {
        var targetIndex = Number(this.getAttribute("data-pc-indicator-index"));
        moveTo(targetIndex);
      });

      indicatorGroup.appendChild(indicator);
    }
  }

  function updateIndicators() {
    if (!indicatorGroup) return;

    var slides = getSlides();
    var indicators = indicatorGroup.querySelectorAll(".karte_kcx_home_coupons_only_pc_indicator");
    if (!slides[0]) return;

    var currentIndex = Number(slides[0].getAttribute("data-pc-index"));

    for (var i = 0; i < indicators.length; i++) {
      indicators[i].classList.remove("is-current");
    }

    if (indicators[currentIndex]) {
      indicators[currentIndex].classList.add("is-current");
    }
  }

  function moveNext(fromButton) {
    var slides = getSlidesIfMovable();
    if (!slides) return;

    if (fromButton) {
      var firstSlide = slides[0];
      if (!(firstSlide instanceof Node)) return;

      // 左ボタン時の反対モーションにするため、先頭カードの見た目だけをゴーストで左へフェードアウトさせる
      var ghostSlide = firstSlide.cloneNode(true);
      ghostSlide.setAttribute("aria-hidden", "true");
      ghostSlide.style.pointerEvents = "none";
      ghostSlide.style.zIndex = "8";
      ghostSlide.style.transition = "none";
      ghostSlide.style.left = "0%";
      ghostSlide.style.opacity = "1";

      group.appendChild(ghostSlide);
      group.appendChild(firstSlide);

      updateIndicators();
      requestPcLayoutAdjust();

      requestAnimationFrame(function () {
        ghostSlide.style.transition = "left 0.8s ease, opacity 0.8s ease";
        ghostSlide.style.left = "-25%";
        ghostSlide.style.opacity = "0";
      });

      setTimeout(function () {
        ghostSlide.remove();
      }, 850);
      return;
    }

    group.appendChild(slides[0]);
    updateIndicators();
    requestPcLayoutAdjust();
  }

  function movePrev() {
    var slides = getSlidesIfMovable();
    if (!slides) return;

    var lastSlide = slides[slides.length - 1];
    if (!(lastSlide instanceof Node) || !(slides[0] instanceof Node)) return;

    // 前の商品をいったん左側へ配置する
    lastSlide.style.transition = "none";
    lastSlide.style.left = "-25%";
    lastSlide.style.opacity = "1";

    // 末尾の商品を先頭へ移動する
    group.insertBefore(lastSlide, slides[0]);

    // 左側に配置した状態をブラウザへ反映する
    lastSlide.offsetWidth;

    // 通常のCSSへ戻すと、左側から先頭位置へ移動する
    lastSlide.style.transition = "";
    lastSlide.style.left = "";
    lastSlide.style.opacity = "";

    updateIndicators();
    requestPcLayoutAdjust();
  }

  // ドット移動用：右回り(next)と同じく非アニメーションで並びを更新する
  function movePrevInstant() {
    var slides = getSlidesIfMovable();
    if (!slides) return;
    if (!(slides[slides.length - 1] instanceof Node) || !(slides[0] instanceof Node)) return;

    group.insertBefore(slides[slides.length - 1], slides[0]);
    updateIndicators();
    requestPcLayoutAdjust();
  }


  function moveTo(targetIndex) {
    var slides = getSlides();
    if (!slides.length) return;

    var currentIndex = Number(slides[0].getAttribute("data-pc-index"));

    if (currentIndex === targetIndex) return;

    if (currentIndex < targetIndex) {
      var nextCount = targetIndex - currentIndex;
      for (var n = 0; n < nextCount; n++) {
        setTimeout(function () {
          moveNext();
        }, 200 * n);
      }
    } else {
      var prevCount = currentIndex - targetIndex;
      for (var p = 0; p < prevCount; p++) {
        setTimeout(function () {
          movePrevInstant();
        }, 200 * p);
      }
    }
  }

  function startAutoplay() {
    if (autoplayIntervalId) return;

    autoplayIntervalId = setInterval(function () {
      moveNext();
    }, 5000);
  }

  function stopAutoplay() {
    clearInterval(autoplayIntervalId);
    autoplayIntervalId = null;
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      moveNext(true);
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      movePrev();
    });
  }

  if(pauseButton) {
    pauseButton.addEventListener("click", function () {
      if (isPlaying) {
        stopAutoplay();
        pauseButton.classList.remove("pause");
        pauseButton.classList.add("triangle");
        pauseButton.setAttribute("aria-label", "自動再生を開始");
      } else {
        startAutoplay();
        pauseButton.classList.remove("triangle");
        pauseButton.classList.add("pause");
        pauseButton.setAttribute("aria-label", "自動再生を停止");
      }

      isPlaying = !isPlaying;
    });
  }

  createIndicators();
  updateIndicators();
  startAutoplay();
  requestPcLayoutAdjust();

}

// おトクなクーポンカルーセルの初期化処理
function initCouponCarousel() {
  // requestAnimationFrameで束ねる高さ再計測関数を作成
  const requestSpHeightAdjust = createSpRootHeightAdjuster();
  const requestPcHeightAdjust = createPcRootHeightAdjuster();
  // 全件表示する
  const selectedSourceItems = getAllSourceItems();

  // 共通HTMLからSP用スライドを作る
  createSpItemsFromSource(selectedSourceItems);
  // 共通HTMLからPC用カードを作る
  createPcItemsFromSource(selectedSourceItems);

  // SP用カルーセルを準備する
  createSP1s3cSideImageCarousel();
  requestSpHeightAdjust();
  // PC用カルーセルを準備する
  createPc4SlideCarousel(requestPcHeightAdjust);
  requestPcHeightAdjust();
  // SP高さの再計測を行う各種トリガーを登録する
  setupSpHeightAdjustTriggers(requestSpHeightAdjust);
  // PC高さの再計測を行う各種トリガーを登録する
  setupPcHeightAdjustTriggers(requestPcHeightAdjust);
}

document.addEventListener('DOMContentLoaded', function() {
  initCouponCarousel();
  // console.log('カルーセルjs PC4スライド、SP1スライド3ブロック ver.3');
});
