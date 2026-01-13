// ================================================================================
// YouTube 動画フィルタリング拡張機能
// ================================================================================
// 非表示にしたいキーワードのリスト（大文字小文字は区別しません）
const NG_WORDS = [
  "キーワード",
  "チャンネル名",
  "タイトルの一部"
];

// デバッグモード（true: 赤枠表示、false: 完全非表示）
const DEBUG_MODE = false;

// --------------------------------------------------------------------------------
// 【メイン処理】
// --------------------------------------------------------------------------------

/**
 * 動画要素を非表示にする関数
 * @param {HTMLElement} element - 非表示にする要素
 * @param {string} reason - 非表示にした理由（ログ出力用）
 */
function hideElement(element, reason) {
  // 既に処理済みの要素は無視
  if (!element || element.dataset.ngHidden) {
    return;
  }

  // デバッグモード: 赤枠で囲んで理由を表示
  if (DEBUG_MODE) {
    // 要素を赤枠で囲む
    element.style.setProperty('border', '5px solid red', 'important');
    element.style.setProperty('background-color', 'rgba(255, 0, 0, 0.1)', 'important');
    element.dataset.ngReason = reason;

    // ラベルがまだない場合は作成
    if (!element.querySelector('.ng-debug-label')) {
      const label = document.createElement('div');
      label.className = 'ng-debug-label';
      label.textContent = `🚫 NG: ${reason}`;
      label.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        background: red;
        color: white;
        padding: 5px 10px;
        font-weight: bold;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
      `;
      element.style.position = 'relative';
      element.insertBefore(label, element.firstChild);
    }
  } 
  // 本番モード: 完全に非表示
  else {
    element.style.setProperty('display', 'none', 'important');
  }

  // 処理済みフラグを立てる
  element.dataset.ngHidden = 'true';
  console.log(`✓ 非表示: ${reason}`);
}

/**
 * テキストにNGワードが含まれているかチェック
 * @param {string} text - チェックするテキスト
 * @return {boolean} NGワードが含まれていればtrue
 */
function containsNGWord(text) {
  // テキストが空の場合はfalse
  if (!text) return false;

  // 大文字小文字を無視して比較
  const lowerText = text.toLowerCase();
  
  // NGワードのいずれかが含まれているかチェック
  const matched = NG_WORDS.find(word => 
    lowerText.includes(word.toLowerCase())
  );
  
  return !!matched; // 見つかればtrue、なければfalse
}

/**
 * ページ内の動画要素をチェックして、NGワードを含むものを非表示にする
 */
function checkAndHideVideos() {
  
  // --- 1. 新しいYouTubeデザインの動画要素をチェック ---
  const lockupVideos = document.querySelectorAll('yt-lockup-view-model');
  
  if (DEBUG_MODE) {
    console.log(`=== チェック開始 ===`);
    console.log(`yt-lockup-view-model: ${lockupVideos.length}個検出`);
  }

  lockupVideos.forEach((element) => {
    // 既にチェック済みの要素はスキップ
    if (element.dataset.ngChecked) return;

    // 動画のすべてのテキスト（タイトル、チャンネル名など）を取得
    const allText = element.textContent || '';

    // チャンネル名やタイトルを含むメタデータ要素を取得
    const metadataElements = element.querySelectorAll(
      'yt-content-metadata-view-model, ' +
      '.yt-content-metadata-view-model__metadata-row, ' +
      'span.yt-core-attributed-string'
    );

    // メタデータ要素ごとにNGワードをチェック
    for (const metaElement of metadataElements) {
      const text = metaElement.textContent?.trim();
      
      if (containsNGWord(text)) {
        // NGワードが見つかったら非表示にして終了
        hideElement(element, `チャンネル/タイトル: ${text.substring(0, 50)}`);
        element.dataset.ngChecked = 'true';
        return;
      }
    }

    // 全体のテキストもチェック（念のため）
    if (containsNGWord(allText)) {
      hideElement(element, `全体テキスト: ${allText.substring(0, 50)}`);
      element.dataset.ngChecked = 'true';
      return;
    }

    // NGワードが見つからなかった場合もチェック済みフラグを立てる
    element.dataset.ngChecked = 'true';
  });

  // --- 2. 古いYouTubeデザインの動画要素もチェック ---
  const oldSelectors = [
    'ytd-rich-item-renderer',      // ホーム画面の動画
    'ytd-grid-video-renderer',      // グリッド表示の動画
    'ytd-video-renderer',           // 検索結果の動画
    'ytd-compact-video-renderer'    // サイドバーの動画
  ];

  oldSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach((element) => {
      // 既にチェック済みの要素はスキップ
      if (element.dataset.ngChecked) return;

      // すべてのテキストを取得してNGワードをチェック
      const allText = element.textContent || '';
      
      if (containsNGWord(allText)) {
        hideElement(element, `${selector}: ${allText.substring(0, 50)}`);
      }

      element.dataset.ngChecked = 'true';
    });
  });

  if (DEBUG_MODE) {
    console.log('=== チェック完了 ===');
  }
}

// --------------------------------------------------------------------------------
// 【監視設定】
// --------------------------------------------------------------------------------

/**
 * YouTubeページを監視して、新しい動画が追加されたら自動でチェックする
 */
function observeYouTube() {
  
  // --- 初回実行（ページ読み込み直後） ---
  // 少し時間をおいて2回実行（動画の読み込みタイミングのため）
  setTimeout(checkAndHideVideos, 1000);
  setTimeout(checkAndHideVideos, 3000);

  // --- MutationObserver: DOM変更を監視 ---
  // YouTubeは動的にコンテンツを追加するため、DOM変更を監視する
  const observer = new MutationObserver((mutations) => {
    // 連続して発火するのを防ぐため、タイムアウトをクリア
    clearTimeout(observer.timeout);
    
    // 500ms後にチェック実行（短時間に何度も実行されるのを防ぐ）
    observer.timeout = setTimeout(() => {
      checkAndHideVideos();
    }, 500);
  });

  // YouTubeアプリ全体を監視対象にする
  const targetNode = document.querySelector('ytd-app');
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,  // 子要素の追加・削除を監視
      subtree: true     // 子孫要素も含めて監視
    });
    console.log('✓ MutationObserver開始');
  }

  // --- ページ遷移イベント（YouTube内の画面遷移） ---
  window.addEventListener('yt-navigate-finish', () => {
    console.log('ページ遷移検出');
    
    // 全てのチェック済みフラグをリセット（新しいページで再チェックするため）
    document.querySelectorAll('[data-ng-checked]').forEach(el => {
      delete el.dataset.ngChecked;
      delete el.dataset.ngHidden;
    });
    
    // 少し待ってからチェック実行
    setTimeout(checkAndHideVideos, 1000);
  });

  // --- スクロールイベント ---
  // スクロールで新しい動画が読み込まれることがあるため監視
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    // 連続して発火するのを防ぐ
    clearTimeout(scrollTimeout);
    
    // 300ms後にチェック実行
    scrollTimeout = setTimeout(checkAndHideVideos, 300);
  }, { passive: true }); // passiveオプションでパフォーマンス向上
}

// --------------------------------------------------------------------------------
// 【起動処理】
// --------------------------------------------------------------------------------

// ページの読み込み状態に応じて実行
if (document.readyState === 'loading') {
  // まだ読み込み中の場合はDOMContentLoadedを待つ
  document.addEventListener('DOMContentLoaded', observeYouTube);
} else {
  // 既に読み込み済みの場合はすぐに実行
  observeYouTube();
}

// 起動メッセージ
if (DEBUG_MODE) {
  console.log('🐛 デバッグモード有効');
}
console.log('✓ YouTube動画フィルタリング起動');
console.log('NGワード:', NG_WORDS);
