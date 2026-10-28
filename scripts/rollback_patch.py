import struct, json, os, sys, argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asar', required=True)
    ap.add_argument('--state-file', required=True)
    a = ap.parse_args()
    if not os.path.isfile(a.state_file):
        print('NOT_PATCHED (no state file)', file=sys.stderr); return 0
    with open(a.state_file, 'r', encoding='utf-8') as f:
        state = json.load(f)
    backup_dir = state.get('backupDir')
    hb = os.path.join(backup_dir, 'header.bin')
    if not os.path.isfile(hb):
        print('ERROR_BACKUP_MISSING ' + hb, file=sys.stderr); return 1
    with open(hb, 'rb') as f:
        header_bytes = f.read()
    with open(a.asar, 'rb') as f:
        cur_pre = f.read(16)
    jl = struct.unpack('<I', cur_pre[12:16])[0]
    if len(header_bytes) != 16 + jl:
        print('ERROR_BACKUP_MISMATCH backup=%d expected=%d' % (len(header_bytes), 16 + jl), file=sys.stderr); return 2
    with open(a.asar, 'r+b') as f:
        f.seek(0)
        f.write(header_bytes)
    unpacked_main = os.path.join(a.asar + '.unpacked', 'lib', 'main.js')
    if os.path.isfile(unpacked_main):
        os.remove(unpacked_main)
    os.remove(a.state_file)
    print('ROLLBACK_OK')
    return 0

if __name__ == '__main__':
    sys.exit(main())
