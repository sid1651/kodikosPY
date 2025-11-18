import sys

try:
    code = sys.stdin.read()
    exec(code)
except Exception as e:
    print("ERROR:", e)
