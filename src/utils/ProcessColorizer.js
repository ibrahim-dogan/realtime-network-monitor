/**
 * ProcessColorizer class to manage color schemes for different process types
 * and classify applications into categories (browser, system, media, development, other)
 */
class ProcessColorizer {
  constructor() {
    // Process classification patterns
    this.processPatterns = {
      browser: [
        /chrome/i, /firefox/i, /safari/i, /edge/i, /opera/i,
        /brave/i, /vivaldi/i, /arc/i, /webkit/i, /chromium/i,
        /tor browser/i, /duckduckgo/i
      ],
      system: [
        /kernel/i, /system/i, /daemon/i, /service/i, /update/i,
        /security/i, /backup/i, /sync/i, /finder/i, /spotlight/i,
        /launchd/i, /systemui/i, /control/i, /preferences/i,
        /activity monitor/i, /console/i, /disk utility/i,
        /keychain/i, /network/i, /bluetooth/i, /wifi/i
      ],
      media: [
        /spotify/i, /vlc/i, /quicktime/i, /music/i, /video/i,
        /netflix/i, /youtube/i, /streaming/i, /itunes/i,
        /photos/i, /preview/i, /final cut/i, /imovie/i,
        /adobe/i, /photoshop/i, /premiere/i, /after effects/i,
        /plex/i, /kodi/i, /handbrake/i, /obs/i
      ],
      development: [
        /code/i, /git/i, /node/i, /npm/i, /docker/i, /terminal/i,
        /xcode/i, /intellij/i, /vscode/i, /sublime/i, /atom/i,
        /vim/i, /emacs/i, /python/i, /java/i, /ruby/i,
        /postman/i, /insomnia/i, /sequel/i, /tableplus/i,
        /github/i, /sourcetree/i, /fork/i, /tower/i,
        /simulator/i, /instruments/i, /homebrew/i, /brew/i
      ]
    };

    // Color schemes for each process type
    this.colorSchemes = {
      browser: {
        primary: '#4A90E2',
        secondary: '#7BB3F0',
        particles: '#B8D4F0',
        gradient: ['#4A90E2', '#7BB3F0', '#B8D4F0']
      },
      system: {
        primary: '#50C878',
        secondary: '#7DD87F',
        particles: '#B8E6C1',
        gradient: ['#50C878', '#7DD87F', '#B8E6C1']
      },
      media: {
        primary: '#9B59B6',
        secondary: '#B574C4',
        particles: '#D7BDE2',
        gradient: ['#9B59B6', '#B574C4', '#D7BDE2']
      },
      development: {
        primary: '#E67E22',
        secondary: '#F39C12',
        particles: '#F8C471',
        gradient: ['#E67E22', '#F39C12', '#F8C471']
      },
      other: {
        primary: '#95A5A6',
        secondary: '#BDC3C7',
        particles: '#D5DBDB',
        gradient: ['#95A5A6', '#BDC3C7', '#D5DBDB']
      }
    };
  }

  /**
   * Classifies a process name into a category
   * @param {string} processName - The name of the process
   * @returns {string} - The process type (browser, system, media, development, other)
   */
  classifyProcess(processName) {
    if (!processName || typeof processName !== 'string') {
      return 'other';
    }

    const normalizedName = processName.toLowerCase().trim();

    // Check each category's patterns
    for (const [type, patterns] of Object.entries(this.processPatterns)) {
      if (patterns.some(pattern => pattern.test(normalizedName))) {
        return type;
      }
    }

    return 'other';
  }

  /**
   * Gets the color scheme for a process type
   * @param {string} processType - The process type
   * @returns {Object} - Color scheme object with primary, secondary, particles, and gradient
   */
  getColorScheme(processType) {
    return this.colorSchemes[processType] || this.colorSchemes.other;
  }

  /**
   * Gets the primary color for a process type
   * @param {string} processType - The process type
   * @returns {string} - Hex color string
   */
  getPrimaryColor(processType) {
    const scheme = this.getColorScheme(processType);
    return scheme.primary;
  }

  /**
   * Gets the gradient colors for a process type
   * @param {string} processType - The process type
   * @returns {Array<string>} - Array of hex color strings for gradient
   */
  getGradientColors(processType) {
    const scheme = this.getColorScheme(processType);
    return scheme.gradient;
  }

  /**
   * Gets all available process types
   * @returns {Array<string>} - Array of process type names
   */
  getProcessTypes() {
    return Object.keys(this.colorSchemes);
  }

  /**
   * Gets color information for a specific process name
   * @param {string} processName - The name of the process
   * @returns {Object} - Object containing processType and color scheme
   */
  getProcessColorInfo(processName) {
    const processType = this.classifyProcess(processName);
    const colorScheme = this.getColorScheme(processType);

    return {
      processType,
      colorScheme,
      primaryColor: colorScheme.primary,
      gradientColors: colorScheme.gradient
    };
  }

  /**
   * Adds a new process pattern to an existing category
   * @param {string} category - The category to add to
   * @param {RegExp} pattern - The regex pattern to add
   */
  addProcessPattern(category, pattern) {
    if (this.processPatterns[category] && pattern instanceof RegExp) {
      this.processPatterns[category].push(pattern);
    }
  }

  /**
   * Updates the color scheme for a process type
   * @param {string} processType - The process type
   * @param {Object} colorScheme - New color scheme object
   */
  updateColorScheme(processType, colorScheme) {
    if (this.colorSchemes[processType]) {
      this.colorSchemes[processType] = { ...this.colorSchemes[processType], ...colorScheme };
    }
  }

  /**
   * Gets statistics about process classification
   * @param {Array<string>} processNames - Array of process names to analyze
   * @returns {Object} - Statistics object with counts per category
   */
  getClassificationStats(processNames) {
    const stats = {
      browser: 0,
      system: 0,
      media: 0,
      development: 0,
      other: 0,
      total: processNames.length
    };

    processNames.forEach(processName => {
      const type = this.classifyProcess(processName);
      stats[type]++;
    });

    return stats;
  }
}

module.exports = ProcessColorizer;