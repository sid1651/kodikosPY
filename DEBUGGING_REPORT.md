# Code Execution Service Debugging Report

**Date:** December 6, 2024  
**Service:** code-execution-service  
**Issue:** Docker image name mismatch causing execution failures

---

## 1. Our Intent

### Goal

We want the code-execution-service to use Docker images from Docker Hub (`sidhu1651/cpp-runner` and `sidhu1651/kodikos-python`) instead of building them locally. The service should:

1. Pull images from Docker Hub if not found locally
2. Use the correct image names (`sidhu1651/cpp-runner`, not `cpp-runner`)
3. Create containers from these images for code execution
4. Maintain a pool of pre-warmed containers for fast execution

### Architecture

- **Backend Service** (port 5002): Handles authentication, API routes, delegates code execution
- **Code Execution Service** (port 5001): Handles Docker container management and code execution
- **Container Pool**: Pre-warms containers to eliminate cold start delays

---

## 2. The Bottleneck Error

### Primary Error Message

```json
{
  "output": "Docker image 'cpp-runner' not found. Please build it first: docker build -t cpp-runner ./cpp-runner"
}
```

### Critical Observations

1. **Wrong Image Name**: Error shows `cpp-runner` instead of `sidhu1651/cpp-runner`
2. **Old Error Format**: The error message format "Please build it first: docker build -t cpp-runner ./cpp-runner" is NOT in our current codebase
3. **Error Source Unknown**: Despite extensive logging, we cannot trace where this error originates
4. **No Execution Logs**: When a request is made, we see NO logs from:
   - Route handler (`/execute/cpp`)
   - Controller (`executeCpp`)
   - `runCppCode` function
   - `getContainer` method
   - `createContainer` method

---

## 3. Root Cause Analysis

### Hypothesis 1: Cached/Old Code

**Evidence:**

- Error message format doesn't exist in current codebase
- We've restarted services multiple times
- Cleared Node.js caches
- Added version comments to force reload

**Status:** ❌ Unlikely - We've cleared all caches and restarted

### Hypothesis 2: Wrong Pool Instance

**Evidence:**

- Pool is created with correct `imageName: "sidhu1651/cpp-runner"` ✅
- When tested directly, pool shows correct imageName ✅
- But error shows wrong imageName (`cpp-runner`) ❌

**Status:** ⚠️ Possible - But we only create ONE pool instance per service

### Hypothesis 3: ImageName Being Modified

**Evidence:**

- `imageName` is only set in constructor
- We added getter/setter protection - no modification detected
- Constructor logs show correct imageName

**Status:** ❌ Unlikely - No modification detected

### Hypothesis 4: Error from Different Code Path

**Evidence:**

- No logs from execution path (route → controller → runCppCode → getContainer)
- Error is returned, so request IS being processed
- Error format suggests old code path

**Status:** ⚠️ Possible - But we can't trace it

### Hypothesis 5: Error from Backend Service

**Evidence:**

- Backend calls execution service via HTTP
- Backend might be constructing error message
- But we're testing directly on execution service (port 5001)

**Status:** ❌ Unlikely - Direct testing bypasses backend

---

## 4. Issues with Code-Execution-Service

### Issue 1: Missing Execution Logs

**Problem:** When a request comes in, we see NO logs from the execution path.

**What We Tried:**

- Added `console.log()` statements
- Added `process.stdout.write()` for immediate output
- Added `process.stderr.write()` for stderr
- Added logging at every level (route, controller, service, pool)

**Result:** ❌ No logs appear in log file

**Possible Causes:**

- Logs are being buffered and not flushed
- Error is thrown before execution path
- Different code path is being executed
- Request is not reaching the controller

### Issue 2: Wrong Image Name in Error

**Problem:** Error shows `cpp-runner` instead of `sidhu1651/cpp-runner`.

**What We Tried:**

- Verified pool creation with correct imageName ✅
- Added debug logging in constructor ✅
- Added getter/setter protection for imageName ✅
- Added instance ID tracking ✅
- Tested pool directly - shows correct imageName ✅

**Result:** ❌ Error still shows wrong imageName

**Possible Causes:**

- Different pool instance being used
- Error message constructed from wrong source
- Old error format cached somewhere

