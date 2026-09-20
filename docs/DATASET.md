# AIデザインデータセット収集パイプライン

AI生成スライド/サイト/デザインを継続収集し、`ai-design-detector` skill(`.devin/skills/ai-design-detector/`)の判定根拠となる実データを蓄積するための仕組み。すべて依存ゼロの ESM スクリプト。`dataset/` は gitignore 済み(バルク成果物)。

## 構成

```text
scripts/fetch-asset.mjs    1URL → ファイル保存 + metadata.jsonl 追記
scripts/batch-fetch.mjs    マニフェスト(JSON)の一括ダウンロード(--conc 並列)
scripts/browser-shots.mjs  MCPブリッジ経由の「隠しタブ」スクリーンショット収集
scripts/collect-site.mjs   headless Edge 一括収集(描画DOM+PNG+PDF+og画像、自動指紋付け)
scripts/collect.mjs        キュー駆動の常時収集ランナー(重複排除・失敗再試行つき)
scripts/sources.json       ツール別シードURL・発見方法メモ
scripts/probe.mjs          ページHTMLの簡易プローブ(状態・URL抽出)
scripts/probe-page.mjs     ページHTMLを保存してURL候補を列挙
scripts/scrape-imgs.mjs    ページから正規表現で画像URLを抽出
scripts/ph-gallery.mjs     ProductHuntページからギャラリー画像URLを抽出→fetch-asset
scripts/ph-collect.mjs     ProductHunt製品slug群のギャラリー一括収集
scripts/slidesgo-collect.mjs  Slidesgo(人間作テンプレ)プレビュー → dataset/human 対照群
dataset/<tool>/            成果物 + metadata.jsonl(+ shots/, errors.json)
dataset/_work/queues/      <tool>.txt — 投入用URLキュー(発見係が追記)
dataset/_work/seen/        収集済みURL(自動)
dataset/_work/failed/      失敗URLと試行回数(3回で諦める)
dataset/_notes/            判定skill作成係の観察ログ
```

## 役割分担(subagent想定)

- **発見係**: web検索・SNS・ギャラリーから対象URLを集め、`dataset/_work/queues/<tool>.txt` に1行1URLで追記するだけ。重複は収集側が排除。
- **収集係(HTML/アセット)**: `collect.mjs` が fetch 系キューを処理。静的取得で済むもののみ。
- **スクショ係**: 2経路ある。(a) `browser-shots.mjs` — MCPブリッジ経由でユーザーの実ブラウザの隠しタブを撮影(要: ブリッジ起動 + 拡張ペアリング済み + ポップアップで新規タブ許可ON。前面タブもOSポインタも奪わない)。JS-heavyやBot対策のあるサイト、実ブラウザ指紋が必要な場合に使う。(b) `collect-site.mjs` — headless Edge で DOM+PNG+PDF を一括取得。拡張不要で高速・大量向き。
- **判定skill係**: 収集物の指紋を `_notes/skill-author.md` に記録→ `SKILL.md`/`EVIDENCE.md` に昇格。

## 使い方

```sh
# 単発
node scripts/fetch-asset.mjs <url> dataset/<tool> --tool <name> --page <pageUrl>
node scripts/browser-shots.mjs urls.txt dataset/<tool>/shots --tool <name> [--full]
node scripts/collect-site.mjs urls.txt --jobs 4   # 1行: url[\ttool] 描画DOM+PNG+PDF+画像

# 常時収集(PMが起動。--until で24時間など)
node scripts/collect.mjs --until 2026-09-22T12:00:00+09:00 --interval 60 --per-tool 20
node scripts/collect.mjs --only gamma,manus --exit-when-empty   # 特定ツールだけ
node scripts/collect.mjs --dry-run                              # 計画だけ表示

# Genspark型バルク(マニフェスト一括)
node scripts/batch-fetch.mjs manifest.json dataset/genspark --tool genspark --conc 8
```

## 方針

- 公開アセットのみ。ログイン・有料機能・ユーザーのクレジットは一切使わない。
- スクショは隠しタブ限定(拡張の安全性モデルに従う)。撮れない場合は `SCREENSHOT_UNAVAILABLE` として正直に記録。
- 判定は根拠のある信号のみ。見た目だけの推測は `uncertain` 上限(SKILL.md 参照)。
- 取得失敗は `failed/<tool>.json` と `errors.json` に残す。静かに無視しない。
