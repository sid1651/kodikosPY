import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Container Pool Manager
 * Maintains a pool of warm containers ready for immediate use
 * Eliminates cold start delays by reusing containers
 */
class ContainerPool {
  constructor(imageName, poolSize = 5, containerConfig = {}) {
    console.log(`🔍 DEBUG constructor: Received imageName = "${imageName}", type = ${typeof imageName}`);
    // Store original imageName
    const _imageName = imageName;

    // Create a getter that logs every access
    Object.defineProperty(this, 'imageName', {
      get() {
        console.log(`🔍 DEBUG imageName GET: Returning "${_imageName}"`);
        return _imageName;
      },
      set(newValue) {
        console.error(`🚨 ALERT: Attempted to modify imageName from "${_imageName}" to "${newValue}"!`);
        // Don't allow modification
      },
      enumerable: true,
      configurable: false
    });

    this.poolSize = poolSize;
    this.containerConfig = containerConfig;
    // Default to writable rootfs; allow callers to opt in to read-only containers
    this.readOnlyRootfs = containerConfig.readOnly ?? false;
    console.log(`🏗️ ContainerPool created with imageName: ${this.imageName}`);
    console.log(`🔍 DEBUG constructor: this.imageName = "${this.imageName}" after assignment`);

    this.availableContainers = [];
    this.busyContainers = new Set();
    this.initialized = false;
    this.initializing = false;

    // Add unique instance ID for debugging
    this.instanceId = `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔍 DEBUG: Pool instance created with ID: ${this.instanceId}, imageName: ${this.imageName}`);

    // Idle timeout in milliseconds (2 minutes default)
    this.idleTimeout = parseInt(process.env.CONTAINER_IDLE_TIMEOUT || "120000", 10);

