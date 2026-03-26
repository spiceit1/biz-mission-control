#!/bin/bash
# Gmail Push Notification Setup Script
# Run this AFTER completing the gog auth add step (see Step 0 below)
#
# STEP 0 (one-time, run manually first):
#   gog auth add ddweck14@gmail.com \
#     --extra-scopes "https://www.googleapis.com/auth/cloud-platform" \
#     --force
#   (This opens browser — approve it, then run this script)

set -e

GMAIL_EMAIL="ddweck14@gmail.com"
PUBSUB_TOPIC="gmail-push-ddweck14"
WEBHOOK_URL="https://shmack-hq.netlify.app/.netlify/functions/gmail-push"
NETLIFY_AUTH_TOKEN="nfp_H7A3Hi16T3QVg8NML64aaXhzd9VYtZwy4bec"
NETLIFY_SITE="69590f6b-c319-4e4d-9e50-a771706e36e4"
GCLOUD="/Users/douglasdweck/.local/google-cloud-sdk/bin/gcloud"

echo "🔑 Getting cloud-platform access token..."
# Get a fresh access token with cloud-platform scope (needs re-auth with that scope)
ACCESS_TOKEN=$(gog auth tokens export "$GMAIL_EMAIL" --out /tmp/gmail_cloud_token.json --overwrite 2>/dev/null \
  && cat /tmp/gmail_cloud_token.json | python3 -c "
import json, sys, subprocess
d = json.load(sys.stdin)
# Use the refresh token to get a cloud-platform access token
import urllib.request, urllib.parse
data = urllib.parse.urlencode({
  'client_id': 'YOUR_CLIENT_ID_HERE',
  'client_secret': 'YOUR_CLIENT_SECRET_HERE',
  'refresh_token': d['refresh_token'],
  'grant_type': 'refresh_token'
}).encode()
req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
resp = json.load(urllib.request.urlopen(req))
print(resp.get('access_token', ''))
" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Could not get access token. Did you run: gog auth add $GMAIL_EMAIL --extra-scopes 'https://www.googleapis.com/auth/cloud-platform' --force ?"
  exit 1
fi

echo "✅ Got access token: ${ACCESS_TOKEN:0:20}..."

# Check token scopes
SCOPES=$(curl -s "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=$ACCESS_TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('scope',''))")
if echo "$SCOPES" | grep -q "cloud-platform"; then
  echo "✅ Token has cloud-platform scope"
else
  echo "⚠️  Token scopes: $SCOPES"
  echo "❌ Missing cloud-platform scope. Run: gog auth add $GMAIL_EMAIL --extra-scopes 'https://www.googleapis.com/auth/cloud-platform' --force"
  exit 1
fi

# Get GCP project list
echo "📋 Listing GCP projects..."
PROJECTS=$(curl -s "https://cloudresourcemanager.googleapis.com/v1/projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$PROJECTS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d.get('projects', []):
    print(f\"  {p['projectId']} ({p.get('name', 'N/A')}) - {p.get('lifecycleState', 'N/A')}\")
if not d.get('projects'):
    print('No projects found. Creating one...')
"

# Use first active project or create one
PROJECT_ID=$(echo "$PROJECTS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d.get('projects', []):
    if p.get('lifecycleState') == 'ACTIVE':
        print(p['projectId'])
        break
" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "🆕 No existing project found. Creating 'shmack-hq'..."
  CREATE_RESULT=$(curl -s -X POST "https://cloudresourcemanager.googleapis.com/v1/projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"projectId": "shmack-hq", "name": "Shmack HQ"}')
  echo "$CREATE_RESULT" | python3 -m json.tool
  PROJECT_ID="shmack-hq"
  echo "⏳ Waiting for project creation..."
  sleep 10
fi

echo "✅ Using GCP project: $PROJECT_ID"

# Enable Pub/Sub API
echo "🔧 Enabling Pub/Sub API..."
curl -s -X POST "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services/pubsub.googleapis.com:enable" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('  Result:', d.get('name', d))"

sleep 5

# Create Pub/Sub topic
echo "📢 Creating Pub/Sub topic: $PUBSUB_TOPIC..."
TOPIC_RESULT=$(curl -s -X PUT "https://pubsub.googleapis.com/v1/projects/$PROJECT_ID/topics/$PUBSUB_TOPIC" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$TOPIC_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  Result:', d.get('name', d.get('error', {}).get('message', str(d))))"

# Grant Gmail service account publish rights on the topic
echo "🔑 Granting gmail-api-push@system.gserviceaccount.com publish rights..."
TOPIC_NAME="projects/$PROJECT_ID/topics/$PUBSUB_TOPIC"
IAM_RESULT=$(curl -s -X POST "https://pubsub.googleapis.com/v1/$TOPIC_NAME:setIamPolicy" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"policy\": {
      \"bindings\": [{
        \"role\": \"roles/pubsub.publisher\",
        \"members\": [\"serviceAccount:gmail-api-push@system.gserviceaccount.com\"]
      }]
    }
  }")
echo "$IAM_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  IAM:', 'OK' if 'bindings' in d else d.get('error', {}).get('message', str(d)))"

# Create push subscription pointing to Netlify function
SUBSCRIPTION_NAME="$PUBSUB_TOPIC-sub"
echo "📬 Creating push subscription: $SUBSCRIPTION_NAME -> $WEBHOOK_URL..."
SUB_RESULT=$(curl -s -X PUT "https://pubsub.googleapis.com/v1/projects/$PROJECT_ID/subscriptions/$SUBSCRIPTION_NAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"topic\": \"$TOPIC_NAME\",
    \"pushConfig\": {
      \"pushEndpoint\": \"$WEBHOOK_URL\"
    },
    \"ackDeadlineSeconds\": 60
  }")
echo "$SUB_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  Result:', d.get('name', d.get('error', {}).get('message', str(d))))"

# Set up Gmail watch
echo "👁️  Setting up Gmail watch..."
GMAIL_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_CLIENT_ID_HERE" \
  -d "client_secret=YOUR_CLIENT_SECRET_HERE" \
  -d "refresh_token=YOUR_REFRESH_TOKEN_HERE" \
  -d "grant_type=refresh_token" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")

WATCH_RESULT=$(curl -s -X POST "https://gmail.googleapis.com/gmail/v1/users/me/watch" \
  -H "Authorization: Bearer $GMAIL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"topicName\": \"$TOPIC_NAME\",
    \"labelIds\": [\"INBOX\"]
  }")

echo "$WATCH_RESULT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'historyId' in d:
    import datetime
    exp = datetime.datetime.fromtimestamp(int(d['expiration'])/1000)
    print(f'  ✅ Gmail watch active! historyId={d[\"historyId\"]}, expires={exp}')
else:
    print('  ❌ Error:', d.get('error', {}).get('message', str(d)))
"

# Save project ID to Netlify env
echo "💾 Saving GCP_PROJECT_ID to Netlify..."
cd /Users/douglasdweck/.openclaw/workspace/mission-control
NETLIFY_AUTH_TOKEN=$NETLIFY_AUTH_TOKEN ./node_modules/.bin/netlify env:set GCP_PROJECT_ID "$PROJECT_ID" 2>&1

echo ""
echo "✅ Setup complete!"
echo "   GCP Project: $PROJECT_ID"
echo "   Pub/Sub Topic: $TOPIC_NAME"
echo "   Webhook: $WEBHOOK_URL"
echo ""
echo "⚠️  Remember: Gmail watch expires every 7 days!"
echo "   Run this to renew: curl -s -X POST https://gmail.googleapis.com/gmail/v1/users/me/watch ..."
echo ""
echo "🧪 Test: Send yourself an email from stubhub@stubhub.com with 'sold' in the subject"
