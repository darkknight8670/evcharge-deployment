const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const filesToSync = [
  {
    src: path.join(rootDir, "artifacts", "contracts", "EVChargingEscrow.sol", "EVChargingEscrow.json"),
    dest: path.join(backendDir, "data", "abis", "EVChargingEscrow.json")
  },
  {
    src: path.join(rootDir, "artifacts", "contracts", "VehicleRegistry.sol", "Userregistry.json"),
    dest: path.join(backendDir, "data", "abis", "Userregistry.json")
  },
  {
    src: path.join(rootDir, "Addresses.json"),
    dest: path.join(backendDir, "data", "Addresses.json")
  },
  {
    src: path.join(rootDir, "Addresses.json"),
    dest: path.join(frontendDir, "Addresses.json")
  }
];

console.log("🚀 Preparing for deployment...");

filesToSync.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied: ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
  } else {
    console.warn(`⚠️ Warning: Source file not found: ${src}`);
  }
});

console.log("✨ Ready for deployment! Push these changes to GitHub.");
