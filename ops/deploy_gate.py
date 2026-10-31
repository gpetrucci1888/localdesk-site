"""The deploy gate. Imported by every script here that uploads code to Cloudflare. An upload is BLOCKED unless:
  1. the whole unit test suite passes, including the repository hygiene scan (no secrets, no real phone numbers), and
     the hygiene test file is actually there (deleting it cannot be used to get a green run);
  2. everything under workers/ and ops/ is committed, so what is tested and uploaded is exactly what is in git.
There is no flag to skip it. `dry` runs make no upload and so are not gated. The browser checks (test/browser) are slower and
are run by hand before a release (docs/GO-NO-GO.md)."""
import glob
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
# The modules each worker is uploaded with. A test checks these match the folders, so a new module can never be left out of an upload
# (a missing module would break the worker on Cloudflare).
FILES = {
    'books': ['worker.js', 'admin.js', 'freeagent.js', 'xero.js', 'stripe.js'],
    'hq': ['worker.js', 'content.js', 'ui.js', 'font.js', 'leads.js', 'passkey.js', 'posts.js', 'posts-seed.js', 'stripecheck.js'],
    'app': ['worker.js', 'page.js', 'brands.js', 'icons.js'],
}
FOLDER = {'books': 'books', 'hq': 'hq', 'app': 'receipt-demo'}
REQUIRED_TESTS = ['test/repo-hygiene.test.mjs', 'test/hq.test.mjs', 'test/leads.test.mjs', 'test/stripe.test.mjs']


def test_files(root=ROOT):
    return sorted(os.path.relpath(p, root).replace(os.sep, '/') for p in glob.glob(os.path.join(root, 'test', '*.test.mjs')))


def missing_required(files):
    return [t for t in REQUIRED_TESTS if t not in files]


def uncommitted(paths=('workers', 'ops'), root=ROOT):
    try:
        r = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=all', '--', *paths], cwd=root, capture_output=True, text=True)
    except OSError as e:
        return [f'could not run git ({e})']
    if r.returncode != 0:
        return ['git status failed']
    return [l for l in r.stdout.splitlines() if l.strip() and '__pycache__' not in l and not l.strip().endswith('.pyc')]


def block(reason):
    sys.stderr.write(f'\nDEPLOY BLOCKED: {reason}\nNothing was uploaded.\n')
    raise SystemExit(2)


def gate(root=ROOT):
    files = test_files(root)
    gone = missing_required(files)
    if gone:
        block('required test files are missing: ' + ', '.join(gone))
    try:
        env = {k: v for k, v in os.environ.items() if k != 'NODE_TEST_CONTEXT'}   # a leftover value makes a nested test run report success whatever happens
        r = subprocess.run(['node', '--test', *files], cwd=root, capture_output=True, text=True, env=env)
    except OSError as e:
        block(f'the tests could not be run ({e})')
    if r.returncode != 0:
        tail = '\n'.join((r.stdout + r.stderr).strip().splitlines()[-25:])
        block('the tests did not all pass.\n' + tail)
    dirty = uncommitted(root=root)
    if dirty:
        block('uncommitted changes under workers/ or ops/ (commit them first, so what is tested is what is uploaded):\n  ' + '\n  '.join(dirty[:10]))
    sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=root, capture_output=True, text=True).stdout.strip()
    print(f'Gate passed: all tests green, tree committed (commit {sha}).')
