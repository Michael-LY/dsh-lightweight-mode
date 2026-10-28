import struct, json, os, sys, hashlib, time, argparse

def load_header(path):
    with open(path, 'rb') as f:
        pre = f.read(16)
        jl = struct.unpack('<I', pre[12:16])[0]
        js = f.read(jl)
    return pre, js, json.loads(js.decode('utf-8')), jl

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asar', required=True)
    ap.add_argument('--kernel', required=True)
    ap.add_argument('--backup-dir', required=True)
    ap.add_argument('--state-file', required=True)
    a = ap.parse_args()
    if not os.path.isfile(a.asar):
        print('ERROR_ASAR_NOT_FOUND ' + a.asar, file=sys.stderr); return 1
    pre, js, header, jl = load_header(a.asar)
    lib = header.get('files', {}).get('lib', {}).get('files', {})
    if 'main.js' not in lib:
        print('ERROR_MAIN_ENTRY_MISSING', file=sys.stderr); return 2
    entry = lib['main.js']
    if entry.get('unpacked'):
        print('ALREADY_PATCHED'); return 0
    base = 16 + jl
    off = int(entry['offset']); size = int(entry['size'])
    with open(a.asar, 'rb') as f:
        f.seek(base + off)
        orig = f.read(size)
    if len(orig) != size:
        print('ERROR_SHORT_READ', file=sys.stderr); return 3
    needle = b'import { BrowserWindow, Menu, Notification, Tray,'
    repl = b'import { BrowserWindow, Menu, MenuItem, Notification, Tray,'
    if b'MenuItem' not in orig:
        if needle not in orig:
            print('ERROR_IMPORT_ANCHOR_MISSING', file=sys.stderr); return 4
        patched = orig.replace(needle, repl, 1)
    else:
        patched = orig
    with open(a.kernel, 'rb') as f:
        kernel = f.read()
    if not patched.endswith(b'\n'):
        patched += b'\n'
    patched += b'\n' + kernel
    sha = hashlib.sha256(patched).hexdigest()
    new_entry = {'size': len(patched), 'unpacked': True, 'integrity': {'algorithm': 'SHA256', 'hash': sha, 'blockSize': 4194304, 'blocks': [sha]}}
    header['files']['lib']['files']['main.js'] = new_entry
    newjs = json.dumps(header, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    if len(newjs) > jl:
        print('ERROR_HEADER_TOO_LONG new=%d orig=%d' % (len(newjs), jl), file=sys.stderr); return 5
    padded = newjs + b' ' * (jl - len(newjs))
    os.makedirs(a.backup_dir, exist_ok=True)
    with open(os.path.join(a.backup_dir, 'header.bin'), 'wb') as f:
        f.write(pre + js)
    with open(os.path.join(a.backup_dir, 'main.js.orig'), 'wb') as f:
        f.write(orig)
    unpacked_dir = os.path.join(a.asar + '.unpacked', 'lib')
    os.makedirs(unpacked_dir, exist_ok=True)
    with open(os.path.join(unpacked_dir, 'main.js'), 'wb') as f:
        f.write(patched)
    with open(a.asar, 'r+b') as f:
        f.seek(16)
        f.write(padded)
    state = {'patchedAt': time.time(), 'asar': os.path.abspath(a.asar), 'backupDir': os.path.abspath(a.backup_dir), 'mainSize': len(patched), 'sha256': sha}
    os.makedirs(os.path.dirname(a.state_file), exist_ok=True)
    with open(a.state_file, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)
    print('PATCH_OK ' + json.dumps(state))
    return 0

if __name__ == '__main__':
    sys.exit(main())
