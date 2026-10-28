import struct, json, os, sys, hashlib, argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asar', required=True)
    a = ap.parse_args()
    with open(a.asar, 'rb') as f:
        pre = f.read(16)
        jl = struct.unpack('<I', pre[12:16])[0]
        js = f.read(jl)
        header = json.loads(js.decode('utf-8'))
    entry = header['files']['lib']['files']['main.js']
    print('entry:', json.dumps(entry))
    if not entry.get('unpacked'):
        print('NOT_PATCHED'); return 0
    unpacked_main = os.path.join(a.asar + '.unpacked', 'lib', 'main.js')
    if not os.path.isfile(unpacked_main):
        print('VERIFY_FAIL missing unpacked main.js', file=sys.stderr); return 1
    with open(unpacked_main, 'rb') as f:
        data = f.read()
    if len(data) != int(entry['size']):
        print('VERIFY_FAIL size mismatch %d vs %d' % (len(data), int(entry['size'])), file=sys.stderr); return 2
    sha = hashlib.sha256(data).hexdigest()
    if sha != entry['integrity']['hash']:
        print('VERIFY_FAIL hash mismatch', file=sys.stderr); return 3
    print('VERIFY_OK size=%d sha=%s' % (len(data), sha))
    return 0

if __name__ == '__main__':
    sys.exit(main())
