#!/usr/bin/env bash
set -euo pipefail

mkdir -p ./logs ./shelves/general ./config

cp .env.example .env

cat > ./config/library.json <<'JSON'
{
    "version": 0,
    "shelves":{
        "General": "./shelves/general"
    }
}
JSON

cat > ./config/keys.json <<'JSON'
{
    "version": 0,
    "keys":[
        {
            "name":"Owner",
            "key":"12345",
            "maxsession":1,
            "master":true,
            "limitusage":false
        }
    ]
}
JSON

npm install

echo "Setup successful!"