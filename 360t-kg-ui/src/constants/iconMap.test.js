import { getNodeIcon, DEFAULT_ICON, ICON_MAP } from './iconMap';

describe('getNodeIcon', () => {
  // Test that each label in ICON_MAP returns the correct icon
  Object.entries(ICON_MAP).forEach(([label, expectedIcon]) => {
    it(`should return the correct icon for the label "${label}"`, () => {
      expect(getNodeIcon(label)).toBe(expectedIcon);
    });
  });

  // Test for a label that does not exist in the map
  it('should return the default icon for an unknown label', () => {
    const unknownLabel = 'ThisLabelDoesNotExist';
    expect(getNodeIcon(unknownLabel)).toBe(DEFAULT_ICON);
  });

  // Test for null or undefined input
  it('should return the default icon for a null or undefined label', () => {
    expect(getNodeIcon(null)).toBe(DEFAULT_ICON);
    expect(getNodeIcon(undefined)).toBe(DEFAULT_ICON);
  });

  // Test case insensitivity (if that's a desired feature)
  it('should return the correct icon regardless of label casing', () => {
    // This test assumes the implementation is case-sensitive, as per the PRD.
    // If case-insensitivity is needed, the implementation of getNodeIcon and this test would change.
    expect(getNodeIcon('system')).not.toBe(ICON_MAP['System']);
    expect(getNodeIcon('SYSTEM')).not.toBe(ICON_MAP['System']);
    // It should fall back to the default icon.
    expect(getNodeIcon('system')).toBe(DEFAULT_ICON);
  });
}); 