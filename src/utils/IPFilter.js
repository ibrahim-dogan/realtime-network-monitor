const CONFIG = require('../config');

/**
 * IPFilter class for identifying and filtering private/local IP addresses
 */
class IPFilter {
  constructor() {
    this.privateRanges = CONFIG.IP_FILTER_RULES;
  }

  /**
   * Validates if a string is a valid IP address format
   * @param {string} ip - IP address to validate
   * @returns {boolean} - True if valid IP format
   */
  isValidIP(ip) {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);
    
    if (!match) {
      return false;
    }

    // Check each octet is between 0-255
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(match[i], 10);
      if (octet < 0 || octet > 255) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if an IP address is private/local and should be filtered
   * @param {string} ip - IP address to check
   * @returns {boolean} - True if IP should be filtered (is private/local)
   */
  isPrivateIP(ip) {
    if (!this.isValidIP(ip)) {
      return true; // Filter invalid IPs
    }

    // Check against all private IP ranges
    for (const range of this.privateRanges) {
      if (ip.startsWith(range)) {
        return true;
      }
    }

    // Additional specific checks for edge cases
    const octets = ip.split('.').map(Number);
    
    // Check 172.16.0.0 to 172.31.255.255 (Class B private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return true;
    }

    // Check broadcast addresses
    if (octets[3] === 255) {
      return true;
    }

    // Check reserved ranges
    if (octets[0] === 0 || octets[0] >= 240) {
      return true;
    }

    return false;
  }

  /**
   * Filters an array of IP addresses, removing private/local ones
   * @param {string[]} ips - Array of IP addresses to filter
   * @returns {string[]} - Array of public IP addresses
   */
  filterPublicIPs(ips) {
    if (!Array.isArray(ips)) {
      return [];
    }

    return ips.filter(ip => !this.isPrivateIP(ip));
  }

  /**
   * Extracts IP addresses from a text string
   * @param {string} text - Text containing potential IP addresses
   * @returns {string[]} - Array of extracted IP addresses
   */
  extractIPs(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
    const matches = text.match(ipRegex) || [];
    
    // Remove duplicates and validate
    const uniqueIPs = [...new Set(matches)];
    return uniqueIPs.filter(ip => this.isValidIP(ip));
  }

  /**
   * Extracts and filters public IP addresses from text
   * @param {string} text - Text containing potential IP addresses
   * @returns {string[]} - Array of public IP addresses
   */
  extractPublicIPs(text) {
    const allIPs = this.extractIPs(text);
    return this.filterPublicIPs(allIPs);
  }
}

module.exports = IPFilter;