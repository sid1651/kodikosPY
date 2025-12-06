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
    this.imageName = imageName;
    this.poolSize = poolSize;
    this.containerConfig = containerConfig;
    this.availableContainers = [];
    this.busyContainers = new Set();
    this.initialized = false;
    this.initializing = false;
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
      // Build docker run command with security restrictions
      const securityFlags = [
        "--network=none",
        "--read-only",
        "--pids-limit=20",
        "--memory=300m",
        "--cpus=0.5",
        "--cap-drop=ALL",
        "--security-opt no-new-privileges",
      ];

      // Add custom config flags
      const customFlags = this.containerConfig.flags || [];
      const allFlags = [...securityFlags, ...customFlags].join(" \\\n        ");

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
      console.error(`❌ Failed to create ${this.imageName} container:`, error.message);
      throw error;
    }
  }

  /**
   * Get an available container from the pool
   * Creates a new one if pool is empty and under max size
   * @returns {Promise<string>} Container ID
   */
  async getContainer() {
    // Wait for initialization if still initializing
    while (this.initializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // If pool is empty, try to create a new container
    if (this.availableContainers.length === 0) {
      const totalContainers = this.availableContainers.length + this.busyContainers.size;
      if (totalContainers < this.poolSize * 2) {
        // Allow up to 2x pool size during peak load
        try {
          await this.createContainer();
        } catch (error) {
          console.error(`Failed to create emergency container:`, error);
        }
      }
    }

    // Wait for a container to become available
    let attempts = 0;
    while (this.availableContainers.length === 0 && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (this.availableContainers.length === 0) {
      throw new Error("No containers available in pool");
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

