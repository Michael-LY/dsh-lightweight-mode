import sys
import os
p = os.path.join(os.path.expanduser("~"), ".dsh", "lightweight-mode.json")
data = open(p, "rb").read()
had = data.startswith(b"\xef\xbb\xbf")
if had:
    data = data[3:]
open(p, "wb").write(data)
print("bom_removed=" + str(had) + " bytes=" + str(len(data)) + " content=" + data.decode("utf-8"))
