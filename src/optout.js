// ページ側(MAIN world)で document_start に走る。
//
// Google の計測スクリプト(ga.js / analytics.js / gtag.js)は、送信前に
// window._gaUserPrefs.ioo() を見て「オプトアウト済みなら送らない」という
// 分岐を持っている。Google 公式のオプトアウトアドオンと同じ仕組み。
//
// 公式アドオンは <script> をページに挿し込む方式なので、CSP の厳しいサイトでは
// 注入自体がブロックされて効かない。こちらは world:"MAIN" で直接ページの
// グローバルに置くため CSP の影響を受けない。
(() => {
  const prefs = { ioo: () => true };

  try {
    Object.defineProperty(window, "_gaUserPrefs", {
      // 代入されても握りつぶす(サイト側に上書きさせない)。
      // 非書き込みのデータプロパティにすると strict mode のサイトが
      // TypeError で落ちるので、setter を no-op にして黙って無視する。
      get: () => prefs,
      set: () => {},
      configurable: false,
      enumerable: false,
    });
  } catch (_) {
    // すでに定義済みで再定義できない場合は素直に代入だけ試す
    try {
      window._gaUserPrefs = prefs;
    } catch (__) {
      /* ここまで来たら諦める。通信ブロック側が残っている */
    }
  }
})();
