const IPFilter = require('../utils/IPFilter');

describe('IPFilter', () => {
  let ipFilter;

  beforeEach(() => {
    ipFilter = new IPFilter();
  });

  describe('isValidIP', () => {
    test('should validate correct IP addresses', () => {
      expect(ipFilter.isValidIP('192.168.1.1')).toBe(true);
      expect(ipFilter.isValidIP('8.8.8.8')).toBe(true);
      expect(ipFilter.isValidIP('255.255.255.255')).toBe(true);
      expect(ipFilter.isValidIP('0.0.0.0')).toBe(true);
    });

    test('should reject invalid IP addresses', () => {
      expect(ipFilter.isValidIP('256.1.1.1')).toBe(false);
      expect(ipFilter.isValidIP('192.168.1')).toBe(false);
      expect(ipFilter.isValidIP('192.168.1.1.1')).toBe(false);
      expect(ipFilter.isValidIP('not.an.ip.address')).toBe(false);
      expect(ipFilter.isValidIP('')).toBe(false);
      expect(ipFilter.isValidIP(null)).toBe(false);
      expect(ipFilter.isValidIP(undefined)).toBe(false);
    });
  });

  describe('isPrivateIP', () => {
    test('should identify private Class A addresses (10.x.x.x)', () => {
      expect(ipFilter.isPrivateIP('10.0.0.1')).toBe(true);
      expect(ipFilter.isPrivateIP('10.255.255.255')).toBe(true);
    });

    test('should identify private Class B addresses (172.16.x.x - 172.31.x.x)', () => {
      expect(ipFilter.isPrivateIP('172.16.0.1')).toBe(true);
      expect(ipFilter.isPrivateIP('172.31.255.255')).toBe(true);
      expect(ipFilter.isPrivateIP('172.20.1.1')).toBe(true);
    });

    test('should identify private Class C addresses (192.168.x.x)', () => {
      expect(ipFilter.isPrivateIP('192.168.1.1')).toBe(true);
      expect(ipFilter.isPrivateIP('192.168.255.255')).toBe(true);
    });

    test('should identify loopback addresses (127.x.x.x)', () => {
      expect(ipFilter.isPrivateIP('127.0.0.1')).toBe(true);
      expect(ipFilter.isPrivateIP('127.255.255.255')).toBe(true);
    });

    test('should identify link-local addresses (169.254.x.x)', () => {
      expect(ipFilter.isPrivateIP('169.254.1.1')).toBe(true);
      expect(ipFilter.isPrivateIP('169.254.255.255')).toBe(true);
    });

    test('should identify multicast addresses (224.x.x.x - 239.x.x.x)', () => {
      expect(ipFilter.isPrivateIP('224.0.0.1')).toBe(true);
      expect(ipFilter.isPrivateIP('239.255.255.255')).toBe(true);
    });

    test('should allow public IP addresses', () => {
      expect(ipFilter.isPrivateIP('8.8.8.8')).toBe(false);
      expect(ipFilter.isPrivateIP('1.1.1.1')).toBe(false);
      expect(ipFilter.isPrivateIP('208.67.222.222')).toBe(false);
      expect(ipFilter.isPrivateIP('173.1.1.1')).toBe(false); // Not in 172.16-31 range
    });

    test('should filter invalid IP addresses', () => {
      expect(ipFilter.isPrivateIP('invalid.ip')).toBe(true);
      expect(ipFilter.isPrivateIP('256.1.1.1')).toBe(true);
      expect(ipFilter.isPrivateIP('')).toBe(true);
    });
  });

  describe('filterPublicIPs', () => {
    test('should filter out private IPs from array', () => {
      const ips = [
        '8.8.8.8',        // Public - should keep
        '192.168.1.1',    // Private - should filter
        '1.1.1.1',        // Public - should keep
        '10.0.0.1',       // Private - should filter
        '208.67.222.222', // Public - should keep
        '127.0.0.1'       // Private - should filter
      ];

      const result = ipFilter.filterPublicIPs(ips);
      expect(result).toEqual(['8.8.8.8', '1.1.1.1', '208.67.222.222']);
    });

    test('should handle empty arrays', () => {
      expect(ipFilter.filterPublicIPs([])).toEqual([]);
    });

    test('should handle non-array input', () => {
      expect(ipFilter.filterPublicIPs(null)).toEqual([]);
      expect(ipFilter.filterPublicIPs('not an array')).toEqual([]);
    });
  });

  describe('extractIPs', () => {
    test('should extract IP addresses from text', () => {
      const text = 'Connection to 8.8.8.8:443 and 1.1.1.1:80 established';
      const result = ipFilter.extractIPs(text);
      expect(result).toContain('8.8.8.8');
      expect(result).toContain('1.1.1.1');
    });

    test('should remove duplicate IPs', () => {
      const text = '8.8.8.8 connected to 8.8.8.8 again';
      const result = ipFilter.extractIPs(text);
      expect(result).toEqual(['8.8.8.8']);
    });

    test('should handle text with no IPs', () => {
      const text = 'No IP addresses here';
      const result = ipFilter.extractIPs(text);
      expect(result).toEqual([]);
    });

    test('should handle empty or invalid input', () => {
      expect(ipFilter.extractIPs('')).toEqual([]);
      expect(ipFilter.extractIPs(null)).toEqual([]);
      expect(ipFilter.extractIPs(undefined)).toEqual([]);
    });
  });

  describe('extractPublicIPs', () => {
    test('should extract only public IPs from text', () => {
      const text = 'Connections: 8.8.8.8:443, 192.168.1.1:80, 1.1.1.1:443, 10.0.0.1:22';
      const result = ipFilter.extractPublicIPs(text);
      expect(result).toEqual(['8.8.8.8', '1.1.1.1']);
    });

    test('should return empty array when no public IPs found', () => {
      const text = 'Local connections: 192.168.1.1, 10.0.0.1, 127.0.0.1';
      const result = ipFilter.extractPublicIPs(text);
      expect(result).toEqual([]);
    });
  });
});