### Issue 3: Old Error Format

**Problem:** Error message "Please build it first: docker build -t cpp-runner ./cpp-runner" doesn't exist in current code.

**What We Tried:**

- Searched entire codebase for this message ❌ Not found
- Added unique identifier `[NEW-ERROR-FORMAT]` to new error messages
- Added `[PULL-ERROR]` identifier to pull error messages
- Forced module reload with version comments

**Result:** ❌ Error still shows old format (no identifiers)

**Possible Causes:**

- Cached/compiled code somewhere
- Error from different service/file
- Error constructed from Docker's error message

### Issue 4: Container Pool Behavior

**Problem:** Containers are created successfully but then removed by idle cleanup.

**What We Tried:**

- Verified containers are created with correct image names ✅
- Confirmed idle cleanup removes containers after 2 minutes ✅
- Added logging to track container lifecycle ✅

**Result:** ✅ Expected behavior - but when pool is empty, new containers should be created on-demand

**Issue:** When pool is empty and `getContainer()` is called, it should create a new container, but we're getting an error instead.

---

## 5. Detailed Findings and Observations

### Finding 1: Pool Initialization Works Correctly

**Observation:**

```
🔧 C++ Pool using image: sidhu1651/cpp-runner
🏗️ ContainerPool created with imageName: sidhu1651/cpp-runner
✅ Created sidhu1651/cpp-runner container: 8e1a4c74045b
✅ sidhu1651/cpp-runner pool initialized with 5 containers
```

**Conclusion:** Pool is created correctly with right imageName.

### Finding 2: Direct Pool Testing Works

**Observation:**

```javascript
// When testing pool directly:
const stats = m.getCppPoolStats();
// Returns: { image: 'sidhu1651/cpp-runner', ... } ✅
```

**Conclusion:** Pool instance has correct imageName when accessed directly.

### Finding 3: Error Response Format

**Observation:**

```json
{ "output": "Docker image 'cpp-runner' not found..." }
```

**Conclusion:** Error is returned as `{output: error.message}` from `runCppCode`, but we never see logs from `runCppCode`.

### Finding 4: No Execution Path Logs

**Observation:**

- Request reaches server (we get error response)
- But NO logs from:
  - Route middleware
  - Controller (`executeCpp`)
  - `runCppCode` function
  - `getContainer` method
  - `createContainer` method

**Conclusion:** Either logs are buffered, or error is thrown from different path.

### Finding 5: Container Lifecycle

**Observation:**

1. Containers created successfully ✅
2. Pool initialized with 5 containers ✅
3. After 2 minutes, idle cleanup removes containers ✅
4. When request comes in, pool is empty
5. `getContainer()` should create new container, but error occurs instead ❌

**Conclusion:** Error occurs when trying to create container on-demand.

---

## 6. What We've Tried and Failed

### Attempt 1: Added Extensive Logging

**What:** Added debug logs at every level of execution.
**Result:** ❌ No logs appear in log file.

### Attempt 2: Used process.stdout.write()

**What:** Used unbuffered output to ensure immediate logging.
**Result:** ❌ Still no logs appear.

### Attempt 3: Added Unique Error Identifiers

**What:** Added `[NEW-ERROR-FORMAT]` and `[PULL-ERROR]` to new error messages.
**Result:** ❌ Error still shows old format (no identifiers).

### Attempt 4: Protected imageName with Getter/Setter

**What:** Added getter/setter to detect if imageName is modified.
**Result:** ❌ No modification detected, but error still shows wrong name.

### Attempt 5: Added Instance ID Tracking

**What:** Added unique instance ID to each pool to track which instance is used.
**Result:** ❌ Can't verify because no logs from getContainer.

### Attempt 6: Cleared All Caches

**What:**

- Cleared Node.js caches
- Removed old containers
- Restarted services multiple times
- Added version comments to force reload

**Result:** ❌ Error persists.

### Attempt 7: Tested Pool Directly

**What:** Imported and tested pool module directly.
**Result:** ✅ Pool shows correct imageName, but service still fails.

### Attempt 8: Searched for Old Error Message

**What:** Searched entire codebase for "Please build it first".
**Result:** ❌ Not found in current code.

### Attempt 9: Checked Docker Error Messages

