const ProcessColorizer = require('../utils/ProcessColorizer');

describe('ProcessColorizer', () => {
  let processColorizer;

  beforeEach(() => {
    processColorizer = new ProcessColorizer();
  });

  describe('Process Classification', () => {
    test('should classify browser processes correctly', () => {
      const browserProcesses = [
        'Chrome',
        'Firefox',
        'Safari',
        'Microsoft Edge',
        'Opera',
        'Brave Browser',
        'Vivaldi',
        'Arc',
        'WebKit',
        'Chromium'
      ];

      browserProcesses.forEach(processName => {
        expect(processColorizer.classifyProcess(processName)).toBe('browser');
      });
    });

    test('should classify system processes correctly', () => {
      const systemProcesses = [
        'kernel_task',
        'systemd',
        'launchd',
        'System Preferences',
        'Activity Monitor',
        'Finder',
        'Spotlight',
        'networkd',
        'bluetoothd',
        'wifid'
      ];

      systemProcesses.forEach(processName => {
        expect(processColorizer.classifyProcess(processName)).toBe('system');
      });
    });

    test('should classify media processes correctly', () => {
      const mediaProcesses = [
        'Spotify',
        'VLC',
        'QuickTime Player',
        'Music',
        'Netflix',
        'iTunes',
        'Photos',
        'Adobe Photoshop',
        'Final Cut Pro',
        'iMovie',
        'Plex',
        'OBS Studio'
      ];

      mediaProcesses.forEach(processName => {
        expect(processColorizer.classifyProcess(processName)).toBe('media');
      });
    });

    test('should classify development processes correctly', () => {
      const developmentProcesses = [
        'Visual Studio Code',
        'Xcode',
        'IntelliJ IDEA',
        'Sublime Text',
        'Terminal',
        'node',
        'npm',
        'git',
        'Docker',
        'Python',
        'Postman',
        'GitHub Desktop',
        'Simulator'
      ];

      developmentProcesses.forEach(processName => {
        expect(processColorizer.classifyProcess(processName)).toBe('development');
      });
    });

    test('should classify unknown processes as other', () => {
      const unknownProcesses = [
        'RandomApp',
        'UnknownProcess',
        'CustomSoftware',
        '',
        null,
        undefined
      ];

      unknownProcesses.forEach(processName => {
        expect(processColorizer.classifyProcess(processName)).toBe('other');
      });
    });

    test('should handle case insensitive matching', () => {
      expect(processColorizer.classifyProcess('CHROME')).toBe('browser');
      expect(processColorizer.classifyProcess('chrome')).toBe('browser');
      expect(processColorizer.classifyProcess('Chrome')).toBe('browser');
      expect(processColorizer.classifyProcess('cHrOmE')).toBe('browser');
    });

    test('should handle partial name matching', () => {
      expect(processColorizer.classifyProcess('Google Chrome Helper')).toBe('browser');
      expect(processColorizer.classifyProcess('Firefox Developer Edition')).toBe('browser');
      expect(processColorizer.classifyProcess('Visual Studio Code - Insiders')).toBe('development');
    });
  });

  describe('Color Scheme Management', () => {
    test('should return correct color scheme for each process type', () => {
      const browserScheme = processColorizer.getColorScheme('browser');
      expect(browserScheme).toHaveProperty('primary', '#4A90E2');
      expect(browserScheme).toHaveProperty('secondary', '#7BB3F0');
      expect(browserScheme).toHaveProperty('particles', '#B8D4F0');
      expect(browserScheme).toHaveProperty('gradient');
      expect(browserScheme.gradient).toEqual(['#4A90E2', '#7BB3F0', '#B8D4F0']);

      const systemScheme = processColorizer.getColorScheme('system');
      expect(systemScheme).toHaveProperty('primary', '#50C878');

      const mediaScheme = processColorizer.getColorScheme('media');
      expect(mediaScheme).toHaveProperty('primary', '#9B59B6');

      const developmentScheme = processColorizer.getColorScheme('development');
      expect(developmentScheme).toHaveProperty('primary', '#E67E22');

      const otherScheme = processColorizer.getColorScheme('other');
      expect(otherScheme).toHaveProperty('primary', '#95A5A6');
    });

    test('should return other color scheme for unknown process types', () => {
      const unknownScheme = processColorizer.getColorScheme('unknown');
      expect(unknownScheme).toEqual(processColorizer.getColorScheme('other'));
    });

    test('should return primary color for process type', () => {
      expect(processColorizer.getPrimaryColor('browser')).toBe('#4A90E2');
      expect(processColorizer.getPrimaryColor('system')).toBe('#50C878');
      expect(processColorizer.getPrimaryColor('media')).toBe('#9B59B6');
      expect(processColorizer.getPrimaryColor('development')).toBe('#E67E22');
      expect(processColorizer.getPrimaryColor('other')).toBe('#95A5A6');
    });

    test('should return gradient colors for process type', () => {
      const browserGradient = processColorizer.getGradientColors('browser');
      expect(browserGradient).toEqual(['#4A90E2', '#7BB3F0', '#B8D4F0']);

      const systemGradient = processColorizer.getGradientColors('system');
      expect(systemGradient).toEqual(['#50C878', '#7DD87F', '#B8E6C1']);
    });
  });

  describe('Process Color Info', () => {
    test('should return complete color info for a process name', () => {
      const chromeInfo = processColorizer.getProcessColorInfo('Chrome');
      
      expect(chromeInfo).toHaveProperty('processType', 'browser');
      expect(chromeInfo).toHaveProperty('colorScheme');
      expect(chromeInfo).toHaveProperty('primaryColor', '#4A90E2');
      expect(chromeInfo).toHaveProperty('gradientColors');
      expect(chromeInfo.gradientColors).toEqual(['#4A90E2', '#7BB3F0', '#B8D4F0']);
    });

    test('should return other type info for unknown processes', () => {
      const unknownInfo = processColorizer.getProcessColorInfo('UnknownApp');
      
      expect(unknownInfo).toHaveProperty('processType', 'other');
      expect(unknownInfo).toHaveProperty('primaryColor', '#95A5A6');
    });
  });

  describe('Process Types', () => {
    test('should return all available process types', () => {
      const processTypes = processColorizer.getProcessTypes();
      
      expect(processTypes).toContain('browser');
      expect(processTypes).toContain('system');
      expect(processTypes).toContain('media');
      expect(processTypes).toContain('development');
      expect(processTypes).toContain('other');
      expect(processTypes).toHaveLength(5);
    });
  });

  describe('Classification Statistics', () => {
    test('should return correct classification statistics', () => {
      const processNames = [
        'Chrome', 'Firefox', 'Safari',  // 3 browsers
        'Finder', 'System Preferences', // 2 system
        'Spotify', 'VLC',               // 2 media
        'Xcode',                        // 1 development
        'UnknownApp', 'RandomProcess'   // 2 other
      ];

      const stats = processColorizer.getClassificationStats(processNames);

      expect(stats.browser).toBe(3);
      expect(stats.system).toBe(2);
      expect(stats.media).toBe(2);
      expect(stats.development).toBe(1);
      expect(stats.other).toBe(2);
      expect(stats.total).toBe(10);
    });

    test('should handle empty process list', () => {
      const stats = processColorizer.getClassificationStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.browser).toBe(0);
      expect(stats.system).toBe(0);
      expect(stats.media).toBe(0);
      expect(stats.development).toBe(0);
      expect(stats.other).toBe(0);
    });
  });

  describe('Pattern Management', () => {
    test('should allow adding new process patterns', () => {
      // Add a new browser pattern
      processColorizer.addProcessPattern('browser', /newbrowser/i);
      
      expect(processColorizer.classifyProcess('NewBrowser')).toBe('browser');
    });

    test('should not add invalid patterns', () => {
      const originalPatterns = processColorizer.processPatterns.browser.length;
      
      // Try to add invalid pattern
      processColorizer.addProcessPattern('browser', 'not-a-regex');
      
      expect(processColorizer.processPatterns.browser.length).toBe(originalPatterns);
    });

    test('should not add patterns to non-existent categories', () => {
      processColorizer.addProcessPattern('nonexistent', /test/i);
      
      expect(processColorizer.processPatterns.nonexistent).toBeUndefined();
    });
  });

  describe('Color Scheme Updates', () => {
    test('should allow updating color schemes', () => {
      const newColors = {
        primary: '#FF0000',
        secondary: '#FF5555'
      };

      processColorizer.updateColorScheme('browser', newColors);
      
      const updatedScheme = processColorizer.getColorScheme('browser');
      expect(updatedScheme.primary).toBe('#FF0000');
      expect(updatedScheme.secondary).toBe('#FF5555');
      expect(updatedScheme.particles).toBe('#B8D4F0'); // Should keep original
    });

    test('should not update non-existent color schemes', () => {
      const originalSchemes = { ...processColorizer.colorSchemes };
      
      processColorizer.updateColorScheme('nonexistent', { primary: '#FF0000' });
      
      expect(processColorizer.colorSchemes).toEqual(originalSchemes);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined process names', () => {
      expect(processColorizer.classifyProcess(null)).toBe('other');
      expect(processColorizer.classifyProcess(undefined)).toBe('other');
    });

    test('should handle empty string process names', () => {
      expect(processColorizer.classifyProcess('')).toBe('other');
      expect(processColorizer.classifyProcess('   ')).toBe('other');
    });

    test('should handle non-string process names', () => {
      expect(processColorizer.classifyProcess(123)).toBe('other');
      expect(processColorizer.classifyProcess({})).toBe('other');
      expect(processColorizer.classifyProcess([])).toBe('other');
    });
  });
});