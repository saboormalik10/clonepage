# 📱 PWA Icon Centering Guide

## Issue
When adding the app to the home screen on mobile devices, the logo may not appear centered.

## Solution

For proper centering on home screens, the icon image needs to be properly formatted:

### Requirements:
1. **Square dimensions**: The icon must be square (same width and height)
2. **Centered logo**: The logo should be centered with padding around it (safe area)
3. **Recommended padding**: Leave 10-15% padding on all sides

### Icon Sizes Needed:
- **iOS**: 180x180 pixels
- **Android**: 192x192 and 512x512 pixels

### How to Create a Centered Icon:

1. **Using Image Editing Software** (Photoshop, GIMP, Figma, etc.):
   - Create a new square canvas (e.g., 512x512 for high quality)
   - Set background color to white or transparent
   - Place your logo in the center
   - Add padding: Leave approximately 10-15% of the canvas size as padding on all sides
   - Export as PNG

2. **Example Dimensions** (for 512x512 canvas):
   - Canvas: 512x512 pixels
   - Logo area: ~360x360 pixels (centered)
   - Padding: ~76 pixels on each side

3. **For iOS specifically**:
   - Create a 180x180 pixel version
   - Ensure the logo is centered with proportional padding

### Current Configuration:
- The manifest includes both `any` and `maskable` icon purposes
- `maskable` icons help Android automatically center and add padding
- iOS uses the standard icon format

### Testing:
1. Clear your browser cache
2. Uninstall the app from home screen (if already added)
3. Re-add to home screen
4. The icon should now appear centered

### Note:
If the logo still doesn't appear centered, you may need to recreate the `logo.png` file with proper padding using an image editor.

