# 在庫管理 Firebase共有版

## 重要
- Firebase AuthenticationのGoogleログインは全員で同じGoogleアカウントを使用します。
- PINは利用者の操作記録用の簡易識別です。PINはJavaScriptから見えるため、本人確認・不正利用防止にはなりません。
- Firestore Security Rulesは「Google認証済みか」を確認します。共有アカウント内の個人別権限はありません。
- PINは実際の携帯番号下4桁に必ず変更してください。PINの重複も避けてください。

## 1. firebase-config.js
Firebaseコンソール > プロジェクトの設定 > マイアプリ > SDKの設定と構成 から以下を転記:
apiKey / authDomain / projectId / storageBucket / messagingSenderId / appId

同ファイルの INVENTORY_USERS の name と pin を実際の利用者3〜5人に変更。

## 2. Firebase Authentication
Authentication > Sign-in method > Google を有効化。
承認済みドメインに `koujisanpachi.github.io` を登録。
Googleアカウント共有でログインするため、全員が同じGoogleアカウントでログイン。

## 3. Firestore
Firestore Databaseを作成済みであることを確認。
Firestore > ルール に firestore.rules の内容を貼り付けて公開。

## 4. GitHub Pages
このZIP内のファイルをリポジトリ直下へアップロードし、既存ファイルを置き換える。
firebase-config.jsも必ずアップロードする。
GitHub Pagesの公開先は既存の `/inventory_management_v2/` のまま。

## 5. 既存端末内データの移行
旧アプリを使っていた端末で、旧版の「データ管理 > バックアップを書き出す」からJSONを保存。
新しい共有版にGoogleログイン→PIN入力して入り、「データ管理 > バックアップから復元」でJSONを読み込む。
Firestoreへ商品・カテゴリー・履歴が登録されます。複数人で同時に移行しないこと。

## 6. 無料枠
SparkプランのFirestore無料枠内での利用を想定。無料枠超過やFirebase側の仕様変更時は利用制限の可能性があります。課金設定は有効にしないでください。

## データ構造
Firestore collections: items / categories / history
