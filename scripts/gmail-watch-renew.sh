#!/bin/bash
# Renew Gmail push watch (expires every 7 days)
# Called by cron daily

REFRESH_TOKEN="YOUR_REFRESH_TOKEN_HERE"
CLIENT_ID="YOUR_CLIENT_ID_HERE"
CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"
# Set this after running setup-gmail-push.sh
GCP_PROJECT_ID="${GCP_PROJECT_ID:-extreme-minutia-490422-g1}"
PUBSUB_TOPIC="gmail-push-ddweck14"

GMAIL_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "grant_type=refresh_token" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")

RESULT=$(curl -s -X POST "https://gmail.googleapis.com/gmail/v1/users/me/watch" \
  -H "Authorization: Bearer $GMAIL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"topicName\": \"projects/$GCP_PROJECT_ID/topics/$PUBSUB_TOPIC\",
    \"labelIds\": [\"INBOX\"]
  }")

echo "$RESULT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'historyId' in d:
    import datetime
    exp = datetime.datetime.fromtimestamp(int(d['expiration'])/1000)
    print(f'Gmail watch renewed! Expires: {exp}')
else:
    print('Error:', d.get('error', {}).get('message', str(d)))
    exit(1)
"
