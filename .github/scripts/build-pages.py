"""Builds every branch of this repository into one GitHub Pages site.

main sits at the root, every other branch in a folder of its name. A branch with a build script
is built (Vite with relative addresses), any other branch is copied as it is.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

DEFAULT_BRANCH = 'main'
SKIPPED_BRANCHES = {'HEAD', 'gh-pages'}
NOT_COPIED = {'.git', '.github', 'node_modules'}
BUILD_FOLDERS = ['dist', 'build', 'out']


def run(*command, cwd=None):
    subprocess.run(command, cwd=cwd, check=True)


def branches():
    refs = subprocess.run(
        ['git', 'for-each-ref', 'refs/remotes/origin', '--format=%(refname:lstrip=3)'],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    return [ref for ref in refs if ref not in SKIPPED_BRANCHES]


def folder_of(branch):
    return '' if branch == DEFAULT_BRANCH else re.sub(r'[^A-Za-z0-9._-]', '-', branch)


def build_script(source):
    try:
        with open(os.path.join(source, 'package.json')) as file:
            package = json.load(file)
    except (OSError, ValueError):
        return None
    if 'build' not in package.get('scripts', {}):
        return None
    tools = {**package.get('dependencies', {}), **package.get('devDependencies', {})}
    return 'vite' if 'vite' in tools else 'npm'


def built(source, kind):
    install = 'ci' if os.path.exists(os.path.join(source, 'package-lock.json')) else 'install'
    run('npm', install, '--no-audit', '--no-fund', cwd=source)
    if kind == 'vite':
        output = os.path.join(source, '_pages')
        # Skips the build script's own steps (tsc -b): a type error should not keep a prototype offline.
        run('npx', 'vite', 'build', '--base', './', '--outDir', output, '--emptyOutDir', cwd=source)
        return output
    run('npm', 'run', 'build', cwd=source)
    for name in BUILD_FOLDERS:
        if os.path.isdir(os.path.join(source, name)):
            return os.path.join(source, name)
    raise RuntimeError('the build made no dist, build or out folder')


def made_relative(output):
    """`/products/a.png` in the built code becomes `./products/a.png`: the site lives in a subfolder."""
    names = [name for name in os.listdir(output) if name not in ('index.html', 'assets')]
    if not names:
        return
    address = re.compile(r'([\'"`])/(' + '|'.join(map(re.escape, names)) + r')(?=[/\'"`$])')
    for folder, _, files in os.walk(output):
        for name in files:
            if name.endswith(('.js', '.html', '.css')):
                path = os.path.join(folder, name)
                with open(path, encoding='utf-8', errors='surrogateescape') as file:
                    text = file.read()
                changed = address.sub(r'\1./\2', text)
                if changed != text:
                    with open(path, 'w', encoding='utf-8', errors='surrogateescape') as file:
                        file.write(changed)


def with_files_named_in_code(output, source):
    """Files the code loads by name (`./assets/a.png`) that the build did not copy, from the branch."""
    named = re.compile(r'[\'"`]\./([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)[\'"`]')
    for folder, _, files in os.walk(output):
        for name in files:
            if not name.endswith('.js'):
                continue
            with open(os.path.join(folder, name), encoding='utf-8', errors='ignore') as file:
                for path in named.findall(file.read()):
                    target = os.path.join(output, path)
                    original = os.path.join(source, path)
                    if '..' not in path and not os.path.exists(target) and os.path.isfile(original):
                        os.makedirs(os.path.dirname(target), exist_ok=True)
                        shutil.copy2(original, target)


def copied(source, target):
    for name in os.listdir(source):
        if name in NOT_COPIED:
            continue
        path = os.path.join(source, name)
        if os.path.isdir(path):
            shutil.copytree(path, os.path.join(target, name), symlinks=False)
        else:
            shutil.copy2(path, os.path.join(target, name))


def failure_page(target, branch, reason):
    os.makedirs(target, exist_ok=True)
    with open(os.path.join(target, 'index.html'), 'w') as file:
        file.write(
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            f'<title>{branch} did not build</title><p>The branch {branch} did not build: {reason}</p>'
            '<p>Open the Actions tab of the repository for the details.</p>'
        )


def publish(branch, site, work):
    source = os.path.join(work, folder_of(branch) or DEFAULT_BRANCH)
    run('git', 'worktree', 'add', '--detach', source, f'origin/{branch}')
    target = os.path.join(site, folder_of(branch))
    os.makedirs(target, exist_ok=True)
    kind = build_script(source)
    if kind is None:
        copied(source, target)
        return
    try:
        output = built(source, kind)
    except (subprocess.CalledProcessError, RuntimeError) as failure:
        print(f'::warning::{branch} did not build: {failure}')
        failure_page(target, branch, 'its build failed.')
        return
    made_relative(output)
    with_files_named_in_code(output, source)
    copied(output, target)


def main(site):
    os.makedirs(site, exist_ok=True)
    work = tempfile.mkdtemp()
    every = branches()
    # main first: a branch folder may then sit beside main's own files.
    for branch in sorted(every, key=lambda name: name != DEFAULT_BRANCH):
        print(f'::group::{branch}')
        publish(branch, site, work)
        print('::endgroup::')


if __name__ == '__main__':
    main(os.path.abspath(sys.argv[1]))