**What:** Tested what Docker returns when image doesn't exist.
**Result:** ✅ Docker doesn't return "Please build it first" message.

### Attempt 10: Added Route-Level Logging

**What:** Added middleware to log all route requests.
**Result:** ❌ No route logs appear.

---

## 7. The Loop We're Stuck In

### The Debugging Loop

```
1. We add logging → No logs appear
2. We check if code is cached → Cleared all caches
3. We verify pool creation → Pool is correct ✅
4. We test directly → Works correctly ✅
5. We make HTTP request → Error with wrong imageName ❌
6. We check logs → No execution logs found ❌
7. We add more logging → Still no logs appear
8. Repeat from step 1...
```

### Why We're Stuck

1. **No Visibility**: We can't see what's happening during execution because no logs appear.
2. **Error Source Unknown**: The error message doesn't match any code in our codebase.
3. **Correct Pool, Wrong Error**: Pool is created correctly, but error shows wrong imageName.
4. **No Execution Path**: We can't trace the execution path because logs don't appear.

### The Core Mystery

**Question:** How can we get an error response with a message that doesn't exist in our code?

**Possible Answers:**

1. There's a cached/compiled version of old code somewhere
2. The error is being constructed from multiple sources
3. There's a different service/file throwing this error
4. Node.js is executing old code despite our changes
5. The error is coming from a different process/service

---

## 8. Current State

### What Works ✅

- Pool initialization with correct image names
- Container creation with correct image names
- Direct pool testing shows correct imageName
- Docker images exist on host (`sidhu1651/cpp-runner`, `sidhu1651/kodikos-python`)

### What Doesn't Work ❌

- HTTP requests to `/execute/cpp` return error with wrong imageName
- No execution logs appear in log file
- Error message format doesn't match current code
- Can't trace execution path

### What We Need

1. **Visibility**: Need to see what's happening during request execution
2. **Error Source**: Need to find where the error message is coming from
3. **Execution Path**: Need to trace the full execution path
4. **Root Cause**: Need to understand why imageName is wrong in error

---

## 9. Next Steps (Recommendations)

### Immediate Actions

1. **Check for Multiple Processes**: Verify only one execution service is running
2. **Check Log File Permissions**: Ensure logs can be written
3. **Test with Different Logging**: Try writing to a file directly instead of stdout/stderr
4. **Check for Error Middleware**: Verify if error middleware is catching and modifying errors
5. **Check for Promise Rejections**: Look for unhandled promise rejections

### Investigation Areas

1. **Module Caching**: Check if Node.js is caching modules in a way we haven't cleared
2. **Error Middleware**: Check if Express error middleware is modifying error messages
3. **Different Code Path**: Check if there's a different route/controller being used
4. **Process Isolation**: Check if requests are being handled by a different process
5. **Docker Error Parsing**: Check if error is being parsed from Docker's stderr/stdout

### Alternative Approaches

1. **Add File Logging**: Write logs directly to a file instead of stdout/stderr
2. **Add Error Tracking**: Use a proper error tracking service
3. **Simplify Error Handling**: Remove all error correction code and see raw errors
4. **Test with Minimal Code**: Create a minimal test case to isolate the issue
5. **Check Git History**: See if old error message exists in git history

---

## 10. Code References

### Key Files

- `/code-execution-service/services/containerPool.js` - Container pool management
- `/code-execution-service/services/dockercppRunner.js` - C++ execution service
- `/code-execution-service/controllers/executionController.js` - Request controllers
- `/code-execution-service/routes/executionRoutes.js` - Route definitions
- `/code-execution-service/server.js` - Main server file

### Key Functions

- `ContainerPool.constructor()` - Creates pool with imageName
- `ContainerPool.getContainer()` - Gets container from pool
- `ContainerPool.createContainer()` - Creates new container
- `runCppCode()` - Executes C++ code
- `executeCpp()` - Controller for C++ execution

---

## 11. Conclusion

We are stuck in a debugging loop where:

1. The error message doesn't match our code
2. We can't see execution logs
3. The pool is created correctly but error shows wrong imageName
4. All our debugging attempts fail to reveal the root cause

**The core issue:** We have an error that we cannot trace to its source, and we cannot see what's happening during request execution.

