import sys, os, uuid

# Create temporary folder inside the container
TEMP_DIR = "/tmp/output"
os.makedirs(TEMP_DIR, exist_ok=True)

# Force working directory
os.chdir(TEMP_DIR)

try:
    code = sys.stdin.read()

    # Execute user code
    exec(code)

    print("__PYTHON_DONE__")
except Exception as e:
    print("ERROR:", e)
