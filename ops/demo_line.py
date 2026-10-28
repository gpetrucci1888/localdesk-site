#!/usr/bin/env python3
"""Point the 01752 demo line at a prospect's receptionist for a Zoom, then back.

    python3 ops/demo_line.py <assistantId>   # before the Zoom
    python3 ops/demo_line.py mia             # afterwards, back to the normal demo

Build the prospect's receptionist first with new_client.py (no assistantId in
their JSON). Texts still come to Gio, because the Worker matches the demo
number, not the assistant.
"""
import sys

from new_client import call

DEMO_NUMBER_ID = '999e0cf1-ec67-406d-85a9-1fc68c8b7161'
MIA = '3d96293a-41d2-4c42-8edd-7d4039e58f76'

if __name__ == '__main__':
    target = MIA if sys.argv[1] == 'mia' else sys.argv[1]
    name = call('GET', f'/assistant/{target}')['name']
    call('PATCH', f'/phone-number/{DEMO_NUMBER_ID}', {'assistantId': target})
    print(f'01752 741686 now answers as: {name}')