**The mystery:** How can we get an error response with a message that doesn't exist in our codebase?

**Next priority:** Find a way to get visibility into the execution path, either through file logging, error tracking, or process inspection.

---

**Report Generated:** December 6, 2024  
**Status:** ✅ RESOLVED - Root cause found and fixed  
**Confidence Level:** High - Issue resolved

---

## 12. SOLUTION FOUND

### Root Cause

**A stale Node.js process was running on port 5001 with old code!**

The old process had:

- Hardcoded image names (`cpp-runner`, `kodikos-python` instead of `sidhu1651/cpp-runner`, `sidhu1651/kodikos-python`)
- Old error message format ("Please build it first: docker build -t cpp-runner ./cpp-runner")
- Different codebase that didn't match our current files

### Why We Couldn't Debug It

1. **No Logs Appeared**: Our logs were going to the NEW process, but requests were hitting the OLD process
2. **Error Didn't Match Code**: The error was from old code, not our current codebase
3. **Wrong Image Names**: Old process had hardcoded wrong image names
4. **Multiple Processes**: Multiple Node.js processes were running, making it confusing

### The Fix

1. **Killed Stale Process**: Found and killed the old process on port 5001
2. **Made readOnly Configurable**: Changed container pool to allow writable rootfs (needed for `docker cp` and compilation)
3. **Simplified C++ Script**: Fixed the compile/run script to use a single safe shell command
4. **Cleaned Up Python Controller**: Removed redundant temp-dir/image handling

### Code Changes Made

#### 1. Container Pool - ReadOnly Configurable

```javascript
// containerPool.js
this.readOnlyRootfs = containerConfig.readOnly ?? false;
// Defaults to false (writable) unless explicitly set to true
```

#### 2. C++ Runner - Writable Containers

```javascript
// dockercppRunner.js
const cppPool = new ContainerPool(CPP_IMAGE, CPP_POOL_SIZE, {
  cmd: "tail -f /dev/null",
  readOnly: false, // Need writable FS to copy/compile user code
  flags: [
    "--network=none",
    // ... other flags
    // Note: Not using --read-only because we need to compile inside container
  ],
});
```

#### 3. Python Runner - Writable Containers

```javascript
// dockerPythonRunner.js
const pythonPool = new ContainerPool(PYTHON_IMAGE, PYTHON_POOL_SIZE, {
  cmd: "tail -f /dev/null",
  readOnly: false, // Matplotlib/image generation needs a writable /tmp
  flags: [
    "--network=none",
    // ... other flags
  ],
});
```

#### 4. Simplified C++ Execution

```javascript
// dockercppRunner.js
const compileAndRunCmd = `cd /app && g++ -o code code.cpp 2>&1 && ./code < input.txt 2>&1 || echo "ERROR::$?"`;
const { stdout, stderr } = await execAsync(
  `docker exec ${containerId} sh -c ${JSON.stringify(compileAndRunCmd)}`,
  { timeout: 10000 }
);
```

### Verification Results ✅

1. **Service Running**: ✅ Process 62065 on port 5001
2. **Stats Correct**: ✅ Shows `sidhu1651/cpp-runner` and `sidhu1651/kodikos-python`
3. **C++ Execution**: ✅ `{"output":"hi\n"}` - Works correctly
4. **Python Execution**: ✅ `{"output":"2\n__PYTHON_DONE__","images":[]}` - Works correctly
5. **Image Names**: ✅ All logs show correct Docker Hub image names

### Lessons Learned

1. **Always Check for Stale Processes**: Use `lsof -i :PORT` before starting services
2. **Multiple Processes Cause Confusion**: Kill all old processes before debugging
3. **Log Visibility**: If logs don't appear, check if requests are hitting a different process
4. **Error Message Mismatch**: If error doesn't match code, check for stale processes or cached code

### Prevention

**Before starting services, always run:**

```bash
# Check for processes on the port
lsof -i :5001

# Kill any stale processes
pkill -f "code-execution-service"

# Then start the service
cd code-execution-service && npm start
```

---

**Report Updated:** December 6, 2024  
**Final Status:** ✅ RESOLVED  
**Solution:** Killed stale process, made readOnly configurable, simplified execution scripts
