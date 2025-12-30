// Simple script to convert SVG to PNG using sharp (if available)
// Run: node generate-preview-png.js

const fs = require('fs');
const path = require('path');

async function convertSvgToPng() {
  try {
    // Try to use sharp if available
    const sharp = require('sharp');
    
    const svgBuffer = fs.readFileSync('marketplace-preview.svg');
    
    await sharp(svgBuffer)
      .resize(960, 540)
      .png()
      .toFile('marketplace-preview.png');
    
    console.log('✅ Created marketplace-preview.png (960x540)');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('ℹ️  sharp module not found. SVG file created successfully.');
      console.log('   You can:');
      console.log('   1. Use the SVG file directly (marketplace-preview.svg)');
      console.log('   2. Install sharp: npm install sharp');
      console.log('   3. Convert SVG to PNG using an online tool or image editor');
    } else {
      console.error('Error:', error.message);
    }
  }
}

convertSvgToPng();