    // Start idle cleanup interval
    this.startIdleCleanup();
  }

  /**
   * Initialize the pool by creating warm containers
   * Called once on service startup
   */
  async initialize() {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;
    console.log(`🔥 Initializing ${this.imageName} container pool (size: ${this.poolSize})...`);

    const createPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      createPromises.push(this.createContainer());
    }

    try {
      await Promise.all(createPromises);
      this.initialized = true;
      console.log(`✅ ${this.imageName} pool initialized with ${this.availableContainers.length} containers`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.imageName} pool:`, error);
      // Continue with whatever containers we managed to create
      this.initialized = true;
    }

    this.initializing = false;
  }

  /**
   * Create a new container and add it to the pool
   * @returns {Promise<string>} Container ID
   */
  async createContainer() {
    try {
      // Check if image exists locally, if not try to pull it
      try {
        await execAsync(`docker image inspect ${this.imageName} > /dev/null 2>&1`);
      } catch (inspectError) {
        // Image doesn't exist locally, try to pull it
        console.log(`📥 Image ${this.imageName} not found locally, attempting to pull from Docker Hub...`);
        try {
          // Use linux/amd64 platform for compatibility (works on both Intel and Apple Silicon via Rosetta)
          await execAsync(`docker pull --platform linux/amd64 ${this.imageName}`);
          console.log(`✅ Successfully pulled ${this.imageName} from Docker Hub`);
        } catch (pullError) {
          // Check if Docker daemon is running
          try {
            await execAsync(`docker info > /dev/null 2>&1`);
          } catch (dockerError) {
            throw new Error(`Docker daemon is not running. Please start Docker Desktop and try again.`);
          }
          // If pull fails and Docker is running, the image might not exist on Docker Hub
          throw new Error(`Image ${this.imageName} not found locally and could not be pulled from Docker Hub. Please check if the image exists on Docker Hub or start Docker Desktop.`);
        }
      }

      // Build docker run command with security restrictions
      const securityFlags = [
        "--network=none",
        "--pids-limit=20",
        "--memory=300m",
        "--cpus=0.5",
        "--cap-drop=ALL",
        "--security-opt no-new-privileges",
      ];

      // Only lock the root filesystem when the pool explicitly opts in
      if (this.readOnlyRootfs) {
        securityFlags.push("--read-only");
      }

      // Add custom config flags (remove duplicates)
      const customFlags = this.containerConfig.flags || [];
      const allFlagsSet = new Set([...securityFlags, ...customFlags]);
      const allFlags = Array.from(allFlagsSet).join(" \\\n        ");

      const runCmd = `docker run -d -i ${allFlags} ${this.imageName} ${this.containerConfig.cmd || ""}`.trim();

      const { stdout } = await execAsync(runCmd);
      const containerId = stdout.trim();

      // Wait a moment for container to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.availableContainers.push({
        id: containerId,
        createdAt: Date.now(),
        useCount: 0,
      });

      console.log(`✅ Created ${this.imageName} container: ${containerId.substring(0, 12)}`);
      return containerId;
    } catch (error) {
      process.stdout.write(`❌ Failed to create ${this.imageName} container: ${error.message}\n`);
      process.stdout.write(`🔍 DEBUG createContainer catch: this.imageName = "${this.imageName}"\n`);
      process.stdout.write(`🔍 DEBUG createContainer catch: error.message = "${error.message}"\n`);
      process.stdout.write(`🔍 DEBUG createContainer catch: error.constructor = ${error.constructor?.name}\n`);
      process.stdout.write(`🔍 DEBUG createContainer catch: Full error = ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n`);

      // If the error message contains the old image name, replace it with the correct one
      if (error.message && !error.message.includes(this.imageName) && (error.message.includes('cpp-runner') || error.message.includes('kodikos-python'))) {
        const correctedMessage = error.message.replace(/cpp-runner|kodikos-python/g, this.imageName);
        process.stdout.write(`🔍 DEBUG: Replacing old image name, new message = "${correctedMessage}"\n`);
        throw new Error(correctedMessage);
      }
      process.stdout.write(`🔍 DEBUG: Re-throwing original error as-is\n`);
      throw error;
    }
  }

  /**
   * Get an available container from the pool
   * Creates a new one if pool is empty and under max size
   * @returns {Promise<string>} Container ID
   */
  async getContainer() {
    process.stdout.write(`🔍 DEBUG getContainer START: instanceId=${this.instanceId}, imageName="${this.imageName}", available=${this.availableContainers.length}, busy=${this.busyContainers.size}\n`);
    // Wait for initialization if still initializing
    while (this.initializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // DEBUG: Log the actual imageName at the start of getContainer
    process.stdout.write(`🔍 DEBUG getContainer AFTER WAIT: instanceId=${this.instanceId}, imageName="${this.imageName}", available=${this.availableContainers.length}\n`);

    // If pool is empty, try to create a new container on-demand
    if (this.availableContainers.length === 0) {
      const totalContainers = this.availableContainers.length + this.busyContainers.size;
      if (totalContainers < this.poolSize * 2) {
        // Allow up to 2x pool size during peak load
        try {
          // Use process.stdout.write for immediate output (no buffering)
          process.stdout.write(`📦 Pool empty, creating on-demand container for ${this.imageName}...\n`);
          process.stdout.write(`🔍 DEBUG getContainer: this.imageName = "${this.imageName}", typeof = ${typeof this.imageName}\n`);
          process.stdout.write(`🔍 DEBUG getContainer: this object keys = ${Object.keys(this).join(', ')}\n`);
          await this.createContainer();
        } catch (error) {
          console.error(`❌ Failed to create emergency container:`, error.message);
          console.error(`🔍 DEBUG: Error occurred with imageName = "${this.imageName}"`);
          console.error(`🔍 DEBUG: Error stack:`, error.stack?.substring(0, 500));
          console.error(`🔍 DEBUG: Error constructor:`, error.constructor?.name);
          // If Docker images aren't found, provide helpful error
          if (error.message.includes("not found locally") || error.message.includes("not found")) {
            const errorMsg = `[NEW-ERROR-FORMAT] Docker image '${this.imageName}' not found. Please ensure Docker is running and the image exists on Docker Hub. Image: ${this.imageName}`;
            console.error(`🔍 DEBUG: Throwing NEW error with imageName = "${this.imageName}"`);
            console.error(`🔍 DEBUG: Error message will be: "${errorMsg}"`);
            throw new Error(errorMsg);
          }
          console.error(`🔍 DEBUG: Re-throwing original error: "${error.message}"`);
          throw error;
        }
      }
    }

    // Wait for a container to become available (with retry)
    let attempts = 0;
    while (this.availableContainers.length === 0 && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (this.availableContainers.length === 0) {
      throw new Error(`No containers available in pool for ${this.imageName}. Please ensure Docker is running and the image '${this.imageName}' exists on Docker Hub.`);
    }

    // Get container from pool
    const container = this.availableContainers.shift();
    this.busyContainers.add(container.id);
    container.useCount++;
    container.lastUsed = Date.now();

    return container.id;
  }

  /**
   * Return a container to the pool after use
   * Cleans the container before returning
   * @param {string} containerId - Container ID to return
   */
  async returnContainer(containerId) {
    if (!this.busyContainers.has(containerId)) {
      return; // Container not in busy set
    }

    this.busyContainers.delete(containerId);

    // Clean container before returning to pool
    try {
      await this.cleanContainer(containerId);
    } catch (error) {
      console.error(`Failed to clean container ${containerId}:`, error);
      // Remove container if cleaning fails
      await this.removeContainer(containerId);
      return;
    }

    // Check if container is still healthy
    const isHealthy = await this.checkContainerHealth(containerId);
    if (!isHealthy) {
      console.log(`⚠️ Container ${containerId.substring(0, 12)} unhealthy, removing from pool`);
      await this.removeContainer(containerId);
      // Create replacement if pool is below minimum
      if (this.availableContainers.length + this.busyContainers.size < this.poolSize) {
        this.createContainer().catch((err) => console.error("Failed to create replacement:", err));
      }
      return;
    }

    // Return to pool
    const container = {
      id: containerId,
      createdAt: Date.now(),
      useCount: 0,
      lastUsed: Date.now(),
    };

    this.availableContainers.push(container);
  }

  /**
   * Clean a container (remove temp files, reset state)
   * @param {string} containerId - Container ID to clean
   */
  async cleanContainer(containerId) {
    try {
      // Clean temp directories inside container
      await execAsync(`docker exec ${containerId} sh -c "rm -rf /tmp/* /tmp/.* 2>/dev/null || true"`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if container is still running and healthy
   * @param {string} containerId - Container ID to check
   * @returns {Promise<boolean>} True if healthy
   */
  async checkContainerHealth(containerId) {
    try {
      const { stdout } = await execAsync(`docker ps --filter id=${containerId} --format "{{.ID}}"`);
      return stdout.trim() === containerId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove a container from the pool permanently
   * @param {string} containerId - Container ID to remove
   */
  async removeContainer(containerId) {
    try {
      await execAsync(`docker rm -f ${containerId}`);
      console.log(`🗑️ Removed container: ${containerId.substring(0, 12)}`);
    } catch (error) {
      console.error(`Failed to remove container ${containerId}:`, error);
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool stats
   */
  getStats() {
    console.log(`🔍 DEBUG getStats: this.imageName = "${this.imageName}", available = ${this.availableContainers.length}, busy = ${this.busyContainers.size}`);
    return {
      image: this.imageName,
      poolSize: this.poolSize,
      available: this.availableContainers.length,
      busy: this.busyContainers.size,
      total: this.availableContainers.length + this.busyContainers.size,
      initialized: this.initialized,
    };
  }

  /**
   * Start idle cleanup interval
   * Removes containers that have been idle for more than idleTimeout
   */
  startIdleCleanup() {
    // Check every 30 seconds for idle containers
    setInterval(async () => {
      await this.cleanupIdleContainers();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Clean up containers that have been idle for too long
   * Only removes containers from available pool (not busy ones)
   */
  async cleanupIdleContainers() {
    const now = Date.now();
    const containersToRemove = [];

    // Check available containers for idle timeout
    for (let i = this.availableContainers.length - 1; i >= 0; i--) {
      const container = this.availableContainers[i];
      const idleTime = now - (container.lastUsed || container.createdAt);

      // If container has been idle for more than idleTimeout, mark for removal
      if (idleTime > this.idleTimeout) {
        containersToRemove.push(container.id);
        this.availableContainers.splice(i, 1);
      }
    }

    // Remove idle containers
    if (containersToRemove.length > 0) {
      console.log(`🧹 Removing ${containersToRemove.length} idle ${this.imageName} container(s) (idle > ${this.idleTimeout / 1000}s)`);
      await Promise.all(containersToRemove.map((id) => this.removeContainer(id)));
    }
  }

  /**
   * Cleanup all containers in the pool
   * Called on service shutdown
   */
  async cleanup() {
    console.log(`🧹 Cleaning up ${this.imageName} container pool...`);

    const allContainers = [...this.availableContainers.map((c) => c.id), ...Array.from(this.busyContainers)];

    await Promise.all(allContainers.map((id) => this.removeContainer(id)));

    this.availableContainers = [];
    this.busyContainers.clear();
    this.initialized = false;
  }
}

export default ContainerPool;

// FILE VERSION: 1765025130
