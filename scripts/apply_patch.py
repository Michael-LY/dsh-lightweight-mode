import struct, json, os, sys, hashlib, time, argparse


def align4(n):
    """Round n up to the next multiple of 4."""
    return (n + 3) & ~3


def load_header(path):
    """Parse the asar header and locate the data area.

    asar uses Chromium Pickle framing:
        [0:4]    = 4                 size-pickle payload size
        [4:8]    = header_size       size of the header pickle buffer
        [8:12]   = header_size - 4   header-pickle payload size
        [12:16]  = json_len          JSON string length
        [16:...] = JSON string, space-padded to a 4-byte boundary

    The data-area base is ``8 + header_size`` (== ``16 + align4(json_len)``).
    The old formula ``16 + json_len`` dropped the 4-byte alignment padding, so
    on any header whose JSON length is not a multiple of 4 (e.g. DSH Desktop
    0.2.2-rc.2, which has 3 bytes of padding) main.js was read shifted by up to
    3 bytes, producing an invalid unpacked/lib/main.js that begins with '}'.
    """
    with open(path, 'rb') as f:
        pre = f.read(16)
        if len(pre) != 16:
            raise ValueError('ERROR_SHORT_HEADER')
        json_len = struct.unpack('<I', pre[12:16])[0]
        js = f.read(json_len)
        if len(js) != json_len:
            raise ValueError('ERROR_SHORT_JSON')
        header_size = struct.unpack('<I', pre[4:8])[0]
        expected = 8 + align4(json_len)
        if header_size != expected:
            raise ValueError('ERROR_HEADER_SIZE_MISMATCH got=%d expected=%d' % (header_size, expected))
        base = 8 + header_size
        pad_len = base - 16 - json_len
        padding = f.read(pad_len)
        if len(padding) != pad_len:
            raise ValueError('ERROR_SHORT_PADDING')
    header = json.loads(js.decode('utf-8'))
    return pre, js, padding, header, json_len, base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asar', required=True)
    ap.add_argument('--kernel', required=True)
    ap.add_argument('--backup-dir', required=True)
    ap.add_argument('--state-file', required=True)
    a = ap.parse_args()
    if not os.path.isfile(a.asar):
        print('ERROR_ASAR_NOT_FOUND ' + a.asar, file=sys.stderr); return 1
    try:
        pre, js, padding, header, json_len, base = load_header(a.asar)
    except ValueError as e:
        print(str(e), file=sys.stderr); return 3
    lib = header.get('files', {}).get('lib', {}).get('files', {})
    if 'main.js' not in lib:
        print('ERROR_MAIN_ENTRY_MISSING', file=sys.stderr); return 2
    entry = lib['main.js']
    if entry.get('unpacked'):
        print('ALREADY_PATCHED'); return 0
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
    if len(newjs) > json_len:
        print('ERROR_HEADER_TOO_LONG new=%d orig=%d' % (len(newjs), json_len), file=sys.stderr); return 5
    padded = newjs + b' ' * (json_len - len(newjs))
    os.makedirs(a.backup_dir, exist_ok=True)
    # Back up the COMPLETE original header region (16 header + JSON + alignment
    # padding == 8 + header_size bytes) so rollback restores it byte-exactly.
    with open(os.path.join(a.backup_dir, 'header.bin'), 'wb') as f:
        f.write(pre + js + padding)
    with open(os.path.join(a.backup_dir, 'main.js.orig'), 'wb') as f:
        f.write(orig)
    unpacked_dir = os.path.join(a.asar + '.unpacked', 'lib')
    os.makedirs(unpacked_dir, exist_ok=True)
    with open(os.path.join(unpacked_dir, 'main.js'), 'wb') as f:
        f.write(patched)
    # Rewrite the whole header region at equal length: pre keeps the Pickle
    # framing bytes unchanged (header_size / json_len stay valid because
    # len(padded) == json_len) and the original alignment padding is written
    # back verbatim, so the asar data area is untouched.
    with open(a.asar, 'r+b') as f:
        f.seek(0)
        f.write(pre + padded + padding)
    state = {'patchedAt': time.time(), 'asar': os.path.abspath(a.asar), 'backupDir': os.path.abspath(a.backup_dir), 'mainSize': len(patched), 'sha256': sha}
    os.makedirs(os.path.dirname(a.state_file), exist_ok=True)
    with open(a.state_file, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)
    print('PATCH_OK ' + json.dumps(state))
    return 0


if __name__ == '__main__':
    sys.exit(main())
