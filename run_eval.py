#!/usr/bin/env python3

import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable

with open(os.path.join(ROOT, "eval_emails.json"), encoding="utf-8") as f:
    tests = json.load(f)

test_filter = os.environ.get("EVAL_TEST_IDS")
if test_filter:
    allowed = {int(x.strip()) for x in test_filter.split(",") if x.strip()}
    tests = [t for t in tests if t["id"] in allowed]

print("\n=== RUNNING VALIDATOR EVAL SUITE ===\n")

failed = 0

for t in tests:
    print(f"\n--- Test {t['id']}: {t['description']} ---")
    print(t["description"])
    print(f"Email: {t['email']}\n")

    result = subprocess.run(
        [PYTHON, os.path.join(ROOT, "test_70b.py"), t["email"]],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=os.environ.copy(),
    )

    print("Output:")
    if result.stdout:
        print(result.stdout.rstrip())
    if result.returncode != 0:
        failed += 1
        if result.stderr:
            print("Errors:", file=sys.stderr)
            print(result.stderr.rstrip(), file=sys.stderr)

    print("\n--------------------------------------")

if failed:
    sys.exit(1)
