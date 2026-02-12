# Campaign Management System Workflow

このドキュメントでは、各スクールのキャンペーン情報を自動確認し、承認フローを経てサイトを更新する仕組みについて説明します。

## 1. システム概要

本システムは以下のコンポーネントで構成されています：

- **Fetch Script (`fetch:campaigns`)**: 公式サイト（現在はJSONファイル）からキャンペーン情報を読み取り、期限切れや更新が必要な変更を検出します。
- **Database (`campaign_logs`, `school_overrides`)**: 変更履歴の記録と、サイト表示用データの永続化を行います。
- **API Endpoints**: N8Nからのリクエストを受け付けます。
  - `GET /api/webhook/get-pending-campaigns`: 変更検知
  - `POST /api/webhook/approve-campaign`: 承認と更新
- **N8N Workflow**: 定期的にAPIを叩き、Slackに通知・承認ボタンを表示します。
- **Slack**: 承認インターフェースとして機能します。

## 2. ワークフロー詳細

### Step 1: 変更の検知 (Daily)

1. N8Nがスケジュール（例: 毎日AM10:00）で `GET /api/webhook/get-pending-campaigns` を呼び出します。
2. APIは `scripts/fetch-campaigns.mjs` を実行し、期限切れ（`daysUntilEnd < 0`）のキャンペーンを検出します。
3. 変更がある場合、レスポンスとして返却されます。

### Step 2: Slack通知と承認

1. N8Nは検知された変更情報を整形し、Slackチャンネルに通知を送ります。
2. 通知には「Approve Update」ボタンが含まれています。
3. 管理者（あなた）が内容を確認し、ボタンを押します。

### Step 3: 更新の適用

1. Slackボタンが押されると、N8Nは `POST /api/webhook/approve-campaign` を呼び出します。
2. APIは以下の処理を行います：
   - データベースの `school_overrides` テーブルを更新（**即時反映・永続化**）
   - JSONファイルを更新（Git管理用）
   - `campaign_logs` に承認履歴を記録
3. サイト（SSRページ）は `school_overrides` から最新データを読み込み、表示を更新します。

## 3. API仕様

### GET /api/webhook/get-pending-campaigns

**Headers:**
- `Authorization: Bearer <WEBHOOK_SECRET>`

**Response:**
```json
{
  "timestamp": "2026-02-12T00:00:00Z",
  "changes": [
    {
      "schoolId": "kimini",
      "status": "expired",
      "currentCampaign": { ... }
    }
  ]
}
```

### POST /api/webhook/approve-campaign

**Headers:**
- `Authorization: Bearer <WEBHOOK_SECRET>`
- `Content-Type: application/json`

**Payload:**
```json
{
  "schoolId": "kimini",
  "campaignText": "新キャンペーン...",
  "benefitText": "特典内容...",
  "campaignEndsAt": "2026-03-31",
  "campaignBullets": ["箇条書き1", "箇条書き2"],
  "approvedBy": "slack_user_id"
}
```

## 4. トラブルシューティング

### サイトに反映されない場合

1. **データベース確認**: `school_overrides` テーブルが更新されているか確認してください。
   ```sql
   SELECT * FROM school_overrides WHERE school_id = 'kimini';
   ```
2. **N8Nログ確認**: HTTP Requestノードが成功（Status 200）しているか確認してください。
3. **キャッシュ**: ブラウザのキャッシュをクリアして確認してください。SSRなのでサーバー側キャッシュはありませんが、CDN等が挟まっている場合は注意が必要です。

### デプロイ後のデータ消失について

本システムはデータベース（`school_overrides`）を使用しているため、Railwayの再デプロイやサーバー再起動を行っても**キャンペーン情報は保持されます**。
JSONファイルの更新は、Gitリポジトリにプッシュされない限り、次回のデプロイでリセットされますが、サイト表示はDBを優先するため問題ありません。
