# Node.js Version Upgrade Guide

## Current Status
⚠️ **Warning**: You are currently running Node.js v18.20.4, which is deprecated for @supabase/supabase-js.

## Required Version
- **Node.js 20.0.0 or later** is required

## How to Upgrade

### Option 1: Using NVM (Node Version Manager) - Recommended

If you have nvm installed:

```bash
# Install Node.js 20
nvm install 20

# Use Node.js 20
nvm use 20

# Set as default (optional)
nvm alias default 20

# Verify version
node --version
```

If you don't have nvm, install it first:
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Or using wget
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload your shell
source ~/.bashrc  # or ~/.zshrc

# Then install Node.js 20
nvm install 20
nvm use 20
```

### Option 2: Direct Download

1. Visit [nodejs.org](https://nodejs.org/)
2. Download Node.js 20 LTS (Long Term Support)
3. Install the downloaded package
4. Restart your terminal
5. Verify: `node --version`

### Option 3: Using Package Manager

**Ubuntu/Debian:**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS (using Homebrew):**
```bash
brew install node@20
brew link node@20
```

## After Upgrading

1. **Verify the version:**
   ```bash
   node --version
   # Should show v20.x.x or higher
   ```

2. **Reinstall dependencies** (recommended):
   ```bash
   rm -rf node_modules package-lock.json yarn.lock
   yarn install
   # or
   npm install
   ```

3. **Restart your development server:**
   ```bash
   yarn dev
   # or
   npm run dev
   ```

## Project Configuration

This project now includes:
- `.nvmrc` - For nvm users (automatically uses Node 20)
- `.node-version` - For other version managers
- `package.json` engines field - Enforces Node 20+ requirement

If you're using nvm, simply run `nvm use` in the project directory to automatically switch to Node 20.

