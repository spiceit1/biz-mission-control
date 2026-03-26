#!/bin/bash
# Complete gcloud auth after Douglas provides the verification code
# Usage: ./complete-gcloud-auth.sh <VERIFICATION_CODE>
#
# The verification code comes from:
# 1. Open the auth URL in browser
# 2. Sign in with Google account 
# 3. The page at https://sdk.cloud.google.com/authcode.html shows a code
# 4. Pass that code to this script

set -e

CODE="${1:-}"

if [ -z "$CODE" ]; then
  echo "Usage: $0 <VERIFICATION_CODE>"
  echo ""
  echo "Current auth URL (if process still running):"
  cat /tmp/gcloud_auth_url.txt 2>/dev/null || echo "No URL found - may need to restart gcloud auth"
  echo ""
  echo "Expect process status:"
  ps aux | grep "[g]cloud_auth.expect" | head -3
  exit 1
fi

GCLOUD=/Users/douglasdweck/.local/google-cloud-sdk/bin/gcloud
PROJECT_ID="extreme-minutia-490422-g1"
PUBSUB_TOPIC="gmail-push-ddweck14"
WEBHOOK_URL="https://shmack-hq.netlify.app/.netlify/functions/gmail-push"

echo "🔑 Submitting verification code..."

# Check if expect process is still running
if ! ps aux | grep "[g]cloud_auth.expect" > /dev/null 2>&1; then
  echo "⚠️  Expect process not running. Starting fresh gcloud auth..."
  
  rm -f /tmp/gcloud_auth_code.txt /tmp/gcloud_auth_done.txt /tmp/gcloud_auth_url.txt
  
  cat > /tmp/gcloud_auth.expect << 'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 300
set gcloud [lindex $argv 0]
spawn $gcloud auth login --no-launch-browser
expect -re {https://accounts.google.com\S+} {
    set url $expect_out(0,string)
    set f [open /tmp/gcloud_auth_url.txt w]
    puts $f $url
    close $f
}
expect "verification code:"
set code_received 0
while {$code_received == 0} {
    if {[file exists /tmp/gcloud_auth_code.txt]} {
        set f [open /tmp/gcloud_auth_code.txt r]
        set code [string trim [read $f]]
        close $f
        if {$code ne ""} {
            send "$code\n"
            set code_received 1
        }
    }
    after 1000
}
expect {
    "You are now logged in as" {
        set f [open /tmp/gcloud_auth_done.txt w]
        puts $f "success"
        close $f
    }
    timeout {
        set f [open /tmp/gcloud_auth_done.txt w]
        puts $f "timeout"
        close $f
    }
}
EXPECT_SCRIPT
  chmod +x /tmp/gcloud_auth.expect
  /tmp/gcloud_auth.expect $GCLOUD > /tmp/gcloud_expect_out.log 2>&1 &
  sleep 3
  echo "New auth URL:"
  cat /tmp/gcloud_auth_url.txt 2>/dev/null
  echo ""
  echo "Please open the above URL, sign in, and run this script again with the code."
  exit 0
fi

# Write the code to the file (expect process is polling for it)
echo "$CODE" > /tmp/gcloud_auth_code.txt
echo "Code written, waiting for auth to complete..."

# Wait for completion
for i in $(seq 1 30); do
  if [ -f /tmp/gcloud_auth_done.txt ]; then
    RESULT=$(cat /tmp/gcloud_auth_done.txt)
    break
  fi
  sleep 1
done

if [ "${RESULT:-}" = "success" ]; then
  echo "✅ gcloud authenticated!"
  $GCLOUD config list --format='get(core.account)' 2>/dev/null
else
  echo "❌ Auth failed or timed out. Result: ${RESULT:-unknown}"
  exit 1
fi

# Now set up Pub/Sub using gcloud
echo ""
echo "📢 Setting up Google Cloud Pub/Sub..."

# Set project
$GCLOUD config set project $PROJECT_ID

# Enable Pub/Sub API
echo "Enabling Pub/Sub API..."
$GCLOUD services enable pubsub.googleapis.com --project=$PROJECT_ID 2>&1

# Create topic
echo "Creating topic: $PUBSUB_TOPIC..."
$GCLOUD pubsub topics create $PUBSUB_TOPIC --project=$PROJECT_ID 2>&1 || echo "(topic may already exist)"

# Grant Gmail service account publish rights
echo "Granting publish rights to gmail-api-push@system.gserviceaccount.com..."
$GCLOUD pubsub topics add-iam-policy-binding $PUBSUB_TOPIC \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project=$PROJECT_ID 2>&1

# Create push subscription
SUBSCRIPTION_NAME="${PUBSUB_TOPIC}-sub"
echo "Creating push subscription: $SUBSCRIPTION_NAME..."
$GCLOUD pubsub subscriptions create $SUBSCRIPTION_NAME \
  --topic=$PUBSUB_TOPIC \
  --push-endpoint=$WEBHOOK_URL \
  --ack-deadline=60 \
  --project=$PROJECT_ID 2>&1 || echo "(subscription may already exist)"

# Set up Gmail watch
echo ""
echo "👁️  Setting up Gmail watch..."
GMAIL_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_CLIENT_ID_HERE" \
  -d "client_secret=YOUR_CLIENT_SECRET_HERE" \
  -d "refresh_token=YOUR_REFRESH_TOKEN_HERE" \
  -d "grant_type=refresh_token" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")

TOPIC_NAME="projects/$PROJECT_ID/topics/$PUBSUB_TOPIC"

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
    print(f'✅ Gmail watch active! historyId={d[\"historyId\"]}, expires={exp}')
else:
    print('❌ Error:', d.get('error', {}).get('message', str(d)))
    exit(1)
"

# Update the renewal script with the correct project ID
sed -i '' "s/GCP_PROJECT_ID:-shmack-hq/GCP_PROJECT_ID:-$PROJECT_ID/" \
  /Users/douglasdweck/.openclaw/workspace/mission-control/scripts/gmail-watch-renew.sh 2>/dev/null || true

echo ""
echo "✅ FULL SETUP COMPLETE!"
echo "   GCP Project: $PROJECT_ID"
echo "   Pub/Sub Topic: $TOPIC_NAME"
echo "   Push Subscription → $WEBHOOK_URL"
echo "   Gmail watch: ACTIVE"
echo ""
echo "🧪 Test by sending an email with 'stubhub' in From and 'sold' in Subject"
