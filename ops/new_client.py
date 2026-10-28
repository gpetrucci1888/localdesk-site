#!/usr/bin/env python3
"""Create or update a client's receptionist in Vapi from a client JSON file.

    python3 ops/new_client.py ops/example-client.json

The JSON holds the business facts (see example-client.json). If it has an
"assistantId", that assistant is updated; otherwise a new one is created and
its id is printed. Needs network access to api.vapi.ai with the Vapi key
(the session proxy adds it). Call texts come from the summary Worker, which is
set on the client's phone number in Vapi (with its secret header). Keep real clients' mobile numbers out of git.
"""
import json
import pathlib
import sys
import urllib.request

HERE = pathlib.Path(__file__).parent
VAPI = 'https://api.vapi.ai'
FIELDS = ['BUSINESS', 'TRADE', 'OWNER', 'SERVICES', 'AREAS', 'HOURS', 'QUOTES', 'EMERGENCIES', 'EXTRA']

# Shared with the demo line, so clients sound the same as what they tried.
VOICE = {
    'provider': '11labs', 'model': 'eleven_turbo_v2', 'voiceId': 'pFZP5JQG7iQjIQuC4Bku',
    'stability': 0.55, 'similarityBoost': 0.75, 'style': 0.05, 'speed': 1.0,
    'chunkPlan': {'enabled': True, 'formatPlan': {'enabled': True, 'replacements': [
        {'type': 'exact', 'key': 'Tamar', 'value': 'Taymar'},
    ]}},
}
END_CALL_TOOL = 'db1da329-112e-48da-bf5c-9b0fbe25e354'


def call(method, path, body=None):
    req = urllib.request.Request(VAPI + path, method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'localdesk-ops'})
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def build(client):
    prompt = (HERE / 'client-prompt.txt').read_text()
    prompt = prompt.replace('[LOCAL]', (HERE / 'local-knowledge.txt').read_text())
    for f in FIELDS:
        prompt = prompt.replace(f'[{f}]', client.get(f.lower(), '') or 'not given')
    places = [p.strip() for p in client.get('areas', '').replace(' and ', ',').split(',') if p.strip()]
    local = json.loads((HERE / 'keyterms.json').read_text())
    keyterms = list(dict.fromkeys([client['business'], client.get('owner', ''), *places, *local]))
    return {
        'name': f"CLIENT - {client['business']}",
        'firstMessage': f"Hello, {client['business']}, you're through to Mia, the virtual receptionist. "
                        "Calls may be recorded. How can I help?",
        'model': {
            'provider': 'openai', 'model': 'gpt-4o', 'temperature': 0.4,
            'toolIds': [END_CALL_TOOL],
            'messages': [{'role': 'system', 'content': prompt}],
        },
        'voice': VOICE,
        'transcriber': {'provider': 'deepgram', 'model': 'nova-3', 'language': 'en',
                        'keyterm': [k for k in keyterms if k][:100]},
        'backgroundSound': 'off',
        'endCallMessage': '',
        'silenceTimeoutSeconds': 30,
        'maxDurationSeconds': 600,
        'startSpeakingPlan': {'waitSeconds': 0.8, 'smartEndpointingPlan': {'provider': 'livekit'}},
        'analysisPlan': {'summaryPlan': {'enabled': True, 'messages': [
            {'role': 'system', 'content':
                f"You write the text message {client.get('owner', 'the owner')} gets after each call. "
                "In under 300 characters, plain text, no headings: the caller's name, best number, "
                "address or area, the job, how urgent it is, and when to ring back. "
                "Leave out anything not given. If it was a sales call or wrong number, say so in a few words."},
            {'role': 'user', 'content': 'Here is the transcript:\n\n{{transcript}}'},
        ]}},
        'serverMessages': ['end-of-call-report'],
    }


def main(path):
    client = json.loads(pathlib.Path(path).read_text())
    config = build(client)
    if client.get('assistantId'):
        res = call('PATCH', f"/assistant/{client['assistantId']}", config)
    else:
        res = call('POST', '/assistant', config)
    print(res['id'], res['name'])


if __name__ == '__main__':
    main(sys.argv[1])
